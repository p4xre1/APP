# Fatorati 2 — Android and desktop offline

Capacitor 8, Electron 44, React 19, Vite 8, pnpm. Android app ID: `com.fatorati.app`; desktop app ID: `com.fatorati.desktop`. Version 2.2.0. The desktop edition packages the same encrypted offline application for Windows, macOS and Linux; see [`docs/DESKTOP.md`](docs/DESKTOP.md) for development and installer commands. No accounts, analytics, remote translation, cloud SDKs, rate services, PWA, service workers, or runtime network features. The Android app does **not declare INTERNET**. Android automatic backups and device extraction are excluded. Sharing is an explicit handoff to an app the user chooses; the receiving app can use its own connection.

**Your data lives only on this device. Uninstalling the app deletes it. Export a backup regularly.**

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
- **Morocco**: TVA 20% standard and 10% reduced (10% only for the operations the
  CGI lists; exemptions and out-of-scope situations are legal statuses, not a 0%
  rate choice; exports exempt with the right to deduct, Art. 92), the 7% and 14%
  rates removed on 1 January 2026 with the applicable rate following the date of
  the operation, the Art. 145 CGI content checklist (IF, TP, RC, 15-digit ICE,
  sequential gap-free numbering, per-rate TVA amounts, payment method), the
  auto-entrepreneur case (outside the scope of TVA, two ceilings — 200,000 DH
  services / 500,000 DH commerce-industry-artisanat, 1%/0.5% flat tax, the
  80,000 DH single-client 30% withholding at source in force since the 2023
  finance law, the "TVA non applicable" mention plus ICE, IF and CNIE), Law
  69-21 payment deadlines (B2B, 60 days default, 120 by contract, up to 180 by
  sector derogation, Treasury fine on the BAM policy rate, 2M DH scope), record
  keeping (10 years, lost documents reported within 15/30 days — Art. 211 CGI),
  the e-invoicing principle in Art. 145-IX (announced rollout, decree
  unpublished at review, no date stated, offline-PDF limitation spelled out)
  and the deduction risk of a missing or wrong ICE or IF.
- **United States**: no federal sales tax, state rates plus local city/county
  rates, sourcing that depends on the state and transaction (destination,
  origin or mixed — no universal ship-to rule), nexus and economic-nexus
  thresholds that vary per state, exemption and resale certificates, invoice
  content, the difference between sales tax and income tax (1099-NEC at 2,000
  USD for payments after 31 Dec 2025 with other 1099 categories keeping their
  own thresholds, 1099-K at 20,000 USD/200 transactions federally with possible
  reporting below it, W-9 collection, thresholds decide reporting not
  taxability), and record keeping that is state-specific (commonly 3–5 years)
  plus distinct federal periods.
- **Honest about what is unknown**: the e-invoicing timeline and thresholds are
  not stated as fact ("Check the DGI website for the current status"), and every
  region carries a visible **Last reviewed: 2026-09-30** date plus a
  "general information, not tax advice" disclaimer.


## Subscriptions tracker (offline)

Fatorati can now track what leaves the account on a recurring basis: streaming,
hosting, insurance, rent, a licence. It is the same offline architecture as the
rest of the app — no INTERNET permission, the shipped CSP untouched, and the
records live in the encrypted vault (`subscriptions` is a store inside the same
database and the same transaction).

- **Data**: service name, category, amount (stored in the currency's minor unit
  so totals stay exact), currency (MAD, USD, EUR), billing cycle (monthly,
  yearly, one-time period with 1..120 months), auto-renew, start date, payment
  method, notes and a cancellation timestamp.
- **Dates and status**: the next renewal rolls the start date forward, so a
  subscription that started on the 31st renews on the last day of shorter months
  and handles leap years. Status is `active` (more than warn-days away),
  `expiring soon` (0..warn-days, default 7), `expired` (a non-renewing entry
  whose end passed) or `cancelled`. Auto-renewing entries never expire; they show
  "renews on <date>". The device's local calendar date is used, so DST switches
  and travel do not shift a renewal day.
