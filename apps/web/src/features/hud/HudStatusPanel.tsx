import type { HudMetricItem, HudStatusItem } from './types';

export type HudStatusPanelProps = {
  title?: string;
  statusItems: HudStatusItem[];
  metrics?: HudMetricItem[];
};

export function HudStatusPanel({ title = 'System Status', statusItems, metrics = [] }: HudStatusPanelProps) {
  return (
    <section className="hud-card hud-status-panel" aria-label="HUD system status">
      <div className="hud-card-header">
        <p className="kicker">Telemetry</p>
        <h3>{title}</h3>
      </div>

      <ul className="hud-status-list">
        {statusItems.map((item) => (
          <li key={item.id} className={`hud-status-item tone-${item.tone}`}>
            <span className="hud-status-label">{item.label}</span>
            <span className="hud-status-value">{item.value}</span>
          </li>
        ))}
      </ul>

      {metrics.length > 0 ? (
        <ul className="hud-metric-grid" aria-label="HUD metrics">
          {metrics.map((metric) => (
            <li key={metric.id} className="hud-metric-card">
              <span className="hud-metric-label">{metric.label}</span>
              <span className="hud-metric-value">{metric.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
