import type { EarthEntity, StreamEvent } from '@earthly/shared';

export type FollowMode = 'off' | 'follow';

export type EntityId = EarthEntity['entity_id'];

export type EntityMap = Record<EntityId, EarthEntity>;

export type EntityInteractionState = {
  entities: EntityMap;
  entityIds: EntityId[];
  selectedEntityId: EntityId | null;
  followMode: FollowMode;
};

export type EntityInteractionAction =
  | {
      type: 'apply_stream_event';
      event: StreamEvent;
    }
  | {
      type: 'select_entity';
      entityId: EntityId | null;
    }
  | {
      type: 'select_pick';
      pick: unknown;
    }
  | {
      type: 'clear_selection';
    }
  | {
      type: 'toggle_follow';
    }
  | {
      type: 'set_follow';
      followMode: FollowMode;
    };

export type EntityDetailField = {
  label: string;
  value: string;
  monospace?: boolean;
};

export type EntityDetailsViewModel = {
  title: string;
  subtitle: string;
  fields: EntityDetailField[];
  metadataFields: EntityDetailField[];
};
