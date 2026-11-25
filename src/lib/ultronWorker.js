import {
	InterruptableStoppingCriteria,
	TextStreamer,
	pipeline,
} from "@huggingface/transformers";
import {
	GENERATION_CONFIG,
	ULTRON_DTYPE,
	ULTRON_MODEL_ID,
} from "./ultronConfig.js";

let generator = null;
let activeBackend = null;
let activeFallback = false;
let loadPromise = null;
let disposePromise = null;
let loadGeneration = 0;

let activeRequestId = null;
let activeStoppingCriteria = null;

const SPECIAL_STOP_PATTERN = /<\|(?:im_end|im_start|endoftext|end)\|>/;

async function hasWebGPU() {
	if (
		typeof navigator === "undefined" ||
		!("gpu" in navigator) ||
		typeof navigator.gpu?.requestAdapter !== "function"
	) {
		return false;
	}

	try {
		return Boolean(await navigator.gpu.requestAdapter());
	} catch {
		return false;
	}
}

function handleProgress(event) {
	if (!event || typeof event !== "object") {
		return;
	}

	self.postMessage({
		type: "progress",
		status: event.status ?? "progress",
		file: event.file ?? null,
		progress: typeof event.progress === "number" ? event.progress : null,
		loaded: typeof event.loaded === "number" ? event.loaded : null,
		total: typeof event.total === "number" ? event.total : null,
	});
}

async function createPipeline(device) {
	return pipeline("text-generation", ULTRON_MODEL_ID, {
		dtype: ULTRON_DTYPE,
		device,
		progress_callback: handleProgress,
	});
}

async function disposePipelineInstance(instance) {
	if (!instance) {
		return;
	}

	try {
		if (typeof instance.dispose === "function") {
			await instance.dispose();
		} else {
			await instance.model?.dispose?.();
		}
	} finally {
		try {
			await instance.tokenizer?.dispose?.();
		} catch {
			// Ignore tokenizer disposal errors.
		}
	}
}

function formatChatPrompt(instance, messages) {
	const tokenizer = instance.tokenizer;
	if (
		tokenizer?.chat_template &&
		typeof tokenizer.apply_chat_template === "function"
	) {
		try {
			const prompt = tokenizer.apply_chat_template(messages, {
				tokenize: false,
				add_generation_prompt: true,
			});
			if (typeof prompt === "string") {
				return prompt;
			}
		} catch {
			// Fall back when tokenizer metadata has no usable chat template.
		}
	}

	const formattedMessages = messages
		.map((message) => {
			const role =
				typeof message?.role === "string" && message.role.trim()
					? message.role.trim()
					: "user";
			const content =
				typeof message?.content === "string"
					? message.content.trim()
					: "";

			return `<|im_start|>${role}\n${content}<|im_end|>\n`;
		})
		.join("");

	return `${formattedMessages}<|im_start|>assistant\n`;
}

async function loadPipeline() {
	if (disposePromise) {
		await disposePromise;
	}

	if (generator && activeBackend) {
		return {
			instance: generator,
			backend: activeBackend,
			fallback: activeFallback,
		};
	}

	if (loadPromise) {
		return loadPromise;
	}

	const currentGeneration = loadGeneration;

	const currentLoadPromise = (async () => {
		let instance = null;
		let backend = "wasm";
		let fallback = false;

		const webgpuAvailable = await hasWebGPU();
		if (currentGeneration !== loadGeneration) {
			return null;
		}

		if (webgpuAvailable) {
			try {
				instance = await createPipeline("webgpu");
				backend = "webgpu";
			} catch {
				// WebGPU initialization failed; fall back deterministically to WASM.
				fallback = true;
			}
		}

		if (currentGeneration !== loadGeneration) {
			if (instance) {
				try {
					await disposePipelineInstance(instance);
				} catch {
					// Ignore disposal errors on cancelled instances.
				}
			}
			return null;
		}

		if (!instance) {
			instance = await createPipeline("wasm");
			backend = "wasm";
		}

		// If dispose() was called while loading, release this stale instance quietly.
		if (currentGeneration !== loadGeneration) {
			try {
				await disposePipelineInstance(instance);
			} catch {
				// Ignore disposal errors on stale instances.
			}
			return null;
		}

		generator = instance;
		activeBackend = backend;
		activeFallback = fallback;
		return { instance, backend, fallback };
	})();

	loadPromise = currentLoadPromise;

	try {
		return await currentLoadPromise;
	} finally {
		if (loadPromise === currentLoadPromise) {
			loadPromise = null;
		}
	}
}

