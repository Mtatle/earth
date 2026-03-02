import type { Camera, Viewer } from 'cesium';
import { loadCesium } from './load-cesium';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;
const MIN_LATITUDE = -85;
const MAX_LATITUDE = 85;
const MIN_PITCH = -89.5;
const MAX_PITCH = 89.5;
const MIN_HEIGHT = 500;

export type CameraState = {
  longitude: number;
  latitude: number;
  height: number;
  heading: number;
  pitch: number;
  roll: number;
};

export type CameraPreset = {
  id: string;
  label: string;
  description: string;
  duration: number;
  state: CameraState;
};

export type FlyToOptions = {
  duration?: number;
  maximumHeight?: number;
};

export const DEFAULT_BOOT_CAMERA: CameraState = {
  longitude: -23.4,
  latitude: 19.1,
  height: 16_500_000,
  heading: 7,
  pitch: -48,
  roll: 0
};

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'global-overview',
    label: 'Global Overview',
    description: 'Wide situational baseline',
    duration: 2.2,
    state: DEFAULT_BOOT_CAMERA
  },
  {
    id: 'north-atlantic',
    label: 'North Atlantic',
    description: 'Transatlantic corridor focus',
    duration: 1.8,
    state: {
      longitude: -40.4,
      latitude: 49.2,
      height: 6_000_000,
      heading: 24,
      pitch: -55,
      roll: 0
    }
  },
  {
    id: 'pacific',
    label: 'Pacific Sweep',
    description: 'Broad oceanic traffic lane',
    duration: 2,
    state: {
      longitude: 164,
      latitude: 14,
      height: 9_500_000,
      heading: 335,
      pitch: -52,
      roll: 0
    }
  }
];

export function normalizeLongitude(longitude: number): number {
  const wrapped = ((longitude + 180) % 360 + 360) % 360 - 180;
  return Number(wrapped.toFixed(6));
}

export function sanitizeCameraState(state: CameraState): CameraState {
  const safeLongitude = toFiniteNumber(state.longitude, DEFAULT_BOOT_CAMERA.longitude);
  const safeLatitude = toFiniteNumber(state.latitude, DEFAULT_BOOT_CAMERA.latitude);
  const safeHeight = toFiniteNumber(state.height, DEFAULT_BOOT_CAMERA.height);
  const safeHeading = toFiniteNumber(state.heading, DEFAULT_BOOT_CAMERA.heading);
  const safePitch = toFiniteNumber(state.pitch, DEFAULT_BOOT_CAMERA.pitch);
  const safeRoll = toFiniteNumber(state.roll, DEFAULT_BOOT_CAMERA.roll);

  return {
    longitude: normalizeLongitude(safeLongitude),
    latitude: clamp(safeLatitude, MIN_LATITUDE, MAX_LATITUDE),
    height: Math.max(MIN_HEIGHT, safeHeight),
    heading: normalizeRotation(safeHeading),
    pitch: clamp(safePitch, MIN_PITCH, MAX_PITCH),
    roll: normalizeRotation(safeRoll)
  };
}

export function captureCameraState(camera: Pick<Camera, 'positionCartographic' | 'heading' | 'pitch' | 'roll'>): CameraState {
  return sanitizeCameraState({
    longitude: camera.positionCartographic.longitude * RAD_TO_DEG,
    latitude: camera.positionCartographic.latitude * RAD_TO_DEG,
    height: camera.positionCartographic.height,
    heading: camera.heading * RAD_TO_DEG,
    pitch: camera.pitch * RAD_TO_DEG,
    roll: camera.roll * RAD_TO_DEG
  });
}

export function formatCameraState(state: CameraState): string {
  const safeState = sanitizeCameraState(state);
  return `${safeState.latitude.toFixed(2)}°, ${safeState.longitude.toFixed(2)}° @ ${Math.round(safeState.height / 1000)} km`;
}

export async function flyToCameraState(
  viewer: Viewer,
  rawState: CameraState,
  options: FlyToOptions = {}
): Promise<void> {
  const Cesium = await loadCesium();
  const state = sanitizeCameraState(rawState);

  await new Promise<void>((resolve) => {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(state.longitude, state.latitude, state.height),
      orientation: {
        heading: state.heading * DEG_TO_RAD,
        pitch: state.pitch * DEG_TO_RAD,
        roll: state.roll * DEG_TO_RAD
      },
      duration: options.duration ?? 1.9,
      maximumHeight: options.maximumHeight,
      complete: resolve,
      cancel: resolve
    });
  });
}

function normalizeRotation(value: number): number {
  const wrapped = ((value % 360) + 360) % 360;
  return Number(wrapped.toFixed(3));
}

function toFiniteNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
