# TRMNL templates — image_trmnl

Liquid templates for the four TRMNL plugin layouts. They display a random
image whose URL is returned by the JSON polling endpoint
`https://spandana.com/trmnl/json` on each poll.

## Plugin setup

In TRMNL, create a Private Plugin → "Polling" strategy:

- Polling URL: `https://spandana.com/trmnl/json`
- Polling interval: as desired (e.g. 15 minutes, 1 hour)
- Method: `GET`
- Custom Fields: paste `custom_fields.yml`.

Then paste the matching `.liquid` file into each layout slot:

| Layout          | File                       |
| --------------- | -------------------------- |
| Full            | `full.liquid`              |
| Half horizontal | `half_horizontal.liquid`   |
| Half vertical   | `half_vertical.liquid`     |
| Quadrant        | `quadrant.liquid`          |

## Expected JSON shape

The polling endpoint should return JSON like:

```json
{
  "image_url": "https://example.com/some-image.jpg",
  "caption": "Optional caption text"
}
```

Variables exposed at the template root:

- `image_url` — URL of the image to render (required)
- `caption` — optional caption shown in the title bar
