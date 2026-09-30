# Fatorati 2 — Android offline

Capacitor 8, React 19, Vite 8, pnpm. App ID: `com.fatorati.app`. Version 2.1.0. No accounts, analytics, remote translation, cloud SDKs, rate services, PWA, service workers, or runtime network features. The Android app does **not declare INTERNET**. Android automatic backups and device extraction are excluded. Sharing is an explicit handoff to an app the user chooses; the receiving app can use its own connection.

**Your data lives only on this phone. Uninstalling the app deletes it. Export a backup regularly.**

## Invoicing workflow (2.1.0)

- **Invoice lifecycle**: `draft → sent → paid → overdue`, changeable from the
  list. Marking an invoice paid stores a payment date (`paidAt`, UTC
  milliseconds) that is shown in the list, on the PDF and used as the revenue
  month in the dashboard charts. Revenue counts paid invoices, pending counts
  sent ones, and the dashboard now shows the document counts behind each metric.
- **Tax**: a per-document tax rate (percent) applied on top of the rounded
  subtotal, plus a default rate in Settings → "Document numbering and tax". Tax
  is calculated with integer minor-unit arithmetic (`JPY` 0, `USD` 2, `KWD` 3
  decimals), rounded half away from zero. Business and customer tax numbers
  (VAT/CR/TRN) appear in the PDF header blocks, and Reports shows tax collected
  per currency plus a document count by status. Applying a different currency to
  an existing document re-rounds every amount to that currency.
