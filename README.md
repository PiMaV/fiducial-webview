# fiducial-webview

Browser-based **AprilTag** scanner and pattern generator (plus optional QR overlay) — no server, no build step. Works on GitHub Pages and any static host.

**Live:** [fiducials.mess.engineering](https://fiducials.mess.engineering) · **GitHub Pages:** [pimav.github.io/fiducial-webview](https://pimav.github.io/fiducial-webview/)

## Features

- **AprilTag 36h11** — 587 IDs, 8×8 layout; same codes as official 36h11 family (main scanner mode)
- **QR overlay** — optional parallel QR detect via [ZXing](https://github.com/zxing-js/library) (checkbox, **off by default** for FPS); reads standard and MESS artistic codes; amber boxes + payload label beside cyan AprilTag overlays
- **ArUco 4×4** — legacy detector option (DICT_4X4_1000, byte-swapped like OpenCV)
- **In-browser detection** — AprilTag WASM + ZXing QR; ArUco via [js-aruco2](https://github.com/damianofalcioni/js-aruco2)
- **Live camera** — Video feed with overlays, optional gray/binary debug view
- **Pattern generator** — Grid layout (click to fill/clear), Smiley & Logo presets, PNG download
- **KISS-3D Tracker** — Metrische 3D-Welt aus AprilTag + Kamera (Ref = kleinste ID), State IDLE/CAPTURE/LOCKED, Abstaende in mm
- **Debug T/R** — Einzelmarker Pose (Translation/Rotation) ueber Zeit, Massstab, Kalibrierung M1/M2
- **Camera calibration** — Ruler-based K-matrix (pro Aufloesung), Verifikation mit Markern
- **Mobile-friendly** — Throttled on small screens; works over HTTPS

## Quick Start

Camera requires **HTTPS or localhost** (secure context). Options:

1. Use the live link above, or
2. Run locally: `npx serve . -p 8080` → open **http://localhost:8080**

## Project Structure

| File | Description |
|------|-------------|
| **index.html** | Landing page |
| **scanner.html** | Camera-based scanner (AprilTag + optional QR; ArUco legacy) |
| **generator.html** | Pattern generator (grid, presets, PNG export) |
| **tracker3d.html** | KISS-3D Tracker (world model, Ref = smallest ID, live 3D view) |
| **debug-pose.html** | Debug T/R (single-marker pose over time, scale, M1/M2 calibration) |
| **calibrate.html** | Camera calibration (ruler-based K, per resolution) |
| **kiss3d-state.js** | World model, state machine (IDLE/CAPTURE/LOCKED), pose update |
| **kiss3d-pose.js** | Pose from 4 corners (homography + R,t), default camera |

Tracker details: **Konzept-3D-Tracker.md**, **Plan-KISS-3D-Makro.md**; current status and TODO: **TRACKER-STATUS.md**.

## Tests

| File | Purpose |
|------|---------|
| **apriltag36_test.html** | AprilTag IDs 0–4 visual check + bit dump |
| **apriltag36h11_gen.py** | Generate PNGs from `generator.html` codes (requires Pillow) |
| **dump_aruco_1000.py** | Export DICT_4X4_1000 to JS array |
| **codes_36h11.txt** / **codes_1000.txt** | Code lists for reference |

Run generator: `python tests/apriltag36h11_gen.py` from repo root. Output: `tests/apriltag36h11_out/` (gitignored).

## License

**MIT** — see [LICENSE](LICENSE). Uses [apriltag-js-standalone](https://github.com/arenaxr/apriltag-js-standalone), [@zxing/library](https://github.com/zxing-js/library), and [js-aruco2](https://github.com/damianofalcioni/js-aruco2) (legacy ArUco). AprilTag 36h11: official family layout.
