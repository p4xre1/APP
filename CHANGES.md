# Unreleased — help centre, FAQ and in-app legal texts (2026-09-30)

Offline help and legal area; still version 2.1.0, backup format unchanged.

- **Settings → Help & legal** with four full-screen pages (Get help, FAQ, Privacy
  policy, Terms of use). The onboarding form and the PIN screen link to the privacy
  policy and the terms in a modal dialog, so both can be read before anything is
  entered.
- **FAQ**: 33 answers in six topics (Data & security, Backup, Invoices, Tax guide,
  Subscriptions, General) held as data in `src/lib/faq.ts` and translated in all
  five languages. Search matches the text of the current language, ignoring case,
  accents and Arabic diacritics. Every answer was verified against the code; the
  parts that depend on Android rather than this repository are marked in the file
  header instead of being presented as code behaviour.
- **Privacy policy and terms of use**: rendered from `docs/legal/*.md`, which stays
  the single source of truth. `scripts/legal-content.mjs` generates
  `src/lib/legal-content.generated.ts` and `pnpm build` runs it; a test fails if the
  generated module and the markdown differ. Spanish and Portuguese read the English
  document with a translated notice. The pages show the last-updated line and the
  app version, label the owner placeholders instead of inventing values, parse
  headings/lists/tables into real elements (no raw HTML) and add an "Open online
  version" row only when the URL is configured.
- **Get help**: troubleshooting checklist, self-service block (jump to Backup &
  Restore, notification permission status) and support rows that stay hidden while
  unconfigured. "Report a problem" pre-fills a mailto with only the app version,
  Android version, device model and language; "Copy app info" copies the same four
  lines. No new permission, no `<queries>`: the values come from the WebView user
  agent, and CI fails if the merged manifest ever declares `<queries>`.
- **Tests** (11 new, 134 total): legal text equals the docs byte for byte, every
  language keeps every section, language fallback, FAQ keys in all five dictionaries
  and search in AR/FR/EN, release builds hide the unconfigured-contact notice, the
  report carries no vault data, RTL-aware rendering of every new screen, 48 px tap
  targets, and the manifest keeps no INTERNET permission and no `<queries>`.
- Bundle: the five dictionaries grow by 135 KiB (117 new keys each) and the bundled
  legal text adds 40 KiB to the main chunk; three new lazy chunks cover the new
  screens.

# Unreleased — subscriptions tracker and reminders (2026-09-30)

Offline subscription tracker (streaming, hosting, rent, insurance, licences) with
local reminders. Still version 2.1.0 until it is released; the backup format moves
to 3.0.0.

Data and storage
- New encrypted store `subscriptions` (ninth store, same vault, same import
  transaction): service name, category, amount in the currency's minor unit
  (integer, exact totals), currency MAD/USD/EUR, cycle
  `monthly`/`yearly`/`one_time_period` with `periodMonths` 1..120, `autoRenew`,
  `startDate` (ISO), payment method, notes, `cancelledAt`.
- Backup format **3.0.0**: `migrateBackup` adds an empty `subscriptions` array to
  older files and leaves every record untouched; import validation rejects bad
  subscription rows before anything is written. IndexedDB `fatorati-offline-v1`
  goes to version **4**.
- `resetApp`, lock-clear and the session cache all clear subscriptions too.

Dates, status and totals (pure, in `src/lib/subscriptions.ts`)
- Month-end-correct renewal math (`addMonthsClamped`: the 31st renews on the last
  day of a shorter month), leap years, future start dates, very old start dates,
  and DST/time-zone-safe calendar handling through the device's local date.
- Status `active` / `expiring_soon` / `expired` / `cancelled` with the boundary
  exactly at `warnDays` (default 7, configurable 1..30) and at 0 days. Auto-renew
  entries never expire.
- Monthly/yearly normalisation per currency; cancelled and expired entries are
  excluded; different currencies are **never** summed together.

Reminders (local notifications only)
- `@capacitor/local-notifications` 8.3.1, `isExactNotification: false` everywhere;
  `SCHEDULE_EXACT_ALARM` and `USE_EXACT_ALARM` are removed from the merged
  manifest with `tools:node="remove"`, `POST_NOTIFICATIONS` is declared, and no
  INTERNET permission is added.
