import { sanitizeCameraState, type CameraState } from './camera-state';

const DEFAULT_MIN_ZOOM_HEIGHT = 350;
const DEFAULT_MAX_ZOOM_HEIGHT = 24_000_000;
const DEFAULT_NEAR_GROUND_HEIGHT = 12_000;
const DEFAULT_TRANSITION_BUFFER_HEIGHT = 75_000;

const LOW_ALTITUDE_PITCH_MIN = -89;
const HIGH_ALTITUDE_PITCH_MIN = -82;
const LOW_ALTITUDE_PITCH_MAX = 6;
const HIGH_ALTITUDE_PITCH_MAX = 65;

export type CameraInteractionOptions = {
  minZoomHeight?: number;
  maxZoomHeight?: number;
  nearGroundHeight?: number;
  transitionBufferHeight?: number;
};

export type PitchConstraint = {
  minPitch: number;
  maxPitch: number;
};

export type CameraTransitionStep = {
  label: 'lift' | 'approach' | 'final';
  state: CameraState;
  duration: number;
};

const MIN_DURATION_SECONDS = 0.65;
const MAX_DURATION_SECONDS = 2.8;

export function clampZoomHeight(height: number, options: CameraInteractionOptions = {}): number {
  const minZoomHeight = options.minZoomHeight ?? DEFAULT_MIN_ZOOM_HEIGHT;
  const maxZoomHeight = options.maxZoomHeight ?? DEFAULT_MAX_ZOOM_HEIGHT;
  return clamp(height, minZoomHeight, maxZoomHeight);
}

export function resolvePitchConstraintForAltitude(height: number, options: CameraInteractionOptions = {}): PitchConstraint {
  const clampedHeight = clampZoomHeight(height, options);
  const altitudeRatio = clamp(clampedHeight / 1_000_000, 0, 1);

  return {
    minPitch: roundTo3(lerp(LOW_ALTITUDE_PITCH_MIN, HIGH_ALTITUDE_PITCH_MIN, altitudeRatio)),
    maxPitch: roundTo3(lerp(LOW_ALTITUDE_PITCH_MAX, HIGH_ALTITUDE_PITCH_MAX, altitudeRatio))
  };
}

export function clampPitchForAltitude(pitch: number, height: number, options: CameraInteractionOptions = {}): number {
  const { minPitch, maxPitch } = resolvePitchConstraintForAltitude(height, options);
  return roundTo3(clamp(pitch, minPitch, maxPitch));
}

export function enforceCameraInteractionConstraints(
  rawState: CameraState,
  options: CameraInteractionOptions = {}
): CameraState {
  const sanitizedState = sanitizeCameraState(rawState);
  const constrainedHeight = clampZoomHeight(sanitizedState.height, options);
  const constrainedPitch = clampPitchForAltitude(sanitizedState.pitch, constrainedHeight, options);

  return {
    ...sanitizedState,
    height: constrainedHeight,
    pitch: constrainedPitch
  };
}

export function planNearGroundTransition(
  fromRawState: CameraState,
  toRawState: CameraState,
  options: CameraInteractionOptions = {}
): CameraTransitionStep[] {
  const fromState = enforceCameraInteractionConstraints(fromRawState, options);
  const targetState = enforceCameraInteractionConstraints(toRawState, options);

  const nearGroundHeight = options.nearGroundHeight ?? DEFAULT_NEAR_GROUND_HEIGHT;
  const transitionBufferHeight = options.transitionBufferHeight ?? DEFAULT_TRANSITION_BUFFER_HEIGHT;
  const transitionHeight = Math.max(nearGroundHeight, transitionBufferHeight);

  const steps: CameraTransitionStep[] = [];

  const descendingIntoNearGround = fromState.height > transitionHeight && targetState.height <= nearGroundHeight;
  const ascendingOutOfNearGround = fromState.height <= nearGroundHeight && targetState.height > transitionHeight;

  if (ascendingOutOfNearGround) {
    const liftState = enforceCameraInteractionConstraints(
      {
        ...fromState,
        height: transitionHeight,
        pitch: Math.min(fromState.pitch, -25)
      },
      options
    );

    steps.push({
      label: 'lift',
      state: liftState,
      duration: estimateDurationSeconds(fromState.height, liftState.height)
    });
  }

  if (descendingIntoNearGround) {
    const approachState = enforceCameraInteractionConstraints(
      {
        ...targetState,
        height: transitionHeight,
        pitch: Math.min(targetState.pitch, -30)
      },
      options
    );

    steps.push({
      label: 'approach',
      state: approachState,
      duration: estimateDurationSeconds(fromState.height, approachState.height)
    });
  }

  const lastHeight = steps.length > 0 ? steps[steps.length - 1]?.state.height ?? fromState.height : fromState.height;

  steps.push({
    label: 'final',
    state: targetState,
    duration: estimateDurationSeconds(lastHeight, targetState.height)
  });

  return steps;
}

function estimateDurationSeconds(fromHeight: number, toHeight: number): number {
  const delta = Math.abs(toHeight - fromHeight);
  const normalizedDelta = clamp(Math.log10(delta + 1) / 6, 0, 1);
  return roundTo3(lerp(MIN_DURATION_SECONDS, MAX_DURATION_SECONDS, normalizedDelta));
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundTo3(value: number): number {
  return Number(value.toFixed(3));
}
