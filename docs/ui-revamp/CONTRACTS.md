# Design-system contracts

Owner: design-system. Consumers read this instead of the source. Source of truth for values is `portal/src/index.css`; ratios below are generated from it by `portal/scripts/contrast-check.mjs`. Changes are logged at the bottom.

## How to use the tokens

- Markup uses the Tailwind names in the **Utility** column: `bg-surface`, `text-ink`, `border-hairline`, `bg-accent text-on-accent`, and so on. Never a hex value, never a stock palette class (`text-gray-500`, `bg-indigo-600`); `check_gates.py` fails both.
- Dark mode is `data-theme="dark"` on `<html>`, managed by `ThemeProvider` (`portal/src/lib/theme.tsx`). Semantic tokens switch on their own, so most markup needs no `dark:` variant at all. Reach for `dark:` only for a genuine per-theme difference (the logo is the one case so far).
- Any subtree can force a theme with `data-theme="light"` or `data-theme="dark"`; utilities resolve at the element. The embed builder preview relies on this.
- Indigo **text** is `text-accent-text`, never `text-accent` (`accent` is the fill colour and is off-spec as text).
- `text-ink-faint` is decoration only: it fails AA for text by design.
- Inputs, checkboxes and switch tracks use `border-control` (3:1 edge). `border-hairline` and `border-border` are decorative and fail 3:1 by design.
- Focus is global: every focusable element gets a 2px `--focus` outline at 2px offset on `:focus-visible`. Do not remove it; do not add a second ring.
- Charts (recharts): SVG attributes do not reliably resolve `var()`. Read colours with `readToken("--chart-1")` from `lib/theme.tsx` and recompute when `resolvedTheme` from `useTheme()` changes.
- Breakpoints are Tailwind's mobile-first defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280). The template is desktop-first (`max-md:` with `md` = 767px): translate each responsive class, do not copy it.
- Reduced motion is handled globally. Anything that signals progress and must keep moving sets `data-motion="essential"` (Spinner does).

## Token translation table

