# Core 2 template inventory

Source: `/Users/jkolade/sireskay/core-2-dashboard-builder-react-efu` (digest `f351f90b607cfc9a`)

Framework: next 16.4.0, react ^19.3.0, react-dom ^19.3.0, tailwindcss ^4.0.9

## Dependencies

`@headlessui/react`, `@tailwindcss/postcss`, `@tiptap/extension-link`, `@tiptap/extension-text-align`, `@tiptap/extension-underline`, `@tiptap/react`, `@tiptap/starter-kit`, `@types/react-scroll`, `@types/react-slider`, `@types/react-tagsinput`, `add`, `emoji-picker-react`, `framer-motion`, `millify`, `next`, `next-themes`, `postcss`, `react`, `react-animate-height`, `react-datepicker`, `react-dom`, `react-number-format`, `react-remove-scroll`, `react-scroll`, `react-slider`, `react-tagsinput`, `react-textarea-autosize`, `react-tooltip`, `react-use`, `recharts`, `sharp`, `swiper`, `tailwindcss`, `yarn`

## Routes (24)

| Route | Renders |
|---|---|
| `/` | `@/templates/HomePage` |
| `/affiliate-center` | `@/templates/AffiliateCenterPage` |
| `/customers` | `@/templates/Customers/OverviewPage` |
| `/customers/customer-list` | `@/templates/Customers/CustomerList/CustomerListPage` |
| `/customers/customer-list/details` | `@/templates/Customers/CustomerList/DetailsPage` |
| `/explore-creators` | `@/templates/ExploreCreatorsPage` |
| `/income/earning` | `@/templates/Income/EarningPage` |
| `/income/payouts` | `@/templates/Income/PayoutsPage` |
| `/income/refunds` | `@/templates/Income/Refunds/RefundsPage` |
| `/income/refunds/details` | `@/templates/Income/Refunds/DetailsPage` |
| `/income/statements` | `@/templates/Income/StatementsPage` |
| `/messages` | `@/templates/MessagesPage` |
| `/notifications` | `@/templates/Notifications` |
| `/products` | `@/templates/Products/OverviewPage` |
| `/products/comments` | `@/templates/Products/CommentsPage` |
| `/products/drafts` | `@/templates/Products/DraftsPage` |
| `/products/new` | `@/templates/Products/NewProductPage` |
| `/products/released` | `@/templates/Products/ReleasedPage` |
| `/products/scheduled` | `@/templates/Products/ScheduledPage` |
| `/promote` | `@/templates/PromotePage` |
| `/settings` | `@/templates/SettingsPage` |
| `/shop` | `@/templates/Shop/ShopPage` |
| `/shop/details` | `@/templates/Shop/ShopDetailsPage` |
| `/upgrade-to-pro` | `@/templates/UpgradeToProPage` |

## Components (51)

| Component | Files | Third-party imports |
|---|---|---|
| Button | 1 | next |
| Card | 1 | none |
| CardChartPie | 1 | react-number-format, recharts |
| Checkbox | 1 | @headlessui/react |
| Compatibility | 1 | none |
| CountryItem | 1 | react-number-format |
| DateAndTime | 1 | date-fns, framer-motion, react-datepicker |
| DeleteItems | 1 | none |
| Dropdown | 1 | @headlessui/react |
| Editor | 1 | @tiptap/extension-link, @tiptap/extension-text-align, @tiptap/extension-underline, @tiptap/react, @tiptap/starter-kit, emoji-picker-react |
| Emoji | 1 | @headlessui/react, emoji-picker-react, next-themes |
| Field | 1 | none |
| FieldFiles | 1 | none |
| FieldImage | 1 | none |
| Filters | 1 | none |
| Follower | 1 | none |
| GridProduct | 1 | none |
| Header | 6 | @headlessui/react, next, react-use |
| Icon | 1 | none |
| Image | 1 | next |
| Layout | 1 | none |
| LikeButton | 1 | none |
| Login | 5 | none |
| Logo | 1 | next |
| Message | 1 | react-textarea-autosize |
| Modal | 1 | @headlessui/react |
| NavLink | 1 | next |
| NewCustomers | 1 | next |
| NoFound | 1 | none |
| Percentage | 1 | none |
| PopularProducts | 1 | none |
| Product | 1 | next, react-number-format |
| ProductView | 1 | react-number-format, recharts |
| Range | 1 | react-number-format, react-slider |
| RefundRequests | 1 | next |
| ScheduleProduct | 1 | react-number-format |
| Search | 1 | none |
| Select | 1 | @headlessui/react |
| ShareProduct | 1 | none |
| ShopItem | 1 | react-number-format |
| Sidebar | 2 | next, react-animate-height, react-remove-scroll |
| Spinner | 1 | none |
| Switch | 1 | @headlessui/react |
| Table | 1 | none |
| TableProductCell | 1 | none |
| TableRow | 1 | none |
| Tabs | 1 | none |
| Test | 1 | none |
| ThemeButton | 1 | next-themes |
| Tooltip | 1 | react-tooltip |
| UnpublishItems | 1 | none |

