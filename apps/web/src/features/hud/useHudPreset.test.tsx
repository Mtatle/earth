import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useHudPreset } from './useHudPreset';

describe('useHudPreset', () => {
  it('initializes from provided preset id and switches presets', () => {
    const { result } = renderHook(() => useHudPreset({ initialPresetId: 'nvg' }));

    expect(result.current.presetId).toBe('nvg');
    expect(result.current.preset.label).toBe('NVG Recon');

    act(() => {
      result.current.setPresetId('flir');
    });

    expect(result.current.presetId).toBe('flir');
    expect(result.current.preset.label).toBe('FLIR Thermal');
  });

  it('applies selected preset to document root when enabled', () => {
    const root = document.createElement('div');

    const { result } = renderHook(() =>
      useHudPreset({
        initialPresetId: 'crt',
        applyToDocument: true,
        root
      })
    );

    expect(root.dataset.hudPreset).toBe('crt');

    act(() => {
      result.current.setPresetId('nvg');
    });

    expect(root.dataset.hudPreset).toBe('nvg');
    expect(root.style.getPropertyValue('--hud-accent')).toBe('#74e487');
  });
});
