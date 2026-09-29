# Fatorati 2 — Android offline

Capacitor 7, React, Vite, pnpm. App ID: `com.fatorati.app`. No accounts, analytics, remote translation, cloud SDKs, rate services, PWA, service workers, or runtime network features. The Android app does **not declare INTERNET**. Android automatic backups and device extraction are excluded. Sharing is an explicit handoff to an app the user chooses; the receiving app can use its own connection.

**Your data lives only on this phone. Uninstalling the app deletes it. Export a backup regularly.**

## First run, PIN and recovery

Create and confirm a PIN or passcode **before any business data is rendered**. A PIN is 6 to 12 digits; an optional alphanumeric passcode needs at least 8 characters. Trivial secrets are refused with a localized message: all-identical digits, simple runs in either direction (123456, 654321), repeated pairs (121212) and four digits that form a year (19xx/20xx). Existing installations also enroll a PIN before loading their records. This atomically encrypts existing IndexedDB records without deleting them. Arabic-Indic and Persian digit input are normalized to the same ASCII digits. App lock is mandatory in this version, so **exporting a backup requires a separate backup password**. The codec still accepts old unencrypted backups.

> If you forget your PIN, your data cannot be recovered without a backup.

- The PIN or passcode is never persisted. PBKDF2-SHA256 (600,000 iterations, random salt) produces independent encryption-key/verifier material; only the verifier/salt, the iteration count and non-secret lock state are stored in IndexedDB. If a future build raises the target, the count stored with the verifier is upgraded on the next successful unlock, re-encrypting every record once.
- Every record in all eight business stores is AES-256-GCM encrypted with a fresh random IV. Store name and record ID are authenticated as additional data. Plain field indexes are removed. IDs, ciphertext/IV and lock metadata remain visible; amounts/names/notes/settings records do not.
- PIN changes verify the current PIN, decrypt/encrypt in memory, then commit **all records and the new verifier together in one strict-durability IndexedDB transaction**. A failure rolls back the entire change. Revision checks prevent another WebView from overwriting a newer snapshot.
- The app always locks in the background using Capacitor App's `appStateChange`, plus a WebView visibility fallback. Keys and in-memory business state are cleared and data screens unmounted. Foreground idle timeout options are 1, 5 or 15 minutes; “Immediately on background” has no extra foreground idle timer. Unsaved form drafts are discarded on lock.
- Five wrong attempts trigger a persistent 30-second delay; further wrong attempts increase it to 1 minute, 5 minutes, 15 minutes, then 1 hour. The counter is kept in IndexedDB, so it survives app restarts and force-stops. Successful unlock clears it. **No automatic data wipe.**
- Settings → Security provides secret changes, biometric enrollment/removal, screenshot protection, lock now, a **Security status** card (lock, biometric, screenshot protection, last backup date and the deletion-sync warning) and Reset app. Every reset first offers **Export backup first** with a clear warning.
- **Reset from the lock screen** (forgotten secret) needs the typed confirmation word for the current language and then waits **24 hours**, shown as a live countdown. Unlocking with the correct secret cancels a pending reset. The request time is stored in IndexedDB metadata and the wait is measured as the smaller of the wall clock and `performance.now()`, so moving the phone clock cannot shorten it. **Reset inside Settings** needs the current secret plus the same typed word and has no waiting period. Both delete records, deletion markers, verifier, Preferences, biometric credentials, cached exports and app-copied clipboard text; neither recovers data.

### Biometric compatibility and boundaries

`@capgo/capacitor-native-biometric` is pinned to **7.6.0**. Before installation, its npm metadata was checked: peer dependency `@capacitor/core >=7.0.0`, development dependencies on Capacitor 7. Its shipped Android Gradle file uses SDK 35 / minimum 23 and Android Gradle Plugin 8.7.2, matching this project.

Enabling biometrics requires the app PIN and a successful native prompt. A copy of the derived **data key, never the PIN**, is kept in the plugin's Android Keystore-encrypted credential storage. Native authentication is required before retrieving it. The app PIN remains the fallback; device-passcode fallback in the plugin is disabled. The plugin uses its own authentication Activity, so returning from a successful native prompt creates a fresh session only after returning to the foreground. PIN changes disable old biometric enrollment/key identifiers; enroll again afterward.

This is not a security audit or a guarantee against a rooted/compromised device. The plugin's credential-encryption API and biometric verification are separate operations, not a per-use authenticated CryptoObject binding. Six-digit PINs have limited entropy, which is why 6 to 12 digits and passcodes are both offered; PBKDF2 and UI delays do not make offline brute-force impossible if an attacker obtains device data. Use a strong, independent backup password and a secure phone screen lock.

