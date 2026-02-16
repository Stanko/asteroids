# Agent Instructions

## Goal
Build a Vite + TypeScript + three.js app that generates a procedural 3D asteroid, previews it with a pixel-art postprocessing pipeline, and exports a deterministic PNG sprite sheet of rotated frames.

## Non-negotiables
- Determinism is required:
  - Use provided alea RNG for ALL randomness.
  - Do not use Math.random.
  - Lock rendering settings that can vary by device:
    - renderer.setPixelRatio(1)
    - fixed color space/tone mapping settings (keep consistent in preview + export)
- Orthographic camera fixed on +Z axis.
- User can rotate asteroid freely; pan/zoom disabled.
- Export:
  - PNG with transparent background.
  - Sprite sheet grid, max 16 columns then wrap.
  - Each cell contains 1px padding on all sides (no extra margins between cells beyond that).
  - Rotation steps are around Z axis; light stays fixed.
  - Starting orientation is the current user-set orientation.
- Export square overlay:
  - Drawn after rendering as a 2D overlay.
  - Must not appear in export.

## Rendering pipeline
- Postprocessing must match the three.js pixel-art example referenced by the user.
- Expose params for depth-edge strength and normal-edge strength.
- Outline color should be derived from the base palette (darkened), not pure black by default.

## Shading
- Use a 5-color grayscale palette by default.
- Provide UI to edit the 5 palette colors.
- Toon steps quantize lighting intensity (ambient + diffuse combined). No rim lighting unless explicitly added later.

## Mesh generation
- Produce a “blobby rock” asteroid:
  - Start from a sphere/icosphere and deform using multiple smooth noise layers.
  - No crater logic.
  - Ensure it does not obviously read as a deformed sphere (use low-frequency silhouette change + secondary noise).
- After generation, auto-scale and center so it fits inside a fixed world-space export square.

## URL parameters
- All user-facing params must round-trip via query params.
- Use canonical ordering and fixed rounding rules.
- Debounce URL updates and use history.replaceState.

## UI
- Use lil-gui.
- Controls:
  - exportSizePx
  - distortion factor
  - seed
  - toonSteps
  - rotationSteps
  - light intensity
  - depthEdgeStrength, normalEdgeStrength
  - palette[5] color pickers
  - buttons: Randomize, Generate (sprite sheet)

## Deliverables
- Working dev server via Vite.
- Export produces a downloadable PNG sprite sheet.
- Reasonable code organization and comments where determinism/pipeline nuances matter.
