# Google Play Console — answers for Fatorati

Everything below is a copy-paste answer sheet for the Play Console, written against
what the code in this repository actually does. Where an answer depends on a
business decision the owner has to make (pricing, target countries, category), that
is stated instead of guessed. **Nothing here is invented**: every permission,
storage location and behaviour named in these answers exists in the source, and
every value that is still missing is marked `[SUPPORT EMAIL]` or `[PRIVACY URL]`
for the owner to fill in.

- Package name: `com.fatorati.app`
- Version: see `package.json` (`versionName`) and `android/version.properties` (`versionCode`)
- Distribution: **free, no in-app purchases, no ads, no account, works offline**

---

## 1. App access (reviewer instructions)

The app has no login, no server and no account. A reviewer only needs to create a
local PIN once:

> **No credentials or accounts are needed.** On first launch the app asks you to
> create a local **6-digit PIN** — enter any six digits you can remember (for
> example `135790`) and confirm it. The PIN never leaves the device and is not
> checked against any service. You are then asked for a business name and an owner
> name — both can be test values such as `Test Business` and `Test Owner`; the
> phone, email and address fields are optional. After that, every screen is
> reachable: create an invoice in **Invoices → New invoice**, add a subscription in
> **Subscriptions**, and open **Settings** for security, backup, preferences, the
> tax assistant and the About card.

- **No location, camera or notification permission is requested at launch.** The
  notification permission is only requested after a tap on "Enable reminders" in
  Settings → Subscriptions, so it will not appear in a normal review session.
- Biometric unlock is **off by default** and only offered after the user turns it
  on in Settings, so a reviewer is never locked out.
- If a reviewer forgets the PIN, the data cannot be recovered (that is a design
  property of the local-only vault) — the two options are to enter the right PIN or
  to clear the app's data.

---

## 2. Data safety

Play's Data safety form asks about data collected and shared. For this app the
answers are all "no" because nothing ever leaves the device.

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | Not applicable — no data is transmitted. |
| Do you provide a way for users to request that their data is deleted? | The app has no account. Data is deleted by the user at any time (**Settings → Security → Reset app**) or by uninstalling the app. |
| Does your app use third-party advertising or analytics SDKs? | **No** |
| Data safety form section "Data types" | Leave every category at *not collected* / *not shared* |

Facts this answer rests on, all verifiable in this repository:

- The Android manifest does **not** request `INTERNET`; the release build's merged
  manifest is checked in CI against an allowlist that fails on any network
  permission (`.github/workflows/android-apk.yml`).
- The shipped Content-Security-Policy keeps `connect-src 'none'`, so the web layer
  cannot issue a request either (`index.html`, asserted by `tests/`).
- The only data the app stores is what the user types (business details, customers,
  invoices, estimates, expenses, products, subscriptions), kept in the app's private
  IndexedDB, encrypted with AES-256-GCM under a key derived from the user's PIN
  (PBKDF2-SHA256, 600 000 iterations, random salt).
- Sharing happens only when the user picks a share target in Android's share sheet;
  the app itself never uploads anything.

## 3. Government apps

**No.** This app is not developed by or on behalf of a government, and it makes no
government-related claim. The tax guide is general information (see the disclaimer
in §7), not an official publication, and the app says so in the guide itself, in
`TERMS.md` and in Settings → About.

## 4. Financial features

Play's Financial features declaration for this app:

| Question | Answer |
|---|---|
| Does your app provide personal loans? | No |
| Does your app provide or facilitate money transfers, payments or digital wallets? | No — it never moves money and has no payment integration |
| Does your app provide cryptocurrency features? | No |
| Does your app provide investment or trading features? | No |
| Does your app provide financial advice or planning? | No |

The app is a bookkeeping tool: it creates invoices, estimates, expense records and
a subscriptions list. It has no payment link, no bank connection, no card data and
no currency exchange — totals are arithmetic on numbers the user typed.

## 5. Content rating questionnaire (IARC)

Suggested answers; the honest answer to every violence, sex, language, drugs,
gambling and user-generated-content question is **no**:

| Category | Answer |
|---|---|
| Violence, blood, sexual content, nudity, profanity, drugs, alcohol, tobacco | No |
| Gambling (real or simulated) | No |
| Horror/fear elements | No |
| Users can interact or exchange content with other users | No — the app has no chat, no social features, no other users |
| Shares the user's location | No — no location permission exists |
| Allows users to share personal information with third parties | Only what the user explicitly shares through the Android share sheet (a PDF, CSV or encrypted backup file they choose to send) |
| Digital purchases / in-app purchases / loot boxes | No |
| Contains advertising | No — the app contains no ads of any kind |
| Unrestricted internet access | No — the app has no internet access at all |
| Miscellaneous: does the app provide medical, legal or financial advice? | No. It ships general tax information with a visible "not tax advice" disclaimer |

