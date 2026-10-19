# Commercial presentation fonts

These two static **Noto Sans SC** instances (Regular 400 and Bold 700) are derived from the Google Fonts variable font. They are required production assets, not downloaded at request time. Keep this directory with the compiled server. Set `DESIGNBUDDY_ASSET_ROOT` to the repository/deployment root if the process has another working directory.

- Copyright: Adobe, 2014–2021. Reserved Font Name: **Source**. Noto instance family names do not use that reserved name.
- License: **SIL Open Font License 1.1**, full unmodified text in `OFL.txt`.
- Upstream repository path: `google/fonts`, `ofl/notosanssc/NotoSansSC[wght].ttf`.
- Immutable Git blob: `fb0637bafbcd804fe32152370a1225990745b4bc`.
- API source: <https://api.github.com/repos/google/fonts/git/blobs/fb0637bafbcd804fe32152370a1225990745b4bc> (the `content` property is base64).
- Original SHA-256: `a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da`.
- Regular SHA-256: `eeb06b8a64fd04a2744d95579db1571b51027cda61ed78c62e4b730791525461`.
- Bold SHA-256: `a8d8569e6cf8e93e830736e64c69568c5499ff65bf6a8ff860f0cdacc3eab7d0`.
- Derivation: FontTools **4.60.1**, `instantiateVariableFont(..., {'wght': 400/700}, updateFontNames=True)`, `recalcTimestamp=False`. Rebuild using `scripts/build-presentation-fonts.py --source /path/to/the-pinned-variable.ttf` in a Python virtual environment. This script checks both upstream and derived hashes before replacing assets. Python is not needed at runtime.

The server checks both font hashes and the presence of the OFL license before enabling `slides.create`. Rendering imports only these bounded font files. PPTX does **not** embed the font binaries; recipients must install Noto Sans SC to avoid reflow. Actual LibreOffice PDF/JPEG export is tested, but recipient-side PowerPoint/Keynote/WPS editing is still a separate manual acceptance step.
