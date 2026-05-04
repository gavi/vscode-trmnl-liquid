# TRMNL templates

Liquid templates for the four TRMNL plugin layouts. They all consume the JSON
returned by `GET /trmnl/{state}` (or `/trmnl` which defaults to NY).

## Plugin setup

In TRMNL, create a Private Plugin → "Polling" strategy:

- Polling URL: `https://gas.objectgraph.com/trmnl/{{ state }}`
- Polling interval: 1 day (the upstream data is cached for 24h anyway)
- Method: `GET`
- Custom Fields: paste `custom_fields.yml` (gives the user a state dropdown).

Then paste the matching `.liquid` file into each layout slot:

| Layout          | File                       |
| --------------- | -------------------------- |
| Full            | `full.liquid`              |
| Half horizontal | `half_horizontal.liquid`   |
| Half vertical   | `half_vertical.liquid`     |
| Quadrant        | `quadrant.liquid`          |

## Variables exposed

The polling response is available at the template root:

- `state` — e.g. `"NY"`
- `fetched_at` — unix timestamp the cache row was filled
- `rows[]` — one entry per fuel (`unleaded`, `midgrade`, `premium`, `diesel`):
  - `fuel` — fuel name
  - `state` — state current price
  - `national` — US current price
  - `diff` — state minus national (signed)
  - `state_year_ago` — state price 1 year ago
  - `national_year_ago` — US price 1 year ago

The templates use `where: "fuel", "unleaded"` to grab specific rows.