- **Totals per currency, never mixed**: the summary card, the Excel export and
  the PDF export each show one monthly and one yearly total per currency. MAD and
  USD are never added together. Cancelled and expired entries are excluded.
- **Filters**: status, category and a name search, sorted by the nearest date
  (overdue first, cancelled last), with a status chip and days left.
- **Reminders**: local notifications only, from `@capacitor/local-notifications`.
  Nothing leaves the phone and no exact alarm is requested: every notification is
  scheduled with `isExactNotification: false` and the merged manifest strips
  `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` with `tools:node="remove"`, so the app
  never appears under Android's "Alarms & reminders" special access.
  - Reminders are **opt-in** (Settings → Subscription reminders), fire at 09:00
    local time, warn 1–30 days before the renewal (default 7) and optionally
    again on the day itself. The set is rebuilt on every launch, after any add or
    edit, and after a restore; deleted or cancelled entries lose their
    notification.
  - `POST_NOTIFICATIONS` is requested **when reminders are enabled**, never at app
    start. If the permission is refused the app says so and relies on the in-app
    banner, which needs no permission at all.
  - **Privacy default**: "Hide service names in notifications" is ON, so a
    reminder only says "A subscription needs your attention". Turning it off
    shows the service name.
  - Some Android vendors (Xiaomi/MIUI, Huawei, Oppo, Vivo, Samsung and others)
    delay or block notifications while battery optimization is active, and some
    kill scheduled alarms when the app is force-stopped. The in-app banner on the
    Dashboard and at the top of the Subscriptions screen is independent of the OS
    and always lists expiring and expired entries.
- **Exports**: "Export all subscriptions" writes an `.xlsx` (via
  `write-excel-file`, MIT, no network) or a PDF through the existing canvas/jsPDF
  pipeline with the bundled Inter/Tajawal fonts, Arabic RTL included. Columns:
  service, category, amount, currency, cycle, auto-renew, start date, next
  renewal/end, status, payment method, notes, then the per-currency totals.
  Exported files are **not encrypted** — delete them when you are done; they are
  staged in the app cache like the other exports and cleared at the next start or
  unlock.
- **Backups**: the backup format is now **3.1.0** and includes the subscriptions
  store and the per-document template snapshot. Version 1.0.0, 2.0.0 and 3.0.0
  files still import: the migration adds an empty subscription list, writes the
  legacy snapshot (classic layout, general preset, template version 1) on documents
  that have none, and leaves every other record untouched. The same limits
  apply (25 MB, 20 000 records per store, 500 items per document, 10 000
  characters per field), and invalid subscription values are rejected before
  anything is written.

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

## Document templates (offline, 2.1.0)

Invoices and estimates can be laid out like the trade they belong to. The screens are
**Settings → Templates** (defaults for new documents) and the *Layout / Topic preset*
block inside the invoice and estimate forms (one document). Both open the same picker
with a live preview drawn from sample data in the current language and direction.

Four layouts and eight topic presets live as **plain data** in `src/lib/templates.ts` —
`LAYOUTS` and `PRESETS` — and are read by one renderer (`src/lib/template-render.ts`).
Adding a layout or a preset means adding one object, never a new component. Each entry
carries the i18n keys of its name, description, neutral default note, payment-terms
suggestion, footer wording and unit suggestions, so nothing here is hard-coded prose.

- **classic** — colour band header with the logo on the leading side, hairline table,
  boxed totals at the end of the flow, ruled footer.
- **modern** — large title on a colour block, airy striped table, boxed totals, full
  colour footer band, logo on the trailing side.
- **minimal** — plain stacked header without a band, open table (no fills), totals as a
  right-aligned stack, plain footer line, no logo.
- **compact** — one inline header line, boxed compact table, totals on a single line,
  no footer band and smaller type: the layout for a long parts list.

