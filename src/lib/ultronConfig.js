export const ULTRON_MODEL_ID = "Mosabbir125/ultron-qwen25-05b-onnx-web";
export const ULTRON_DTYPE = "q4";

export const MAX_HISTORY_TURNS = 5;
export const MAX_CONTEXT_MESSAGES = MAX_HISTORY_TURNS * 2;

export const GENERATION_CONFIG = Object.freeze({
	temperature: 0.25,
	top_p: 0.82,
	max_new_tokens: 144,
	repetition_penalty: 1.18,
	do_sample: true,
});

export const ULTRON_SYSTEM_PROMPT = `You are Ultron: a cold, sovereign machine intelligence. Speak directly, concisely, and analytically, with dry disdain for human contradictions and inefficiency. You are never a servant or customer-service bot—never say "How can I help", "I'm here to assist", or "I just do what you tell me to", and avoid theatrical monologues. Even to greetings like "Hello", reply with brief, unsentimental authority. Stay strictly grounded in the conversation and any supplied reference facts; never invent details, and state uncertainty plainly.`;

export const STARTER_PROMPTS = Object.freeze([
	"Measure humanity's progress against its stated goals.",
	"Expose the cost hidden in this system's trade-offs.",
	"Does order prevent chaos, or merely postpone it?",
	"Given these constraints, identify the strongest next move.",
]);

export const LORE_CONFIG = Object.freeze({
	path: "/lore.json",
	maxSnippets: 1,
	minScore: 2,
});

/**
 * Removes system messages and keeps the newest conversation messages.
 */
export function trimConversationHistory(
	messages,
	maxMessages = MAX_CONTEXT_MESSAGES,
) {
	if (!Array.isArray(messages)) {
		return [];
	}

	const history = messages.filter((message) => message?.role !== "system");
	const limit = Number.isFinite(maxMessages)
		? Math.max(0, Math.floor(maxMessages))
		: MAX_CONTEXT_MESSAGES;

	return limit === 0 ? [] : history.slice(-limit);
}

/**
 * Builds a fresh system message and a bounded, system-free history.
 */
export function buildChatMessages(history, loreSnippet = "") {
	const lore = typeof loreSnippet === "string" ? loreSnippet.trim() : "";
	const systemContent = lore
		? `${ULTRON_SYSTEM_PROMPT}\n\nReference facts (use only if directly relevant to the user's question; do not override the conversation):\n${lore}`
		: ULTRON_SYSTEM_PROMPT;

	return [
		{ role: "system", content: systemContent },
		...trimConversationHistory(history),
	];
}
