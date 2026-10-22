import React, { useEffect, useRef, useState } from 'react';
import { WebcamService } from '../services/webcam';
import { HandTrackerService } from '../services/handTracker';
import { FaceTrackerService } from '../services/faceTracker';
import { GestureDetector } from '../services/gestureDetector';
import { MouthDetector } from '../services/mouthDetector';
import { HookahInteractionManager } from '../services/hookahInteraction';
import { VapourParticleSystem, type SmokeSource } from '../services/vapourParticleSystem';
import { Hookah3DScene } from '../services/hookah3DScene';
import { FaceAnchorDetector } from '../services/faceAnchors';
import { CoalManager } from '../services/coalInteraction';
import { EmberSparks, drawCoalZone } from '../services/emberSparks';
import { drawHookahBase, drawHoseAndMouthpiece, drawLandmarksDebug } from '../utils/drawHookah';
import { AudioEngine } from '../services/audioEngine';
import { drawFaceEffect } from '../utils/drawFaceEffects';
import { getCoverViewport } from '../utils/videoViewport';
import type { AppState, MouthState, PinchState } from '../types/hookah';
import type { ARSettings } from '../types/settings';

interface ARCanvasProps {
  showLandmarks: boolean;
  settings: ARSettings;
  screenshotRequest: number; // increments each time the user presses the screenshot button
  onStateChange: (state: AppState) => void;
  onMetricsUpdate: (pinch: PinchState | null, mouth: MouthState | null) => void;
  onCoalHeatChange: (heat: number) => void;
  manualSmokeTrigger: boolean;
  onManualSmokeTriggered: () => void;
}

