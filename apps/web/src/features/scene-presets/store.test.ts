import { describe, expect, it } from 'vitest';
import { createScenePresetStore, type ScenePresetStorageLike } from './store.js';
import { SCENE_PRESET_STORAGE_KEY, SCENE_PRESET_STORAGE_VERSION } from './types.js';

describe('scene preset store', () => {
  it('creates presets and persists them to storage', () => {
    const storage = createMemoryStorage();
    const store = createScenePresetStore({
      storage,
      now: createDeterministicClock(['2026-03-02T19:00:00.000Z']),
      createId: () => 'preset-1'
    });

    const created = store.create({
      name: ' Global Watch ',
      state: {
        layers: {
          satellites: true,
          flights: false,
          earthquakes: true
        },
        styleMode: 'nvg'
      }
    });

    expect(created).toMatchObject({
      id: 'preset-1',
      name: 'Global Watch',
      state: {
        layers: {
          satellites: true,
          flights: false,
          earthquakes: true
        },
        styleMode: 'nvg'
      }
    });

    const rawPersisted = storage.getItem(SCENE_PRESET_STORAGE_KEY);
    expect(rawPersisted).toBeTruthy();
    const persisted = rawPersisted ? (JSON.parse(rawPersisted) as { version: number; presets: unknown[] }) : null;
    expect(persisted?.version).toBe(SCENE_PRESET_STORAGE_VERSION);
    expect(persisted?.presets).toHaveLength(1);
  });

  it('loads and normalizes presets from storage', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      SCENE_PRESET_STORAGE_KEY,
      JSON.stringify({
        version: SCENE_PRESET_STORAGE_VERSION,
        presets: [
          {
            id: 'preset-2',
            name: '  ',
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-02T00:00:00.000Z',
            state: {
              camera: {
                longitude: Number.NaN,
                latitude: Number.POSITIVE_INFINITY,
                height: Number.NEGATIVE_INFINITY,
                heading: Number.NaN,
                pitch: Number.NaN,
                roll: Number.NaN
              },
              layers: {
                flights: false
              },
              styleMode: 'unsupported'
            }
          }
        ]
      })
    );

    const store = createScenePresetStore({
      storage,
      now: createDeterministicClock(['2026-03-02T19:05:00.000Z']),
      createId: () => 'generated-id'
    });

    expect(store.list()).toEqual([
      {
        id: 'preset-2',
        name: 'Untitled Preset',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-02T00:00:00.000Z',
        state: {
          camera: {
            longitude: 0,
            latitude: 12,
            height: 17_500_000,
            heading: 0,
            pitch: -88,
            roll: 0
          },
          layers: {
            satellites: true,
            flights: false,
            earthquakes: true
          },
          styleMode: 'default'
        }
      }
    ]);
  });

  it('updates presets with partial state patches and bumps updatedAt', () => {
    const storage = createMemoryStorage();
    const clock = createDeterministicClock(['2026-03-02T19:10:00.000Z', '2026-03-02T19:11:00.000Z']);
    const store = createScenePresetStore({
      storage,
      now: clock,
      createId: () => 'preset-3'
    });

    store.create({
      name: 'Ops',
      state: {
        layers: {
          satellites: true,
          flights: true,
          earthquakes: true
        }
      }
    });

    const updated = store.update('preset-3', {
      name: 'Ops Updated',
      state: {
        layers: {
          flights: false
        },
        styleMode: 'thermal'
      }
    });

    expect(updated).not.toBeNull();
    expect(updated?.name).toBe('Ops Updated');
    expect(updated?.createdAt).toBe('2026-03-02T19:10:00.000Z');
    expect(updated?.updatedAt).toBe('2026-03-02T19:11:00.000Z');
    expect(updated?.state.layers).toEqual({
      satellites: true,
      flights: false,
      earthquakes: true
    });
    expect(updated?.state.styleMode).toBe('thermal');
  });

  it('removes and clears presets', () => {
    const storage = createMemoryStorage();
    const store = createScenePresetStore({
      storage,
      now: createDeterministicClock(['2026-03-02T19:12:00.000Z', '2026-03-02T19:13:00.000Z']),
      createId: (() => {
        let id = 0;
        return () => {
          id += 1;
          return `preset-${id}`;
        };
      })()
    });

    store.create({ name: 'One' });
    store.create({ name: 'Two' });

    expect(store.remove('preset-1')).toBe(true);
    expect(store.list().map((preset) => preset.id)).toEqual(['preset-2']);

    store.clear();
    expect(store.list()).toEqual([]);
    expect(storage.getItem(SCENE_PRESET_STORAGE_KEY)).toBeNull();
  });

  it('recovers safely from malformed storage payloads', () => {
    const storage = createMemoryStorage();
    storage.setItem(SCENE_PRESET_STORAGE_KEY, '{not-json');

    const store = createScenePresetStore({
      storage,
      now: createDeterministicClock(['2026-03-02T19:14:00.000Z']),
      createId: () => 'preset-4'
    });

    expect(store.list()).toEqual([]);

    const created = store.create({ name: '' });
    expect(created.name).toBe('Untitled Preset');
  });
});

function createMemoryStorage(): ScenePresetStorageLike {
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

function createDeterministicClock(isoValues: string[]): () => Date {
  if (isoValues.length === 0) {
    throw new Error('createDeterministicClock requires at least one ISO value.');
  }

  const fallbackValue = isoValues[0];
  if (fallbackValue === undefined) {
    throw new Error('createDeterministicClock requires at least one ISO value.');
  }
  let index = 0;

  return () => {
    const value = isoValues[Math.min(index, isoValues.length - 1)] ?? fallbackValue;
    index += 1;
    return new Date(value);
  };
}
