# 🌬️ Hookah Bar AR (WebAR Experience)

An interactive, photorealistic **Augmented Reality Hookah Experience** right inside your browser using **Three.js**, **Google MediaPipe Vision**, **React**, and **TypeScript**.

Control the hookah pipe with your real hands, bring it to your mouth to take a sip, and exhale realistic, billowing, atmospheric smoke that curls naturally around your face!

🚀 **Live Demo:** [hookah-jade.vercel.app](https://hookah-jade.vercel.app) — allow camera access when prompted.

---

## ✨ Features

- 🏺 **Photorealistic 3D Hookah**: Custom-modeled multi-section ornate metallic stem (brass/gold and cobalt accents), spherical decorated base flask, wide charcoal tray, and flexible braided hose using Three.js PBR materials.
- 🖐️ **AI-Powered Hand Tracking**: Grasp and hold the hookah mouthpiece naturally using your fist or pinch gesture tracked in real-time via Google MediaPipe HandLandmarker.
- 👄 **Smart Sip & Exhale Detection**: Real-time facial landmark tracking detects when the mouthpiece approaches your lips, registers a sip when your mouth opens, and triggers immediate vapour exhale.
- 💨 **Atmospheric Volumetric Smoke**: Multi-tiered particle system that produces translucent billowing hookah clouds with instant zero-latency response, curling and scattering around your face, cheeks, and shoulders.
- ⚡ **Zero Backend / 100% Client-Side**: Runs entirely in the client's browser with WebGL hardware acceleration and webcam feed privacy.

### 🆕 More Ways to Play

Open the **Options** panel (top right) to customise the experience. Your choices are remembered in the browser.

- 💨 **Smoke Options**: Choose the smoke style (**Clouds**, **Rings** or **Both**), one of six colours (white, mint, berry, blue, gold, violet), the density (0.5×–2×), and a slow-motion mode. You can exhale from the **mouth**, the **nose**, or **both**.
- 😎 **Face-Anchored Effects**: Sunglasses, a crown, a party hat or a halo that stick to your face and tilt with your head, built on facial landmark tracking.
- 🔥 **Second-Hand Charcoal Control**: Hold the hose with one hand and use your **other hand** on the coal. Hover an **open palm** over it to fan it (brighter glow and sparks), or **pinch** near it to add a fresh coal. A hotter coal makes thicker smoke, and the heat slowly cools down again.
- 🔊 **Procedural Sound**: Water bubbling while you sip, an exhale whoosh, and coal crackle that gets louder as the coal heats up. Generated with the Web Audio API (no audio files). Use the speaker button to mute. Browsers only start audio after your first click or tap.
- 📸 **Screenshot Button**: Saves one PNG of the camera view, the 3D hookah, the smoke and your face effect.
- 🎯 **Accurate Alignment**: Face and hand positions are mapped through the same crop as the camera feed, so effects line up on any screen shape.

---

## 🎮 How to Interact

| Step | Action | Gesture |
|------|--------|---------|
| **1. Grab Hose** | Reach out towards the golden mouthpiece | **Close your fist** or pinch fingers near the pipe tip |
| **2. Bring to Mouth** | Move your hand towards your face | Move the pipe within proximity of your mouth |
| **3. Take a Sip** | Inhale from the mouthpiece | Open mouth slightly while pipe is at lips (LED/water bubbles activate) |
| **4. Exhale Vapour** | Release or move pipe away and open mouth | Instant atmospheric smoke plume billows out and curls around you |
| **5. Fan the Coal** | Use your free hand over the glowing coal | **Open palm** hovering over the coal: hotter glow, sparks, thicker smoke |
| **6. Fresh Coal** | Use your free hand near the coal | **Pinch** fingers near the coal to add a fresh coal |

---

## 🛠️ Tech Stack

- **Frontend Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Dev Server**: [Vite](https://vitejs.dev/)
- **3D Graphics & Rendering**: [Three.js](https://threejs.org/)
- **Computer Vision & AI**: [@mediapipe/tasks-vision](https://ai.google.dev/edge/mediapipe/solutions/vision) (FaceLandmarker & HandLandmarker)
- **Particle Dynamics**: Custom Canvas 2D Volumetric Particle Physics Engine
- **Audio**: Web Audio API (synthesised sound effects)

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js (v18 or higher recommended)
- A working webcam

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Abhee7/Hookah.git
   cd Hookah
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```
   *(Grant camera permissions when prompted)*

5. **Build for production**:
   ```bash
   npm run build
   ```

---

## 🌐 Where & How to Deploy

Because this project is a pure client-side static web application (SPA), it can be deployed for **free** on any modern static hosting provider with HTTPS support (HTTPS is **required** by browsers for webcam access).

### 1. 🥇 Vercel (Recommended - Fastest & Easiest)
1. Go to [Vercel](https://vercel.com) and log in with GitHub.
2. Click **Add New Project** → **Import** your `Abhee7/Hookah` repository.
3. Keep default settings (Framework Preset: **Vite**, Build Command: `npm run build`, Output Directory: `dist`).
4. Click **Deploy**. Your AR app will be live in seconds with automatic HTTPS!

### 2. 🥈 Netlify
1. Go to [Netlify](https://www.netlify.com) and sign in.
2. Click **Add new site** → **Import an existing project** → Select GitHub → `Hookah`.
3. Build Command: `npm run build`
4. Publish directory: `dist`
5. Click **Deploy Site**.

### 3. 🥉 GitHub Pages
1. In `vite.config.ts`, set `base: '/Hookah/'`.
2. Install `gh-pages`:
   ```bash
   npm install --save-dev gh-pages
   ```
3. Add deploy scripts to `package.json`:
   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist"
   }
   ```
4. Run `npm run deploy`.
5. In GitHub repository Settings → **Pages** → Source: `gh-pages` branch.

---

## 📁 Project Structure

```
Hookah/
├── public/                 # Static public assets
├── src/
│   ├── components/
│   │   ├── ARCanvas.tsx    # Primary AR video layer, WebGL canvas & loop
│   │   └── DebugHUD.tsx    # Top HUD controls (Landmarks, State, Test Smoke)
│   ├── services/
│   │   ├── faceTracker.ts         # MediaPipe FaceLandmarker pipeline
│   │   ├── handTracker.ts         # MediaPipe HandLandmarker pipeline
│   │   ├── gestureDetector.ts     # Fist / pinch gesture recognition
│   │   ├── mouthDetector.ts       # Real-time lip & mouth opening analysis
│   │   ├── hookah3DScene.ts       # Three.js 3D Hookah model & lighting
│   │   ├── hookahInteraction.ts   # Interaction state machine & lerp physics
│   │   ├── vapourParticleSystem.ts# Volumetric smoke particle dynamics
│   │   └── webcam.ts              # Camera stream capture service
│   ├── types/
│   │   └── hookah.ts              # State interfaces & vector definitions
│   ├── utils/
│   │   └── drawHookah.ts          # 2D fallback graphics & HUD overlays
│   ├── App.tsx                    # Main root component
│   └── main.tsx                   # React entry point
├── package.json
└── vite.config.ts
```

---

## 🔒 Privacy & Permissions

- The camera feed is processed **strictly in-memory** on your local device.
- No video or facial landmark data is ever stored, uploaded, or transmitted to any server.

---

## 👨‍💻 Author & Creator

**Abhishek Dombale**
- Instagram: [@abheepvtt___](https://instagram.com/abheepvtt___)
- GitHub: [@Abhee7](https://github.com/Abhee7)

---

## 📄 License

MIT License © 2026 Abhishek Dombale