export const ARCanvas: React.FC<ARCanvasProps> = ({
  showLandmarks,
  settings,
  screenshotRequest,
  onStateChange,
  onMetricsUpdate,
  onCoalHeatChange,
  manualSmokeTrigger,
  onManualSmokeTriggered
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingStep, setLoadingStep] = useState<string>('Initializing camera...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [flash, setFlash] = useState<boolean>(false);

  // Services refs
  const webcamServiceRef = useRef<WebcamService>(new WebcamService());
  const handTrackerRef = useRef<HandTrackerService>(new HandTrackerService());
  const faceTrackerRef = useRef<FaceTrackerService>(new FaceTrackerService());
  const gestureDetectorRef = useRef<GestureDetector>(new GestureDetector());
  const mouthDetectorRef = useRef<MouthDetector>(new MouthDetector());
  const hookahManagerRef = useRef<HookahInteractionManager>(new HookahInteractionManager());
  const particleSystemRef = useRef<VapourParticleSystem>(new VapourParticleSystem());
  const hookah3DSceneRef = useRef<Hookah3DScene | null>(null);
  const faceAnchorRef = useRef<FaceAnchorDetector>(new FaceAnchorDetector());
  const coalManagerRef = useRef<CoalManager>(new CoalManager());
  const sparksRef = useRef<EmberSparks>(new EmberSparks());
  const audioRef = useRef<AudioEngine>(new AudioEngine());

  // The render loop is started once, so it reads live props through refs
  const settingsRef = useRef<ARSettings>(settings);
  const showLandmarksRef = useRef<boolean>(showLandmarks);
  useEffect(() => {
    settingsRef.current = settings;
    showLandmarksRef.current = showLandmarks;
  }, [settings, showLandmarks]);
  const lastReportedHeatRef = useRef<number>(-1);

  // Sound: browsers only start audio after a user gesture, so unlock on the first one
  useEffect(() => {
    const audio = audioRef.current;
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      audio.destroy();
    };
  }, []);

  useEffect(() => {
    audioRef.current.setEnabled(settings.sound);
  }, [settings.sound]);

  // Screenshot: composite the mirrored camera feed + 3D hookah + 2D overlay into one PNG
  useEffect(() => {
    if (screenshotRequest === 0) return;
    const video = videoRef.current;
    const webgl = webglCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!video || !webgl || !overlay || !webcamServiceRef.current.isReady()) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const outW = Math.round(window.innerWidth * ratio);
    const outH = Math.round(window.innerHeight * ratio);
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext('2d');
    if (!ctx) return;

    // Camera feed, mirrored and cropped exactly like the on-screen <video>
    const vp = getCoverViewport(video, outW, outH);
    ctx.save();
    ctx.translate(outW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, vp.offsetX, vp.offsetY, vp.width, vp.height);
    ctx.restore();

    ctx.drawImage(webgl, 0, 0, outW, outH);
    ctx.drawImage(overlay, 0, 0, outW, outH);

    // Small credit in the corner
    ctx.font = `600 ${Math.round(13 * ratio)}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 4 * ratio;
    ctx.fillText('Hookah Bar AR · @abheepvtt___', outW - 14 * ratio, outH - 14 * ratio);

    audioRef.current.playShutter();
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);

    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `hookah-ar-${stamp}.png`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 'image/png');
  }, [screenshotRequest]);

  const animFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initAR() {
      try {
        setLoadingStep('Accessing webcam feed...');
        if (videoRef.current) {
          const success = await webcamServiceRef.current.initialize(videoRef.current);
          if (!success) throw new Error('Webcam initialization failed');
        }

        if (!isMounted) return;

        setLoadingStep('Initializing 3D Engine...');
        if (webglCanvasRef.current) {
          webglCanvasRef.current.width = window.innerWidth;
          webglCanvasRef.current.height = window.innerHeight;
          try {
            hookah3DSceneRef.current = new Hookah3DScene(webglCanvasRef.current);
          } catch (e) {
            console.warn('3D WebGL scene initialization failed, using 2D high-res fallback:', e);
          }
        }

        setLoadingStep('Loading AI Vision models (Hand & Face)...');
        await Promise.all([
          handTrackerRef.current.initialize(),
          faceTrackerRef.current.initialize()
        ]);

        if (!isMounted) return;

        setIsLoading(false);
        startRenderLoop();
      } catch (err: any) {
        console.error('AR initialization error:', err);
        if (isMounted) {
          setErrorMsg(err?.message || 'Failed to start AR experience');
          setIsLoading(false);
        }
      }
    }

    initAR();

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      if (webglCanvasRef.current) {
        webglCanvasRef.current.width = width;
        webglCanvasRef.current.height = height;
      }
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = width;
        overlayCanvasRef.current.height = height;
      }
      if (hookah3DSceneRef.current) {
        hookah3DSceneRef.current.resize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      if (hookah3DSceneRef.current) {
        hookah3DSceneRef.current.destroy();
      }
      webcamServiceRef.current.stop();
    };
  }, []);

  // Handle manual smoke trigger from Debug HUD
  useEffect(() => {
    if (manualSmokeTrigger) {
      if (overlayCanvasRef.current) {
        const cx = overlayCanvasRef.current.width / 2;
        const cy = overlayCanvasRef.current.height * 0.5;
        // Emit to both sides for the manual test trigger
        particleSystemRef.current.emit([{ x: cx, y: cy }], 180);
        hookahManagerRef.current.setAppState('VAPOUR');
        onStateChange('VAPOUR');
      }
      onManualSmokeTriggered();
    }
  }, [manualSmokeTrigger]);

  const startRenderLoop = () => {
    const loop = () => {
      const video = videoRef.current;
      const webglCanvas = webglCanvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;

      const width = window.innerWidth;
      const height = window.innerHeight;

      // Ensure canvas pixel dimensions match viewport
      if (webglCanvas && (webglCanvas.width !== width || webglCanvas.height !== height)) {
        webglCanvas.width = width;
        webglCanvas.height = height;
        if (hookah3DSceneRef.current) {
          hookah3DSceneRef.current.resize(width, height);
        }
      }

      if (overlayCanvas && (overlayCanvas.width !== width || overlayCanvas.height !== height)) {
        overlayCanvas.width = width;
        overlayCanvas.height = height;
      }

      if (video && webcamServiceRef.current.isReady()) {
        const timestampMs = performance.now();

        // 1. Run Computer Vision Landmarkers
        const handResults = handTrackerRef.current.detect(video, timestampMs);
        const faceResults = faceTrackerRef.current.detect(video, timestampMs);

        // The video is cropped to fill the window; map landmarks through the same crop
        const vp = getCoverViewport(video, width, height);
        const vpOffset = { x: vp.offsetX, y: vp.offsetY };

        // 2. Process Pinch & Mouth detection
        const pinchState = gestureDetectorRef.current.detectPinch(
          handResults?.landmarks || [],
          vp.width,
          vp.height,
          true, // Mirrored view matching webcam display
          vpOffset
        );

        const mouthState = mouthDetectorRef.current.detectMouth(
          faceResults?.faceLandmarks || [],
          vp.width,
          vp.height,
          true, // Mirrored view matching webcam display
          vpOffset
        );

        // Notify parent of metrics
        onMetricsUpdate(pinchState, mouthState);

        // 3. Update Hookah Interaction State Machine
        const { appState, shouldEmitVapour, vapourEmitterPos } = hookahManagerRef.current.update(
          pinchState,
          mouthState,
          width,
          height
        );

        onStateChange(appState);

        const s = settingsRef.current;
        const scene3D = hookah3DSceneRef.current;
        const basePos = hookahManagerRef.current.getBasePosition();
        const pipePos = hookahManagerRef.current.getPipePosition();

        // 4. Face anchors (eyes, forehead, nostrils) for face-attached effects
        const faceAnchors = faceAnchorRef.current.detect(
          faceResults?.faceLandmarks || [],
          vp.width,
          vp.height,
          true,
          vpOffset
        );

        // 5. Charcoal: the free hand fans (open palm) or refreshes (pinch) the coal
        const coalPos = scene3D ? scene3D.getCoalScreenPosition() : { x: basePos.x, y: basePos.y - 280 };
        const coal = coalManagerRef.current.update(
          handResults?.landmarks || [],
          pipePos.isHeld,
          pinchState ? pinchState.pinchCenter : null,
          coalPos,
          vp,
          height,
          true
        );
        scene3D?.setCoalHeat(coal.heat);
        audioRef.current.update(appState, coal.heat, coal.fanning, coal.freshCoal);

        if (coal.fanning) sparksRef.current.emit(coalPos.x, coalPos.y, 2, 30);
        if (coal.freshCoal) sparksRef.current.emit(coalPos.x, coalPos.y, 28, 50);
        if (coal.heat > 0.8 && Math.random() < 0.12) sparksRef.current.emit(coalPos.x, coalPos.y, 1, 24);
        sparksRef.current.update();

        const roundedHeat = Math.round(coal.heat * 50) / 50;
        if (roundedHeat !== lastReportedHeatRef.current) {
          lastReportedHeatRef.current = roundedHeat;
          onCoalHeatChange(roundedHeat);
        }

        // 6. Emit Vapour if active — pass mouth width so particles go around face.
        // A hotter coal makes thicker smoke.
        particleSystemRef.current.setOptions({
          style: s.smokeStyle,
          color: s.smokeColor,
          density: s.smokeDensity * (0.75 + 0.55 * coal.heat),
          slowMotion: s.slowMotion
        });

        if (shouldEmitVapour) {
          const faceW = mouthState ? mouthState.width * 3.5 : 160;
          const sources: SmokeSource[] = [];
          if (s.exhaleSource !== 'nose' || !faceAnchors) {
            sources.push({ x: vapourEmitterPos.x, y: vapourEmitterPos.y });
          }
          if (faceAnchors && s.exhaleSource !== 'mouth') {
            sources.push({ ...faceAnchors.noseLeft, scale: 0.5 }, { ...faceAnchors.noseRight, scale: 0.5 });
          }
          particleSystemRef.current.emit(sources, faceW);
        }

        // Update particle physics
        particleSystemRef.current.update();

        // 7. RENDER 3D HOOKAH SCENE
        if (scene3D) {
          scene3D.update(basePos, pipePos, appState, timestampMs);
        }

        // 6. RENDER 2D OVERLAY (Particles, Backup Hookah, Debug Landmarks)
        if (overlayCanvas) {
          const ctx = overlayCanvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, width, height);

            const isSipping = appState === 'SIP_DETECTED' || appState === 'PIPE_AT_MOUTH';

            // Draw Backup Hookah graphic if 3D scene is not active
            if (!hookah3DSceneRef.current) {
              drawHookahBase(ctx, basePos, isSipping, timestampMs);
              drawHoseAndMouthpiece(ctx, basePos, pipePos, appState);
            }

            // Face-attached accessory (glasses, crown, ...)
            drawFaceEffect(ctx, s.faceEffect, faceAnchors, timestampMs);

            // Coal interaction zone + sparks
            if (coal.active) {
              drawCoalZone(ctx, coalPos, coal.zoneRadius, coal.heat, timestampMs);
            }
            sparksRef.current.draw(ctx);

            // Draw Vapour Particles (Smoke overlay)
            particleSystemRef.current.draw(ctx);

            // Draw Hand & Face Landmark debugging if enabled
            if (showLandmarksRef.current) {
              drawLandmarksDebug(ctx, pinchState, mouthState);
            }
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#000' }}>
      {/* Fullscreen Webcam Video */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)' // Mirror video feed naturally for selfie experience
        }}
      />

      {/* Photorealistic 3D WebGL Canvas Layer */}
      <canvas
        ref={webglCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10
        }}
      />

      {/* 2D Vapour Particles & Backup Overlay Canvas Layer */}
      <canvas
        ref={overlayCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 15
        }}
      />

      {/* Screenshot flash */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#fff',
          opacity: flash ? 0.75 : 0,
          transition: flash ? 'none' : 'opacity 0.3s ease-out',
          pointerEvents: 'none',
          zIndex: 35
        }}
      />

      {/* Minimalist Loading Screen */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0a0a0c',
            color: '#fff',
            zIndex: 30,
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              border: '4px solid rgba(255, 255, 255, 0.1)',
              borderTopColor: '#e91e63',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}
          />
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          <h2 style={{ marginTop: 24, fontSize: '1.25rem', fontWeight: 600, letterSpacing: '0.05em' }}>
            Hookah Bar AR
          </h2>
          <p style={{ marginTop: 8, color: '#9e9e9e', fontSize: '0.9rem' }}>{loadingStep}</p>
          <p style={{ marginTop: 18, color: '#616161', fontSize: '0.78rem' }}>
            Created by <span style={{ color: '#bdbdbd' }}>Abhishek Dombale</span> (<span style={{ color: '#e91e63' }}>@abheepvtt___</span>)
          </p>
        </div>
      )}

      {/* Error Overlay */}
      {errorMsg && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(10, 10, 12, 0.95)',
            color: '#ff5252',
            padding: 24,
            textAlign: 'center',
            zIndex: 40,
            fontFamily: 'system-ui, sans-serif'
          }}
        >
          <h3 style={{ fontSize: '1.2rem', marginBottom: 8 }}>Camera / AR Access Error</h3>
          <p style={{ color: '#e0e0e0', maxWidth: 400 }}>{errorMsg}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              padding: '10px 24px',
              backgroundColor: '#e91e63',
              color: '#fff',
              border: 'none',
              borderRadius: 20,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Retry Permission
          </button>
        </div>
      )}
    </div>
  );
};
