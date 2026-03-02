export interface SceneGlobeLike {
  enableLighting: boolean;
}

export interface SceneFxaaStageLike {
  enabled: boolean;
}

export interface ScenePostProcessStagesLike {
  fxaa: SceneFxaaStageLike;
}

export interface SceneLike {
  globe: SceneGlobeLike;
  postProcessStages: ScenePostProcessStagesLike;
  requestRenderMode: boolean;
  maximumRenderTimeChange: number;
}

export interface ViewerSceneQualityTarget {
  resolutionScale: number;
  shadows: boolean;
  scene: SceneLike;
}
