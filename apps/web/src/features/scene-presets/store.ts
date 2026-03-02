import { DEFAULT_BOOT_CAMERA, sanitizeCameraState } from '../../scene/camera-state';
import { INITIAL_LAYER_TOGGLES } from '../layer-manager/constants';
import type { LayerId, LayerToggles } from '../layer-manager/types';
import type { CameraState } from '../../scene/camera-state';
import {
  DEFAULT_HUD_STYLE_MODE,
  HUD_STYLE_MODES,
  SCENE_PRESET_STORAGE_KEY,
  SCENE_PRESET_STORAGE_VERSION,
  type HudStyleMode,
  type ScenePreset,
  type ScenePresetCreateInput,
  type ScenePresetState,
  type ScenePresetStatePatch,
  type ScenePresetUpdateInput
} from './types';

const LAYER_IDS: LayerId[] = ['satellites', 'flights', 'earthquakes'];
const UNTITLED_PRESET_NAME = 'Untitled Preset';

type PersistedScenePresets = {
  version: number;
  presets: unknown[];
};

type ScenePresetRecord = {
  id?: unknown;
  name?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  state?: unknown;
};

export type ScenePresetStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type ScenePresetStoreOptions = {
  storage?: ScenePresetStorageLike;
  storageKey?: string;
  now?: () => Date;
  createId?: () => string;
};

export type ScenePresetStore = {
  list: () => ScenePreset[];
  getById: (id: string) => ScenePreset | null;
  create: (input: ScenePresetCreateInput) => ScenePreset;
  update: (id: string, input: ScenePresetUpdateInput) => ScenePreset | null;
  remove: (id: string) => boolean;
  replaceAll: (presets: unknown[]) => ScenePreset[];
  clear: () => void;
};

export function createScenePresetStore(options: ScenePresetStoreOptions = {}): ScenePresetStore {
  const storage = options.storage ?? safeBrowserStorage();
  const storageKey = options.storageKey ?? SCENE_PRESET_STORAGE_KEY;
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? defaultIdFactory();

  let presets = readPresets(storage, storageKey, now, createId);

  const persist = () => {
    if (!storage) {
      return;
    }

    const payload: PersistedScenePresets = {
      version: SCENE_PRESET_STORAGE_VERSION,
      presets
    };
    storage.setItem(storageKey, JSON.stringify(payload));
  };

  const list = () => clonePresets(presets);

  const getById = (id: string) => {
    const found = presets.find((preset) => preset.id === id);
    return found ? clonePreset(found) : null;
  };

  const create = (input: ScenePresetCreateInput) => {
    const nowIso = now().toISOString();
    const nextPreset: ScenePreset = {
      id: createId(),
      name: normalizePresetName(input.name),
      createdAt: nowIso,
      updatedAt: nowIso,
      state: normalizePresetState(input.state)
    };

    presets = sortPresets([nextPreset, ...presets]);
    persist();

    return clonePreset(nextPreset);
  };

  const update = (id: string, input: ScenePresetUpdateInput) => {
    const index = presets.findIndex((preset) => preset.id === id);
    if (index < 0) {
      return null;
    }

    const current = presets[index];
    if (!current) {
      return null;
    }

    const nowIso = now().toISOString();
    const updated: ScenePreset = {
      ...current,
      name: input.name === undefined ? current.name : normalizePresetName(input.name),
      updatedAt: nowIso,
      state: normalizePresetState(input.state, current.state)
    };

    presets[index] = updated;
    presets = sortPresets(presets);
    persist();

    return clonePreset(updated);
  };

  const remove = (id: string) => {
    const initialLength = presets.length;
    presets = presets.filter((preset) => preset.id !== id);
    const removed = presets.length !== initialLength;
    if (removed) {
      persist();
    }
    return removed;
  };

  const replaceAll = (nextPresets: unknown[]) => {
    presets = sortPresets(
      nextPresets
        .map((preset, index) => normalizeStoredPreset(preset, now, createId, `imported-${index}`))
        .filter((preset): preset is ScenePreset => preset !== null)
    );
    persist();
    return clonePresets(presets);
  };

  const clear = () => {
    presets = [];
    if (!storage) {
      return;
    }
    storage.removeItem(storageKey);
  };

  return {
    list,
    getById,
    create,
    update,
    remove,
    replaceAll,
    clear
  };
}

function normalizePresetState(nextState: unknown, previousState?: ScenePresetState): ScenePresetState {
  const base = previousState ?? defaultPresetState();
  const record = isRecord(nextState) ? nextState : null;

  return {
    camera: normalizeCameraState(record?.camera, base.camera),
    layers: normalizeLayerToggles(record?.layers, base.layers),
    styleMode: normalizeStyleMode(record?.styleMode, base.styleMode)
  };
}

