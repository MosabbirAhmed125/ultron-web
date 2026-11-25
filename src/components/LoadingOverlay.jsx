import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Cpu, RotateCcw } from "lucide-react";
import { cn } from "../lib/cn.js";
import ultronSvg from "../assets/ultron.svg";

const BRACKETS = [
	"top-2.5 left-2.5 rounded-tl-sm border-t-2 border-l-2",
	"top-2.5 right-2.5 rounded-tr-sm border-t-2 border-r-2",
	"bottom-2.5 left-2.5 rounded-bl-sm border-b-2 border-l-2",
	"bottom-2.5 right-2.5 rounded-br-sm border-b-2 border-r-2",
];

function getStatus(progress) {
	if (progress <= 0) return "INITIALIZING NEURAL CORE";
	if (progress < 100) return "DOWNLOADING QUANTIZED WEIGHTS";
	return "COMPILING RUNTIME";
}

export default function LoadingOverlay({
	isOpen = true,
	progress = 0,
	backend = null,
	error = null,
	onRetry,
}) {
	const value = Number.isFinite(progress)
		? Math.min(100, Math.max(0, Math.round(progress)))
		: 0;
	const visible = isOpen || Boolean(error);
	const label = backend ? backend.toUpperCase() : null;

	return (
		<AnimatePresence>
			{visible && (
				<motion.div
					key="ultron-loading"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.4, ease: "easeOut" }}
					className="fixed inset-0 z-50 flex items-center justify-center bg-cod-gray-950/96 p-6 backdrop-blur-sm"
					role="status"
					aria-live="polite"
				>
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0"
						style={{
							background:
								"radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--color-red-ribbon-600) 26%, transparent) 0%, color-mix(in srgb, var(--color-alizarin-crimson-900) 24%, transparent) 34%, transparent 66%)",
						}}
					/>

					<motion.div
						initial={{ opacity: 0, y: 16, scale: 0.97 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -10, scale: 0.98 }}
						transition={{ duration: 0.35, ease: "easeOut" }}
						className="relative z-10 flex w-full max-w-md flex-col items-center gap-4"
					>
						{/* Taller top artwork plate matching bottom container width */}
						<div
							className={cn(
								"relative h-72 w-full overflow-hidden rounded-xl border-2 bg-shark-950 sm:h-80",
								error
									? "border-red-ribbon-500"
									: "border-red-ribbon-600/80",
							)}
							style={{
								boxShadow:
									"0 30px 75px -24px var(--color-shark-950), 0 0 36px -12px color-mix(in srgb, var(--color-red-ribbon-600) 35%, transparent), inset 0 1px 0 0 color-mix(in srgb, var(--color-cod-gray-200) 18%, transparent)",
							}}
						>
							<motion.div
								aria-hidden="true"
								className="pointer-events-none absolute inset-0"
								style={{
									background:
										"radial-gradient(circle at 50% 48%, color-mix(in srgb, var(--color-red-ribbon-500) 44%, transparent) 0%, color-mix(in srgb, var(--color-alizarin-crimson-800) 42%, transparent) 48%, transparent 78%)",
								}}
								animate={
									error
										? { opacity: 0.2 }
										: { opacity: [0.42, 0.9, 0.42] }
								}
								transition={
									error
										? { duration: 0.3 }
										: {
												duration: 2.6,
												repeat: Infinity,
												ease: "easeInOut",
											}
								}
							/>

							<motion.img
								src={ultronSvg}
								alt="Ultron sovereign core emblem"
								draggable={false}
								className="relative z-1 size-full select-none object-cover"
								animate={
									error
										? { opacity: 0.4, scale: 0.97 }
										: {
												opacity: [0.9, 1, 0.9],
												scale: [1, 1.022, 1],
											}
								}
								transition={
									error
										? { duration: 0.35, ease: "easeOut" }
										: {
												duration: 2.6,
												repeat: Infinity,
												ease: "easeInOut",
											}
								}
							/>

							<div
								aria-hidden="true"
								className="pointer-events-none absolute inset-0 z-2"
								style={{
									background:
										"radial-gradient(circle at 50% 50%, transparent 52%, color-mix(in srgb, var(--color-cod-gray-950) 72%, transparent) 100%)",
								}}
							/>

							{BRACKETS.map((pos) => (
								<span
									key={pos}
									aria-hidden="true"
									className={cn(
										"pointer-events-none absolute z-3 size-3.5 border-red-ribbon-500",
										pos,
									)}
								/>
							))}
						</div>

						{/* Shorter matched-width telemetry container */}
						<div
							className={cn(
								"w-full rounded-xl border-2 bg-shark-950/95 p-4 sm:p-5",
								error
									? "border-red-ribbon-600"
									: "border-cod-gray-700/90",
							)}
							style={{
								boxShadow:
									"0 24px 60px -24px var(--color-shark-950), inset 0 1px 0 0 color-mix(in srgb, var(--color-cod-gray-200) 14%, transparent)",
							}}
						>
							<div className="flex items-center justify-between gap-3">
								<div className="flex items-center gap-3">
									<span
										aria-hidden="true"
										className="h-5 w-1 rounded-sm bg-red-ribbon-500"
									/>
									<span className="font-boldonse text-lg leading-none tracking-[0.14em] text-cod-gray-50">
										ULTRON
									</span>
								</div>

								<AnimatePresence>
									{label && (
										<motion.span
											key={label}
											initial={{
												opacity: 0,
												scale: 0.92,
											}}
											animate={{ opacity: 1, scale: 1 }}
											exit={{ opacity: 0, scale: 0.92 }}
											transition={{ duration: 0.2 }}
											className="inline-flex items-center gap-1.5 rounded-lg border-2 border-red-ribbon-600/80 bg-red-ribbon-950 px-2.5 py-0.5 font-aquatico text-[10px] tracking-[0.16em] text-red-ribbon-200"
										>
											<Cpu
												className="size-3 text-red-ribbon-400"
												aria-hidden="true"
											/>
											{label}
										</motion.span>
									)}
								</AnimatePresence>
							</div>

							<AnimatePresence mode="wait">
								{error ? (
									<motion.div
										key="error"
										initial={{ opacity: 0, y: 6 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -4 }}
										transition={{ duration: 0.22 }}
										className="mt-5 flex flex-col gap-4"
										role="alert"
									>
										<div className="flex items-start gap-3">
											<AlertTriangle
												className="mt-0.5 size-4 shrink-0 text-red-ribbon-400"
												aria-hidden="true"
											/>
											<div className="min-w-0 flex-1">
												<p className="font-aquatico text-xs tracking-[0.14em] text-red-ribbon-300">
													CORE INITIALIZATION FAILED
												</p>
												<p className="mt-1.5 wrap-break-word font-ubuntu text-xs font-medium leading-relaxed text-cod-gray-300">
													{error}
												</p>
											</div>
										</div>
										{onRetry && (
											<motion.button
												type="button"
												onClick={onRetry}
												whileHover={{
													y: -1,
													backgroundColor:
														"var(--color-red-ribbon-600)",
													borderColor:
														"var(--color-red-ribbon-400)",
												}}
												whileTap={{ scale: 0.96 }}
												transition={{ duration: 0.15 }}
												className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border-2 border-red-ribbon-500 bg-red-ribbon-700 px-4 py-2 font-phenomena text-sm font-bold tracking-[0.2em] text-cod-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-ribbon-400"
											>
												<RotateCcw
													className="size-3.5"
													aria-hidden="true"
												/>
												RETRY
											</motion.button>
										)}
									</motion.div>
								) : (
									<motion.div
										key="progress"
										initial={{ opacity: 0, y: 6 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -4 }}
										transition={{ duration: 0.22 }}
										className="mt-5"
									>
										<div className="flex items-baseline justify-between gap-3">
											<p className="font-moon text-xs tracking-[0.16em] text-cod-gray-200">
												{getStatus(value)}
											</p>
											<span className="font-staatliches text-2xl leading-none font-bold tracking-[0.08em] text-red-ribbon-400 tabular-nums">
												{value}%
											</span>
										</div>

										<div
											role="progressbar"
											aria-label="Model download progress"
											aria-valuemin={0}
											aria-valuemax={100}
											aria-valuenow={value}
											className="relative mt-3 h-4 w-full overflow-hidden rounded-sm border-2 border-cod-gray-700/80 bg-cod-gray-900"
										>
											<motion.div
												className="h-full w-full origin-left rounded-xs"
												style={{
													background:
														"linear-gradient(90deg, var(--color-red-ribbon-900) 0%, var(--color-red-ribbon-600) 45%, var(--color-alizarin-crimson-500) 80%, var(--color-red-ribbon-400) 100%)",
												}}
												initial={{ scaleX: 0 }}
												animate={{
													scaleX: value / 100,
												}}
												transition={{
													duration: 0.3,
													ease: "easeOut",
												}}
											/>
										</div>

										<div className="mt-3.5 flex items-center justify-between font-moon text-[10px] tracking-[0.18em] text-cod-gray-400">
											<span className="inline-flex items-center gap-1.5">
												<Cpu
													className="size-3 text-red-ribbon-400"
													aria-hidden="true"
												/>
												{label
													? `RUNTIME // ${label}`
													: "RUNTIME // DETECTING"}
											</span>
											<span className="font-phenomena text-xs font-bold tracking-[0.14em] text-cod-gray-300 tabular-nums">
												QWEN2.5-0.5B Q4
											</span>
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
