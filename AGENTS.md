# ESM Viewer Agent Instructions

Development contract for human contributors and AI coding agents.

## Mission and Source of Truth

Build a local-first Tauri 2.0 viewer for digital tachograph files (`.DDD`, `.tgd`, `.v1b`, `.c1b`) with Svelte 5 and TypeScript.
License: GNU GPL version 3 (`GPL-3.0-only`).

- `docs/implementation.md` is the single current-state source of truth for architecture, features, and UI/UX. Update it in the same change whenever behavior, contracts, boundaries, or workflows change.
- `docs/history/` holds historical plans and audits for provenance only; never reference it or treat it as current behavior.
- `AGENTS.md` enforces engineering rules; it does not restate product scope or UI detail.

## Architecture and Boundaries

Keep business logic decoupled from Tauri, Svelte, and the filesystem. Business capabilities live in `src/<capability>` with inward dependency direction:

```text
viewer/domain <- viewer/application <- viewer/presentation <- viewer/feature
viewer/application <- viewer/parser
contracts <- error-reporting <- localization
contracts <- platform/tauri <- apps/viewer composition
time <- viewer/domain, compliance/domain
ui <- feature <- apps/viewer composition
ui <- shell <- feature, apps/viewer composition
```

- `src/viewer`: Tachograph viewer capability (`domain`, `application`, `parser`, `presentation`, `feature`).
- `src/compliance`: Regulatory compliance evaluation capability.
- `src/contracts`: Typed IPC DTOs, `Result`, and cross-process boundary decoders (no parser shapes or runtime schema libraries).
- `src/time`: Pure UTC time arithmetic shared across capabilities. Zero external or capability dependencies.
- `src/error-reporting`: Application-wide typed error service contracts (`IErrorService`).
- `src/localization`: Locale selection, translations, and `Intl` formatting contracts.
- `src/ui`: Generic reusable Svelte UI; zero tachograph or domain knowledge.
- `src/shell`: Reusable application frame, command bar, workspace selection and typed module contributions. No capability, parser, Tauri or app dependencies.
- `src/platform/tauri`: Tauri desktop port implementations.
- `src-tauri`: Native Rust backend (commands, window lifecycle, dialogs, PDF, pinned `esm-parser` crate).
- `apps/viewer`: Standalone GPL Tauri renderer composition root.

Rules:
- Single root package (`package.json`, one lockfile). No child packages, DI frameworks, or service locators. Wire ports manually at composition.
- Import modules only through reviewed public entry points (`index.ts`, `client.ts` for parser, `application-catalogue.ts` for localization). Reject deep imports, circular dependencies, and boundary-bypassing aliases.
- `tools/` must remain application-independent: no imports of `apps` or `src`, no hardcoded project paths, aliases, or translation keys.

## Reuse-Before-Creation Contract

Before adding a function, class, type, decoder, controller, Svelte component, or style:
1. Search existing module public exports, nearby code, `src/ui`, and feature components.
2. Reuse existing implementations when contracts match; add a typed variant when the existing abstraction owns the behavior.
3. Extract shared pure functions, services, or components when identical behavior would otherwise repeat.
4. Create new abstractions only when responsibilities are genuinely distinct. No duplicate business logic or UI markup.

## TypeScript and Code Standards

- **Zero `any`**: Explicit or inferred.
- **Indentation**: 4 spaces everywhere. No tab characters.
- **Naming**:
  - Interfaces must be named with an uppercase `I` prefix (e.g. `IProps`, `IErrorService`).
  - Class members must declare explicit TypeScript accessibility (`public`, `protected`, `private`).
  - Private data members must be prefixed with `_` (or `#_` for ECMAScript private fields).
