# Phone-test fixes (2026-09-29) — number fields, labels, revenue, calendar, share card, backup reminder

## 1. Number fields can be emptied (most important)
- `src/lib/number-input.ts` (new): `acceptNumberText`/`parseNumberText`/`formatNumberText`/`numberError`/`numberInputChange`. Raw text while typing, empty is `null` (never 0), "." and "," both accepted, letters blocked, Arabic-Indic digits normalised, formatting on blur.
- `src/components/NumberInput.tsx` (new): labelled `type="text"` + `inputMode="decimal"` ("numeric" for Stock) field, select-all on focus, suffix (e.g. MAD), `min`, `required` and an error line under the field.
- Replaced every `parseFloat(e.target.value) || 0` / `Number(e.target.value)` site: `src/modules/{Invoices,Expenses,Projects,Products,Estimates}.tsx`, `src/components/DocumentOptions.tsx` (manual exchange rate).

## 2. Every input has a visible label
- `src/components/Field.tsx` (new): shared label/hint/error styles and `TextField`, used by the customer, project, product, expense, invoice and estimate forms; short hints such as "Amount (MAD)", "Quantity", "Whole numbers only".
- Search fields (customers, currencies), the calendar date picker and the dashboard filters also carry visible labels.

## 3. Client form on a phone
- `src/modules/Customers.tsx`: one column, all fields full width, ≥48 px high, 16 px text (no zoom), phone uses `type="tel"`/`inputMode="tel"`, logical start/end spacing so LTR and RTL behave the same at 360 px.

## 4. Revenue numbers explained and checkable
- `src/lib/reports.ts`: pending = **sent + overdue**; overdue amount/count exposed; per-currency buckets include the invoice lists behind each number (`paid`, `pending`, `overdue`) and counts; drafts are never counted.
- `src/lib/revenue.ts` (new): grouping by client, project (only when invoices are linked) or month, with each group's amount and percentage.
- `src/components/MoneyDetails.tsx` (new): the tappable card drill-down — invoice number, client, project, date, amount, status; tap opens the invoice; total at the bottom matches the card; grouping switch.
- `src/components/RevenueInfo.tsx` (new): the "?" next to the revenue title explaining what counts as revenue, what counts as pending and that drafts are not counted.
- `src/modules/{Dashboard,Reports}.tsx`: tappable cards with "Sum of invoices marked as Paid · N invoices", the same for pending/expenses, and the red overdue line.

## 5. Currencies
- `src/lib/preferences.ts`: `REQUIRED_CURRENCIES` (MAD, EUR, USD, GBP, AED, SAR, DZD, TND, XOF, CAD) merged into `currencyCodes()`; `validCurrency` accepts them; MAD is the default for new users. Symbols/decimals still come from Intl (offline CLDR); no conversion was added.
- `src/components/CurrencyPicker.tsx`, `src/modules/Settings.tsx`: the full list is searchable and shows a formatting example. Old records without a currency keep working (read as the default currency). CSV keeps its Currency column and PDF totals now print the currency code.

## 6. Calendar screen
- `src/lib/calendar.ts` (new): month grid, month arithmetic, and invoice due dates + estimate expiry dates + payment dates (paid invoices) with overdue flags.
- `src/modules/Calendar.tsx` (new) added to `src/store/types.ts` (ModuleKey), `src/App.tsx` and `src/components/AppShell.tsx`: month view, tap a day for its items, overdue in red, per-currency day totals, works offline. `src/components/DateCalendar.tsx` now shares the same date helpers.

## 7. Shareable revenue card
- `src/lib/revenue-period.ts` (new): this month / last month / this year / custom ranges and the card values (paid revenue, invoice count, currency).
- `src/lib/revenue-card.ts` (new): local 1080×1350 PNG with period, total, invoice count and business name/logo; Arabic is laid out right-to-left; shared through the Android share sheet via `src/lib/share-file.ts`.
- `src/components/RevenueShare.tsx` (new): Share button + period picker on the revenue screen and dashboard.

## 8. Backup reminder
- `src/lib/backup-reminder.ts` (new): frequency (off/3/7/14/30 days), change threshold, dismissal that hides the banner for several days, persisted in Capacitor Preferences (non-secret).
- `src/components/BackupReminder.tsx` (new): dismissible banner with "Back up now" and "Dismiss"; `src/components/BackupPanel.tsx` gained the frequency setting and the "Last backup:" date.

## Translations, tests, docs
- `src/i18n/{en,ar,fr,es,pt}.json`: all new strings in the five languages (identical key sets and placeholders).
- `tests/{number-input,reports,calendar,backup-reminder,forms}.test.ts`: new logic tests, including clearing a real DOM field, the pending/overdue calculation, grouping percentages, calendar events, reminder timing and the currency list; existing tests kept unchanged.
- `package.json`, `pnpm-lock.yaml`: added jsdom/@types/jsdom as dev dependencies for the DOM-level number field test (not shipped in the app).
- `README.md`, `CHANGES.md`: this record. No design, security feature or existing test was removed; no automatic currency conversion was added.

---

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
