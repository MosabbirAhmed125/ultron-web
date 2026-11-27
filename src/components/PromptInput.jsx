import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { RotateCcw, Send, Square, Terminal } from "lucide-react";
import { cn } from "../lib/cn.js";

const MAX_HEIGHT = 160;
const ORBIT_DURATION = 4.2;
const PIPE_PADDING = 6; // thick translucent glass cooling-pipe channel
const OUTER_RADIUS = 20; // concentric with inner rounded-[14px] (20 - 6)

const actionBase =
	"inline-flex size-9 shrink-0 items-center justify-center rounded-lg border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-ribbon-400 disabled:cursor-not-allowed disabled:opacity-35";

const ORBIT_LAYERS = [
	{
		key: "tail-mist",
		stroke: "var(--color-alizarin-crimson-900)",
		strokeWidth: 7.5,
		dashArray: "40 60",
		offset: 8,
		opacity: 0.12,
	},
	{
		key: "tail-fade",
		stroke: "var(--color-alizarin-crimson-800)",
		strokeWidth: 7,
		dashArray: "34 66",
		offset: 3,
		opacity: 0.2,
	},
	{
		key: "tail-deep",
		stroke: "var(--color-alizarin-crimson-700)",
		strokeWidth: 6.5,
		dashArray: "28 72",
		offset: -2,
		opacity: 0.3,
	},
	{
		key: "tail-mid",
		stroke: "var(--color-alizarin-crimson-600)",
		strokeWidth: 6,
		dashArray: "22 78",
		offset: -6.5,
		opacity: 0.42,
	},
	{
		key: "body-crimson",
		stroke: "var(--color-red-ribbon-600)",
		strokeWidth: 5.5,
		dashArray: "16 84",
		offset: -11,
		opacity: 0.56,
	},
	{
		key: "body-bright",
		stroke: "var(--color-red-ribbon-500)",
		strokeWidth: 5,
		dashArray: "11 89",
		offset: -14.5,
		opacity: 0.7,
	},
	{
		key: "head-warm",
		stroke: "var(--color-outrageous-orange-400)",
		strokeWidth: 4.2,
		dashArray: "6.5 93.5",
		offset: -17.5,
		opacity: 0.74,
	},
	{
		key: "head-core",
		stroke: "var(--color-coral-red-300)",
		strokeWidth: 3.2,
		dashArray: "3 97",
		offset: -19.5,
		opacity: 0.86,
	},
];

const BLOOM_LAYERS = [
	{
		key: "bloom-feather",
		stroke: "var(--color-alizarin-crimson-800)",
		strokeWidth: 14,
		dashArray: "38 62",
		offset: 6,
		opacity: 0.2,
	},
	{
		key: "bloom-tail",
		stroke: "var(--color-alizarin-crimson-600)",
		strokeWidth: 11.5,
		dashArray: "26 74",
		offset: -2,
		opacity: 0.38,
	},
	{
		key: "bloom-mid",
		stroke: "var(--color-red-ribbon-500)",
		strokeWidth: 9,
		dashArray: "15 85",
		offset: -10.5,
		opacity: 0.6,
	},
	{
		key: "bloom-hot",
		stroke: "var(--color-outrageous-orange-400)",
		strokeWidth: 6.5,
		dashArray: "7 93",
		offset: -17,
		opacity: 0.74,
	},
];

/**
 * Exact rounded-rectangle SVG perimeter beam that orbits all four edges and
 * curved corners at constant speed without masking or edge-clipping artifacts.
 */
