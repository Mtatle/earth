import type { HudPreset, HudPresetId, HudTone } from './types';

export const DEFAULT_HUD_PRESET_ID: HudPresetId = 'crt';

export const HUD_PRESETS: HudPreset[] = [
  {
    id: 'crt',
    label: 'CRT Tactical',
    description: 'High-contrast blue tactical glass with scanline glow.',
    tagline: 'Command operations baseline',
    vars: {
      bg: '#040a12',
      surface: 'rgba(7, 18, 34, 0.78)',
      border: 'rgba(102, 182, 255, 0.34)',
      accent: '#3bc9db',
      text: '#d9ebff',
      muted: '#8aa8cc',
      glow: 'rgba(59, 201, 219, 0.32)'
    }
  },
  {
    id: 'nvg',
    label: 'NVG Recon',
    description: 'Night-vision green palette tuned for low-light readability.',
    tagline: 'Low-light sensor watch',
    vars: {
      bg: '#050b06',
      surface: 'rgba(13, 26, 16, 0.78)',
      border: 'rgba(116, 228, 135, 0.34)',
      accent: '#74e487',
      text: '#d8f6db',
      muted: '#8cb998',
      glow: 'rgba(116, 228, 135, 0.3)'
    }
  },
  {
    id: 'flir',
    label: 'FLIR Thermal',
    description: 'Amber-forward thermal palette for hotspot triage workflows.',
    tagline: 'Heat anomaly tracking',
    vars: {
      bg: '#13080a',
      surface: 'rgba(38, 14, 20, 0.8)',
      border: 'rgba(255, 169, 92, 0.36)',
      accent: '#ff9b4a',
      text: '#ffe7d1',
      muted: '#d4b394',
      glow: 'rgba(255, 155, 74, 0.33)'
    }
  }
];

const HUD_PRESET_BY_ID: Record<HudPresetId, HudPreset> = HUD_PRESETS.reduce(
  (index, preset) => {
    index[preset.id] = preset;
    return index;
  },
  {} as Record<HudPresetId, HudPreset>
);

export function getHudPresetById(presetId: HudPresetId | null | undefined): HudPreset {
  if (!presetId) {
    return HUD_PRESET_BY_ID[DEFAULT_HUD_PRESET_ID];
  }

  return HUD_PRESET_BY_ID[presetId] ?? HUD_PRESET_BY_ID[DEFAULT_HUD_PRESET_ID];
}

export function isHudPresetId(value: string): value is HudPresetId {
  return value === 'crt' || value === 'nvg' || value === 'flir';
}

export function streamStatusToHudTone(streamStatus: string): HudTone {
  if (streamStatus === 'live') {
    return 'live';
  }

  if (streamStatus === 'error') {
    return 'error';
  }

  if (streamStatus === 'stale' || streamStatus === 'connecting') {
    return 'stale';
  }

  return 'neutral';
}
