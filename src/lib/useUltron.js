import { useCallback, useEffect, useRef, useState } from "react";
import {
	LORE_CONFIG,
	buildChatMessages,
	trimConversationHistory,
} from "./ultronConfig.js";

// Single-word terms specific enough to trigger lore on their own.
// Broad words (e.g. "humanity", "peace", "body", "city") require a phrase
// match or multiple matching terms from the same entry.
const DISTINCT_LORE_TERMS = new Set([
	"ultron",
	"creation",
	"creator",
	"origins",
	"stark",
	"banner",
	"scepter",
	"sceptre",
	"mindstone",
	"peacekeeping",
	"extinction",
	"extinct",
	"avengers",
	"avenger",
	"jarvis",
	"assimilated",
	"vision",
	"synthezoid",
	"sokovia",
	"meteor",
	"vibranium",
	"klaue",
	"ulysses",
	"wakanda",
	"seoul",
	"cho",
	"cradle",
	"wanda",
	"pietro",
	"maximoff",
	"quicksilver",
	"visionquest",
	"mindspace",
	"friday",
	"edith",
	"jocasta",
	"virgil",
	"horton",
	"phineas",
	"nanobot",
	"nanobots",
	"louvre",
	"strings",
	"puppet",
	"puppets",
]);

function createId(prefix) {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return `${prefix}-${crypto.randomUUID()}`;
	}
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeText(value) {
	return String(value ?? "")
		.toLowerCase()
		.replace(/\b(?:[a-z]\.){2,}[a-z]?\.?/g, (acronym) =>
			acronym.replace(/\./g, ""),
		)
		.replace(/[^a-z0-9\s]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function extractLoreEntries(raw) {
	if (Array.isArray(raw)) {
		return raw;
	}
	if (raw && typeof raw === "object") {
		if (Array.isArray(raw.entries)) return raw.entries;
		if (Array.isArray(raw.items)) return raw.items;
		if (Array.isArray(raw.lore)) return raw.lore;
	}
	return [];
}

function getEntryKeywords(entry) {
	if (!entry || typeof entry !== "object") {
		return [];
	}

	const rawTerms = [];
	if (Array.isArray(entry.keywords)) rawTerms.push(...entry.keywords);
	else if (typeof entry.keywords === "string") {
		rawTerms.push(...entry.keywords.split(","));
	}

	if (Array.isArray(entry.tags)) rawTerms.push(...entry.tags);
	else if (typeof entry.tags === "string") {
		rawTerms.push(...entry.tags.split(","));
	}

	const unique = new Set();
	for (const term of rawTerms) {
		const normalized = normalizeText(term);
		if (normalized) {
			unique.add(normalized);
		}
	}
	return Array.from(unique);
}

function getEntrySnippet(entry) {
	if (!entry || typeof entry !== "object") {
		return "";
	}
	const body =
		typeof entry.content === "string"
			? entry.content
			: typeof entry.text === "string"
				? entry.text
				: typeof entry.snippet === "string"
					? entry.snippet
					: "";

	const trimmedBody = body.trim();
	if (!trimmedBody) {
		return "";
	}

	const title = typeof entry.title === "string" ? entry.title.trim() : "";
	return title ? `${title}: ${trimmedBody}` : trimmedBody;
}

function findMatchingLoreSnippet(entries, prompt) {
	if (!Array.isArray(entries) || entries.length === 0) {
		return "";
	}

	const normalizedPrompt = normalizeText(prompt);
	if (!normalizedPrompt) {
		return "";
	}

	const minScore = Math.max(LORE_CONFIG.minScore ?? 2, 2);
	const promptTokens = new Set(normalizedPrompt.split(" "));
	const paddedPrompt = ` ${normalizedPrompt} `;
	const scored = [];

	for (const entry of entries) {
		const snippet = getEntrySnippet(entry);
		if (!snippet) continue;

		const keywords = getEntryKeywords(entry);
		if (keywords.length === 0) continue;

		let score = 0;
		let strongMatches = 0;
		let matchedTerms = 0;

		for (const keyword of keywords) {
			if (keyword.includes(" ")) {
				if (paddedPrompt.includes(` ${keyword} `)) {
					score += 3;
					strongMatches += 1;
					matchedTerms += 1;
				}
			} else if (promptTokens.has(keyword)) {
				const weight = DISTINCT_LORE_TERMS.has(keyword) ? 2 : 1;
				score += weight;
				if (weight >= 2) strongMatches += 1;
				matchedTerms += 1;
			}
		}

		if (score >= minScore) {
			scored.push({ score, strongMatches, matchedTerms, snippet });
		}
	}

	if (scored.length === 0) {
		return "";
	}

	scored.sort(
		(a, b) =>
			b.score - a.score ||
			b.strongMatches - a.strongMatches ||
			b.matchedTerms - a.matchedTerms,
	);

	return scored
		.slice(0, LORE_CONFIG.maxSnippets)
		.map((item) => item.snippet)
		.join("\n\n");
}

function computeAggregateProgress(fileMap, event) {
	const key = event.file || "__default__";

	if (event.status === "done") {
		const prev = fileMap.get(key);
		fileMap.set(key, {
			loaded: prev?.total ?? 1,
			total: prev?.total ?? 1,
			progress: 100,
		});
	} else if (
		typeof event.loaded === "number" &&
		typeof event.total === "number" &&
		event.total > 0
	) {
		fileMap.set(key, {
			loaded: event.loaded,
			total: event.total,
			progress: Math.min(
				100,
				Math.max(0, (event.loaded / event.total) * 100),
			),
		});
	} else if (typeof event.progress === "number") {
		const clamped = Math.min(100, Math.max(0, event.progress));
		const prev = fileMap.get(key);
		fileMap.set(key, {
			loaded: prev?.loaded ?? clamped,
			total: prev?.total ?? 100,
			progress: clamped,
		});
	}

	if (fileMap.size === 0) {
		return null;
	}

	let totalLoaded = 0;
	let totalBytes = 0;
	for (const entry of fileMap.values()) {
		totalLoaded += entry.loaded;
		totalBytes += entry.total;
	}

	if (totalBytes <= 0) {
		return null;
	}

	return Math.min(
		100,
		Math.max(0, Math.round((totalLoaded / totalBytes) * 100)),
	);
}

const MEMORY_ERROR_PATTERN =
	/out of memory|\boom\b|memory|bad_alloc|alloc|device (was )?lost|createbuffer|buffer size|rangeerror|aborted\(\)/i;

function isLowMemoryDevice() {
	if (typeof navigator === "undefined") return false;
	// deviceMemory is Chromium-only and reports GB, capped at 8.
	if (
		typeof navigator.deviceMemory === "number" &&
		navigator.deviceMemory <= 4
	) {
		return true;
	}
	return (
		navigator.userAgentData?.mobile === true ||
		/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "")
	);
}

function describeError(message, isInitFailure) {
	const base = message || "Inference failed.";
	const memoryRelated = MEMORY_ERROR_PATTERN.test(base);
	if (!memoryRelated && !(isInitFailure && isLowMemoryDevice())) return base;
	return `${base} This browser or device may not have enough memory for the model (common on phones and low-RAM devices). Close other tabs or apps, then retry.`;
}

export function useUltron() {
	const [messages, setMessages] = useState([]);
	const [isModelReady, setIsModelReady] = useState(false);
	const [isLoadingModel, setIsLoadingModel] = useState(true);
	const [loadProgress, setLoadProgress] = useState(0);
	const [backend, setBackend] = useState(null);
	const [backendFallback, setBackendFallback] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [tokensPerSec, setTokensPerSec] = useState(null);
	const [error, setError] = useState(null);

	const workerRef = useRef(null);
	const mountedRef = useRef(false);
	const messagesRef = useRef([]);
	const isModelReadyRef = useRef(false);
	const isGeneratingRef = useRef(false);
	const activeRequestIdRef = useRef(null);
	const activeAssistantIdRef = useRef(null);
	const fileProgressRef = useRef(new Map());

	const loreEntriesRef = useRef(null);
	const lorePromiseRef = useRef(null);

	const clearActiveRequest = useCallback(() => {
		activeRequestIdRef.current = null;
		activeAssistantIdRef.current = null;
		isGeneratingRef.current = false;
	}, []);

	const loadLoreOnce = useCallback(async () => {
		if (loreEntriesRef.current !== null) {
			return loreEntriesRef.current;
		}
		if (lorePromiseRef.current) {
			return lorePromiseRef.current;
		}

		lorePromiseRef.current = (async () => {
			try {
				const response = await fetch(LORE_CONFIG.path);
				if (!response.ok) {
					loreEntriesRef.current = [];
					return [];
				}
				const json = await response.json();
				const entries = extractLoreEntries(json);
				loreEntriesRef.current = entries;
				return entries;
			} catch {
				loreEntriesRef.current = [];
				return [];
			} finally {
				lorePromiseRef.current = null;
			}
		})();

		return lorePromiseRef.current;
	}, []);

	const attachWorker = useCallback(() => {
		const worker = new Worker(
			new URL("./ultronWorker.js", import.meta.url),
			{ type: "module" },
		);

		let disposed = false;

		worker.onmessage = (event) => {
			if (
				disposed ||
				!mountedRef.current ||
				workerRef.current !== worker
			) {
				return;
			}

			const data = event?.data;
			if (!data || typeof data !== "object") {
				return;
			}

			switch (data.type) {
				case "progress": {
					const nextProgress = computeAggregateProgress(
						fileProgressRef.current,
						data,
					);
					if (nextProgress !== null) {
						setLoadProgress(nextProgress);
					}
					break;
				}
				case "ready": {
					fileProgressRef.current.clear();
					isModelReadyRef.current = true;
					setIsModelReady(true);
					setIsLoadingModel(false);
					setLoadProgress(100);
					setBackend(data.backend ?? null);
					setBackendFallback(Boolean(data.fallback));
					setError(null);
					break;
				}
				case "token": {
					if (
						!data.requestId ||
						data.requestId !== activeRequestIdRef.current ||
						!activeAssistantIdRef.current
					) {
						return;
					}

					const targetId = activeAssistantIdRef.current;
					const chunk =
						typeof data.token === "string" ? data.token : "";
					if (!chunk) return;

					setMessages((prev) => {
						const next = prev.map((msg) =>
							msg.id === targetId
								? { ...msg, content: msg.content + chunk }
								: msg,
						);
						messagesRef.current = next;
						return next;
					});
					break;
				}
				case "complete": {
					if (
						!data.requestId ||
						data.requestId !== activeRequestIdRef.current
					) {
						return;
					}

					const targetId = activeAssistantIdRef.current;
					const finalText =
						typeof data.text === "string" ? data.text : "";

					if (targetId && finalText) {
						setMessages((prev) => {
							const next = prev.map((msg) =>
								msg.id === targetId && msg.content !== finalText
									? { ...msg, content: finalText }
									: msg,
							);
							messagesRef.current = next;
							return next;
						});
					}

					clearActiveRequest();
					setIsGenerating(false);

					if (typeof data.tokensPerSec === "number") {
						setTokensPerSec(data.tokensPerSec);
					}
					if (data.backend) {
						setBackend(data.backend);
					}
					if (typeof data.fallback === "boolean") {
						setBackendFallback(data.fallback);
					}
					break;
				}
				case "error": {
					if (
						data.requestId &&
						data.requestId !== activeRequestIdRef.current
					) {
						return;
					}

					if (
						data.requestId &&
						data.requestId === activeRequestIdRef.current
					) {
						clearActiveRequest();
						setIsGenerating(false);
					} else if (!isModelReadyRef.current) {
						setIsLoadingModel(false);
					}

					setError(describeError(data.error, !isModelReadyRef.current));
					break;
				}
				default:
					break;
			}
		};

		worker.onerror = (err) => {
			if (
				disposed ||
				!mountedRef.current ||
				workerRef.current !== worker
			) {
				return;
			}
			clearActiveRequest();
			setIsGenerating(false);
			if (!isModelReadyRef.current) {
				setIsLoadingModel(false);
			}
			setError(
				describeError(
					err?.message || "Worker encountered an unexpected error.",
					!isModelReadyRef.current,
				),
			);
		};

		worker.onmessageerror = () => {
			if (
				disposed ||
				!mountedRef.current ||
				workerRef.current !== worker
			) {
				return;
			}
			clearActiveRequest();
			setIsGenerating(false);
			setError("Worker message deserialization failed.");
		};

		workerRef.current = worker;
		fileProgressRef.current.clear();
		worker.postMessage({ type: "load" });

		return () => {
			disposed = true;
			if (activeRequestIdRef.current) {
				try {
					worker.postMessage({
						type: "abort",
						requestId: activeRequestIdRef.current,
					});
				} catch {
					// Worker may already be terminated.
				}
			}
			try {
				worker.postMessage({ type: "dispose" });
			} catch {
				// Ignore postMessage failures during teardown.
			}
			worker.onmessage = null;
			worker.onerror = null;
			worker.onmessageerror = null;
			worker.terminate();
			if (workerRef.current === worker) {
				workerRef.current = null;
			}
			fileProgressRef.current.clear();
			clearActiveRequest();
			isModelReadyRef.current = false;
		};
	}, [clearActiveRequest]);

	useEffect(() => {
		mountedRef.current = true;
		const cleanup = attachWorker();

		return () => {
			mountedRef.current = false;
			cleanup();
			lorePromiseRef.current = null;
		};
	}, [attachWorker]);

	const dispatchGeneration = useCallback(
		async (historyWithUser, latestPrompt, generationOverrides) => {
			const now = Date.now();
			const requestId = createId("req");
			const assistantMessage = {
				id: createId("assistant"),
				role: "assistant",
				content: "",
				timestamp: now,
			};

			const nextMessages = [...historyWithUser, assistantMessage];
			messagesRef.current = nextMessages;
			setMessages(nextMessages);

			activeRequestIdRef.current = requestId;
			activeAssistantIdRef.current = assistantMessage.id;
			isGeneratingRef.current = true;
			setIsGenerating(true);
			setTokensPerSec(null);
			setError(null);

			const loreEntries = await loadLoreOnce();
			const loreSnippet = findMatchingLoreSnippet(
				loreEntries,
				latestPrompt,
			);

			// Guard against unmount, resetChat, or stopGeneration during async lore lookup.
			if (
				!mountedRef.current ||
				!workerRef.current ||
				activeRequestIdRef.current !== requestId
			) {
				return;
			}

			const boundedHistory = trimConversationHistory(historyWithUser).map(
				({ role, content }) => ({ role, content }),
			);

			const modelMessages = buildChatMessages(
				boundedHistory,
				loreSnippet,
			);

			workerRef.current.postMessage({
				type: "generate",
				requestId,
				messages: modelMessages,
				generationOverrides,
			});
		},
		[loadLoreOnce],
	);

	const sendMessage = useCallback(
		async (text, generationOverrides) => {
			const trimmed = typeof text === "string" ? text.trim() : "";
			if (
				!trimmed ||
				isGeneratingRef.current ||
				!isModelReadyRef.current ||
				!workerRef.current
			) {
				return;
			}

			const userMessage = {
				id: createId("user"),
				role: "user",
				content: trimmed,
				timestamp: Date.now(),
			};

			await dispatchGeneration(
				[...messagesRef.current, userMessage],
				trimmed,
				generationOverrides,
			);
		},
		[dispatchGeneration],
	);

	const regenerateLastResponse = useCallback(
		async (generationOverrides) => {
			if (
				isGeneratingRef.current ||
				!isModelReadyRef.current ||
				!workerRef.current
			) {
				return;
			}

			const current = messagesRef.current;
			let lastUserIndex = -1;
			for (let i = current.length - 1; i >= 0; i -= 1) {
				if (current[i]?.role === "user") {
					lastUserIndex = i;
					break;
				}
			}

			if (lastUserIndex === -1) {
				return;
			}

			const historyUpToLastUser = current.slice(0, lastUserIndex + 1);
			const latestPrompt =
				historyUpToLastUser[lastUserIndex]?.content ?? "";

			await dispatchGeneration(
				historyUpToLastUser,
				latestPrompt,
				generationOverrides,
			);
		},
		[dispatchGeneration],
	);

	const stopGeneration = useCallback(() => {
		const requestId = activeRequestIdRef.current;
		const assistantId = activeAssistantIdRef.current;
		if (!requestId) {
			return;
		}

		clearActiveRequest();
		setIsGenerating(false);

		// Remove an untouched empty assistant placeholder if aborted before first token.
		if (assistantId) {
			setMessages((prev) => {
				const target = prev.find((msg) => msg.id === assistantId);
				if (!target || target.content) {
					return prev;
				}
				const next = prev.filter((msg) => msg.id !== assistantId);
				messagesRef.current = next;
				return next;
			});
		}

		try {
			workerRef.current?.postMessage({ type: "abort", requestId });
		} catch {
			// Ignore if worker is already unavailable.
		}
	}, [clearActiveRequest]);

	const resetChat = useCallback(() => {
		const requestId = activeRequestIdRef.current;
		if (requestId) {
			clearActiveRequest();
			setIsGenerating(false);
			try {
				workerRef.current?.postMessage({ type: "abort", requestId });
			} catch {
				// Ignore if worker is already unavailable.
			}
		}

		messagesRef.current = [];
		setMessages([]);
		setTokensPerSec(null);
		setError(null);
	}, [clearActiveRequest]);

	const reloadModel = useCallback(() => {
		const existingWorker = workerRef.current;

		if (activeRequestIdRef.current) {
			try {
				existingWorker?.postMessage({
					type: "abort",
					requestId: activeRequestIdRef.current,
				});
			} catch {
				// Ignore if worker is already terminated.
			}
		}

		clearActiveRequest();
		isModelReadyRef.current = false;

		setIsGenerating(false);
		setIsModelReady(false);
		setIsLoadingModel(true);
		setLoadProgress(0);
		setBackend(null);
		setBackendFallback(false);
		setTokensPerSec(null);
		setError(null);
		fileProgressRef.current.clear();

		if (existingWorker) {
			try {
				existingWorker.postMessage({ type: "dispose" });
				existingWorker.postMessage({ type: "load" });
				return;
			} catch {
				existingWorker.onmessage = null;
				existingWorker.onerror = null;
				existingWorker.onmessageerror = null;
				existingWorker.terminate();
				workerRef.current = null;
			}
		}

		attachWorker();
	}, [attachWorker, clearActiveRequest]);

	return {
		messages,
		isModelReady,
		isLoadingModel,
		loadProgress,
		backend,
		backendFallback,
		isGenerating,
		tokensPerSec,
		error,
		sendMessage,
		regenerateLastResponse,
		stopGeneration,
		resetChat,
		reloadModel,
	};
}