Expected outcome: a low rating (typically **Everyone / 3+** or the local equivalent),
with no "financial products", "gambling" or "user interaction" descriptors.

## 6. Target audience and content

- **Target age group: adults (18 and over).** The app is a business tool; it is not
  designed for or directed at children.
- *Appeals to children*: **No**. Do not select any age band below 18 in the "Target
  audience and content" section, and do not enroll in the Families programme.
- Store listing content (title, description, screenshots) contains no child-directed
  imagery or characters.

## 7. Store listing declarations and justifications

- **Ads:** "My app does not contain ads."
- **News app:** No.
- **COVID-19 contact tracing:** No.
- **Health apps:** No.
- **Data deletion URL:** not required (no account, no collected data). If the form
  insists on a URL, host the privacy policy (§8) and use that.
- **Privacy policy URL:** `[PRIVACY URL]` — host `docs/legal/privacy.en.md` (or the
  French/Arabic version) publicly and paste the URL. Play requires a reachable URL
  even for an app that collects nothing.

**Permission justifications** (Play asks for the ones it considers sensitive; none
is requested at launch or used for tracking):

| Permission | Declaration text |
|---|---|
| `POST_NOTIFICATIONS` | "Used only for the user's own subscription reminders. The permission is requested after the user taps 'Enable reminders' in Settings — never at app start — and the app works fully without it." |
| `USE_BIOMETRIC` | "Used to unlock the app with the device's biometric credential when the user enables that option in Settings. Off by default; the app is also usable with the 6-digit PIN alone." |
| `USE_FINGERPRINT` | "Declared by the AndroidX Biometric library for the same optional unlock. No fingerprint data is read or stored by the app." |
| `RECEIVE_BOOT_COMPLETED` | "Lets the notification plugin restore the user's already-scheduled reminders after a device restart. It starts nothing by itself." |
| `WAKE_LOCK` | "Lets the notification plugin wake the device briefly to show a reminder the user scheduled." |
| `com.fatorati.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | "Signature-level permission declared by the Android build tool for the app's own internal broadcast receivers. It grants nothing to other apps." |

Not present, if asked: **no** `INTERNET`, **no** storage permissions, **no**
`SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` (removed explicitly with
`tools:node="remove"` because reminders are deliberately inexact), **no** location,
camera, microphone, contacts, SMS, call log, calendar or advertising-ID permission.
The exact list ships in `PRIVACY.md` and is enforced in CI.

## 8. Suggested store settings

| Field | Suggestion |
|---|---|
| Category | **Business** (a Finance listing also fits; the app is a bookkeeping tool, not a financial service) |
| Tags | Invoicing, small business, offline, bookkeeping |
| Contains ads | No |
| In-app purchases | No |
| Price | Free |
| Countries | Owner's decision; the app ships Arabic, English, French, Spanish and Portuguese, and its tax guide currently covers Morocco, the United States, France, Spain and Portugal (no country is excluded by the code) |
| Contact email | `[SUPPORT EMAIL]` — the address that also goes into `src/lib/appConfig.ts` |
| Privacy policy | `[PRIVACY URL]` — the hosted copy of `docs/legal/privacy.en.md` |

## 9. Before the first upload — owner checklist

1. Fill in `[SUPPORT EMAIL]` in `PRIVACY.md`, `TERMS.md`, `docs/legal/*` and in
   `src/lib/appConfig.ts` (`SUPPORT_EMAIL`), and host the privacy policy; put its
   URL in `PRIVACY_POLICY_URL` (and the terms URL in `TERMS_URL`).
2. Replace `[LAST UPDATED]` in those documents with the publication date.
3. Produce the store assets listed in `store/ASSETS-TODO.md` (icon, feature
   graphic, screenshots with sample data — never fake screenshots of features that
   do not exist).
4. Build a **signed** `.aab` with the upload key (see the README section "Release
   build — signed .aab with your upload key"), make sure `versionCode` in
   `android/version.properties` is higher than any previously upload, and upload the
   artifact produced by `./gradlew bundleRelease`.
5. Complete the forms above in the Play Console, then check the Play-generated
   "pre-launch report" and the store listing preview.
