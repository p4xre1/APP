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
