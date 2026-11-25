import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
	RotateCcw,
	Send,
	Sparkles,
	Square,
	Terminal,
} from "lucide-react";
import { cn } from "../lib/cn.js";

const MAX_HEIGHT = 160;

const actionBase =
	"inline-flex size-9 shrink-0 items-center justify-center rounded-lg border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-ribbon-400 disabled:cursor-not-allowed disabled:opacity-35";

export default function PromptInput({
	value = "",
	onChange,
	onSubmit,
	onStop,
	onReset,
	disabled = false,
	isGenerating = false,
	hasMessages = false,
	placeholder = "Transmit command to Ultron...",
	className,
}) {
	const ref = useRef(null);
	const [inner, setInner] = useState(value);
	const [isFocused, setIsFocused] = useState(false);

	const controlled = typeof onChange === "function";
	const text = controlled ? value : inner;
	const trimmed = text.trim();
	const charCount = text.length;
	const canSend = !disabled && !isGenerating && trimmed.length > 0;
	const showReset =
		typeof onReset === "function" && hasMessages && !isGenerating;
	const isActive = isFocused || isGenerating;

	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
	}, [text]);

	const handleChange = (e) => {
		if (controlled) onChange(e.target.value);
		else setInner(e.target.value);
	};

	const submit = () => {
		if (!canSend) return;
		onSubmit?.(trimmed);
		if (!controlled) setInner("");
	};

	const handleKeyDown = (e) => {
		if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing)
			return;
		e.preventDefault();
		submit();
	};

	return (
		<div className={cn("relative w-full", className)}>
			{/* Dynamic ambient crimson glow halo behind the command bar */}
			<motion.div
				aria-hidden="true"
				className="pointer-events-none absolute -inset-1 rounded-2xl blur-md"
				style={{
					background:
						"linear-gradient(90deg, color-mix(in srgb, var(--color-red-ribbon-700) 55%, transparent) 0%, color-mix(in srgb, var(--color-alizarin-crimson-500) 65%, transparent) 50%, color-mix(in srgb, var(--color-red-ribbon-800) 55%, transparent) 100%)",
				}}
				animate={
					isGenerating
						? { opacity: [0.35, 0.72, 0.35], scale: [0.995, 1.01, 0.995] }
						: {
								opacity: isFocused ? 0.52 : 0.14,
								scale: isFocused ? 1.005 : 0.99,
							}
				}
				transition={
					isGenerating
						? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
						: { duration: 0.25, ease: "easeOut" }
				}
			/>

			<motion.form
				onSubmit={(e) => {
					e.preventDefault();
					submit();
				}}
				animate={{
					borderColor: isActive
						? "var(--color-red-ribbon-500)"
						: "var(--color-cod-gray-700)",
					boxShadow: isActive
						? "0 0 0 1px color-mix(in srgb, var(--color-red-ribbon-500) 35%, transparent), 0 20px 44px -20px var(--color-shark-950)"
						: "inset 0 1px 0 0 color-mix(in srgb, var(--color-cod-gray-300) 14%, transparent), 0 18px 40px -22px var(--color-shark-950)",
				}}
				transition={{ duration: 0.2, ease: "easeOut" }}
				className="relative z-1 flex w-full flex-col overflow-hidden rounded-xl border-2 bg-shark-950/95"
			>
				{/* Subtle top crimson light edge */}
				<motion.span
					aria-hidden="true"
					className="pointer-events-none h-0.5 w-full"
					style={{
						background:
							"linear-gradient(90deg, transparent 5%, var(--color-red-ribbon-500) 50%, transparent 95%)",
					}}
					animate={{ opacity: isActive ? 0.95 : 0.22 }}
					transition={{ duration: 0.22, ease: "easeOut" }}
				/>

				<div className="flex w-full items-end gap-2.5 p-2.5">
					{/* Reactive command indicator icon */}
					<motion.div
						aria-hidden="true"
						animate={{
							borderColor: isActive
								? "var(--color-red-ribbon-600)"
								: "var(--color-cod-gray-700)",
							backgroundColor: isActive
								? "color-mix(in srgb, var(--color-red-ribbon-950) 85%, var(--color-shark-950))"
								: "var(--color-cod-gray-900)",
							color: isActive
								? "var(--color-red-ribbon-400)"
								: "var(--color-cod-gray-400)",
						}}
						transition={{ duration: 0.2 }}
						className="hidden size-9 shrink-0 items-center justify-center rounded-lg border-2 sm:inline-flex"
					>
						{isActive ? (
							<Sparkles className="size-4" />
						) : (
							<Terminal className="size-4" />
						)}
					</motion.div>

					<textarea
						ref={ref}
						value={text}
						onChange={handleChange}
						onKeyDown={handleKeyDown}
						onFocus={() => setIsFocused(true)}
						onBlur={() => setIsFocused(false)}
						disabled={disabled}
						rows={1}
						placeholder={placeholder}
						aria-label="Command input"
						enterKeyHint="send"
						autoComplete="off"
						autoCorrect="off"
						spellCheck={false}
						data-lpignore="true"
						data-1p-ignore="true"
						data-form-type="other"
						data-gramm="false"
						data-gramm_editor="false"
						data-enable-grammarly="false"
						className="max-h-40 min-h-9 w-full resize-none bg-transparent px-1 py-2 font-ubuntu text-sm font-bold leading-5 text-cod-gray-50 outline-none placeholder:font-moon placeholder:text-xs placeholder:tracking-[0.14em] placeholder:text-cod-gray-400 disabled:cursor-not-allowed disabled:opacity-60"
					/>

					<div className="flex shrink-0 items-center gap-2">
						<AnimatePresence>
							{charCount > 0 && (
								<motion.span
									key="char-counter"
									initial={{ opacity: 0, x: 4 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0, x: 4 }}
									transition={{ duration: 0.16 }}
									aria-live="off"
									className="hidden pb-0.5 font-phenomena text-xs font-bold tracking-[0.12em] text-cod-gray-400 tabular-nums select-none sm:inline"
								>
									{charCount}
								</motion.span>
							)}
						</AnimatePresence>

						<AnimatePresence>
							{showReset && (
								<motion.button
									key="reset-btn"
									type="button"
									onClick={onReset}
									title="Clear conversation"
									aria-label="Clear conversation"
									initial={{ opacity: 0, scale: 0.88 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.88 }}
									whileHover={{
										borderColor:
											"var(--color-red-ribbon-500)",
										backgroundColor:
											"var(--color-red-ribbon-950)",
										color: "var(--color-red-ribbon-200)",
									}}
									whileTap={{ scale: 0.92 }}
									transition={{ duration: 0.15 }}
									className={cn(
										actionBase,
										"cursor-pointer border-cod-gray-700 bg-shark-900 text-cod-gray-300",
									)}
								>
									<RotateCcw
										className="size-4"
										aria-hidden="true"
									/>
								</motion.button>
							)}
						</AnimatePresence>

						{isGenerating ? (
							<motion.button
								key="stop-btn"
								type="button"
								onClick={onStop}
								title="Stop generation"
								aria-label="Stop generation"
								animate={{
									boxShadow: [
										"0 0 0 0 color-mix(in srgb, var(--color-red-ribbon-500) 40%, transparent)",
										"0 0 16px -2px color-mix(in srgb, var(--color-red-ribbon-500) 70%, transparent)",
										"0 0 0 0 color-mix(in srgb, var(--color-red-ribbon-500) 40%, transparent)",
									],
								}}
								whileHover={{
									backgroundColor:
										"var(--color-red-ribbon-800)",
									borderColor: "var(--color-red-ribbon-400)",
								}}
								whileTap={{ scale: 0.92 }}
								transition={{
									boxShadow: {
										duration: 1.8,
										repeat: Infinity,
										ease: "easeInOut",
									},
									duration: 0.15,
								}}
								className={cn(
									actionBase,
									"cursor-pointer border-red-ribbon-500 bg-red-ribbon-950 text-red-ribbon-200",
								)}
							>
								<Square
									className="size-3.5 fill-current"
									aria-hidden="true"
								/>
							</motion.button>
						) : (
							<motion.button
								key="send-btn"
								type="submit"
								disabled={!canSend}
								title="Send command"
								aria-label="Send command"
								whileHover={
									canSend
										? {
												scale: 1.04,
												backgroundColor:
													"var(--color-red-ribbon-500)",
												borderColor:
													"var(--color-red-ribbon-400)",
											}
										: undefined
								}
								whileTap={canSend ? { scale: 0.92 } : undefined}
								transition={{ duration: 0.15 }}
								className={cn(
									actionBase,
									canSend && "cursor-pointer",
									"border-red-ribbon-500 bg-red-ribbon-600 text-cod-gray-50",
								)}
							>
								<Send
									className="size-4"
									aria-hidden="true"
								/>
							</motion.button>
						)}
					</div>
				</div>
			</motion.form>
		</div>
	);
}
