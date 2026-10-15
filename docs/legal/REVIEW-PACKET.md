# Legal review packet

Generated 2026-10-14 by legal-doc-generator from `legal-config.yaml` (config hash `f23845cfec53bf2a`).
Source evidence comes from `legal-evidence.json`, written by `scripts/detect.py` on 2026-10-14.

This packet exists so a reviewer can check every statement in the drafts against the code that supports it. The drafts are not legal advice and have not been reviewed by an attorney.

## 1. Documents rendered

| File | Open `[TBD]` markers |
|---|---|
| `docs/legal/privacy-policy.md` | 7 |
| `docs/legal/terms-of-service.md` | 9 |
| `docs/legal/cookie-policy.md` | 2 |
| `docs/legal/acceptable-use-policy.md` | 1 |

## 2. Claims and source evidence

Each row is a factual claim the documents make because detection found it. `Config field` is where to change it; `Evidence` is where a reviewer can verify it.

| Claim | Config field | Detected value | Evidence |
|---|---|---|---|
| Website URL | `product.websites` | https://praytify.bible/docs/quickstart | `package.json` |
| Web app is in scope | `product.apps.web.enabled` | True | `package.json:23` |
| Uses Better Auth (self-hosted library, not a third party) | `data_collection.authentication` | Better Auth | `package.json:21` |
| Collects email | `data_collection.identifiers` | email | `drizzle/0000_overrated_vision.sql:84`, `drizzle/0000_overrated_vision.sql:89`, `scripts/run-migration.sql:6`, +2 more |
| Collects name | `data_collection.identifiers` | name | `drizzle/0000_overrated_vision.sql:22`, `drizzle/0000_overrated_vision.sql:83`, `scripts/run-migration.sql:5`, +2 more |
| Collects password hash | `data_collection.identifiers` | password_hash | `drizzle/0000_overrated_vision.sql:14`, `scripts/run-migration.sql:25`, `src/db/schema.ts:61` |
| Stores ip address | `data_collection.internet_activity` | ip_address | `drizzle/0000_overrated_vision.sql:50`, `drizzle/0000_overrated_vision.sql:77`, `scripts/run-migration.sql:36`, +2 more |
| Stores device id | `data_collection.internet_activity` | device_id | `drizzle/0000_overrated_vision.sql:51`, `drizzle/0000_overrated_vision.sql:76`, `scripts/run-migration.sql:37`, +2 more |
| Customers receive API keys | `product.api_access` | True | `src/auth/index.ts:20`, `src/db/migrate.ts:35`, `src/db/schema.ts:88`, +2 more |
| Cookies or browser storage are set | `cookies.uses_cookies` | True | `portal/e2e/support/fixtures.ts:12`, `portal/src/components/ds/gallery/main.tsx:11`, `portal/src/features/reader/last-read.ts:57`, +2 more |

## 3. Assumptions

Inferences the scanner made that a human has not yet confirmed, plus fields still marked TODO in the config.

- security.controls starts from template defaults (TLS, encryption at rest, RBAC, vendor due diligence, backups, incident response). Remove any control you do not actually operate; each one is a claim. (`security.controls`)
- Retention periods are template defaults, not detected. Confirm each against what the database and backups actually do. (`retention`)
- No payment processor or in-app purchase code was found, so pricing_model is free. Set it if you charge through another channel (invoices, resellers). (`terms_of_service.pricing_model`)
- B2B signals (organizations or tenants, API keys, or outbound webhooks) suggest you process data on behalf of customers. The DPA is left disabled; enable dpa.applies and meta.output.documents.dpa if that is true. (`dpa.applies`)
- 10 config field(s) were still TODO at generation time and render as `[TBD: field]`; see section 4.

## 4. Open items

| Config field | Appears in |
|---|---|
| `entity.addresses.registered.city` | `docs/legal/privacy-policy.md`, `docs/legal/terms-of-service.md` |
| `entity.addresses.registered.country` | `docs/legal/privacy-policy.md`, `docs/legal/terms-of-service.md` |
| `entity.addresses.registered.postal_code` | `docs/legal/privacy-policy.md`, `docs/legal/terms-of-service.md` |
| `entity.addresses.registered.state` | `docs/legal/privacy-policy.md`, `docs/legal/terms-of-service.md` |
| `entity.addresses.registered.street` | `docs/legal/privacy-policy.md`, `docs/legal/terms-of-service.md` |
| `entity.contact.general_email` | `docs/legal/terms-of-service.md` |
| `entity.contact.privacy_email` | `docs/legal/privacy-policy.md`, `docs/legal/cookie-policy.md` |
| `entity.legal_name` | `docs/legal/privacy-policy.md`, `docs/legal/terms-of-service.md`, `docs/legal/cookie-policy.md`, `docs/legal/acceptable-use-policy.md` |
| `jurisdictions.governing_law` | `docs/legal/terms-of-service.md` |
| `jurisdictions.venue` | `docs/legal/terms-of-service.md` |

Config fields still TODO that control which sections render (an undecided flag renders as false, so the section is absent rather than wrong):

- `entity.formation.type`
- `entity.formation.jurisdiction`
- `jurisdictions.us`
- `jurisdictions.us_california_ccpa`
- `jurisdictions.us_virginia_cdpa`
- `jurisdictions.eu_uk_eea`
- `jurisdictions.canada_pipeda`

## 5. Counsel review flags

- Customer API access usually means you process data on behalf of customers. Confirm whether the DPA should be enabled and who the controller is.

## 6. Coverage matrix

| Document | Needed | Why | Enabled in config |
|---|---|---|---|
| privacy policy | yes | personal data in the schema; 1 third-party vendors | yes |
| terms of service | yes | every product needs usage terms; sets liability and dispute rules | yes |
| cookie policy | yes | cookie or tracking code found | yes |
| eula | no | no native mobile app found | no |
| dpa | likely | B2B signals (api_keys); customers will ask for one if you process their users' data | no |
| acceptable use policy | yes | API access | yes |

## 7. How to verify

1. Open each evidence path in section 2 and confirm the vendor, field, or permission is still in use.
2. Compare the vendor list against the dependency manifests; the scanner only knows vendors in `assets/vendor-privacy-urls.yaml`.
3. Resolve every open item in section 4 in `legal-config.yaml`, then re-run `scripts/generate.py`.
4. Work through section 5 with counsel before publication.
5. Re-run `scripts/detect.py` after material product changes; the claims table will show what moved.
