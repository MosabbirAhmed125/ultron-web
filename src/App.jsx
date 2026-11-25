import { MotionConfig } from "motion/react";
import { Toaster } from "react-hot-toast";
import * as HomeModule from "./pages/Home.jsx";

const Home = Reflect.get(HomeModule, "default");

function App() {
	return (
		<MotionConfig reducedMotion="user">
			<Toaster
				toastOptions={{
					style: {
						background: "var(--color-shark-900)",
						color: "var(--color-cod-gray-100)",
						border: "1px solid var(--color-red-ribbon-700)",
						fontFamily: "var(--font-ubuntu)",
					},
				}}
			/>
			<main className="min-h-dvh bg-cod-gray-950 text-cod-gray-100 antialiased selection:bg-red-ribbon-600/30 selection:text-red-ribbon-100">
				{Home ? <Home /> : null}
			</main>
		</MotionConfig>
	);
}

export default App;