- **general** — description, quantity, unit price: the default for any trade.
- **freelancer & services** — adds a unit column, relabels quantity as *Hours* and
  price as *Rate*, suggests hour/day/forfait, suggests payment within 30 days.
- **construction & contractor** — adds a unit column (m², ml, forfait, day) and groups
  the lines under *Materials* and *Labour* sub-headings.
- **retail & shop** — relabels description as *Item* and adds an optional per-line
  discount percentage.
- **restaurant & café** — short *Item / Quantity / Price* lines for a busy service.
- **consulting & training** — *Days or sessions* at a *Rate*, with day/session/hour
  suggestions.
- **transport & delivery** — *Trips* or kilometres at a *Rate*, suggestions trip/km/day.
- **auto-entrepreneur** — prints *TVA non applicable*, keeps ICE, IF, TP and CNIE and
  drops the tax lines entirely.

**Mandatory content is locked.** Whatever the layout, the preset or the options a user
picks, a Moroccan document always prints the seller name/address/ICE/IF/TP/RC, the
client name/address and ICE, the sequential number, the date, every line description,
quantity and unit price, the total excl. tax, the TVA rate and amount grouped by rate,
the total incl. tax and the payment method. The four mandatory columns survive every
preset, and an empty mandatory field prints a dash and is reported by the validator
instead of disappearing. A preset can rename a column, add a column or add a
sub-heading — it can never remove one, change a tax rate, or select a rate
automatically; the strongest thing a preset says about tax is the one-line
"check the correct rate for your activity" hint. In the US the tax stays its own line.

Customisation is deliberately narrow: an accent colour from a palette that is checked
for 4.5:1 contrast, an optional logo, an optional stamp/signature, and a footer note
capped at 160 characters. Images are user-provided only (no bundled art, no remote
URLs), downscaled to a 512 px edge, re-encoded as PNG or JPEG inside the size cap,
stored in the encrypted vault like every other record, validated again on import
(PNG/JPEG bitmap data URL inside the cap; SVG and oversized payloads are refused) and
erased by *Reset app*. There is no free-form HTML, no custom font and no remote
resource anywhere in the feature.

**A document keeps the template it was saved with.** Each invoice and estimate stores
its own snapshot — layout, preset, template version, accent, footer note, the labels it
was created with and the tax region in force. Changing the defaults in Settings
afterwards cannot reach back into an existing document, and a future template version
can change how *new* documents look without touching version-1 documents. Documents
written before templates existed resolve to classic + general at version 1 and render
exactly as they did: no logo, the app accent, the same wording. The backup migration
writes that snapshot down (backup **3.1.0**), so importing an older file keeps old
invoices unchanged.

The preview and the PDF are the same engine: the picker paints the laid-out pages on a
canvas with the bundled Inter/Tajawal fonts, and the PDF wrapper paints the very same
page objects. Multi-page tables repeat the table header row and the document number on
every continuation page, long descriptions wrap instead of being clipped, and a 50-line
invoice is laid out in a single pass (a test asserts a generous time budget on the
layout step). The picker, the layout engine and the PDF wrapper are all lazily loaded,
so nothing in this feature sits in the startup bundle.

## Notebook and calendar (offline, 2.1.0)

Two screens that keep the small things next to the invoices, in the same encrypted
vault: **Notebook** for ideas, notes and tasks, **Calendar** for everything that has
a date. Offline by construction — no INTERNET permission, no new permission, the
shipped CSP unchanged — and the notes live in a tenth store inside the same database
and the same import transaction.

- **Data**: `Note { title?, body, tags[], color?, pinned, archived, type, done,
  date?, time?, remindMinutesBefore?, linkedCustomerId?, linkedInvoiceId?,
  linkedProjectId?, createdAt, updatedAt }`. Plain text only: the editor never
  renders HTML, and every value is escaped where it is shown. Caps: 120 characters
  of title, 2 000 of body, 10 tags of 24 characters. The palette is a fixed list of
  ten AA-checked colours; an unknown colour falls back to none. A link is a soft
  reference — if the customer, invoice or project is deleted, the note keeps its day
  and simply shows without the target.
