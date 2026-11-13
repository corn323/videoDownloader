# Changelog

All notable changes to Vela are documented here. This project follows [Conventional Commits](https://www.conventionalcommits.org/) and [Semantic Versioning](https://semver.org/).

## 0.1.0 - 2026-11-13

### Added

- Windows x64 desktop app built with Electron, React, TypeScript and electron-vite.
- Traditional Chinese and English interface with system/light/dark themes.
- URL paste and clipboard import, automatic metadata analysis, playlist item selection.
- Video quality/container/subtitle selection and audio-only mode.
- Download queue with pause, resume, cancel, retry, progress, speed and ETA.
- Batch URL submission with per-item format selection.
- Settings for download folder, filename template, concurrent downloads, language and theme.
- Netscape cookies import encrypted with Electron `safeStorage`.
- Verified yt-dlp updates from official GitHub releases (SHA256 + allowlisted hosts).
- Security hardening: context isolation, sandbox, strict CSP, denied permissions, blocked navigation/webviews, zod-validated IPC, trusted sender checks, private-network URL blocking, output path containment.
- NSIS installer, portable zip with launcher, CycloneDX SBOM and SHA256 checksums.
- Unit tests for URL, path, filename, progress, formats and error sanitization.

### Known limitations

- Binary releases are currently unsigned; SmartScreen or Smart App Control may warn or block the app.
- Active download progress is not persisted across restarts.
- DRM-protected content is not supported.
- Installer builds require an environment where electron-builder's temporary NSIS helper can execute.
