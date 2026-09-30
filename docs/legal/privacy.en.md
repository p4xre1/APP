# Privacy Policy — Fatorati (offline)

**Last updated: [LAST UPDATED]** · This policy describes the Android app
**Fatorati** (`com.fatorati.app`). This is the English text; it is identical in
substance to [`privacy.fr.md`](privacy.fr.md) and [`privacy.ar.md`](privacy.ar.md),
and it mirrors the canonical [`PRIVACY.md`](../../PRIVACY.md) at the repository
root. Host one of these files at a public URL for the app store listing.

## Summary

Fatorati is an offline invoicing and small-business manager. **We do not collect,
transmit, sell or share any personal data. There is no account, no analytics, no
advertising and no tracking.** The app is built without the Android `INTERNET`
permission, so it cannot open a network connection at all — not for updates, not
for fonts, not for crash reports. The Content-Security-Policy it ships is
`connect-src 'none'`, so the web layer cannot make a request either.

## What is stored, and where

Everything you enter (business details, customers, projects, invoices, estimates,
expenses, products, subscriptions, ideas, notes, tasks, settings) is stored **only on
your device**, inside the app's private storage (IndexedDB), encrypted with AES-256-GCM. The
encryption key is derived from the 6-digit PIN you create, using PBKDF2-SHA256
(600 000 iterations, random salt). The PIN itself is never stored as a key or a
password: only a verifier is kept, so a forgotten PIN cannot be recovered.

If you enable biometric unlock, a copy of the encryption key is kept in the
Android Keystore-backed credential storage of the biometric plugin and can only
be released after a successful biometric prompt.

The only other local storage is non-secret display configuration (language,
theme, accent colour, date/time format, time zone, first day of week, digits,
spacing, auto-lock delay, screenshot-protection state, last-backup date) kept in
Android `SharedPreferences`/`localStorage` so the app can paint correctly before
unlocking.

## What is on screen when you leave it

Screenshots and recent-app previews are **blocked by default** through Android's
`FLAG_SECURE`, so the app's content does not appear in the recent-apps thumbnail
or in a screen recording. You can turn this off in Settings → Security; the choice
is stored locally and applies immediately.

## Data we collect

**None.** We do not operate a server that receives your data, and the app has no
code path that sends data anywhere. We do not use third-party SDKs for analytics,
crash reporting, advertising or attribution.

## Sharing and exports

Sharing is always an explicit action you take:

- **Backup export** writes an encrypted `.fatorati` file (AES-256-GCM with a
  password you choose) to the app cache and hands it to the Android share sheet.
  You decide which app receives it.
- **CSV, PDF and Excel exports** are written the same way.

**Exported files are not encrypted** (except the `.fatorati` backup). Anyone with
access to the file — or to the app or service you send it to — can read the
invoice, customer and subscription data inside it. The app warns about this in
every export screen; delete exported files when you are done with them. Staged
copies live in the app's private cache and are removed at the next app start,
after each unlock, or from Settings → Security → "Clear temporary files".

- **Android's file picker** is used to import a backup you select.

Once a file leaves the app through the share sheet, the receiving app or service
applies its own privacy policy — for example, sending it by email or cloud drive
uploads it to that provider. The app itself never uploads anything.

## Retention and deletion

Your data stays until you delete it. **Uninstalling the app deletes all records
and the encryption key** — there is no remote copy and no recovery without a
backup file you exported yourself. Android automatic backup and device-to-device
transfer are disabled for this app (`allowBackup=false`, `fullBackupContent=false`
plus explicit `dataExtractionRules` exclusions for every domain), so your vault is
not copied into Google Drive by the system.

- Settings → Security → **Reset app** deletes all records, the PIN verifier,
  biometric credentials, preferences and cached export files after two
  confirmations.
- **Clear temporary files** (Settings → Security) removes staged export files
  from the app cache. The app also clears them automatically when it starts and
  after each unlock.

## Notebook and calendar reminders

Notes, tasks and the calendar live in the same encrypted vault as every other
record, and they are included in the encrypted `.fatorati` backup only. A reminder
is a local Android notification: it never leaves the device. By default its text is
generic ("Note reminder"), so no note content appears on the lock screen or in the
notification shade; the app also keeps "Hide service names in notifications" on.
Notifications are inexact, the app never asks for the exact-alarm permission, and
refusing the notification permission only means reminders stay silent and the app
shows an in-app banner.

## Permissions

This is the complete list of permissions the app ships. It is enforced by CI,
which fails the build if the merged Android manifest contains anything outside
this list (`Verify the merged release manifest permissions` in
`.github/workflows/android-apk.yml`).

| Permission | Why it is there |
|---|---|
| `android.permission.POST_NOTIFICATIONS` | Optional subscription reminders. Requested only when you enable reminders in Settings, never at app start. |
| `android.permission.RECEIVE_BOOT_COMPLETED` | Lets the notification plugin restore your pending reminders after the phone restarts. It is not used to start anything by itself. |
| `android.permission.WAKE_LOCK` | Lets the notification plugin wake the device briefly to show a reminder you scheduled. |
| `android.permission.USE_BIOMETRIC` | Optional biometric unlock (only active if you enable it). |
| `android.permission.USE_FINGERPRINT` | Declared by the AndroidX Biometric library the app uses for the same optional unlock. It is deprecated in modern Android and no fingerprint data is read by the app. |
| `com.fatorati.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | A signature-level permission the Android build tool declares for the app's own internal (non-exported) broadcast receivers. It grants nothing to anyone else and is never requested from you. |

**Not requested:** no `INTERNET`, no `READ_EXTERNAL_STORAGE`/`WRITE_EXTERNAL_STORAGE`
or `MANAGE_EXTERNAL_STORAGE`, no `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` (the
notification plugin declares the exact-alarm permission and the app removes it
with `tools:node="remove"`, because reminders are deliberately inexact), no
location, camera, microphone, contacts, SMS, call log, calendar, activity
recognition or advertising-ID permission.

Files are shared through a `FileProvider` restricted to the app's own export
folder rather than through storage permissions, so no storage access is needed.

## Children

The app is a business tool and is not directed at children. It collects no
personal data from anyone.

## Compliance notes for store listings

When filling in Google Play's Data safety form, the correct answers for this app
are: *no data collected*, *no data shared*, data is *encrypted in transit* — not
applicable (no transmission), users can request deletion — *not applicable, data
never leaves the device and uninstalling removes it*.

## Changes

If this policy ever changes, the new version will be published in this file, in
`PRIVACY.md` and in the app's release notes. Because the app cannot fetch anything
from the network, a copy of this policy is also shipped with the application
source.

## Contact

Questions or requests: **[SUPPORT EMAIL]** (published with the app listing).
