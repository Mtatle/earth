import {
  QUALITY_PROFILES,
  SCENE_SETTINGS_STORAGE_KEY,
  SCENE_SETTINGS_STORAGE_VERSION,
  type QualityProfile,
  type SceneSettingsState,
  type SceneSettingsStatePatch,
  type SceneSettingsStorageLike,
  type SceneSettingsStore,
  type SceneSettingsStoreOptions
} from './types';

const DEFAULT_SCENE_SETTINGS_STATE: SceneSettingsState = {
  terrainEnabled: true,
  buildingsEnabled: true,
  atmosphereEnabled: true,
  fogEnabled: true,
  qualityProfile: 'balanced'
};

type PersistedSceneSettings = {
  version: number;
  state: unknown;
};

export function createSceneSettingsStore(options: SceneSettingsStoreOptions = {}): SceneSettingsStore {
  const storage = options.storage ?? safeBrowserStorage();
  const storageKey = options.storageKey ?? SCENE_SETTINGS_STORAGE_KEY;

  let state = readSceneSettings(storage, storageKey);

  const persist = () => {
    if (!storage) {
      return;
    }

    const payload: PersistedSceneSettings = {
      version: SCENE_SETTINGS_STORAGE_VERSION,
      state
    };

    try {
      storage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Swallow storage write errors (quota/private mode) and keep runtime state.
    }
  };

  const getState = () => cloneState(state);

  const setState = (nextState: SceneSettingsStatePatch) => {
    state = normalizeState(nextState, defaultSceneSettingsState());
    persist();
    return cloneState(state);
  };

  const patch = (nextPatch: SceneSettingsStatePatch) => {
    state = normalizeState(nextPatch, state);
    persist();
    return cloneState(state);
  };

  const reset = () => {
    state = defaultSceneSettingsState();

    if (storage) {
      try {
        storage.removeItem(storageKey);
      } catch {
        // Ignore storage cleanup errors.
      }
    }

    return cloneState(state);
  };

  return {
    getState,
    setState,
    patch,
    reset
  };
}

export function defaultSceneSettingsState(): SceneSettingsState {
  return {
    ...DEFAULT_SCENE_SETTINGS_STATE
  };
}

function readSceneSettings(storage: SceneSettingsStorageLike | null, storageKey: string): SceneSettingsState {
  if (!storage) {
    return defaultSceneSettingsState();
  }

  let raw: string | null;

  try {
    raw = storage.getItem(storageKey);
  } catch {
    return defaultSceneSettingsState();
  }

  if (!raw) {
    return defaultSceneSettingsState();
  }

  const parsed = parsePersistedPayload(raw);
  if (!parsed) {
    safeRemove(storage, storageKey);
    return defaultSceneSettingsState();
  }

  return normalizeState(parsed.state, defaultSceneSettingsState());
}

function parsePersistedPayload(raw: string): PersistedSceneSettings | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  if ('state' in parsed) {
    const versionValue = parsed.version;
    if (typeof versionValue === 'number' && versionValue !== SCENE_SETTINGS_STORAGE_VERSION) {
      return {
        version: SCENE_SETTINGS_STORAGE_VERSION,
        state: parsed.state
      };
    }

    return {
      version: SCENE_SETTINGS_STORAGE_VERSION,
      state: parsed.state
    };
  }

  return {
    version: SCENE_SETTINGS_STORAGE_VERSION,
    state: parsed
  };
}

function normalizeState(value: unknown, fallback: SceneSettingsState): SceneSettingsState {
  const record = isRecord(value) ? value : null;

  return {
    terrainEnabled: normalizeBoolean(record?.terrainEnabled, fallback.terrainEnabled),
    buildingsEnabled: normalizeBoolean(record?.buildingsEnabled, fallback.buildingsEnabled),
    atmosphereEnabled: normalizeBoolean(record?.atmosphereEnabled, fallback.atmosphereEnabled),
    fogEnabled: normalizeBoolean(record?.fogEnabled, fallback.fogEnabled),
    qualityProfile: normalizeQualityProfile(record?.qualityProfile, fallback.qualityProfile)
  };
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
      return true;
    }

    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
      return false;
    }
  }

  return fallback;
}

function normalizeQualityProfile(value: unknown, fallback: QualityProfile): QualityProfile {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  const canonical =
    normalized === 'low'
      ? 'performance'
      : normalized === 'high' || normalized === 'ultra'
        ? 'premium'
        : normalized;

  return (QUALITY_PROFILES as readonly string[]).includes(canonical) ? (canonical as QualityProfile) : fallback;
}

function cloneState(state: SceneSettingsState): SceneSettingsState {
  return {
    ...state
  };
}

function safeBrowserStorage(): SceneSettingsStorageLike | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const probeKey = '__earthly_scene_settings_probe__';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

function safeRemove(storage: SceneSettingsStorageLike, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore cleanup failures.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
