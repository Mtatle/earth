import { getHudPresetById, streamStatusToHudTone } from './presets';
import type { HudMetricItem, HudPreset, HudPresetId, HudStatusItem } from './types';

export type HudSummaryInput = {
  streamStatus: string;
  layerCount: number;
  entityCount: number;
  selectedEntityId?: string | null;
  lastUpdatedLabel?: string;
};

export function buildHudStatusItems(input: HudSummaryInput): HudStatusItem[] {
  return [
    {
      id: 'stream',
      label: 'Stream',
      value: input.streamStatus,
      tone: streamStatusToHudTone(input.streamStatus)
    },
    {
      id: 'last-updated',
      label: 'Last Update',
      value: input.lastUpdatedLabel ?? 'unknown',
      tone: 'neutral'
    },
    {
      id: 'selection',
      label: 'Selection',
      value: input.selectedEntityId ?? 'none',
      tone: input.selectedEntityId ? 'live' : 'neutral'
    }
  ];
}

export function buildHudMetrics(input: HudSummaryInput): HudMetricItem[] {
  return [
    {
      id: 'active-layers',
      label: 'Active Layers',
      value: String(Math.max(0, input.layerCount))
    },
    {
      id: 'tracked-entities',
      label: 'Tracked Entities',
      value: String(Math.max(0, input.entityCount))
    }
  ];
}

export function applyHudPresetToDocument(
  presetId: HudPresetId,
  options: {
    root?: HTMLElement;
  } = {}
): HudPreset {
  const preset = getHudPresetById(presetId);
  const root = options.root ?? document.documentElement;

  root.dataset.hudPreset = preset.id;
  root.style.setProperty('--hud-bg', preset.vars.bg);
  root.style.setProperty('--hud-surface', preset.vars.surface);
  root.style.setProperty('--hud-border', preset.vars.border);
  root.style.setProperty('--hud-accent', preset.vars.accent);
  root.style.setProperty('--hud-text', preset.vars.text);
  root.style.setProperty('--hud-muted', preset.vars.muted);
  root.style.setProperty('--hud-glow', preset.vars.glow);

  return preset;
}
