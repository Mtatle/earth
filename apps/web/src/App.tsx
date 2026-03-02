import { EntityDetailsDrawer, useEntityInteraction } from './features/entity';
import { formatUpdatedAt, useLayerManager } from './features/layer-manager';
import { CesiumGlobe } from './scene/CesiumGlobe';

export function App() {
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
  const { layerView, streamStatus, lastHeartbeatAt, activeLayerCount, visibleEntityCount, toggleLayer } =
    useLayerManager({
      onStreamEvent: applyStreamEvent
    });
  const recentEntityIds = entityIds.slice(0, 14);

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="kicker">Earthly v0.1</p>
          <h1>Geospatial Operations Surface</h1>
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
        </aside>

        <section className="viewport" aria-label="3D globe viewport">
          <div className="viewport-summary">
            <p>
              {activeLayerCount} layers active · {visibleEntityCount} entities visible
            </p>
            <p>Camera presets provide smooth global-to-regional transitions.</p>
          </div>
          <CesiumGlobe />
        </section>

        <aside className="panel entity-panel">
          <h2>Entity</h2>
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
