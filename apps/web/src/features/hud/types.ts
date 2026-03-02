export type HudPresetId = 'crt' | 'nvg' | 'flir';

export type HudTone = 'live' | 'stale' | 'error' | 'neutral';

export type HudPreset = {
  id: HudPresetId;
  label: string;
  description: string;
  tagline: string;
  vars: {
    bg: string;
    surface: string;
    border: string;
    accent: string;
    text: string;
    muted: string;
    glow: string;
  };
};

export type HudStatusItem = {
  id: string;
  label: string;
  value: string;
  tone: HudTone;
};

export type HudMetricItem = {
  id: string;
  label: string;
  value: string;
};
