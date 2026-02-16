export type HexColor = `#${string}`;
export type PreviewBg = "transparent" | "checker";
export type PresetName = "sm" | "md" | "lg";

export type AppParams = {
  exportSizePx: number;
  normalEdgeStrength: number;
  depthEdgeStrength: number;
  silhouetteOutlineColor: HexColor;

  seed: string;
  distortion: number;
  size: number;

  toonSteps: number;
  lightIntensity: number;
  ambientIntensity: number;
  flatShading: boolean;

  rotationSteps: number;
  previewFps: number;

  palette: [HexColor, HexColor, HexColor, HexColor];
  outlineShadowColor: HexColor;
  outlineLightColor: HexColor;
  outlineLightThreshold: number;

  bg: PreviewBg;
};

export const PARAM_VERSION = 10;

export const DEFAULT_PARAMS: AppParams = {
  exportSizePx: 44,
  normalEdgeStrength: 0,
  depthEdgeStrength: 1,
  silhouetteOutlineColor: "#9EB9FF",

  seed: "asteroid-0001",
  distortion: 0.85,
  size: 0.85,

  toonSteps: 4,
  lightIntensity: 1.2,
  ambientIntensity: 0.25,
  flatShading: false,

  rotationSteps: 16,
  previewFps: 8,

  // palette: ["#565158", "#6f696f", "#a39ca2", "#cccacf"],
  palette: ["#767178", "#9f999f", "#b3b0b2", "#cccacf"],
  outlineShadowColor: "#1D1C1C",
  outlineLightColor: "#959196",
  outlineLightThreshold: 0.3,

  bg: "checker",
};

export const PRESET_PARAMS: Record<PresetName, Partial<AppParams>> = {
  sm: {
    exportSizePx: 44,
    distortion: 1.5,
    size: 0.85,
    toonSteps: 4,
    lightIntensity: 1.45,
    ambientIntensity: 0,
  },
  md: {
    exportSizePx: 64,
    distortion: 1.5,
    size: 0.85,
    toonSteps: 4,
    lightIntensity: 1.25,
    ambientIntensity: 0,
  },
  lg: {
    exportSizePx: 84,
    distortion: 1.5,
    size: 0.85,
    toonSteps: 4,
    lightIntensity: 1.1,
    ambientIntensity: 0,
  },
};

const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

export function sanitizeSeed(
  raw: unknown,
  fallback = DEFAULT_PARAMS.seed,
): string {
  if (typeof raw !== "string") {
    return fallback;
  }

  const cleaned = raw.replace(CONTROL_CHARS, "").trim().slice(0, 64);
  return cleaned.length > 0 ? cleaned : fallback;
}

export function normalizeHexColor(raw: unknown, fallback: HexColor): HexColor {
  if (typeof raw !== "string") {
    return fallback;
  }

  const value = raw.trim().toUpperCase();
  if (!value.startsWith("#")) {
    return fallback;
  }

  return HEX_COLOR_PATTERN.test(value) ? (value as HexColor) : fallback;
}

function asNumber(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeInt(
  raw: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = asNumber(raw);
  if (value === undefined) {
    return fallback;
  }
  return Math.round(clamp(value, min, max));
}

function normalizeFloat(
  raw: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = asNumber(raw);
  if (value === undefined) {
    return fallback;
  }
  return clamp(value, min, max);
}

export function roundTo3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function normalizePalette(raw: unknown): AppParams["palette"] {
  const fallback = DEFAULT_PARAMS.palette;

  if (!Array.isArray(raw)) {
    return [...fallback] as AppParams["palette"];
  }

  const normalized = fallback.map((color, index) =>
    normalizeHexColor(raw[index], color),
  );
  return normalized as AppParams["palette"];
}

export function normalizeParams(raw: Partial<AppParams>): AppParams {
  return {
    exportSizePx: normalizeInt(
      raw.exportSizePx,
      DEFAULT_PARAMS.exportSizePx,
      16,
      256,
    ),
    normalEdgeStrength: normalizeFloat(
      raw.normalEdgeStrength,
      DEFAULT_PARAMS.normalEdgeStrength,
      0,
      1,
    ),
    depthEdgeStrength: normalizeFloat(
      raw.depthEdgeStrength,
      DEFAULT_PARAMS.depthEdgeStrength,
      0,
      1,
    ),
    silhouetteOutlineColor: normalizeHexColor(
      raw.silhouetteOutlineColor,
      DEFAULT_PARAMS.silhouetteOutlineColor,
    ),

    seed: sanitizeSeed(raw.seed, DEFAULT_PARAMS.seed),
    distortion: normalizeFloat(raw.distortion, DEFAULT_PARAMS.distortion, 0, 5),
    size: normalizeFloat(raw.size, DEFAULT_PARAMS.size, 0.4, 1.2),

    toonSteps: normalizeInt(raw.toonSteps, DEFAULT_PARAMS.toonSteps, 2, 8),
    lightIntensity: normalizeFloat(
      raw.lightIntensity,
      DEFAULT_PARAMS.lightIntensity,
      0,
      3,
    ),
    ambientIntensity: normalizeFloat(
      raw.ambientIntensity,
      DEFAULT_PARAMS.ambientIntensity,
      0,
      1,
    ),
    flatShading: raw.flatShading === true,

    rotationSteps: normalizeInt(
      raw.rotationSteps,
      DEFAULT_PARAMS.rotationSteps,
      1,
      256,
    ),
    previewFps: normalizeInt(raw.previewFps, DEFAULT_PARAMS.previewFps, 1, 30),

    palette: normalizePalette(raw.palette),
    outlineShadowColor: normalizeHexColor(
      raw.outlineShadowColor,
      DEFAULT_PARAMS.outlineShadowColor,
    ),
    outlineLightColor: normalizeHexColor(
      raw.outlineLightColor,
      DEFAULT_PARAMS.outlineLightColor,
    ),
    outlineLightThreshold: normalizeFloat(
      raw.outlineLightThreshold,
      DEFAULT_PARAMS.outlineLightThreshold,
      0,
      1,
    ),

    bg: raw.bg === "transparent" ? "transparent" : "checker",
  };
}

export function cloneParams(params: AppParams): AppParams {
  return {
    ...params,
    palette: [...params.palette] as AppParams["palette"],
  };
}
