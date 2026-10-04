# ESM Viewer — Implementation

- Status: living document, describes the app as it stands today
- Last verified against source: 2026-10-01

This is the single current-state reference for ESM Viewer: what the app is,
how it is built, and what it actually does. It is self-contained — it does
not depend on, or point back into, any prior planning, audit, or decision
record. If something here turns out to be wrong, fix this document from the
source, don't go looking for an older one to reconcile it against.

## 1. What it is

ESM Viewer is a local-first, offline desktop application for inspecting,
verifying, and reporting on digital tachograph files (`.DDD`, `.C1B`, `.V1B`,
`.TGD`, `.ESM`) — driver cards, workshop cards, and Vehicle Unit downloads,
across Gen1, Gen2v1, and Gen2v2. It makes no network calls at runtime.

## 2. Architecture

One Node package owns a reusable library under `src/` and the standalone
renderer under `apps/viewer/`. Foundation stays in Viewer: contracts, UTC time,
localization, error reporting, generic UI, and immutable tachograph evidence.
Tauri 2 hosts Svelte 5 runes and strict TypeScript. Business dependencies point
inward: `domain <- application <- presentation <- feature`. Reviewed public
entry points and dependency-cruiser enforce module boundaries.

- `src/tachograph-domain`: parser-independent evidence and UTC brands.
- `src/viewer`: single-document application, parser normalizers, presentation,
  reusable controllers, and Svelte features.
- `src/compliance`: regulatory evaluation, the Compliance screen, attestations,
  and infringement letters. `#compliance-rules` exposes product-neutral rules.
- `src/contracts`: typed IPC, Result, unknown-value guards, settings, PDF
  requests, and Viewer command IDs.
- `src/localization`: locale selection, exact-key lookup, Intl formatting,
  seven Viewer catalogues, command labels, and shared search helpers.
- `src/error-reporting`: typed services/providers; generic event types permit an
  application-owned event union, and the file provider accepts an event decoder.
- `src/time`: dependency-free UTC and IANA time-zone arithmetic.
- `src/ui`: generic tables, charts, icons, dialogs, shell, toasts, and tokens.
- `src/shell`: public `#shell` application frame, status/toast placement, command
  bar, workspace selector, typed module/guide/preference/command contributions,
  and safe command-handler registration. It has no capability or native dependency.
- `src/platform/tauri`: reusable parser, file, export, PDF, preferences,
  clipboard, menu, metadata, and error-provider adapters.
- `apps/viewer`: standalone app entry and status-bar composition.
- `src-tauri`: native host and public library modules for guarded reads,
  parsing, verification, PDF, printing, logging, and blocking dispatch.

`createTauriViewerContext` wires ports manually and accepts an error service,
menu installer, preferences target, and successful-preference-change callback.
`VIEWER_DESKTOP_CONTRIBUTION` defines Viewer commands, menu ordering, and
toolbar actions. Native menus consume those entries and accept additional submenus.
`ViewerRoot` accepts command-palette destinations, a toolbar snippet, guide
tabs, and preference tabs. Reusable modules have no app dependency.
`apps/viewer` composes `ApplicationShell` from typed `IApplicationModule`
descriptors. Its Viewer workspace uses `applicationMode="embedded"`; global
dialogs run separately through `ViewerApplicationDialogs`. Direct standalone
`ViewerRoot` consumers retain the default, self-contained dialog adapter.

The native launcher registers the Viewer command inventory through
`with_viewer_commands!` in one invoke handler. It owns the Tauri builder,
product identity, plugins, capabilities, and window/navigation setup.
The shared PDF engine renders factual reports,
attestations, and infringement letters. Viewer plugins are dialog and filesystem.
Small settings use IKeyValueStore/createStoredValue; IPC is decoded from unknown,
and parser data is normalized before UI use.


## 3. Native application (Tauri 2.0)

The parser runs in the native Rust backend. `apps/viewer/src/renderer` is the
standalone Vite entry; `src-tauri` owns its window and command composition.
Reusable adapters live in `src/platform/tauri`.

`pnpm tauri:dev` starts the Viewer host with hot reload; `pnpm tauri:build`
packages it. `pnpm build` emits assets in `apps/viewer/dist`. Bounded chunks
separate catalogues, charts, parser/presentation, and initial vendor code.
The chart runtime loads on demand.


The main window is configured via `setup_desktop_window` (`src-tauri/tauri.conf.json`), opening at 1440×900, resizable
down to a 640×480 minimum so it remains usable with operating-system display
scaling. In development on macOS, `setup_macos_dock_icon` sets the dock icon on
the unbundled process. Before the Svelte application mounts, the renderer shows a
centered startup splash generated via `renderStartupSplash` and `IAppModel` in `#shell`.
A parser-blocking local script applies the saved light or dark preference,
resolving the system setting through `prefers-color-scheme`, so the first painted
surface uses the selected theme instead of flashing white. The regular preferences
target takes ownership of the theme after composition finishes, and the startup
screen is removed after the application mounts. Fill-height Viewer record tables preserve a minimum row
viewport instead of collapsing behind wrapped headers, filters, or pagination.
When the available block size cannot contain that table floor, the owning
screen scrolls vertically while the table retains its independent bounded row
viewport and horizontal data scrolling. Intermediate evidence and history
panels propagate the same minimum, and short viewports reduce table-screen
spacing. Its content security policy allows scripts only
from `'self'` (no remote or inline script execution), consistent with the
app making no runtime network calls. `connect-src` permits only `'self'`,
`ipc://localhost` and `http://ipc.localhost`, the exact local Tauri IPC origins.
This allows packaged webviews to send raw request bodies, including tachograph
bytes, without opening remote or wildcard network access. Omitting these origins
blocks the binary IPC fetch under `default-src 'self'`; Tauri's JSON
`postMessage` fallback cannot preserve the parser command's raw-body contract.
The policy also sets `object-src 'none'`,
`base-uri 'none'`, `form-action 'none'` (the only form, in Preferences, is
handled in script) and `frame-ancestors 'none'`. Bundle `targets` is `"all"` — each CI
platform produces whatever installer formats Tauri packages by default for
that OS, not a hand-curated subset.

The macOS app icon has two sources. `src-tauri/icons/AppIcon.icon` is a
layered Icon Composer document (background fill, card, card details, trace
panel, trace line) that `tauri build` compiles with Xcode 26+ `actool` into
`Assets.car` and references through `CFBundleIconName`, giving macOS 26+ its
Liquid Glass default, dark, clear, and tinted appearances. `icon.icns`
remains in the bundle for earlier macOS versions and for build hosts whose
`actool` is older than 26, where the bundler skips `Assets.car`. `tauri dev`
runs an unbundled binary with a flat runtime icon, so appearance tinting is
visible only in a bundled `.app`.

Native single-file and batch reads canonicalize the selected file path,
require both selected and resolved names to have supported tachograph
extensions, and enforce the 50 MB ceiling against the bytes actually
streamed, not only pre-read metadata. Main-window access uses the exact
`"main"` label rather than an arbitrary first-window lookup, and release
packaging compiles without Tauri devtools.

Releases are built by `.github/workflows/release.yml` on a version tag (or
manual dispatch): native jobs on `ubuntu-24.04` (Linux x64),
`windows-latest` (Windows x64), and `macos-26` (macOS arm64 only; no Intel
build) each run `tauri-action` and publish a draft GitHub Release. Each platform
has separate release and debug matrix entries.
`includeRelease` and `includeDebug` select exactly one profile per job, aligning
the build and artifact lookup under `target/release` or `target/debug`. The action
adds `--debug` for debug jobs; only those jobs receive `--features devtools`.
Debug uploads use the action's `-debug` asset suffix, keeping them distinct from
release installers. The macOS
job fails before packaging unless `actool` is from Xcode 26 or newer, so a
release cannot silently ship without the Liquid Glass `Assets.car` icon.
Before packaging, macOS jobs install `.github/scripts/actool.sh` as an `actool`
wrapper on the runner's path. It invokes `xcrun actool` with stdin opened on
`/dev/null`, avoiding the Node-based Tauri CLI's closed-stdin icon compiler
failure while preserving the layered icon. Compiler arguments and failures
pass through unchanged.
No code-signing or notarization credentials are currently configured for
Windows or macOS, so distributed installers are unsigned.

## 4. Parser engine

ESM Viewer depends on a pinned build of the
[`esm-parser`](https://github.com/mbolaric/esm-parser) Rust crate (vendored
as a git submodule under `vendor/esm-parser`), compiled natively into the
Tauri host rather than run as WASM in a worker. Normalizers trust the
parser's generated TypeScript declarations rather than re-validating every
field at runtime, so an upstream serialization change is expected to fail
the type check, not silently drop data.

Card-data signature verification and Vehicle Unit signature verification
confirm authenticity under the pinned ERCA key: full verification (for
driver/workshop cards, and for Vehicle Units with recorded data files)
confirms every signed record's data is intact along with the certificate
chain. When a Vehicle Unit contains only overview/control records and no
verifiable data files, verification evaluates the member-state and VU
certificate chain alone, yielding the narrower `chainVerified` status (§5.1)
rather than full `valid`/`partiallyValid`/`invalid`.