- **Type Safety**:
  - Use `unknown` at boundaries (I/O, IPC, JSON, storage, caught errors). Narrow with application-owned type guards or decoders before use.
  - Never use `as any`, `@ts-ignore`, untyped fallbacks, or unsafe type assertions.
  - Do not downcast a port to a concrete adapter.
  - Prefer discriminated unions and exhaustive switches over optional flags.
  - Keep domain collections read-only.
  - Strict compiler flags must remain enabled (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`).
  - ESLint disable directives and inline rule reconfiguration are forbidden in authored code.
- **Tests**: Located in `__tests__/*.test.ts` within the module or tool they verify. Never colocate test files beside production source.

## Svelte 5 Rules

- Configure runes mode globally.
- Type `$props()` with a named `IProps` interface or explicitly named type.
- Use `$state` for local presentation state and `$derived` for derivations.
- Use `$effect` strictly for synchronization with external systems, never for state derivation.
- Legacy Svelte 3/4 syntax is forbidden (`export let`, `$:`, `<slot>`, `createEventDispatcher`, `beforeUpdate`/`afterUpdate`, `svelte/store`).
- Components render view models and emit typed callback props; they do not normalize dates, calculate rules, or interpret signatures.
- Never render user or parser content through `{@html}`.
- Provide explicit loading, empty, partial, and error states.
- Wrap UI regions with `<svelte:boundary>` for error isolation.

## Reusable UI and Design Tokens

- Generic components belong in `src/ui`; tachograph-specific compositions belong in `src/<capability>/feature`.
- **Design Tokens**: All styling must consume design tokens from `foundation.css` and `tokens.css`. Hardcoded colors, spacing, dimensions, radii, shadows, z-indexes, or inline style magic numbers are forbidden.
- Support `system`, `light`, and `dark` themes, and `compact` and `comfortable` densities through tokens.
- User actions are defined once in the typed command catalogue. Native menus, command bars, and dialogs reference stable command IDs.
- Large tables, trees, timelines, and speed charts must be virtualized or bounded.
- WCAG 2.2 AA compliance: keyboard navigation, visible focus, 200% zoom, screen reader support, reduced-motion accommodation.

## Localization and Error Reporting

- **Localization**:
  - Three-service pattern: `ILocaleService` (selection/persistence), `ITranslationService` (exact-key lookup), `ILocalisationService` (`Intl` formatting).
  - English bundle (`#i18n`) is the authoritative source of truth (`TranslationKey = keyof typeof en`).
  - Zero hardcoded user-visible display copy in Svelte components; use `t()` or translated props.
  - Timestamps are stored and calculated in immutable UTC. Local timezone conversion is presentation-only.
  - Translation lookup must not throw on missing runtime keys; fallback gracefully and report typed errors.
- **Error Reporting**:
  - Route all unexpected errors through `IErrorService` (`src/error-reporting`). Never call logging providers directly from UI or business code.
  - Logging must never contain raw DDD bytes, decoded personal data, certificate material, full local paths, or raw stack traces.
  - User-facing error messages are translated separately from developer diagnostic error codes.

## Parser (`esm-parser`) and Native Desktop Security

- **Parser Integration**:
  - Pin the exact parser commit in `vendor/esm-parser`. Native Rust backend executes parsing and verification on the async thread pool, never in the renderer.
  - Run `pnpm parser:sync-types` after updating the submodule pin.
  - Normalizers in `src/viewer/parser` transform raw parser data into application domain models. Raw parser objects must never reach Svelte components.
  - Source references must use canonical RFC 6901 JSON pointers.
  - Decouple parse success from signature verification. Report parser version and commit in the About dialog.
- **Security and Privacy**:
  - DDD files contain untrusted binary data and personal identifiable information (PII).
  - Native Rust backend enforces a strict 50 MB file size limit and canonical path validation before reading/parsing.
  - Enforce restrictive CSP without `'unsafe-eval'`. Block unexpected webview navigation and window creation.
  - Validate and decode all Tauri `invoke` responses from `unknown`.
  - Never modify or overwrite source DDD files. Write exports atomically.
  - Strictly local-first: no telemetry, remote maps, crash upload, cloud sync, or network access.
  - Exclude development tools (`devtools`) from release builds.

## Dependencies and Platform Baseline

- Minimal runtime dependencies: only approved UI additions are `@lucide/svelte` (via central icon registry) and `echarts` (via generic adapter).
- Forbidden: Zod, runtime schema libraries, CSS frameworks, component libraries, routers, and external state managers.
- Use platform standards (`Intl`, `crypto.randomUUID`, semantic HTML, CSS) before considering a package.
- Any new runtime dependency requires an accepted ADR covering necessity, bundle cost, and GPL-3.0 compatibility.

## Testing and Quality Gate

- Test observable behavior at the lowest useful layer (pure unit tests for domain, decoders for contracts, fixtures for normalizers, jsdom for Svelte components).
- Do not use snapshots as proof of business behavior. Never commit real personal data.
- Run the required quality gate before handoff:
  ```text
  pnpm format:check
  pnpm lint
  pnpm i18n:check
  pnpm check
  pnpm test
  pnpm architecture
  pnpm duplication
  pnpm build
  ```

## Change Discipline and Definition of Done

- Keep changes strictly scoped to the user request.
- Agents work only in the working tree: never run `git commit`, `git tag`, `git push`, or trigger releases.
- Code comments must explain non-obvious "why", never restate the code, and never cite internal documentation (plan documents, ADRs, section numbers).
- Update `docs/implementation.md` in the same change whenever behavior, contracts, or public boundaries change.
- A task is done only when:
  - Behavior matches `docs/implementation.md`.
  - Type, lint, architecture, and duplication gates pass with zero `any`.
  - All relevant unit, component, and native tests pass.
  - Accessibility, privacy, error, and empty states are covered.
  - Documentation is kept current.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
