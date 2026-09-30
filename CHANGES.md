# Unreleased — notebook and calendar (2026-09-30)

Ideas, notes, tasks and a month calendar in the same encrypted vault. Offline only:
no INTERNET permission, no new permission (the notification permission was already
used by subscriptions), CSP unchanged. Still version 2.1.0; the backup format moves
to **3.2.0**.

- **Encrypted notes store (tenth store)**: `Note { title?, body, tags[], color?,
  pinned, archived, type, done, date?, time?, remindMinutesBefore?,
  linkedCustomerId?, linkedInvoiceId?, linkedProjectId?, createdAt, updatedAt }`,
  plain text only, in the same IndexedDB database and the same import transaction.
  Caps: title 120, body 2 000, 10 tags of 24 characters, ten AA-checked palette
  colours (unknown colour → none). Links are soft: a deleted customer, invoice or
  project leaves the note intact and simply shows it without a target.
- **`src/lib/notes.ts`**: validation (`validateNote` returns an i18n key), clamping
  (`normalizeNote`), tag normalisation, search over title/body/tags with the FAQ's
  accent-, case- and Arabic-alef-insensitive normalisation (now shared through
  `src/lib/text-search.ts`), filters (type, tag, dated, open/done, archived), three
  sorts with pinned first and undated last, and the reminder moment
  (`noteReminderAt`: a time, or 09:00 for a date-only note, minus the chosen offset).
- **`src/lib/notes-draft.ts`**: the editor's autosave. Typing is sealed with the
  vault key into Preferences on a 400 ms debounce and flushed when the app is hidden;
  a damaged, stale (> 30 days) or unreadable draft (written before a reset) is dropped
  quietly, and an unfinished draft is offered again instead of being overwritten.
- **`src/lib/calendar.ts`**: pure date logic — `monthGrid`/`gridRange` (weeks start on
  the Settings day, Monday by default), `weekdayLabels`, `collectCalendarItems`
  (dated notes and tasks, unpaid invoices marked overdue, subscriptions that are
  neither cancelled nor past on their renewal/end date, pending estimates on their
  expiry date), range/item grouping, `daySummary` for the accessible "3 items", and
  `upcomingItems` for the dashboard card. Local calendar dates only, so DST and time
  zones never move an item, and only the visible month is computed.
- **Notebook screen**: two-tap quick capture (plus a Dashboard shortcut and a floating
  action button), full editor with type, colour, tags, date, time, reminder, links,
  pin and archive, "Convert idea to task" and "Mark done", delete behind a
  confirmation, archive as the gentle option, empty state that explains the feature,
  search/filter/sort bar and a translated counter.
- **Calendar screen**: month grid (dots **and** counts, every cell labelled for screen
  readers) beside the agenda of the selected day, per-type filter switches, "Add note
  on this date", rows that open the record they belong to, and RTL mirroring for
  Arabic. Shared presentational components (`MonthGrid`, `EventRow`, `NoteList`) keep
  the calendar, the agenda and the dashboard card identical.
- **Reminders**: inexact `@capacitor/local-notifications` only (no exact-alarm
  permission), built from notes **and** subscriptions in one plan, sorted by time and
  capped at the soonest **60**; rebuilt on launch, after every add/edit/delete/
  archive/done and after a restore; a deleted, archived or completed note cancels its
  notification. Permission is requested when the user chooses a reminder, never at
  start; a refusal falls back to the existing in-app banner. Notification text never
  contains note text: generic by default, and even with hiding off only the title.
- **Backup 3.2.0**: `notes` is validated field by field before any write (type, flags,
  title, tag count/length, date, time, reminder choice, link caps, body length), and a
  file over the per-store record cap is refused. Version 1.0.0–3.1.0 files still
  import: the 3.1.0 → 3.2.0 migration adds an empty notes list and changes nothing
  else. Notes travel in the encrypted `.fatorati` backup only — never in the CSV, PDF
  or Excel exports — and `resetApp`/lock clear them like every other record.