function normalizeLayerToggles(nextLayers: unknown, base: LayerToggles): LayerToggles {
  const normalized: LayerToggles = { ...base };

  if (!isRecord(nextLayers)) {
    return normalized;
  }

  for (const layerId of LAYER_IDS) {
    const nextValue = nextLayers[layerId];
    if (typeof nextValue === 'boolean') {
      normalized[layerId] = nextValue;
    }
  }

  return normalized;
}

function normalizeStyleMode(value: unknown, fallback: HudStyleMode): HudStyleMode {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return (HUD_STYLE_MODES as readonly string[]).includes(normalized) ? (normalized as HudStyleMode) : fallback;
}

function normalizeCameraState(value: unknown, fallback: CameraState): CameraState {
  if (!isRecord(value)) {
    return sanitizeCameraState(fallback);
  }

  return sanitizeCameraState({
    longitude: toNumberOrFallback(value.longitude, fallback.longitude),
    latitude: toNumberOrFallback(value.latitude, fallback.latitude),
    height: toNumberOrFallback(value.height, fallback.height),
    heading: toNumberOrFallback(value.heading, fallback.heading),
    pitch: toNumberOrFallback(value.pitch, fallback.pitch),
    roll: toNumberOrFallback(value.roll, fallback.roll)
  });
}

function normalizePresetName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : UNTITLED_PRESET_NAME;
}

function readPresets(
  storage: ScenePresetStorageLike | null,
  storageKey: string,
  now: () => Date,
  createId: () => string
): ScenePreset[] {
  if (!storage) {
    return [];
  }

  const raw = storage.getItem(storageKey);
  if (!raw) {
    return [];
  }

  const parsed = parsePersistedPayload(raw);
  if (!parsed) {
    return [];
  }

  return sortPresets(
    parsed.presets
      .map((preset, index) => normalizeStoredPreset(preset, now, createId, `stored-${index}`))
      .filter((preset): preset is ScenePreset => preset !== null)
  );
}

function parsePersistedPayload(raw: string): PersistedScenePresets | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.presets) || typeof parsed.version !== 'number') {
    return null;
  }

  if (parsed.version !== SCENE_PRESET_STORAGE_VERSION) {
    return null;
  }

  return {
    version: parsed.version,
    presets: parsed.presets
  };
}

function normalizeStoredPreset(
  preset: unknown,
  now: () => Date,
  createId: () => string,
  fallbackName: string
): ScenePreset | null {
  if (!isRecord(preset)) {
    return null;
  }

  const record = preset as ScenePresetRecord;
  const fallbackNowIso = now().toISOString();
  const createdAt = normalizeIsoDate(record.createdAt, fallbackNowIso);
  const updatedAt = normalizeIsoDate(record.updatedAt, createdAt);
  const defaultState = defaultPresetState();

  const state = normalizePresetState(record.state, defaultState);

  return {
    id: typeof record.id === 'string' && record.id.trim().length > 0 ? record.id.trim() : createId(),
    name: normalizePresetName(typeof record.name === 'string' ? record.name : fallbackName),
    createdAt,
    updatedAt,
    state
  };
}

function normalizeIsoDate(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return fallback;
  }

  return new Date(timestamp).toISOString();
}

function defaultPresetState(): ScenePresetState {
  return {
    camera: sanitizeCameraState(DEFAULT_BOOT_CAMERA),
    layers: { ...INITIAL_LAYER_TOGGLES },
    styleMode: DEFAULT_HUD_STYLE_MODE
  };
}

function safeBrowserStorage(): ScenePresetStorageLike | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const probeKey = '__earthly_scene_presets_probe__';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

function sortPresets(presets: ScenePreset[]): ScenePreset[] {
  return [...presets].sort((left, right) => {
    const delta = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    if (delta !== 0) {
      return delta;
    }
    return left.name.localeCompare(right.name);
  });
}

function clonePresets(presets: ScenePreset[]): ScenePreset[] {
  return presets.map(clonePreset);
}

function clonePreset(preset: ScenePreset): ScenePreset {
  return {
    ...preset,
    state: {
      ...preset.state,
      camera: { ...preset.state.camera },
      layers: { ...preset.state.layers }
    }
  };
}

function defaultIdFactory(): () => string {
  let sequence = 0;

  return () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    sequence += 1;
    return `preset-${Date.now().toString(36)}-${sequence.toString(36)}`;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNumberOrFallback(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}
