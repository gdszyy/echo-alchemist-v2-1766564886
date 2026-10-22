"""Build every sample deterministically, then run the self-check.

    python scripts/pixel_art/build_all.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import check_samples  # noqa: E402
import contact_sheet  # noqa: E402
import devices  # noqa: E402
import enemy_residue  # noqa: E402
import mock_defend_screen  # noqa: E402
import ui_factory  # noqa: E402

if __name__ == "__main__":
    enemy_residue.main()
    devices.main()
    ui_factory.main()
    mock_defend_screen.main()
    contact_sheet.main()
    sys.exit(check_samples.main())
