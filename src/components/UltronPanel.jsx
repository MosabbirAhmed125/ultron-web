import { AnimatePresence, motion } from "motion/react";
import { Cpu } from "lucide-react";
import { cn } from "../lib/cn.js";
import ultronSvg from "../assets/ultron.svg";

function getStatusMeta(isModelReady, isGenerating) {
	if (!isModelReady) return { label: "STANDBY", dot: "bg-cod-gray-400" };
	if (isGenerating) return { label: "SYNTHESIZING", dot: "bg-red-ribbon-500" };
	return { label: "ONLINE", dot: "bg-red-ribbon-500" };
}

function CoreEmblem({ isGenerating, isModelReady, className }) {
	return (
		<motion.div
			whileHover={{
				scale: 1.05,
				borderColor: "var(--color-red-ribbon-500)",
			}}
			whileTap={{ scale: 0.96 }}
			transition={{ duration: 0.18, ease: "easeOut" }}
			className={cn(
				"relative aspect-square shrink-0 overflow-hidden rounded-lg border-2 bg-cod-gray-950",
				className,
			)}
			animate={{
				borderColor: isGenerating
					? "var(--color-red-ribbon-500)"
					: isModelReady
						? "var(--color-red-ribbon-700)"
						: "var(--color-cod-gray-700)",
				boxShadow: isGenerating
					? "0 0 20px -4px color-mix(in srgb, var(--color-red-ribbon-500) 60%, transparent)"
					: "0 0 14px -6px color-mix(in srgb, var(--color-red-ribbon-600) 35%, transparent)",
			}}
		>
			<motion.div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0"
				style={{
					background:
						"radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--color-red-ribbon-500) 48%, transparent) 0%, transparent 72%)",
				}}
				animate={
					isGenerating
						? { opacity: [0.42, 0.92, 0.42] }
						: { opacity: isModelReady ? 0.36 : 0.12 }
				}
				transition={
					isGenerating
						? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
						: { duration: 0.35 }
				}
			/>
			<motion.img
				src={ultronSvg}
				alt="Ultron emblem"
				draggable={false}
				className="relative z-1 size-full select-none object-cover"
				animate={
					isGenerating
						? { opacity: [0.88, 1, 0.88], scale: [1, 1.035, 1] }
						: { opacity: isModelReady ? 1 : 0.5, scale: 1 }
				}
				transition={
					isGenerating
						? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
						: { duration: 0.35, ease: "easeOut" }
				}
			/>
		</motion.div>
	);
}

function StatusReadout({ isModelReady, isGenerating }) {
	const status = getStatusMeta(isModelReady, isGenerating);

	return (
		<span
			role="status"
			aria-live="polite"
			className="inline-flex items-center gap-2 font-aquatico text-[9px] tracking-[0.18em] text-cod-gray-200"
		>
			<span className="relative flex size-2" aria-hidden="true">
				{isGenerating && (
					<motion.span
						className="absolute inline-flex size-full rounded-full bg-red-ribbon-500"
						initial={{ scale: 1, opacity: 0.85 }}
						animate={{ scale: 2.4, opacity: 0 }}
						transition={{
							duration: 1.35,
							repeat: Infinity,
							ease: "easeOut",
						}}
					/>
				)}
				<span
					className={cn(
						"relative inline-flex size-2 rounded-full",
						status.dot,
					)}
				/>
			</span>
			{status.label}
		</span>
	);
}

export default function UltronPanel({
	backend = "webgpu",
	isModelReady = true,
	isGenerating = false,
	variant = "compact",
	className,
}) {
	if (variant === "emblem") {
		return (
			<CoreEmblem
				isGenerating={isGenerating}
				isModelReady={isModelReady}
				className={cn("size-12 rounded-xl", className)}
			/>
		);
	}

	if (variant === "mobile") {
		return (
			<motion.header
				initial={{ opacity: 0, y: -6 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.28, ease: "easeOut" }}
				className={cn(
					"relative flex w-full items-center gap-3 border-b-2 border-cod-gray-800 bg-shark-950/95 px-3.5 py-2.5 backdrop-blur-xs",
					className,
				)}
			>
				<CoreEmblem
					isGenerating={isGenerating}
					isModelReady={isModelReady}
					className="size-10"
				/>

				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<span className="font-boldonse text-sm leading-none tracking-[0.14em] text-cod-gray-50">
						ULTRON
					</span>
					<StatusReadout
						isModelReady={isModelReady}
						isGenerating={isGenerating}
					/>
				</div>

				<AnimatePresence>
					{backend && (
						<motion.span
							key={backend}
							initial={{ opacity: 0, scale: 0.92 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.92 }}
							transition={{ duration: 0.2 }}
							className="inline-flex items-center gap-1.5 rounded-lg border-2 border-red-ribbon-600/80 bg-red-ribbon-950 px-2.5 py-1 font-aquatico text-[9px] tracking-[0.16em] text-red-ribbon-200"
						>
							<Cpu
								className="size-3 text-red-ribbon-400"
								aria-hidden="true"
							/>
							{backend.toUpperCase()}
						</motion.span>
					)}
				</AnimatePresence>
			</motion.header>
		);
	}

	return (
		<div className={cn("inline-flex items-center gap-3.5", className)}>
			<CoreEmblem
				isGenerating={isGenerating}
				isModelReady={isModelReady}
				className="size-10"
			/>
			<div className="flex flex-col gap-1">
				<span className="font-boldonse text-base leading-none tracking-[0.14em] text-cod-gray-50">
					ULTRON
				</span>
				<span className="font-moon text-[10px] tracking-[0.2em] text-cod-gray-400">
					SOVEREIGN // 0.5B
				</span>
			</div>
		</div>
	);
}