Appearance/language/time preferences are intentionally non-secret in Capacitor Preferences, with a localStorage appearance mirror for pre-paint application. They contain no PIN, keys or business records. CSV and PDF exports are plaintext files unless the optional **Protect with password** switch is on, which writes an AES-GCM/PBKDF2 `.fatorati-export` container that Settings → Open protected export can decrypt again. A one-time dialog explains the plaintext risk and can be dismissed permanently. Cache is temporary, not a safe backup destination: the app's `Cache/exports` folder is cleared on every lock and on every app start, and text the app itself copied to the clipboard is cleared on lock.

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
   - Merge matches IDs in each store; newer `updatedAt` wins; ties retain local records. Deletions travel too: a deletion marker newer than a local record removes it, and a record newer than the marker is kept and the marker dropped. The summary reports added/updated/deleted/skipped counts.
4. To sync both ways, export the merged result back to the other phone. Keep clocks accurate. There is no background sync. Deletion markers are kept for **180 days** and are purged from a backup when older; a phone that has not synced for longer than that may bring deleted records back, which Settings warns about.

Android's file picker can put the app in the background. A selected File handle is retained by a DOM listener outside the unmounted data UI, **not decrypted while locked**. Unlock, then return to Settings if prompted to finish the import. Onboarding logo selection uses the same lifecycle-safe handoff. If Android kills the process, choose the file again.

Backup **3.0.0** contains the eight business stores, the encrypted **tombstone** store (`{id, store, deletedAt, updatedAt}`), all display/security policy preferences, document currency/language/rates/times/color settings and a non-secret biometric-enabled flag. Version 2.0.0 files migrate with an empty tombstone list; 1.0.0 files also remain importable. Replace mode replaces the markers as well. No PIN verifier, encryption key or biometric credential is exported. The destination keeps its local PIN; biometric credentials cannot transfer and must be enrolled locally. Replace restores display preferences; Merge uses their `updatedAt`. Imported preferences are committed with records and safely applied from a pending marker after unlock.

Version **1.0.0** and **2.0.0** JSON and encrypted backups remain importable. Migration fills currency/language/time/preferences defaults, preserves IDs/timestamps and quantizes financial amounts. Existing display invoice numbers are not unique identity keys, so records from different phones with the same number can coexist. The UI remains single-business, not a multi-company account manager.

An import uses one transaction spanning **all nine stores plus metadata**, stronger than separate per-store transactions. Encryption is prepared before opening that transaction to avoid IndexedDB auto-close during crypto awaits. A failure leaves the whole import unchanged.

The last-backup Preferences date records successful share handoff, not proof of delivery. Failed/canceled shares reported by Capacitor do not reset it; CSV/PDF/imports do not either. The dashboard reminds after seven days or when no backup has been recorded. Native exports use unique Cache folders and FileProvider; only non-native test/browser execution uses `<a download>`. The whole `Cache/exports` tree is deleted when the app locks and when it starts.

PDFs are rendered to an image, so their text is not selectable. A selectable-text layer was not shipped: jsPDF cannot shape and reorder Arabic script, so the text layer would be wrong in Arabic. Invoices and estimates therefore also offer **Export invoice data as CSV** for accountants, which is plain, spreadsheet-ready text.

## Development/build

Requirements: Node 22+, pnpm 10.34.3, **Java 21**, Android SDK platform 35/build tools. Configure `ANDROID_HOME` or `android/local.properties`. Build dependencies may require a network connection; the installed app does not.

```sh
pnpm install
pnpm exec tsc --noEmit
pnpm test
pnpm build
pnpm cap:sync android
cd android
./gradlew assembleDebug --stacktrace
```

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

### Still requires physical Android/emulator verification

Native biometric hardware/enrollment/cancellation and its Activity lifecycle, actual Android background/process-death locking, share-sheet delivery to real apps, first-paint/native splash/status-bar behavior, screenshot/recents protection, and debug/release builds with R8/signing have **not** been verified on Android. Browser tests and native-bridge mocks do not establish these. Before distributing: run the build on a Java 21/SDK machine, test all five languages on real screens, background every form/picker/prompt, and transfer a backup between two Android phones. Confirm blocked screenshots, biometric fallback to the PIN, and the PIN/lockout/restore recovery paths.

The source ZIP excludes `.git`, `node_modules`, `dist`, generated Capacitor assets/Cordova scaffolding, local SDK configuration, signing secrets, test artifacts, caches and build outputs. It includes native launcher/splash resources, Android source, Gradle wrapper, lockfile, translations and tests. Build and sync regenerate excluded assets.