| Template token | Brand token (CSS var) | Utility | Light | Dark | Used for |
|---|---|---|---|---|---|
| backgrounds-surface1 | `--surface-base` | `bg-surface` | `#FAF6F1` | `#1A1411` | Page background |
| backgrounds-surface2 | `--surface-raised` | `bg-surface-raised` | `#FFFFFF` | `#241C18` | Cards, panels, table body |
| backgrounds-surface3, depth, depth2 | `--surface-sunken` | `bg-surface-sunken` | `#F4EEE6` | `#130F0C` | Bands, wells, code blocks, table header |
| backgrounds-pop, surface2-overlay | `--surface-overlay` | `bg-surface-overlay` | `#FFFFFF` | `#2E2420` | Popover, dropdown, select list, dialog, sheet |
| backgrounds-dark1, dark2 | `--surface-inverse` | `bg-surface-inverse` | `#2C1810` | `#F3EBE1` | Tooltip, inverse chip |
| backgrounds-primary | `--accent` | `bg-accent` | `#4F46E5` | `#5B53E8` | Primary action fill, selected switch/checkbox |
| (hover of primary) | `--accent-hover` | `bg-accent-hover` | `#4338CA` | `#6159EC` | Primary hover |
| (pressed) | `--accent-active` | `bg-accent-active` | `#3730A3` | `#4F46E5` | Primary pressed |
| backgrounds-highlight | `--accent-subtle` | `bg-accent-subtle` | `#EEEDFB` | `#252040` | Selected row or item, chip, info alert |
| (committed panel terminus) | `--accent-deep` | `bg-accent-deep` | `#1E1B4B` | `#1E1B4B` | Committed panel gradient end |
| gradient-card, gradient-menu | `bg-committed` utility | `bg-committed` | indigo 600 → 800 → 950 | same | DESIGN.md committed panel, decision points only. Other template gradients are dropped |
| text-primary | `--ink` | `text-ink` | `#2C1810` | `#F3EBE1` | Headlines, body |
| text-secondary | `--ink-secondary` | `text-ink-secondary` | `#66564F` | `#BDB5AD` | Secondary body, descriptions |
| text-tertiary | `--ink-muted` | `text-ink-muted` | `#74665F` | `#9C958E` | Captions, metadata, eyebrows, placeholders, hints |
| (none) | `--ink-faint` | `text-ink-faint` | `#9D928C` | `#716A64` | Decoration only (ornaments, disabled glyphs). Not for text |
| text-light | `--ink-inverse` | `text-ink-inverse` | `#FAF6F1` | `#2C1810` | Text on `surface-inverse` |
| (white on primary) | `--ink-on-accent` | `text-on-accent` | `#FFFFFF` | `#FFFFFF` | Labels on `accent` and `bg-committed` |
| (white on danger) | `--ink-on-danger` | `text-on-danger` | `#FFFFFF` | `#FFFFFF` | Labels on `danger-fill` |
| text-blue | `--accent-text` | `text-accent-text` | `#4338CA` | `#A8A4F8` | Links, indigo text, active nav item |
| stroke-subtle | `--hairline` | `border-hairline` | brown 8% | cream 8% | Rules, dividers, table row lines |
| stroke-border, stroke2 | `--border` | `border-border` | brown 14% | cream 14% | Card and panel edges |
| stroke-highlight | `--control` | `border-control`, `bg-control` | `#8F827B` | `#7C756F` | Input, checkbox, switch-off edges (3:1) |
| stroke-focus | `--focus` | `outline-focus`, `ring-focus` | `#4338CA` | `#A8A4F8` | Focus outline (global) |
| primary-02, secondary-04 (green) | `--success`, `--success-subtle` | `text-success`, `bg-success-subtle` | `#2E6B3A` / `#E7F0E1` | `#8FD19A` / `#1D2B1F` | Success alert, badge, copy confirmation |
| primary-05, secondary-05 (amber) | `--warning`, `--warning-subtle` | `text-warning`, `bg-warning-subtle` | `#8A5300` / `#FAEFD8` | `#EFC16B` / `#302512` | Warning alert, expiring key, licence warning |
| primary-03, secondary-01 (red) | `--danger`, `--danger-subtle` | `text-danger`, `bg-danger-subtle` | `#B3261E` / `#FBE9E4` | `#F4A194` / `#3B1C18` | Error text, error alert, field error |
| (destructive fill) | `--danger-fill`, `--danger-hover` | `bg-danger-fill`, `bg-danger-hover` | `#B3261E` / `#9F1F17` | `#C0362C` / `#B3261E` | Danger button |
| primary-01 (blue) | `--info`, `--info-subtle` | `text-info`, `bg-info-subtle` | `#4338CA` / `#EEEDFB` | `#A8A4F8` / `#252040` | Info alert. Indigo, not a second blue |
| accent (pink `#f52495`) | dropped | | | | Sacred Dawn has one accent |
| (none) | `--highlight` | `bg-highlight` | `#EFDECC` | `#433427` | Reader verse highlight (warm tan tint) |
| (modal backdrop) | `--scrim` | `bg-scrim` | brown 45% | black 60% | Dialog and sheet overlay |
| chart-purple | `--chart-1` | (read with `readToken`) | `#4F46E5` | `#A8A4F8` | Primary series (requests) |
| chart-green, chart-yellow | `--chart-2` | (read with `readToken`) | `#B3261E` | `#F4A194` | Second series (errors) |
| chart-min | `--chart-grid` | (read with `readToken`) | brown 8% | cream 8% | Grid lines |
| (tick text) | `--chart-axis` | (read with `readToken`) | `#74665F` | `#9C958E` | Axis tick labels |
| box-shadow-widget, depth | `--elev-raised` | `shadow-raised` | soft brown | black + inner edge | Cards |
| box-shadow-dropdown, depth-menu | `--elev-overlay` | `shadow-overlay` | brown | black + inner edge | Popover, dropdown, select |
| box-shadow-depth-toggle | `--elev-dialog` | `shadow-dialog` | brown | black + inner edge | Dialog, sheet |
| (committed panel) | `--elev-committed` | `shadow-committed` | indigo 28% | black 50% | Committed panel only |
| shade-01 … shade-10 | `--sd-brown-*`, `--sd-night-*`, `--sd-dawn-*` | none | | | Raw ramp, referenced only by the semantic layer |
| font-inter (Inter Display) | `--font-sans` | `font-sans` | Plus Jakarta Sans Variable | same | UI and body |
| (none) | `--font-serif` | `font-serif` | Source Serif 4 Variable, roman + italic | same | Display (italic 500), scripture |
| (none) | `--font-mono` | `font-mono` | platform mono stack | same | Code, keys, Kbd |
| text-h1 | `--text-display` | `text-display` | clamp(48px … 76px), lh 1.02 | same | Page hero headline only |
| text-h2, text-h3 | `--text-h1` | `text-h1` | clamp(30px … 46px), lh 1.1 | same | Page title |
| text-h4 | `--text-h2` | `text-h2` | 26px, lh 1.2 | same | Section heading |
| text-h5 | `--text-h3` | `text-h3` | 20px, lh 1.3 | same | Card title, dialog title |
| text-h6, sub-title-1 | `--text-h4` | `text-h4` | 17px, lh 1.4 | same | Sub-section heading |
| (none) | `--text-body-lg` | `text-body-lg` | 17px, lh 1.6 | same | Editorial lead paragraph |
| body-1 | `--text-body` | `text-body` | 16px, lh 1.55 | same | Body (default on `body`) |
| body-2, sub-title-2, button | `--text-body-sm` | `text-body-sm` | 14px, lh 1.5 | same | Dense UI: tables, buttons, hints |
| caption | `--text-caption` | `text-caption` | 13px, lh 1.45 | same | Captions, metadata |
| overline | `--text-eyebrow` | `text-eyebrow` | 11px, tracking 0.24em | same | Eyebrows (uppercase, via `Eyebrow`) |
| (none) | `--text-scripture` | `text-scripture` | 19px × `--reader-scale`, lh 1.8 | same | Scripture. Reader sets `--reader-scale` on the reading column |
| rounded-4xl (2rem) | `--radius-card` | `rounded-card` | 20px | same | Cards |
| (none) | `--radius-panel` | `rounded-panel` | 28px | same | Panels, dialogs, committed panel |
| (none) | `--radius-input` | `rounded-input` | 12px | same | Inputs, selects, code blocks |
| (none) | `--radius-pill` | `rounded-pill` | 9999px | same | Buttons, chips, badges |
| (none) | `--container-content` | `max-w-content` | 70rem (1120px) | same | Page content width |
| (none) | `--container-measure` | `max-w-measure` | 68ch | same | Editorial line length |
| `primary-*` (portal legacy) | deprecated aliases | `text-primary`, `bg-primary-50` … | unchanged indigo | unchanged | Kept only so unmigrated pages render. Remove after Phase 4 |