- Reminders are opt-in, scheduled at 09:00 local time, `warnDays` before each
  renewal plus an optional day-of reminder. The permission prompt appears when
  reminders are enabled (not at app start); a refusal shows a clear message and
  falls back to the in-app banner.
- The pending set is rebuilt on launch, after every add/edit/delete and after a
  restore; deleted or cancelled entries are removed. A warning window that has
  already opened is clamped to today instead of being lost.
- Privacy default "Hide service names in notifications" (ON): the notification
  reads "A subscription needs your attention".

UI
- New **Subscriptions** module in the navigation: list sorted by nearest date
  with status chip and days left, add/edit form with validation, delete with
  confirmation, cancel/reactivate, summary card with per-currency monthly and
  yearly totals, status/category filters and name search, empty state.
- In-app attention banner on the Dashboard and on the Subscriptions screen —
  independent of notification permission.
- Settings → Subscription reminders (toggle, 1..30 days, day-of reminder, hide
  service names, next-reminder preview, permission state).

Export (offline)
- "Export all subscriptions" to `.xlsx` (`write-excel-file` 4.1.1, MIT — chosen
  over the unmaintained npm `xlsx` and the heavier exceljs) and to PDF through the
  existing canvas/jsPDF pipeline with Arabic/RTL fonts. Columns: service,
  category, amount, currency, cycle, auto-renew, start date, next renewal/end,
  status, payment method, notes, plus one totals row per currency.
- Both exports go through the existing staged-export flow and cache purge, and
  both carry the "Exported files are not encrypted" warning.

Tests
- New suites: `subscriptions.test.ts` (date math, boundaries, totals,
  validation), `notifications.test.ts` (planning and scheduling against a mocked
  Android bridge, hidden-name mode, denied permission, plugin failure),
  `subscription-export.test.ts` (row building, per-currency totals, real xlsx
  bytes parsed back, PDF bytes with a stubbed canvas), `subscriptions-ui.test.ts`
  (translated strings in all five dictionaries, server render in five languages,
  no network surface, permissions) and a v2→v3 backup migration test.

# 2.1.0 — invoice lifecycle, tax, numbering, hardening (2026-09-30)

Security and compliance
- `@capgo/capacitor-native-biometric` 7.6.0 → **8.7.0**, closing the
  authentication-bypass advisory GHSA-vx5f-vmr6-32wf (fixed in 8.3.6). Requires
  and includes the **Capacitor 7 → 8** upgrade (`@capacitor/*` 8.x, AGP 8.13.0,
  Gradle 8.14.3, minSdk 24, compile/target SDK 36, `density` in
  `configChanges`, Gradle `=` property syntax).
- `pnpm audit` clean: a `uuid` override pins the transitive CLI-only dependency
  (`uuid@<11.1.1` → `^11.1.1`).
- `LICENSE` (proprietary), `PRIVACY.md`, `SECURITY.md` (threat model and
  disclosure), `NOTICE.md` (Capacitor MIT, MPL-2.0 plugin, OFL fonts).
- Reset hardened: native cleanup (biometric credentials, cache, preferences) can
  no longer abort a reset — records are always erased.
- Backup password minimum of 8 characters (UI + `encodeBackup`); import limits:
  25 MB file, 20 000 records/store, 500 items/document, 10 000 chars/field,
  PBKDF2 iterations range 10 000–5 000 000 (range instead of exact match).
- Staged plaintext exports are cleared at startup, after each unlock and from
  Settings → Security → "Clear temporary files".

Tax assistant
- New offline **Tax assistant**: a Morocco / United States segmented control, a
  collapsible panel above the tax fields of the invoice and estimate forms,
  contextual one-line hints (tax rate, ICE, numbering, buyer certificate), and a
  full-screen **Tax guide** page reachable from Settings.
