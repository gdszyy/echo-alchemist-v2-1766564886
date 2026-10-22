"""Build the devices/UI/board batch: sheets + JSON + x6 previews, mocks, checker, contact sheet.

    python scripts/pixel_art/devices_ui/build_all.py
"""
import sys

import board
import check
import contact
import factory_devices
import mock
import ui

if __name__ == "__main__":
    factory_devices.build()
    ui.build()
    board.build()
    mock.build()
    rc = check.main()
    contact.main()
    sys.exit(rc)
