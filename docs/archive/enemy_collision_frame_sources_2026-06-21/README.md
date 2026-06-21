# Enemy Collision Frame Source Archive

This folder keeps non-runtime source files from the 2026-06-21 collision frame pass.

- `source_green/`: chroma-key source images for repainting or alpha cleanup.
- `materials/`: source material texture used by `scripts/generate_enemy_boundary_frames.py`.

Runtime enemy border assets live in `assets/sprites/enemies/frames/frame_*.png`.
Do not point manifests or gameplay code at files in this archive.