## Contrast pairs

Thresholds: 4.5:1 for text (WCAG 1.4.3), 3:1 for control edges, focus indicators and chart marks (WCAG 1.4.11). Alpha colours are composited over the background they sit on. Regenerate with `cd portal && node scripts/contrast-check.mjs --markdown`; the plain command exits 1 if any gated pair fails.

| Text / mark | Background | Light | Dark | Needs | Result | Used for |
|---|---|---|---|---|---|---|
| ink | surface-base | 15.67 | 15.43 | 4.5:1 | pass | text |
| ink | surface-raised | 16.86 | 14.18 | 4.5:1 | pass | text |
| ink | surface-sunken | 14.63 | 16.15 | 4.5:1 | pass | text |
| ink | surface-overlay | 16.86 | 12.80 | 4.5:1 | pass | text |
| ink-secondary | surface-base | 6.49 | 9.01 | 4.5:1 | pass | text |
| ink-secondary | surface-raised | 6.98 | 8.27 | 4.5:1 | pass | text |
| ink-secondary | surface-sunken | 6.05 | 9.42 | 4.5:1 | pass | text |
| ink-secondary | surface-overlay | 6.98 | 7.47 | 4.5:1 | pass | text |
| ink-muted | surface-base | 5.12 | 6.17 | 4.5:1 | pass | text |
| ink-muted | surface-raised | 5.51 | 5.66 | 4.5:1 | pass | text |
| ink-muted | surface-sunken | 4.78 | 6.45 | 4.5:1 | pass | text |
| ink-muted | surface-overlay | 5.51 | 5.11 | 4.5:1 | pass | text |
| accent-text | surface-base | 7.35 | 8.10 | 4.5:1 | pass | text |
| accent-text | surface-raised | 7.90 | 7.44 | 4.5:1 | pass | text |
| accent-text | surface-sunken | 6.86 | 8.47 | 4.5:1 | pass | text |
| accent-text | surface-overlay | 7.90 | 6.72 | 4.5:1 | pass | text |
| accent-text | accent-subtle | 6.83 | 6.86 | 4.5:1 | pass | selected item, chip, info alert |
| ink | accent-subtle | 14.57 | 13.08 | 4.5:1 | pass | text on selected row |
| ink-on-accent | accent | 6.29 | 5.46 | 4.5:1 | pass | primary button label |
| ink-on-accent | accent-hover | 7.90 | 5.06 | 4.5:1 | pass | primary button hover |
| ink-on-accent | accent-active | 9.93 | 6.29 | 4.5:1 | pass | primary button pressed |
| ink-on-danger | danger-fill | 6.54 | 5.52 | 4.5:1 | pass | danger button label |
| ink-on-danger | danger-hover | 7.83 | 6.54 | 4.5:1 | pass | danger button hover |
| ink-inverse | surface-inverse | 15.67 | 14.28 | 4.5:1 | pass | tooltip, inverse panel |
| success | surface-base | 5.95 | 10.20 | 4.5:1 | pass | success text on page |
| success | surface-raised | 6.40 | 9.37 | 4.5:1 | pass | success text on card |
| success | success-subtle | 5.47 | 8.29 | 4.5:1 | pass | success alert/badge text |
| ink | success-subtle | 14.41 | 12.54 | 4.5:1 | pass | body text in success alert |
| warning | surface-base | 5.88 | 10.86 | 4.5:1 | pass | warning text on page |
| warning | surface-raised | 6.33 | 9.97 | 4.5:1 | pass | warning text on card |
| warning | warning-subtle | 5.55 | 8.94 | 4.5:1 | pass | warning alert/badge text |
| ink | warning-subtle | 14.78 | 12.71 | 4.5:1 | pass | body text in warning alert |
| danger | surface-base | 6.07 | 9.00 | 4.5:1 | pass | danger text on page |
| danger | surface-raised | 6.54 | 8.27 | 4.5:1 | pass | danger text on card |
| danger | danger-subtle | 5.56 | 7.60 | 4.5:1 | pass | danger alert/badge text |
| ink | danger-subtle | 14.36 | 13.02 | 4.5:1 | pass | body text in danger alert |
| info | surface-base | 7.35 | 8.10 | 4.5:1 | pass | info text on page |
| info | surface-raised | 7.90 | 7.44 | 4.5:1 | pass | info text on card |
| info | info-subtle | 6.83 | 6.86 | 4.5:1 | pass | info alert/badge text |
| ink | info-subtle | 14.57 | 13.08 | 4.5:1 | pass | body text in info alert |
| ink | highlight | 12.84 | 10.11 | 4.5:1 | pass | highlighted verse |
| ink-secondary | highlight | 5.31 | 5.90 | 4.5:1 | pass | verse number in highlight |
| chart-axis | surface-raised | 5.51 | 5.66 | 4.5:1 | pass | chart tick labels |
| control | surface-base | 3.46 | 4.02 | 3:1 | pass | input, checkbox, switch edge |
| control | surface-raised | 3.72 | 3.69 | 3:1 | pass | input, checkbox, switch edge |
| control | surface-sunken | 3.23 | 4.20 | 3:1 | pass | input, checkbox, switch edge |
| control | surface-overlay | 3.72 | 3.33 | 3:1 | pass | input, checkbox, switch edge |
| focus | surface-base | 7.35 | 8.10 | 3:1 | pass | focus outline |
| focus | surface-raised | 7.90 | 7.44 | 3:1 | pass | focus outline |
| focus | surface-sunken | 6.86 | 8.47 | 3:1 | pass | focus outline |
| focus | surface-overlay | 7.90 | 6.72 | 3:1 | pass | focus outline |
| accent | surface-base | 5.84 | 3.34 | 3:1 | pass | primary button edge on page |
| accent | surface-raised | 6.29 | 3.07 | 3:1 | pass | primary button edge on card |
| chart-1 | surface-raised | 6.29 | 7.44 | 3:1 | pass | chart series 1 |
| chart-2 | surface-raised | 6.54 | 8.27 | 3:1 | pass | chart series 2 |
| ink-faint | surface-base | 2.82 | 3.43 | none | decorative | ornament, disabled glyph |
| hairline | surface-base | 1.17 | 1.21 | none | decorative | rule |
| border | surface-raised | 1.33 | 1.48 | none | decorative | card edge |

