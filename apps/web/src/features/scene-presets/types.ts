import type { CameraState } from '../../scene/camera-state';
import type { LayerId, LayerToggles } from '../layer-manager/types';

export const SCENE_PRESET_STORAGE_KEY = 'earthly.scene-presets.v1';
export const SCENE_PRESET_STORAGE_VERSION = 1;

export const HUD_STYLE_MODES = ['default', 'nvg', 'thermal'] as const;
export type HudStyleMode = (typeof HUD_STYLE_MODES)[number];
export const DEFAULT_HUD_STYLE_MODE: HudStyleMode = 'default';

export type ScenePresetState = {
  camera: CameraState;
  layers: LayerToggles;
  styleMode: HudStyleMode;
};

export type ScenePreset = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  state: ScenePresetState;
};

export type ScenePresetStatePatch = {
  camera?: CameraState;
  layers?: Partial<Record<LayerId, boolean>>;
  styleMode?: string;
};

export type ScenePresetCreateInput = {
  name: string;
  state?: ScenePresetStatePatch;
};

export type ScenePresetUpdateInput = {
  name?: string;
  state?: ScenePresetStatePatch;
};
