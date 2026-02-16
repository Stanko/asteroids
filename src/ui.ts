import GUI from "lil-gui";
import type { AppParams, PresetName } from "./params";

export type UiBindings = {
  onParamPatch: (
    patch: Partial<AppParams>,
    options?: { regenerate?: boolean },
  ) => void;
  isPreviewAnimationPlaying: () => boolean;
  onTogglePreviewAnimation: () => void;
  onRandomize: () => void;
  onRandomizeSeed: () => void;
  onApplyPreset: (preset: PresetName) => void;
  onGenerate: () => void;
};

export type AppUi = {
  refresh: () => void;
  destroy: () => void;
};

export function createUi(params: AppParams, bindings: UiBindings): AppUi {
  const gui = new GUI({ title: "Asteroid Sprite Lab" });

  const paletteProxy = {
    p0: params.palette[0],
    p1: params.palette[1],
    p2: params.palette[2],
    p3: params.palette[3],
    silhouetteOutline: params.silhouetteOutlineColor,
    outlineShadow: params.outlineShadowColor,
    outlineLight: params.outlineLightColor,
  };

  const actions = {
    TogglePreviewAnimation: () => bindings.onTogglePreviewAnimation(),
    Randomize: () => bindings.onRandomize(),
    RandomizeSeed: () => bindings.onRandomizeSeed(),
    PresetSM: () => bindings.onApplyPreset("sm"),
    PresetMD: () => bindings.onApplyPreset("md"),
    PresetLG: () => bindings.onApplyPreset("lg"),
    Generate: () => bindings.onGenerate(),
  };

  const frameFolder = gui.addFolder("Frame / Export");
  frameFolder
    .add(params, "exportSizePx", 16, 256, 1)
    .name("exportSizePx")
    .onChange((value: number) => {
      bindings.onParamPatch({ exportSizePx: value });
    });
  frameFolder
    .add(params, "rotationSteps", 1, 256, 1)
    .name("rotationSteps")
    .onChange((value: number) => {
      bindings.onParamPatch({ rotationSteps: value });
    });
  const shapeFolder = gui.addFolder("Asteroid");
  shapeFolder
    .add(params, "seed")
    .name("seed")
    .onFinishChange((value: string) => {
      bindings.onParamPatch({ seed: value }, { regenerate: true });
    });
  shapeFolder
    .add(params, "distortion", 0, 5, 0.001)
    .name("distortion")
    .onChange((value: number) => {
      bindings.onParamPatch({ distortion: value }, { regenerate: true });
    });
  shapeFolder
    .add(params, "size", 0.4, 1.2, 0.001)
    .name("size")
    .onChange((value: number) => {
      bindings.onParamPatch({ size: value }, { regenerate: true });
    });

  const shadeFolder = gui.addFolder("Shading");
  shadeFolder
    .add(params, "toonSteps", 2, 8, 1)
    .name("toonSteps")
    .onChange((value: number) => {
      bindings.onParamPatch({ toonSteps: value });
    });
  shadeFolder
    .add(params, "lightIntensity", 0, 3, 0.001)
    .name("lightIntensity")
    .onChange((value: number) => {
      bindings.onParamPatch({ lightIntensity: value });
    });
  shadeFolder
    .add(params, "ambientIntensity", 0, 1, 0.001)
    .name("ambientIntensity")
    .onChange((value: number) => {
      bindings.onParamPatch({ ambientIntensity: value });
    });
  shadeFolder
    .add(params, "flatShading")
    .name("flatShading")
    .onChange((value: boolean) => {
      bindings.onParamPatch({ flatShading: value });
    });

  const edgeFolder = gui.addFolder("Pixel / Edge");
  edgeFolder
    .addColor(paletteProxy, "silhouetteOutline")
    .name("silhouetteOutlineColor")
    .onChange((value: string) => {
      bindings.onParamPatch({
        silhouetteOutlineColor: value as AppParams["silhouetteOutlineColor"],
      });
    });
  edgeFolder
    .add(params, "normalEdgeStrength", 0, 1, 0.001)
    .name("normalEdgeStrength")
    .onChange((value: number) => {
      bindings.onParamPatch({ normalEdgeStrength: value });
    });
  edgeFolder
    .add(params, "depthEdgeStrength", 0, 1, 0.001)
    .name("depthEdgeStrength")
    .onChange((value: number) => {
      bindings.onParamPatch({ depthEdgeStrength: value });
    });
  edgeFolder
    .add(params, "outlineLightThreshold", 0, 1, 0.001)
    .name("outlineLightThreshold")
    .onChange((value: number) => {
      bindings.onParamPatch({ outlineLightThreshold: value });
    });

  const paletteFolder = gui.addFolder("Palette");
  paletteFolder
    .addColor(paletteProxy, "p0")
    .name("palette[0]")
    .onChange((value: string) => updatePalette(0, value));
  paletteFolder
    .addColor(paletteProxy, "p1")
    .name("palette[1]")
    .onChange((value: string) => updatePalette(1, value));
  paletteFolder
    .addColor(paletteProxy, "p2")
    .name("palette[2]")
    .onChange((value: string) => updatePalette(2, value));
  paletteFolder
    .addColor(paletteProxy, "p3")
    .name("palette[3]")
    .onChange((value: string) => updatePalette(3, value));
  paletteFolder
    .addColor(paletteProxy, "outlineShadow")
    .name("outlineShadowColor")
    .onChange((value: string) => {
      bindings.onParamPatch({
        outlineShadowColor: value as AppParams["outlineShadowColor"],
      });
    });
  paletteFolder
    .addColor(paletteProxy, "outlineLight")
    .name("outlineLightColor")
    .onChange((value: string) => {
      bindings.onParamPatch({
        outlineLightColor: value as AppParams["outlineLightColor"],
      });
    });

  const previewFolder = gui.addFolder("Preview");
  previewFolder
    .add(params, "previewFps", 1, 30, 1)
    .name("previewFps")
    .onChange((value: number) => {
      bindings.onParamPatch({ previewFps: value });
    });
  previewFolder
    .add(params, "bg", ["checker", "transparent"])
    .name("background")
    .onChange((value: AppParams["bg"]) => {
      bindings.onParamPatch({ bg: value });
    });
  const playPauseController = previewFolder
    .add(actions, "TogglePreviewAnimation")
    .name(bindings.isPreviewAnimationPlaying() ? "Pause" : "Play");

  gui.add(actions, "Randomize");
  gui.add(actions, "RandomizeSeed");
  gui.add(actions, "PresetSM").name("Preset sm");
  gui.add(actions, "PresetMD").name("Preset md");
  gui.add(actions, "PresetLG").name("Preset lg");
  gui.add(actions, "Generate").name("Generate (sprite sheet)");

  function updatePalette(index: number, value: string): void {
    const nextPalette = [...params.palette] as AppParams["palette"];
    nextPalette[index] = value as AppParams["palette"][number];
    bindings.onParamPatch({ palette: nextPalette });
  }

  return {
    refresh: () => {
      playPauseController.name(
        bindings.isPreviewAnimationPlaying() ? "Pause" : "Play",
      );
      paletteProxy.p0 = params.palette[0];
      paletteProxy.p1 = params.palette[1];
      paletteProxy.p2 = params.palette[2];
      paletteProxy.p3 = params.palette[3];
      paletteProxy.silhouetteOutline = params.silhouetteOutlineColor;
      paletteProxy.outlineShadow = params.outlineShadowColor;
      paletteProxy.outlineLight = params.outlineLightColor;
      gui
        .controllersRecursive()
        .forEach((controller) => controller.updateDisplay());
    },
    destroy: () => gui.destroy(),
  };
}