- **Tests** (59 new, 207 total): note model/caps/palette contrast, filters, search
  (accents and Arabic variants) and sorting; backup migration from 3.1.0, thirteen
  rejected import shapes and the record cap, encryption of stored notes, reset and
  lock; draft round-trip, staleness, wrong-key, damage, debounce and failure paths;
  calendar grid (month lengths, leap years, the three week starts, month ends, DST
  days, boundary items), aggregation (paid invoices excluded, deleted link targets,
  overdue markers, upcoming window) and month navigation; note reminders with the
  mocked plugin (scheduled, capped, cancelled, rescheduled after a restore,
  hidden-text mode, denied permission, plugin failure); the screens rendered in all
  five languages with Arabic RTL, escaped note text, a labelled grid, 48 px targets
  and the closed palette.

# Unreleased — document templates for invoices and estimates (2026-09-30)

Layouts and topic presets for invoices and estimates, chosen per document and
previewed live. Offline only: no INTERNET permission, no new permission, CSP
unchanged. Still version 2.1.0; the backup format moves to **3.1.0**.

- **Data-driven, no per-template code**: `src/lib/templates.ts` holds `LAYOUTS`
  (classic, modern, minimal, compact: header, table, spacing, totals position, footer
  and logo side) and `PRESETS` (general, freelancer & services, construction &
  contractor, retail & shop, restaurant & café, consulting & training, transport &
  delivery, auto-entrepreneur: visible columns, translated labels, unit suggestions,
  default notes/terms/footer and an optional materials/labour grouping) as plain data.
  One renderer (`src/lib/template-render.ts`) and one PDF wrapper read them, so a new
  layout or preset is a new object, not a new component.
- **Locked mandatory content**: every layout × preset × language × region combination
  still prints seller name/address/ICE/IF/TP/RC, client name/address/ICE, sequential
  number, date, each line's description, quantity and unit price, subtotal, TVA rate
  and amount grouped by rate, total incl. tax and the payment method — the model
  builder applies them, not the preset. An empty mandatory field prints a dash and is
  reported by the validator instead of being dropped. The auto-entrepreneur preset
  replaces the tax lines with *TVA non applicable* and prints ICE, IF, TP and CNIE. In
  the US the tax stays its own line. A preset may rename or add a column, never remove
  one, never change a rate and never auto-select one — the strongest hint is the
  editable one-liner "check the correct rate for your activity".
- **User controls**: a picker with a live preview on sample data in the current
  language and direction (RTL included), layout and preset chosen separately with the
  combination name shown; defaults for new documents in Settings; per-document override
  in both forms; accent from a palette that is contrast-checked per colour, optional
  logo and stamp/signature and a footer note capped at 160 characters. Images are
  resized to a 512 px edge and re-encoded before they reach the vault (`src/lib/images.ts`),
  validated again on import and cleared by *Reset app*.
- **Snapshot per document**: layout, preset, template version, accent, footer note,
  labels and tax region are stored on the document, so changing the defaults in
  Settings never alters an existing invoice or estimate. Documents written before
  templates existed map to classic + general at version 1 and render exactly as before;
  backup **3.1.0** writes that snapshot down while 1.0.0–3.0.0 files keep importing.
- **Tests** (14 new, 148 total): the full layout × preset × language × region matrix
  (invoice and estimate) builds and lays out; every Moroccan combination carries all
  locked mentions; the auto-entrepreneur preset shows the exemption and no tax line;
  the US keeps tax on its own line; a stored snapshot is untouched by new Settings
  defaults and is idempotent; a genuine 3.0.0 backup migrates to the legacy snapshot
  and renders byte-identically to a document without one; discount maths; preset
  structure (no key that could touch tax or mandatory content); RTL preview and painter;
  image resize/cap/validation rules; contrast of every palette colour; i18n keys of
  every registry string in all five dictionaries; a 50-line invoice (multi-page,
  repeated header, wrapping, time budget); the picker stays lazy and every new control
  keeps a 48 px target.
- Bundle: the initial set stays at the same 14 assets and grows by **+19.4 KiB gzip**
  (230.4 → 249.8 KiB), of which **+15.6 KiB** is the 148 new strings × 5 dictionaries
  and +3.9 KiB the template/image validation in `backup-format`; the picker is a new
  lazy chunk (7.2 KiB raw / 2.7 KiB gzip) and the layout engine ships inside the
  existing lazy `invoice-pdf` chunk.

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