## Page templates (12)

| Template | Files | Third-party imports |
|---|---|---|
| AffiliateCenterPage | 7 | millify, react-number-format, recharts |
| Customers | 18 | millify, next, react-number-format, react-use, recharts |
| ExploreCreatorsPage | 4 | none |
| HomePage | 8 | millify, next, react-number-format, recharts, swiper |
| Income | 18 | next, react-number-format, react-use, recharts |
| MessagesPage | 5 | react-number-format, react-use |
| Notifications | 4 | next |
| Products | 35 | @headlessui/react, millify, next, react-number-format, react-tagsinput, recharts |
| PromotePage | 11 | react-number-format, react-textarea-autosize, recharts |
| SettingsPage | 8 | react-scroll |
| Shop | 9 | swiper |
| UpgradeToProPage | 5 | react-animate-height |

## Tokens

File: `app/globals.css`. Dark mode selector: `&:where([data-theme=dark], [data-theme=dark] *)`.

| Token | Light | Dark override |
|---|---|---|
| `--shade-01` | `#141414` |  |
| `--shade-02` | `#101010` |  |
| `--shade-03` | `#191919` |  |
| `--shade-04` | `#222222` |  |
| `--shade-05` | `#4c4c4c` |  |
| `--shade-06` | `#727272` |  |
| `--shade-07` | `#7b7b7b` |  |
| `--shade-08` | `#e2e2e2` |  |
| `--shade-09` | `#f1f1f1` |  |
| `--shade-10` | `#fdfdfd` |  |
| `--primary-01` | `#2a85ff` |  |
| `--primary-02` | `#00a656` |  |
| `--primary-03` | `#ff381c` |  |
| `--primary-04` | `#7f5fff` |  |
| `--primary-05` | `#ff9d34` |  |
| `--secondary-01` | `#ffbc99` |  |
| `--secondary-02` | `#cabdff` |  |
| `--secondary-03` | `#b1e5fc` |  |
| `--secondary-04` | `#b5e4ca` |  |
| `--secondary-05` | `#ffd88d` |  |
| `--backgrounds-surface1` | `var(--shade-09)` | `var(--shade-02)` |
| `--backgrounds-surface2` | `var(--shade-10)` | `var(--shade-03)` |
| `--backgrounds-surface2-overlay` | `var(--shade-10)` | `var(--shade-02)` |
| `--backgrounds-surface3` | `rgba(241, 241, 241, 0.5)` | `rgba(16, 16, 16, 0.5)` |
| `--backgrounds-pop` | `var(--shade-10)` | `var(--shade-04)` |
| `--backgrounds-dark1` | `var(--shade-03)` | `var(--shade-08)` |
| `--backgrounds-dark2` | `var(--shade-01)` | `var(--shade-10)` |
| `--backgrounds-primary` | `var(--primary-01)` | `var(--primary-01)` |
| `--backgrounds-highlight` | `#f9f9f9` | `var(--shade-04)` |
| `--backgrounds-depth` | `#f9f9f9` | `#1d1d1d` |
| `--backgrounds-depth2` | `#f9f9f9` | `rgba(16, 16, 16, 0.5)` |
| `--text-primary` | `var(--shade-02)` | `var(--shade-09)` |
| `--text-secondary` | `var(--shade-06)` | `var(--shade-07)` |
| `--text-tertiary` | `var(--shade-07)` | `var(--shade-06)` |
| `--text-light` | `var(--shade-10)` | `var(--shade-01)` |
| `--text-blue` | `var(--primary-01)` | `var(--primary-01)` |
| `--stroke-border` | `var(--shade-10)` | `#272727` |
| `--stroke-subtle` | `rgba(123, 123, 123, 0.1)` | `#1e1e1e` |
| `--stroke-focus` | `var(--primary-01)` | `var(--primary-01)` |
| `--stroke-highlight` | `rgba(123, 123, 123, 0.5)` | `rgba(114, 114, 114, 0.5)` |
| `--stroke-stroke2` | `var(--shade-08)` | `#282828` |
| `--accent` | `#f52495` | `#f52495` |
| `--mask-1-stop50` | `rgba(253, 253, 253, 0)` | `rgba(40, 40, 40, 0)` |
| `--mask-1-stop100` | `var(--shade-10)` | `var(--shade-03)` |
| `--mask-2-stop1` | `var(--shade-09)` | `var(--shade-02)` |
| `--mask-2-stop2` | `rgba(241, 241, 241, 0)` | `rgba(27, 27, 27, 0)` |
| `--chart-green` | `#00b512` |  |
| `--chart-purple` | `var(--primary-04)` |  |
| `--chart-yellow` | `var(--primary-05)` |  |
| `--chart-min` | `var(--shade-08)` | `var(--shade-04)` |
| `--gradient-menu` | `rgba(226, 226, 226, 0.5), var(--shade-08)` | `rgba(226, 226, 226, 0.025), rgba(226, 226, 226, 0.05)` |
| `--gradient-card` | `var(--shade-09), #ebebeb` | `rgba(241, 241, 241, 0.075), rgba(235, 235, 235, 0.075)` |
| `--box-shadow-depth` | `0px 2.15px 0.5px -2px rgba(0, 0, 0, 0.25),
        0px 24px 24px -16px rgba(8, 8, 8, 0.04),
        0px 6px 13px 0px rgba(8, 8, 8, 0.03),
        0px 6px 4px -4px rgba(8, 8, 8, 0.05),
        0px 5px 1.5px -4px rgba(8, 8, 8, 0.09)` | `0px 2.15px 0.5px -2px rgba(0, 0, 0, 0.25),
        0px 5px 1.5px -4px rgba(8, 8, 8, 0.2),
        0px 6px 4px -4px rgba(8, 8, 8, 0.16),
        0px 6px 13px 0px rgba(8, 8, 8, 0.12),
        0px 24px 24px -16px rgba(8, 8, 8, 0.08),
        2px 4px 16px 0px rgba(253, 253, 253, 0.05) inset` |
