import { describe, expect, it } from 'vitest';
import { applyHudPresetToDocument, buildHudMetrics, buildHudStatusItems } from './model';

describe('hud model helpers', () => {
  it('builds status and metric rows from summary inputs', () => {
    const statusItems = buildHudStatusItems({
      streamStatus: 'live',
      layerCount: 3,
      entityCount: 48,
      selectedEntityId: 'flight-AAL123',
      lastUpdatedLabel: '2s ago'
    });

    expect(statusItems).toEqual([
      { id: 'stream', label: 'Stream', value: 'live', tone: 'live' },
      { id: 'last-updated', label: 'Last Update', value: '2s ago', tone: 'neutral' },
      { id: 'selection', label: 'Selection', value: 'flight-AAL123', tone: 'live' }
    ]);

    const metrics = buildHudMetrics({
      streamStatus: 'stale',
      layerCount: 2,
      entityCount: 12
    });

    expect(metrics).toEqual([
      { id: 'active-layers', label: 'Active Layers', value: '2' },
      { id: 'tracked-entities', label: 'Tracked Entities', value: '12' }
    ]);
  });

  it('applies preset variables and data attributes to document root', () => {
    const root = document.createElement('div');

    const preset = applyHudPresetToDocument('flir', { root });

    expect(preset.id).toBe('flir');
    expect(root.dataset.hudPreset).toBe('flir');
    expect(root.style.getPropertyValue('--hud-accent')).toBe('#ff9b4a');
    expect(root.style.getPropertyValue('--hud-bg')).toBe('#13080a');
  });
});
