# ESM Viewer

[![License: GPL v3](https://img.shields.io/badge/License-GPL_v3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

An open-source, offline application for inspecting, verifying, and reporting on
digital tachograph files. All analysis happens locally, with no telemetry, cloud
services, or runtime network calls. Original files are never modified.

Open driver cards, workshop cards, and Vehicle Unit downloads across Gen1,
Gen2v1, and Gen2v2. Supported extensions are `.DDD`, `.ESM`, `.V1B`, `.C1B`,
`.TGD`, `.TLG`, `.V1C`, and `.C1C`, with a **50 MB limit per file**.

## Features

- **Activities and journeys**: timelines, duty-shift and UTC-day views, calendars,
    presence heatmaps, and journey summaries.
- **Places and speed**: offline GNSS maps, border crossings, load/unload records,
    detailed speed charts, and overspeeding events.
- **Integrity**: card and Vehicle Unit signature verification, with distinct
    full-data, certificate-chain-only, and unsupported verification scopes.
- **Compliance**: driving, break, rest, and working-time checks for EU Regulation
    561/2006, Mobility Package 2020, Directive 2002/15/EC, AETR 2020, and UK GB
    Domestic profiles.
- **Evidence inspection**: events, faults, technical records, a decoded JSON tree
    with source references, and session comparison.
- **Reports**: HTML, JSON, and PDF exports, printing, infringement acknowledgment
    letters, and EU attestation forms.
- **Interface**: keyboard navigation and command palette, light/dark/system
    themes, compact/comfortable density, and seven languages: English, German,
    French, Italian, Polish, Spanish, and Croatian.

**Compliance results are not a certified legal assessment.** Incomplete records
and requirements needing external evidence remain explicit limitations.

## Install and use

Download an available installer from [Releases](https://github.com/mbolaric/esm-viewer/releases)
for macOS (Apple Silicon), Windows (x64), or Linux (x64). Installers are currently
unsigned and, on macOS, not notarized; your operating system may display a warning.
You can also build from source.

Choose **File > Open** or drop a file into the window. Open the in-app **User Guide**
with **F1** for inspection, verification, compliance, privacy, and export details.

## Build from source

### Prerequisites

- Node.js `24.x`, or `26.x` or later
- pnpm `11.17.0`, pinned in `package.json`
- Stable Rust toolchain

Install the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your
platform before building.

On **macOS**, install Xcode or its Command Line Tools. Xcode 26 or later is needed
to bundle the layered macOS icon; older build tools use the flat icon.

On **Linux**, PDF printing requires Poppler's GLib development package
(Poppler `0.82` or later) and `pkg-config` in addition to Tauri's prerequisites.
Install the native development dependencies for your distribution:

**Debian / Ubuntu**

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
    libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
    libdbus-1-dev libpoppler-glib-dev pkg-config
```

**Fedora**

```bash
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
    libappindicator-gtk3-devel librsvg2-devel dbus-devel \
    poppler-glib-devel pkgconf-pkg-config
```

### Setup and run

```bash
git clone --recursive https://github.com/mbolaric/esm-viewer.git
cd esm-viewer
pnpm install
pnpm parser:sync-types
pnpm tauri:dev
```

For an existing clone without submodules, run
`git submodule update --init --recursive` before installing dependencies.

Build installers for your current operating system with:

```bash
pnpm tauri:build
```

## Development

Built with Tauri 2, Rust, Svelte 5, TypeScript, and Vite. The native parser is
pinned in [`vendor/esm-parser`](https://github.com/mbolaric/esm-parser).
`apps/viewer` composes the renderer, `src/` contains capabilities and shared
modules, and `src-tauri` provides the native backend.

| Command | Purpose |
| --- | --- |
| `pnpm dev:tauri:renderer` | Start the renderer dev server only |
| `pnpm build` | Build production renderer assets in `apps/viewer/dist` |
| `pnpm check` | Check TypeScript, Svelte, and Rust; run Clippy |
| `pnpm test` | Run unit, component, and native tests |
| `pnpm lint` | Check lint rules, design values, and test layout |
| `pnpm i18n:check` | Check translation-key parity |
| `pnpm architecture` | Check module boundaries and the lockfile |
| `pnpm duplication` | Check for duplicated code |
| `pnpm format:check` | Check formatting |
| `pnpm format` | Format source files |
| `pnpm parser:sync-types` | Regenerate declarations after a parser update |
| `pnpm quality` | Run all quality gates, including the renderer build |

See [docs/implementation.md](docs/implementation.md) for current behavior,
architecture, and limitations, and [AGENTS.md](AGENTS.md) for contribution rules.

The [validation workflow](.github/workflows/validation.yml) runs the quality gates
and native debug/release builds. Packaged releases are built separately by the
[release workflow](.github/workflows/release.yml).

## License

**GNU General Public License version 3 only** (`GPL-3.0-only`), matching
`esm-parser`. See [LICENSE](LICENSE).
