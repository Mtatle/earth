import { describe, expect, it, vi } from 'vitest';
import { attachTerrainAndBuildings, type ViewerLike } from './terrain-buildings';

function createViewer() {
  const primitives = {
    add: vi.fn((primitive: unknown) => primitive),
    remove: vi.fn(() => true)
  };

  const viewer: ViewerLike = {
    scene: {
      globe: {},
      primitives
    }
  };

  return { viewer, primitives };
}

describe('terrain-buildings runtime helpers', () => {
  it('attaches world terrain and OSM buildings when services are available', async () => {
    const { viewer, primitives } = createViewer();
    const terrainProvider = { name: 'world-terrain' };
    const buildingsPrimitive = { name: 'osm-buildings' };
    const Cesium = {
      createWorldTerrainAsync: vi.fn(async () => terrainProvider),
      createOsmBuildingsAsync: vi.fn(async () => buildingsPrimitive),
      EllipsoidTerrainProvider: class {}
    };

    const result = await attachTerrainAndBuildings(viewer, {
      isOnline: () => true,
      loadCesiumImpl: async () => Cesium
    });

    expect(Cesium.createWorldTerrainAsync).toHaveBeenCalledTimes(1);
    expect(Cesium.createOsmBuildingsAsync).toHaveBeenCalledTimes(1);
    expect(viewer.scene?.globe?.terrainProvider).toBe(terrainProvider);
    expect(primitives.add).toHaveBeenCalledWith(buildingsPrimitive);

    expect(result.enabled).toBe(true);
    expect(result.disabled).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.terrain).toEqual({
      enabled: true,
      disabled: false,
      reason: null
    });
    expect(result.buildings).toEqual({
      enabled: true,
      disabled: false,
      reason: null
    });

    result.cleanup();
    expect(primitives.remove).toHaveBeenCalledTimes(1);
    expect(primitives.remove).toHaveBeenCalledWith(buildingsPrimitive);
  });

  it('falls back gracefully while offline', async () => {
    const { viewer, primitives } = createViewer();
    class MockEllipsoidTerrainProvider {}
    const Cesium = {
      createWorldTerrainAsync: vi.fn(async () => ({ name: 'world-terrain' })),
      createOsmBuildingsAsync: vi.fn(async () => ({ name: 'osm-buildings' })),
      EllipsoidTerrainProvider: MockEllipsoidTerrainProvider
    };

    const result = await attachTerrainAndBuildings(viewer, {
      isOnline: () => false,
      loadCesiumImpl: async () => Cesium
    });

    expect(Cesium.createWorldTerrainAsync).not.toHaveBeenCalled();
    expect(Cesium.createOsmBuildingsAsync).not.toHaveBeenCalled();
    expect(viewer.scene?.globe?.terrainProvider).toBeInstanceOf(MockEllipsoidTerrainProvider);

    expect(result.enabled).toBe(false);
    expect(result.disabled).toBe(true);
    expect(result.terrain.enabled).toBe(false);
    expect(result.terrain.reason).toMatch(/offline/i);
    expect(result.buildings.enabled).toBe(false);
    expect(result.buildings.reason).toMatch(/offline/i);
    expect(result.reason).toMatch(/terrain:/i);
    expect(result.reason).toMatch(/buildings:/i);

    result.cleanup();
    expect(primitives.remove).not.toHaveBeenCalled();
  });

  it('uses terrain fallback after runtime failure and still enables buildings', async () => {
    const { viewer, primitives } = createViewer();
    const buildingsPrimitive = { name: 'osm-buildings' };
    class MockEllipsoidTerrainProvider {}
    const Cesium = {
      createWorldTerrainAsync: vi.fn(async () => {
        throw new Error('terrain service unavailable');
      }),
      createOsmBuildingsAsync: vi.fn(async () => buildingsPrimitive),
      EllipsoidTerrainProvider: MockEllipsoidTerrainProvider
    };

    const result = await attachTerrainAndBuildings(viewer, {
      isOnline: () => true,
      loadCesiumImpl: async () => Cesium
    });

    expect(Cesium.createWorldTerrainAsync).toHaveBeenCalledTimes(1);
    expect(Cesium.createOsmBuildingsAsync).toHaveBeenCalledTimes(1);
    expect(viewer.scene?.globe?.terrainProvider).toBeInstanceOf(MockEllipsoidTerrainProvider);
    expect(result.enabled).toBe(true);
    expect(result.disabled).toBe(false);
    expect(result.terrain.enabled).toBe(false);
    expect(result.terrain.reason).toMatch(/terrain service unavailable/i);
    expect(result.buildings.enabled).toBe(true);

    result.cleanup();
    expect(primitives.remove).toHaveBeenCalledWith(buildingsPrimitive);
  });

  it('returns disabled status when viewer scene is unavailable', async () => {
    const result = await attachTerrainAndBuildings(
      {
        scene: null
      },
      {
        isOnline: () => true,
        loadCesiumImpl: async () => ({})
      }
    );

    expect(result.enabled).toBe(false);
    expect(result.disabled).toBe(true);
    expect(result.terrain.enabled).toBe(false);
    expect(result.buildings.enabled).toBe(false);
    expect(result.reason).toMatch(/scene is unavailable/i);
    expect(() => result.cleanup()).not.toThrow();
  });
});

