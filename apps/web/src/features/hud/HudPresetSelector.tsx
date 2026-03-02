import { HUD_PRESETS } from './presets';
import type { HudPresetId } from './types';

export type HudPresetSelectorProps = {
  activePresetId: HudPresetId;
  onSelectPreset: (presetId: HudPresetId) => void;
};

export function HudPresetSelector({ activePresetId, onSelectPreset }: HudPresetSelectorProps) {
  return (
    <section className="hud-card hud-preset-selector" aria-label="HUD style presets">
      <div className="hud-card-header">
        <p className="kicker">HUD Mode</p>
        <h3>Style Presets</h3>
      </div>

      <div className="hud-preset-grid" role="group" aria-label="HUD preset options">
        {HUD_PRESETS.map((preset) => {
          const isActive = preset.id === activePresetId;

          return (
            <button
              key={preset.id}
              type="button"
              className={`hud-preset-button ${isActive ? 'is-active' : ''}`}
              aria-pressed={isActive}
              onClick={() => onSelectPreset(preset.id)}
            >
              <span className="hud-preset-title">{preset.label}</span>
              <span className="hud-preset-tagline">{preset.tagline}</span>
              <span className="hud-preset-description">{preset.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
