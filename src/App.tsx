import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { DebugHUD } from './components/DebugHUD';
import { SettingsPanel } from './components/SettingsPanel';
import { loadSettings, saveSettings, type ARSettings, type CameraFacing } from './types/settings';
import type { AppState, MouthState, PinchState } from './types/hookah';

// The AR engine (Three.js + MediaPipe) is the bulk of the app: load it as a separate chunk
// so the page shell appears immediately.
const ARCanvas = lazy(() => import('./components/ARCanvas').then((m) => ({ default: m.ARCanvas })));

function EngineLoadingScreen() {
  return (
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
      <h2 style={{ marginTop: 24, fontSize: '1.25rem', fontWeight: 600, letterSpacing: '0.05em' }}>Hookah Bar AR</h2>
      <p style={{ marginTop: 8, color: '#9e9e9e', fontSize: '0.9rem' }}>Loading AR engine...</p>
    </div>
  );
}

export function App() {
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [showLandmarks, setShowLandmarks] = useState<boolean>(false);
  const [pinchState, setPinchState] = useState<PinchState | null>(null);
  const [mouthState, setMouthState] = useState<MouthState | null>(null);
  const [manualSmokeTrigger, setManualSmokeTrigger] = useState<boolean>(false);
  const [settings, setSettings] = useState<ARSettings>(loadSettings);
  const [coalHeat, setCoalHeat] = useState<number>(0.35);
  const [screenshotRequest, setScreenshotRequest] = useState<number>(0);
  const [recordRequest, setRecordRequest] = useState<number>(0);
  const [recording, setRecording] = useState<{ on: boolean; seconds: number }>({ on: false, seconds: 0 });
  const [facing, setFacing] = useState<CameraFacing>('user');
  const [cameraCount, setCameraCount] = useState<number>(0);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Only offer the front/back switch when the device actually has more than one camera
  const refreshCameras = useCallback(() => {
    navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((devices) => setCameraCount(devices.filter((d) => d.kind === 'videoinput').length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshCameras();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshCameras);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refreshCameras);
  }, [refreshCameras]);

  const handleMetricsUpdate = (pinch: PinchState | null, mouth: MouthState | null) => {
    setPinchState(pinch);
    setMouthState(mouth);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', position: 'relative' }}>
      <DebugHUD
        appState={appState}
        showLandmarks={showLandmarks}
        onToggleLandmarks={() => setShowLandmarks((prev) => !prev)}
        onTriggerSmoke={() => setManualSmokeTrigger(true)}
        pinchState={pinchState}
        mouthState={mouthState}
      />
      <SettingsPanel
        settings={settings}
        onChange={setSettings}
        coalHeat={coalHeat}
        onScreenshot={() => setScreenshotRequest((n) => n + 1)}
        recording={recording.on}
        recordingSeconds={recording.seconds}
        onToggleRecording={() => setRecordRequest((n) => n + 1)}
        canSwitchCamera={cameraCount > 1}
        onSwitchCamera={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
      />
      <Suspense fallback={<EngineLoadingScreen />}>
        <ARCanvas
          showLandmarks={showLandmarks}
          settings={settings}
          facing={facing}
          screenshotRequest={screenshotRequest}
          recordRequest={recordRequest}
          onRecordingChange={(on, seconds) => setRecording({ on, seconds })}
          onCameraStarted={refreshCameras}
          onStateChange={setAppState}
          onMetricsUpdate={handleMetricsUpdate}
          onCoalHeatChange={setCoalHeat}
          manualSmokeTrigger={manualSmokeTrigger}
          onManualSmokeTriggered={() => setManualSmokeTrigger(false)}
        />
      </Suspense>

      {/* Creator Attribution Badge */}
      <a
        href="https://instagram.com/abheepvtt___"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(10, 10, 15, 0.78)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '6px 14px',
          borderRadius: 20,
          color: '#e0e0e0',
          fontSize: '0.8rem',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          zIndex: 25,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
          transition: 'all 0.2s ease',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(233, 30, 99, 0.5)';
          e.currentTarget.style.boxShadow = '0 4px 24px rgba(233, 30, 99, 0.3)';
          e.currentTarget.style.transform = 'translateX(-50%) translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.4)';
          e.currentTarget.style.transform = 'translateX(-50%) translateY(0)';
        }}
      >
        <span style={{ color: '#aaa', fontSize: '0.75rem' }}>Created by</span>
        <span style={{ color: '#fff', fontWeight: 600 }}>Abhishek Dombale</span>
        <span style={{ color: 'rgba(255, 255, 255, 0.25)' }}>•</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#f06292' }}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
          </svg>
          <span style={{ fontWeight: 600, fontSize: '0.75rem' }}>@abheepvtt___</span>
        </div>
      </a>

      {/* Privacy-friendly visitor counts (no cookies). Only runs on the deployed site. */}
      {import.meta.env.PROD && <Analytics />}
    </div>
  );
}

export default App;
