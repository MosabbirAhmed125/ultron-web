import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
	AlertTriangle,
	ArrowDown,
	Check,
	Copy,
	CornerDownRight,
	Cpu,
	RotateCw,
	User,
} from "lucide-react";
import { cn } from "../lib/cn.js";

const STICK_THRESHOLD = 80;

function formatTime(timestamp) {
	if (!timestamp) return "";
	const date = new Date(timestamp);
	return Number.isNaN(date.getTime())
		? ""
		: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Message({
	message,
	isStreaming,
	isLatestAssistant,
	isGenerating,
	onRegenerate,
}) {
	const [copied, setCopied] = useState(false);
	const copyTimerRef = useRef(null);

	useEffect(() => {
		return () => {
			if (copyTimerRef.current) {
				clearTimeout(copyTimerRef.current);
			}
		};
	}, []);

	const isUser = message.role === "user";
	const isEmpty = !message.content;
	const time = formatTime(message.timestamp);
	const showActions = !isUser && !isStreaming && !isEmpty;
	const showRegenerate =
		showActions &&
		isLatestAssistant &&
		!isGenerating &&
		typeof onRegenerate === "function";

	const handleCopy = async () => {
		if (!message.content) return;
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(message.content);
			} else {
				const fallback = document.createElement("textarea");
				fallback.value = message.content;
				fallback.setAttribute("readonly", "");
				fallback.style.position = "fixed";
				fallback.style.opacity = "0";
				document.body.appendChild(fallback);
				fallback.select();
				document.execCommand("copy");
				document.body.removeChild(fallback);
			}
			setCopied(true);
			if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
			copyTimerRef.current = setTimeout(() => setCopied(false), 1600);
		} catch {
			// Ignore clipboard failures in restricted contexts.
		}
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.24, ease: "easeOut" }}
			className={cn(
				"flex w-full",
				isUser ? "justify-end" : "justify-start",
			)}
		>
			<div
				className={cn(
					"relative max-w-[88%] rounded-xl border-2 px-4 py-3.5 sm:max-w-[78%]",
					isUser
						? "border-cod-gray-700/90 bg-shark-900/95"
						: "border-red-ribbon-700/70 border-l-4 border-l-red-ribbon-500 bg-shark-950/95",
				)}
				style={
					isUser
						? {
								boxShadow:
									"0 14px 32px -22px var(--color-shark-950), inset 0 1px 0 0 color-mix(in srgb, var(--color-cod-gray-300) 18%, transparent)",
							}
						: {
								backgroundImage:
									"linear-gradient(135deg, color-mix(in srgb, var(--color-red-ribbon-900) 34%, transparent) 0%, transparent 50%)",
								boxShadow:
									"0 16px 36px -22px var(--color-shark-950), inset 0 1px 0 0 color-mix(in srgb, var(--color-red-ribbon-400) 18%, transparent)",
							}
				}
			>
				<div
					className={cn(
						"mb-2 flex items-center gap-2 text-[10px] tracking-[0.18em]",
						isUser ? "text-cod-gray-300" : "text-red-ribbon-400",
					)}
				>
					{isUser ? (
						<User
							className="size-3.5 shrink-0 text-cod-gray-400"
							aria-hidden="true"
						/>
					) : (
						<span className="inline-flex items-center gap-1.5">
							<motion.span
								aria-hidden="true"
								className="size-1.5 rounded-xs bg-red-ribbon-500"
								animate={
									isStreaming
										? { opacity: [0.35, 1, 0.35] }
										: { opacity: 1 }
								}
								transition={
									isStreaming
										? {
												duration: 1.1,
												repeat: Infinity,
												ease: "easeInOut",
											}
										: { duration: 0.2 }
								}
							/>
							<Cpu
								className="size-3.5 shrink-0 text-red-ribbon-400"
								aria-hidden="true"
							/>
						</span>
					)}
					<span className="font-bungee">
						{isUser ? "OPERATOR" : "ULTRON"}
					</span>
					{time && (
						<span className="font-phenomena text-xs font-bold tracking-[0.12em] text-cod-gray-400 tabular-nums">
							{time}
						</span>
					)}
				</div>

				{isEmpty && isStreaming ? (
					<div className="flex items-center gap-2.5 py-0.5 font-moon text-xs tracking-[0.22em] text-red-ribbon-400">
						<span>CALCULATING</span>
						<span
							className="flex items-center gap-1"
							aria-hidden="true"
						>
							{[0, 1, 2].map((i) => (
								<motion.span
									key={i}
									className="size-1.5 rounded-full bg-red-ribbon-500"
									animate={{ opacity: [0.25, 1, 0.25] }}
									transition={{
										duration: 1.05,
										repeat: Infinity,
										delay: i * 0.18,
										ease: "easeInOut",
									}}
								/>
							))}
						</span>
					</div>
				) : (
					<p className="font-ubuntu text-sm font-medium leading-relaxed wrap-break-word whitespace-pre-wrap text-cod-gray-50 sm:text-[15px]">
						{message.content}
						{isStreaming && (
							<motion.span
								aria-hidden="true"
								className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 rounded-xs bg-red-ribbon-500"
								animate={{ opacity: [1, 0.15, 1] }}
								transition={{
									duration: 0.75,
									repeat: Infinity,
									ease: "easeInOut",
								}}
							/>
						)}
					</p>
				)}

				{showActions && (
					<div className="mt-3 flex items-center justify-end gap-1.5 border-t border-cod-gray-800/80 pt-2.5">
						<motion.button
							type="button"
							onClick={handleCopy}
							title={copied ? "Copied" : "Copy response"}
							aria-label={
								copied ? "Response copied" : "Copy response"
							}
							whileHover={{
								borderColor: "var(--color-red-ribbon-500)",
								backgroundColor: "var(--color-red-ribbon-950)",
								color: "var(--color-cod-gray-50)",
							}}
							whileTap={{ scale: 0.94 }}
							transition={{ duration: 0.14 }}
							className={cn(
								"inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-2 px-2.5 py-1 font-phenomena text-xs font-bold tracking-[0.16em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-ribbon-400",
								copied
									? "border-red-ribbon-500 bg-red-ribbon-950 text-red-ribbon-200"
									: "border-cod-gray-700/90 bg-cod-gray-950/90 text-cod-gray-300",
							)}
						>
							{copied ? (
								<Check
									className="size-3.5 text-red-ribbon-400"
									aria-hidden="true"
								/>
							) : (
								<Copy className="size-3.5" aria-hidden="true" />
							)}
							<span>{copied ? "COPIED" : "COPY"}</span>
						</motion.button>

						{showRegenerate && (
							<motion.button
								type="button"
								onClick={() => onRegenerate()}
								title="Regenerate response"
								aria-label="Regenerate response"
								whileHover={{
									borderColor: "var(--color-red-ribbon-500)",
									backgroundColor:
										"var(--color-red-ribbon-950)",
									color: "var(--color-cod-gray-50)",
								}}
								whileTap={{ scale: 0.94 }}
								transition={{ duration: 0.14 }}
								className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-2 border-cod-gray-700/90 bg-cod-gray-950/90 px-2.5 py-1 font-phenomena text-xs font-bold tracking-[0.16em] text-cod-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-ribbon-400"
							>
								<RotateCw
									className="size-3.5"
									aria-hidden="true"
								/>
								<span>REGENERATE</span>
							</motion.button>
						)}
					</div>
				)}
			</div>
		</motion.div>
	);
}

