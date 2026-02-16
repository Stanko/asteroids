import {
  type AppParams,
  DEFAULT_PARAMS,
  PARAM_VERSION,
  normalizeHexColor,
  normalizeParams,
  roundTo3,
} from "./params";

function formatFloat(value: number): string {
  return roundTo3(value).toFixed(3);
}

function parseFloatValue(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function parseIntValue(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : undefined;
}

function parsePalette(raw: string | null): AppParams["palette"] | undefined {
  if (!raw) return undefined;
  const parts = raw.split(",");
  if (parts.length < 4) return undefined;

  const normalized = DEFAULT_PARAMS.palette.map((_, index) =>
    normalizeHexColor(`#${parts[index] ?? ""}`, DEFAULT_PARAMS.palette[index]),
  );

  return normalized as AppParams["palette"];
}

function parseOutlineShadowColor(raw: string | null): AppParams["outlineShadowColor"] | undefined {
  if (!raw) return undefined;
  const normalized = normalizeHexColor(`#${raw}`, DEFAULT_PARAMS.outlineShadowColor);
  return normalized;
}

function parseOutlineLightColor(raw: string | null): AppParams["outlineLightColor"] | undefined {
  if (!raw) return undefined;
  const normalized = normalizeHexColor(`#${raw}`, DEFAULT_PARAMS.outlineLightColor);
  return normalized;
}

export function parseParamsFromSearch(search: string): AppParams {
  const query = search.startsWith("?") ? search.slice(1) : search;
  const url = new URLSearchParams(query);

  const parsed = normalizeParams({
    seed: url.get("s") ?? undefined,
    distortion: parseFloatValue(url.get("d")),
    size: parseFloatValue(url.get("z")),
    exportSizePx: parseIntValue(url.get("px")),
    normalEdgeStrength: parseFloatValue(url.get("ne")),
    depthEdgeStrength: parseFloatValue(url.get("de")),
    toonSteps: parseIntValue(url.get("ts")),
    lightIntensity: parseFloatValue(url.get("li")),
    ambientIntensity: parseFloatValue(url.get("ai")),
    flatShading: url.get("fs") === "1",
    rotationSteps: parseIntValue(url.get("rs")),
    previewFps: parseIntValue(url.get("fps")),
    palette: parsePalette(url.get("p")),
    outlineShadowColor: parseOutlineShadowColor(url.get("oc0") ?? url.get("oc")),
    outlineLightColor: parseOutlineLightColor(url.get("oc1")),
    outlineLightThreshold: parseFloatValue(url.get("ot")),
    bg: url.get("bg") === "t" ? "transparent" : "checker",
  });

  return parsed;
}

export function serializeParamsToSearch(params: AppParams): string {
  const normalized = normalizeParams(params);
  const entries: Array<[string, string]> = [
    ["v", String(PARAM_VERSION)],
    ["s", normalized.seed],
    ["d", formatFloat(normalized.distortion)],
    ["z", formatFloat(normalized.size)],
    ["px", String(normalized.exportSizePx)],
    ["ne", formatFloat(normalized.normalEdgeStrength)],
    ["de", formatFloat(normalized.depthEdgeStrength)],
    ["ts", String(normalized.toonSteps)],
    ["li", formatFloat(normalized.lightIntensity)],
    ["ai", formatFloat(normalized.ambientIntensity)],
    ["fs", normalized.flatShading ? "1" : "0"],
    ["rs", String(normalized.rotationSteps)],
    ["fps", String(normalized.previewFps)],
    [
      "p",
      normalized.palette.map((hex) => hex.slice(1).toUpperCase()).join(","),
    ],
    ["oc0", normalized.outlineShadowColor.slice(1).toUpperCase()],
    ["oc1", normalized.outlineLightColor.slice(1).toUpperCase()],
    ["ot", formatFloat(normalized.outlineLightThreshold)],
    ["bg", normalized.bg === "transparent" ? "t" : "c"],
  ];

  const query = entries
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");

  return `?${query}`;
}
