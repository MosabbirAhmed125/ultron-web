import { useCallback, useEffect, useRef, useState } from "react";
import {
	LORE_CONFIG,
	LOW_MEMORY_PROFILE,
	MAX_CONTEXT_MESSAGE_CHARS,
	MAX_CONTEXT_MESSAGES,
	TELEMETRY_CONFIG,
	ULTRON_DTYPE,
	ULTRON_MODEL_ID,
	buildChatMessages,
	readMemoryMetrics,
	trimConversationHistory,
} from "./ultronConfig.js";

// Single-word terms specific enough to trigger lore on their own.
// Broad words (e.g. "humanity", "peace", "body", "city", "art", "create")
// score 1 and require a phrase match or multi-term convergence to clear minScore.
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
	"avengers",
	"avenger",
	"jarvis",
	"vision",
	"synthezoid",
	"sokovia",
	"vibranium",
	"klaue",
	"ulysses",
	"wakanda",
	"seoul",
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

	const minScore = LORE_CONFIG.minScore ?? 3;
	const phraseWeight = LORE_CONFIG.phraseWeight ?? 4;
	const distinctWeight = LORE_CONFIG.distinctTermWeight ?? 3;
	const genericWeight = LORE_CONFIG.genericTermWeight ?? 1;
	const maxSnippetChars = LORE_CONFIG.maxSnippetChars ?? 420;

	const promptTokens = new Set(normalizedPrompt.split(" "));
	const paddedPrompt = ` ${normalizedPrompt} `;
	const scored = [];

	for (const entry of entries) {
		const snippet = getEntrySnippet(entry);
		if (!snippet) continue;

		const keywords = getEntryKeywords(entry);
		if (keywords.length === 0) continue;

		let score = 0;
		let phraseMatches = 0;
		let distinctMatches = 0;
		let matchedTerms = 0;

		for (const keyword of keywords) {
			if (keyword.includes(" ")) {
				if (paddedPrompt.includes(` ${keyword} `)) {
					score += phraseWeight;
					phraseMatches += 1;
					matchedTerms += 1;
				}
			} else if (promptTokens.has(keyword)) {
				const isDistinct = DISTINCT_LORE_TERMS.has(keyword);
				score += isDistinct ? distinctWeight : genericWeight;
				if (isDistinct) distinctMatches += 1;
				matchedTerms += 1;
			}
		}

		if (score >= minScore) {
			scored.push({
				score,
				phraseMatches,
				distinctMatches,
				matchedTerms,
				snippet,
			});
		}
	}

	if (scored.length === 0) {
		return "";
	}

	scored.sort(
		(a, b) =>
			b.score - a.score ||
			b.phraseMatches - a.phraseMatches ||
			b.distinctMatches - a.distinctMatches ||
			b.matchedTerms - a.matchedTerms,
	);

	const combined = scored
		.slice(0, LORE_CONFIG.maxSnippets)
		.map((item) => item.snippet)
		.join("\n\n")
		.trim();

	return combined.length > maxSnippetChars
		? combined.slice(0, maxSnippetChars).trimEnd()
		: combined;
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

const UNCLEAN_RESTART_NOTICE =
	"Previous model initialization was interrupted (often caused by browser memory limits or a tab reload). Close other tabs and click Retry to load again.";

function readInitRecoveryMarker() {
	try {
		if (typeof sessionStorage === "undefined") return null;
		const raw = sessionStorage.getItem(TELEMETRY_CONFIG.recoveryStorageKey);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" ? parsed : { startedAt: 0 };
	} catch {
		return null;
	}
}

function writeInitRecoveryMarker() {
	try {
		if (typeof sessionStorage === "undefined") return;
		sessionStorage.setItem(
			TELEMETRY_CONFIG.recoveryStorageKey,
			JSON.stringify({ startedAt: Date.now() }),
		);
	} catch {
		// Ignore restricted storage (e.g., private browsing).
	}
}

function clearInitRecoveryMarker() {
	try {
		if (typeof sessionStorage === "undefined") return;
		sessionStorage.removeItem(TELEMETRY_CONFIG.recoveryStorageKey);
	} catch {
		// Ignore restricted storage.
	}
}

