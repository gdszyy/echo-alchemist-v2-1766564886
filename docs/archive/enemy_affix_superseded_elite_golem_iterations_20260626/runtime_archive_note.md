# Runtime Asset Archive Note

2026-06-27 cleanup moved superseded elite golem runtime exports out of active
`assets/sprites/enemies/` paths and into this archive tree.

Archived locally:
- `assets_sprites_enemies_composites_superseded_runtime/`: pass7/pass8/pass9
  composite runtime PNG/JSON plus the superseded haste pass10 runtime pair.
- `assets_sprites_enemies_elites_superseded_runtime/`: pass6-pass9 base export
  directories and the pass7 combo export directory.
- `misencoded_runtime_previews_20260627/`: JPEG screenshots that were generated
  with `.png` filenames, kept for local reference but not committed as active
  design-source PNGs.

The repository `.gitignore` intentionally ignores `docs/archive/**/*.png` and
`docs/archive/**/*.json`, so these heavyweight local archive assets remain
available in the workspace without entering normal commits.
