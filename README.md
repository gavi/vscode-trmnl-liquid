# TRMNL Liquid

A VSCode extension for authoring [TRMNL](https://usetrmnl.com) plugin templates locally — render `.liquid` files with mock data in a live webview at the right device dimensions, instead of round-tripping through the web editor.

## Features

- **Live preview** of any `.liquid` file in a webview beside the editor
- **Device switcher**: TRMNL OG (800×480, 1-bit), TRMNL OG V2 (800×480, 2-bit), TRMNL X / V2 (1040×780, 4-bit)
- **Layout switcher**: `full`, `half_horizontal`, `half_vertical`, `quadrant`. Auto-detected from filename, manually overridable.
- **Portrait toggle** for TRMNL X
- **Mashup slot visualization** — half/quadrant layouts show the rendered slot in context with empty-slot placeholders for the rest of the device
- **Auto-fit** — scales to fit the pane width, percentage shown in the toolbar
- **Auto-refresh** on save of the `.liquid` file or its sibling `sample.json`
- Liquid rendered via [LiquidJS](https://liquidjs.com/) (Shopify-flavored)

## Usage

1. Open a directory containing your `.liquid` files (`full.liquid`, `quadrant.liquid`, etc.).
2. Add a `sample.json` (or `sample.yml`) next to the layout files with mock render data — its keys become the top-level Liquid context.
3. Open one of the `.liquid` files and run **TRMNL: Open Preview** from the command palette (`Cmd+Shift+P`).
4. Use the toolbar at the top of the preview to switch device, layout, or portrait orientation.

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

## Commands

| Command | Description |
| --- | --- |
| `TRMNL: Open Preview` | Open the preview pane for the active `.liquid` file |
| `TRMNL: Set Preview Device` | Switch between OG / OG V2 / X (also available in toolbar) |
| `TRMNL: Set Preview Layout` | Override the layout auto-detected from filename |
| `TRMNL: Toggle Portrait Orientation` | Flip orientation (portrait class is applied) |

## Sample plugin

A real plugin is vendored under `samples/gas_prices/` as a reference implementation:

- AAA fuel price tracker — uses Liquid `where` filters to pick rows by fuel grade, demonstrates responsive value sizing (`value--xxxlarge lg:value--giga`), and ships all four layout files (`full`, `half_horizontal`, `half_vertical`, `quadrant`) plus a `sample.json` matching the upstream API shape.

Open the `samples/gas_prices/` folder in VSCode, open any `.liquid` file, and run **TRMNL: Open Preview** to see it render.

## Development

```sh
npm install
npm run build           # one-shot esbuild bundle
npm run watch           # rebuild on change
```

Press **F5** in VSCode (with this folder open) to launch the Extension Development Host pre-opened to `samples/gas_prices`.

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
