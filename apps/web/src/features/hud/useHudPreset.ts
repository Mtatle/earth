import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_HUD_PRESET_ID, getHudPresetById } from './presets';
import { applyHudPresetToDocument } from './model';
import type { HudPreset, HudPresetId } from './types';

export type UseHudPresetOptions = {
  initialPresetId?: HudPresetId;
  applyToDocument?: boolean;
  root?: HTMLElement;
};

export type UseHudPresetResult = {
  presetId: HudPresetId;
  preset: HudPreset;
  setPresetId: (presetId: HudPresetId) => void;
};

export function useHudPreset(options: UseHudPresetOptions = {}): UseHudPresetResult {
  const [presetId, setPresetId] = useState<HudPresetId>(options.initialPresetId ?? DEFAULT_HUD_PRESET_ID);

  const preset = useMemo(() => getHudPresetById(presetId), [presetId]);

  useEffect(() => {
    if (!options.applyToDocument) {
      return;
    }

    applyHudPresetToDocument(presetId, {
      root: options.root
    });
  }, [options.applyToDocument, options.root, presetId]);

  return {
    presetId,
    preset,
    setPresetId
  };
}