- Content is static data in `src/lib/taxGuide.ts` with a visible
  **Last reviewed: 2026-09-30** date per region: Morocco (TVA 20%/10%,
  exports 0%/exempt, 7% and 14% removed on 1 January 2026, Art. 145 CGI content
  list, auto-entrepreneur under 500,000 DH with "TVA non applicable" and CNIE,
  Art. 145-IX e-invoicing principle with no invented dates, ICE/IF deduction
  tips) and the United States (no federal sales tax, state plus local city
  rates, nexus, resale and exemption certificates, invoice content, 1099-NEC and
  W-9, 3–7 year records).
- Switching the region inside the assistant is view-only; "Use this region for
  new invoices" applies it to Settings. Visibility, region and first-view state
  are persisted (`taxAssistantVisible`, `taxAssistantRegion`, `taxAssistantSeen`,
  `taxRegion`) in the encrypted settings store and validated on import.
- The assistant adds no network surface: no fetch/XHR, no URLs in its sources,
  the manifest still has no INTERNET permission and `index.html` keeps
  `connect-src 'none'`. Strings are translated in all five languages, including
  RTL Arabic, and the panel closes with the same X control in both directions.

Correctness
- Invoices gained a real status workflow (`draft/sent/paid/overdue`) with a
  payment date; revenue, pending, net profit, charts and Reports are no longer
  stuck at zero.
- Tax (VAT) support: per-document rate, default rate, tax numbers for business
  and customer in the PDF, tax collected in Reports, integer minor-unit
  arithmetic.
- Sequential `PREFIX-YYYY-0001` numbering that honours the invoice/estimate
  prefixes, previews the next number and never reuses a number.
- Edit screens for customers, products, projects, expenses, estimates and
  invoices; estimate delete, status changes and conversion into a draft invoice;
  confirmation dialogs on every delete; search on invoices/customers/products/
  expenses and a status filter on invoices.
- Unreadable vaults now show a dedicated error screen with Retry/Lock instead of
  the onboarding wizard; empty number fields are clearable (`NumberInput`).
- Session record cache plus per-record re-encryption: one edit no longer
  re-encrypts a whole store, and startup no longer revalidates every record.
- Version string is read from `package.json` (`APP_VERSION`, v2.1.0);
  "1.0.0 Offline" is gone. CI adds `permissions: contents: read`, an audit gate
  and an R8 release build.

# FatooraLaw style copy — reference commit 2400f72c1b2a4c55eaa444e91d6fe6c0558ddcc3 (details/checks in README.md)
- `src/App.tsx`, `src/main.tsx`, `src/components/{AppShell,kit}.tsx`, `src/lib/dialogs.tsx`: reference navigation, topbar, cards, buttons, dialogs and mobile drawer.
- `src/index.css`, `src/fonts.css`, `src/lib/preferences.ts`: reference light palette/type scale, bundled font faces, matching dark tokens and contrast-aware accent/hover colors.
- `public/fonts/{inter,sora,jetbrains-mono}-{latin,latin-ext}-wght-normal.woff2`, `public/fonts/tajawal-{arabic,latin}-{400,500,700,800}-normal.woff2`, `public/fonts/{inter,sora,jetbrains-mono,tajawal}-LICENSE.txt`: 14 offline font files and four licenses.
- `src/modules/Dashboard.tsx`, `src/components/charts.tsx`, `src/lib/chart-data.ts`: reference metric/area/bar/donut styling with real, currency-separated local data and negative/zero/empty handling.
- `src/modules/{Customers,Projects,Invoices,Estimates,Expenses,Products,Reports,Settings}.tsx`: apply reference card, field, heading, button and semantic-color styles without replacing business logic.
- `src/components/{Onboarding,BackupPanel,CurrencyPicker,DateCalendar,DocumentOptions,ExportCsvButton,LanguagePicker,PreferencesPanel,SecurityGate,SecurityPanel}.tsx`: use the same reference form/settings styles, retaining all functions.
- `src/i18n/{en,ar,fr,es,pt}.json`, `src/lib/invoice-pdf.ts`: translate new navigation/chart labels and use local reference fonts in PDFs; no emoji.
- `tests/{visual-policy,chart-data}.test.ts`: source-only design/offline-font checks, chart arithmetic and Node-rendered SVG regression tests; no browser tests/screenshots.
- `README.md`, `CHANGES.md`: record authoritative source, font provenance, adaptations, verification scope and this file list.
