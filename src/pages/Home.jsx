import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Activity, Cpu, Gauge, Layers, Zap } from "lucide-react";
import { useUltron } from "../lib/useUltron.js";
import { STARTER_PROMPTS } from "../lib/ultronConfig.js";
import { cn } from "../lib/cn.js";
import LoadingOverlay from "../components/LoadingOverlay.jsx";
import UltronPanel from "../components/UltronPanel.jsx";
import ChatBox from "../components/ChatBox.jsx";
import PromptInput from "../components/PromptInput.jsx";

const VIEWPORT_TICKS = [
	"top-20 left-5 rounded-tl-sm border-t-2 border-l-2",
	"top-20 right-5 rounded-tr-sm border-t-2 border-r-2",
	"bottom-14 left-5 rounded-bl-sm border-b-2 border-l-2",
	"bottom-14 right-5 rounded-br-sm border-b-2 border-r-2",
];

export default function Home() {
	const {
		messages,
		isModelReady,
		isLoadingModel,
		loadProgress,
		backend,
		isGenerating,
		tokensPerSec,
		error,
		sendMessage,
		regenerateLastResponse,
		stopGeneration,
		resetChat,
		reloadModel,
	} = useUltron();
	const [inputValue, setInputValue] = useState("");

	const canSend = isModelReady && !isGenerating;

	const send = (text) => {
		if (!canSend || !text.trim()) return;
		sendMessage(text);
		setInputValue("");
	};

	const handleReset = () => {
		resetChat();
		setInputValue("");
	};

	// Init failures surface in the overlay; generation errors stay in the chat.
	const initError = !isModelReady && !isGenerating ? error : null;
	const chatError = isModelReady ? error : null;

	const status = !isModelReady
		? { label: "STANDBY", dot: "bg-cod-gray-400" }
		: isGenerating
			? { label: "SYNTHESIZING", dot: "bg-red-ribbon-500" }
			: { label: "ONLINE", dot: "bg-red-ribbon-500" };
	const hasSpeed = typeof tokensPerSec === "number" && tokensPerSec > 0;
	const speed = hasSpeed ? `${tokensPerSec.toFixed(1)} TOK/S` : "-- TOK/S";

	return (
		<div className="relative flex h-dvh flex-col overflow-hidden bg-cod-gray-950 text-cod-gray-100">
			{/* Rich radial crimson & metallic obsidian ambient depth */}
			<motion.div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0"
				style={{
					background:
						"radial-gradient(ellipse 72% 48% at 50% 14%, color-mix(in srgb, var(--color-red-ribbon-700) 24%, transparent) 0%, color-mix(in srgb, var(--color-alizarin-crimson-950) 26%, transparent) 38%, transparent 72%), radial-gradient(ellipse 84% 38% at 50% 100%, color-mix(in srgb, var(--color-cod-gray-700) 22%, transparent) 0%, transparent 66%)",
				}}
				animate={
					isGenerating
						? { opacity: [0.8, 1, 0.8] }
						: { opacity: 0.85 }
				}
				transition={
					isGenerating
						? { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
						: { duration: 0.45 }
				}
			/>

			{VIEWPORT_TICKS.map((pos) => (
				<motion.span
					key={pos}
					aria-hidden="true"
					animate={{
						borderColor: isGenerating
							? "var(--color-red-ribbon-600)"
							: "var(--color-cod-gray-700)",
					}}
					transition={{ duration: 0.35 }}
					className={cn(
						"pointer-events-none absolute z-1 hidden size-3.5 lg:block",
						pos,
					)}
				/>
			))}

			<LoadingOverlay
				isOpen={isLoadingModel || !isModelReady}
				progress={loadProgress}
				backend={backend}
				error={initError}
				onRetry={reloadModel}
			/>

			{/* Desktop peripheral header */}
			<motion.header
				initial={{ opacity: 0, y: -8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3, ease: "easeOut" }}
				className="relative z-10 hidden items-center justify-between border-b-2 border-cod-gray-800 bg-cod-gray-950/85 px-6 py-3 backdrop-blur-xs lg:flex"
			>
				<UltronPanel
					backend={backend}
					isModelReady={isModelReady}
					isGenerating={isGenerating}
					variant="compact"
				/>

				<div className="flex items-center gap-3 rounded-lg border-2 border-cod-gray-700/90 bg-shark-950/90 px-3.5 py-1.5 text-[10px] tracking-[0.16em]">
					<span
						role="status"
						aria-live="polite"
						className="inline-flex items-center gap-2 font-aquatico text-cod-gray-100"
					>
						<span
							className="relative flex size-2"
							aria-hidden="true"
						>
							{isGenerating && (
								<motion.span
									className="absolute inline-flex size-full rounded-full bg-red-ribbon-500"
									initial={{ scale: 1, opacity: 0.85 }}
									animate={{ scale: 2.5, opacity: 0 }}
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
						<Activity
							className="size-3.5 text-red-ribbon-400"
							aria-hidden="true"
						/>
						<span>{status.label}</span>
					</span>

					<AnimatePresence>
						{backend && (
							<motion.div
								key={backend}
								initial={{ opacity: 0, scale: 0.92 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.92 }}
								transition={{ duration: 0.2 }}
								className="flex items-center gap-3"
							>
								<span
									aria-hidden="true"
									className="h-3.5 w-0.5 bg-cod-gray-700"
								/>
								<span className="inline-flex items-center gap-1.5 rounded-md border border-red-ribbon-600/80 bg-red-ribbon-950 px-2 py-0.5 font-aquatico text-red-ribbon-200">
									<Zap
										className="size-3 text-red-ribbon-400"
										aria-hidden="true"
									/>
									{backend.toUpperCase()}
								</span>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</motion.header>

			{/* Mobile compact header */}
			<UltronPanel
				backend={backend}
				isModelReady={isModelReady}
				isGenerating={isGenerating}
				variant="mobile"
				className="relative z-10 shrink-0 lg:hidden"
			/>

			{/* Centered modern LLM conversation + command workspace */}
			<main className="relative z-10 flex min-h-0 flex-1 flex-col">
				<ChatBox
					messages={messages}
					isGenerating={isGenerating}
					error={chatError}
					starterPrompts={STARTER_PROMPTS}
					onSelectStarter={send}
					onRegenerate={regenerateLastResponse}
					className="min-h-0 flex-1"
				/>

				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3, delay: 0.05, ease: "easeOut" }}
					className="shrink-0 px-4 pt-1.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-6 lg:pb-5"
				>
					<PromptInput
						value={inputValue}
						onChange={setInputValue}
						onSubmit={send}
						onStop={stopGeneration}
						onReset={handleReset}
						disabled={!isModelReady}
						isGenerating={isGenerating}
						hasMessages={messages.length > 0}
						className="mx-auto max-w-3xl"
					/>
				</motion.div>
			</main>

			{/* Desktop peripheral telemetry footer */}
			<motion.footer
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3, ease: "easeOut" }}
				className="relative z-10 hidden items-center justify-between border-t-2 border-cod-gray-800 bg-cod-gray-950/85 px-6 py-2.5 text-[11px] tracking-[0.18em] backdrop-blur-xs lg:flex"
			>
				<div className="flex items-center gap-2.5">
					<Gauge
						className="size-3.5 text-red-ribbon-400"
						aria-hidden="true"
					/>
					<span className="font-moon text-cod-gray-400">
						THROUGHPUT
					</span>
					<span
						className={cn(
							"font-phenomena text-sm font-bold tracking-[0.14em] tabular-nums",
							hasSpeed
								? "text-red-ribbon-400"
								: "text-cod-gray-300",
						)}
					>
						{speed}
					</span>
				</div>

				<div className="flex items-center gap-3 font-moon text-cod-gray-300">
					<span className="inline-flex items-center gap-1.5">
						<Layers
							className="size-3.5 text-cod-gray-400"
							aria-hidden="true"
						/>
						5-TURN WINDOW
					</span>
					<span
						aria-hidden="true"
						className="h-3 w-0.5 bg-cod-gray-700"
					/>
					<span className="inline-flex items-center gap-1.5 text-cod-gray-400">
						<Cpu
							className="size-3.5 text-red-ribbon-400"
							aria-hidden="true"
						/>
						LOCAL ONNX // QWEN2.5-0.5B
					</span>
				</div>
			</motion.footer>
		</div>
	);
}
