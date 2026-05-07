# TRMNL Liquid — VSCode Extension

A VSCode extension for authoring TRMNL plugin templates (`.liquid` files rendered to ePaper displays).

## Goal

Make local authoring of TRMNL Liquid templates faster and safer than round-tripping through the web editor at usetrmnl.com. Two pillars:

1. **Live preview** (current focus) — webview that renders the current `.liquid` file at the correct screen size, bit depth, and orientation, with mock data injected from a sibling `sample.json`.
2. **Authoring assist** (deferred) — snippets, IntelliSense, and hover docs for TRMNL framework classes/components.

## Target devices (render matrix)

Three TRMNL devices and combinations of size + orientation + mashup slot:

- **TRMNL OG** — 800×480, 1-bit (`screen--og` + `screen--1bit`)
- **TRMNL OG V2** — 800×480, 2-bit grayscale (`screen--ogv2` + `screen--2bit`)
- **TRMNL X / V2** — 1040×780, 4-bit grayscale (`screen--v2` + `screen--4bit`)

Layouts per file: `full`, `half_horizontal`, `half_vertical`, `quadrant`. Combined with bit depth and orientation there are ~10 meaningful preview targets.

## Mock data convention

`.liquid` files are rendered against context loaded in this priority order:

1. **Live data from `trmnl.yml`** — if a sibling `trmnl.yml` exists with `polling_url:`, the extension auto-fetches on preview open and stores the response in memory. The toolbar shows a ↻ Refresh button to re-fetch. `sample.json` is never written to.
2. `sample.json` — JSON object becomes the Liquid context (offline fallback)
3. `sample.yml` — YAML alternative

If none exist, the file renders with `{}` and a warning banner appears.

`trmnl.yml` shape:
```yaml
polling_url: https://api.example.com/data
method: GET             # optional
headers:                # optional
  X-API-Key: secret
```
Recommend gitignoring `trmnl.yml` when it carries secrets.

**Note:** `custom_fields.yml` in TRMNL plugin terminology is the *plugin config schema* (API key, author bio, dropdown options) — **not** the runtime render data. The runtime data comes from the polling URL response. The two vendored samples include both files: `custom_fields.yml` (for reference / parity with the upstream plugin) and `sample.json` (for preview rendering).

## Reference material

- `docs/trmnl_x_guide.md` — what changed in framework 3.1 for TRMNL X (`--base` modifier, new typography sizes, container query units, responsive overflow, clamp, etc.)
- `docs/v3_enhancement_guide.md` — chromatic colors, semantic label variants, framework v3 baseline
- Full docs live at https://trmnl.com/framework/docs/3.1/ — the site blocks default curl; pass a Firefox UA. Append `.md` to any docs URL to get the markdown source directly. Example:

  ```
  curl -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:128.0) Gecko/20100101 Firefox/128.0" \
    https://trmnl.com/framework/docs/3.1/value.md
  ```

- Two example plugins under `samples/`:
  - `samples/image/` — random-image plugin with a sibling `trmnl.yml` pointing at `https://spandana.com/trmnl/json`. Smoke-tests the live polling/Refresh flow. F5 launches this by default.
  - `samples/gas_prices/` — AAA fuel price tracker, pure `sample.json` (no live fetch). Smoke-tests the offline path with `where` filters and responsive value sizing.

## Phase status

- **Phase 1 — Snippets + IntelliSense.** Deferred. The user prioritized preview over authoring assist.
- **Phase 2 — Webview preview.** ✅ Shipped. Toolbar UI for device / layout switching, sample.json mock data injection, vendored framework CSS, fit-to-pane scaling, mashup slot visualization for half/quadrant layouts.
- **Phase 3 — Refinements.** Open: 1-bit dithering pass for non-framework content, more sample plugins, pixel-perfect parity audit vs. real device output.

Deferred indefinitely: linting, formatter, schema validation for sample data.

## Stack

- TypeScript, VSCode Extension API
- LiquidJS for templating (closest to TRMNL's flavor of Shopify Liquid)
- js-yaml for `sample.yml` fallback
- Vendored `media/plugins.css` from `https://usetrmnl.com/css/latest/plugins.css`. Asset URLs inside it are rewritten from `usetrmnl.com` → `trmnl.com` to skip the 301 redirect that breaks webview CSP. If you re-vendor, re-run the rewrite.
- esbuild for bundling

## Preview gotchas (load-bearing — don't undo without understanding)

- **`--pixel-ratio` override.** The framework's `.trmnl .screen` rule applies `transform: scale(var(--pixel-ratio))` to the screen element. On TRMNL X (`--pixel-ratio: 1.8`) this visually upscales everything ~1.8× linearly. We override `--pixel-ratio: 1` on the preview's `.screen` so the device renders at native 1:1 in the pane. Three uses in the bundled CSS, all in the same rule (transform + matching margin reservations) — re-grep `var(--pixel-ratio)` if upgrading the framework.
- **Size-class breakpoints.** The framework expects `screen--sm/md/lg` to be applied based on screen width, but the platform adds them on-device. We add them ourselves (`buildScreenClasses` in `src/extension.ts`) cumulative-mobile-first so `md:` / `lg:` responsive prefixes resolve.
- **Bit-depth class.** Composed independently of device — OG → `screen--1bit`, OGv2 → `screen--2bit`, V2/X → `screen--4bit`. Required for `1bit:` / `4bit:` responsive variants in user templates to resolve.
- **Mashup padding.** The framework's `.screen` already provides `padding: var(--gap)`. Don't add another layer of padding on the mashup grid wrapper or you'll double-pad and clip slot content on the right/bottom.
- **CSS-only fit-to-pane.** Scaling uses `zoom: min(1, calc(100cqi / Wpx))` on the frame inside a `container-type: inline-size` stage div. JS only updates the readout label — viewport measurement in webviews was unreliable.
- **Font URLs.** The vendored CSS's font URLs must be rewritten to absolute `trmnl.com` paths (the upstream `usetrmnl.com/fonts/...` redirects, and webview CSP blocks the redirect target unless explicitly allowed). The CSP allows both hosts as belt-and-suspenders.

## Conventions for working in this repo

- Test against `samples/gas_prices/` before shipping any preview change. Spot-check both OG and V2 in all four layouts.
- Release process is documented in `README.md` → "Releasing a new version to the Marketplace". Marketplace publisher is `objectgraph-llc`; PAT is cached locally via `vsce login`.
- For UI changes, the harness can't run the extension dev host — say so explicitly and ask the user to F5 / reload.
- When adding device support, scope: TRMNL devices only (og, ogv2, v2). The framework CSS bundles dozens of e-reader variants (kindle, kobo, etc.) — those are out of scope.
