import { Color, ShaderMaterial, Vector3 } from "three";
import type { AppParams } from "../params";

export type PaletteToonMaterial = ShaderMaterial;

export function createPaletteToonMaterial(
  params: AppParams,
  lightDirection: Vector3,
): PaletteToonMaterial {
  const material = new ShaderMaterial({
    name: "PaletteToonMaterial",
    uniforms: {
      uPalette0: { value: new Color(params.palette[0]) },
      uPalette1: { value: new Color(params.palette[1]) },
      uPalette2: { value: new Color(params.palette[2]) },
      uPalette3: { value: new Color(params.palette[3]) },
      uPalette4: { value: new Color(params.palette[4]) },
      uToonSteps: { value: params.toonSteps },
      uLightDir: { value: lightDirection.clone().normalize() },
      uLightIntensity: { value: params.lightIntensity },
      uAmbientIntensity: { value: params.ambientIntensity },
      uHighlightAmount: { value: params.highlightAmount },
      uHighlightOpacity: { value: params.highlightOpacity },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;

      void main() {
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uPalette0;
      uniform vec3 uPalette1;
      uniform vec3 uPalette2;
      uniform vec3 uPalette3;
      uniform vec3 uPalette4;
      uniform float uToonSteps;
      uniform vec3 uLightDir;
      uniform float uLightIntensity;
      uniform float uAmbientIntensity;
      uniform float uHighlightAmount;
      uniform float uHighlightOpacity;

      varying vec3 vWorldNormal;

      vec3 paletteLookup(float idx) {
        if (idx < 0.5) {
          return uPalette0;
        }
        if (idx < 1.5) {
          return uPalette1;
        }
        if (idx < 2.5) {
          return uPalette2;
        }
        if (idx < 3.5) {
          return uPalette3;
        }
        return uPalette4;
      }

      void main() {
        vec3 n = normalize(vWorldNormal);
        vec3 l = normalize(uLightDir);

        float diffuse = max(dot(n, l), 0.0);
        float lit = clamp(uAmbientIntensity + diffuse * uLightIntensity, 0.0, 1.0);

        float steps = max(uToonSteps, 2.0);
        float bucket = floor(lit * steps);
        bucket = min(bucket, steps - 1.0);
        float bucket01 = bucket / (steps - 1.0);

        float paletteIndex = floor(clamp(bucket01, 0.0, 1.0) * 4.999);
        vec3 toonColor = paletteLookup(paletteIndex);
        float highlightThreshold = mix(1.001, 0.82, clamp(uHighlightAmount, 0.0, 1.0));
        float highlightMask = step(highlightThreshold, diffuse);
        // Keep highlight discrete: binary mask on only the brightest toon band.
        highlightMask *= step(steps - 1.0 - 0.001, bucket);
        float highlightBlend = highlightMask * clamp(uHighlightOpacity, 0.0, 1.0);
        vec3 finalColor = mix(toonColor, vec3(1.0), highlightBlend);

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });

  return material;
}

export function updatePaletteToonMaterial(
  material: PaletteToonMaterial,
  params: AppParams,
  lightDirection: Vector3,
): void {
  material.uniforms.uPalette0.value.set(params.palette[0]);
  material.uniforms.uPalette1.value.set(params.palette[1]);
  material.uniforms.uPalette2.value.set(params.palette[2]);
  material.uniforms.uPalette3.value.set(params.palette[3]);
  material.uniforms.uPalette4.value.set(params.palette[4]);
  material.uniforms.uToonSteps.value = params.toonSteps;
  material.uniforms.uLightDir.value.copy(lightDirection).normalize();
  material.uniforms.uLightIntensity.value = params.lightIntensity;
  material.uniforms.uAmbientIntensity.value = params.ambientIntensity;
  material.uniforms.uHighlightAmount.value = params.highlightAmount;
  material.uniforms.uHighlightOpacity.value = params.highlightOpacity;
}
