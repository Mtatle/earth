import type { EarthEntity } from '@earthly/shared';
import { buildEntityDetails } from './format';
import type { FollowMode } from './types';

export type EntityDetailsDrawerProps = {
  entity: EarthEntity | null;
  followMode: FollowMode;
  onToggleFollow?: () => void;
  onClearSelection?: () => void;
  nowMs?: number;
};

export function EntityDetailsDrawer({
  entity,
  followMode,
  onToggleFollow,
  onClearSelection,
  nowMs = Date.now()
}: EntityDetailsDrawerProps) {
  return (
    <section className="entity-drawer" aria-label="Entity details drawer">
      <header className="entity-drawer-header">
        <h3>Entity Details</h3>
        {entity ? (
          <div className="entity-drawer-actions">
            <button type="button" onClick={onToggleFollow}>
              {followMode === 'follow' ? 'Stop Follow' : 'Start Follow'}
            </button>
            <button type="button" onClick={onClearSelection}>
              Clear Selection
            </button>
          </div>
        ) : null}
      </header>

      {entity ? <EntityDetailsContent entity={entity} nowMs={nowMs} /> : <p>No entity selected.</p>}
    </section>
  );
}

type EntityDetailsContentProps = {
  entity: EarthEntity;
  nowMs: number;
};

function EntityDetailsContent({ entity, nowMs }: EntityDetailsContentProps) {
  const details = buildEntityDetails(entity, nowMs);

  return (
    <div className="entity-drawer-body">
      <p className="entity-drawer-title">{details.title}</p>
      <p className="entity-drawer-subtitle">{details.subtitle}</p>

      <dl className="entity-field-list">
        {details.fields.map((field) => (
          <div key={field.label} className="entity-field-row">
            <dt>{field.label}</dt>
            <dd className={field.monospace ? 'entity-field-monospace' : undefined}>{field.value}</dd>
          </div>
        ))}
      </dl>

      {details.metadataFields.length > 0 ? (
        <div className="entity-metadata-block">
          <h4>Metadata</h4>
          <dl className="entity-field-list">
            {details.metadataFields.map((field) => (
              <div key={field.label} className="entity-field-row">
                <dt>{field.label}</dt>
                <dd className={field.monospace ? 'entity-field-monospace' : undefined}>{field.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
