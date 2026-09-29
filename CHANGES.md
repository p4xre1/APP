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