| `--box-shadow-depth-dark-widget` | `0px 6px 4px -4px rgba(8, 8, 8, 0.25),
        0px 6px 13px 0px rgba(8, 8, 8, 0.12),
        0px 24px 24px -16px rgba(8, 8, 8, 0.08)` |  |
| `--box-shadow-depth-toggle` | `0px 0px 36px -8px rgba(0, 0, 0, 0.05),
        0px 6px 4px -4px rgba(8, 8, 8, 0.05),
        0px 5px 1.5px -4px rgba(8, 8, 8, 0.09)` | `0px 0px 36px -8px rgba(0, 0, 0, 0.5),
        0px 2.15px 0.5px -2px rgba(0, 0, 0, 0.25),
        0px 24px 24px -16px rgba(8, 8, 8, 0.04),
        0px 6px 13px 0px rgba(8, 8, 8, 0.03),
        0px 6px 4px -4px rgba(8, 8, 8, 0.05),
        0px 5px 1.5px -4px rgba(8, 8, 8, 0.09)` |
| `--box-shadow-depth-menu` | `0px 6px 4px -4px rgba(8, 8, 8, 0.05),
        0px 5px 1.5px -4px rgba(8, 8, 8, 0.09)` |  |
| `--box-shadow-press-pressing` | `0px 1px 2px 1px rgba(18, 18, 18, 0.05) inset` |  |
| `--box-shadow-press-pressing-dark` | `0px 2px 4px 1px rgba(18, 18, 18, 0.35)
        inset` |  |
| `--box-shadow-widget` | `0px 5px 1.5px -4px rgba(8, 8, 8, 0.09),
        0px 6px 4px -4px rgba(8, 8, 8, 0.05)` | `0px 5px 1.5px -4px rgba(8, 8, 8, 0.5),
        0px 6px 4px -4px rgba(8, 8, 8, 0.05)` |