`src/viewer/parser/` is the sole owner of this boundary: `client.ts` talks
to the native parser; `decoders/` turns raw parser results into typed
documents; `normalizers/` (plus `card/` and `vehicle-unit/` subfolders)
convert decoded records into the app's own readonly domain types (plain
TypeScript `readonly` types, not runtime `Object.freeze`); `certs/` holds
the pinned ERCA public keys used for signature-chain verification.
Vehicle-unit record lists are validated by one pair of decoders in
`vehicle-unit/vehicle-unit-record-array.ts`: `decodeVehicleUnitCountedRecords`
for Gen1 lists (a separate count field that must equal the array length) and
`decodeVehicleUnitRecordArray` for Gen2 record arrays; a list that fails either
yields no records and one `inconsistentData` warning. Transfer-parameter
generation comes from the typeId prefix (`vehicle-unit-generation.ts`), and
required/optional timestamps share `vehicle-unit-timestamps.ts`. The card's
cyclic location sections (places, GNSS positions, border crossings,
load/unload operations, load types) go through one `normalizeCyclicSection`.
Card and vehicle-unit verification decoders share the aggregate-status check
(`decoders/parser-verification-status.ts`). Technical-record factories that
only add the record kind and the source's generation share
`completeTechnicalRecord` (`tachograph-domain/technical.ts`).
Signature verification itself (Gen1 RSA-1024, Gen2 brainpoolP256r1
ECDSA-256) is implemented natively inside the vendored parser crate
(`vendor/esm-parser/src/tachograph_gen2/verification.rs` and the Gen1
equivalent), not in TypeScript. Vehicle Unit verification in the native
Tauri backend invokes both certificate-chain verification
(`verify_vu_certificate_chain`) and full data record verification
(`verify_vu_full`) against the pinned ERCA key, combining certificate
and record verification items into a single unified result. When data
records are present and verified, this provides full integrity verification;
files lacking verifiable data records fall back to certificate-chain-only
verification (`chainVerified`, §5.1).
Verification progress belongs to the currently opened document. Opening a
second file while an earlier signature check is running starts its own check;
the earlier result cannot update the new document or clear its progress state.

Run `pnpm parser:sync-types` after updating the `vendor/esm-parser`
submodule pin to resync the generated WASM/native boundary declarations.

Time semantics: parser timestamps are preserved as exact UTC instants or
exact source date/time — no implicit machine-locale/timezone conversion in
components. Malformed `TimeReal` values whose encoded hour, minute, or second
components are outside their valid ranges are rejected rather than normalized
into another time. All-zero card-identity timestamps normalize to absence, and
all-zero daily records are omitted. Unset `TimeReal` fields (where the unit left
the `u32::MAX` maximum `TIME_REAL_NOT_SET` because it had nothing to record for
the field, such as card withdrawal time when the card is still inserted at download)
are serialized by the parser as `null` and normalized to absence without emitting
spurious `invalidValue` warnings. If encountered in string form, the legacy maximum
(`2106-02-07 06:28:15 UTC`) is likewise mapped to absence. Same-generation duplicate activity,
event, or fault evidence is retained once and produces a source-linked
duplicate-evidence warning instead of being silently double-counted.

Driver-card activity changes are decoded by the parser as the tachograph
specification defines the `ActivityChangeInfo` word: while the card is not
inserted, bit 14 says whether the following activity was entered by hand. A
card-out period with a manual entry keeps the entered activity (parser source
`Manual`); one without a manual entry has activity `Unknown`, because the
activity bits are not relevant then, and the normalizer turns it into an
`'unknown'` interval rather than the activity that happened to be selected when
the card was withdrawn. Every recorded interval also carries `slot` (`Driver`,
`CoDriver`, `Unknown`) and `crewPresence` (`crew`, `single`, `unknown`). Both
come from the change only while the card is inserted: `crew` means two valid
driver cards were inserted. For a card that is out they are always unknown,
because bit 14 then means manual entry and the slot bit names at most the slot
the card left. Inferred gaps and unrecorded time are unknown as well. `CardSlot`
uses the parser's own spelling, so card and vehicle-unit normalizers assign the
parser's slot value directly. Compliance evaluation reads card-out time as §6
"Unrecorded time" describes.

Large binary data crosses the IPC boundary as raw bytes rather than JSON number
arrays, which would inflate a 50 MB file several times over. `read_ddd_file`,
and `generate_pdf_document` return a raw binary response
(`tauri::ipc::Response`), and `parse_ddd_memory` takes the file as the raw
request body. Two bounded certificate fields travel as JSON number arrays to `verify_document` / `verify_vu_document`: the ERCA root key and vehicle-unit certificates. An opened file crosses the IPC
twice as raw bytes, once back from `read_ddd_file` and once out to
`parse_ddd_memory`, because the renderer hashes the bytes itself and a dropped
file has no path for the backend to read (§12). The renderer decodes every such response from `unknown` with
`decodeBinaryPayload` (`src/contracts`), which accepts an `ArrayBuffer`, a
`Uint8Array`, or, for the IPC's JSON fallback, a byte array checked element by
element (holes included), each within a stated size bound. A failed
`read_ddd_file` rejects with a typed `{ code, error }` value decoded by
`decodeReadTachographFileFailure`; parse and verification answers are checked
for their `{ ok, data }` shape before their payload is decoded. Native
TypeScript declarations alone are not treated as runtime validation. Before
opening a file the native reader also confirms it is a regular file, so a named
pipe or device given a tachograph extension is rejected instead of blocking a
worker thread.

## 5. Viewer capability (`src/viewer`)

Single-file evidence viewer. `ViewerRoot.svelte`/`ViewerApp.svelte` drive the
load lifecycle (Welcome → Opening → ready, or Open Failure) and, once a
document is open, render `AppShell` (§9) with `DocumentHeader`,
`DocumentNavigator`, and whichever screen the navigator currently selects.
`ViewerApp` keeps only wiring: per-document viewing state (section filters,
table searches, speed range, activity-day links) lives in
`ViewerDocumentSession`, which resets all of it when another document opens,
and `ViewerSectionViewModels` derives the open document's overview, the view
model of the visible section only, and the record inspector.

