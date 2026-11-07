import React, { useState } from 'react';
import { Camera, Flame, Settings, Volume2, VolumeX, X } from 'lucide-react';
import type { ARSettings, ExhaleSource, FaceEffect, SmokeColor, SmokeStyle } from '../types/settings';

interface SettingsPanelProps {
  settings: ARSettings;
  onChange: (settings: ARSettings) => void;
  coalHeat: number;
  onScreenshot: () => void;
}

const SMOKE_STYLES: Array<{ value: SmokeStyle; label: string }> = [
  { value: 'classic', label: 'Clouds' },
  { value: 'rings', label: 'Rings' },
  { value: 'mix', label: 'Both' }
];

const SMOKE_COLORS: Array<{ value: SmokeColor; label: string; swatch: string }> = [
  { value: 'white', label: 'White', swatch: '#f5f8ff' },
  { value: 'mint', label: 'Mint', swatch: '#6fe3b5' },
  { value: 'berry', label: 'Berry', swatch: '#f0649f' },
  { value: 'blue', label: 'Blue', swatch: '#64a0fa' },
  { value: 'gold', label: 'Gold', swatch: '#fabe5a' },
  { value: 'violet', label: 'Violet', swatch: '#aa6ef5' }
];

const EXHALE_SOURCES: Array<{ value: ExhaleSource; label: string }> = [
  { value: 'mouth', label: 'Mouth' },
  { value: 'nose', label: 'Nose' },
  { value: 'both', label: 'Both' }
];

const FACE_EFFECTS: Array<{ value: FaceEffect; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'sunglasses', label: '🕶️ Shades' },
  { value: 'crown', label: '👑 Crown' },
  { value: 'partyHat', label: '🎉 Party hat' },
  { value: 'halo', label: '😇 Halo' }
];

const card: React.CSSProperties = {
  backgroundColor: 'rgba(10, 10, 15, 0.82)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 16
};

const sectionTitle: React.CSSProperties = {
  color: '#9e9e9e',
  fontSize: '0.68rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  margin: '14px 0 6px'
};

function chip(active: boolean): React.CSSProperties {
  return {
    padding: '5px 10px',
    borderRadius: 14,
    fontSize: '0.74rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: `1px solid ${active ? '#e91e63' : 'rgba(255, 255, 255, 0.15)'}`,
    backgroundColor: active ? 'rgba(233, 30, 99, 0.28)' : 'rgba(255, 255, 255, 0.05)',
    color: active ? '#ff80ab' : '#e0e0e0'
  };
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onChange, coalHeat, onScreenshot }) => {
  const [open, setOpen] = useState<boolean>(() => window.innerWidth >= 900);
  const update = (patch: Partial<ARSettings>) => onChange({ ...settings, ...patch });
  const heatPct = Math.round(coalHeat * 100);
  const heatColor = coalHeat > 0.75 ? '#ffb02e' : coalHeat > 0.45 ? '#ff7a1a' : '#c62828';

  return (
    <div
      style={{
        position: 'absolute',
        top: 64,
        right: 16,
        zIndex: 22,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        pointerEvents: 'none'
      }}
    >
      <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
        <div
          style={{
            ...card,
            borderRadius: 16,
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: heatColor,
            fontSize: '0.75rem',
            fontWeight: 700
          }}
          title="Coal heat — fan it with an open palm, pinch to add a fresh coal"
        >
          <Flame size={14} />
          {heatPct}%
        </div>
        <button
          onClick={onScreenshot}
          title="Save a screenshot"
          aria-label="Save a screenshot"
          style={{ ...card, borderRadius: 16, padding: '6px 10px', display: 'flex', alignItems: 'center', color: '#e0e0e0', cursor: 'pointer' }}
        >
          <Camera size={15} />
        </button>
        <button
          onClick={() => update({ sound: !settings.sound })}
          title={settings.sound ? 'Mute sound' : 'Turn sound on'}
          aria-label={settings.sound ? 'Mute sound' : 'Turn sound on'}
          style={{ ...card, borderRadius: 16, padding: '6px 10px', display: 'flex', alignItems: 'center', color: settings.sound ? '#e0e0e0' : '#757575', cursor: 'pointer' }}
        >
          {settings.sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{ ...card, borderRadius: 16, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, color: '#e0e0e0', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
        >
          {open ? <X size={14} /> : <Settings size={14} />}
          <span>{open ? 'Close' : 'Options'}</span>
        </button>
      </div>

      {open && (
        <div
          style={{
            ...card,
            width: 'min(270px, calc(100vw - 32px))',
            maxHeight: 'calc(100vh - 150px)',
            overflowY: 'auto',
            padding: '4px 14px 14px',
            color: '#e0e0e0',
            pointerEvents: 'auto'
          }}
        >
          <div style={sectionTitle}>Smoke style</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SMOKE_STYLES.map((o) => (
              <button key={o.value} style={chip(settings.smokeStyle === o.value)} onClick={() => update({ smokeStyle: o.value })}>
                {o.label}
              </button>
            ))}
          </div>

          <div style={sectionTitle}>Smoke colour</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SMOKE_COLORS.map((o) => (
              <button
                key={o.value}
                title={o.label}
                aria-label={o.label}
                onClick={() => update({ smokeColor: o.value })}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  cursor: 'pointer',
                  backgroundColor: o.swatch,
                  border: settings.smokeColor === o.value ? '2px solid #fff' : '2px solid rgba(255,255,255,0.15)',
                  boxShadow: settings.smokeColor === o.value ? `0 0 10px ${o.swatch}` : 'none'
                }}
              />
            ))}
          </div>

          <div style={sectionTitle}>Density · {settings.smokeDensity.toFixed(1)}×</div>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={settings.smokeDensity}
            onChange={(e) => update({ smokeDensity: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#e91e63' }}
          />

          <div style={sectionTitle}>Exhale from</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {EXHALE_SOURCES.map((o) => (
              <button key={o.value} style={chip(settings.exhaleSource === o.value)} onClick={() => update({ exhaleSource: o.value })}>
                {o.label}
              </button>
            ))}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: '0.78rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.slowMotion}
              onChange={(e) => update({ slowMotion: e.target.checked })}
              style={{ accentColor: '#e91e63' }}
            />
            Slow-motion smoke
          </label>

          <div style={sectionTitle}>Face effect</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FACE_EFFECTS.map((o) => (
              <button key={o.value} style={chip(settings.faceEffect === o.value)} onClick={() => update({ faceEffect: o.value })}>
                {o.label}
              </button>
            ))}
          </div>

          <div style={sectionTitle}>Charcoal · {heatPct}%</div>
          <div style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div style={{ width: `${heatPct}%`, height: '100%', backgroundColor: heatColor, transition: 'width 0.15s' }} />
          </div>
          <p style={{ margin: '8px 0 0', color: '#9e9e9e', fontSize: '0.72rem', lineHeight: 1.45 }}>
            Hold the hose with one hand. With your <b style={{ color: '#e0e0e0' }}>other hand</b>, hover an open palm over the
            coal to fan it, or pinch near it to add a fresh coal. Hotter coal = thicker smoke.
          </p>
        </div>
      )}
    </div>
  );
};