async function disposePipeline() {
	loadGeneration += 1;

	if (activeStoppingCriteria) {
		const criteria = activeStoppingCriteria;
		activeStoppingCriteria = null;
		criteria.interrupt();
	}
	activeRequestId = null;

	const instanceToDispose = generator;
	generator = null;
	activeBackend = null;
	activeFallback = false;
	loadPromise = null;

	const priorDispose = disposePromise;
	const pendingDispose = (async () => {
		if (priorDispose) {
			try {
				await priorDispose;
			} catch {
				// Continue disposing the current instance even if prior dispose threw.
			}
		}
		try {
			await disposePipelineInstance(instanceToDispose);
		} catch {
			// Ensure state stays reset even if backend disposal throws.
		}
	})();

	disposePromise = pendingDispose;
	try {
		await pendingDispose;
	} finally {
		if (disposePromise === pendingDispose) {
			disposePromise = null;
		}
	}

	self.postMessage({ type: "disposed" });
}

function stripChatTemplateChunk(text) {
	if (typeof text !== "string" || !text) {
		return "";
	}

	return text
		.replace(/<\|(?:im_end|endoftext|end)\|>/g, "")
		.replace(/<\|im_start\|>[^\r\n]*(?:\r?\n|$)/g, "")
		.replace(/<\|(?:im_end|im_start|endoftext|end)?$/g, "")
		.replace(/^(?:im_end|im_start|endoftext|end)\|>/g, "");
}

