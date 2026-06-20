---
name: generate-pf2e-token-frames
description: Generate, post-process, validate, and save decorative circular token-frame PNG assets for Pathfinder 2e or other virtual tabletops. Use when the user asks for a new fantasy token frame, a variation of an existing frame, or any transparent circular portrait border that must remain perfectly round, symmetric, background-free, and ready for output under ai_generated/.
---

# Generate PF2e Token Frames

Create polished raster token frames from the user's visual direction. Treat geometric circularity and true transparency as hard acceptance criteria, not stylistic preferences.

## Non-negotiable requirements

Apply all of these rules to every frame:

1. Produce a square RGBA PNG. Use 1024 × 1024 unless the user specifies another square size.
2. Center the frame exactly on the canvas.
3. Make the structural outer ring and portrait opening exact concentric circles. Never deliver an ellipse, an oval, perspective distortion, tilt, or unequal horizontal and vertical diameters.
4. Preserve strict visual symmetry. Use exact four-way rotational symmetry for cardinal decorations unless the user explicitly requests a denser radial repeat. Repeat equivalent elements at identical radii, scale, and spacing.
5. Keep the portrait opening large and completely unobstructed unless the user explicitly requests inward-reaching details.
6. Make every pixel outside the frame transparent.
7. Make every pixel inside the portrait opening transparent.
8. Never deliver a white, black, colored, scenic, gradient, or checkerboard background. A checkerboard is a transparency preview, not valid image content.
9. Prevent cast shadows, contact shadows, atmospheric haze, diffuse glow, smoke, particles, reflections, or chroma-key residue from forming a background.
10. Keep antialiased edge pixels partially transparent when needed, but require fully transparent corners and center.
11. Do not add text, logos, watermarks, characters, or unrequested objects.
12. Save every accepted final image under `ai_generated/`.

Reject and repair any output that violates even one requirement.

## Interpret the request

Preserve the user's requested:

- material and color;
- theme or creature motif;
- decoration density;
- frame thickness;
- mood and finish.

Do not invent major motifs that were not requested. For a basic frame, use only the requested material texture. For a minimalist frame, keep accents sparse and readable. For an elaborate theme, attach all details to the frame and balance them radially.

Prefer a thin or moderately thin ring unless the user asks for a heavy frame. Decorative protrusions may extend beyond the structural ring only when they are compact, balanced, and repeated symmetrically.

## Generation workflow

### 1. Use the image-generation capability

Use the available `imagegen` skill and built-in image-generation tool for new raster art. Classify the asset as `stylized-concept`.

Do not substitute SVG, CSS, HTML, or a purely procedural drawing for the requested generated artwork. Local deterministic processing is allowed and expected for transparency, circular geometry, symmetry, and cleanup.

### 2. Generate against a removable flat key

The built-in generator does not guarantee native transparency. Generate against one perfectly uniform chroma-key color:

- Default to `#00ff00`.
- Use `#ff00ff` when the frame contains green, olive, slime, foliage, jade, or similar colors.
- Choose another highly distinct key only if both conflict with the subject.
- Explicitly forbid the key color inside the frame artwork.

Require the same key color in both regions:

- everywhere outside the frame;
- throughout the entire central portrait opening.

Require no shadows, gradients, texture, floor plane, lighting variation, detached particles, or glow on the key field.

### 3. Use this prompt structure

Adapt the following scaffold without adding unrelated content:

```text
Use case: stylized-concept
Asset type: transparent decorative token frame for a Pathfinder 2e virtual tabletop token
Primary request: <normalized user request>
Subject: <ring material and requested attached decoration>
Style/medium: premium fantasy game UI asset, detailed painted material, readable at token scale
Composition/framing: perfectly centered on a square 1024×1024 canvas, straight front orthographic view; exact concentric circular outer ring and inner opening; equal horizontal and vertical diameters; strict four-way rotational symmetry; large unobstructed portrait opening; equal padding
Color palette: <requested palette>
Materials/textures: <requested material treatment>
Scene/backdrop: perfectly flat solid <key> chroma-key field; use the exact same uniform color outside the ring and inside the opening
Constraints: mathematically perfect circle; never oval; attached and balanced decoration; crisp separated edges; no background-producing effects
Avoid: ellipse, oval, perspective, tilt, asymmetric silhouette, excessive thickness, detached objects, background scene, checkerboard, black or white fill, text, logo, watermark, portrait
```

For minimalist requests, explicitly forbid gems, runes, filigree, seams, rivets, symbols, panels, clasps, or other details unless requested.

For organic requests, require opaque, crisp-edged forms attached to the ring. Avoid translucent slime, wisps, hairlike edges, smoke, splashes, or floating droplets because they complicate clean extraction.

### 4. Preserve the generated source

Preserve the original generated image. Copy it to a relative temporary working directory such as `tmp/imagegen/` for processing; do not overwrite or delete the original.

