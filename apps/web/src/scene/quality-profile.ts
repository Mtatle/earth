import type { ViewerSceneQualityTarget } from './types';

export type SceneQualityProfileId = 'performance' | 'balanced' | 'premium';
export type RequestRenderStrategy = 'on-demand' | 'hybrid' | 'continuous';

export interface SceneQualityProfile {
  id: SceneQualityProfileId;
  label: string;
  description: string;
  resolutionScaleMin: number;
  resolutionScaleMax: number;
  shadows: boolean;
  lighting: boolean;
  fxaa: boolean;
  requestRenderMode: boolean;
  maximumRenderTimeChange: number;
  requestRenderStrategy: RequestRenderStrategy;
}

export interface ApplySceneQualityProfileOptions {
  devicePixelRatio?: number;
}

export interface AppliedSceneQualityState {
  profile: SceneQualityProfileId;
  resolutionScale: number;
  shadows: boolean;
  lighting: boolean;
  fxaa: boolean;
  requestRenderMode: boolean;
  maximumRenderTimeChange: number;
  requestRenderStrategy: RequestRenderStrategy;
}

const PROFILE_MAP: Record<SceneQualityProfileId, SceneQualityProfile> = {
  performance: {
    id: 'performance',
    label: 'Performance',
    description: 'Prioritize smooth frame times for dense operational overlays.',
    resolutionScaleMin: 0.75,
    resolutionScaleMax: 1,
    shadows: false,
    lighting: false,
    fxaa: false,
    requestRenderMode: true,
    maximumRenderTimeChange: Number.POSITIVE_INFINITY,
    requestRenderStrategy: 'on-demand'
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    description: 'Default tradeoff between visual clarity and runtime stability.',
    resolutionScaleMin: 1,
    resolutionScaleMax: 1.5,
    shadows: false,
    lighting: true,
    fxaa: true,
    requestRenderMode: true,
    maximumRenderTimeChange: 1,
    requestRenderStrategy: 'hybrid'
  },
  premium: {
    id: 'premium',
    label: 'Premium',
    description: 'Highest fidelity rendering with continuous scene updates.',
    resolutionScaleMin: 1.25,
    resolutionScaleMax: 2,
    shadows: true,
    lighting: true,
    fxaa: true,
    requestRenderMode: false,
    maximumRenderTimeChange: 0,
    requestRenderStrategy: 'continuous'
  }
};

const PROFILE_ORDER: SceneQualityProfileId[] = ['performance', 'balanced', 'premium'];
const DEFAULT_DEVICE_PIXEL_RATIO = 1;

export function listSceneQualityProfiles(): SceneQualityProfile[] {
  return PROFILE_ORDER.map((key) => PROFILE_MAP[key]);
}

export function getSceneQualityProfile(profile: SceneQualityProfileId): SceneQualityProfile {
  return PROFILE_MAP[profile];
}

export function clampResolutionScale(
  profile: SceneQualityProfile,
  devicePixelRatio: number = DEFAULT_DEVICE_PIXEL_RATIO
): number {
  const safeRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio
    : DEFAULT_DEVICE_PIXEL_RATIO;
  const clamped = Math.min(
    Math.max(safeRatio, profile.resolutionScaleMin),
    profile.resolutionScaleMax
  );
  return Number(clamped.toFixed(3));
}

export function applySceneQualityProfile(
  viewer: ViewerSceneQualityTarget,
  profileId: SceneQualityProfileId,
  options: ApplySceneQualityProfileOptions = {}
): AppliedSceneQualityState {
  const profile = getSceneQualityProfile(profileId);
  const resolutionScale = clampResolutionScale(profile, options.devicePixelRatio);

  viewer.resolutionScale = resolutionScale;
  viewer.shadows = profile.shadows;
  viewer.scene.globe.enableLighting = profile.lighting;
  viewer.scene.postProcessStages.fxaa.enabled = profile.fxaa;
  viewer.scene.requestRenderMode = profile.requestRenderMode;
  viewer.scene.maximumRenderTimeChange = profile.maximumRenderTimeChange;

  return {
    profile: profile.id,
    resolutionScale,
    shadows: profile.shadows,
    lighting: profile.lighting,
    fxaa: profile.fxaa,
    requestRenderMode: profile.requestRenderMode,
    maximumRenderTimeChange: profile.maximumRenderTimeChange,
    requestRenderStrategy: profile.requestRenderStrategy
  };
}