A document can also be opened by dragging a file onto the window at any
time: `FileDropSurface`/`DropFeedback` (`src/ui/layout`) track HTML5 drag
depth (so nested enter/leave events don't flicker the overlay), show the
dragged file's name in a full-window drop overlay, and are disabled while a
load is already in progress. Files dropped this way are read as bytes in the
renderer (`IDroppedTachographFile`, no filesystem path) and are never added
to the recent-files list (§9), since there is no real path to reopen them
with later.

A hidden Viewer workspace disables its drop surface while keeping shared
dialogs mounted.

**Recent files**: when "Remember recent files" is enabled in Preferences,
every file opened through the native Open dialog or reopened from
Comparison/Recent-files is recorded (most-recent first, capped at 8,
deduplicated by path) and shown on the Welcome screen with a one-click
reopen action and a "clear recent files" action. A
drag-and-dropped file is never added — it has no real filesystem path to
reopen with. The stored entry carries the real path (needed to reopen the
file later), but the UI only ever renders the file's basename-only display
name, matching the app's privacy-by-construction rule for file identity
(§9); the path itself never reaches a rendered element. Persistence reuses
the existing preferences store (`localStorage` in the current Tauri host,
§9) — no separate storage mechanism.

### 5.1 Screens (`src/viewer/feature/components/screens/`)

- **Overview** — structured as a modular Bento grid across five responsive cards:
  an Identity hero card (span 7) featuring driver or vehicle name with icon,
  issuing state badge, and a key-value grid (card number, date of birth, validity
  dates, licence fields, VIN, registration state, and raw source link) using stacked item formatting
  (label on top, value below) preventing text overflow or horizontal overlap;
  a Document & File Coverage card (span 5) detailing file size, opened timestamp,
  coverage span, SHA-256 hash, and a contents summary recomputed by the viewer;
  a Security & Integrity card (span 6) with status badge, verified item metrics,
  and verification actions; a Normalization Warnings card (span 6) with warning
  counts and source reference links; and a full-width Card Notes card (span 12)
  when notes are present. Responsive layout stacks cards to one panel per row
  (span 12) at <= 68rem (1088px), and collapses detail grids from 2 columns to 1
  column at <= 56rem (896px). Above the grid, KPI tiles display active days,
  activity intervals, events/faults, warnings, and security alerts.
- **Activities** — contextual return breadcrumbs when navigated from linked
  record sections back to the originating activity day; three tabs:
  - *Day*: a per-day records table (start/end, duration, activity, card
    slot, crew — two cards, one card, or no crew status — and evidence) with
    the shared data-table filter/column-filter UI, a
    day-summary totals list, a continuous-driving ratio/peak notice that uses
    every break credited by the compliance evaluation (including qualifying
    co-driver availability), a
    duty-shift heading (with cross-day continuity badges for shifts spanning
    midnight, or "no work shift" when a day has full daily rest),
    previous/next-day navigation, a shift vs. UTC totals toggle, cross-links
    into Events & Faults / Places / Associations scoped to that day or vehicle,
    and an embedded Activity Timeline chart. Selecting a table row also selects
    the corresponding timeline point and vice versa. Infringement inspector
    selection is session-owned and clears when the opened document session
    changes, so a source reference from the previous file cannot remain
    selected. Timeline infringement pins show the translated rule title.
    Each duty-shift card also shows which daily-rest rule the compliance
    evaluation applied (§6 "Multi-manning"): a badge for a qualifying
    multi-manning period (30-hour rule), a failed condition, or an unknown
    crew status (both 24-hour rule), and a "Daily rest window" stat with the
    window's start and end (`+1 d` when it ends on a later date) and length.
    A failed or unknown period adds a note naming when the deciding driving
    happened, with a "Show on timeline" action that selects that record. The
    crew state comes from `resolveCrewDutyPeriods`, which cuts duty periods at
    the same boundaries as the daily-rest evaluator, and is matched to the
    shift whose start it contains; a single-driver shift has no badge.
  - *All Days*: one summary table across the whole document, with a crew
    column (the day's most telling crew badge) and a per-day "show day"
    action that jumps into the Day tab for that date.
  - *Calendar*: a month/year presence-heatmap grid with keyboard
    navigation, day selection opening the chosen day view across both modes,
    full-width responsive cell sizing, a crew glyph on days with a multi-manning badge (its text is
    part of the day's accessible name and tooltip, and the legend lists the
    glyph while the visible month shows one; `ChartLegend` takes icon entries
    as well as colour swatches), a from/to date-range picker with per-range/month/year
    totals and invalid-range handling. Impossible dates are rejected rather
    than silently normalized into another month.
  - The **Activity Timeline** (used by the Day tab) is an ECharts interval
    chart with infringement markers overlaid, retry-on-load-failure, and
    explicit ARIA role/description text since it renders to canvas. On a day
    with co-driver availability counted as a break, an "Availability counted
    as a break" lane draws the credited 45 minutes with the diagonal pattern
    (in the band view it covers that part of the availability bar, and the
    legend names it). In the lanes view, a day with crew records adds "Card in
    the co-driver slot" and "Two driver cards inserted" rows; they stay out of
    the band view, where they would cover the activity band. The daily-rest
    window of a multi-manning-related duty period is shaded behind the lanes
    with its length ("30-hour daily rest window"). Choosing any of these extra
    segments selects the underlying activity record. An
    **Activity Window Records** panel below it can filter to just the
    records inside a selected window, with a "show all" escape hatch.
- **Speed** — a detailed 1-second speed chart with HGV/limiter reference
  lines, adjustable via preset ranges (1 min / 5 min / 1 hour / full trip)
  or a manual start/end range (apply/reset, invalid-range handling); summary
  statistics (min/max/average/sample count); an overspeed-events table
  (max speed, duration, purpose, card number, similar-event grouping); and a
  paginated raw-samples table (time, speed, source) whose row selection is
  bidirectionally linked to the chart's selected point.
- **Places** — recorded positions, border crossings, and load/unload
  operations, each with country entered/left, odometer reading and
  discrepancy notes, GNSS accuracy/coordinate-precision caveats, and a
  copy-coordinates action; an embedded vector/GeoJSON map (pan/zoom/fit-
  route controls, an "approximate position" badge) alongside a step-by-step
  track list; a per-shift selector; and a journey-view toggle between
  "split," "step track," and "vector map" layouts. Selecting a map waypoint
  or a track/table row selects the same record everywhere else on screen.
  The journey card is its own component (`PlacesJourneyPanel`, which owns the
  view mode, map route, and shift controls); `PlacesScreen` keeps the active
  shift, since the records table is filtered to the same linked day.
- **Associations** — card ↔ vehicle-unit pairing history: VIN, device
  manufacturer/software version, slot, first/last use, inserted/withdrawn
  timestamps, and session distance/odometer, filterable and linkable back
  to the Activities day the session falls in. Rendered with the fixed-viewport
  desktop data grid pattern (`fillHeight` on `RecordSectionLayout`), pinning
  screen headers and generation filters while the table body scrolls vertically
  from row 1.
- **Events & Faults** — a filterable table (type, purpose, source) with a
  security-alerts summary (critical count), similar-occurrence grouping,
  per-record start/end/duration, and row selection that opens the
  underlying raw-data source pointer. Rendered with the fixed-viewport desktop
  data grid pattern (`fillHeight` on `RecordSectionLayout`), where the screen
  header, type filter bar, and security-alerts summary banner are pinned with
  fixed height while the table body takes all remaining height and scrolls
  from row 1.
- **Technical** — technical/operational detail records in an ARIA-indexed
  list with an additional-description panel and a copy-value action
  (with copy-succeeded/copy-failed feedback). For vehicle-unit documents
  this includes the VU's own automatic daily odometer-at-midnight log
  (`OdometerValueMidnight`, Annex 1B/1C) — one entry per calendar day it
  has activity data for, independent of whether any card was ever
  inserted.
- **Integrity** — per-record signature-chain verification results, scope
  and status per verification item, a "verify signatures" action, and an
  explicit limitations disclosure when verification scope is only partial.
  What is actually verifiable: Gen1 driver/workshop card applications
  (144-byte ERCA RSA key) and Gen2 driver/workshop card applications
  (205-byte ERCA CVC, brainpoolP256r1) are checked and reported
  valid/invalid per file; a Gen2 Company or Control card application has no
  signature to check at all and is always reported `unsupported`
  (`unsupportedCardApplication`), never valid or invalid. Vehicle Unit
  downloads undergo unified full verification: both the VU's own member-state /
  VU certificate chain (from its Overview/Control record) and the signatures of
  downloaded data records are verified against the pinned ERCA key. When data
  records are verified, the VU yields a standard `valid`/`partiallyValid`/
  `invalid` integrity assessment with itemized certificates and records. If only
  the certificate chain is present or verifiable, it produces the narrower
  `chainVerified` status (with a `valid`/`partiallyValid`/`invalid` `chainStatus`
  sub-field rendered with a caution icon so it is not mistaken for full-data
  verification). A VU download with no Overview/Control record at all (e.g. a
  partial/truncated download) has nothing to verify and is reported
  `unsupported` (`missingVehicleUnitOverview`).
- **Comparison / Session history** — a side-by-side table across every currently open
  document: identity, kind, coverage, odometer range, activity totals,
  content counts, security counts, integrity status, and overlapping-
  session detection (half-open intervals: sessions that only touch at one
  instant do not overlap, and a session without an end is the instant of its
  start), with per-cell "differs" highlighting, remove/reopen/
  clear-all actions, and export of the comparison itself to HTML or PDF.
  Rendered with the fixed-viewport desktop data grid pattern (`fillHeight` on
  `RecordSectionLayout`), pinning screen headers and diff/export action controls
  while the comparison table body scrolls from row 1.
- **Raw Data** — the canonical JSON-pointer tree explorer: a breadcrumb,
  collapse-all/expand-one-level controls, in-tree search with next/
  previous match navigation and a "results truncated" notice for large
  matches, and a per-value inspector (type, RFC 6901 path, structured
  value, copy-path/copy-value actions) — every displayed value elsewhere
  in the app traces back to a path here, so nothing is a lossy display
  transform of the decoded document.
- **Load lifecycle**: Welcome (no document open yet — see the recent-files
  list below), Opening (load in progress), Pending Section (a section still
  loading while others are ready), Open Failure (parse/open error with
  detail).

### 5.2 Dialogs & application commands

Eight application commands are defined once, with their labels and keyboard
accelerators, in `src/localization/application-catalogue.ts`, and are shared
between the Command Palette and the User Guide dialog:

| Command | Accelerator |
| --- | --- |
| File → Open | `Ctrl/Cmd+O` |
| File → Export | `Ctrl/Cmd+Shift+E` |
| File → Close | `Ctrl/Cmd+W` |
| View → Command Palette | `Ctrl/Cmd+K` |
| Application → Preferences | `Ctrl/Cmd+,` |
| Application → User Guide | `F1` |
| Application → About | — |
| Application → Export Logs | — |

`ViewerCommandController` disables File Close/Export while no document is
open, and disables everything while the document is busy loading or another
modal (Preferences, About, Export) is already open.

Native window actions use the same typed label and accelerator catalogue but
remain independent of document-command availability. Linux Quit uses `Ctrl+Q`;
Linux and Windows Full Screen use `F11`. These are enabled native menu commands
that dispatch `execute_window_command` to request application exit or toggle
the invoking window's fullscreen state. macOS retains its predefined native
Quit and Fullscreen items; Windows retains its predefined Quit item. Labels are
translated in all seven catalogues and rebuilt when the selected language changes.

- **Command Palette** (`CommandPaletteDialog.svelte`): keyboard-driven
  command launcher over the table above.
- **Export file names** follow the display language: every suggested name
  for compliance documents and the comparison report starts from a translated stem (`*.fileName*` keys),
  passed through `fileNameSegment` (`#contracts`), which keeps letters in any
  script and replaces separators and reserved characters with `_`. Single-document viewer exports keep the opened file's own name.
- **Export** (`ExportDialog.svelte`): exports the open document as HTML,
  PDF, or raw normalized JSON, each format with its own short description,
  a filename field, and distinct error states (destination exists, I/O
  error, source conflict, generic failure). Section content is built once as
  format-neutral data in `feature/helpers/report-tables.ts` (report tables,
  identity groups, technical records); `report-html.ts` lays it out as the
  standalone HTML report (and the comparison report) and `report-pdf.ts` as the
  landscape `factualReport` PDF request. Both formats carry the same content:
  every section, column, and row (all five Places record kinds, Gen2
  vehicle-unit uses, technical records with their source, integrity counts,
  scopes and verification items, notes, "section unavailable" messages, and
  the limitations list); only the layout differs (the PDF joins multi-line cells
  with " · ", prints missing values as "—", and adds a per-date activity totals
  table and a timeline bar per day). The per-day activity table includes the
  card slot and crew columns.
- **Preferences** (`PreferencesDialog.svelte`): organized into five left-nav
  categories (General, Date & Time, Night Work Window, Files & Privacy,
  Appearance), reusing the same generic vertical `Tabs` layout as the User
  Guide dialog below rather than a bespoke two-pane component. General:
  language (English/German/French/Italian/Polish/Spanish/Croatian), theme (system/light/dark), an
  auto-run-verification-on-open toggle. Date & Time: date format
  (`dd/MM/yyyy`, `MM/dd/yyyy`, `yyyy-MM-dd`, medium-date), time format
  (24h/12h). Date pickers follow the selected date format;
  numeric entry also accepts trailing separators and unambiguous day/month
  order. Night Work Window: the IANA time zone and start/end hour used
  by the Compliance working-time evaluator on every screen that evaluates
  compliance (Compliance, Activities infringement pins, and exports). Directive 2002/15/EC Art. 3(h) leaves the
  window to national law but bounds it to at least four hours between 00:00
  and 07:00, so the dialog offers start hours 0–3 and end hours from four hours
  after the start up to 7, moving the end forward when a later start would leave
  less than four hours. The preferences decoder and controller reject any other
  window (`isNightWorkWindow` in `src/contracts`). Files & Privacy: independent
  "remember last opened folder" and "remember recent files" toggles — both
  off by default. The first makes the native Open dialog default to the
  last-used directory; the second shows reopenable files on the Welcome
  screen. Disabling recent-file history immediately discards any
  already-remembered files, not just future ones. Existing preferences saved
  with the former combined toggle migrate that choice to both settings.
  Appearance: density (comfortable/compact, with a live preview panel).
- **About** (`AboutDialog.svelte`): app/runtime/platform version info, the
  pinned parser commit, GPL source/license disclosure, and a
  copy-diagnostics action.
- **User Guide** (`UserGuideDialog.svelte`, `F1`): renders the same command
  list (open, export, preferences, user guide, close) with their
  accelerators, plus the dialog's own close shortcut, as an in-app
  cheat sheet. Its default **Getting started** tab explains single-file
  inspection and comparison, supported extensions and
  the 50 MB limit, source-file handling, and optional path history. The
  Features tab describes the decoded JSON tree inspector without implying
  a binary hex viewer. The Time Bases and Integrity tabs describe computed
  duty-shift boundaries and the distinction between signed VU records and
  certificate-chain-only verification. Its **EU Rules** tab lists
  every rule family the compliance engine applies, one card each: Regulation
  561/2006 (limits, the 24-hour period, weekly rest, weeks, ferry/train),
  Regulation 2020/1054 review items, multi-manning (Article 4(o), the
  Article 8(5) daily rest quoted from the Regulation, reduced rests, and
  co-driver availability as a break),
  Directive 2002/15/EC working time, Regulation 581/2010 download deadlines,
  Regulation 165/2014 anomalies, the severity bands, the rule profiles, and
  what the viewer does not decide (how far two inserted cards prove a crew,
  facts outside the file,
  manual entries, unrecorded time, UTC evaluation).
  It also discloses that incomplete UTC weeks are excluded from two-week
  weekly-rest checks and the daily-driving Most Serious label can be too
  high on a permitted ten-hour day. All guide content is translated into
  the seven supported languages.

## 6. Compliance capability (`src/compliance`)

**Rule evaluation**: data-driven rule evaluation against several regulatory
profiles — EU standard Regulation (EC) 561/2006, Mobility Package 2020,
Directive 2002/15/EC (working time, Art. 4/5/7), UNECE AETR 2020, and UK GB
Domestic rules. Evaluators live in `src/compliance/domain/evaluators/`:
`driving-evaluator`, `break-evaluator`, `rest-evaluator`,
`weekly-rest-evaluator`, `working-time-evaluator`, `anomaly-evaluator`
(card-less vehicle motion anomalies).

Every evaluator compares exact elapsed milliseconds with the configured legal
thresholds, never independently-rounded minute values, through two shared
`rule-profile.ts` helpers: `measureExcessMinutes` (a duration measured
against a legal maximum — continuous work, driving limits, night work) and
`measureDeficitMinutes` (its mirror image, a duration measured against a
legal minimum — daily and weekly rest shortfalls, as well as working-time break
shortfalls under Directive 2002/15/EC Art. 5(1), which measures the deficit
against the 30-minute or 45-minute required break). Both round the reported
excess/deficit up and the reported measured value up or down respectively
from the same unrounded millisecond duration, so a genuine breach can never
round itself away to a zero excess or deficit at a sub-minute boundary in
either direction.

For daily rest evaluation, when reduced rest is permitted (up to three reductions
between weekly rests), `allowedValueMinutes` and the deficit are both evaluated
against the reduced limit (540m / 9h); once reductions are exhausted, both are
evaluated against the regular limit (660m / 11h), ensuring mathematical
consistency between allowed, measured, and deficit values. A daily rest may
extend into a weekly rest (Art. 8(3)), so a weekly rest also counts as the daily
rest of the cycle it ends: the part of it inside that cycle's 24-hour window is
measured like any other rest. For example, 16 hours of work followed directly by
a weekly rest leaves 8 hours of rest in the window, a 60-minute shortfall against
the reduced daily rest.

**Unrecorded time.** A card-out period without a manual entry (`'unknown'`), an
inferred gap inside a day, and days without any daily record between two records
do not show what the driver did. Regulation (EU) No 165/2014 Art. 34(3) requires
time away from the vehicle, breaks and rest included, to be entered manually,
and the records are the primary evidence of rest, so such time proves a missing
entry, not missing rest. `resolveUnrecordedTime` (`unrecorded-time.ts`)
therefore turns every such stretch between the first and the last record into an
`IUnrecordedRestInterval` (activity `breakOrRest`, origin `unrecordedTime`)
before merging, and every rest, break, driving-cycle, and working-time rule is
evaluated on this most favourable reading the records allow. A finding that
remains is a breach even if the driver rested throughout the unrecorded time.
Time before the first or after the last record stays `'unknown'`. The unrecorded
interval's source is its card-out record, or for time with no record the last
record before it, so a finding anchored on it keeps a source. A merged rest that
joins recorded and unrecorded pieces keeps the attribution of its recorded
piece, and the two-week weekly-rest check still requires recorded activity in
the pair. Each unrecorded period (adjacent pieces joined, named by its card-out
record when it has one) becomes an `UNRECORDED_PERIOD_REVIEW`
`externalEvidenceRequired` assessment (category `anomaly`, Art. 34(3), recorded
at the period start) under EU profiles when it lasts at least the profile's
shortest break part (15 minutes) and a later record closes it. A period still
open when the records end is skipped, because its manual entry is only due at
the next card insertion. The AETR and GB domestic profiles apply the same
reading without the review item. The Compliance screen qualification and the
guide's limits card say so; see §12 for what the favourable reading can hide.

Daily driving time is bounded within the same 24-hour cycle that the
daily-rest evaluator measures (Regulation (EC) No 561/2006 Art. 8(2) & 4(k), as
applied by the Commission's Guidance Note 7). A cycle starts at the end of the
last single rest of at least the reduced daily rest. When no rest qualifies, the
next cycle starts where the previous 24 hours ended. When a cycle ends inside a
rest that only later reaches the qualifying length, the next cycle starts when
that rest ends. When no earlier rest is visible (start of the record, or a gap
of more than 24 hours), the cycle starts at the first driving. A drive that
runs past the end of its cycle is cut there, as Guidance Note 7 does, and each
part counts in the cycle it lies in, so driving across multiple days does not
compound into a phantom multi-day daily driving violation. Weekly, bi-weekly
and weekly working-time totals cut an interval the same way at Sunday
midnight (`splitByCalendarWeek` in `src/time`), so a drive or work stretch that
crosses into the next week counts in each week it lies in. The cycle
calculation lives in `daily-cycle.ts` and is shared by the driving, daily-rest
and working-time evaluators. Each evaluator asks a cycle policy
(`IDailyCyclePolicy`) for a window's length: the driving and daily-rest
evaluators use the multi-manning policy (`createDailyCyclePolicy`, below), which
gives a qualifying multi-manning duty period 30 hours, and both build it from the
same intervals, so they cut every duty period at the same boundary. The
working-time evaluator keeps 24 hours (`STANDARD_DAILY_CYCLE_POLICY`), because
Directive 2002/15/EC counts its own periods.

Continuous driving break evaluation (Art. 7) recognizes both continuous
45-minute breaks and split breaks (>= 15 minutes followed by >= 30 minutes). Any
subsequent break of at least 15 minutes updates the candidate first break,
allowing a newer 15-minute break to pair with a subsequent 30-minute break
rather than being discarded. One uninterrupted stint is reported as a single
infringement whose measured value and severity keep growing with the stint's
total driving time (Annex I classifies by total driving without a break); it
is closed only by a qualifying 45-minute break or a valid 15 + 30 split, so a
short non-break interruption after the breach does not restart the count. A
15-minute first split taken before the breach stays paired: its 30-minute
completion, even though late, ends the stint, and the breach is measured by the
driving accumulated before that break. For example, 4h driving, 15m break, 1h
driving, 30m break reports 5h (30 minutes over) and starts a new stint. This is
the standard-profile rule; the specific break arrangements the consolidated
Regulation allows for some occasional passenger services are not evaluated.

Severity classification follows Annex I of Commission Regulation (EU)
2016/403, which defines a four-tier classification — minor, serious (SI),
very serious (VSI), and Most Serious Infringement (MSI). `rule-profile.ts` holds
per-rule-id margin bands (`annexISeverityBands`) for the categories Annex I
classifies — continuous-driving breaks, daily and weekly driving limits, and
daily and weekly rest shortfalls — falling back to a profile's flat
`severityThresholds` for rules Annex I does not classify (working-time) and for
profiles Annex I does not govern (AETR, UK GB Domestic). Annex I states excess
bands by a lower-inclusive bound on the value exceeded ("10h ≤ … < 11h" of daily
driving), so `calculateSeverity` puts an excess exactly on a margin in that tier.
It states rest bands by the rest actually taken ("7h ≤ … < 8h" of a 9-hour
reduced daily rest), so `calculateDeficitSeverity` keeps a deficit exactly on a
margin in the lower tier: exactly 8 hours of reduced daily rest is minor, 7h59 is
serious. Insufficient daily rest uses the band of the rest that was required:
rows 18–19 (reduced, 9h: SI below 8h, VSI below 7h) while a reduction was
allowed, and rows 16–17 (regular, 11h: SI below 10h, VSI below 8h30) once none
was. Weekly rest shortfalls use rows 24–27 the same way. Anomaly rules
(driving without card under Art. 34(1) of Regulation (EU) No 165/2014, and
motion data error / vehicle motion conflict under Art. 32(1)) are explicitly
classified as Most Serious Infringements (MSI) per Regulation 2016/403 Annex I.
Profiles declare `regulationName` to supply dynamic legal citations (e.g.
Regulation (EC) No 561/2006, UK Transport Act 1968, UNECE AETR) across driving,
break, and rest findings. Findings-table badges, KPI tiles, activity-timeline
pins, and the Driver Infringement Acknowledgment Letter surface the MSI tier,
and review assessments group by rule ID with an `occurrenceCount`. The MSI
threshold for the daily driving limit is calibrated to the standard nine-hour
limit rather than tracking whether an extension was taken; see §12 for the
resulting simplification.

The night-work daily limit (Art. 7(1) of Directive 2002/15/EC, "in each
24-hour period") applies when work falls inside the configured local night
window on any civil day the work touches in the window's time zone, including
zones behind UTC and work crossing local midnight. It checks a window starting at every working-time interval, not
only at sparse points reached after each previously-checked window — that
sparse-anchor approach is correct for the rest-cycle evaluators, whose window
legitimately jumps forward to the next real duty period once a cycle
resolves (anchored to an actual legal reference point, the end of the
previous qualifying rest), but night work has no equivalent "resets on X"
concept, so a violation whose 24-hour span falls between two sparse anchors
must still be checked directly. Checking every interval as an anchor
collapses a run of consecutive, overlapping detections of the same
underlying breach into one reported finding, the same way the weekly-rest
evaluator does for overlapping two-week windows.

Availability is neither working time nor qualifying break or rest:
[`Directive 2002/15/EC`, Article
3(a)–(b)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32002L0015)
and [`Regulation (EC) 561/2006`, Article
4(d)–(f)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02006R0561-20200820)
keep those concepts distinct. Once an Article 8(2) daily-rest window has been
anchored by the preceding daily or weekly rest, however, elapsed availability
still consumes that running 24-hour window. When the preceding rest is outside
the available evidence, availability alone does not establish a new window
anchor.

The weekly-rest evaluator applies the ordinary Article 8(6) rule over each
fully covered pair of consecutive weeks: two regular weekly rests, or one
regular and one reduced weekly rest. It separately enforces the six-by-24-hour
deadline from the end of the preceding weekly rest. It does not impose a
stricter one-rest-in-each-calendar-week shortcut. A rest crossing a week
boundary is a single distinct rest under Article 8(9), never two rests merely
because it touches both weeks.

The Mobility Package profile reflects Regulation (EU) 2020/1054 from
2020-08-20. Its amended rules are gated by that effective date rather than by
profile selection alone. Two-week windows wholly before the date retain the
ordinary Article 8 result; windows wholly after it apply the Mobility logic. A
window crossing the date produces an applicability review instead of a
definitive missing-regular-rest conclusion.

For a wholly post-effective window, two consecutive reduced weekly rests are
not labelled a missing regular-rest infringement: the international-goods
derogation depends on both rests starting outside the employer-establishment
state and the driver's residence country, plus at least four weekly rests
including two regular rests in each applicable four-week window. The file does
not reliably establish all of that context, so the pattern produces an
`externalEvidenceRequired` assessment. The linked Article 8(6b) compensation
timing is also an external review, not a fabricated violation.

Article 8(8) vehicle/accommodation facts and Article 8(8a) employer-organised
return opportunities within each four-week period — and before compensatory
regular weekly rest after two consecutive reductions — likewise remain
external-evidence assessments. A DDD file cannot establish vehicle use during
a rest, accommodation, employment status, residence or normal operational
centre, employer organisation, travel arrangements, or driver refusal. These
assessments have no infringement severity and never assert either infringement
or compliance. They are evidence-driven rather than generic profile warnings:
the accommodation review appears only when a recorded regular weekly rest of at
least 45 hours starts in post-effective evidence, and the return-organisation
review appears only when the document fully covers at least four consecutive
post-effective calendar weeks. Short files without relevant evidence show
neither review. Legal sources:
[Regulation (EU) 2020/1054](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32020R1054),
the [consolidated Regulation (EC) 561/2006 effective
2020-08-20](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02006R0561-20200820),
and the [European Commission driving/rest-time
guidance](https://transport.ec.europa.eu/transport-modes/road/mobility-package-i/driving-rest-times_en).

Article 9(1) lets a driver accompanying a vehicle transported by ferry or
train interrupt a *regular daily rest* or a *reduced weekly rest*, by other
activity, at most twice, totalling at most one hour. When a rest is
fragmented in exactly that shape (at most two interruptions, at most sixty
minutes combined) and the combined rest reaches the relevant threshold, the
underlying daily-rest or weekly-rest infringement is never suppressed — a
DDD file cannot establish that the driver actually accompanied a vehicle on
a ferry or train, or had access to a bunk or couchette, so an ordinary
interrupted rest unrelated to any ferry or train would look identical. A
`DAILY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW` or
`WEEKLY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW` `externalEvidenceRequired`
assessment is added alongside the infringement, flagging that Article 9(1)
may apply if that evidence exists outside the file, rather than silently
reclassifying a possible violation as compliant. For the same reason a rest
interrupted in that shape does not end the 24-hour daily cycle in any
evaluator: the daily-rest, daily-driving and working-time evaluators all keep
the same window, so the driving of both sides of such a rest is still measured
against one daily limit. The weekly-rest candidate is
found by greedily grouping consecutive rest fragments across the two-week
window being evaluated: a group only grows while its own accumulated
interruption count and duration stay within the profile's limits, so
genuinely distant, unrelated daily rests elsewhere in the window are never
merged into a false candidate.

The Mobility Package profile picker shows a short scope note explaining that
its numeric limits equal the 2006 Regulation's own limits and that its
2020-specific obligations surface only as flagged review items, never a pass
or fail verdict.

**Multi-manning** (`multi-manning.ts`). Article 8(5) replaces the Article 8(2)
24-hour window with 30 hours and a nine-hour daily rest for a driver engaged in
multi-manning. Whether a duty period qualifies (Article 4(o)) is decided from the
driver card's own `crewPresence` (§4), `crew` meaning two valid driver cards
were inserted: the duty period starts at its window start and ends at the first
rest of at least nine hours, or 30 hours later. Only driving is tested, because
the article requires a second driver "to do the driving": single-card driving
during the first hour (measured from the first driving or work) is allowed,
work or availability with one card (for example while drivers swap slots) never
fails it, and a single-card drive of at most one minute next to a crew or slot
change is treated as card-change noise. The second driver may change. A period
with crew driving whose later driving had one card is `crewFailed`, one with
driving of unknown crew status is `unknown`, and one without crew driving is
`single`; only `crew` gets the 30-hour window. The profile's
`multiManningRules` holds these values, and is null under `UK_GB_DOMESTIC`,
which has no such derogation.

In a qualifying period, rest shorter than nine hours within the 30-hour window
is reported as `DAILY_REST_MULTI_MANNING` (Art. 8(5), Annex I rows 22-23:
serious below 8 hours, very serious below 7 hours, no most-serious tier). A crew
rest of at least nine but under eleven hours counts as one of the three reduced
daily rests of Article 8(4), and once they are used the existing
`DAILY_REST_REDUCTIONS_EXCEEDED` applies; eleven hours or a 3 + 9 hour split
counts as regular. Daily driving is measured over the same 30-hour period.

From 20 August 2020 under the Mobility Package profile (`availabilityBreakFrom`),
co-driver availability of at least 45 consecutive minutes with two cards inserted,
in a qualifying period, ends the continuous-driving stint like a recorded break
(Article 7, third paragraph, applied as the Commission's Q&A describes enforcers
doing, because the tachograph forces availability on the co-driver while the
vehicle moves). It never counts as a split part, and recorded split breaks keep
their ordinary evaluation. Every such period is listed as a
`MULTI_MANNING_AVAILABILITY_BREAK_REVIEW` assessment, because the data cannot
show that the co-driver was not assisting the driver.

When evaluation merges contiguous intervals, driving, work and availability
merge only within one slot and crew status, while rest merges across them
because the rest rules measure its uninterrupted length. The driver card cannot
name the co-driver, and vehicle-unit card-slot data is not used by the
evaluators (§12).

**Compliance screen** (`ComplianceScreen.svelte`, reachable from the
document navigator's Overview group): a findings table (title, category,
legal reference, measured/allowed/excess values, severity, source) with
free-text search, a category filter (anomaly, break, daily rest, night
work, weekly rest, or all), a severity filter (minor, serious, very
serious, most serious, or all), a toggle between a flat view and a view grouped by legal
article, per-severity KPI subtext, and distinct empty states for "no
infringements at all" versus "no results for the current filter." Two
actions open the reporting dialogs below. A persistent notice beside the
regulatory-profile controls identifies all findings as Viewer evaluations
based on the selected rule profile and available evidence, not final legal
conclusions, states that a duty period is treated as multi-manning when two
driver cards were inserted (evidence of a second driver, not proof, and not
applied under the GB domestic profile), states that
manually entered activity (for example, a period entered by hand because the
card was out of the vehicle) is evaluated the same as recorded activity even
though it may not reflect what happened, states that time without recorded
activity is evaluated as rest and listed for review, and directs users to
qualified review for important findings.
When the selected profile produces external-evidence assessments, a separate
accessible review section names each requirement, its legal reference, and the
evidence limitation. It is visually and semantically separate from the
infringement table and does not display severity. A document where the same
rule fires for several periods (for example one Mobility Package
two-consecutive-reduced-weekly-rest review per qualifying week pair) shows
that explanation once, with an occurrence count, instead of repeating the
identical paragraph once per period.

**Reporting outputs**:
- **Driver Infringement Acknowledgment Letter**
  (`DriverInfringementLetterDialog.svelte`): company heading/address/VAT-or-
  registration, driver/card/vehicle/VIN identity, the audit period, a
  findings table (date/time, description, measured/allowed/excess,
  severity), a driver-acknowledgment statement with an explanation field,
  driver and manager signature blocks with date, and print/save-HTML/
  save-PDF actions. The typed explanation is printed in every output (the PDF
  request's `driverComments`, line breaks kept); left empty, the box stays
  blank for a handwritten statement. The on-screen preview and both exported formats carry the
  same qualification that the calculations are not a certified legal
  assessment. It contains infringements only; external-evidence review items
  are intentionally excluded because an infringement acknowledgement must not
  present an indeterminate requirement as a violation.
- **EU Form of Attestation of Activities**
  (`AttestationFormDialog.svelte`, Commission Decision 2009/959/EU, fields
  1–22): editable undertaking heading (street/city/country), driver
  heading, the "for period" range, a reason selection, an incomplete-
  record notice, the official regulation/instruction/warning/annex
  footnotes, a signature block, and the same print/save-HTML/save-PDF
  actions. Every editable field except fax and e-mail (boxes 4 and 5, labelled
  "optional") is required: required inputs carry `aria-required`, print and
  export stay disabled until they are filled in, and the notice above the form
  lists each missing field by its label (`missingAttestationFormFields`).

The attestation's on-screen form sheet is `AttestationSheetPreview`, rendered
from the same merged export model that print and export use. The Compliance
screen composes `ComplianceSummaryKpis` (severity KPI cards) and
`ComplianceAssessmentsPanel` (external-evidence items). Both dialogs are built
from the same compliance components:
`ComplianceDocumentDialog` (dialog frame, subtitle, error, print/save actions
and their busy status), `ComplianceEditPanel` (titled edit section with an
optional hint), and `ComplianceEditField` (labelled input or text area with
save-on-blur, `aria-required`, and an optional "(optional)" marker); export
file names come from `suggestedDocumentFileName`. Both dialogs use
`feature/helpers/company-settings.ts` for the editable
company metadata (no fabricated defaults) and `print-helper.ts` for
print/export, rendering to vector PDF via
`src-tauri/src/pdf_engine/{attestation,infringement,report}.rs` with
locale-aware hyphenation. Every label in the exported HTML and PDF comes from
the translated label sets the dialogs build (`IInfringementLetterExportLabels`,
`IAttestationFormExportLabels`, all fields required); there is no built-in
English fallback, and the exported HTML declares the active display locale as
its `lang`. The native PDF engine prints no text of its own: signature-block
phrases ("I, the undersigned", date, signature, driver's signature) arrive as
translated request fields, and a letter without a company name leaves the
heading empty rather than inventing one. Company details are remembered through the viewer's
`IKeyValueStore`.

The regulatory correctness of this engine is an engineering self-review
baseline; independent qualified regulatory review and a validation corpus
have not been done — treat evaluator output as engineering-verified, not
legally certified.

## 7. Application composition and public contracts

### Public entry ownership

Viewer owns reusable capabilities, generic UI/shell, localization, contracts,
and platform adapters under `src/`; `apps/viewer` is the application composition
root, not a module API. Cross-module imports use the reviewed entries listed by
`sourceModules` in `dependency-cruiser.config.mjs` and exposed through root
`package.json` aliases: module `index.ts` entries and explicitly reviewed
exceptions such as the parser `client.ts` and localization
`application-catalogue.ts`. An alias does not make private sibling files public.
New cross-module APIs require an owning public export and boundary review,
not a deep import or a boundary-bypassing alias.

Shared modules never import application composition, assets, or configuration.
Cross-capability bridges stay at the composition root through narrow typed ports.
The generic shell describes presentation contributions, not service discovery or
business contexts. The application wires services manually.

`renderer.config.ts` owns the Viewer-aware build preset. Its helpers under
`tools/` remain application-independent and accept explicit paths/options;
they do not import `apps/` or `src/` or embed application matching rules.
Test configurations use the `createVitestConfig` factory from `vitest.config.ts`.
Duplication scan paths resolve relative to `jscpd.json`, and `--fail-on-empty`
prevents a misconfigured scan from passing with no files.

### Renderer build policy

`renderer.config.ts` is the public renderer preset entry, exporting
`createViewerRendererConfig(IViewerRendererConfigOptions): UserConfig` and
`viewerCodeSplittingGroups`. The app's Vite configuration is a thin caller,
supplying the renderer root, output directory, Svelte config, package manifest,
and startup HTML. Optional `extensions` append plugins without replacing shared
plugins; `lazyModules` adds named, stateless module-path patterns. Viewer
contributes the chart-runtime rule.

The preset retains the existing `es2022` renderer target, external binary assets,
disabled source maps, startup placeholder, `App.svelte` warmup, and locale/chart/
Viewer/initial-vendor chunk groups and budgets. Startup HTML must contain exactly
one placeholder and replacement content is inserted literally. Startup branding
is supplied as rendered HTML, not imported by generic tooling.

Before deduplicating Svelte and the shared runtime dependencies, the preset reads
and decodes supplied manifests from unknown JSON, requires compatible exact
runtime versions and the shared Svelte development runtime, and rejects differing
versions of overlapping development dependencies. Non-overlapping development
dependencies need not match. The production bundle policy requires
exactly one installed copy of every shared runtime and rejects empty scan coverage.
Its chunk-graph checks cover all entry points: each matching lazy module must exist,
be dynamically reachable, and be absent from the entry static-import closure.
Duplicate chunk names, unresolved imports, and stateful patterns fail explicitly.

The public, application-independent tooling entries are:

- `tools/build/renderer-config.ts`: `IRendererConfigOptions`,
  `IRendererBuildPolicy`, `replaceHtmlPlaceholder`, and `createRendererConfig`.
- `tools/build/bundle-policy.ts`: `IBundleChunk`, `ILazyModuleRule`,
  `bundledPackageRoots`, `requireSingleRuntimeCopies`, `requireLazyModuleChunks`,
  and `runtimeBundlePolicy`.
- `tools/dependencies/package-manifest.ts`: `IPackageManifest`,
  `decodePackageManifest`, `readPackageManifest`, and `sharedRuntimeDependencies`.
- `tools/quality/tauri-configuration.ts`: `ITauriConfiguration` and
  `decodeTauriConfiguration`, separating product identity from effective window/
  production/development CSP policy for configuration checks.

Generic tools contain no application imports, project paths, aliases, translation
keys, or application-specific capability matching. Native policy decoding requires
one explicitly configured window with positive dimensions, disabled automatic creation/devtools,
and a non-empty CSP without duplicate directives or unsafe evaluation. CSP
comparison normalizes whitespace and directive/source ordering. An absent/null
development CSP inherits production policy. Duplication scanning uses
`--fail-on-empty` so a misconfigured scan cannot pass with no files.

### Native registration and contract tests

`esm_viewer_desktop_lib::with_viewer_commands!` is the single public native command
inventory. It accepts a macro path followed by zero or more additional command
paths, with an optional trailing comma. The launcher registers it without additions:

```rust
.invoke_handler(esm_viewer_desktop_lib::with_viewer_commands!(
    tauri::generate_handler,
))
```

There is one invoke handler; chaining multiple `invoke_handler` calls would
replace the earlier handler. The inventory includes parsing,
nation/extension catalogues, runtime metadata, card/VU verification, guarded file
reads, devtools, native window actions, PDF, printing, and error/debug logging.
`execute_window_command` accepts only `application.quit` and `view.fullscreen`,
returns JSON `null` on success, and rejects unknown actions or window-operation
failures. Quit requests the host application's normal exit lifecycle; fullscreen
targets only the invoking window. Renderer responses are validated from `unknown`
and failures are reported through `IErrorService` as
`desktop.native-window-command-failed`. Embedded hosts inherit the command through
the shared inventory without adding renderer permissions or runtime dependencies.
Existing command names, camelCase arguments, response DTOs, and raw binary IPC
bodies are unchanged. Shared command
functions and their immediate AppHandle/WebviewWindow helpers are generic over
`R: tauri::Runtime`; production Wry callers infer the runtime as before.

`get_runtime_versions` takes the application version from
`AppHandle.package_info()`, not Viewer's crate/config version. Parser version and
commit come from this library's own nested `vendor/esm-parser` checkout at build
time. `setup_desktop_window` owns window creation, navigation restrictions, and
new-window rejection; `setup_macos_dock_icon` attaches the development macOS dock
icon. Devtools require both a debug-assertions build and the explicit `devtools`
feature: window setup forces them off otherwise, even if the window config
requests them, and the registered `open_devtools` command is then a no-op.
Initialization installs only dialog/filesystem plugins. The default `standalone`
Cargo feature includes `run` and the application binary; disabling it excludes both.

The opt-in `test-support` Cargo feature enables `tauri/test` and exposes only
`esm_viewer_desktop_lib::test_support`:

- `mock_context(Config, PackageInfo) -> Context<tauri::test::MockRuntime>` uses
  caller-supplied product identity and metadata, empty assets, no plugins, and no
  production capabilities.
- `invoke(&WebviewWindow<MockRuntime>, &str, InvokeBody, Duration) ->
  Result<InvokeResponseBody, IpcError>` sends a real Tauri invoke request and bounds
  asynchronous response waiting. `IpcError::Command(serde_json::Value)` preserves
  command rejection; `Response(RecvTimeoutError)` and `Window(tauri::Error)` expose
  transport failures. A timeout neither cancels native work nor bounds blocking
  synchronous command execution.

This module is absent from ordinary runtime builds; Viewer's own unit tests use
the same implementation through `cfg(test)`. It wraps Tauri 2.11.6's official
MockRuntime/context and real `Webview::on_message` dispatch path, equivalent to
`tauri::test::get_ipc_response` but with a bounded asynchronous wait. Tauri's test
API is upstream-unstable. It proves registration, arguments, DTOs, and binary IPC,
not production ACL permissions, native print panels, or visual devtools behavior.
MockRuntime's devtools methods are no-ops.

Native command contract and Viewer-owned navigation test files live under
`src-tauri/tests/native/`, not in production `src/`. The library includes them only
through `cfg(test)` module paths, retaining default test execution without requiring
the optional `test-support` feature. `command_contract_tests` is
separate from navigation tests. It covers
the generated shared-only and combined handlers, an explicitly added test-only
command, unknown-command rejection, synthetic raw parsing failures, argument
validation, guarded raw file reads, raw PDF output, sanitized logging at the
configured log location, package/version overrides, exact nested parser metadata, and
response timeouts. Default and devtools tests run without a graphical display;
release/native checks cover the feature/profile gate.

### Shell composition and lifecycle

`ApplicationShell` renders a keyed list of explicitly composed modules, a shared
status bar, one global dialog adapter, module overlays and exactly one toast
container. The app composes one Viewer module. Switching workspaces preserves
document/UI state. Modules provide bound workspace snippets, guide/preference
sections, command-palette destinations and commands. Duplicate IDs within a
contribution surface, duplicate workspace IDs,
or an active workspace absent from the composition are configuration errors,
isolated by the shell error boundary.

`IApplicationModule.workspace` receives `(visible, moduleId)` as a typed
`Snippet<[boolean, TWorkspaceId]>`. Existing one-argument workspace snippets remain
compatible, including the app's Viewer composition. Optional module-owned `status`
snippets receive their module ID and render in catalogue order in the existing
footer. The legacy global `ApplicationShell.status` snippet is optional and,
when supplied, renders once before module statuses. The composition owns whether an
individual status should display for the active workspace. Toolbar ownership
stays within each workspace, using the existing shared command-bar components.
Keyed workspaces remain mounted while hidden; module overlays, global dialogs,
and the sole toast owner stay outside workspace visibility. Shell tests cover
a third module, real local-state and mount retention, legacy snippet compatibility,
status order, invalid composition reporting, and application-only disposal.

Viewer supplies the settings/About/guide/palette adapter through
`ViewerApplicationDialogs`, independently of `ViewerRoot`. It owns global dialog
shortcuts and command synchronization. Embedded Viewer roots own only their
document workspace and local export/history dialogs. Palette document navigation activates the Viewer module
and delegates to its section handler, retaining document-session reset behavior.

Generic guide and preference contribution contracts live in `#shell`; the
Viewer public aliases bind their placement IDs to Viewer categories. Preference
contributions report whether persistence succeeded; pending operations block
Apply, and cancellation resets contribution drafts. Contribution tab IDs are
namespaced. Preference callbacks run after a successful Viewer
settings save or on cancellation. The persisted preference format is unchanged.
The shell composition owns service teardown outside the error boundary; embedded
workspace and global-dialog unmounts do not dispose shared controllers. Retrying
a render failure therefore reuses live services. Direct standalone Viewer roots
dispose their owned context when unmounted.

The shared `CommandBar` supports module selection: when supplied with
`modules`, `activeWorkspace`, and `onchangeworkspace`, it automatically mounts
`WorkspaceSwitcher` and partition divider alongside brand and action slots.
`ViewerCommandBar` forwards these props directly to `CommandBar`, avoiding
duplicate switcher components or divider CSS. Empty state presentations for tables
are unified via the generic `EmptyState` component (`#ui/EmptyState.svelte`).
Native file selection is consolidated in `TauriPlatformService.selectTachographPaths`,
which provides typed single- and multiple-file tachograph dialogs with directory memory
and validation.
Startup splash branding and HTML are generated through `renderStartupSplash` and
`IAppModel` in `#shell`, injected by a minimal Vite `transformIndexHtml` plugin in
`apps/viewer`. In-app brand marks (command bar, welcome screen, About dialog)
resolve through the typed `provideAppBranding`/`useAppBranding`
context in `#shell`: the packaged `appIcon` is the default, and application
composition can override it once at its root without forking shared components.
`ViewerCommandBar` adds the Viewer Open/Export actions. Module commands reference
the same command catalogue used by toolbar actions and are included in the
palette only when enabled. Native menu items consume typed command descriptors
through `createNativeMenuItems`; platform-specific menu
structure remains in the Tauri adapter. When the locale changes at runtime,
`createApplicationMenu` reconstructs the native window or application menu
with freshly localized submenus and predefined items, re-attaches it via
Tauri's `setAsWindowMenu` (Windows/Linux) or `setAsAppMenu` (macOS), closes the
previous menu resource, and synchronizes active command states. Existing
File/Edit/View/Help ordering is unchanged. `ViewerRoot` accepts additional
Welcome and no-document failure actions.
The foundation stylesheet provides the shared handbook card layout so contributed
guide content retains the same appearance without copying dialog styles.
Guide contributions can specify a typed `beforeTab` position. Preference
contributions can specify a typed `targetTab` to extend an existing category
without adding a tab; contributed controls inherit the dialog's saving-disabled state.
Built-in fields and contributed controls share one non-growing vertical container
in each preferences tab, keeping all rows at their natural height even when the
dialog has spare vertical space.

### Adding a capability or workspace

1. Confirm ownership and search existing public exports before creating a new
   abstraction. Capability behavior belongs in its owning `src/` module.
   Keep domain/application logic inward-facing, parser normalization outside
   Svelte, and native adapters
   outside business code. A new capability uses the existing layered structure,
   not a child package or plugin framework.
2. Expose only the required typed API through its reviewed public entry and
   register its boundary when needed. Compose ports/controllers at the
   application root; never supply a generic untyped service context or downcast
   an adapter. Generic widgets and tokens remain in `src/ui`; capability
   components render view models and translated copy.
3. A top-level workspace contributes an `IApplicationModule` with a stable
   unique ID, translated label, icon, and workspace snippet. Add it to the
   application's explicit module list and derive workspace items from that
   same list for every toolbar. The snippet receives visibility and its ID;
   it owns hiding its mounted workspace. Add status, overlays, guide,
   preferences, commands, and palette destinations only where needed.
   Adapter/bridge selection stays at the composition root, not in business code.
4. Keep shared dialogs and the single toast owner at shell level. The application
   disposer cancels owned work and timers and releases services only on app
   teardown; switching workspaces and retrying a recoverable render error do
   not dispose them. Optional status snippets retain caller-owned visibility
   decisions and render in catalogue order.
5. Cover public behavior at the lowest useful layer, including contribution
   uniqueness, third-workspace reachability, mounted state, errors/retries,
   teardown, localization, accessibility, and lazy loading where applicable.
   Validate the Viewer app and update this current
   implementation reference when contracts or behavior change.

## 8. Charts & mapping

Interval/time-series charts (Activities timeline, calendar heatmap,
and Detailed Speed chart) are built on
a lazy-loaded, pinned ECharts adapter behind a generic interval/time-series
interface, living in `src/ui/charts`. `TimeSeriesChart` accepts structurally
compatible presentation models; the generic chart library has no capability
dependency.
The shared chart host keeps a 40rem minimum chart width where the container
allows it and otherwise shrinks the chart to its container, so charts fit
inside the 640 px minimum window instead of overflowing it.
The interval timeline contract also takes `ranges`: shaded spans drawn by one
extra, silent custom series behind the lanes (appended last, so lane series keep
their indices), without registering the ECharts mark-area component.
`ChartLegend` lists colour swatches and, for markers drawn as icons, icon
entries (`IChartLegendIconItem`).
GNSS/route mapping is an embedded vector/GeoJSON canvas (`src/ui/map`) with
zero external HTTP tile egress — shift starts, 3-hour GNSS positions,
border crossings, and load/unload operations. On both the Speed and Places
screens, selection is bidirectional between the chart/map and the adjoining
data table: clicking a table row highlights the corresponding chart point
or map waypoint, and clicking a chart point or waypoint calls the same
`onselectrecord` callback the table uses, so either input drives one shared
"selected record" per screen. Map waypoints are keyboard-focusable and show
the shared token-based focus treatment independently of their selected state.

## 9. UI/UX design system

**Navigation shell** (`src/ui/layout/AppShell.svelte`): a header region, a
command-bar region, the document header/navigator/status regions, the
active screen's content, and an optional inspector side panel that a user
can drag-resize (bounds read live from the `--size-inspector-min`/`-max`
CSS custom properties, so a theme can change the allowed range without a
script change). The resize control exposes slider value semantics and supports
Arrow keys plus Home/End; its adjacent menu provides Narrow, Default, and Wide
presets. That preset menu and the table column menu share the `DisclosureMenu`
primitive (Escape and outside-press dismissal; the column menu uses viewport
placement so a clipped table shell cannot hide it). The shell delegates the document-navigation landmark to
`DocumentNavigator` rather than nesting navigation landmarks, and the desktop
composition leaves each workspace responsible for its single main landmark.
At narrow effective window widths, the command and status bars become
content-sized, command-bar actions keep their icons and drop their text labels
(each action keeps its accessible name and tooltip with downward placement
so bubbles remain clear of the native window menu) so the bar never needs
horizontal scrolling, Viewer navigation move behind a standard menu
button that opens a modal drawer, and an open record inspector becomes a bounded
panel below the screen instead of squeezing the evidence column. Closing the drawer
or choosing a destination restores focus to the menu trigger. Wide tables
retain their own horizontal scrolling rather than forcing the whole application
shell to scroll. In side-panel mode the inspector track uses its selected width
directly on the inspector element, clamped only to the documented minimum and
maximum; the grid's automatic final track follows that live element width, and
the evidence column takes the remaining space. Pointer, keyboard, and Narrow /
Default / Wide width changes therefore remain visually effective instead of
being frozen by an inherited layout token.
`DocumentNavigator` groups the document's sections into
three fixed groups — (Overview, Compliance, Comparison), (Activities,
Associations, Places, Events & Faults), (Technical, Speed, Integrity, Raw
Data) — filtered down to whichever sections the open document kind actually
supports, with "last click wins" semantics so rapid section-switching
always lands on the most recently clicked section rather than racing.
`DocumentHeader` shows the document's display name plus kind and generation
badges and a live integrity-status badge.

**Theming & density**: `TauriPreferencesTarget` (in the renderer entry)
applies the Preferences dialog's choices by setting `data-theme` and
`data-density` attributes directly on `<html>`, plus `lang` for locale.
`theme: 'system'` additionally subscribes to the OS's
`prefers-color-scheme` media query and updates `data-theme` live on change.
It also synchronizes explicit light/dark choices to Tauri's native window
theme, and restores native system theming for `theme: 'system'`. This keeps
the GTK File/Edit/View menu's foreground and background colors as one native
palette rather than imposing a renderer-derived window background. A native
theme synchronization failure is reported as a desktop warning without
preventing the renderer preference from applying.
`src/ui/styles/tokens.css` branches its custom-property values on
`[data-theme='light'|'dark']` and `[data-density='compact'|'comfortable']`
selectors; the only corresponding native state is the desktop theme setting.

**Shared data-table primitive**: the same filter/clear-filter/column-picker/
result-count control set is reused, not reimplemented, across nearly every
records screen — Activities, Places, Associations, Events & Faults,
Technical, Integrity, Speed, and Comparison all use it.

**Toasts** (`src/ui/toast`): a shared toast controller/container gives
transient success/failure feedback for actions like PDF export and print,
used from the Compliance and Comparison screens.

**Keyboard shortcuts**: the six global accelerators listed in §5.2 (open,
export, close, command palette, preferences, user guide) are the app's only
global keybindings; screen-local keyboard support beyond that includes
calendar-grid arrow-key navigation on the Activities Calendar view and
documented keyboard help on the Activity Timeline and Speed chart. The command
palette uses the native modal-dialog contract, contains keyboard focus while
open, closes through the platform cancel event, and restores focus to its
invoking control. Its destination list includes the available sections of the
open Viewer document. Additional destinations use typed module contributions.

**Accessibility**: WCAG 2.2 AA is the target, automated via `axe-core`
against every screen in jsdom
(`src/viewer/feature/__tests__/axe-check.ts`). Canvas-rendered charts
(Activity Timeline, Speed chart) carry explicit ARIA `role` and
`aria-roledescription`/description text, since axe cannot inspect canvas
content directly. Rules `axe-core` cannot evaluate under jsdom — rendered
color-contrast, layout-dependent target size, and viewport-zoom metadata —
are excluded from the automated run and are covered by manual and visual
review instead, not skipped outright. Screen changes move focus to the shared
level-one screen heading, including Compliance, so keyboard and screen-reader
users receive the new section context. `src/ui/styles/tokens.css` also
defines a `@media (forced-colors: active)` block, so Windows High Contrast
Mode gets its own token overrides rather than relying on the default theme
colors remaining legible under forced colors. The operating-system
`prefers-reduced-motion` preference removes both nonessential infinite
animations: drop feedback remains visibly highlighted without pulsing, and
the navigator's `aria-busy` loading indicator remains visible without
spinning.

**Privacy by construction**: file identity carried through the app is
limited to a display name, byte length, and a SHA-256 content hash
(`src/contracts/file-metadata.ts`) — no full local file-system path is ever
part of that type, so it can't leak into a screen, export, or diagnostics
payload. The About dialog's copy-diagnostics action is built from exactly
four fields — application version, platform/architecture, runtime version,
and the pinned parser version/commit — never anything from the open
document.

## 10. Cross-cutting infrastructure

- **Error reporting** (`src/error-reporting`): a central typed
  `ErrorService` with pluggable `IErrorProvider`s and bounded retention,
  used from translation lookup, application use cases, IPC, and Svelte
  boundary handlers so no feature logs ad hoc or leaks personal tachograph
  data directly.
- **Icon registry** (`src/ui/icon`): pinned `@lucide/svelte` icons behind
  one shared, closed registry — no ad hoc SVGs, no emoji, no per-feature
  icon imports.
- **Localization** (`src/localization` + per-feature `feature/i18n/`):
  seven packaged locales (English, German, French, Italian, Polish, Spanish,
  Croatian) kept at 100% key parity against English, checked by
  `pnpm i18n:check`. Legal terms in every locale follow the official
  EU-language text of the instrument they cite (Regulation 561/2006,
  Directive 2002/15/EC, Regulation 165/2014, Regulation 2016/403). The
  severity labels use the official Annex I wording (serious, very serious,
  most serious); "Minor" is the viewer's own label for findings below the
  serious bands. Croatian and German were reviewed against those texts;
  French, Italian, Spanish and Polish follow the same official terms but
  have not been reviewed by a native speaker.

## 11. Testing & quality gates

- `pnpm test` — Vitest (unit/component) + `cargo test` (Rust)
- `pnpm check` — `tsc --noEmit` (node/renderer/tests projects) + `svelte-check`
  + `pnpm check:rust`
- `pnpm check:rust` — `cargo check` + `cargo clippy -D warnings`
- `pnpm lint` — test-layout check, design-values scanner, ESLint
  (`--max-warnings 0`)
- `pnpm architecture` — `dependency-cruiser` boundary audit + lockfile check
- `pnpm duplication` — `jscpd` clone detection (TypeScript, Svelte, CSS and the Rust host)
- `pnpm i18n:check` — packaged-locale catalogue parity (en/de/fr/it/pl/es/hr)
- `pnpm format:check` — Prettier formatting without modifying files
- `pnpm build` — standalone production renderer, including runtime-singleton
  and lazy-chart bundle enforcement
- `pnpm quality` — the complete ordered standalone gate

`.github/workflows/validation.yml` runs on pull requests and pushes to `master`.
It checks out only this repository with recursive pinned submodules, installs
the frozen frontend graph and native prerequisites, and runs all eight quality
gates. It then builds a debug native binary with
`devtools`, builds a packaged-mode release binary without that feature using
`pnpm exec tauri build --no-bundle`, and audits frontend dependencies at high
severity. The release step disables the already-completed renderer build hook
with a build-only configuration override; it embeds those production assets
instead of rebuilding them. The Tauri CLI enables the production transport
(`tauri/custom-protocol`). Bare `cargo build --release` without that feature
still selects the development transport and its loopback `devUrl`, which CI
builds with production transport and embedded assets.
These build checks do not prove graphical devtools behavior; the headless
native command contracts described above
verify dispatch independently of a display. Standalone packaging remains in
`.github/workflows/release.yml`.

## 12. Known limitations

- An opened file crosses the IPC twice as raw bytes (read, then parse; §4). This is accepted for files up to 50 MB. Parsing path-opened files natively could avoid that transfer.
- The compliance rules engine has an engineering self-review baseline only
  (§6) — no independent regulatory/legal validation yet.
- Multi-manning (§6) is decided from the evaluated driver card alone: two
  inserted cards are evidence of a second driver, not proof of one, and the card
  cannot say who the co-driver was or whether the vehicle was moving during a
  manually entered rest. The Compliance screen notice and the User Guide say
  so.
- Unrecorded time is evaluated as rest (§6), the most favourable reading the
  records allow. Findings that remain hold under any reading, but a breach that
  would exist only if the driver worked during unrecorded time is not reported;
  the Art. 34(3) review item on that period is the only signal. Count-based
  rules shift the same way: a 9–11 hour rest that includes unrecorded time
  counts as a reduced daily rest where a stricter reading would report
  insufficient rest, and a day-long unrecorded period ends the reduction count as
  a weekly rest. Periods under 15 minutes, periods still open when the records
  end, and every period under the AETR and GB domestic profiles produce no
  review item.
- The Annex I Most Serious Infringement (MSI) band for the daily driving
  limit (§6) is calibrated to the standard nine-hour limit, not to whichever
  of the two permitted daily limits actually applied that day. Annex I's own
  MSI cutoff is defined relative to "no break or rest of at least 45 minutes
  ... or no reduced weekly rest period" rather than a fixed margin, and its
  threshold shifts higher when the extended ten-hour limit legitimately
  applies. This app's fixed margin is therefore slightly conservative
  (over-flagging MSI) on days using the extended limit; it does not track
  the "no break taken" condition.
- Fortnightly weekly rest evaluation (§6) operates strictly on full calendar
  weeks bounded within the document coverage range (`fullWeeksWithinDocument`);
  partial calendar weeks at document start or end are excluded from the two-week
  quota evaluation.

- The parser's decoder/format coverage should be re-verified against the
  current `vendor/esm-parser` pin rather than assumed stable across
  parser upgrades.
- Vehicle Unit downloads support full verification (certificate chain and
  recorded data files via `esm-parser` 0.4.0, §5.1); files lacking data records
  fall back to certificate-chain-only verification. Gen2 Company/Control card
  applications are unsigned by design and always report `unsupported`.
- Release installers (§3) are built but not code-signed or notarized on any
  platform yet.

## 13. Deliberate design decisions

The behaviours below are intentional. Each was decided with its trade-off in
view, so a review should not report it as a defect; changing one is a product
decision, and this list must be updated with it.

- **Unrestricted file-system capability.** The webview's `fs` read, write,
  rename, and remove permissions are granted on `**`. Tachograph files are
  opened from USB sticks, network drives, and any folder the user picks, and
  exports are written atomically next to their chosen destination, so path
  scoping would break real use. Tachograph reads still go through the native
  reader's canonical-path, regular-file, extension, and 50 MB checks (§4).
- **Detailed local diagnostic logs.** `app.log` holds sanitized, typed events
  only, while `native-debug.log` keeps raw error detail (messages, stacks,
  paths) in release builds too, so a reported problem can be diagnosed. Both
  stay on the user's computer; nothing is uploaded, and logs leave the device
  only when the user chooses to send them, at which point their contents are
  reviewed and redacted by whoever receives them.

- **Night-work window is configured, not fixed.** Directive 2002/15/EC leaves
  night time to national law within at least four hours between 00:00 and
  07:00; the app enforces that range and uses the configured local window and
  time zone. The default 00:00–04:00 UTC is a starting value, not an EU-wide
  rule, and national derogations under Art. 8 are not modelled (§6).
- **Standard break rule only.** Break evaluation applies the Art. 7 45-minute
  or 15 + 30 rule of the standard profile; a late split completion ends the
  stint. The special break arrangements the consolidated Regulation allows for
  some occasional passenger services are not evaluated (§6).
- **Multi-manning follows the literal text.** A nine-to-eleven-hour crew rest
  counts as a reduced daily rest (Article 8(4) is not derogated, as DVSA and
  GOV.UK guidance say), although some commercial tools treat reduced rest as
  single-manning only. Only driving is tested for Article 4(o), and the first
  hour is measured from the start of the duty period, the stricter of the two
  common readings (§6).
- **Unrecorded time is an evidence gap, not missing rest.** Card-out time without
  a manual entry and days without records are evaluated as rest, and each period
  is listed as an Art. 34(3) review item instead of a rest infringement the
  records cannot prove. Regulation (EU) No 165/2014 Art. 34(3) makes the missing
  manual entry the documented failure, and the Commission's Guidance Note 5
  treats the records, manual entries included, as the primary evidence of rest
  (§6, §12).
- **Annex I boundaries differ by direction.** Excess bands include their lower
  bound and rest-deficit bands exclude it, exactly as Annex I of Regulation
  (EU) 2016/403 words them, so exactly 8 hours of reduced daily rest is minor
  while 7h59 is serious (§6).
- **Download deadlines count recorded-activity days.** Per Regulation (EU)
  581/2010 the 28th or 90th counted day is still due today and the next one is
  overdue. Without activity evidence through today, the tracker uses a
  conservative calendar estimate measured from the download instant (not
  rounded to the day), because it measures an elapsed period from a recorded
  timestamp; calibration and licence dates, which are calendar dates, are
  compared by day (§7).
- **The audit bundle must match its report exactly.** The export is checked
  against the manifest the embedded report was built from; any change in
  between rejects with an "archive changed, try again" failure instead of
  producing a bundle that disagrees with its report. Verification is a stored
  hash match, not a signature re-verification (§7).
- **Accepted IPC and memory costs.** Large binaries travel as raw IPC bytes, but
  three small bounded fields (the verification-report PDF, the ERCA root key,
  and vehicle-unit certificates) stay JSON number arrays; an opened file crosses
  the IPC twice; and an audit bundle is assembled in memory before saving
  (§4, §7, §12).
- **Type-guaranteed helpers are not runtime-guarded.** `countBy` requires a
  zero count for every key through its type and does not re-check keys at
  runtime; callers pass complete key sets.
