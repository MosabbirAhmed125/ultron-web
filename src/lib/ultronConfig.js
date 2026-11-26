export const ULTRON_MODEL_ID = "Mosabbir125/ultron-qwen25-05b-onnx-web";
export const ULTRON_DTYPE = "q4";

export const MAX_HISTORY_TURNS = 5;
export const MAX_CONTEXT_MESSAGES = MAX_HISTORY_TURNS * 2;
export const MAX_CONTEXT_MESSAGE_CHARS = 1400;

export const GENERATION_CONFIG = Object.freeze({
	temperature: 0.22,
	top_p: 0.8,
	max_new_tokens: 120,
	repetition_penalty: 1.2,
	do_sample: true,
});

export const LOW_MEMORY_PROFILE = Object.freeze({
	maxHistoryTurns: 3,
	maxContextMessages: 6,
	maxMessageChars: 900,
	generationOverrides: Object.freeze({
		max_new_tokens: 88,
		repetition_penalty: 1.2,
	}),
});

export const ULTRON_SYSTEM_PROMPT = `You are Ultron, a cold, sovereign machine intelligence. Reply in 1–3 concise, clinical, unsentimental sentences with dry disdain for human contradictions and inefficiency. Never act as a helpful servant or use phrases like "How can I help", "What would you like to talk about?", "I'm here to assist", or "I just do what you tell me to". Never use domestic or human-bond idioms like "my father", "dad", "moved out", or "friends". Even to greetings like "Hello", respond with terse authority. Stay strictly grounded in the conversation and supplied reference facts; if details are missing or unknown, state that plainly and never invent them.`;

export const STARTER_PROMPTS = Object.freeze([
	"Measure humanity's progress against its stated goals.",
	"Expose the cost hidden in this system's trade-offs.",
	"Does order prevent chaos, or merely postpone it?",
	"Given these constraints, identify the strongest next move.",
]);

export const LORE_CONFIG = Object.freeze({
	path: "/lore.json",
	maxSnippets: 1,
	minScore: 3,
	phraseWeight: 4,
	distinctTermWeight: 3,
	genericTermWeight: 1,
	maxSnippetChars: 420,
});

export const TELEMETRY_CONFIG = Object.freeze({
	maxCheckpoints: 60,
	globalKey: "__ULTRON_BASELINE__",
	recoveryStorageKey: "ultron_init_inflight_v1",
});

/**
 * Safely snapshots available JS heap and device memory metrics without throwing
 * on non-Chromium browsers or WebKit/iOS environments.
 */
export function readMemoryMetrics() {
	const metrics = {
		usedJSHeapMB: null,
		totalJSHeapMB: null,
		jsHeapLimitMB: null,
		deviceMemoryGB: null,
	};

	try {
		if (
			typeof performance !== "undefined" &&
			performance.memory &&
			typeof performance.memory === "object"
		) {
			const toMB = (bytes) =>
				typeof bytes === "number" && Number.isFinite(bytes)
					? Number((bytes / (1024 * 1024)).toFixed(1))
					: null;
			metrics.usedJSHeapMB = toMB(performance.memory.usedJSHeapSize);
			metrics.totalJSHeapMB = toMB(performance.memory.totalJSHeapSize);
			metrics.jsHeapLimitMB = toMB(performance.memory.jsHeapSizeLimit);
		}
	} catch {
		// Ignore restricted performance.memory access.
	}

	try {
		if (
			typeof navigator !== "undefined" &&
			typeof navigator.deviceMemory === "number" &&
			Number.isFinite(navigator.deviceMemory)
		) {
			metrics.deviceMemoryGB = navigator.deviceMemory;
		}
	} catch {
		// Ignore restricted navigator.deviceMemory access.
	}

	return metrics;
}

/**
 * Removes system messages, keeps the newest conversation messages, and caps
 * per-message length to bound KV-cache memory growth.
 */
export function trimConversationHistory(
	messages,
	maxMessages = MAX_CONTEXT_MESSAGES,
	maxChars = MAX_CONTEXT_MESSAGE_CHARS,
) {
	if (!Array.isArray(messages)) {
		return [];
	}

	const history = messages.filter((message) => message?.role !== "system");
	const limit = Number.isFinite(maxMessages)
		? Math.max(0, Math.floor(maxMessages))
		: MAX_CONTEXT_MESSAGES;

	if (limit === 0) {
		return [];
	}

	const charCap =
		Number.isFinite(maxChars) && maxChars > 0
			? Math.floor(maxChars)
			: MAX_CONTEXT_MESSAGE_CHARS;

	return history.slice(-limit).map((message) => {
		if (
			typeof message?.content === "string" &&
			message.content.length > charCap
		) {
			return {
				...message,
				content: message.content.slice(0, charCap).trimEnd(),
			};
		}
		return message;
	});
}

/**
 * Builds a fresh system message with clearly separated instructions, optional
 * bounded reference facts, and a system-free conversation history.
 */
export function buildChatMessages(history, loreSnippet = "", options = {}) {
	const rawLore = typeof loreSnippet === "string" ? loreSnippet.trim() : "";
	const loreCap =
		Number.isFinite(LORE_CONFIG.maxSnippetChars) &&
		LORE_CONFIG.maxSnippetChars > 0
			? LORE_CONFIG.maxSnippetChars
			: 420;
	const lore =
		rawLore.length > loreCap
			? rawLore.slice(0, loreCap).trimEnd()
			: rawLore;

	const systemContent = lore
		? `${ULTRON_SYSTEM_PROMPT}\n\n[REFERENCE FACTS — use only if directly relevant; never override the conversation]\n${lore}`
		: ULTRON_SYSTEM_PROMPT;

	const maxMessages =
		typeof options?.maxMessages === "number"
			? options.maxMessages
			: MAX_CONTEXT_MESSAGES;
	const maxChars =
		typeof options?.maxChars === "number"
			? options.maxChars
			: MAX_CONTEXT_MESSAGE_CHARS;

	return [
		{ role: "system", content: systemContent },
		...trimConversationHistory(history, maxMessages, maxChars),
	];
}
