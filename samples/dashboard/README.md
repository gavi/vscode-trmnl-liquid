# TRMNL templates

Liquid templates for the four TRMNL plugin layouts. They all consume the JSON
returned by `GET /trmnl`.

## Plugin setup

In TRMNL, create a Private Plugin → "Polling" strategy:

- Polling URL: `https://api.liu.edu/trmnl`
- Polling interval: 1 day (the source dashboard refreshes nightly).
- Method: `GET`
- Polling Headers:
  - `X-API-Key: {{ api_key }}`
- Custom Fields: paste `custom_fields.yml` (asks the user for the API key).

Then paste the matching `.liquid` file into each layout slot:

| Layout          | File                       |
| --------------- | -------------------------- |
| Full            | `full.liquid`              |
| Half horizontal | `half_horizontal.liquid`   |
| Half vertical   | `half_vertical.liquid`     |
| Quadrant        | `quadrant.liquid`          |

## Variables exposed

The polling response is available at the template root:

- `term` — e.g. `"Fall 2026"`
- `compared_to` — e.g. `"Fall 2025"`
- `fetched_at` — unix timestamp the response was generated
- `summary` — object with university-wide totals (used by the smaller layouts):
  - `enrollment`, `credits`
  - `enrollment_prev`, `credits_prev`
  - `enrl_chg_pct`, `crd_chg_pct` — signed percentage change
  - `enrl_up`, `crd_up` — boolean (drives the ▲/▼ glyph)
- `rows[]` — one entry per academic career (used by the full layout):
  - `career` — `UGRD` | `GRAD` | `PROF` | `VETM` | `DUAL`
  - `enrollment`, `credits`, `enrollment_prev`, `credits_prev`
  - `enrl_chg_pct`, `crd_chg_pct`, `enrl_up`, `crd_up`

The smaller layouts (quadrant, half_*) intentionally show only the current
term total with a single ▲/▼ delta against the prior Fall, per design spec.
