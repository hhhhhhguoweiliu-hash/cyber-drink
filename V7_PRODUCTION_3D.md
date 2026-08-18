# V7 Production 3D Quality Gate

This branch replaces the archived procedural-geometry prototype. It starts from `main` and must not route a new 3D experience into the normal user flow until the real-device quality gate below is passed.

## Product goal

Build a convincing mobile 3D drinking/bar experience. The first vertical slice is **whisky only**. Do not expand to beer, wine, baijiu, sake or cocktails until the whisky slice is visually approved on a real phone.

## Non-negotiable visual rules

1. **No primitive-built hero assets.** The hero whisky bottle, rocks glass, visible hand/arm, shaker and other close-up bar tools may not be represented by Box/Cylinder/Torus-style placeholder geometry in the production path.
2. **Hero assets must be GLB/glTF + PBR** (or equivalent authored 3D assets) with an explicit usable license recorded before they enter the repository.
3. The bottle silhouette must read as a real spirits bottle at a glance, not a generic recolored container.
4. Glass must read as glass: transparent body, visible rim/thickness, believable highlights/reflections, and an appropriate heavy base for a rocks glass.
5. Whisky must read as amber translucent liquid, visually distinct from the glass material.
6. Ice must have its own translucent/refractive look and must react subtly during pour/lift motions.
7. No visible low-quality procedural hand. If a production-quality hand asset/animation is not available, use first-person framing/off-screen grasp choreography rather than showing a bad hand.
8. Lighting/environment must make the scene read as a bar before UI text is read. The hero objects need controlled key/fill/rim highlights instead of flat ambient lighting.
9. The 3D scene is the primary visual surface. UI should behave like a HUD/overlay, not a separate app page surrounding a small 3D demo window.

## Interaction quality gate — whisky slice

Required sequence:

`select whisky -> bottle presentation -> grasp/approach -> controlled tilt -> liquid stream -> liquid/ice reaction -> settle -> grasp glass -> lift -> drink tilt -> liquid decreases -> return`

Animation must use eased timing and authored pivots. Objects must not appear to levitate independently unless hidden/off-screen hand framing makes the motion plausible.

## Asset rules

Every external 3D asset must have a record in `assets/3d/ASSET_LICENSES.md` containing:

- asset name
- creator/source
- original source URL
- license
- whether attribution is required
- local file name
- any modifications/optimization performed

Prefer CC0/public-domain style assets when quality is sufficient. CC-BY assets are acceptable only when attribution is preserved. Assets with missing/unclear licensing must not be copied into the project.

## Mobile optimization rules

- Optimize hero meshes before shipping; avoid desktop/film-density geometry where it does not improve the phone render.
- Use mobile-appropriate texture resolution and compression; do not ship multi-megabyte high-resolution textures by default.
- Keep the first whisky vertical slice small enough to profile independently before adding more drinks.
- Do not reduce visual quality by substituting primitive hero geometry merely to save package size; instead optimize the authored asset or change delivery strategy.

## Technical path

Use the WeChat MiniProgram Three.js adapter and its GLTF loader pattern for authored models. Build an isolated asset/scene lab first. Do not change the normal homepage route until the lab passes visual and performance review.

## Real-device acceptance

The whisky slice is allowed into the user flow only when a real-device recording passes all of these:

- bottle/glass/ice are immediately recognizable and not toy-like
- no obvious primitive/proxy hero geometry
- no glaring material artifacts or severe transparency sorting problems
- pour stream aligns with the bottle mouth and glass opening
- glass lift/drink motion has convincing weight and pivots
- scene lighting reads as a bar and preserves object readability
- no major clipping/penetration during the core sequence
- acceptable real-phone frame rate and thermals for repeated interactions

Until then, this branch remains an internal production lab, not a release candidate.
