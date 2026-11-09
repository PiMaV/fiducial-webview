# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Scanner: optional parallel **QR** detection via ZXing (checkbox **Detect QR**, off by default) with amber overlay and payload label beside AprilTag/ArUco markers — including MESS artistic QRs from QR-Geno / QR_Framework
- Scanner: **Seen once this session** line under Detected (keeps brief flashes); http(s) QR payloads are clickable

### Changed

- Scanner copy treats **AprilTag** as the main detector; ArUco remains available as a legacy option
- QR detect defaults to **off** (FPS); when enabled, QR runs on a downscaled frame every other tick

### Fixed

- QR overlay no longer flashes off on intermittent misses (ghost hold ~800 ms); box expanded from finder centres to roughly the outer module edge
- Scanner footer **M.E.S.S.** link forces Orbitron