| `--box-shadow-hover-light` | `0px 0px 0px 3px #fff inset` |  |
| `--box-shadow-input-typing` | `0px 4px 4px 0px rgba(157, 157, 157, 0.1) inset,
        0px 0px 0px 3px #fff inset` | `0px 4px 4px 0px rgba(18, 18, 18, 0.81) inset,
        0px 0px 0px 3px rgba(40, 40, 40, 0.1) inset` |
| `--box-shadow-dropdown` | `0px 0px 10px 0px rgba(0, 0, 0, 0.05),
        0px 2.15px 0.5px -2px rgba(0, 0, 0, 0.25),
        0px 24px 24px -16px rgba(8, 8, 8, 0.04),
        0px 6px 13px 0px rgba(8, 8, 8, 0.03),
        0px 6px 4px -4px rgba(8, 8, 8, 0.05),
        0px 5px 1.5px -4px rgba(8, 8, 8, 0.09)` | `0px 16px 48px -4px rgba(0, 0, 0, 0.75),
        0px 0px 10px 0px rgba(0, 0, 0, 0.5),
        0px 2.15px 0.5px -2px rgba(0, 0, 0, 0.25),
        0px 24px 24px -16px rgba(8, 8, 8, 0.04),
        0px 6px 13px 0px rgba(8, 8, 8, 0.03),
        0px 6px 4px -4px rgba(8, 8, 8, 0.05),
        0px 5px 1.5px -4px rgba(8, 8, 8, 0.09)` |

Utility colour names (`@theme`): `shade-01`, `shade-02`, `shade-03`, `shade-04`, `shade-05`, `shade-06`, `shade-07`, `shade-08`, `shade-09`, `shade-10`, `primary-01`, `primary-02`, `primary-03`, `primary-04`, `primary-05`, `secondary-01`, `secondary-02`, `secondary-03`, `secondary-04`, `secondary-05`, `b-surface1`, `b-surface2`, `b-surface2-overlay`, `b-surface3`, `b-pop`, `b-dark1`, `b-dark2`, `b-primary`, `b-highlight`, `b-depth`, `b-depth2`, `t-primary`, `t-secondary`, `t-tertiary`, `t-light`, `t-blue`, `s-border`, `s-subtle`, `s-focus`, `s-highlight`, `s-stroke2`, `accent`, `mask-1-stop50`, `mask-1-stop100`, `mask-2-stop1`, `mask-2-stop2`, `chart-green`, `chart-purple`, `chart-yellow`

Breakpoints: `sm` 480px, `md` 767px, `lg` 1023px, `xl` 1259px, `2xl` 1419px, `3xl` 1719px, `4xl` 1899px

Text sizes: `text-0`, `text-body-1`, `text-body-2`, `text-button`, `text-caption`, `text-h1`, `text-h2`, `text-h3`, `text-h4`, `text-h5`, `text-h6`, `text-overline`, `text-sub-title-1`, `text-sub-title-2`

Component classes: `.action`, `.box-hover`, `.card`, `.center`, `.center-with-sidebar`, `.chart-tooltip`, `.chart-tooltip-up`, `.col-left`, `.col-right`, `.epr-body`, `.epr-emoji-category-content`, `.epr-emoji-category-label`, `.epr-header`, `.gradient-card`, `.gradient-menu`, `.gradient-repeat-lines`, `.gradient-repeat-lines-green`, `.label`, `.label-gray`, `.label-green`, `.label-red`, `.label-yellow`, `.react-tooltip`, `.recharts-sector`, `.tiptap`

## Icons

82 inline SVG paths in `components/Icon/index.tsx`.

## Identity markers (must not ship)

Brand assets: `public/fb-og-image.png`, `public/images/logo-dark.png`, `public/images/logo-light.png`, `public/linkedin-og-image.png`, `public/pinterest-og-image.png`

Text hits: `package.json` (1), `app/layout.tsx` (17), `components/Login/index.tsx` (1), `components/ShareProduct/index.tsx` (2), `mocks/affiliate-center.tsx` (18), `mocks/creators.tsx` (5), `mocks/messages.tsx` (4), `mocks/products.tsx` (10), `mocks/promote.tsx` (36), `mocks/statements.tsx` (10), `templates/Customers/CustomerList/DetailsPage/Details/Contacts/index.tsx` (2), `templates/Customers/OverviewPage/ShareProducts/index.tsx` (2), `templates/HomePage/GetMoreCustomers/index.tsx` (2), `templates/PromotePage/List/SchedulePost/index.tsx` (1), `templates/Shop/ShopPage/Profile/index.tsx` (1)