export default function ChatBox({
	messages = [],
	isGenerating = false,
	error = null,
	starterPrompts = [],
	onSelectStarter,
	onRegenerate,
	className,
}) {
	const scrollRef = useRef(null);
	const stickRef = useRef(true);
	const countRef = useRef(0);
	const [showScrollButton, setShowScrollButton] = useState(false);

	const handleScroll = () => {
		const el = scrollRef.current;
		if (!el) return;
		const atBottom =
			el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD;
		stickRef.current = atBottom;
		setShowScrollButton((prev) => (prev === !atBottom ? prev : !atBottom));
	};

	const scrollToLatest = () => {
		const el = scrollRef.current;
		if (!el) return;
		stickRef.current = true;
		setShowScrollButton(false);
		el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
	};

	const last = messages[messages.length - 1];
	const lastContent = last?.content;

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;

		// A new message starting at the bottom always re-engages follow mode.
		if (messages.length > countRef.current) {
			stickRef.current = true;
			setShowScrollButton(false);
		}
		countRef.current = messages.length;

		if (stickRef.current) {
			el.scrollTop = el.scrollHeight;
		}
	}, [messages.length, lastContent, error]);

	const isEmpty = messages.length === 0;
	const streamingId =
		isGenerating && last?.role === "assistant" ? last.id : null;
	let latestAssistantId = null;
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		if (messages[i]?.role === "assistant") {
			latestAssistantId = messages[i].id;
			break;
		}
	}

	return (
		<div className={cn("relative min-h-0 w-full", className)}>
			<div
				ref={scrollRef}
				onScroll={handleScroll}
				role="log"
				aria-live="polite"
				aria-relevant="additions text"
				aria-busy={isGenerating}
				className="scrollbar-hide h-full w-full overflow-y-auto overscroll-contain bg-transparent px-4 py-6 sm:px-6 lg:py-8"
			>
				{isEmpty ? (
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.35, ease: "easeOut" }}
						className="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-8 py-6"
					>
						<div className="max-w-2xl">
							<div className="inline-flex items-center gap-2 rounded-lg border-2 border-red-ribbon-700/70 bg-red-ribbon-950/75 px-3 py-1">
								<Cpu
									className="size-3.5 shrink-0 text-red-ribbon-400"
									aria-hidden="true"
								/>
								<p className="font-sequel text-[11px] font-bold tracking-[0.22em] text-red-ribbon-300">
									ULTRON // SOVEREIGN CORE
								</p>
							</div>
							<h2 className="mt-4 font-gurvaco text-3xl leading-tight tracking-[0.12em] text-cod-gray-50 sm:text-4xl">
								AWAITING DIRECTIVE
							</h2>
							<p className="mt-2.5 font-ubuntu text-sm font-medium leading-relaxed text-cod-gray-300 sm:text-base">
								State your query. Inefficiency will be noted.
							</p>
						</div>

						{starterPrompts.length > 0 && (
							<ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
								{starterPrompts.map((prompt, index) => (
									<motion.li
										key={prompt}
										initial={{ opacity: 0, y: 8 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{
											duration: 0.28,
											delay: 0.06 + index * 0.045,
											ease: "easeOut",
										}}
									>
										<motion.button
											type="button"
											onClick={() =>
												onSelectStarter?.(prompt)
											}
											whileHover={{
												y: -2,
												borderColor:
													"var(--color-red-ribbon-500)",
												backgroundColor:
													"color-mix(in srgb, var(--color-red-ribbon-950) 65%, var(--color-shark-950))",
												boxShadow:
													"0 14px 32px -18px color-mix(in srgb, var(--color-red-ribbon-600) 45%, transparent)",
											}}
											whileTap={{ scale: 0.98 }}
											transition={{
												duration: 0.16,
												ease: "easeOut",
											}}
											className="flex h-full w-full cursor-pointer items-start gap-3 rounded-xl border-2 border-cod-gray-700/90 bg-shark-950/90 px-4 py-3.5 text-left font-ubuntu text-sm font-medium text-cod-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-ribbon-400"
											style={{
												boxShadow:
													"inset 0 1px 0 0 color-mix(in srgb, var(--color-cod-gray-300) 12%, transparent)",
											}}
										>
											<span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-sm border border-red-ribbon-700/70 bg-red-ribbon-950/80 pt-0.5 pl-[0.1em] font-staatliches text-xs leading-none font-bold tracking-widest text-red-ribbon-300 tabular-nums">
												{String(index + 1).padStart(
													2,
													"0",
												)}
											</span>
											<span className="min-w-0 flex-1 leading-snug text-shark-100">
												{prompt}
											</span>
											<CornerDownRight
												className="mt-0.5 size-4 shrink-0 text-red-ribbon-400"
												aria-hidden="true"
											/>
										</motion.button>
									</motion.li>
								))}
							</ul>
						)}
					</motion.div>
				) : (
					<div className="mx-auto flex max-w-3xl flex-col gap-4 pb-6">
						{messages.map((message) => (
							<Message
								key={message.id}
								message={message}
								isStreaming={message.id === streamingId}
								isLatestAssistant={
									message.id === latestAssistantId
								}
								isGenerating={isGenerating}
								onRegenerate={onRegenerate}
							/>
						))}
					</div>
				)}

				<AnimatePresence>
					{error && (
						<motion.div
							key="chat-error"
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -4 }}
							transition={{ duration: 0.2, ease: "easeOut" }}
							role="alert"
							className="mx-auto mt-4 flex max-w-3xl items-start gap-3 rounded-xl border-2 border-red-ribbon-600 border-l-4 border-l-red-ribbon-500 bg-red-ribbon-950/90 px-4 py-3.5 text-red-ribbon-100"
						>
							<AlertTriangle
								className="mt-0.5 size-4 shrink-0 text-red-ribbon-400"
								aria-hidden="true"
							/>
							<div className="min-w-0 flex-1">
								<p className="font-aquatico text-[10px] tracking-[0.2em] text-red-ribbon-300">
									RUNTIME FAULT
								</p>
								<p className="mt-1 wrap-break-word font-ubuntu text-xs font-medium leading-relaxed text-red-ribbon-100">
									{error}
								</p>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{/* Floating scroll-to-latest pill when scrolled up */}
			<AnimatePresence>
				{!isEmpty && showScrollButton && (
					<motion.button
						key="scroll-latest-btn"
						type="button"
						onClick={scrollToLatest}
						aria-label="Scroll to latest message"
						initial={{ opacity: 0, y: 10, scale: 0.92 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 8, scale: 0.92 }}
						whileHover={{
							y: -2,
							borderColor: "var(--color-red-ribbon-500)",
							backgroundColor: "var(--color-red-ribbon-950)",
						}}
						whileTap={{ scale: 0.95 }}
						transition={{ duration: 0.16, ease: "easeOut" }}
						className="absolute bottom-3 left-1/2 z-20 inline-flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-lg border-2 border-red-ribbon-700/80 bg-shark-950/95 px-3 py-1.5 font-phenomena text-xs font-bold tracking-[0.18em] text-cod-gray-100 backdrop-blur-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-ribbon-400"
						style={{
							boxShadow:
								"0 12px 28px -10px var(--color-shark-950)",
						}}
					>
						<ArrowDown
							className="size-3.5 text-red-ribbon-400"
							aria-hidden="true"
						/>
						<span>LATEST</span>
					</motion.button>
				)}
			</AnimatePresence>
		</div>
	);
}
