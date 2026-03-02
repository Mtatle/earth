import { describe, expect, it } from 'vitest';
import { captureCameraState, formatCameraState, normalizeLongitude, sanitizeCameraState, type CameraState } from './camera-state';

describe('camera-state helpers', () => {
  it('normalizes longitude into -180..180 range', () => {
    expect(normalizeLongitude(181)).toBe(-179);
    expect(normalizeLongitude(-191)).toBe(169);
    expect(normalizeLongitude(45)).toBe(45);
  });

  it('sanitizes camera state to safe limits', () => {
    const rawState: CameraState = {
      longitude: 250,
      latitude: 93,
      height: -50,
      heading: -7,
      pitch: -120,
      roll: 725
    };

    expect(sanitizeCameraState(rawState)).toEqual({
      longitude: -110,
      latitude: 85,
      height: 500,
      heading: 353,
      pitch: -89.5,
      roll: 5
    });
  });

  it('falls back to boot camera values for non-finite input', () => {
    const rawState: CameraState = {
      longitude: Number.NaN,
      latitude: Number.POSITIVE_INFINITY,
      height: Number.NEGATIVE_INFINITY,
      heading: Number.NaN,
      pitch: Number.POSITIVE_INFINITY,
      roll: Number.NaN
    };

    expect(sanitizeCameraState(rawState)).toEqual({
      longitude: 0,
      latitude: 12,
      height: 17_500_000,
      heading: 0,
      pitch: -88,
      roll: 0
    });
  });

  it('captures cartographic camera values in degrees', () => {
    const snapshot = captureCameraState({
      positionCartographic: {
        longitude: Math.PI / 2,
        latitude: -Math.PI / 4,
        height: 12_345
      },
      heading: Math.PI,
      pitch: -Math.PI / 6,
      roll: Math.PI / 10
    } as never);

    expect(snapshot.longitude).toBe(90);
    expect(snapshot.latitude).toBe(-45);
    expect(snapshot.height).toBe(12_345);
    expect(snapshot.heading).toBe(180);
    expect(snapshot.pitch).toBeCloseTo(-30, 3);
    expect(snapshot.roll).toBe(18);
  });

  it('formats camera state for UI badges', () => {
    expect(
      formatCameraState({
        longitude: -38.1223,
        latitude: 44.9981,
        height: 2_450_100,
        heading: 0,
        pitch: 0,
        roll: 0
      })
    ).toBe('45.00°, -38.12° @ 2450 km');
  });

  it('formats camera state using safe defaults for non-finite values', () => {
    expect(
      formatCameraState({
        longitude: Number.NaN,
        latitude: Number.POSITIVE_INFINITY,
        height: Number.NEGATIVE_INFINITY,
        heading: Number.NaN,
        pitch: Number.NaN,
        roll: Number.NaN
      })
    ).toBe('12.00°, 0.00° @ 17500 km');
  });
});
