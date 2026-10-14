# Praytify Bible embeds

Scripture on any web page with one script tag. No key, no build step, no framework.

```html
<script type="module" src="https://praytify.bible/embed/v1.js"></script>

<praytify-verse reference="Psalm 23:1-3" version="WEB"></praytify-verse>
<praytify-daily version="WEB"></praytify-daily>
```

## Attributes

| Attribute | Element | Default | |
|---|---|---|---|
| `reference` | `praytify-verse` | required | `John 3:16`, `Romans 8:28-30`, `Psalm 23` |
| `version` | both | `WEB` | Any abbreviation from `/v1/versions` |
| `theme` | both | `auto` | `light`, `dark`, or `auto` (follows the visitor's setting) |
| `link` | both | on | `link="false"` hides the "Read the chapter" link |
| `attribution` | both | on | `attribution="false"` hides it; only do this if you show the translation's attribution yourself, since many licences require it |
| `api` | both | `https://api.praytify.bible` | Your self-hosted gateway |
| `reader` | both | `https://praytify.bible` | Where chapter links point |

## Styling

The widget renders in a shadow root, so your page's CSS cannot break it. Theme it with custom properties on the element:

```css
praytify-verse {
  --pb-accent: #0d9488;
  --pb-font-scripture: "Literata", Georgia, serif;
  --pb-radius: 8px;
}
```

Available: `--pb-bg`, `--pb-ink`, `--pb-muted`, `--pb-accent`, `--pb-rule`, `--pb-font-scripture`, `--pb-font-ui`, `--pb-radius`.

## Events

A failed load renders a readable message and dispatches `praytify-error` (bubbling, composed) with the error as `detail`.

## Security

API text is only ever inserted with `textContent`, never parsed as HTML, and attribution links are restricted to `http` and `https`.

MIT licensed. Scripture text is licensed per translation.
