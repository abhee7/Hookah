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
import { AudioEngine } from '../services/audioEngine';
import { drawHookahBase, drawHoseAndMouthpiece, drawLandmarksDebug } from '../utils/drawHookah';
import { drawFaceEffect } from '../utils/drawFaceEffects';
import { getCoverViewport } from '../utils/videoViewport';
import type { AppState, MouthState, PinchState, Point2D } from '../types/hookah';
import type { ARSettings, CameraFacing } from '../types/settings';

interface ARCanvasProps {
  showLandmarks: boolean;
  settings: ARSettings;
  facing: CameraFacing;
  screenshotRequest: number; // increments each time the user presses the screenshot button
  recordRequest: number; // increments each time the user presses the record button (toggle)
  onRecordingChange: (recording: boolean, seconds: number) => void;
  onCameraStarted: () => void;
  onStateChange: (state: AppState) => void;
  onMetricsUpdate: (pinch: PinchState | null, mouth: MouthState | null) => void;
  onCoalHeatChange: (heat: number) => void;
  manualSmokeTrigger: boolean;
  onManualSmokeTriggered: () => void;
}

type HandResults = ReturnType<HandTrackerService['detect']>;
type FaceResults = ReturnType<FaceTrackerService['detect']>;

interface ActiveRecording {
  recorder: MediaRecorder;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  timer: number;
}

const MAX_RECORDING_SECONDS = 30;

function pickRecordingMime(): string {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
}

function nearestTo<T>(items: T[], target: Point2D, position: (item: T) => Point2D): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const item of items) {
    const p = position(item);
    const d = Math.hypot(p.x - target.x, p.y - target.y);
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best;
}

