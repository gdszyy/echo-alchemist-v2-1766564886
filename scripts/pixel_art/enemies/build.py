"""Build the whole enemy batch: sheets -> checks -> contact sheet. Exit 1 if the check fails.

    python scripts/pixel_art/enemies/build.py
"""
import os
import runpy
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

if __name__ == "__main__":
    for mod in ("residue", "affixes", "multicell", "contact_sheet"):
        runpy.run_path(os.path.join(HERE, mod + ".py"), run_name="__main__")
    import check_enemies
    sys.exit(check_enemies.main())