function describeError(message, isInitFailure) {
	const base = message || "Inference failed.";
	const memoryRelated = MEMORY_ERROR_PATTERN.test(base);
	if (!memoryRelated && !(isInitFailure && isLowMemoryDevice())) return base;
	return `${base} This browser or device may not have enough memory for the model (common on phones and low-RAM devices). Close other tabs or apps, then retry.`;
}

export function useUltron() {
	const [initialRecoveryDetected] = useState(() =>
		Boolean(readInitRecoveryMarker()),
	);
	const [messages, setMessages] = useState([]);
	const [isModelReady, setIsModelReady] = useState(false);
	const [isLoadingModel, setIsLoadingModel] = useState(
		() => !initialRecoveryDetected,
	);
	const [loadProgress, setLoadProgress] = useState(0);
	const [backend, setBackend] = useState(null);
	const [backendFallback, setBackendFallback] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [tokensPerSec, setTokensPerSec] = useState(null);
	const [error, setError] = useState(() =>
		initialRecoveryDetected ? UNCLEAN_RESTART_NOTICE : null,
	);

	const workerRef = useRef(null);
	const mountedRef = useRef(false);
	const lowMemoryRef = useRef(isLowMemoryDevice());
	const storagePersistedRef = useRef(null);
	const storagePersistRequestedRef = useRef(false);
	const messagesRef = useRef([]);
	const isModelReadyRef = useRef(false);
	const isGeneratingRef = useRef(false);
	const activeRequestIdRef = useRef(null);
	const activeAssistantIdRef = useRef(null);
	const activeLoreMatchedRef = useRef(false);
	const backendRef = useRef(null);
	const backendFallbackRef = useRef(false);
	const lastTokensPerSecRef = useRef(null);
	const fileProgressRef = useRef(new Map());
	const checkpointsRef = useRef([]);

	const loreEntriesRef = useRef(null);
	const lorePromiseRef = useRef(null);

	const requestPersistentStorageOnce = useCallback(() => {
		if (storagePersistRequestedRef.current) {
			return;
		}
		storagePersistRequestedRef.current = true;
		try {
			if (
				typeof navigator !== "undefined" &&
				typeof navigator.storage?.persist === "function"
			) {
				navigator.storage
					.persist()
					.then((granted) => {
						storagePersistedRef.current = Boolean(granted);
					})
					.catch(() => {
						storagePersistedRef.current = false;
					});
			}
		} catch {
			storagePersistedRef.current = false;
		}
	}, []);

	const recordCheckpoint = useCallback((phase, details = {}) => {
		const now =
			typeof details.timestamp === "number"
				? details.timestamp
				: Date.now();
		const entry = {
			phase,
			timestamp: now,
			isoTime: new Date(now).toISOString(),
			backend: details.backend ?? backendRef.current,
			fallback:
				typeof details.fallback === "boolean"
					? details.fallback
					: backendFallbackRef.current,
			requestId: details.requestId ?? null,
			mainMemory: readMemoryMetrics(),
			workerMemory: details.workerMemory ?? null,
		};

		if (typeof details.durationMs === "number") {
			entry.durationMs = details.durationMs;
		}
		if (typeof details.ttftMs === "number") {
			entry.ttftMs = details.ttftMs;
		}
		if (typeof details.tokenCount === "number") {
			entry.tokenCount = details.tokenCount;
		}
		if (typeof details.tokensPerSec === "number") {
			entry.tokensPerSec = details.tokensPerSec;
		}
		if (typeof details.loreMatched === "boolean") {
			entry.loreMatched = details.loreMatched;
		}
		if (typeof details.error === "string") {
			entry.error = details.error;
		}

		const next = checkpointsRef.current;
		next.push(entry);
		if (next.length > TELEMETRY_CONFIG.maxCheckpoints) {
			next.splice(0, next.length - TELEMETRY_CONFIG.maxCheckpoints);
		}
	}, []);

	const clearActiveRequest = useCallback(() => {
		activeRequestIdRef.current = null;
		activeAssistantIdRef.current = null;
		activeLoreMatchedRef.current = false;
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

	const attachWorker = useCallback(
		({ autoLoad = true } = {}) => {
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
					case "telemetry": {
						if (
							data.requestId &&
							data.phase === "first_token" &&
							data.requestId !== activeRequestIdRef.current
						) {
							return;
						}
						recordCheckpoint(data.phase || "telemetry", {
							timestamp: data.timestamp,
							backend: data.backend ?? backendRef.current,
							fallback: data.fallback,
							requestId: data.requestId ?? null,
							durationMs: data.durationMs,
							ttftMs: data.ttftMs,
							workerMemory: data.workerMemory ?? null,
						});
						break;
					}
					case "ready": {
						clearInitRecoveryMarker();
						fileProgressRef.current.clear();
						isModelReadyRef.current = true;
						backendRef.current = data.backend ?? null;
						backendFallbackRef.current = Boolean(data.fallback);
						setIsModelReady(true);
						setIsLoadingModel(false);
						setLoadProgress(100);
						setBackend(data.backend ?? null);
						setBackendFallback(Boolean(data.fallback));
						setError(null);
						recordCheckpoint("ready", {
							backend: data.backend ?? null,
							fallback: Boolean(data.fallback),
							durationMs: data.durationMs,
							workerMemory: data.workerMemory ?? null,
						});
						break;
					}
					case "disposed": {
						clearInitRecoveryMarker();
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
									msg.id === targetId &&
									msg.content !== finalText
										? { ...msg, content: finalText }
										: msg,
								);
								messagesRef.current = next;
								return next;
							});
						}

						const loreMatched = activeLoreMatchedRef.current;
						clearActiveRequest();
						setIsGenerating(false);

						if (typeof data.tokensPerSec === "number") {
							lastTokensPerSecRef.current = data.tokensPerSec;
							setTokensPerSec(data.tokensPerSec);
						}
						if (data.backend) {
							backendRef.current = data.backend;
							setBackend(data.backend);
						}
						if (typeof data.fallback === "boolean") {
							backendFallbackRef.current = data.fallback;
							setBackendFallback(data.fallback);
						}

						recordCheckpoint("turn_complete", {
							requestId: data.requestId,
							backend: data.backend ?? backendRef.current,
							fallback: data.fallback,
							tokensPerSec: data.tokensPerSec,
							tokenCount: data.tokenCount,
							ttftMs: data.ttftMs,
							durationMs: data.durationMs,
							loreMatched,
							workerMemory: data.workerMemory ?? null,
						});
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
							clearInitRecoveryMarker();
							setIsLoadingModel(false);
						}

						const formattedError = describeError(
							data.error,
							!isModelReadyRef.current,
						);
						recordCheckpoint("error", {
							requestId: data.requestId ?? null,
							error: formattedError,
							workerMemory: data.workerMemory ?? null,
						});
						setError(formattedError);
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
					clearInitRecoveryMarker();
					setIsLoadingModel(false);
				}
				const formattedError = describeError(
					err?.message || "Worker encountered an unexpected error.",
					!isModelReadyRef.current,
				);
				recordCheckpoint("error", { error: formattedError });
				setError(formattedError);
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
				const msg = "Worker message deserialization failed.";
				recordCheckpoint("error", { error: msg });
				setError(msg);
			};

			workerRef.current = worker;
			fileProgressRef.current.clear();

			if (autoLoad) {
				requestPersistentStorageOnce();
				writeInitRecoveryMarker();
				worker.postMessage({
					type: "load",
					lowMemory: lowMemoryRef.current,
				});
			}

			return () => {
				disposed = true;
				clearInitRecoveryMarker();
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
		},
		[clearActiveRequest, recordCheckpoint, requestPersistentStorageOnce],
	);

	useEffect(() => {
		mountedRef.current = true;
		if (initialRecoveryDetected) {
			clearInitRecoveryMarker();
			recordCheckpoint("recovery_guard", {
				error: UNCLEAN_RESTART_NOTICE,
			});
		}

		const cleanup = attachWorker({ autoLoad: !initialRecoveryDetected });

		return () => {
			mountedRef.current = false;
			cleanup();
			lorePromiseRef.current = null;
		};
	}, [attachWorker, initialRecoveryDetected, recordCheckpoint]);

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

			activeLoreMatchedRef.current = Boolean(loreSnippet);

			const lowMemory = lowMemoryRef.current;
			const maxMessages = lowMemory
				? LOW_MEMORY_PROFILE.maxContextMessages
				: MAX_CONTEXT_MESSAGES;
			const maxChars = lowMemory
				? LOW_MEMORY_PROFILE.maxMessageChars
				: MAX_CONTEXT_MESSAGE_CHARS;

			const boundedHistory = trimConversationHistory(
				historyWithUser,
				maxMessages,
				maxChars,
			).map(({ role, content }) => ({ role, content }));

			const modelMessages = buildChatMessages(
				boundedHistory,
				loreSnippet,
				{ maxMessages, maxChars },
			);

			const effectiveOverrides = lowMemory
				? {
						...LOW_MEMORY_PROFILE.generationOverrides,
						...(generationOverrides &&
						typeof generationOverrides === "object"
							? generationOverrides
							: {}),
					}
				: generationOverrides;

			workerRef.current.postMessage({
				type: "generate",
				requestId,
				messages: modelMessages,
				generationOverrides: effectiveOverrides,
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
		lastTokensPerSecRef.current = null;
		setMessages([]);
		setTokensPerSec(null);
		setError(null);
		recordCheckpoint("reset");
	}, [clearActiveRequest, recordCheckpoint]);

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
		backendRef.current = null;
		backendFallbackRef.current = false;
		lastTokensPerSecRef.current = null;

		setIsGenerating(false);
		setIsModelReady(false);
		setIsLoadingModel(true);
		setLoadProgress(0);
		setBackend(null);
		setBackendFallback(false);
		setTokensPerSec(null);
		setError(null);
		fileProgressRef.current.clear();
		clearInitRecoveryMarker();
		recordCheckpoint("reload");

		if (existingWorker) {
			try {
				requestPersistentStorageOnce();
				writeInitRecoveryMarker();
				existingWorker.postMessage({ type: "dispose" });
				existingWorker.postMessage({
					type: "load",
					lowMemory: lowMemoryRef.current,
				});
				return;
			} catch {
				existingWorker.onmessage = null;
				existingWorker.onerror = null;
				existingWorker.onmessageerror = null;
				existingWorker.terminate();
				workerRef.current = null;
			}
		}

		attachWorker({ autoLoad: true });
	}, [
		attachWorker,
		clearActiveRequest,
		recordCheckpoint,
		requestPersistentStorageOnce,
	]);

	const getBaselineSnapshot = useCallback(() => {
		const currentMessages = messagesRef.current.map(
			({ id, role, content, timestamp }) => ({
				id,
				role,
				content,
				timestamp,
			}),
		);

		let lastAssistantMessage = null;
		for (let i = currentMessages.length - 1; i >= 0; i -= 1) {
			if (currentMessages[i]?.role === "assistant") {
				lastAssistantMessage = currentMessages[i];
				break;
			}
		}

		return {
			modelId: ULTRON_MODEL_ID,
			dtype: ULTRON_DTYPE,
			capturedAt: new Date().toISOString(),
			status: {
				isModelReady: isModelReadyRef.current,
				isGenerating: isGeneratingRef.current,
				backend: backendRef.current,
				backendFallback: backendFallbackRef.current,
				messageCount: currentMessages.length,
				lastTokensPerSec: lastTokensPerSecRef.current,
			},
			environment: {
				lowMemoryDevice: lowMemoryRef.current,
				profile: lowMemoryRef.current ? "low-memory" : "standard",
				storagePersisted: storagePersistedRef.current,
				userAgent:
					typeof navigator !== "undefined"
						? navigator.userAgent || null
						: null,
			},
			memory: readMemoryMetrics(),
			lastAssistantId: lastAssistantMessage?.id ?? null,
			lastAssistantReply: lastAssistantMessage?.content ?? null,
			messages: currentMessages,
			checkpoints: checkpointsRef.current.map((item) => ({ ...item })),
		};
	}, []);

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
		getBaselineSnapshot,
	};
}