function stripChatTemplateTokens(text) {
	return stripChatTemplateChunk(text)
		.replace(/\r\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function extractGeneratedText(output) {
	const first = Array.isArray(output) ? output[0] : output;
	const generated = first?.generated_text;

	if (typeof generated === "string") {
		return stripChatTemplateTokens(generated);
	}

	if (Array.isArray(generated)) {
		for (let i = generated.length - 1; i >= 0; i -= 1) {
			const entry = generated[i];
			if (
				entry?.role === "assistant" &&
				typeof entry.content === "string"
			) {
				return stripChatTemplateTokens(entry.content);
			}
		}
	}

	return "";
}

function getStopTokenIds(tokenizer) {
	const ids = new Set();

	const tryAddToken = (token) => {
		try {
			const id =
				typeof tokenizer?.convert_tokens_to_ids === "function"
					? tokenizer.convert_tokens_to_ids(token)
					: tokenizer?.get_vocab?.()?.get?.(token);
			if (Number.isInteger(id) && id >= 0) {
				ids.add(id);
			}
		} catch {
			// Ignore lookup failures on minimal tokenizers.
		}
	};

	tryAddToken("<|im_end|>");
	tryAddToken("<|endoftext|>");

	if (Number.isInteger(tokenizer?.eos_token_id) && tokenizer.eos_token_id >= 0) {
		ids.add(tokenizer.eos_token_id);
	}

	const list = Array.from(ids);
	if (list.length === 0) return null;
	return list.length === 1 ? list[0] : list;
}

async function handleGenerate({ requestId, messages, generationOverrides }) {
	if (!requestId) {
		throw new Error("Missing requestId for generation.");
	}

	if (!Array.isArray(messages) || messages.length === 0) {
		throw new Error("Invalid messages payload for generation.");
	}

	const loaded = await loadPipeline();
	if (!loaded) {
		return;
	}
	const { instance, backend, fallback } = loaded;

	if (activeStoppingCriteria) {
		activeStoppingCriteria.interrupt();
	}

	const stoppingCriteria = new InterruptableStoppingCriteria();
	activeRequestId = requestId;
	activeStoppingCriteria = stoppingCriteria;

	let streamedText = "";
	let hasEmittedContent = false;
	let tokenCount = 0;
	let firstTokenTime = null;
	const startTime = performance.now();

	const streamer = new TextStreamer(instance.tokenizer, {
		skip_prompt: true,
		skip_special_tokens: true,
		token_callback_function: () => {
			if (stoppingCriteria.interrupted || activeRequestId !== requestId) {
				return;
			}
			if (firstTokenTime === null) {
				firstTokenTime = performance.now();
			}
			tokenCount += 1;
		},
		callback_function: (token) => {
			if (
				!token ||
				stoppingCriteria.interrupted ||
				activeRequestId !== requestId
			) {
				return;
			}

			// Stop cleanly if a raw special turn marker leaks into decoded text.
			const stopMatch = SPECIAL_STOP_PATTERN.exec(token);
			const rawSlice = stopMatch ? token.slice(0, stopMatch.index) : token;
			let cleanToken = stripChatTemplateChunk(rawSlice);

			if (!hasEmittedContent) {
				cleanToken = cleanToken.replace(/^\s+/, "");
			}

			if (cleanToken) {
				hasEmittedContent = true;
				streamedText += cleanToken;
				self.postMessage({
					type: "token",
					requestId,
					token: cleanToken,
				});
			}

			if (stopMatch) {
				stoppingCriteria.interrupt();
			}
		},
	});

	const prompt = formatChatPrompt(instance, messages);
	const eosTokenId = getStopTokenIds(instance.tokenizer);

	try {
		const output = await instance(prompt, {
			...GENERATION_CONFIG,
			...(generationOverrides && typeof generationOverrides === "object"
				? generationOverrides
				: {}),
			...(eosTokenId !== null ? { eos_token_id: eosTokenId } : {}),
			return_full_text: false,
			streamer,
			stopping_criteria: stoppingCriteria,
		});

		const endTime = performance.now();
		const referenceStart =
			tokenCount > 1 && firstTokenTime !== null
				? firstTokenTime
				: startTime;
		const elapsedSec = Math.max((endTime - referenceStart) / 1000, 0.001);
		const measuredTokens =
			tokenCount > 1 && firstTokenTime !== null
				? tokenCount - 1
				: tokenCount;
		const tokensPerSec =
			tokenCount > 0
				? Number((measuredTokens / elapsedSec).toFixed(2))
				: 0;

		const finalText =
			stripChatTemplateTokens(streamedText) || extractGeneratedText(output);

		if (activeRequestId === requestId) {
			self.postMessage({
				type: "complete",
				requestId,
				text: finalText,
				tokensPerSec,
				backend,
				fallback,
			});
		}
	} finally {
		if (activeStoppingCriteria === stoppingCriteria) {
			activeStoppingCriteria = null;
		}
		if (activeRequestId === requestId) {
			activeRequestId = null;
		}
	}
}

function handleAbort(requestId) {
	if (!activeStoppingCriteria) {
		return;
	}
	if (!requestId || requestId === activeRequestId) {
		const stoppingCriteria = activeStoppingCriteria;
		activeStoppingCriteria = null;
		activeRequestId = null;
		stoppingCriteria.interrupt();
	}
}

self.onmessage = async (event) => {
	const data = event?.data;
	if (!data || typeof data !== "object") {
		return;
	}

	const { type, requestId } = data;

	try {
		switch (type) {
			case "load": {
				const loaded = await loadPipeline();
				if (loaded) {
					self.postMessage({
						type: "ready",
						backend: loaded.backend,
						fallback: loaded.fallback,
					});
				}
				break;
			}
			case "generate": {
				await handleGenerate(data);
				break;
			}
			case "abort":
			case "cancel":
			case "stop": {
				handleAbort(requestId);
				break;
			}
			case "dispose": {
				await disposePipeline();
				break;
			}
			default:
				break;
		}
	} catch (err) {
		self.postMessage({
			type: "error",
			requestId: requestId ?? null,
			error: err?.message || "Inference failed.",
		});
	}
};
