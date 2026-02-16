import { BufferAttribute, BufferGeometry, IcosahedronGeometry, Vector3 } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PerlinNoise3D, createSeededRandom } from './noise';

export const EXPORT_BOX_SIZE = 2;
const FIT_SAFETY = 0.95;
const BASE_RADIUS = 0.92;
const SUBDIVISIONS = 5;

type Lump = {
  direction: Vector3;
  amplitude: number;
  threshold: number;
};

type AsteroidGeometryOptions = {
  seed: string;
  distortion: number;
  size: number;
};

export function generateAsteroidGeometry(options: AsteroidGeometryOptions): BufferGeometry {
  const random = createSeededRandom(options.seed);
  const noise = new PerlinNoise3D(random);

  const geometry = new IcosahedronGeometry(BASE_RADIUS, SUBDIVISIONS);
  const position = geometry.getAttribute('position');

  if (!(position instanceof BufferAttribute)) {
    throw new Error('Expected position buffer attribute on asteroid geometry.');
  }

  const axisScale = new Vector3(
    randomBetween(random, 0.72, 1.3),
    randomBetween(random, 0.72, 1.3),
    randomBetween(random, 0.72, 1.3),
  );
  const axisAverage = (axisScale.x + axisScale.y + axisScale.z) / 3;
  axisScale.multiplyScalar(1 / axisAverage);

  const baseFrequency = randomBetween(random, 0.7, 1.25);
  const secondaryFrequency = randomBetween(random, 1.5, 2.7);
  const detailFrequency = randomBetween(random, 2.8, 4.6);

  const warpFrequency = randomBetween(random, 0.55, 1.0);
  const warpAmplitude = randomBetween(random, 0.16, 0.34);

  const lumpCount = 2 + Math.floor(random() * 3);
  const lumps: Lump[] = [];
  for (let i = 0; i < lumpCount; i += 1) {
    lumps.push({
      direction: randomDirection(random),
      amplitude: randomBetween(random, 0.16, 0.28),
      threshold: randomBetween(random, 0.2, 0.55),
    });
  }

  const temp = new Vector3();
  const warped = new Vector3();

  for (let i = 0; i < position.count; i += 1) {
    temp.fromBufferAttribute(position, i).multiply(axisScale).normalize();

    const warpX = noise.noise(
      temp.x * warpFrequency + 11.5,
      temp.y * warpFrequency - 3.2,
      temp.z * warpFrequency + 4.4,
    );
    const warpY = noise.noise(
      temp.x * warpFrequency - 7.1,
      temp.y * warpFrequency + 9.7,
      temp.z * warpFrequency - 2.6,
    );
    const warpZ = noise.noise(
      temp.x * warpFrequency + 2.4,
      temp.y * warpFrequency + 6.8,
      temp.z * warpFrequency + 13.9,
    );

    warped.set(temp.x + warpX * warpAmplitude, temp.y + warpY * warpAmplitude, temp.z + warpZ * warpAmplitude);

    const layerA = noise.noise(
      warped.x * baseFrequency,
      warped.y * baseFrequency,
      warped.z * baseFrequency,
    );

    const layerB = noise.noise(
      warped.x * secondaryFrequency + 17.3,
      warped.y * secondaryFrequency - 9.1,
      warped.z * secondaryFrequency + 5.2,
    );

    const layerC = noise.noise(
      warped.x * detailFrequency - 4.5,
      warped.y * detailFrequency + 12.7,
      warped.z * detailFrequency - 8.3,
    );

    let lumpInfluence = 0;
    for (const lump of lumps) {
      const alignment = temp.dot(lump.direction);
      const local = Math.max(0, alignment - lump.threshold);
      lumpInfluence += lump.amplitude * local * local;
    }

    const blendedNoise = layerA * 0.55 + layerB * 0.32 + layerC * 0.13 + lumpInfluence;
    const softened = Math.tanh(blendedNoise * 1.35) / 1.35;
    const displacement = softened * options.distortion * 0.55;
    const radius = BASE_RADIUS * (1 + displacement);

    temp.multiplyScalar(radius);
    position.setXYZ(i, temp.x, temp.y, temp.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();

  autoCenterAndFit(geometry, options.size);

  // PolyhedronGeometry is non-indexed by default. Weld vertices to get true smooth normals.
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  const smoothGeometry = mergeVertices(geometry, 1e-5);
  smoothGeometry.computeVertexNormals();
  smoothGeometry.computeBoundingBox();
  smoothGeometry.computeBoundingSphere();

  return smoothGeometry;
}

function autoCenterAndFit(geometry: BufferGeometry, size: number): void {
  const position = geometry.getAttribute('position');

  if (!(position instanceof BufferAttribute)) {
    throw new Error('Expected position buffer attribute while fitting asteroid geometry.');
  }

  geometry.computeBoundingBox();
  if (!geometry.boundingBox) {
    return;
  }

  const center = geometry.boundingBox.getCenter(new Vector3());
  const temp = new Vector3();

  for (let i = 0; i < position.count; i += 1) {
    temp.fromBufferAttribute(position, i).sub(center);
    position.setXYZ(i, temp.x, temp.y, temp.z);
  }

  position.needsUpdate = true;

  geometry.computeBoundingSphere();
  const radius = geometry.boundingSphere?.radius ?? 1;

  const targetRadius = (EXPORT_BOX_SIZE * 0.5) * FIT_SAFETY * size;
  const scale = radius > 0 ? targetRadius / radius : 1;

  for (let i = 0; i < position.count; i += 1) {
    temp.fromBufferAttribute(position, i).multiplyScalar(scale);
    position.setXYZ(i, temp.x, temp.y, temp.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

function randomDirection(random: () => number): Vector3 {
  const z = randomBetween(random, -1, 1);
  const theta = randomBetween(random, 0, Math.PI * 2);
  const radius = Math.sqrt(Math.max(0, 1 - z * z));
  return new Vector3(radius * Math.cos(theta), radius * Math.sin(theta), z).normalize();
}

function randomBetween(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}
