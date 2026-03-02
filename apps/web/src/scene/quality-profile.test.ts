import { describe, expect, it } from 'vitest';
import {
  applySceneQualityProfile,
  clampResolutionScale,
  getSceneQualityProfile,
  listSceneQualityProfiles
} from './quality-profile';
import type { ViewerSceneQualityTarget } from './types';

function createViewerHarness(): ViewerSceneQualityTarget {
  return {
    resolutionScale: 1,
    shadows: false,
    scene: {
      globe: {
        enableLighting: false
      },
      postProcessStages: {
        fxaa: {
          enabled: false
        }
      },
      requestRenderMode: true,
      maximumRenderTimeChange: Number.POSITIVE_INFINITY
    }
  };
}

describe('scene quality profiles', () => {
  it('lists all supported profiles in deterministic order', () => {
    const profiles = listSceneQualityProfiles();
    expect(profiles.map((profile) => profile.id)).toEqual([
      'performance',
      'balanced',
      'premium'
    ]);
  });

  it('clamps resolution scale for each profile band', () => {
    const performance = getSceneQualityProfile('performance');
    const balanced = getSceneQualityProfile('balanced');
    const premium = getSceneQualityProfile('premium');

    expect(clampResolutionScale(performance, 2.5)).toBe(1);
    expect(clampResolutionScale(balanced, 2.5)).toBe(1.5);
    expect(clampResolutionScale(premium, 0.6)).toBe(1.25);
    expect(clampResolutionScale(balanced, Number.NaN)).toBe(1);
  });

  it('applies performance profile knobs', () => {
    const viewer = createViewerHarness();
    const applied = applySceneQualityProfile(viewer, 'performance', { devicePixelRatio: 2.4 });

    expect(applied).toEqual({
      profile: 'performance',
      resolutionScale: 1,
      shadows: false,
      lighting: false,
      fxaa: false,
      requestRenderMode: true,
      maximumRenderTimeChange: Number.POSITIVE_INFINITY,
      requestRenderStrategy: 'on-demand'
    });
    expect(viewer).toMatchObject({
      resolutionScale: 1,
      shadows: false,
      scene: {
        globe: {
          enableLighting: false
        },
        postProcessStages: {
          fxaa: {
            enabled: false
          }
        },
        requestRenderMode: true,
        maximumRenderTimeChange: Number.POSITIVE_INFINITY
      }
    });
  });

  it('applies balanced profile knobs', () => {
    const viewer = createViewerHarness();
    const applied = applySceneQualityProfile(viewer, 'balanced', { devicePixelRatio: 2.2 });

    expect(applied).toEqual({
      profile: 'balanced',
      resolutionScale: 1.5,
      shadows: false,
      lighting: true,
      fxaa: true,
      requestRenderMode: true,
      maximumRenderTimeChange: 1,
      requestRenderStrategy: 'hybrid'
    });
    expect(viewer.scene.requestRenderMode).toBe(true);
    expect(viewer.scene.maximumRenderTimeChange).toBe(1);
  });

  it('applies premium profile knobs and continuous render strategy', () => {
    const viewer = createViewerHarness();
    const applied = applySceneQualityProfile(viewer, 'premium', { devicePixelRatio: 1.1 });

    expect(applied).toEqual({
      profile: 'premium',
      resolutionScale: 1.25,
      shadows: true,
      lighting: true,
      fxaa: true,
      requestRenderMode: false,
      maximumRenderTimeChange: 0,
      requestRenderStrategy: 'continuous'
    });
    expect(viewer.scene.requestRenderMode).toBe(false);
    expect(viewer.shadows).toBe(true);
    expect(viewer.scene.globe.enableLighting).toBe(true);
  });
});
