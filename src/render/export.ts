import {
  Color,
  NearestFilter,
  Quaternion,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
  Object3D,
  Scene,
  Camera,
} from 'three';
import type { AppParams } from '../params';
import { PixelArtPipeline } from './post';

const AXIS_Z = new Vector3(0, 0, 1);

type ExportOptions = {
  renderer: WebGLRenderer;
  pipeline: PixelArtPipeline;
  scene: Scene;
  camera: Camera;
  asteroidRoot: Object3D;
  params: AppParams;
  urlQuery: string;
  previewConfig: { width: number; height: number; pixelSize: number };
};

export async function exportSpriteSheet(options: ExportOptions): Promise<string> {
  const {
    renderer,
    pipeline,
    scene,
    camera,
    asteroidRoot,
    params,
    urlQuery,
    previewConfig,
  } = options;

  const frameSize = params.exportSizePx;
  const frameCount = params.rotationSteps;

  const cols = Math.min(16, frameCount);
  const rows = Math.ceil(frameCount / cols);
  const cellSize = frameSize + 2;
  const sheetWidth = cols * cellSize;
  const sheetHeight = rows * cellSize;

  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = sheetWidth;
  sheetCanvas.height = sheetHeight;

  const sheetCtx = sheetCanvas.getContext('2d', { alpha: true });
  if (!sheetCtx) {
    throw new Error('Unable to create 2D context for sprite sheet export.');
  }

  sheetCtx.clearRect(0, 0, sheetWidth, sheetHeight);

  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = frameSize;
  frameCanvas.height = frameSize;

  const frameCtx = frameCanvas.getContext('2d', { alpha: true });
  if (!frameCtx) {
    throw new Error('Unable to create 2D context for frame composition.');
  }

  const renderTarget = new WebGLRenderTarget(frameSize, frameSize);
  renderTarget.texture.minFilter = NearestFilter;
  renderTarget.texture.magFilter = NearestFilter;
  renderTarget.texture.generateMipmaps = false;
  renderTarget.depthBuffer = true;
  renderTarget.stencilBuffer = false;

  const pixels = new Uint8Array(frameSize * frameSize * 4);
  const startOrientation = asteroidRoot.quaternion.clone();
  const rotationStep = new Quaternion();

  const clearColor = renderer.getClearColor(new Color());
  const clearAlpha = renderer.getClearAlpha();

  renderer.setClearColor(0x000000, 0);

  pipeline.setSize(frameSize, frameSize, 1);

  for (let i = 0; i < frameCount; i += 1) {
    const angle = (i * Math.PI * 2) / frameCount;
    rotationStep.setFromAxisAngle(AXIS_Z, angle);

    asteroidRoot.quaternion.copy(startOrientation).multiply(rotationStep);
    asteroidRoot.updateMatrixWorld(true);

    // Export is rendered from WebGL only; the 2D preview overlay is never sampled here.
    pipeline.render(renderer, scene, camera, renderTarget);

    renderer.readRenderTargetPixels(renderTarget, 0, 0, frameSize, frameSize, pixels);

    const flipped = flipY(pixels, frameSize, frameSize);
    const imageData = new ImageData(flipped, frameSize, frameSize);
    frameCtx.putImageData(imageData, 0, 0);

    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellSize + 1;
    const y = row * cellSize + 1;

    sheetCtx.drawImage(frameCanvas, x, y);
  }

  asteroidRoot.quaternion.copy(startOrientation);
  asteroidRoot.updateMatrixWorld(true);

  pipeline.setSize(previewConfig.width, previewConfig.height, previewConfig.pixelSize);

  renderTarget.dispose();

  renderer.setClearColor(clearColor, clearAlpha);

  const orientationKey = [
    startOrientation.x.toFixed(4),
    startOrientation.y.toFixed(4),
    startOrientation.z.toFixed(4),
    startOrientation.w.toFixed(4),
  ].join(',');
  const hash = fnv1a(`${urlQuery}|oq=${orientationKey}`).slice(0, 10);

  const filename = `asteroid_${hash}.png`;
  await downloadCanvas(sheetCanvas, filename);
  return filename;
}

function flipY(source: Uint8Array, width: number, height: number): Uint8ClampedArray<ArrayBuffer> {
  const rowSize = width * 4;
  const out = new Uint8ClampedArray(new ArrayBuffer(source.length));

  for (let y = 0; y < height; y += 1) {
    const srcOffset = (height - 1 - y) * rowSize;
    const dstOffset = y * rowSize;
    out.set(source.subarray(srcOffset, srcOffset + rowSize), dstOffset);
  }

  return out;
}

async function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((file) => resolve(file), 'image/png');
  });

  const url = blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png');

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  if (blob) {
    URL.revokeObjectURL(url);
  }
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).toUpperCase();
}
