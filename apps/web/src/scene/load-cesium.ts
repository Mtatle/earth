type CesiumModule = typeof import('cesium');

type CesiumWithDefault = CesiumModule & {
  default?: CesiumModule;
};

export async function loadCesium(): Promise<CesiumModule> {
  // This alias is resolved by Vite directly to Cesium's bundled entry.
  const imported = (await import('cesium-runtime')) as CesiumWithDefault;
  return imported.default ?? imported;
}
