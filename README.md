# ULTRON // Sovereign In-Browser AI

ULTRON is a zero-backend, client-side AI web application. It runs the quantized
Qwen2.5-0.5B-Instruct ONNX model
[`Mosabbir125/ultron-qwen25-05b-onnx-web`](https://huggingface.co/Mosabbir125/ultron-qwen25-05b-onnx-web)
(`q4`) directly in the browser, using WebGPU when available and automatically
falling back to WASM.

## Live Demo & Architecture

[![Live demo on Vercel](https://img.shields.io/badge/Live%20demo-Vercel-black?logo=vercel)](https://ultron-web.vercel.app)
[![Model on Hugging Face](https://img.shields.io/badge/Model-Hugging%20Face-yellow?logo=huggingface)](https://huggingface.co/Mosabbir125/ultron-qwen25-05b-onnx-web)

The Vercel URL is the project's deployment target; availability depends on the
deployment.

- **Browser-native inference:** `@huggingface/transformers` loads and runs the
  model inside the dedicated [`ultronWorker.js`](src/lib/ultronWorker.js)
  Web Worker. The application does not require an inference backend, reducing
  server hosting costs and server cold starts. The browser still needs to
  download model files and initialize the runtime, especially on first use.
- **Adaptive runtime:** The worker attempts WebGPU and uses WASM if WebGPU is
  unavailable or initialization fails. The selected backend is shown in the
  interface.
- **Lore grounding:** [`public/lore.json`](public/lore.json) contains keyword-
  matched MCU and *VisionQuest* reference entries. The matching lore snippet is
  added to the system context when relevant; it does not replace conversation
  history.
- **Bounded conversation context:** Generation includes up to five recent
  user/assistant turns (ten non-system messages), plus the system message.
- **Interactive generation:** Responses stream token-by-token with `TOK/S`
  throughput telemetry. Users can stop generation or regenerate the latest
  response.

## UI & Motion Design

The interface uses a dark-crimson and metallic-obsidian visual system. Tailwind
CSS v4 theme tokens in `src/index.css` define its custom color palette and
typography. `motion/react` powers state transitions, ambient crimson glow
halos, and the animated model-loading display, whose artwork and telemetry
panels share a width. Reduced-motion preferences are respected at the app root.

## Tech Stack

- React 19
- Vite
- Tailwind CSS v4 with the Vite plugin
- `motion/react` (`motion`)
- `@huggingface/transformers` for browser inference
- `lucide-react` for interface icons
- ONNX Runtime Web, used by the Transformers.js browser runtime

## Project Structure

```text
public/
├── favicon.svg
└── lore.json
src/
├── assets/
│   ├── fonts/
│   │   ├── Aquatico.otf
│   │   ├── Arkhip.otf
│   │   ├── Dreamer.otf
│   │   ├── Emasland.otf
│   │   ├── Freedom.otf
│   │   ├── GalhauDisplay-Bold.ttf
│   │   ├── GalhauDisplay-Regular.ttf
│   │   ├── Gramola.ttf
│   │   ├── Gurvaco.otf
│   │   ├── Header.otf
│   │   ├── Idealism.otf
│   │   ├── Jenko.ttf
│   │   ├── MatthCondensed.ttf
│   │   ├── Moon.otf
│   │   ├── Phenomena-Black.otf
│   │   ├── Phenomena-Bold.otf
│   │   ├── Phenomena-ExtraBold.otf
│   │   ├── Phenomena-ExtraLight.otf
│   │   ├── Phenomena-Light.otf
│   │   ├── Phenomena-Regular.otf
│   │   ├── Phenomena-Thin.otf
│   │   ├── Sequel.ttf
│   │   ├── Tango-Regular.otf
│   │   ├── Ubuntu-bold.js
│   │   └── Ubuntu-normal.js
│   └── ultron.svg
├── components/
│   ├── ChatBox.jsx
│   ├── LoadingOverlay.jsx
│   ├── PromptInput.jsx
│   └── UltronPanel.jsx
├── lib/
│   ├── cn.js
│   ├── ultronConfig.js
│   ├── ultronWorker.js
│   └── useUltron.js
├── pages/
│   └── Home.jsx
├── App.jsx
├── index.css
└── main.jsx
```

`main.jsx` mounts the app, `Home.jsx` composes the chat experience, and
`useUltron.js` manages chat state, lore lookup, and the worker lifecycle.
`ultronConfig.js` defines the model and generation settings; `ultronWorker.js`
loads the model and performs inference.

## Local Development & Production Build

Install dependencies and run the Vite development server:

```bash
npm install
npm run dev
```

Run the configured lint check and create a production build:

```bash
npm run lint
npm run build
```

A WebGPU-capable desktop browser is recommended for the best inference
performance. Unsupported devices and WebGPU initialization failures use the
automatic WASM fallback. The first run may require downloading the model and
compiling the runtime, so it can take longer than subsequent use.