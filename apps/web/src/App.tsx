import { useMemo, useState } from 'react';
import { EntityDetailsDrawer, useEntityInteraction } from './features/entity';
import {
  buildHudMetrics,
  buildHudStatusItems,
  HudPresetSelector,
  HudStateNotice,
  HudStatusPanel,
  useHudPreset,
  type HudNoticeMode,
  type HudPresetId
} from './features/hud';
import { formatUpdatedAt, useLayerManager } from './features/layer-manager';
import { createScenePresetStore, type HudStyleMode, type ScenePreset } from './features/scene-presets';
import { createSceneSettingsStore, QUALITY_PROFILES, type QualityProfile, type SceneSettingsState } from './features/scene-settings';
import { CesiumGlobe } from './scene/CesiumGlobe';

const LAYER_IDS = ['satellites', 'flights', 'earthquakes'] as const;
const QUALITY_PROFILE_LABELS: Record<QualityProfile, string> = {
  performance: 'Performance',
  balanced: 'Balanced',
  premium: 'Premium'
};

function toHudStyleMode(presetId: HudPresetId): HudStyleMode {
  if (presetId === 'nvg') {
    return 'nvg';
  }

  if (presetId === 'flir') {
    return 'thermal';
  }

  return 'default';
}

function toHudPresetId(styleMode: HudStyleMode): HudPresetId {
  if (styleMode === 'nvg') {
    return 'nvg';
  }

  if (styleMode === 'thermal') {
    return 'flir';
  }

  return 'crt';
}

function countEnabledLayers(preset: ScenePreset): number {
  let count = 0;
  for (const layerId of LAYER_IDS) {
    if (preset.state.layers[layerId]) {
      count += 1;
    }
  }
  return count;
}