export const ARCanvas: React.FC<ARCanvasProps> = ({
  showLandmarks,
  settings,
  facing,
  screenshotRequest,
  recordRequest,
  onRecordingChange,
  onCameraStarted,
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
  const facingRef = useRef<CameraFacing>(facing);
  const activeFacingRef = useRef<CameraFacing | null>(null); // facing the open camera stream was started with
  useEffect(() => {
    settingsRef.current = settings;
    showLandmarksRef.current = showLandmarks;
  }, [settings, showLandmarks]);
  const lastReportedHeatRef = useRef<number>(-1);
  const lastSizeRef = useRef<string>('');
  const frameCountRef = useRef<number>(0);
  const lastHandRef = useRef<HandResults>(null);
  const lastFaceRef = useRef<FaceResults>(null);
  const recordingRef = useRef<ActiveRecording | null>(null);

  const animFrameIdRef = useRef<number | null>(null);

  // Two-person mode needs more faces and hands from the trackers
  useEffect(() => {
    faceTrackerRef.current.setMaxFaces(settings.twoPlayer ? 2 : 1);
    handTrackerRef.current.setMaxHands(settings.twoPlayer ? 4 : 2);
  }, [settings.twoPlayer]);

  // Lighter rendering for phones
  useEffect(() => {
    hookah3DSceneRef.current?.setLite(settings.lite);
  }, [settings.lite]);

  useEffect(() => {
    let isMounted = true;

    async function initAR() {
      try {
        // Start downloading the AI models straight away, in parallel with the camera prompt
        setLoadingStep('Loading AI Vision models (Hand & Face)...');
        const modelsReady = Promise.all([
          handTrackerRef.current.initialize(),
          faceTrackerRef.current.initialize()
        ]);

        setLoadingStep('Accessing webcam feed...');
        if (videoRef.current) {
          activeFacingRef.current = facingRef.current;
          const success = await webcamServiceRef.current.initialize(videoRef.current, facingRef.current);
          if (!success) throw new Error('Webcam initialization failed');
          onCameraStarted();
        }

        if (!isMounted) return;

        setLoadingStep('Initializing 3D Engine...');
        if (webglCanvasRef.current) {
          webglCanvasRef.current.width = window.innerWidth;
          webglCanvasRef.current.height = window.innerHeight;
          try {
            hookah3DSceneRef.current = new Hookah3DScene(webglCanvasRef.current);
            hookah3DSceneRef.current.setLite(settingsRef.current.lite);
          } catch (e) {
            console.warn('3D WebGL scene initialization failed, using 2D high-res fallback:', e);
          }
        }

        setLoadingStep('Finishing AI Vision models...');
        await modelsReady;

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

    const recordingAtMount = recordingRef;

    return () => {
      isMounted = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      const rec = recordingAtMount.current;
      if (rec) {
        window.clearInterval(rec.timer);
        rec.recorder.onstop = null;
        if (rec.recorder.state !== 'inactive') rec.recorder.stop();
        recordingAtMount.current = null;
      }
      if (hookah3DSceneRef.current) {
        hookah3DSceneRef.current.destroy();
      }
      webcamServiceRef.current.stop();
    };
  }, []);

  // Switch between the front and back camera
  useEffect(() => {
    facingRef.current = facing;
    if (activeFacingRef.current === null || activeFacingRef.current === facing) return;
    const video = videoRef.current;
    if (!video) return;
    activeFacingRef.current = facing;
    lastHandRef.current = null;
    lastFaceRef.current = null;
    webcamServiceRef.current
      .initialize(video, facing)
      .then(() => onCameraStarted())
      .catch((err) => {
        console.error('Camera switch failed:', err);
        setErrorMsg(err?.message || 'Could not switch camera');
      });
  }, [facing]);

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

  /** Draw camera feed + 3D hookah + 2D overlay into one canvas (screenshots and recordings). */
  const drawComposite = (ctx: CanvasRenderingContext2D, outW: number, outH: number, pixelRatio: number): boolean => {
    const video = videoRef.current;
    const webgl = webglCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!video || !webgl || !overlay || !webcamServiceRef.current.isReady()) return false;

    // Camera feed, mirrored (front camera only) and cropped exactly like the on-screen <video>
    const vp = getCoverViewport(video, outW, outH);
    ctx.save();
    if (facingRef.current === 'user') {
      ctx.translate(outW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, vp.offsetX, vp.offsetY, vp.width, vp.height);
    ctx.restore();

    ctx.drawImage(webgl, 0, 0, outW, outH);
    ctx.drawImage(overlay, 0, 0, outW, outH);

    // Small credit in the corner
    ctx.save();
    ctx.font = `600 ${Math.round(13 * pixelRatio)}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 4 * pixelRatio;
    ctx.fillText('Hookah Bar AR · @abheepvtt___', outW - 14 * pixelRatio, outH - 14 * pixelRatio);
    ctx.restore();
    return true;
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const fileStamp = () => new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);

  // Screenshot
  useEffect(() => {
    if (screenshotRequest === 0) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const outW = Math.round(window.innerWidth * ratio);
    const outH = Math.round(window.innerHeight * ratio);
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext('2d');
    if (!ctx || !drawComposite(ctx, outW, outH, ratio)) return;

    audioRef.current.playShutter();
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);

    out.toBlob((blob) => {
      if (blob) downloadBlob(blob, `hookah-ar-${fileStamp()}.png`);
    }, 'image/png');
  }, [screenshotRequest]);

  // Video clip recording (toggle)
  const stopRecording = () => {
    const rec = recordingRef.current;
    if (rec && rec.recorder.state !== 'inactive') rec.recorder.stop();
  };

  const startRecording = () => {
    if (recordingRef.current) return;
    if (typeof MediaRecorder === 'undefined') {
      console.warn('Video recording is not supported in this browser.');
      return;
    }
    if (!webcamServiceRef.current.isReady()) return;

    // Record at a capped size so phones keep up
    const maxSide = settingsRef.current.lite ? 720 : 1280;
    const scale = Math.min(1, maxSide / Math.max(window.innerWidth, window.innerHeight));
    const w = Math.max(2, Math.round((window.innerWidth * scale) / 2) * 2);
    const h = Math.max(2, Math.round((window.innerHeight * scale) / 2) * 2);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawComposite(ctx, w, h, scale);

    const stream = canvas.captureStream(30);
    audioRef.current.getRecordingStream()?.getAudioTracks().forEach((t) => stream.addTrack(t));

    const mimeType = pickRecordingMime();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: settingsRef.current.lite ? 2_500_000 : 4_000_000
      });
    } catch (e) {
      console.warn('Could not start recording:', e);
      return;
    }

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    let seconds = 0;
    const timer = window.setInterval(() => {
      seconds += 1;
      onRecordingChange(true, seconds);
      if (seconds >= MAX_RECORDING_SECONDS) stopRecording();
    }, 1000);

    recorder.onstop = () => {
      window.clearInterval(timer);
      recordingRef.current = null;
      onRecordingChange(false, 0);
      const type = recorder.mimeType || mimeType || 'video/webm';
      const blob = new Blob(chunks, { type });
      if (blob.size > 0) {
        downloadBlob(blob, `hookah-ar-${fileStamp()}.${type.includes('mp4') ? 'mp4' : 'webm'}`);
      }
    };

    recordingRef.current = { recorder, canvas, ctx, timer };
    recorder.start(1000);
    onRecordingChange(true, 0);
  };

  useEffect(() => {
    if (recordRequest === 0) return;
    if (recordingRef.current) stopRecording();
    else startRecording();
  }, [recordRequest]);

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

      // Resize only when the window actually changes (renderer.setSize handles pixel ratio itself)
      const sizeKey = `${width}x${height}`;
      if (lastSizeRef.current !== sizeKey) {
        lastSizeRef.current = sizeKey;
        if (hookah3DSceneRef.current) {
          hookah3DSceneRef.current.resize(width, height);
        } else if (webglCanvas) {
          webglCanvas.width = width;
          webglCanvas.height = height;
        }
        if (overlayCanvas) {
          overlayCanvas.width = width;
          overlayCanvas.height = height;
        }
      }

      if (video && webcamServiceRef.current.isReady()) {
        const timestampMs = performance.now();
        const s = settingsRef.current;
        const mirrored = facingRef.current === 'user';
        frameCountRef.current += 1;

        // 1. Run Computer Vision Landmarkers (lite mode: every other frame, reuse the last result)
        if (!s.lite || frameCountRef.current % 2 === 0) {
          lastHandRef.current = handTrackerRef.current.detect(video, timestampMs);
          lastFaceRef.current = faceTrackerRef.current.detect(video, timestampMs);
        }
        const handLandmarks = lastHandRef.current?.landmarks || [];
        const faceLandmarks = lastFaceRef.current?.faceLandmarks || [];

        // The video is cropped to fill the window; map landmarks through the same crop
        const vp = getCoverViewport(video, width, height);
        const vpOffset = { x: vp.offsetX, y: vp.offsetY };

        // 2. Process Pinch & Mouth detection
        const prevPipe = hookahManagerRef.current.getPipePosition();
        const pinchState = gestureDetectorRef.current.detectPinch(
          handLandmarks,
          vp.width,
          vp.height,
          mirrored,
          vpOffset,
          // With two people, the hose goes to whichever grabbing hand is closest to it
          s.twoPlayer ? { x: prevPipe.x, y: prevPipe.y } : null
        );

        const mouths = mouthDetectorRef.current
          .detectMouths(faceLandmarks, vp.width, vp.height, mirrored, vpOffset)
          .filter((m): m is MouthState => m !== null);
        // Active person = the one the hose is closest to (only one person in single-player)
        const mouthState: MouthState | null = s.twoPlayer
          ? nearestTo(mouths, { x: prevPipe.x, y: prevPipe.y }, (m) => m.center)
          : (mouths[0] ?? null);

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

        const scene3D = hookah3DSceneRef.current;
        const basePos = hookahManagerRef.current.getBasePosition();
        const pipePos = hookahManagerRef.current.getPipePosition();

        // 4. Face anchors (eyes, forehead, nostrils) for face-attached effects
        const allFaces = faceAnchorRef.current.detectAll(faceLandmarks, vp.width, vp.height, mirrored, vpOffset);
        const activeFace = mouthState ? nearestTo(allFaces, mouthState.center, (f) => f.center) : null;

        // 5. Charcoal: the free hand fans (open palm) or refreshes (pinch) the coal
        const coalPos = scene3D ? scene3D.getCoalScreenPosition() : { x: basePos.x, y: basePos.y - 280 };
        const coal = coalManagerRef.current.update(
          handLandmarks,
          pipePos.isHeld,
          pinchState ? pinchState.pinchCenter : null,
          coalPos,
          vp,
          height,
          mirrored
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
          slowMotion: s.slowMotion,
          lite: s.lite
        });

        if (shouldEmitVapour) {
          const faceW = mouthState ? mouthState.width * 3.5 : 160;
          const sources: SmokeSource[] = [];
          if (s.exhaleSource !== 'nose' || !activeFace) {
            sources.push({ x: vapourEmitterPos.x, y: vapourEmitterPos.y });
          }
          if (activeFace && s.exhaleSource !== 'mouth') {
            sources.push({ ...activeFace.noseLeft, scale: 0.5 }, { ...activeFace.noseRight, scale: 0.5 });
          }
          particleSystemRef.current.emit(sources, faceW);
        }

        // Update particle physics
        particleSystemRef.current.update();

        // 7. RENDER 3D HOOKAH SCENE
        if (scene3D) {
          scene3D.update(basePos, pipePos, appState, timestampMs);
        }

        // 8. RENDER 2D OVERLAY (Particles, Backup Hookah, Debug Landmarks)
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

            // Face-attached accessory (glasses, crown, ...) on every detected face
            for (const face of allFaces) {
              drawFaceEffect(ctx, s.faceEffect, face, timestampMs);
            }

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

        // 9. Feed the video recorder, if a clip is being recorded
        const rec = recordingRef.current;
        if (rec) drawComposite(rec.ctx, rec.canvas.width, rec.canvas.height, rec.canvas.width / width);
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
          // Mirror the front camera like a selfie; the back camera is shown as-is
          transform: facing === 'user' ? 'scaleX(-1)' : 'none'
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