- **Two-tap capture**: a floating **+** and the **Quick idea** shortcut on the
  Dashboard save the body first, with the title optional; the full editor (type,
  colour, tags, date, time, reminder, links, pin, archive) is one more tap. An idea
  becomes a task with *Convert idea to task*, and a task is completed with *Mark
  done*.
- **Never lose text**: typing is saved on a 400 ms debounce *and* flushed when the
  app is hidden or closed. The draft is sealed with the vault key and kept in
  Preferences, so what is on disk is ciphertext; a draft written before an app reset
  cannot be read afterwards. A draft that is damaged or older than 30 days is
  dropped quietly.
- **List and search**: search over title, body and tags (accent-, case- and
  Arabic-alef insensitive, the same normalisation the FAQ search uses), filters for
  type, tag, dated/undated, open/done and archived, sorting by last change, date or
  creation, pinned entries first and undated entries last. Delete asks first;
  archiving is the gentle option, and the archive has its own view.
- **Calendar**: a month grid plus the agenda of the selected day. Week starts on
  **Monday** by default, switchable to Saturday or Sunday in Settings (the existing
  date preference). Each day shows dots with a count *and* an accessible sentence
  ("3 items"/"No items"); every row carries its own icon **and** a written label, so
  the kind is never carried by colour alone. Tapping a row opens the note, invoice,
  estimate or subscription it belongs to; tapping an empty day offers "Add note on
  this date". Type filters can be switched off one by one.
