# Security policy — Fatorati

## Reporting a vulnerability

Please report security issues privately rather than in a public issue. Use
GitHub's **Report a vulnerability** (Security → Advisories) on the repository, or
the contact address published with the app listing. Include the app version
(Settings → App Info), Android version, device model, and steps or a proof of
concept. We aim to acknowledge within 7 days and to ship a fix or a mitigation
note within 90 days. Please do not test against devices you do not own, and do
not publish details before a fix is available.

## Supported versions

Only the latest published release receives security fixes. Older APKs are not
patched; update from the official channel.

## Threat model (what this app does and does not protect against)

**Designed to protect**

- Someone who picks up the unlocked-but-backgrounded phone, or who browses the
  file system or a synced backup: records are AES-256-GCM encrypted, the vault
  locks on background, and Android's automatic backup/device transfer is
  disabled for this app.
- Someone who obtains a copy of the app's database: they get ciphertext plus a
  PBKDF2-SHA256 (600 000 iterations, random salt) verifier — not your records.
- Someone reading the network: the APK has **no `INTERNET` permission** and the
  page CSP sets `connect-src 'none'`; the app cannot send anything anywhere.
- Shoulder-surfing and screenshots: `FLAG_SECURE` is on by default, blocking
  screenshots, screen recording and the recents preview.

**Not designed to protect against**

- A **rooted or compromised device**, a malicious keyboard/accessibility service,
  a hooked WebView, or physical extraction of a device that is unlocked.
- **Offline brute force** of a 6-digit PIN. Ten thousand attempts is a small
  search space for an attacker who has both the database file and a PC. PBKDF2
  cost and the in-app lockout raise the price, they do not remove this risk — use
  a strong screen lock and keep a password-protected backup.
- **Loss of the phone.** There is no cloud copy. Uninstalling the app, factory
  reset or device loss destroys the records unless you exported a backup.
- **A malicious app that receives a share.** Sharing is an explicit action; the
  receiving app's own security and privacy policy applies from that point.

## Security design notes

- PIN is never persisted; PBKDF2-SHA256 (600 000 iterations, 16-byte random
  salt) is split into an AES key and a verifier. Key material is zeroed on lock.
- Every record is encrypted with a fresh random 96-bit IV; the store name and
  record id are authenticated as additional data, so a record cannot be moved
  between stores or renamed.
- Writes use one IndexedDB transaction with `durability: 'strict'` across all
  stores plus the vault metadata, guarded by a revision check (compare-and-swap)
  so a second WebView cannot overwrite newer data.
- Backup files are AES-256-GCM encrypted with a separate password (minimum 8
  characters, enforced). The header's PBKDF2 iteration count is range-checked on
  import, imports are capped (25 MB, 20 000 records per store, 500 lines per
  document, 10 000 characters per text field) and everything is validated before
  a single write.
- Imported records are quantized to the currency's minor units using integer
  arithmetic, and CSV exports are protected against spreadsheet formula
  injection.
- Staged plaintext exports (CSV/PDF/backup) live only in the app cache and are
  removed at start, after each unlock and by an explicit action in Settings.
- `android:allowBackup="false"` with `dataExtractionRules` excluding every
  domain; WebView debugging disabled; R8 `minifyEnabled` and
  `shrinkResources` on release builds.
- Dependencies: the previously vulnerable biometric plugin
  (`@capgo/capacitor-native-biometric`, authentication bypass
  GHSA-vx5f-vmr6-32wf, fixed in 8.3.6) is pinned to the current 8.x release, and
  CI runs `pnpm audit --audit-level high`. `pnpm-lock.yaml` is committed and CI
  installs with `--frozen-lockfile`.

## Operational guidance for users

1. Set a device screen lock; biometric unlock is only as strong as the device.
2. Choose a backup password of 12+ characters that you do not use elsewhere —
   the backup file is the only copy of your data.
3. Export a backup regularly and keep it somewhere you control. The dashboard
   warns after 7 days without a backup.
4. Leave "Block screenshots and recent-app previews" enabled unless you have a
   specific reason not to.