## Primitives

Import everything from `@/components/ds`; never from `radix-ui` directly (run the static gate with `--primitive-lib radix-ui` to enforce this). A dev-only gallery renders every primitive in both themes: `pnpm dev`, then open `/src/components/ds/gallery/index.html` (`?theme=dark`, `?open=confirm|dialog`).

Every interactive primitive has hover, a visible `focus-visible` outline (global), active where it applies, and disabled. Primary controls are 44px tall; compact ones (`size="sm"`, checkbox, switch, pill tabs) keep a 44px hit area through the `touch-target` utility.

| Primitive | Import | Props | States | Adapted from |
|---|---|---|---|---|
| Button | `Button` | `variant` primary, secondary, ghost, danger, link; `size` sm (36px, 44px hit), md (44px), lg (52px); `loading`; `leadingIcon`, `trailingIcon`; `asChild` (wrap a TanStack `Link`); native button props. Defaults to `type="button"` | default, hover, focus-visible, active, disabled, loading (spinner, `aria-busy`, clicks ignored, stays focusable) | components/Button |
| IconButton | `IconButton` | **`label` (required, the accessible name)**, `icon`, `variant` ghost, secondary, primary, danger; `size` sm, md; `loading`; `showTooltip` | as Button | components/Button (`isCircle`) |
| Field | `Field` | `label`, `hint`, `error`, `required`, `disabled`, `hideLabel`, `id`; one control as child | valid, invalid (`aria-invalid`, error announced via live region), required (asterisk plus native `required`), disabled | components/Field |
| Input, TextArea | `Input`, `TextArea` | native props; `Input` adds `leadingIcon`. Inside a Field they take id, describedby, invalid, required and disabled from it; their own props win | default, hover, focus-visible, invalid, disabled, placeholder | components/Field |
| Select | `Select` | `options: { value, label, disabled? }[]`, `value`/`defaultValue`, `onValueChange`, `placeholder`, `name`, `required`, `disabled`, `invalid`, `aria-label` outside a Field | closed, open, highlighted row (tint plus indigo text), selected (check), disabled option, invalid. Arrow keys, Home, End, type-ahead, Escape | components/Select |
| SearchSelect | `SearchSelect` | `options: { value, label, description?, keywords? }[]`, `value`, `onValueChange`, `maxResults` (50), `placeholder`, `searchLabel`, `emptyMessage`; server search: `onQueryChange`, `filterOptions={false}`, `loading` | closed, open, active row, selected, empty, capped ("Showing 50 of 1,288"), searching. Arrow keys move, Enter picks, Escape closes and returns focus. Accent- and case-insensitive | components/Select + components/Search |
| Checkbox | `Checkbox` | Radix checkbox props (`checked` may be `"indeterminate"`); `label` and `description`, or `aria-label` when unlabelled | unchecked, checked, indeterminate, focus-visible, disabled | components/Checkbox |
| Switch | `Switch` | Radix switch props; `label` and `description`, or `aria-label` | off, on, focus-visible, disabled | components/Switch |
| Tabs | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Radix tabs props; `TabsList variant` pill or underline; give `TabsList` an `aria-label` | inactive, hover, active, focus-visible, disabled. Arrow keys, Home, End | components/Tabs |
| Dialog | `Dialog`, `DialogTrigger`, `DialogClose`, `DialogContent` | `title` (required), `description`, `footer`, `size` sm, md, lg | open, closing. Focus trapped and starts on the first field (Close is last in DOM order, top-right visually); Escape and the labelled Close button close it. Footer stacks full width on phones | components/Modal |
| ConfirmDialog | `ConfirmDialog` | `open`, `onOpenChange`, `title`, **`subject` (the exact thing affected)**, `description`, `confirmLabel` (a verb), `cancelLabel`, `tone` danger or default, `onConfirm`, `pending`, `error` | idle (focus on Cancel), pending (confirm busy, Cancel disabled, Escape blocked), error (danger Alert, stays open), success (closes) | components/Modal |
| Sheet | `Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent` | `title` (required), `hideTitle`, `description`, `side` left or right, `header` (e.g. a Logo) | open, closing. Focus trapped, Escape closes, width min(22rem, 88vw) | components/Modal (`isSlidePanel`) |
| DropdownMenu | `DropdownMenu`, `…Trigger`, `…Content`, `…Item`, `…RadioGroup`, `…RadioItem`, `…Label`, `…Separator`, `…Group` | `DropdownMenuItem`: `icon`, `tone` default or danger, `asChild` for links; content `align` defaults to end | closed, open, highlighted, disabled, checked (radio). Arrow keys, type-ahead, Escape | components/Dropdown |
| Tooltip | `Tooltip` | `content`, one focusable child, `side`, `delayDuration` | hidden, shown on hover and focus. Never put essential information in a tooltip; it does not show on touch | components/Tooltip |
| Popover | `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor`, `PopoverClose` | Radix popover props | closed, open | components/Dropdown |
| Card | `Card`, `CardHeader` | `Card`: `variant` raised, outline, sunken, committed; `padding` none, sm, md, lg; `as` div, section, article, li. `CardHeader`: `title`, `description`, `actions`, `titleAs` h2 or h3 | static. Never nest a Card in a Card | components/Card |
| Table | `Table`, `TableHead`, `TableBody`, `TableRow`, `TableHeaderCell`, `TableCell` | `Table`: **`caption` (required)**, `showCaption`, `stackOnMobile`. `TableCell`: `label` (column name shown when stacked) | default; overflowing (becomes a named, focusable scroll region); stacked below md (divided rows, ARIA table roles restated) | components/Table |
| Badge | `Badge` | `tone` neutral, accent, success, warning, danger, info | static. The words carry the meaning; colour reinforces | template `.label-*` classes |
| Alert | `Alert` | `tone` info, success, warning, danger; `title`, `children`, `action`, `onDismiss`, `role` | danger and warning default to `role="alert"`, info and success to `role="status"`; `role="none"` for notes present at page load | new |
| EmptyState | `EmptyState` | `title`, `description`, `icon`, `action`, `titleAs` | static. Only for a confirmed empty result, never for loading or a failed fetch | new |
| Spinner | `Spinner` | `size` sm, md, lg; `label` ("Loading"); `decorative` | spinning; keeps turning under reduced motion (`data-motion="essential"`) | components/Spinner |
| Skeleton | `Skeleton`, `SkeletonText` | sizing via `className`; `SkeletonText lines` | shimmering; static under reduced motion. Hidden from assistive technology: mark the region `aria-busy` | new |
| CopyButton | `CopyButton` | `value` (string or function read at click), `label`, `copiedLabel`, `failedLabel`, `display` button or icon, `size`, `variant`, `onCopied`, `onFailed` | idle, copied (only after `writeText` resolves, 2s), failed (rejected or missing API, 5s, visible text plus live announcement "Select the text and copy it manually") | new (replaces the portal's silent copy) |
| CodeBlock | `CodeBlock` | `tabs: { label, language, code }[]`, or `code`, `language`, `label` | single snippet, tabbed (Radix tablist), copy via CopyButton, long lines scroll in a focusable named region. No syntax highlighting | portal `components/CodeBlock.tsx` (moved) |
| Eyebrow | `Eyebrow` | `children`, `index` ("01"), `tone` muted or accent, `as` | static | DESIGN.md eyebrow |
| Stat | `Stat` | `label`, **`value` (number, string, or null/undefined for unknown)**, `hint`, `unavailableReason`, `loading`, `format` | value (locale-grouped), zero shown as 0, missing (dash plus reason, never 0), loading (skeleton, `aria-busy`) | new (AUDIT must-not-regress 9) |
| PageHeader | `PageHeader` | `title` (sans line), `serifLine` (italic serif line), `eyebrow`, `description`, `actions`, `size` page or hero | static. Renders the page's one `h1`. Two-voice headline is for page-level headers only | DESIGN.md signature headline |
| Kbd | `Kbd` | native kbd props | static | new |
| VisuallyHidden | `VisuallyHidden` | native span props | static | new |
| Logo | `Logo` | `variant` wordmark or mark, `height` (px), `product` (appends "Bible" as real text) | light and dark wordmarks swap with the theme (the brand forbids indigo on dark and white on light) | components/Logo (dark variant now wired) |
| ThemeToggle | `ThemeToggle` | `className` | Light, Dark, Match device as a radio menu; the trigger names the current choice ("Theme: match device (now dark)") | components/ThemeButton |

Helpers also exported: `cx()` (class join, no conflict resolution: prefer props over overriding utilities), `writeClipboard()` (throws unless the write is confirmed), `useFieldControl()` (wire a custom control into a Field). From `@/lib/theme`: `ThemeProvider`, `useTheme()` (`theme`, `resolvedTheme`, `setTheme`), `readToken()`, `THEME_STORAGE_KEY`.

### Integration notes for other roles

- **lead (`main.tsx`):** wrap the app in `<ThemeProvider>` from `@/lib/theme`. `index.css` is already imported there. Until then `useTheme()` and `ThemeToggle` throw by design.
- **keys:** show the new key once with `CopyButton` (never a toast, never the query cache: must-not-regress 4). Keep the key text selectable beside the button so a failed copy is recoverable. Revoke and roll go through `ConfirmDialog` with `subject` set to the key's name and prefix; pass `() => mutation.mutateAsync(id)` to get pending, error and close-on-success for free.
- **reader:** the version picker is `SearchSelect` (client filtering over the full list, or `onQueryChange` plus `filterOptions={false}` to keep the server-side debounced search). Scripture uses `font-serif text-scripture`; set `--reader-scale` on the reading column for the text-size setting. Verse highlight is `bg-highlight`. Set `lang` and `dir` on the scripture container.
- **usage, overview:** render every metric through `Stat`, passing `null` on error. Chart colours come from `readToken("--chart-1")` and friends, re-read when `resolvedTheme` changes.
- **ia-navigation:** mobile navigation is `Sheet` + `SheetContent side="left"`; `Logo product` and `ThemeToggle` go in both shells. Nav links are TanStack `Link`s styled with tokens (`text-ink-secondary`, active `text-accent-text`); use `Button asChild` only for button-shaped links.
- **page-migration:** `components/CodeBlock.tsx` is now a one-line re-export of the ds CodeBlock; switch the imports to `@/components/ds` and delete it. Forms use a native `<form onSubmit>` with `Button type="submit"` (AUDIT finding 18).

## Not provided

- **Stock Tailwind palette** (`gray-*`, `indigo-*`, `white`, `black`). Use the semantic utilities. The palette stays compiled only until Phase 4 finishes, then `--color-*: initial` removes it. Same for the deprecated `primary-*` aliases.
- **Space Grotesk and IBM Plex Mono.** Not loaded; eyebrows use Plus Jakarta Sans with tracking (BRIEF §4).
- **Syntax highlighting.** CodeBlock shows the language as a label. A highlighter is a new dependency and needs a BOARD decision.
- **Toasts.** Feedback stays next to the action (CopyButton, Alert, Field errors). A toast that outlives the banner must never carry a show-once key.
- **Link primitive.** Use TanStack `Link` with token classes, or `Button asChild` when it should look like a button. External links keep `rel="noopener noreferrer"`.
- **Pagination, breadcrumbs, avatars, date pickers, sliders, tag inputs, rich text.** None is needed by BRIEF §5 and §6, and several would need forbidden dependencies (BRIEF §2). Ask design-system first if a page needs one.
- **Charts.** recharts stays on the usage route, lazy-loaded; theme it with `readToken`.
- **Virtualised lists.** SearchSelect caps rendered rows instead. If the translations catalog needs all 1,288 rows on one page, page-migration paginates with Buttons; ask before adding a virtualisation dependency.

## Change log

| Date | Change | Consumers affected |
|---|---|---|
| 2026-10-14 | Token layers, translation table and contrast pairs published | everyone |
| 2026-10-14 | 30 primitives, `ThemeProvider`, `readToken`, `touch-target` utility, and the dev gallery published | everyone |
| 2026-10-14 | `components/CodeBlock.tsx` replaced by a re-export of the ds CodeBlock (same `tabs` prop). Not breaking | page-migration (LandingPage, QuickStartPage) |
| 2026-10-14 | SearchSelect gains server-side search (`onQueryChange`, `filterOptions`, `loading`) | reader |
| 2026-10-14 | No-flash theme script is `public/theme-init.js` (CSP `script-src 'self'`); it and `resolveTheme()` in `lib/theme.tsx` must stay in step | lead |
