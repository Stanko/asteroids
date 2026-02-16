import {
  Color,
  DepthTexture,
  HalfFloatType,
  MeshNormalMaterial,
  NearestFilter,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector4,
  WebGLRenderTarget,
  WebGLRenderer,
  Camera,
} from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

export class PixelArtPipeline {
  private readonly normalMaterial: MeshNormalMaterial;
  private readonly beautyRenderTarget: WebGLRenderTarget;
  private readonly normalRenderTarget: WebGLRenderTarget;
  private readonly compositeMaterial: ShaderMaterial;
  private readonly fsQuad: FullScreenQuad;
  private readonly resolution = new Vector2(1, 1);
  private readonly renderResolution = new Vector2(1, 1);

  private pixelSize = 1;

  constructor() {
    this.normalMaterial = new MeshNormalMaterial();

    this.beautyRenderTarget = new WebGLRenderTarget(1, 1);
    this.beautyRenderTarget.texture.minFilter = NearestFilter;
    this.beautyRenderTarget.texture.magFilter = NearestFilter;
    this.beautyRenderTarget.texture.type = HalfFloatType;
    this.beautyRenderTarget.depthTexture = new DepthTexture(1, 1);

    this.normalRenderTarget = new WebGLRenderTarget(1, 1);
    this.normalRenderTarget.texture.minFilter = NearestFilter;
    this.normalRenderTarget.texture.magFilter = NearestFilter;
    this.normalRenderTarget.texture.type = HalfFloatType;

    this.compositeMaterial = createCompositeMaterial();
    this.fsQuad = new FullScreenQuad(this.compositeMaterial);
  }

  setSize(width: number, height: number, pixelSize = this.pixelSize): void {
    this.resolution.set(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));

    this.pixelSize = Math.max(1, Math.floor(pixelSize));

    const renderWidth = Math.max(1, Math.floor(this.resolution.x / this.pixelSize));
    const renderHeight = Math.max(1, Math.floor(this.resolution.y / this.pixelSize));
    this.renderResolution.set(renderWidth, renderHeight);

    this.beautyRenderTarget.setSize(renderWidth, renderHeight);
    this.normalRenderTarget.setSize(renderWidth, renderHeight);

    this.compositeMaterial.uniforms.resolution.value.set(
      renderWidth,
      renderHeight,
      1 / renderWidth,
      1 / renderHeight,
    );
  }

  getConfig(): { width: number; height: number; pixelSize: number } {
    return {
      width: this.resolution.x,
      height: this.resolution.y,
      pixelSize: this.pixelSize,
    };
  }

  setEdgeStrengths(normalEdgeStrength: number, depthEdgeStrength: number): void {
    this.compositeMaterial.uniforms.normalEdgeStrength.value = Math.min(1, Math.max(0, normalEdgeStrength));
    this.compositeMaterial.uniforms.depthEdgeStrength.value = Math.min(1, Math.max(0, depthEdgeStrength));
  }

  setSilhouetteOutlineColor(color: Color): void {
    this.compositeMaterial.uniforms.silhouetteOutlineColor.value.copy(color);
  }

  setOutlineStyle(shadowColor: Color, lightColor: Color, threshold: number): void {
    this.compositeMaterial.uniforms.outlineShadowColor.value.copy(shadowColor);
    this.compositeMaterial.uniforms.outlineLightColor.value.copy(lightColor);
    this.compositeMaterial.uniforms.outlineLightThreshold.value = Math.min(1, Math.max(0, threshold));
  }

  render(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    outputTarget: WebGLRenderTarget | null,
  ): void {
    renderer.setRenderTarget(this.beautyRenderTarget);
    renderer.clear();
    renderer.render(scene, camera);

    // Match the RenderPixelatedPass flow: beauty pass + normal/depth edge pass + fullscreen composite.
    const originalOverride = scene.overrideMaterial;
    scene.overrideMaterial = this.normalMaterial;

    renderer.setRenderTarget(this.normalRenderTarget);
    renderer.clear();
    renderer.render(scene, camera);

    scene.overrideMaterial = originalOverride;

    this.compositeMaterial.uniforms.tDiffuse.value = this.beautyRenderTarget.texture;
    this.compositeMaterial.uniforms.tDepth.value = this.beautyRenderTarget.depthTexture;
    this.compositeMaterial.uniforms.tNormal.value = this.normalRenderTarget.texture;

    renderer.setRenderTarget(outputTarget);
    renderer.clear();
    this.fsQuad.render(renderer);
  }

  dispose(): void {
    this.normalMaterial.dispose();
    this.beautyRenderTarget.dispose();
    this.normalRenderTarget.dispose();
    this.compositeMaterial.dispose();
    this.fsQuad.dispose();
  }
}

function createCompositeMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: null },
      tNormal: { value: null },
      resolution: { value: new Vector4(1, 1, 1, 1) },
      normalEdgeStrength: { value: 1 },
      depthEdgeStrength: { value: 1 },
      silhouetteOutlineColor: { value: new Color('#5F6DDA') },
      outlineShadowColor: { value: new Color('#141219') },
      outlineLightColor: { value: new Color('#5A5961') },
      outlineLightThreshold: { value: 0.58 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform sampler2D tDepth;
      uniform sampler2D tNormal;
      uniform vec4 resolution;
      uniform float normalEdgeStrength;
      uniform float depthEdgeStrength;
      uniform vec3 silhouetteOutlineColor;
      uniform vec3 outlineShadowColor;
      uniform vec3 outlineLightColor;
      uniform float outlineLightThreshold;

      varying vec2 vUv;

      float getDepth(int x, int y) {
        return texture2D(tDepth, vUv + vec2(x, y) * resolution.zw).r;
      }

      vec3 getNormal(int x, int y) {
        return texture2D(tNormal, vUv + vec2(x, y) * resolution.zw).rgb * 2.0 - 1.0;
      }

      float getAlpha(int x, int y) {
        return texture2D(tDiffuse, vUv + vec2(x, y) * resolution.zw).a;
      }

      float depthEdgeIndicator(float depth) {
        float diff = 0.0;
        diff += clamp(getDepth(1, 0) - depth, 0.0, 1.0);
        diff += clamp(getDepth(-1, 0) - depth, 0.0, 1.0);
        diff += clamp(getDepth(0, 1) - depth, 0.0, 1.0);
        diff += clamp(getDepth(0, -1) - depth, 0.0, 1.0);
        return floor(smoothstep(0.01, 0.02, diff) * 2.0) / 2.0;
      }

      float neighborNormalEdgeIndicator(int x, int y, float depth, vec3 normal) {
        float depthDiff = getDepth(x, y) - depth;
        vec3 neighborNormal = getNormal(x, y);

        vec3 normalEdgeBias = vec3(1.0, 1.0, 1.0);
        float normalDiff = dot(normal - neighborNormal, normalEdgeBias);
        float normalIndicator = clamp(smoothstep(-0.01, 0.01, normalDiff), 0.0, 1.0);

        float depthIndicator = clamp(sign(depthDiff * 0.25 + 0.0025), 0.0, 1.0);

        return (1.0 - dot(normal, neighborNormal)) * depthIndicator * normalIndicator;
      }

      float normalEdgeIndicator(float depth, vec3 normal) {
        float indicator = 0.0;
        indicator += neighborNormalEdgeIndicator(0, -1, depth, normal);
        indicator += neighborNormalEdgeIndicator(0, 1, depth, normal);
        indicator += neighborNormalEdgeIndicator(-1, 0, depth, normal);
        indicator += neighborNormalEdgeIndicator(1, 0, depth, normal);
        return step(0.1, indicator);
      }

      float silhouetteOutlineIndicator(float alpha) {
        if (alpha > 0.0) {
          return 0.0;
        }

        float neighborAlpha = 0.0;
        neighborAlpha = max(neighborAlpha, getAlpha(0, -1));
        neighborAlpha = max(neighborAlpha, getAlpha(-1, 0));
        neighborAlpha = max(neighborAlpha, getAlpha(1, 0));
        neighborAlpha = max(neighborAlpha, getAlpha(0, 1));

        return step(0.001, neighborAlpha);
      }

      void main() {
        vec4 texel = texture2D(tDiffuse, vUv);
        float soi = silhouetteOutlineIndicator(texel.a);

        if (texel.a <= 0.0) {
          if (soi > 0.0) {
            gl_FragColor = vec4(silhouetteOutlineColor, 1.0);
            return;
          }
          gl_FragColor = vec4(0.0);
          return;
        }

        float depth = getDepth(0, 0);
        vec3 normal = getNormal(0, 0);

        float dei = depthEdgeStrength > 0.0 ? depthEdgeIndicator(depth) : 0.0;
        float nei = normalEdgeStrength > 0.0 ? normalEdgeIndicator(depth, normal) : 0.0;

        float edgeMix = max(
          clamp(depthEdgeStrength * dei, 0.0, 1.0),
          clamp(normalEdgeStrength * nei, 0.0, 1.0)
        );

        float brightness = dot(texel.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 outlineColor = brightness >= outlineLightThreshold ? outlineLightColor : outlineShadowColor;
        vec3 color = mix(texel.rgb, outlineColor, edgeMix);
        gl_FragColor = vec4(color, texel.a);
      }
    `,
  });
}
