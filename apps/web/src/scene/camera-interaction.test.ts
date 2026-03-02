import { describe, expect, it } from 'vitest';
import type { CameraState } from './camera-state';
import {
  clampPitchForAltitude,
  clampZoomHeight,
  enforceCameraInteractionConstraints,
  planNearGroundTransition,
  resolvePitchConstraintForAltitude
} from './camera-interaction';

const BASE_STATE: CameraState = {
  longitude: -122.33,
  latitude: 47.6,
  height: 200_000,
  heading: 180,
  pitch: -45,
  roll: 0
};

describe('camera interaction helpers', () => {
  it('applies min/max zoom guardrails', () => {
    expect(clampZoomHeight(50)).toBe(350);
    expect(clampZoomHeight(30_000_000)).toBe(24_000_000);
    expect(clampZoomHeight(10_500)).toBe(10_500);
  });

  it('uses altitude-aware pitch constraints', () => {
    const nearGroundConstraint = resolvePitchConstraintForAltitude(5_000);
    const highAltitudeConstraint = resolvePitchConstraintForAltitude(8_000_000);

    expect(nearGroundConstraint.minPitch).toBeLessThan(highAltitudeConstraint.minPitch);
    expect(nearGroundConstraint.maxPitch).toBeLessThan(highAltitudeConstraint.maxPitch);
    expect(clampPitchForAltitude(50, 5_000)).toBe(nearGroundConstraint.maxPitch);
    expect(clampPitchForAltitude(-95, 5_000)).toBe(nearGroundConstraint.minPitch);
  });

  it('enforces zoom + pitch constraints on a camera state', () => {
    const maxNearGroundPitch = resolvePitchConstraintForAltitude(500).maxPitch;
    const constrained = enforceCameraInteractionConstraints({
      ...BASE_STATE,
      height: 100,
      pitch: 85
    });

    expect(constrained.height).toBe(500);
    expect(constrained.pitch).toBe(maxNearGroundPitch);
  });

  it('builds smooth two-step approach when descending to near-ground target', () => {
    const steps = planNearGroundTransition(
      {
        ...BASE_STATE,
        height: 1_500_000,
        pitch: -50
      },
      {
        ...BASE_STATE,
        longitude: -122.28,
        latitude: 47.62,
        height: 4_000,
        pitch: -10
      }
    );

    expect(steps).toHaveLength(2);
    expect(steps[0]?.label).toBe('approach');
    expect(steps[0]?.state.height).toBe(75_000);
    expect(steps[1]?.label).toBe('final');
    expect(steps[1]?.state.height).toBe(4_000);
    expect(steps[1]?.state.pitch).toBeLessThanOrEqual(6);
  });

  it('builds lift-out transition when climbing from near-ground state', () => {
    const steps = planNearGroundTransition(
      {
        ...BASE_STATE,
        height: 5_000,
        pitch: 10
      },
      {
        ...BASE_STATE,
        height: 1_200_000,
        pitch: -40
      }
    );

    expect(steps).toHaveLength(2);
    expect(steps[0]?.label).toBe('lift');
    expect(steps[0]?.state.height).toBe(75_000);
    expect(steps[0]?.state.pitch).toBeLessThanOrEqual(-25);
    expect(steps[1]?.label).toBe('final');
    expect(steps[1]?.state.height).toBe(1_200_000);
  });

  it('returns only final step when no near-ground boundary crossing occurs', () => {
    const steps = planNearGroundTransition(
      {
        ...BASE_STATE,
        height: 600_000
      },
      {
        ...BASE_STATE,
        height: 350_000
      }
    );

    expect(steps).toHaveLength(1);
    expect(steps[0]?.label).toBe('final');
  });
});
