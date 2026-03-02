import { loadCesium } from './load-cesium';

type PrimitiveCollectionLike = {
  add: (primitive: unknown) => unknown;
  remove: (primitive: unknown) => boolean;
};

type GlobeLike = {
  terrainProvider?: unknown;
};

export type ViewerLike = {
  scene?: {
    globe?: GlobeLike | null;
    primitives?: PrimitiveCollectionLike | null;
  } | null;
  terrainProvider?: unknown;
};

type CesiumLike = {
  createWorldTerrainAsync?: () => Promise<unknown>;
  createWorldTerrain?: () => unknown;
  createOsmBuildingsAsync?: () => Promise<unknown>;
  createOsmBuildings?: () => unknown;
  EllipsoidTerrainProvider?: new () => unknown;
};

export interface RuntimeFeatureStatus {
  enabled: boolean;
  disabled: boolean;
  reason: string | null;
}

export interface TerrainBuildingsRuntimeResult {
  enabled: boolean;
  disabled: boolean;
  reason: string | null;
  terrain: RuntimeFeatureStatus;
  buildings: RuntimeFeatureStatus;
  cleanup: () => void;
}

export interface TerrainRuntimeOptions {
  enabled?: boolean;
  allowEllipsoidFallback?: boolean;
  preferEllipsoidWhenOffline?: boolean;
}

export interface BuildingsRuntimeOptions {
  enabled?: boolean;
  disableWhenOffline?: boolean;
}

export interface TerrainBuildingsRuntimeOptions {
  terrain?: TerrainRuntimeOptions;
  buildings?: BuildingsRuntimeOptions;
  isOnline?: () => boolean;
  loadCesiumImpl?: () => Promise<CesiumLike>;
}

const DEFAULT_TERRAIN_OPTIONS: Required<TerrainRuntimeOptions> = {
  enabled: true,
  allowEllipsoidFallback: true,
  preferEllipsoidWhenOffline: true
};

const DEFAULT_BUILDINGS_OPTIONS: Required<BuildingsRuntimeOptions> = {
  enabled: true,
  disableWhenOffline: true
};

function buildFeatureStatus(enabled: boolean, reason: string | null): RuntimeFeatureStatus {
  return {
    enabled,
    disabled: !enabled,
    reason: enabled ? null : reason
  };
}

function toReason(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof (value as Promise<T>)?.then === 'function';
}

function resolveOnlineState(isOnline?: () => boolean): boolean {
  if (isOnline) {
    return isOnline();
  }
  if (typeof navigator === 'undefined') {
    return true;
  }
  return navigator.onLine !== false;
}

function applyTerrainProvider(viewer: ViewerLike, provider: unknown) {
  if (viewer.scene?.globe) {
    viewer.scene.globe.terrainProvider = provider;
  }
  if ('terrainProvider' in viewer) {
    viewer.terrainProvider = provider;
  }
}

function createEllipsoidProvider(Cesium: CesiumLike): unknown {
  if (!Cesium.EllipsoidTerrainProvider) {
    throw new Error('Ellipsoid terrain provider is unavailable.');
  }
  return new Cesium.EllipsoidTerrainProvider();
}

async function createWorldTerrainProvider(Cesium: CesiumLike): Promise<unknown> {
  if (Cesium.createWorldTerrainAsync) {
    return Cesium.createWorldTerrainAsync();
  }
  if (Cesium.createWorldTerrain) {
    return Cesium.createWorldTerrain();
  }
  throw new Error('Cesium world terrain factory is unavailable.');
}

async function createBuildingsPrimitive(Cesium: CesiumLike): Promise<unknown> {
  if (Cesium.createOsmBuildingsAsync) {
    return Cesium.createOsmBuildingsAsync();
  }
  if (Cesium.createOsmBuildings) {
    const primitive = Cesium.createOsmBuildings();
    if (isPromiseLike(primitive)) {
      return primitive;
    }
    return primitive;
  }
  throw new Error('Cesium OSM buildings factory is unavailable.');
}

