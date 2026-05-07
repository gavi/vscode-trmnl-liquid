# TRMNL Liquid

[![VS Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/objectgraph-llc.trmnl-liquid?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=objectgraph-llc.trmnl-liquid)
[![VS Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/objectgraph-llc.trmnl-liquid)](https://marketplace.visualstudio.com/items?itemName=objectgraph-llc.trmnl-liquid)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A VSCode extension for authoring [TRMNL](https://usetrmnl.com) plugin templates locally — render `.liquid` files with mock data in a live webview at the right device dimensions, instead of round-tripping through the web editor.

**Install:** open Extensions sidebar → search "TRMNL Liquid", or run `code --install-extension objectgraph-llc.trmnl-liquid`.

## Features

- **Live preview** of any `.liquid` file in a webview beside the editor
- **Device switcher**: TRMNL OG (800×480, 1-bit), TRMNL OG V2 (800×480, 2-bit), TRMNL X / V2 (1040×780, 4-bit)
- **Layout switcher**: `full`, `half_horizontal`, `half_vertical`, `quadrant`. Auto-detected from filename, manually overridable.
- **Mashup slot visualization** — half/quadrant layouts show the rendered slot in context with empty-slot placeholders for the rest of the device
- **Auto-fit** — scales to fit the pane width, percentage shown in the toolbar
- **Auto-refresh** on save of the `.liquid` file or its sibling `sample.json`
- **Live polling** — drop a `trmnl.yml` next to your templates with the polling URL, click ↻ Refresh in the toolbar to fetch real data into memory
- Liquid rendered via [LiquidJS](https://liquidjs.com/) (Shopify-flavored)

## Usage

1. Open a directory containing your `.liquid` files (`full.liquid`, `quadrant.liquid`, etc.).
2. Add a `sample.json` (or `sample.yml`) next to the layout files with mock render data — its keys become the top-level Liquid context.
3. Open one of the `.liquid` files and run **TRMNL: Open Preview** from the command palette (`Cmd+Shift+P`).
4. Use the toolbar at the top of the preview to switch device or layout.

### Mock data file (`sample.json`)

The framework renders against the JSON your polling URL returns at runtime. For local preview, put that same shape in `sample.json` next to your `.liquid` files. Example (from `samples/gas_prices/sample.json`):

```json
{
  "state": "NY",
  "fetched_at": 1762272000,
  "rows": [
    { "fuel": "unleaded", "state": 3.42, "national": 3.18, "diff": 0.24, "state_year_ago": 3.61, "national_year_ago": 3.30 },
    { "fuel": "midgrade", "state": 3.86, "national": 3.62, "diff": 0.24, "state_year_ago": 4.04, "national_year_ago": 3.74 },
    { "fuel": "premium",  "state": 4.21, "national": 3.97, "diff": 0.24, "state_year_ago": 4.39, "national_year_ago": 4.09 },
    { "fuel": "diesel",   "state": 3.74, "national": 3.69, "diff": 0.05, "state_year_ago": 3.95, "national_year_ago": 3.86 }
  ],
  "trmnl": {
    "plugin_settings": { "instance_name": "AAA Gas Prices" }
  }
}
```

The matching `full.liquid` consumes it like:

```liquid
{% assign reg = rows | where: "fuel", "unleaded" | first %}
<span class="value value--xxxlarge value--tnums">${{ reg.state }}</span>
<span class="label">Regular Unleaded — {{ state }}</span>
```

> **Heads up:** `custom_fields.yml` in TRMNL is the *plugin config schema* (asks the user for an API key, dropdown options, etc.) — it isn't the data your template renders against. That data comes from your polling URL.

### Live polling (`trmnl.yml`)

If your plugin polls a real URL and you'd rather render against live data than maintain a `sample.json`, drop a `trmnl.yml` next to the `.liquid` files:

```yaml
polling_url: https://api.example.com/data
method: GET             # optional, default GET
headers:                # optional
  X-API-Key: your-secret
```

When the preview opens, the extension fetches the URL and renders against the response **in memory** — `sample.json` is never written to and remains your offline fallback. A **↻ Refresh** button appears in the toolbar; clicking it re-fetches.

> If your URL or headers contain secrets, add `trmnl.yml` to `.gitignore`.

## Commands

| Command | Description |
| --- | --- |
| `TRMNL: Open Preview` | Open the preview pane for the active `.liquid` file |
| `TRMNL: Set Preview Device` | Switch between OG / OG V2 / X (also available in toolbar) |
| `TRMNL: Set Preview Layout` | Override the layout auto-detected from filename |

## Sample plugins

Two real plugins are vendored under `samples/` as reference implementations:

- `samples/image/` — random-image plugin with a `trmnl.yml` pointing at a live polling URL. Demonstrates the **Refresh** flow.
- `samples/gas_prices/` — AAA fuel price tracker. Uses Liquid `where` filters and responsive value sizing (`value--xxxlarge lg:value--giga`). Pure `sample.json`, no live fetch.

Each ships all four layout files (`full`, `half_horizontal`, `half_vertical`, `quadrant`). Open any of those folders in VSCode, open a `.liquid` file, and click the eye icon in the editor title to preview.

## Development

```sh
npm install
npm run build           # one-shot esbuild bundle
npm run watch           # rebuild on change
```

Press **F5** in VSCode (with this folder open) to launch the Extension Development Host pre-opened to `samples/image` (live polling demo). Edit `.vscode/launch.json` to switch to a different sample.

### Releasing a new version to the Marketplace

One-time setup (already done): `npx @vscode/vsce login objectgraph-llc` — paste the Azure DevOps PAT once; vsce caches it.

Each release:

```sh
# 1. Make code changes; test in dev host (F5).

# 2. Bump version (auto-commits and tags):
npm version patch       # 0.0.1 → 0.0.2 (bug fixes)
# npm version minor     # 0.0.x → 0.1.0 (new features)
# npm version major     # 0.x.x → 1.0.0 (breaking)

# 3. Build + publish to Marketplace:
npx @vscode/vsce publish

# 4. Mirror code + tag to GitHub:
git push && git push --tags
```

Listing updates at https://marketplace.visualstudio.com/items?itemName=objectgraph-llc.trmnl-liquid within ~5 minutes.

To ship to **Open VSX** (used by Cursor / VSCodium / Windsurf) too — first time, get a token at https://open-vsx.org/user-settings/tokens, then:

```sh
npx ovsx publish trmnl-liquid-<version>.vsix -p <open-vsx-token>
```

(You can omit Open VSX entirely; users on those editors can still sideload by downloading the `.vsix` from GitHub releases.)

### Re-vendoring framework CSS

`media/plugins.css` is fetched from `https://usetrmnl.com/css/latest/plugins.css`. Asset URLs (`url(/fonts/...)`, `url(/images/...)`) are rewritten in-place from `usetrmnl.com` → `trmnl.com` because the upstream paths 301-redirect and the webview CSP blocks the redirect target. If you re-vendor, re-run:

```sh
curl -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:128.0) Gecko/20100101 Firefox/128.0" \
  https://usetrmnl.com/css/latest/plugins.css -o media/plugins.css
sed -i '' \
  -e 's#url(/fonts/#url(https://trmnl.com/fonts/#g' \
  -e 's#url(/images/#url(https://trmnl.com/images/#g' \
  media/plugins.css
```

## Status

Phase 2 (live preview) is functional. Snippets / IntelliSense and pixel-perfect 1-bit dithering parity are not yet implemented.

## License

[MIT](LICENSE) © Gavi Narra
