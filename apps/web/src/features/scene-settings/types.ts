export const SCENE_SETTINGS_STORAGE_KEY = 'earthly.scene-settings.v1';
export const SCENE_SETTINGS_STORAGE_VERSION = 1;

export const QUALITY_PROFILES = ['low', 'balanced', 'high', 'ultra'] as const;
export type QualityProfile = (typeof QUALITY_PROFILES)[number];

export type SceneSettingsState = {
  terrainEnabled: boolean;
  buildingsEnabled: boolean;
  atmosphereEnabled: boolean;
  fogEnabled: boolean;
  qualityProfile: QualityProfile;
};

export type SceneSettingsStatePatch = {
  terrainEnabled?: unknown;
  buildingsEnabled?: unknown;
  atmosphereEnabled?: unknown;
  fogEnabled?: unknown;
  qualityProfile?: unknown;
};

export type SceneSettingsStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type SceneSettingsStoreOptions = {
  storage?: SceneSettingsStorageLike;
  storageKey?: string;
};

export type SceneSettingsStore = {
  getState: () => SceneSettingsState;
  setState: (nextState: SceneSettingsStatePatch) => SceneSettingsState;
  patch: (nextPatch: SceneSettingsStatePatch) => SceneSettingsState;
  reset: () => SceneSettingsState;
};
