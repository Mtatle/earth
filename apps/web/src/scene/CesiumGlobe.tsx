import { useEffect, useRef, useState } from 'react';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import type { Viewer } from 'cesium';
import { CAMERA_PRESETS, captureCameraState, DEFAULT_BOOT_CAMERA, flyToCameraState, formatCameraState } from './camera-state';
import { loadCesium } from './load-cesium';

type GlobeStatus = 'loading' | 'ready' | 'error' | 'unsupported';

export function CesiumGlobe() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [status, setStatus] = useState<GlobeStatus>('loading');
  const [cameraSnapshot, setCameraSnapshot] = useState<string>('Initializing camera...');

  useEffect(() => {
    let canceled = false;
    let detachCameraListener: (() => void) | null = null;

    const bootstrap = async () => {
      if (!containerRef.current) {
        return;
      }

      if (!supportsWebGl()) {
        setStatus('unsupported');
        setCameraSnapshot('No hardware acceleration');
        return;
      }

      try {
        const Cesium = await loadCesium();
        if (canceled || !containerRef.current) {
          return;
        }

        const viewer = new Cesium.Viewer(containerRef.current, {
          animation: false,
          timeline: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          scene3DOnly: true,
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity
        });

        viewerRef.current = viewer;
        viewer.targetFrameRate = 60;
        viewer.scene.globe.enableLighting = true;
        viewer.scene.postProcessStages.fxaa.enabled = true;
        viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 1.5);
        const credits = viewer.cesiumWidget.creditContainer as HTMLElement | null;
        if (credits) {
          credits.style.display = 'none';
        }
        viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

        await flyToCameraState(viewer, DEFAULT_BOOT_CAMERA, { duration: 2.4, maximumHeight: 18_000_000 });
        if (canceled) {
          return;
        }

        const syncCameraState = () => {
          setCameraSnapshot(formatCameraState(captureCameraState(viewer.camera)));
        };

        syncCameraState();
        viewer.camera.changed.addEventListener(syncCameraState);
        detachCameraListener = () => viewer.camera.changed.removeEventListener(syncCameraState);
        setStatus('ready');
      } catch (error) {
        console.error('Failed to bootstrap Cesium viewer', error);
        if (!canceled) {
          setStatus('error');
          setCameraSnapshot('Initialization failed');
        }
      }
    };

    void bootstrap();

    return () => {
      canceled = true;
      detachCameraListener?.();
      const viewer = viewerRef.current;
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
    };
  }, []);

  const runPreset = async (presetId: string) => {
    const preset = CAMERA_PRESETS.find((item) => item.id === presetId);
    const viewer = viewerRef.current;
    if (!preset || !viewer) {
      return;
    }
    await flyToCameraState(viewer, preset.state, { duration: preset.duration });
  };

  return (
    <div className={`globe-shell globe-${status}`}>
      <div className="globe-canvas" ref={containerRef} data-testid="cesium-canvas" />

      <div className="globe-overlay">
        <div className="globe-status-bar" aria-live="polite">
          <p className="kicker">Render</p>
          <p className="status-value">{statusToLabel(status)}</p>
        </div>

        <div className="globe-status-bar">
          <p className="kicker">Camera</p>
          <p className="status-value">{cameraSnapshot}</p>
        </div>

        <div className="preset-grid" role="group" aria-label="Camera presets">
          {CAMERA_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="preset-button"
              onClick={() => void runPreset(preset.id)}
              disabled={status !== 'ready'}
            >
              <span>{preset.label}</span>
              <small>{preset.description}</small>
            </button>
          ))}
        </div>
      </div>

      {status !== 'ready' ? (
        <div className="globe-banner" role="status">
          {statusMessage(status)}
        </div>
      ) : null}
    </div>
  );
}

function supportsWebGl(): boolean {
  if (typeof window === 'undefined' || !('WebGLRenderingContext' in window)) {
    return false;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  return Boolean(context);
}

function statusToLabel(status: GlobeStatus): string {
  if (status === 'ready') {
    return 'Live at 60 FPS target';
  }
  if (status === 'loading') {
    return 'Booting scene';
  }
  if (status === 'unsupported') {
    return 'WebGL unavailable';
  }
  return 'Failed';
}

function statusMessage(status: GlobeStatus): string {
  if (status === 'loading') {
    return 'Starting globe renderer...';
  }
  if (status === 'unsupported') {
    return 'WebGL is unavailable in this environment. Enable hardware acceleration to view the globe.';
  }
  return 'Globe renderer failed to initialize. Check browser graphics settings and reload.';
}
