import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HUD_PRESET_ID,
  getHudPresetById,
  HUD_PRESETS,
  isHudPresetId,
  streamStatusToHudTone
} from './presets';

describe('hud presets', () => {
  it('returns default preset when id is missing or invalid', () => {
    expect(getHudPresetById(undefined).id).toBe(DEFAULT_HUD_PRESET_ID);
    expect(getHudPresetById(null).id).toBe(DEFAULT_HUD_PRESET_ID);
    expect(getHudPresetById('bad' as never).id).toBe(DEFAULT_HUD_PRESET_ID);
  });

  it('exposes stable preset ids with unique entries', () => {
    const ids = HUD_PRESETS.map((preset) => preset.id);

    expect(ids).toEqual(['crt', 'nvg', 'flir']);
    expect(new Set(ids).size).toBe(ids.length);
    expect(isHudPresetId('crt')).toBe(true);
    expect(isHudPresetId('nvg')).toBe(true);
    expect(isHudPresetId('flir')).toBe(true);
    expect(isHudPresetId('infrared')).toBe(false);
  });

  it('maps stream statuses into HUD tones', () => {
    expect(streamStatusToHudTone('live')).toBe('live');
    expect(streamStatusToHudTone('error')).toBe('error');
    expect(streamStatusToHudTone('stale')).toBe('stale');
    expect(streamStatusToHudTone('connecting')).toBe('stale');
    expect(streamStatusToHudTone('offline')).toBe('neutral');
  });
});