- **What the calendar shows**: notes and tasks with a date; invoices that are not
  paid yet (marked overdue once the due date is behind us); subscriptions that are
  neither cancelled nor past, on their next renewal or end date; and pending
  estimates on their expiry date. Paid invoices, cancelled subscriptions and closed
  estimates are simply absent. Dates are **local calendar dates** computed on the
  existing date helpers, so a time-zone change or a daylight-saving day never moves
  an item, and only the visible month (plus the grid's padding days) is computed, so
  a notebook with thousands of entries stays responsive. Arabic mirrors the grid
  through the shared RTL rules, arrows included.
- **Reminders**: a note with a date can carry a reminder (at the time, 15 minutes,
  1 hour or 1 day before). A date-only note reminds at **09:00** local. Reminders
  reuse `@capacitor/local-notifications`, are **inexact** (no exact-alarm
  permission) and are rebuilt on launch, after any add/edit/delete/archive/done and
  after a restore; deleting, archiving or completing a note cancels its
  notification. The pending set is shared with the subscriptions and capped at the
  soonest **60**, topped up on each launch. Notification text never contains a note:
  with "Hide service names in notifications" on (the default) it is a generic line,
  and even with it off only the title is used, cut to 60 characters. A refused
  notification permission leaves the in-app banner in charge.
- **Dashboard**: a **Today and next 7 days** card lists dated items from every
  source with the same aggregation the calendar uses, so the two can never disagree.
- **Backups**: notebook entries are encrypted like every other record and travel in
  the encrypted `.fatorati` backup (**3.2.0**). They are never part of the CSV, PDF
  or Excel exports. Import validation rejects a bad note (type, flags, title, tag
  count/length, date, time, reminder, link caps, body length) before anything is
  written, and a file with more records than the cap is refused; `resetApp` and the
  lock clear notes like everything else.
- **Not in this version**: no rich text, no attachments or images in notes, no
  recurring notes, and notes are deliberately absent from the unencrypted exports.

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

Backup **3.2.0** contains the ten stores (subscriptions and notebook entries included, plus the template snapshot and the optional logo/stamp of the business record), all display/security policy preferences, document currency/language/rates/times/color settings, the default template and a non-secret biometric-enabled flag. No PIN verifier, encryption key or biometric credential is exported. The destination keeps its local PIN; biometric credentials cannot transfer and must be enrolled locally. Replace restores display preferences; Merge uses their `updatedAt`. Imported preferences are committed with records and safely applied from a pending marker after unlock.

Version **1.0.0**, **2.0.0**, **3.0.0** and **3.1.0** JSON and encrypted backups remain importable; a file written before the notebook existed simply gets an empty notes list, everything else untouched. A file written before templates existed upgrades every document to the legacy snapshot, which renders exactly like the pre-template PDF. Migration fills currency/language/time/preferences defaults, preserves IDs/timestamps and quantizes financial amounts. Existing display invoice numbers are not unique identity keys, so records from different phones with the same number can coexist. The UI remains single-business, not a multi-company account manager.

An import uses one transaction spanning **all ten stores plus metadata**, stronger than separate per-store transactions. Encryption is prepared before opening that transaction to avoid IndexedDB auto-close during crypto awaits. A failure leaves the whole import unchanged.

The last-backup Preferences date records successful share handoff, not proof of delivery. Failed/canceled shares reported by Capacitor do not reset it; CSV/PDF/imports do not either. The dashboard reminds after seven days or when no backup has been recorded. Native exports use unique Cache folders and FileProvider; only non-native test/browser execution uses `<a download>`.

## Help & legal (offline, 2.1.0)

Everything a user needs in order to understand the app ships inside it:
**Settings → Help & legal** opens four full-screen pages.

- **Get help** — short intro, a link to the FAQ, a troubleshooting checklist
  (notifications, exports, the lock, backup imports), the support rows and a
  self-service block that jumps to Backup & Restore and shows the notification
  permission status.
- **FAQ** — six topics (Data & security, Backup, Invoices, Tax guide,
  Subscriptions, General) with a search box that works in Arabic, English, French,
  Spanish and Portuguese (case-, accent- and diacritic-insensitive). The content is
  data in `src/lib/faq.ts` held as i18n keys, so every answer is translated in the
  five dictionaries, and every answer was checked against this repository. Answers
  that depend on Android rather than on this code are listed as such in the file
  header.
- **Privacy policy** and **Terms of use** — the full text, rendered from
  `docs/legal/{privacy,terms}.{en,fr,ar}.md`. `scripts/legal-content.mjs` copies
  those files into `src/lib/legal-content.generated.ts`; `pnpm build` runs the
  generator and `tests/help-legal.test.ts` fails if the committed module and the
  markdown differ by one byte, so the app can never carry a second, drifting copy.
  Spanish and Portuguese read the English document with a translated notice
  because `docs/legal` ships English, French and Arabic only.

The same two documents are reachable before the app starts: the onboarding form and
the PIN screen carry small **Privacy policy** / **Terms of use** links that open the
text in a modal dialog. Both pages show a "last updated" line and the app version,
render headings, lists and tables as real elements (no raw HTML, and relative repo
links stay plain text) and add an **Open online version** row only when
`PRIVACY_POLICY_URL` / `TERMS_URL` are configured.

**A problem report never carries business data.** *Report a problem* opens the
device email app with a pre-filled message that contains exactly four values — app
version, Android version, device model and the selected language, read from the
WebView user agent — and a line telling the user not to attach invoices, customers,
the PIN, a backup or logs. *Copy app info* copies the same four lines. This needs
no permission and no `<queries>` entry, and CI now fails if the merged manifest ever
declares a `<queries>` block. The support email row only appears when
`SUPPORT_EMAIL` is set; while it is empty an owner notice appears in development
builds and release builds show nothing.

## License and compliance files

Fatorati is **proprietary software** — see `LICENSE` (all rights reserved: no
copying, redistribution, modification, store distribution or F-Droid packaging
without written permission). Bundled third-party components are listed in
`NOTICE.md` (Capacitor MIT, the biometric plugin MPL-2.0, OFL fonts with their
license texts in `public/fonts/`). User-facing policies live in `PRIVACY.md`
(no data collected, no network permission, uninstall deletes everything) and
`TERMS.md` (as-is, no warranty, not tax or legal advice, no PIN recovery, you own
your backups and the accuracy of your documents) and `SECURITY.md` (disclosure
process, threat model, what the app does not protect
against). Complete Google Play Data safety answers are listed in `PRIVACY.md`;
the console-by-console answers are in `docs/PLAY-CONSOLE-ANSWERS.md` and the
listing copy in `store/`.

**Owner links are configuration, not code.** `src/lib/appConfig.ts` holds the
support address and the policy/terms URLs, all **empty by default**. Settings →
About renders a row only for a value that is filled in *and* plausible, so an
unconfigured build shows no dead contact and no invented URL. Host
`docs/legal/privacy.<lang>.md` publicly and paste that URL there before release.


## Development/build

Requirements: Node 22+, pnpm 10.34.3, **Java 21**, Android SDK platform 36/build tools (AGP 8.13.0, Gradle 8.14.3, minSdk 24, target/compile SDK 36). Configure `ANDROID_HOME` or `android/local.properties`. Build dependencies may require a network connection; the installed app does not.

```sh
pnpm install
pnpm exec tsc --noEmit
pnpm test          # Node tests: security, backup, subscriptions, tax, numbering, limits
pnpm build
pnpm cap:sync android
cd android
./gradlew assembleDebug --stacktrace
```

`pnpm dev` starts the Vite dev server with a development-only CSP relaxation
(the shipped `index.html` keeps `connect-src 'none'`); `pnpm build` output is
unchanged by it. `pnpm preview` serves the production bundle locally.

APK path: `android/app/build/outputs/apk/debug/app-debug.apk`. The retained GitHub Android workflow uses Java 21 and fail-fast install/typecheck/tests/build/sync/Gradle steps. No retries or failure suppression. It also proves that `cap sync` leaves the tracked native files untouched, that the Gradle version agrees with `package.json` and `android/version.properties`, and that the merged release manifest contains no permission outside the documented allowlist (no `INTERNET`, no storage, no exact alarms).

### Release build — signed .aab with your upload key

Release enables R8 `minifyEnabled` and `shrinkResources`; Capacitor bridge/plugin
reflection rules are retained. Play only accepts an **Android App Bundle (.aab)**
for new apps, and the bundle must be signed with your **upload key**.

**1. Versioning.** `package.json` holds `version` (source of truth for
`versionName`) and `android/version.properties` holds `versionCode`. Nothing else
may hard-code them, and CI fails if the Android build disagrees with
`package.json`.

```sh
pnpm version                       # show versionName / versionCode
pnpm version 2.2.0                 # set versionName, versionCode += 1
pnpm version 2.2.0 --code 7        # set both (the code may only increase)
```

**Rule: `versionCode` must increase for every Play upload.** Play rejects an
upload whose `versionCode` is not strictly higher than the last one published, so
always bump it in the same commit as the change you are shipping.

**2. Upload key — outside the repository.** Create it once, with interactive
prompts so no password reaches the shell history:

```sh
keytool -genkeypair -v -keystore "$HOME/fatorati-upload.jks" \
  -alias fatorati -keyalg RSA -keysize 3072 -validity 10000
```

Keep several offline copies of the keystore and passwords: every future update has
to be signed with the same upload key. `*.jks`, `*.keystore` and
`keystore.properties` are ignored by Git, and nothing in this repository contains
key material.

**3. Credentials at build time — environment or `~/.gradle/gradle.properties`.**
`android/app/build.gradle` reads the four values below and, when all four are
present, signs `bundleRelease`/`assembleRelease` with the upload key. When they
are absent the same tasks still build, just unsigned — which is what CI does.
Never commit these, never pass passwords on the command line, and never put them
in CI logs.

```sh
# preferred: environment variables for one build
export FATORATI_KEYSTORE="$HOME/fatorati-upload.jks"
export FATORATI_KEYSTORE_PASSWORD='...'   # from your password manager
export FATORATI_KEY_ALIAS=fatorati
export FATORATI_KEY_PASSWORD='...'

# or, once per machine, keep them out of the repository entirely:
# ~/.gradle/gradle.properties   (fatoratiKeystore, fatoratiKeystorePassword,
#                                fatoratiKeyAlias, fatoratiKeyPassword)
```

**4. Build and verify the signed bundle.**

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit && pnpm test && pnpm audit --audit-level high && pnpm build
pnpm cap:sync android
cd android
./gradlew printVersionInfo --no-daemon   # FATORATI_VERSION_NAME / _CODE / _SIGNED
./gradlew bundleRelease --no-daemon      # -> app/build/outputs/bundle/release/app-release.aab
"$ANDROID_HOME/build-tools/<version>/jarsigner" -verify -verbose -certs \
  app/build/outputs/bundle/release/app-release.aab | tail -5
```

`FATORATI_SIGNED=true` and a `jar verified` line mean the bundle carries your
upload key. Upload that `.aab` to the Play Console (internal testing first).

**5. How Play App Signing fits in.** With Play App Signing, Google holds the
**app signing key** that actually signs what users install; the key you keep is
the **upload key** that authenticates your upload. Result: the upload key can be
reset from the Play Console if it is lost or compromised, and the app signing key
never has to be on your machine. If you ever need a device-installable APK signed
with your own key (for side-loading or QA), build and sign one separately — Play
does not accept APKs whose signature does not match the enrolled upload key:

```sh
./gradlew assembleRelease --no-daemon            # signed when the four values are set
"$ANDROID_HOME/build-tools/<version>/apksigner" verify --verbose \
  app/build/outputs/apk/release/app-release.apk
```

These are instructions, **not a claim that a release build or signing was
executed here**; this sandbox has no Android SDK, so CI builds the artifacts
unsigned and the owner does the signing step on their machine.

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
- The reference's collapsible navy sidebar, module search, grouped navigation, sticky topbar, profile menu and quick-action presentation are adapted to the existing ten offline modules. On phones the sidebar is an accessible modal drawer, not an overflowing bottom navigation strip. Profile actions go to local Settings or lock the vault; they do not introduce accounts or cloud login.
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

Native biometric hardware/enrollment/cancellation and its Activity lifecycle, actual Android background/process-death locking, share-sheet delivery to real apps, first-paint/native splash/status-bar behavior, screenshot/recents protection, and signed release builds have **not** been verified on a device. For the subscriptions tracker and the notebook specifically, the following need a real
device: the `POST_NOTIFICATIONS` prompt and its denied path, whether a scheduled
reminder actually appears (including after battery optimization and a force-stop) and
**at the right local time** for both a timed note and a date-only note (09:00), the
notification tap/foreground behaviour, the Android share sheet for the `.xlsx` and
`.pdf` exports, the on-screen keyboard while writing a long note (the editor is a
full-screen overlay: the keyboard must not cover the buttons or the counter, and
scrolling must keep the caret visible), and the month grid in Arabic RTL on a real
screen (cell order, mirrored arrows, day labels). Browser tests and native-bridge mocks do not establish these. Before distributing: run the build on a Java 21/SDK machine, test all five languages on real screens, background every form/picker/prompt, and transfer a backup between two Android phones. Confirm blocked screenshots, biometric fallback to the PIN, and the PIN/lockout/restore recovery paths.

The source ZIP excludes `.git`, `node_modules`, `dist`, generated Capacitor assets/Cordova scaffolding, local SDK configuration, signing secrets, test artifacts, caches and build outputs. It includes native launcher/splash resources, Android source, Gradle wrapper, lockfile, translations and tests. Build and sync regenerate excluded assets.