export async function attachTerrainAndBuildings(
  viewer: ViewerLike,
  options: TerrainBuildingsRuntimeOptions = {}
): Promise<TerrainBuildingsRuntimeResult> {
  const cleanupTasks: Array<() => void> = [];
  const terrainOptions = { ...DEFAULT_TERRAIN_OPTIONS, ...options.terrain };
  const buildingsOptions = { ...DEFAULT_BUILDINGS_OPTIONS, ...options.buildings };
  const online = resolveOnlineState(options.isOnline);

  if (!viewer.scene) {
    const reason = 'Viewer scene is unavailable.';
    const terrain = buildFeatureStatus(false, reason);
    const buildings = buildFeatureStatus(false, reason);
    return {
      enabled: false,
      disabled: true,
      reason,
      terrain,
      buildings,
      cleanup: () => undefined
    };
  }

  let Cesium: CesiumLike;
  try {
    Cesium = await (options.loadCesiumImpl ?? loadCesium)();
  } catch (error) {
    const reason = `Cesium runtime load failed: ${toReason(error, 'Unknown error')}`;
    const terrain = buildFeatureStatus(false, reason);
    const buildings = buildFeatureStatus(false, reason);
    return {
      enabled: false,
      disabled: true,
      reason,
      terrain,
      buildings,
      cleanup: () => undefined
    };
  }

  let terrainStatus = buildFeatureStatus(false, 'Terrain disabled by runtime configuration.');
  let buildingsStatus = buildFeatureStatus(false, 'Buildings disabled by runtime configuration.');

  if (!terrainOptions.enabled) {
    terrainStatus = buildFeatureStatus(false, 'Terrain disabled by runtime configuration.');
  } else if (!online && terrainOptions.preferEllipsoidWhenOffline && terrainOptions.allowEllipsoidFallback) {
    try {
      const fallbackProvider = createEllipsoidProvider(Cesium);
      applyTerrainProvider(viewer, fallbackProvider);
      terrainStatus = buildFeatureStatus(false, 'Terrain offline; using ellipsoid fallback.');
    } catch (error) {
      terrainStatus = buildFeatureStatus(
        false,
        `Terrain offline fallback failed: ${toReason(error, 'Unknown error')}`
      );
    }
  } else {
    try {
      const terrainProvider = await createWorldTerrainProvider(Cesium);
      applyTerrainProvider(viewer, terrainProvider);
      terrainStatus = buildFeatureStatus(true, null);
    } catch (error) {
      if (terrainOptions.allowEllipsoidFallback) {
        try {
          const fallbackProvider = createEllipsoidProvider(Cesium);
          applyTerrainProvider(viewer, fallbackProvider);
          terrainStatus = buildFeatureStatus(
            false,
            `Terrain failed; using ellipsoid fallback (${toReason(error, 'unknown error')}).`
          );
        } catch (fallbackError) {
          terrainStatus = buildFeatureStatus(
            false,
            `Terrain setup failed: ${toReason(error, 'unknown error')}; fallback failed: ${toReason(
              fallbackError,
              'unknown error'
            )}`
          );
        }
      } else {
        terrainStatus = buildFeatureStatus(false, `Terrain setup failed: ${toReason(error, 'unknown error')}`);
      }
    }
  }

  if (!buildingsOptions.enabled) {
    buildingsStatus = buildFeatureStatus(false, 'Buildings disabled by runtime configuration.');
  } else if (!online && buildingsOptions.disableWhenOffline) {
    buildingsStatus = buildFeatureStatus(false, 'Buildings disabled while offline.');
  } else if (!viewer.scene.primitives) {
    buildingsStatus = buildFeatureStatus(false, 'Viewer primitives collection is unavailable.');
  } else {
    try {
      const primitive = await createBuildingsPrimitive(Cesium);
      const attachedPrimitive = viewer.scene.primitives.add(primitive);
      cleanupTasks.push(() => {
        viewer.scene?.primitives?.remove(attachedPrimitive);
      });
      buildingsStatus = buildFeatureStatus(true, null);
    } catch (error) {
      buildingsStatus = buildFeatureStatus(
        false,
        `Buildings setup failed: ${toReason(error, 'unknown error')}`
      );
    }
  }

  const enabled = terrainStatus.enabled || buildingsStatus.enabled;
  const disabled = !enabled;
  const reasons: string[] = [];
  if (terrainStatus.reason) {
    reasons.push(`terrain: ${terrainStatus.reason}`);
  }
  if (buildingsStatus.reason) {
    reasons.push(`buildings: ${buildingsStatus.reason}`);
  }

  return {
    enabled,
    disabled,
    reason: reasons.length > 0 ? reasons.join(' | ') : null,
    terrain: terrainStatus,
    buildings: buildingsStatus,
    cleanup: () => {
      while (cleanupTasks.length > 0) {
        const cleanup = cleanupTasks.pop();
        try {
          cleanup?.();
        } catch {
          // Cleanup should be best-effort and never crash unmount paths.
        }
      }
    }
  };
}

