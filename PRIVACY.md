# Privacy Policy — Fatorati (offline)

**Last updated: 2026-09-30** · This policy describes the Android app **Fatorati**
(`com.fatorati.app`). Host this file (or a page with the same content) at a public
URL for the app store listing.

## Summary

Fatorati is an offline invoicing and small-business manager. **We do not collect,
transmit, sell or share any personal data. There is no account, no analytics, no
advertising and no tracking.** The app is built without the Android `INTERNET`
permission, so it cannot open a network connection at all — not for updates, not
for fonts, not for crash reports.

## What is stored, and where

Everything you enter (business details, customers, projects, invoices, estimates,
expenses, products, settings) is stored **only on your device**, inside the app's
private storage (IndexedDB), encrypted with AES-256-GCM. The encryption key is
derived from the 6-digit PIN you create, using PBKDF2-SHA256 (600 000 iterations,
random salt). The PIN itself is never stored. If you enable biometric unlock, a
copy of the encryption key is kept in the Android Keystore-backed credential
storage of the biometric plugin and can only be released after a successful
biometric prompt.

The only other local storage is non-secret display configuration (language,
theme, accent colour, date/time format, time zone, first day of week, digits,
spacing, auto-lock delay, screenshot-protection state, last-backup date) kept in
Android `SharedPreferences`/`localStorage` so the app can paint correctly before
unlocking.

## Data we collect

**None.** We do not operate a server that receives your data, and the app has no
code path that sends data anywhere. We do not use third-party SDKs for analytics,
crash reporting, advertising or attribution.

## Sharing and exports

Sharing is always an explicit action you take:

- **Backup export** writes an encrypted `.fatorati` file (AES-256-GCM with a
  password you choose) to the app cache and hands it to the Android share sheet.
  You decide which app receives it.
- **CSV export** writes a plaintext CSV file the same way.
- **PDF export** renders the invoice or estimate locally with bundled fonts and
  shares the resulting file the same way.
- **Android's file picker** is used to import a backup you select.

Once a file leaves the app through the share sheet, the receiving app or service
applies its own privacy policy — for example, sending it by email or cloud drive
uploads it to that provider. The app itself never uploads anything.

## Retention and deletion

Your data stays until you delete it. **Uninstalling the app deletes all records
and the encryption key** — there is no remote copy and no recovery without a
backup file you exported yourself. Android automatic backup and device-to-device
transfer are disabled for this app (`allowBackup=false` plus explicit
`dataExtractionRules` exclusions), so your vault is not copied into Google Drive
by the system.

- Settings → Security → **Reset app** deletes all records, the PIN verifier,
  biometric credentials, preferences and cached export files after two
  confirmations.
- **Clear temporary files** (Settings → Security) removes staged export files
  from the app cache. The app also clears them automatically when it starts and
  after each unlock.

## Permissions

- `USE_BIOMETRIC` — optional biometric unlock (only active if you enable it).
- No network, storage, location, contacts, camera, microphone or advertising
  permissions are requested. The app declares no `INTERNET` permission.

## Children

The app is a business tool and is not directed at children. It collects no
personal data from anyone.

## Compliance notes for store listings

When filling in Google Play's Data safety form, the correct answers for this app
are: *no data collected*, *no data shared*, data is *encrypted in transit* — not
applicable (no transmission), users can request deletion — *not applicable, data
never leaves the device and uninstalling removes it*.

## Changes

If this policy ever changes, the new version will be published in this file and
in the app's release notes. Because the app cannot fetch anything from the
network, a copy of this policy is also shipped with the application source.

## Contact

Questions or requests: open an issue on the repository (`p4xre1/APP`) or use the
contact address published with the app listing.
