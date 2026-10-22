export type SmokeStyle = 'classic' | 'rings' | 'mix';
export type SmokeColor = 'white' | 'mint' | 'berry' | 'blue' | 'gold' | 'violet';
export type ExhaleSource = 'mouth' | 'nose' | 'both';
export type FaceEffect = 'none' | 'sunglasses' | 'crown' | 'partyHat' | 'halo';

export interface ARSettings {
  smokeStyle: SmokeStyle;
  smokeColor: SmokeColor;
  smokeDensity: number; // 0.5 .. 2
  exhaleSource: ExhaleSource;
  slowMotion: boolean;
  faceEffect: FaceEffect;
  sound: boolean;
}

export const DEFAULT_SETTINGS: ARSettings = {
  sound: true,
  smokeStyle: 'classic',
  smokeColor: 'white',
  smokeDensity: 1,
  exhaleSource: 'mouth',
  slowMotion: false,
  faceEffect: 'none'
};

const STORAGE_KEY = 'hookah-ar-settings';

export function loadSettings(): ARSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: ARSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable (private mode etc.) - settings just won't persist
  }
}
