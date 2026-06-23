# Rejected Combat UI Assets

These files were removed from runtime use because they came from prompts that asked for transparent/checkerboard-style output instead of a chroma-key source.

Correct replacement flow:

1. Generate source art on a flat solid green chroma key background, recommended `#00ff00`.
2. Avoid green glow, green reflections, and shadows cast onto the key background.
3. Use a local script to convert the key color to alpha.
4. Only then copy the processed PNG into `assets/ui/`.

The files in this folder are retained only as visual references and rejection examples.
