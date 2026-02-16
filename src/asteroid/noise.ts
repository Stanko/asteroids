import Alea from '../utils/alea';

export type RandomFn = () => number;

export function createSeededRandom(seed: string): RandomFn {
  return Alea(seed);
}

const PERMUTATION_SIZE = 256;

export class PerlinNoise3D {
  private readonly perm: Uint8Array;

  constructor(random: RandomFn) {
    const source = new Uint8Array(PERMUTATION_SIZE);
    for (let i = 0; i < PERMUTATION_SIZE; i += 1) {
      source[i] = i;
    }

    for (let i = PERMUTATION_SIZE - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const temp = source[i];
      source[i] = source[j];
      source[j] = temp;
    }

    this.perm = new Uint8Array(PERMUTATION_SIZE * 2);
    for (let i = 0; i < PERMUTATION_SIZE * 2; i += 1) {
      this.perm[i] = source[i & 255];
    }
  }

  noise(x: number, y: number, z: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const zi = Math.floor(z) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);

    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);

    const aaa = this.perm[this.perm[this.perm[xi] + yi] + zi];
    const aba = this.perm[this.perm[this.perm[xi] + yi + 1] + zi];
    const aab = this.perm[this.perm[this.perm[xi] + yi] + zi + 1];
    const abb = this.perm[this.perm[this.perm[xi] + yi + 1] + zi + 1];
    const baa = this.perm[this.perm[this.perm[xi + 1] + yi] + zi];
    const bba = this.perm[this.perm[this.perm[xi + 1] + yi + 1] + zi];
    const bab = this.perm[this.perm[this.perm[xi + 1] + yi] + zi + 1];
    const bbb = this.perm[this.perm[this.perm[xi + 1] + yi + 1] + zi + 1];

    const x1 = lerp(grad(aaa, xf, yf, zf), grad(baa, xf - 1, yf, zf), u);
    const x2 = lerp(grad(aba, xf, yf - 1, zf), grad(bba, xf - 1, yf - 1, zf), u);
    const y1 = lerp(x1, x2, v);

    const x3 = lerp(grad(aab, xf, yf, zf - 1), grad(bab, xf - 1, yf, zf - 1), u);
    const x4 = lerp(grad(abb, xf, yf - 1, zf - 1), grad(bbb, xf - 1, yf - 1, zf - 1), u);
    const y2 = lerp(x3, x4, v);

    return lerp(y1, y2, w);
  }
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function grad(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}
