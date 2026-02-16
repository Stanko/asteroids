import {
  BufferGeometry,
  Color,
  Mesh,
  OrthographicCamera,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  SRGBColorSpace,
  NoToneMapping,
  Group,
  Quaternion,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import Alea from "./utils/alea";
import {
  generateAsteroidGeometry,
  EXPORT_BOX_SIZE,
} from "./asteroid/generateAsteroid";
import {
  cloneParams,
  normalizeParams,
  PRESET_PARAMS,
  roundTo3,
} from "./params";
import type { AppParams } from "./params";
import { parseParamsFromSearch, serializeParamsToSearch } from "./urlParams";
import { PixelArtPipeline } from "./render/post";
import {
  createPaletteToonMaterial,
  updatePaletteToonMaterial,
} from "./render/paletteMaterial";
import { createUi } from "./ui";
import { exportSpriteSheet } from "./render/export";

const URL_UPDATE_DEBOUNCE_MS = 200;
const CAMERA_DISTANCE = 5;
const VIEW_HALF_HEIGHT = 1.65;
const LIGHT_DIRECTION = new Vector3(0.45, 0.3, 1.0).normalize();
const AXIS_Z = new Vector3(0, 0, 1);

export function initApp(root: HTMLElement): void {
  root.innerHTML = "";

  const viewport = document.createElement("div");
  viewport.className = "viewport";

  const webglCanvas = document.createElement("canvas");
  webglCanvas.className = "webgl-canvas";

  const overlayCanvas = document.createElement("canvas");
  overlayCanvas.className = "overlay-canvas";

  viewport.append(webglCanvas, overlayCanvas);
  root.append(viewport);

  const renderer = new WebGLRenderer({
    canvas: webglCanvas,
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
  });
  // Keep renderer output deterministic across preview/export captures.
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = true;

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  camera.position.set(0, 0, CAMERA_DISTANCE);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  const interactionCamera = camera.clone();
  interactionCamera.position.copy(camera.position);
  interactionCamera.lookAt(0, 0, 0);

  const controls = new OrbitControls(interactionCamera, overlayCanvas);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);
  controls.update();

  const baseControlQuat = interactionCamera.quaternion.clone();

  const asteroidRoot = new Group();
  scene.add(asteroidRoot);

  const params = cloneParams(parseParamsFromSearch(window.location.search));

  let smoothGeometry = generateAsteroidGeometry({
    seed: params.seed,
    distortion: params.distortion,
    size: params.size,
  });
  let flatGeometry = createFlatGeometryVariant(smoothGeometry);

  const material = createPaletteToonMaterial(params, LIGHT_DIRECTION);
  const asteroidMesh = new Mesh(
    params.flatShading ? flatGeometry : smoothGeometry,
    material,
  );
  asteroidRoot.add(asteroidMesh);

  const pixelPipeline = new PixelArtPipeline();
  pixelPipeline.setEdgeStrengths(
    params.normalEdgeStrength,
    params.depthEdgeStrength,
  );

  let previewSize = new Vector2(1, 1);
  let previewPixelSize = 1;
  let urlTimer = 0;
  let isExporting = false;
  let previewAnimationPlaying = false;
  let previewAnimationFrame = 0;
  let previewAnimationLastStepMs = 0;
  const previewAnimationStart = new Quaternion();
  const previewAnimationStep = new Quaternion();
  const cameraQuaternion = new Quaternion();
  const inverseAsteroidQuaternion = new Quaternion();
  const cameraOffset = new Vector3();

  applyOutlineColor(params);
  applyBackgroundMode(params.bg);
  syncUrlImmediately();

  controls.addEventListener("start", () => {
    if (previewAnimationPlaying) {
      stopPreviewAnimation();
    }
  });

  const ui = createUi(params, {
    onParamPatch: (patch, options) => {
      applyParamPatch(patch, options);
    },
    isPreviewAnimationPlaying: () => previewAnimationPlaying,
    onTogglePreviewAnimation: () => {
      if (previewAnimationPlaying) {
        stopPreviewAnimation();
        return;
      }
      startPreviewAnimation();
    },
    onRandomize: () => {
      const random = Alea(`randomize|${params.seed}|${Date.now()}`);
      const seed = `asteroid-${Math.floor(random() * 0xffffffff)
        .toString(36)
        .toUpperCase()
        .padStart(7, "0")}`;
      const distortion = roundTo3(0.45 + random() * 4.55);
      const size = roundTo3(0.8 + random() * 0.3);

      applyParamPatch(
        {
          seed,
          distortion,
          size,
        },
        { regenerate: true, syncUrl: false },
      );

      queueUrlUpdate();
      ui.refresh();
    },
    onRandomizeSeed: () => {
      const random = Alea(`randomize|${params.seed}|${Date.now()}`);
      const seed = `asteroid-${Math.floor(random() * 0xffffffff)
        .toString(36)
        .toUpperCase()
        .padStart(7, "0")}`;

      applyParamPatch({ seed }, { regenerate: true, syncUrl: false });

      queueUrlUpdate();
      ui.refresh();
    },
    onApplyPreset: (preset) => {
      applyParamPatch(PRESET_PARAMS[preset], {
        regenerate: true,
        syncUrl: false,
      });
      queueUrlUpdate();
      ui.refresh();
    },
    onGenerate: async () => {
      if (isExporting) {
        return;
      }

      isExporting = true;
      controls.enabled = false;

      try {
        const filename = await exportSpriteSheet({
          renderer,
          pipeline: pixelPipeline,
          scene,
          camera,
          asteroidRoot,
          params,
          urlQuery: serializeParamsToSearch(params),
          previewConfig: {
            width: previewSize.x,
            height: previewSize.y,
            pixelSize: previewPixelSize,
          },
        });

        console.info(`Exported ${filename}`);
      } catch (error) {
        console.error("Sprite sheet export failed.", error);
      } finally {
        controls.enabled = true;
        isExporting = false;
      }
    },
  });

  window.addEventListener("resize", onResize);
  onResize();
  renderLoop();

  function applyParamPatch(
    patch: Partial<AppParams>,
    options: { regenerate?: boolean; syncUrl?: boolean } = {},
  ): void {
    const merged = normalizeParams({
      ...params,
      ...patch,
    });

    const shouldRegenerate =
      options.regenerate ??
      (patch.seed !== undefined ||
        patch.distortion !== undefined ||
        patch.size !== undefined);

    copyParams(params, merged);

    if (shouldRegenerate) {
      const previousSmooth = smoothGeometry;
      const previousFlat = flatGeometry;

      const nextGeometry = generateAsteroidGeometry({
        seed: params.seed,
        distortion: params.distortion,
        size: params.size,
      });

      smoothGeometry = nextGeometry;
      flatGeometry = createFlatGeometryVariant(nextGeometry);

      asteroidMesh.geometry = params.flatShading
        ? flatGeometry
        : smoothGeometry;

      previousSmooth.dispose();
      previousFlat.dispose();
    } else if (patch.flatShading !== undefined) {
      asteroidMesh.geometry = params.flatShading
        ? flatGeometry
        : smoothGeometry;
    }

    updatePaletteToonMaterial(material, params, LIGHT_DIRECTION);
    pixelPipeline.setEdgeStrengths(
      params.normalEdgeStrength,
      params.depthEdgeStrength,
    );
    applyOutlineColor(params);
    applyBackgroundMode(params.bg);
    updatePreviewPixelation();

    if (options.syncUrl !== false) {
      queueUrlUpdate();
    }
  }

  function onResize(): void {
    const bounds = viewport.getBoundingClientRect();
    const width = Math.min(600, Math.floor(bounds.width));
    const height = Math.min(600, Math.floor(bounds.height));

    renderer.setSize(width, height, false);

    overlayCanvas.width = width;
    overlayCanvas.height = height;

    const aspect = width / height;
    camera.left = -VIEW_HALF_HEIGHT * aspect;
    camera.right = VIEW_HALF_HEIGHT * aspect;
    camera.top = VIEW_HALF_HEIGHT;
    camera.bottom = -VIEW_HALF_HEIGHT;
    camera.updateProjectionMatrix();

    interactionCamera.left = camera.left;
    interactionCamera.right = camera.right;
    interactionCamera.top = camera.top;
    interactionCamera.bottom = camera.bottom;
    interactionCamera.updateProjectionMatrix();

    previewSize.set(width, height);
    updatePreviewPixelation();
  }

  function updatePreviewPixelation(): void {
    const minDimension = Math.max(1, Math.min(previewSize.x, previewSize.y));
    previewPixelSize = Math.max(
      1,
      Math.floor(minDimension / params.exportSizePx),
    );
    pixelPipeline.setSize(previewSize.x, previewSize.y, previewPixelSize);
  }

  function renderLoop(): void {
    requestAnimationFrame(renderLoop);

    controls.update();

    if (previewAnimationPlaying) {
      advancePreviewAnimation(performance.now());
    } else {
      asteroidRoot.quaternion
        .copy(interactionCamera.quaternion)
        .invert()
        .multiply(baseControlQuat);
      asteroidRoot.updateMatrixWorld(true);
    }

    pixelPipeline.render(renderer, scene, camera, null);
    drawExportOverlay();
  }

  function startPreviewAnimation(): void {
    previewAnimationPlaying = true;
    previewAnimationFrame = 0;
    previewAnimationLastStepMs = performance.now();
    previewAnimationStart.copy(asteroidRoot.quaternion);
    asteroidRoot.quaternion.copy(previewAnimationStart);
    asteroidRoot.updateMatrixWorld(true);
    ui.refresh();
  }

  function stopPreviewAnimation(): void {
    if (!previewAnimationPlaying) {
      return;
    }

    syncInteractionCameraToAsteroid();
    previewAnimationPlaying = false;
    ui.refresh();
  }

  function advancePreviewAnimation(nowMs: number): void {
    const stepDurationMs = 1000 / params.previewFps;
    if (nowMs - previewAnimationLastStepMs >= stepDurationMs) {
      const framesToAdvance = Math.floor(
        (nowMs - previewAnimationLastStepMs) / stepDurationMs,
      );
      previewAnimationFrame =
        (previewAnimationFrame + framesToAdvance) %
        Math.max(1, params.rotationSteps);
      previewAnimationLastStepMs += framesToAdvance * stepDurationMs;
    }

    const angle =
      (previewAnimationFrame * Math.PI * 2) / Math.max(1, params.rotationSteps);
    previewAnimationStep.setFromAxisAngle(AXIS_Z, angle);
    asteroidRoot.quaternion
      .copy(previewAnimationStart)
      .multiply(previewAnimationStep);
    asteroidRoot.updateMatrixWorld(true);
  }

  function syncInteractionCameraToAsteroid(): void {
    cameraQuaternion
      .copy(baseControlQuat)
      .multiply(
        inverseAsteroidQuaternion.copy(asteroidRoot.quaternion).invert(),
      );

    cameraOffset.set(0, 0, CAMERA_DISTANCE).applyQuaternion(cameraQuaternion);

    interactionCamera.position.copy(controls.target).add(cameraOffset);
    interactionCamera.quaternion.copy(cameraQuaternion);
    interactionCamera.updateMatrixWorld(true);
    controls.update();
  }

  function drawExportOverlay(): void {
    const context = overlayCanvas.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    const half = EXPORT_BOX_SIZE * 0.5;
    const corners = [
      new Vector3(-half, -half, 0),
      new Vector3(half, -half, 0),
      new Vector3(half, half, 0),
      new Vector3(-half, half, 0),
    ];

    const points = corners.map((corner) => {
      const projected = corner.project(camera);
      return {
        x: (projected.x * 0.5 + 0.5) * overlayCanvas.width,
        y: (-projected.y * 0.5 + 0.5) * overlayCanvas.height,
      };
    });

    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    context.lineTo(points[1].x, points[1].y);
    context.lineTo(points[2].x, points[2].y);
    context.lineTo(points[3].x, points[3].y);
    context.closePath();

    context.strokeStyle = "rgba(128,184,255,0.95)";
    context.lineWidth = 1;
    context.stroke();
  }

  function applyOutlineColor(sourceParams: AppParams): void {
    pixelPipeline.setSilhouetteOutlineColor(
      new Color(sourceParams.silhouetteOutlineColor),
    );
    pixelPipeline.setOutlineStyle(
      new Color(sourceParams.outlineShadowColor),
      new Color(sourceParams.outlineLightColor),
      sourceParams.outlineLightThreshold,
    );
  }

  function applyBackgroundMode(background: AppParams["bg"]): void {
    viewport.dataset.bg = background;
  }

  function queueUrlUpdate(): void {
    window.clearTimeout(urlTimer);
    urlTimer = window.setTimeout(() => {
      syncUrlImmediately();
    }, URL_UPDATE_DEBOUNCE_MS);
  }

  function syncUrlImmediately(): void {
    const nextSearch = serializeParamsToSearch(params);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${nextSearch}`,
    );
  }

  function copyParams(target: AppParams, source: AppParams): void {
    target.exportSizePx = source.exportSizePx;
    target.normalEdgeStrength = source.normalEdgeStrength;
    target.depthEdgeStrength = source.depthEdgeStrength;
    target.silhouetteOutlineColor = source.silhouetteOutlineColor;

    target.seed = source.seed;
    target.distortion = source.distortion;
    target.size = source.size;

    target.toonSteps = source.toonSteps;
    target.lightIntensity = source.lightIntensity;
    target.ambientIntensity = source.ambientIntensity;
    target.flatShading = source.flatShading;

    target.rotationSteps = source.rotationSteps;
    target.previewFps = source.previewFps;
    target.palette = [...source.palette];
    target.outlineShadowColor = source.outlineShadowColor;
    target.outlineLightColor = source.outlineLightColor;
    target.outlineLightThreshold = source.outlineLightThreshold;
    target.bg = source.bg;
  }
}

function createFlatGeometryVariant(source: BufferGeometry): BufferGeometry {
  const flat = source.index ? source.toNonIndexed() : source.clone();
  flat.computeVertexNormals();
  return flat;
}
