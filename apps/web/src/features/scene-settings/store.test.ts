import { describe, expect, it } from 'vitest';
import { createSceneSettingsStore, defaultSceneSettingsState } from './store';
import { SCENE_SETTINGS_STORAGE_KEY, SCENE_SETTINGS_STORAGE_VERSION, type SceneSettingsStorageLike } from './types';

describe('scene settings store', () => {
  it('returns defaults when storage is unavailable', () => {
    const store = createSceneSettingsStore({
      storage: undefined
    });

    expect(store.getState()).toEqual(defaultSceneSettingsState());
  });

  it('persists a full state update with known version payload', () => {
    const storage = createMemoryStorage();
    const store = createSceneSettingsStore({ storage });

    const next = store.setState({
      terrainEnabled: false,
      buildingsEnabled: false,
      atmosphereEnabled: true,
      fogEnabled: false,
      qualityProfile: 'premium'
    });

    expect(next).toEqual({
      terrainEnabled: false,
      buildingsEnabled: false,
      atmosphereEnabled: true,
      fogEnabled: false,
      qualityProfile: 'premium'
    });

    const persistedRaw = storage.getItem(SCENE_SETTINGS_STORAGE_KEY);
    expect(persistedRaw).toBeTruthy();

    const persisted = persistedRaw
      ? (JSON.parse(persistedRaw) as {
          version: number;
          state: Record<string, unknown>;
        })
      : null;

    expect(persisted?.version).toBe(SCENE_SETTINGS_STORAGE_VERSION);
    expect(persisted?.state).toMatchObject(next);
  });

  it('patches only provided fields and keeps prior values', () => {
    const storage = createMemoryStorage();
    const store = createSceneSettingsStore({ storage });

    store.setState({
      terrainEnabled: false,
      buildingsEnabled: true,
      atmosphereEnabled: false,
      fogEnabled: true,
      qualityProfile: 'performance'
    });

    const patched = store.patch({
      fogEnabled: false,
      qualityProfile: 'premium'
    });

    expect(patched).toEqual({
      terrainEnabled: false,
      buildingsEnabled: true,
      atmosphereEnabled: false,
      fogEnabled: false,
      qualityProfile: 'premium'
    });
  });

  it('loads and normalizes malformed persisted payload fields', () => {
    const storage = createMemoryStorage();

    storage.setItem(
      SCENE_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        version: 999,
        state: {
          terrainEnabled: 'off',
          buildingsEnabled: 'YES',
          atmosphereEnabled: 0,
          fogEnabled: 1,
          qualityProfile: '  HIGH '
        }
      })
    );

    const store = createSceneSettingsStore({ storage });

    expect(store.getState()).toEqual({
      terrainEnabled: false,
      buildingsEnabled: true,
      atmosphereEnabled: false,
      fogEnabled: true,
      qualityProfile: 'premium'
    });
  });

  it('recovers from malformed json by clearing invalid storage', () => {
    const storage = createMemoryStorage();

    storage.setItem(SCENE_SETTINGS_STORAGE_KEY, '{not-json');

    const store = createSceneSettingsStore({ storage });

    expect(store.getState()).toEqual(defaultSceneSettingsState());
    expect(storage.getItem(SCENE_SETTINGS_STORAGE_KEY)).toBeNull();
  });

  it('recovers from legacy direct-state payload shape', () => {
    const storage = createMemoryStorage();

    storage.setItem(
      SCENE_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        terrainEnabled: false,
        buildingsEnabled: false,
        atmosphereEnabled: true,
        fogEnabled: true,
        qualityProfile: 'balanced'
      })
    );

    const store = createSceneSettingsStore({ storage });

    expect(store.getState()).toEqual({
      terrainEnabled: false,
      buildingsEnabled: false,
      atmosphereEnabled: true,
      fogEnabled: true,
      qualityProfile: 'balanced'
    });
  });

  it('resets state to defaults and removes storage key', () => {
    const storage = createMemoryStorage();
    const store = createSceneSettingsStore({ storage });

    store.patch({
      terrainEnabled: false,
      qualityProfile: 'performance'
    });

    expect(storage.getItem(SCENE_SETTINGS_STORAGE_KEY)).not.toBeNull();

    const reset = store.reset();

    expect(reset).toEqual(defaultSceneSettingsState());
    expect(storage.getItem(SCENE_SETTINGS_STORAGE_KEY)).toBeNull();
  });

  it('returns cloned state snapshots', () => {
    const storage = createMemoryStorage();
    const store = createSceneSettingsStore({ storage });

    const snapshot = store.getState();
    snapshot.terrainEnabled = false;
    snapshot.qualityProfile = 'performance';

    expect(store.getState()).toEqual(defaultSceneSettingsState());
  });
});

function createMemoryStorage(): SceneSettingsStorageLike {
  const records = new Map<string, string>();

  return {
    getItem(key: string) {
      return records.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      records.set(key, value);
    },
    removeItem(key: string) {
      records.delete(key);
    }
  };
}