export function App() {
  const scenePresetStore = useMemo(() => createScenePresetStore(), []);
  const sceneSettingsStore = useMemo(() => createSceneSettingsStore(), []);
  const [scenePresets, setScenePresets] = useState<ScenePreset[]>(() => scenePresetStore.list());
  const [sceneSettings, setSceneSettings] = useState<SceneSettingsState>(() => sceneSettingsStore.getState());
  const { presetId, preset, setPresetId } = useHudPreset({ applyToDocument: true });
  const {
    entities,
    entityIds,
    selectedEntity,
    selectedEntityId,
    followMode,
    applyStreamEvent,
    selectEntity,
    clearSelection,
    toggleFollow
  } = useEntityInteraction();
  const { layerToggles, layerView, streamStatus, lastHeartbeatAt, activeLayerCount, visibleEntityCount, toggleLayer } =
    useLayerManager({
      onStreamEvent: applyStreamEvent
    });
  const recentEntityIds = entityIds.slice(0, 14);
  const hudStatusItems = useMemo(
    () =>
      buildHudStatusItems({
        streamStatus,
        layerCount: activeLayerCount,
        entityCount: visibleEntityCount,
        selectedEntityId,
        lastUpdatedLabel: formatUpdatedAt(lastHeartbeatAt)
      }),
    [activeLayerCount, lastHeartbeatAt, selectedEntityId, streamStatus, visibleEntityCount]
  );
  const hudMetrics = useMemo(
    () =>
      buildHudMetrics({
        streamStatus,
        layerCount: activeLayerCount,
        entityCount: visibleEntityCount
      }),
    [activeLayerCount, streamStatus, visibleEntityCount]
  );

  const hudNoticeMode: HudNoticeMode | null = useMemo(() => {
    if (streamStatus === 'error') {
      return 'error';
    }
    if (streamStatus === 'connecting') {
      return 'loading';
    }
    if (visibleEntityCount === 0) {
      return 'empty';
    }
    return null;
  }, [streamStatus, visibleEntityCount]);

  const saveScenePreset = () => {
    scenePresetStore.create({
      name: `Preset ${scenePresets.length + 1}`,
      state: {
        layers: layerToggles,
        styleMode: toHudStyleMode(presetId)
      }
    });

    setScenePresets(scenePresetStore.list());
  };

  const applyScenePreset = (presetToApply: ScenePreset) => {
    for (const layerId of LAYER_IDS) {
      if (layerToggles[layerId] !== presetToApply.state.layers[layerId]) {
        toggleLayer(layerId);
      }
    }

    setPresetId(toHudPresetId(presetToApply.state.styleMode));
  };

  const patchSceneSettings = (patch: Partial<SceneSettingsState>) => {
    setSceneSettings(sceneSettingsStore.patch(patch));
  };

  const resetSceneSettings = () => {
    setSceneSettings(sceneSettingsStore.reset());
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="kicker">Earthly v0.1</p>
          <h1>Geospatial Operations Surface</h1>
          <p className="kicker">HUD {preset.label}</p>
        </div>
        <span className={`status status-${streamStatus}`}>Stream {streamStatus}</span>
      </header>

      <main className="content">
        <aside className="panel">
          <h2>Layers</h2>
          <ul className="layer-list">
            {layerView.map((layer) => (
              <li key={layer.id} className="layer-row">
                <button
                  type="button"
                  aria-pressed={layer.enabled}
                  className={`layer-toggle ${layer.enabled ? 'is-on' : 'is-off'}`}
                  onClick={() => toggleLayer(layer.id)}
                >
                  <span>{layer.label}</span>
                  <span>{layer.enabled ? 'On' : 'Off'}</span>
                </button>
                <div className="layer-meta">
                  <span className={`layer-badge badge-${layer.status}`}>{layer.status}</span>
                  <span className="layer-count">{layer.count} tracked</span>
                </div>
                <p className="layer-source">Source: {layer.source}</p>
                <p className="layer-updated">Updated: {layer.enabled ? formatUpdatedAt(lastHeartbeatAt) : 'disabled'}</p>
              </li>
            ))}
          </ul>

          <HudPresetSelector activePresetId={presetId} onSelectPreset={setPresetId} />

          <section className="hud-card" aria-label="Scene runtime settings">
            <div className="hud-card-header">
              <p className="kicker">Scene Runtime</p>
              <h3>3D Fidelity</h3>
            </div>
            <div className="scene-settings-grid" role="group" aria-label="Scene runtime toggles">
              <label className="scene-setting-row">
                <input
                  type="checkbox"
                  checked={sceneSettings.terrainEnabled}
                  onChange={(event) => patchSceneSettings({ terrainEnabled: event.target.checked })}
                />
                <span>Terrain</span>
              </label>
              <label className="scene-setting-row">
                <input
                  type="checkbox"
                  checked={sceneSettings.buildingsEnabled}
                  onChange={(event) => patchSceneSettings({ buildingsEnabled: event.target.checked })}
                />
                <span>Buildings</span>
              </label>
              <label className="scene-setting-row">
                <input
                  type="checkbox"
                  checked={sceneSettings.atmosphereEnabled}
                  onChange={(event) => patchSceneSettings({ atmosphereEnabled: event.target.checked })}
                />
                <span>Atmosphere</span>
              </label>
              <label className="scene-setting-row">
                <input
                  type="checkbox"
                  checked={sceneSettings.fogEnabled}
                  onChange={(event) => patchSceneSettings({ fogEnabled: event.target.checked })}
                />
                <span>Fog</span>
              </label>
            </div>
            <label className="scene-setting-select">
              <span className="scene-setting-label">Quality Profile</span>
              <select
                value={sceneSettings.qualityProfile}
                onChange={(event) => patchSceneSettings({ qualityProfile: event.target.value as QualityProfile })}
              >
                {QUALITY_PROFILES.map((profile) => (
                  <option key={profile} value={profile}>
                    {QUALITY_PROFILE_LABELS[profile]}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="hud-preset-button" onClick={resetSceneSettings}>
              <span className="hud-preset-title">Reset Scene Runtime</span>
              <span className="hud-preset-description">Restore default terrain, atmosphere, and quality settings.</span>
            </button>
          </section>

          <section className="hud-card" aria-label="Scene presets">
            <div className="hud-card-header">
              <p className="kicker">Scene</p>
              <h3>Saved Presets</h3>
            </div>
            <button type="button" className="hud-preset-button" onClick={saveScenePreset}>
              <span className="hud-preset-title">Save Current Scene</span>
              <span className="hud-preset-description">Capture current layer visibility and HUD style.</span>
            </button>
            {scenePresets.length > 0 ? (
              <div className="hud-preset-grid" role="list" aria-label="Saved scene presets">
                {scenePresets.slice(0, 6).map((scenePreset) => (
                  <button
                    key={scenePreset.id}
                    type="button"
                    className="hud-preset-button"
                    onClick={() => applyScenePreset(scenePreset)}
                  >
                    <span className="hud-preset-title">{scenePreset.name}</span>
                    <span className="hud-preset-tagline">{scenePreset.state.styleMode} mode</span>
                    <span className="hud-preset-description">{countEnabledLayers(scenePreset)} layers active</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="entity-empty">No saved presets yet.</p>
            )}
          </section>
        </aside>

        <section className="viewport" aria-label="3D globe viewport">
          <div className="viewport-summary">
            <p>
              {activeLayerCount} layers active · {visibleEntityCount} entities visible
            </p>
            <p>Camera presets provide smooth global-to-regional transitions.</p>
          </div>
          <CesiumGlobe sceneSettings={sceneSettings} />
        </section>

        <aside className="panel entity-panel">
          <h2>Entity</h2>
          <HudStatusPanel title="Operational Readiness" statusItems={hudStatusItems} metrics={hudMetrics} />
          {hudNoticeMode ? <HudStateNotice mode={hudNoticeMode} /> : null}
          <EntityDetailsDrawer
            entity={selectedEntity}
            followMode={followMode}
            onToggleFollow={toggleFollow}
            onClearSelection={clearSelection}
          />

          <div className="entity-list-block">
            <p className="kicker">Live Feed</p>
            {recentEntityIds.length > 0 ? (
              <ul className="entity-select-list" aria-label="Live entities">
                {recentEntityIds.map((entityId) => {
                  const entity = entities[entityId];
                  if (!entity) {
                    return null;
                  }

                  return (
                    <li key={entity.entity_id}>
                      <button
                        type="button"
                        className={`entity-select-button ${selectedEntityId === entity.entity_id ? 'is-selected' : ''}`}
                        onClick={() => selectEntity(entity.entity_id)}
                      >
                        <span className="entity-select-type">{entity.entity_type}</span>
                        <span className="entity-select-id">{entity.entity_id}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="entity-empty">Waiting for stream entities...</p>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