Use a descriptive kebab-case final filename, for example:

- `silver-thin-minimal.png`
- `purple-glossy-arcane.png`
- `forged-chain-ring.png`
- `chthonic-slime-eyes.png`
- `burnt-orange-metal-basic.png`

Do not overwrite an existing accepted asset unless the user requests replacement. Otherwise append `-v2`, `-v3`, and so on.

### 5. Remove the chroma key

Use the chroma-key removal helper supplied by the active `imagegen` skill. Resolve the helper relative to that skill's directory rather than relying on a machine-specific path:

```bash
python <imagegen-skill>/scripts/remove_chroma_key.py \
  --input <source.png> \
  --out <candidate.png> \
  --auto-key border \
  --soft-matte \
  --transparent-threshold 12 \
  --opaque-threshold 220 \
  --despill
```

If a thin key-colored fringe remains, retry once with `--edge-contract 1`. Use a small edge feather only for visibly jagged opaque edges.

If Pillow is missing, use an existing project environment or install it into a temporary environment when permitted. Do not silently switch to a lower model or native-transparency API fallback; follow the `imagegen` skill's confirmation rules.

## Validate before delivery

Inspect the candidate visually and technically. Never infer success from the prompt.

Verify:

- dimensions are square;
- mode is RGBA;
- alpha range includes 0;
- all four corner alpha values are 0;
- center alpha is 0;
- no opaque or partially opaque background remains;
- no key-color fringe remains;
- the visible bounding-box width equals its height;
- the frame is centered;
- the central opening is a circle;
- the structural ring has uniform intended thickness;
- decorations are balanced and do not crowd the portrait;
- a 90-degree rotation confirms required symmetry;
- the artwork remains detailed and attractive after correction.

Use Pillow for a compact technical check:

```python
from PIL import Image, ImageChops

im = Image.open(path).convert("RGBA")
a = im.getchannel("A")
w, h = im.size
assert w == h
assert a.getpixel((0, 0)) == 0
assert a.getpixel((w - 1, 0)) == 0
assert a.getpixel((0, h - 1)) == 0
assert a.getpixel((w - 1, h - 1)) == 0
assert a.getpixel((w // 2, h // 2)) == 0

box = a.point(lambda v: 255 if v > 16 else 0).getbbox()
assert box is not None
assert box[2] - box[0] == box[3] - box[1]

rotated = im.rotate(90, resample=Image.Resampling.NEAREST)
assert ImageChops.difference(im, rotated).getbbox() is None
```

Exact RGBA rotational equality is preferred for four-way designs. If intentionally repeated detail uses a different radial count, validate the corresponding rotation instead.

The image viewer may display transparent pixels as black. Trust the alpha-channel inspection, not the viewer's presentation color.

## Repair strategy

Do not deliver a nearly circular candidate. Repair it.

### Plain or minimally decorated frames

1. Measure the generated outer and inner horizontal and vertical radii.
2. Remap the generated texture from the source ellipse onto an exact circular coordinate system.
3. Create an exact concentric annulus alpha mask.
4. Composite the generated metal, wood, stone, or other texture over a matching fallback material.
5. Set final alpha from the exact annulus mask.
6. Average or repeat rotations when required to remove directional asymmetry.

Preserve the generated surface texture. Do not replace a rich painted material with a visibly synthetic flat gradient.

### Decorated frames

1. Build or normalize an exact circular structural base.
2. Extract the strongest clean cardinal ornament or one complete quadrant from the generated concept.
3. Repeat it at exact 90-degree rotations.
4. Blend crop boundaries into the base; do not leave rectangular seams.
5. Keep protrusions compact and preserve a large circular opening.
6. Perform alpha-weighted averaging across four rotations when exact pixel symmetry is required.

For evenly repeated motifs such as chains, eyes, gems, or bubbles, repeat one validated sector rather than trusting independently generated opposite sides.

### Organic frames

Preserve detailed generated organic texture while enforcing an exact annulus underneath it. Avoid replacing the artwork with a smooth tube. Blend eye or tentacle clusters into the ring and re-check for key-color contamination after every composite.

### When repair harms the art

If correction creates visible seams, obvious procedural smoothness, clipped focal details, or a weaker result:

1. discard that correction;
2. return to the clean generated source;
3. use a better sector, softer alpha blend, or a new generation;
4. re-run every validation.

Geometric correctness and artistic quality are both required.

## Save and report

Move or copy only the accepted final RGBA PNG into `ai_generated/`.

In the final response:

- link the saved file using its relative path under `ai_generated/`;
- summarize the requested visual treatment in one sentence;
- state the dimensions, RGBA transparency, transparent center/background, and symmetry validation;
- mention that built-in generation plus local geometry/transparency normalization was used when applicable.

Do not describe a failed intermediate as complete. Ensure the accepted final asset is saved under `ai_generated/`, not only in a temporary or tool-managed output directory.
