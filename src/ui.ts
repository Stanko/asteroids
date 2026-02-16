import GUI from "lil-gui";
import type { AppParams } from "./params";

export type UiBindings = {
  onParamPatch: (
    patch: Partial<AppParams>,
    options?: { regenerate?: boolean },
  ) => void;
  onRandomize: () => void;
  onRandomizeSeed: () => void;
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
    outline: params.outlineColor,
  };

  const actions = {
    Randomize: () => bindings.onRandomize(),
    RandomizeSeed: () => bindings.onRandomizeSeed(),
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
    .addColor(paletteProxy, "outline")
    .name("outlineColor")
    .onChange((value: string) => {
      bindings.onParamPatch({
        outlineColor: value as AppParams["outlineColor"],
      });
    });

  const previewFolder = gui.addFolder("Preview");
  previewFolder
    .add(params, "bg", ["checker", "transparent"])
    .name("background")
    .onChange((value: AppParams["bg"]) => {
      bindings.onParamPatch({ bg: value });
    });

  gui.add(actions, "Randomize");
  gui.add(actions, "RandomizeSeed");
  gui.add(actions, "Generate").name("Generate (sprite sheet)");

  function updatePalette(index: number, value: string): void {
    const nextPalette = [...params.palette] as AppParams["palette"];
    nextPalette[index] = value as AppParams["palette"][number];
    bindings.onParamPatch({ palette: nextPalette });
  }

  return {
    refresh: () => {
      paletteProxy.p0 = params.palette[0];
      paletteProxy.p1 = params.palette[1];
      paletteProxy.p2 = params.palette[2];
      paletteProxy.p3 = params.palette[3];
      paletteProxy.outline = params.outlineColor;
      gui
        .controllersRecursive()
        .forEach((controller) => controller.updateDisplay());
    },
    destroy: () => gui.destroy(),
  };
}
