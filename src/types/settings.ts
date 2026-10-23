export type SmokeStyle = 'classic' | 'rings' | 'mix';
export type SmokeColor = 'white' | 'mint' | 'berry' | 'blue' | 'gold' | 'violet';
export type ExhaleSource = 'mouth' | 'nose' | 'both';
export type FaceEffect = 'none' | 'sunglasses' | 'crown' | 'partyHat' | 'halo';
export type CameraFacing = 'user' | 'environment';

export interface ARSettings {
  smokeStyle: SmokeStyle;
  smokeColor: SmokeColor;
  smokeDensity: number; // 0.5 .. 2
  exhaleSource: ExhaleSource;
  slowMotion: boolean;
  faceEffect: FaceEffect;
  sound: boolean;
  twoPlayer: boolean; // track two people and pass the hose between them
  lite: boolean; // lighter rendering for phones / slower devices
}

export const DEFAULT_SETTINGS: ARSettings = {
  sound: true,
  smokeStyle: 'classic',
  smokeColor: 'white',
  smokeDensity: 1,
  exhaleSource: 'mouth',
  slowMotion: false,
  faceEffect: 'none',
  twoPlayer: false,
  lite: false
};

const STORAGE_KEY = 'hookah-ar-settings';

/** Rough check for phones / tablets (touch-first devices). */
export function isLikelyPhone(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 820;
  } catch {
    return false;
  }
}

export function loadSettings(): ARSettings {
  // First visit on a phone starts in lite mode
  const defaults: ARSettings = { ...DEFAULT_SETTINGS, lite: isLikelyPhone() };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: ARSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable (private mode etc.) - settings just won't persist
  }
}