- **Numbering**: `PREFIX-YYYY-0001` sequences derived from the documents already
  stored, so numbers never repeat inside one install, deleted numbers are not
  reused and both prefixes are editable (Settings → "Document numbering and
  tax"). The next number is previewed in the create form.
- **Editing everywhere**: customers, products, projects, expenses, estimates and
  invoices can all be edited after creation; estimates can be deleted, converted
  into a draft invoice, and moved through `draft → sent → accepted → declined`.
  Every delete asks for confirmation, and every list has search (invoices also
  have a status filter).
- **Recovery screen**: if the vault cannot be read, the app shows an explicit
  error with Retry/Lock instead of the onboarding wizard, so a damaged database
  is never mistaken for a fresh install. "Reset app" now completes even if a
  native plugin fails, and always erases the records.
- **Performance**: decrypted records are cached for the current unlock session
  and only changed records are re-encrypted, so a one-record edit no longer
  re-encrypts the whole store. The cache is dropped on lock and every commit
  still verifies the stored revision, so stale data can never overwrite newer
  data written by another WebView.
- **Import limits**: 25 MB file cap, 20 000 records per store, 500 lines per
  document, 10 000 characters per text field, importable PBKDF2 cost between
  10 000 and 5 000 000 iterations, and a minimum backup-password length of 8
  characters (enforced in the UI and in `encodeBackup`).
- **Staged exports**: plaintext CSV/PDF/backup files are staged in the app cache
  only long enough to be handed to the share sheet, then removed at the next app
  start and after each unlock, with a "Clear temporary files" action in
  Settings → Security showing how many files are staged.


## Tax assistant (offline guidance)

The assistant is bundled guidance for invoices and tax. It is static data in
`src/lib/taxGuide.ts` (translated in all five dictionaries), so it needs no
network, no INTERNET permission and no relaxation of the shipped
`connect-src 'none'` policy.

- **Where it lives**: a collapsible panel above the tax fields of the invoice and
  estimate forms, one-line hints next to the tax fields themselves, and a
  full-screen **Tax guide** page opened from Settings → Tax assistant.
- **Region switch**: a "Morocco | United States" segmented control at the top of
  the assistant. It defaults to the region configured in Settings and switching
  it changes **only the guidance you read** — the region used for documents is
  untouched until you press "Use this region for new invoices" (or change it in
  Settings).
- **Show / hide**: Settings → Tax assistant has an on/off toggle (default on) and
  the panel has a close button. While hidden, a small "Show tax assistant"
  button appears in Settings and on the invoice and estimate forms; nothing else
  in the app shows the panel. The panel opens expanded the first time it is seen
  and starts collapsed afterwards.
- **Persistence**: `taxRegion`, `taxAssistantRegion`, `taxAssistantVisible` and
  `taxAssistantSeen` live in the encrypted settings store (with the rest of the
  vault), so they are encrypted at rest and travel with an encrypted backup.
  Regions from other apps or older backups are ignored rather than trusted.
- **Morocco**: TVA 20% standard and 10% reduced, 0%/exempt for exports and exempt
  items, the 7% and 14% rates removed on 1 January 2026 (valid only for invoices
  dated before that), the Art. 145 CGI content checklist (IF, TP, RC, 15-digit
  ICE, sequential gap-free numbering, per-rate TVA amounts, payment method), the
  auto-entrepreneur case (no TVA under 500,000 DH with the "TVA non applicable"
  mention plus ICE, IF, TP and CNIE), the e-invoicing principle in Art. 145-IX
  and the deduction risk of a missing or wrong ICE or IF.
- **United States**: no federal sales tax, state rates plus local city/county
  rates that vary by address, nexus and economic-nexus thresholds, exemption and
  resale certificates, invoice content, the difference between sales tax and
  income tax (1099-NEC/W-9), and 3–7 year record keeping.
- **Honest about what is unknown**: the e-invoicing timeline and thresholds are
  not stated as fact ("Check the DGI website for the current status"), and every
  region carries a visible **Last reviewed: 2026-09-30** date plus a
  "general information, not tax advice" disclaimer.


## First run, PIN and recovery

Create and confirm a six-digit PIN **before any business data is rendered**. Existing installations also enroll a PIN before loading their records. This atomically encrypts existing IndexedDB records without deleting them. Arabic-Indic PIN input is normalized to the same six digits. App lock is mandatory in this version, so **exporting a backup requires a separate backup password**. The codec still accepts old unencrypted backups.

> If you forget your PIN, your data cannot be recovered without a backup.

- The PIN is never persisted. PBKDF2-SHA256 (600,000 iterations, random salt) produces independent encryption-key/verifier material; only the verifier/salt and non-secret lock state are stored in IndexedDB.
- Every record in all eight business stores is AES-256-GCM encrypted with a fresh random IV. Store name and record ID are authenticated as additional data. Plain field indexes are removed. IDs, ciphertext/IV and lock metadata remain visible; amounts/names/notes/settings records do not.
- PIN changes verify the current PIN, decrypt/encrypt in memory, then commit **all records and the new verifier together in one strict-durability IndexedDB transaction**. A failure rolls back the entire change. Revision checks prevent another WebView from overwriting a newer snapshot.
- The app always locks in the background using Capacitor App's `appStateChange`, plus a WebView visibility fallback. Keys and in-memory business state are cleared and data screens unmounted. Foreground idle timeout options are 1, 5 or 15 minutes; “Immediately on background” has no extra foreground idle timer. Unsaved form drafts are discarded on lock.
- Five wrong PINs trigger a persistent 30-second delay; further wrong attempts increase it to 1 minute, 5 minutes, 15 minutes, then 1 hour. Successful PIN unlock clears the counter. **No automatic data wipe.**
- Settings → Security provides PIN changes, biometric enrollment/removal, screenshot protection, lock now and explicit Reset app. Reset requires two destructive confirmations and deletes records, verifier, Preferences, biometric credentials and cached exports. Reset is also available from the lock screen for forgotten-PIN recovery; it does not recover data.

### Biometric compatibility and boundaries

`@capgo/capacitor-native-biometric` is pinned to **8.7.0** (Capacitor 8). Version
**8.3.6 is the first release that fixes the authentication-bypass advisory
GHSA-vx5f-vmr6-32wf**, where the plugin's `onAuthenticationSucceeded()` ignored
the `CryptoObject`; any 7.x or < 8.3.6 build is affected, so the dependency is
always kept at the patched line. `pnpm audit` reports no known vulnerabilities
(a `uuid` override pins a transitive, dev-only CLI dependency to a patched
release).

Enabling biometrics requires the app PIN and a successful native prompt. A copy of the derived **data key, never the PIN**, is kept in the plugin's Android Keystore-encrypted credential storage. Native authentication is required before retrieving it. The app PIN remains the fallback; device-passcode fallback in the plugin is disabled. The plugin uses its own authentication Activity, so returning from a successful native prompt creates a fresh session only after returning to the foreground. PIN changes disable old biometric enrollment/key identifiers; enroll again afterward.

This is not a security audit or a guarantee against a rooted/compromised device. The plugin's credential-encryption API and biometric verification are separate operations, not a per-use authenticated CryptoObject binding. Six-digit PINs have limited entropy; PBKDF2 and UI delays do not make offline brute-force impossible if an attacker obtains device data. Use a strong, independent backup password and a secure phone screen lock.

Appearance/language/time preferences are intentionally non-secret in Capacitor Preferences, with a localStorage appearance mirror for pre-paint application. They contain no PIN, keys or business records. Explicit CSV/PDF exports are plaintext files; treat them accordingly. Cache is temporary, not a safe backup destination.

## Languages, currencies and documents

- Offline dictionaries: English, Arabic, French, Spanish and Portuguese. Language pickers are on the lock/onboarding screen and in Settings. Unsupported phone languages default to English.
- Arabic sets `html.lang`/`dir`, uses logical spacing/alignment and mirrored calendar chevrons. App dialogs, validation messages, CSV headers and invoice/estimate PDF labels are localized. Business names/descriptions entered by users are not automatically translated. Android's own share/picker/biometric chrome follows OS conventions.
- Western or Arabic-Indic digits use `Intl.NumberFormat`.
- Currency picker uses `Intl.supportedValuesOf('currency')` and localized `Intl.DisplayNames`, with search. The exact list reflects the phone WebView's bundled Intl/CLDR version; no list or names are fetched online.
- A business default currency is chosen at onboarding and editable in Settings. Invoices, estimates and expenses retain their own currency. Amounts are quantized consistently to that currency's minor-unit precision; integer minor-unit/BigInt arithmetic is used for rounding and sums. For example JPY has zero decimals, KWD three.
- Document options choose currency, language, an optional manual conversion rate and color/monochrome PDF output. A manual rate means **default-currency units per one document-currency unit**, and stores its target currency. Changing the business default does not silently reuse a rate for the wrong target.
- Reports and dashboard totals separate currencies. Reports also show a converted net total using entered rates, clearly marking documents omitted for missing rates. No online rates.
- Estimates now have a small creation form, document options and PDF export in the existing screen style.
- CSV exports on Customers, Invoices and Expenses include BOM/CRLF, CSV escaping and formula-injection protection. Their language picker overrides header/status language for that export. Values stay machine-portable; timestamps are ISO 8601 UTC, and each amount has its currency code.
- PDF/share buttons create actual multi-page PDFs locally with bundled Inter/Tajawal fonts, including Arabic/French. The header uses the selected accent with contrast-aware text, or black and white. PDF pages are rendered images (not searchable text); no fonts are downloaded.

## Dates and appearance

Settings includes DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD or automatic dates; 12h/24h time; searchable Intl time zones (phone zone by default); first day of week; optional Hijri display for Arabic. Record timestamps stay UTC milliseconds internally; the backup serializer emits ISO UTC timestamps and the loader restores milliseconds. Date-only fields remain ISO calendar dates, avoiding timezone shifts.

Expenses have a datetime field interpreted in the **selected** zone and a Gregorian date-selection calendar honoring the chosen first weekday. Nonexistent daylight-saving times are rejected; repeated DST times select one matching instant. Date-only input/calendar values remain Gregorian for portability, while display labels can use Hijri. Invoices, estimates, expenses, backup dates and the dashboard use the display settings.

Light/dark/system mode, ten accent presets/custom color, and comfortable/compact spacing are applied with CSS variables and Tailwind v4 theme tokens. Text on the accent automatically chooses black or white for contrast. A small local pre-paint script applies the appearance mirror; the native splash remains until Preferences initialization. App dialogs use the same theme, and the native status bar is updated. `FLAG_SECURE` is on by default before WebView startup and can be toggled in Settings. Remote content is blocked by CSP; WebView debugging remains disabled.

## Backup, transfer and migration

1. On the source phone: Settings → Backup & Restore. Enter and confirm a backup password. Export the `.fatorati` file using Android's share sheet; verify the receiving app actually saved/sent it.
2. On a new phone: first create a local PIN, then expand “Moving phones? Import an existing backup.” Existing phones use Settings.
3. Choose **Replace all data** or **Merge / Sync**, choose `.fatorati`/`.json`, and enter the backup password when requested.
   - Replace validates/decrypts first and asks for a destructive confirmation.
   - Merge matches IDs in each store; newer `updatedAt` wins; ties retain local records. No local records are removed. The summary reports added/updated/skipped counts.
4. To sync both ways, export the merged result back to the other phone. Keep clocks accurate. There is no deletion propagation or background sync; an older backup can restore previously deleted records.

Android's file picker can put the app in the background. A selected File handle is retained by a DOM listener outside the unmounted data UI, **not decrypted while locked**. Unlock, then return to Settings if prompted to finish the import. Onboarding logo selection uses the same lifecycle-safe handoff. If Android kills the process, choose the file again.

Backup **2.0.0** contains the eight stores, all display/security policy preferences, document currency/language/rates/times/color settings and a non-secret biometric-enabled flag. No PIN verifier, encryption key or biometric credential is exported. The destination keeps its local PIN; biometric credentials cannot transfer and must be enrolled locally. Replace restores display preferences; Merge uses their `updatedAt`. Imported preferences are committed with records and safely applied from a pending marker after unlock.

Version **1.0.0** JSON and encrypted backups remain importable. Migration fills currency/language/time/preferences defaults, preserves IDs/timestamps and quantizes financial amounts. Existing display invoice numbers are not unique identity keys, so records from different phones with the same number can coexist. The UI remains single-business, not a multi-company account manager.

An import uses one transaction spanning **all eight stores plus metadata**, stronger than separate per-store transactions. Encryption is prepared before opening that transaction to avoid IndexedDB auto-close during crypto awaits. A failure leaves the whole import unchanged.

The last-backup Preferences date records successful share handoff, not proof of delivery. Failed/canceled shares reported by Capacitor do not reset it; CSV/PDF/imports do not either. The dashboard reminds after seven days or when no backup has been recorded. Native exports use unique Cache folders and FileProvider; only non-native test/browser execution uses `<a download>`.

## License and compliance files

Fatorati is **proprietary software** — see `LICENSE` (all rights reserved: no
copying, redistribution, modification, store distribution or F-Droid packaging
without written permission). Bundled third-party components are listed in
`NOTICE.md` (Capacitor MIT, the biometric plugin MPL-2.0, OFL fonts with their
license texts in `public/fonts/`). User-facing policies live in `PRIVACY.md`
(no data collected, no network permission, uninstall deletes everything) and
`SECURITY.md` (disclosure process, threat model, what the app does not protect
against). Complete Google Play Data safety answers are listed in `PRIVACY.md`.


## Development/build

Requirements: Node 22+, pnpm 10.34.3, **Java 21**, Android SDK platform 36/build tools (AGP 8.13.0, Gradle 8.14.3, minSdk 24, target/compile SDK 36). Configure `ANDROID_HOME` or `android/local.properties`. Build dependencies may require a network connection; the installed app does not.

```sh
pnpm install
pnpm exec tsc --noEmit
pnpm test          # 47 Node tests: security, backup, tax, numbering, limits
pnpm build
pnpm cap:sync android
cd android
./gradlew assembleDebug --stacktrace
```

`pnpm dev` starts the Vite dev server with a development-only CSP relaxation
(the shipped `index.html` keeps `connect-src 'none'`); `pnpm build` output is
unchanged by it. `pnpm preview` serves the production bundle locally.

APK path: `android/app/build/outputs/apk/debug/app-debug.apk`. The retained GitHub Android workflow uses Java 21 and fail-fast install/typecheck/tests/build/sync/Gradle steps. No retries or failure suppression.

### Release signing — never commit secrets

Release enables R8 `minifyEnabled` and `shrinkResources`; Capacitor bridge/plugin reflection rules are retained. Create a signing key **outside this repository**, with interactive password prompts:

```sh
keytool -genkeypair -v -keystore "$HOME/fatorati-release.jks" \
  -alias fatorati -keyalg RSA -keysize 3072 -validity 10000
# After the build and sync steps above:
cd android
./gradlew assembleRelease --stacktrace
# Replace <version> with your installed Android build-tools version:
"$ANDROID_HOME/build-tools/<version>/zipalign" -p -f 4 \
  app/build/outputs/apk/release/app-release-unsigned.apk /tmp/fatorati-aligned.apk
"$ANDROID_HOME/build-tools/<version>/apksigner" sign \
  --ks "$HOME/fatorati-release.jks" --ks-key-alias fatorati \
  --out /tmp/fatorati-release.apk /tmp/fatorati-aligned.apk
"$ANDROID_HOME/build-tools/<version>/apksigner" verify --verbose /tmp/fatorati-release.apk
```

Keep secure offline copies of the keystore and passwords; future updates need the same signing key. Do not put passwords on command lines, in source or chat. Keystores and `keystore.properties` are ignored by Git. These are instructions, **not a claim that a release build/signing was executed here**.

### Browser regression harness (not Android)

```sh
pnpm exec playwright install chromium
pnpm build
# In one terminal (only a testing server):
python3 -m http.server 5173 --bind 0.0.0.0 --directory dist
# In another terminal:
pnpm test:browser
```

Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for an existing Chromium and `FATORATI_TEST_URL` for a different test origin. Test files/screenshots/PDFs are under ignored `.tmp-ui/`. The harness uses two independent browser profiles and asserts no page/console errors. It is not part of the Android runtime.

## FatooraLaw design reference and verification (2026-09-29)

The authoritative design source is now **https://github.com/p4xre1/FatooraLaw**, commit **2400f72c1b2a4c55eaa444e91d6fe6c0558ddcc3**, as supplied by the user. This supersedes the earlier original-checkout/ZIP comparison. Its application `src/index.css`, `components/kit.tsx`, `components/Sidebar.tsx`, `components/Topbar.tsx`, `components/nav.tsx`, `components/charts.tsx`, Dashboard and Settings were inspected directly. The implementation copies/adapts those **application presentation styles**, not the marketing site, account system, demo data or cloud backend.

- Light tokens match the reference: blue `#2563eb`, canvas `#f4f6f9`, ink `#0b1220`, white cards and navy `#0f172a` sidebar. Borders, subtle card shadows, compact headings/fields/buttons and navigation typography follow the reference kit.
- Fonts are bundled locally: **Inter**, **Tajawal**, **Sora** and **JetBrains Mono**, with Latin/Latin-extended and Arabic subsets as applicable. Inter is the application face; Tajawal is used for Arabic. Sora/display and JetBrains Mono tokens are available as in the reference. Fontsource **5.3.0** distributions provide the WOFF2 binaries; their SIL Open Font License files are in `public/fonts`. No Google Fonts stylesheet or runtime font download is used. PDFs also wait for the bundled Inter/Tajawal face before rendering.
- The reference's collapsible navy sidebar, module search, grouped navigation, sticky topbar, profile menu and quick-action presentation are adapted to the existing nine offline modules. On phones the sidebar is an accessible modal drawer, not an overflowing bottom navigation strip. Profile actions go to local Settings or lock the vault; they do not introduce accounts or cloud login.
- The dashboard uses the reference's metric cards, area chart, grouped-bar chart, donut and legends. They derive **real local records**, never seeded balances or fake percentage growth. The currency selector never combines currencies. Metrics show all-time figures; the 6/8/12-month selector controls chart ranges, grouped by Gregorian billing month in the chosen time zone. Revenue is paid invoice total by record occurrence/creation date (not a bank settlement date). Net bars support negative values. The donut explicitly shows positive expenses only; refunds still affect net totals. A text table exposes chart values without relying on hover/vision.
- Light/dark/system and custom accent preferences remain persisted. A topbar sun/moon control switches light/dark; Settings still supports system mode. Dark mode changes semantic colors while using exactly the same components and structure. Contrast-aware accent/hover text, RTL, digit choices and compact spacing remain supported.
- All existing customers/projects/invoices/estimates/expenses/products/reports/settings, PIN/biometrics/encryption, backup/merge/restore, document currencies/dates/languages and offline PDF/CSV sharing remain. New UI strings are in all five dictionaries. There are no emoji characters in `src`.

Checks performed for this revision:

- `pnpm exec tsc --noEmit`: passed.
- `pnpm test`: **37 passed**, including security/backup tests, reference-token/font/source-style checks, currency/timezone chart aggregation and SVG negative/zero/empty geometry tests rendered in Node (not a browser).
- `pnpm build`: passed; all 14 bundled WOFF2 URLs resolve to local files in the built output.
- `pnpm cap:sync android`: passed.
- Whole-`src` emoji scan: **zero matches**, including dictionaries, dialogs and export code.
- `git diff --check`: passed.
- **No screenshots were taken and no browser tests were run**, as requested. This is a source/style implementation, not a screenshot-based pixel-parity claim or an editable Figma document.
- The older browser harness remains for historical reference; its old bottom-navigation selectors need adapting to the new drawer before future use. Its earlier results do not verify this revision.
- Java/JAVA_HOME and a usable Android SDK remain unavailable in this sandbox. No APK was produced; native device tests were not run for this styling revision.

### Verification levels

Continuous integration (`.github/workflows/android-apk.yml`) runs `tsc`, the Node
tests, `pnpm audit --audit-level high`, `pnpm build`, `cap sync` and then builds
the Android project twice: `assembleDebug` (published as an artifact) and an
unsigned `assembleRelease` so R8/shrink-resources keep-rule problems fail the
build. That covers the Capacitor 8 / AGP 8.13.0 / Gradle 8.14.3 / minSdk 24 /
compileSdk 36 upgrade, meaning the app compiles and links against the platform.

### Still requires physical Android/emulator verification

Native biometric hardware/enrollment/cancellation and its Activity lifecycle, actual Android background/process-death locking, share-sheet delivery to real apps, first-paint/native splash/status-bar behavior, screenshot/recents protection, and signed release builds have **not** been verified on a device. Browser tests and native-bridge mocks do not establish these. Before distributing: run the build on a Java 21/SDK machine, test all five languages on real screens, background every form/picker/prompt, and transfer a backup between two Android phones. Confirm blocked screenshots, biometric fallback to the PIN, and the PIN/lockout/restore recovery paths.

The source ZIP excludes `.git`, `node_modules`, `dist`, generated Capacitor assets/Cordova scaffolding, local SDK configuration, signing secrets, test artifacts, caches and build outputs. It includes native launcher/splash resources, Android source, Gradle wrapper, lockfile, translations and tests. Build and sync regenerate excluded assets.
