WINDOWS ICON REQUIRED
=====================
electron-builder needs assets/icon.ico to build the Windows installer.

Generate it from the existing source PNG:

  Option 1 — ImageMagick (recommended):
    convert icon.png -define icon:auto-resize=256,128,64,48,32,16 assets/icon.ico

  Option 2 — Online converter:
    https://convertio.co/png-ico/   (upload icon.png, download icon.ico, save here)

  Option 3 — macOS sips:
    sips -s format icns assets/icon.icns --out /tmp/icon.png
    then use Option 1 or 2 above.

The ICO file must contain at least the 256x256 and 48x48 sizes.
Place the final file at:  assets/icon.ico