function PerimeterBeam({ width, height, layers, className, opacity = 1 }) {
	if (width <= PIPE_PADDING * 2 || height <= PIPE_PADDING * 2) {
		return null;
	}

	const inset = PIPE_PADDING / 2;
	const rectWidth = Math.max(0, width - PIPE_PADDING);
	const rectHeight = Math.max(0, height - PIPE_PADDING);
	const radius = Math.min(
		OUTER_RADIUS - inset,
		rectWidth / 2,
		rectHeight / 2,
	);

	return (
		<motion.svg
			aria-hidden="true"
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			fill="none"
			className={cn(
				"pointer-events-none absolute inset-0 overflow-visible",
				className,
			)}
			initial={{ opacity: 0 }}
			animate={{ opacity }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.28, ease: "easeOut" }}
		>
			{layers.map((layer) => (
				<motion.rect
					key={layer.key}
					x={inset}
					y={inset}
					width={rectWidth}
					height={rectHeight}
					rx={radius}
					ry={radius}
					pathLength={100}
					stroke={layer.stroke}
					strokeWidth={layer.strokeWidth}
					strokeLinecap="round"
					strokeDasharray={layer.dashArray}
					strokeOpacity={layer.opacity}
					initial={{ strokeDashoffset: layer.offset }}
					animate={{ strokeDashoffset: layer.offset - 100 }}
					transition={{
						duration: ORBIT_DURATION,
						repeat: Infinity,
						ease: "linear",
					}}
				/>
			))}
		</motion.svg>
	);
}

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
	const shellRef = useRef(null);
	const clearTimerRef = useRef(null);
	const [inner, setInner] = useState(value);
	const [isFocused, setIsFocused] = useState(false);
	const [justCleared, setJustCleared] = useState(false);
	const [shellSize, setShellSize] = useState({ width: 0, height: 0 });
	const reduceMotion = useReducedMotion();

	const controlled = typeof onChange === "function";
	const text = controlled ? value : inner;
	const trimmed = text.trim();
	const charCount = text.length;
	const canSend = !disabled && !isGenerating && trimmed.length > 0;
	const showReset =
		typeof onReset === "function" && hasMessages && !isGenerating;
	const isActive = (isFocused && !disabled) || isGenerating;
	const showOrbit = isActive && !reduceMotion;

	const showCleared = justCleared && !disabled && !isGenerating;
	const statusLabel = disabled
		? "LOCKED"
		: isGenerating
			? "PROCESSING"
			: showCleared
				? "CLEARED"
				: "READY";

	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;

		element.style.height = "auto";
		element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`;
	}, [text]);

	useEffect(() => {
		const element = shellRef.current;
		if (!element) return undefined;

		const updateSize = () => {
			const rect = element.getBoundingClientRect();
			const width = Math.round(rect.width);
			const height = Math.round(rect.height);
			setShellSize((prev) =>
				prev.width === width && prev.height === height
					? prev
					: { width, height },
			);
		};

		updateSize();

		if (typeof ResizeObserver === "undefined") {
			window.addEventListener("resize", updateSize);
			return () => window.removeEventListener("resize", updateSize);
		}

		const observer = new ResizeObserver(updateSize);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		return () => {
			if (clearTimerRef.current !== null) {
				clearTimeout(clearTimerRef.current);
			}
		};
	}, []);

	const handleReset = () => {
		onReset?.();
		setJustCleared(true);
		if (clearTimerRef.current !== null) {
			clearTimeout(clearTimerRef.current);
		}
		clearTimerRef.current = setTimeout(() => {
			setJustCleared(false);
			clearTimerRef.current = null;
		}, 1500);
	};

	const handleChange = (event) => {
		if (controlled) onChange(event.target.value);
		else setInner(event.target.value);
	};

	const submit = () => {
		if (!canSend) return;

		onSubmit?.(trimmed);
		if (!controlled) setInner("");
	};

	const handleKeyDown = (event) => {
		if (
			event.key !== "Enter" ||
			event.shiftKey ||
			event.nativeEvent.isComposing
		) {
			return;
		}

		event.preventDefault();
		submit();
	};

	// Clicking the padding / icon area should focus the textarea.
	const handleTextRowMouseDown = (event) => {
		if (disabled || event.target === ref.current) return;
		event.preventDefault();
		ref.current?.focus();
	};

	const activeOuterBorder = reduceMotion
		? "var(--color-red-ribbon-600)"
		: "color-mix(in srgb, var(--color-red-ribbon-500) 45%, var(--color-cod-gray-600))";

	const activeInnerBorder = reduceMotion
		? "var(--color-red-ribbon-600)"
		: "color-mix(in srgb, var(--color-red-ribbon-700) 65%, var(--color-cod-gray-700))";

	return (
		<div className={cn("relative w-full", className)}>
			{/* Subtle ambient outer bloom */}
			<motion.div
				aria-hidden="true"
				className="pointer-events-none absolute -inset-3 rounded-3xl blur-2xl"
				style={{
					background:
						"radial-gradient(ellipse at 14% 50%, color-mix(in srgb, var(--color-outrageous-orange-500) 36%, transparent) 0%, transparent 48%), radial-gradient(ellipse at 86% 50%, color-mix(in srgb, var(--color-red-ribbon-500) 40%, transparent) 0%, transparent 52%)",
				}}
				animate={{
					opacity: isActive ? 0.24 : 0.04,
					scale: isActive ? 1 : 0.97,
				}}
				transition={{ duration: 0.3, ease: "easeOut" }}
			/>

			{/* Outer travelling bloom synchronized with the cooling-pipe beam */}
			<AnimatePresence>
				{showOrbit && (
					<PerimeterBeam
						key="orbit-bloom"
						width={shellSize.width}
						height={shellSize.height}
						layers={BLOOM_LAYERS}
						opacity={0.78}
						className="z-0 blur-[10px]"
					/>
				)}
			</AnimatePresence>

			{/* Thick translucent glassmorphic cooling-pipe outer border channel */}
			<motion.div
				ref={shellRef}
				animate={{
					borderColor: isActive
						? activeOuterBorder
						: "color-mix(in srgb, var(--color-cod-gray-500) 32%, transparent)",
					boxShadow: isActive
						? "0 0 28px -12px color-mix(in srgb, var(--color-red-ribbon-500) 45%, transparent), 0 20px 44px -22px var(--color-shark-950), inset 0 1px 0 0 color-mix(in srgb, var(--color-cod-gray-100) 18%, transparent), inset 0 -1px 0 0 color-mix(in srgb, var(--color-shark-950) 70%, transparent)"
						: "0 16px 38px -22px var(--color-shark-950), inset 0 1px 0 0 color-mix(in srgb, var(--color-cod-gray-100) 12%, transparent), inset 0 -1px 0 0 color-mix(in srgb, var(--color-shark-950) 65%, transparent)",
				}}
				transition={{ duration: 0.24, ease: "easeOut" }}
				className="relative z-10 isolate rounded-[20px] border bg-shark-900/55 p-1.5 backdrop-blur-2xl"
			>
				{/* Subtle glass pipe rim reflection */}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 rounded-[20px]"
					style={{
						background:
							"linear-gradient(180deg, color-mix(in srgb, var(--color-cod-gray-200) 10%, transparent) 0%, transparent 45%, color-mix(in srgb, var(--color-red-ribbon-950) 20%, transparent) 100%)",
					}}
				/>

				{/* Full-perimeter red/crimson travelling pulse inside the glass pipe */}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[20px]"
				>
					<AnimatePresence>
						{showOrbit && (
							<PerimeterBeam
								key="orbit-pipe-beam"
								width={shellSize.width}
								height={shellSize.height}
								layers={ORBIT_LAYERS}
								opacity={1}
								className="blur-[3.5px]"
							/>
						)}
					</AnimatePresence>

					{/* Calm static crimson tint inside pipe when reduced-motion is active */}
					{isActive && reduceMotion && (
						<div
							className="absolute inset-0 rounded-[20px]"
							style={{
								background:
									"radial-gradient(ellipse at 50% 50%, color-mix(in srgb, var(--color-red-ribbon-600) 28%, transparent) 0%, color-mix(in srgb, var(--color-alizarin-crimson-800) 22%, transparent) 100%)",
							}}
						/>
					)}
				</div>

				{/* Solid dark inner command core — completely shields textarea/footer from beam bleed */}
				<motion.form
					onSubmit={(event) => {
						event.preventDefault();
						submit();
					}}
					onFocusCapture={() => setIsFocused(true)}
					onBlurCapture={(event) => {
						if (
							!event.currentTarget.contains(event.relatedTarget)
						) {
							setIsFocused(false);
						}
					}}
					animate={{
						borderColor: isActive
							? activeInnerBorder
							: "var(--color-cod-gray-800)",
					}}
					transition={{ duration: 0.22, ease: "easeOut" }}
					className="relative z-10 flex w-full flex-col overflow-hidden rounded-[14px] border bg-shark-950"
					style={{
						boxShadow:
							"inset 0 1px 0 0 color-mix(in srgb, var(--color-cod-gray-300) 8%, transparent)",
					}}
				>
					<div
						onMouseDown={handleTextRowMouseDown}
						className="relative flex w-full items-start gap-2.5 px-3 pt-2.5 pb-1.5"
					>
						<motion.div
							aria-hidden="true"
							animate={{
								borderColor: isActive
									? "var(--color-red-ribbon-800)"
									: "var(--color-cod-gray-700)",
								backgroundColor: isActive
									? "color-mix(in srgb, var(--color-red-ribbon-950) 85%, var(--color-shark-950))"
									: "var(--color-cod-gray-900)",
								color: isActive
									? "var(--color-red-ribbon-400)"
									: "var(--color-cod-gray-400)",
							}}
							transition={{ duration: 0.2 }}
							className="hidden size-9 shrink-0 items-center justify-center rounded-lg border sm:inline-flex"
						>
							<Terminal className="size-4" />
						</motion.div>

						<textarea
							ref={ref}
							value={text}
							onChange={handleChange}
							onKeyDown={handleKeyDown}
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
					</div>

					<div className="relative flex min-h-12 w-full items-center justify-between gap-3 border-t border-cod-gray-800 px-3 py-1.5">
						<div className="flex min-w-0 items-center gap-2">
							<motion.span
								aria-hidden="true"
								animate={{
									backgroundColor: isGenerating
										? "var(--color-outrageous-orange-500)"
										: disabled
											? "var(--color-cod-gray-600)"
											: showCleared
												? "var(--color-coral-red-400)"
												: "var(--color-red-ribbon-500)",
									scale:
										isGenerating && !reduceMotion
											? [1, 1.18, 1]
											: showCleared && !reduceMotion
												? [1, 1.35, 1]
												: 1,
								}}
								transition={
									isGenerating && !reduceMotion
										? {
												duration: 1.2,
												repeat: Infinity,
												ease: "easeInOut",
											}
										: { duration: 0.28, ease: "easeOut" }
								}
								className="size-2 shrink-0 rounded-full"
							/>

							<AnimatePresence mode="wait" initial={false}>
								<motion.span
									key={statusLabel}
									aria-live="polite"
									initial={{ opacity: 0, y: 2 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -2 }}
									transition={{ duration: 0.14 }}
									className={cn(
										"truncate font-sequel text-[11px] font-bold tracking-[0.12em]",
										showCleared
											? "text-red-ribbon-300"
											: "text-cod-gray-400",
									)}
								>
									{statusLabel}
								</motion.span>
							</AnimatePresence>
						</div>

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
										onClick={handleReset}
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

							<AnimatePresence mode="wait" initial={false}>
								{isGenerating ? (
									<motion.button
										key="stop-btn"
										type="button"
										onClick={onStop}
										title="Stop generation"
										aria-label="Stop generation"
										initial={{ opacity: 0, scale: 0.88 }}
										animate={{
											opacity: 1,
											scale: 1,
											boxShadow: reduceMotion
												? "0 0 12px -2px color-mix(in srgb, var(--color-red-ribbon-500) 45%, transparent)"
												: [
														"0 0 0 0 color-mix(in srgb, var(--color-red-ribbon-500) 32%, transparent), 0 0 0 0 color-mix(in srgb, var(--color-outrageous-orange-500) 18%, transparent)",
														"0 0 14px -2px color-mix(in srgb, var(--color-red-ribbon-500) 58%, transparent), 0 0 22px -4px color-mix(in srgb, var(--color-outrageous-orange-500) 34%, transparent)",
														"0 0 0 0 color-mix(in srgb, var(--color-red-ribbon-500) 32%, transparent), 0 0 0 0 color-mix(in srgb, var(--color-outrageous-orange-500) 18%, transparent)",
													],
										}}
										exit={{ opacity: 0, scale: 0.88 }}
										whileHover={{
											backgroundColor:
												"var(--color-red-ribbon-800)",
											borderColor:
												"var(--color-red-ribbon-400)",
										}}
										whileTap={{ scale: 0.92 }}
										transition={{
											boxShadow: reduceMotion
												? { duration: 0.2 }
												: {
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
										initial={{ opacity: 0, scale: 0.88 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0, scale: 0.88 }}
										whileHover={
											canSend
												? {
														scale: 1.04,
														backgroundColor:
															"var(--color-red-ribbon-500)",
														borderColor:
															"var(--color-outrageous-orange-400)",
														boxShadow:
															"0 0 14px -3px color-mix(in srgb, var(--color-outrageous-orange-500) 48%, transparent)",
													}
												: undefined
										}
										whileTap={
											canSend
												? { scale: 0.92 }
												: undefined
										}
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
							</AnimatePresence>
						</div>
					</div>
				</motion.form>
			</motion.div>
		</div>
	);
}
