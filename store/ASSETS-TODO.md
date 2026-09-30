# Store assets — what the owner still has to produce

**Nothing in this file was generated for you, and no placeholder image is shipped
in this repository.** Play rejects assets that are obviously fake, and misleading
screenshots are a policy violation, so every screenshot below must be a real
capture of the built app running with sample data.

Sample data means invented values (`Acme SARL`, `Test Customer`) — never a real
customer's name, address, tax number, bank details or invoice number.

## 1. App icon — 512 × 512 PNG

- Format: 32-bit PNG, 512 × 512 px, up to 1 MB.
- Source art already exists in the project: `android/app/src/main/res/mipmap-*/ic_launcher.png`
  and `ic_launcher_foreground.png` (real app artwork, checked in). Export the
  largest variant (or the original vector/design file) at 512 × 512.
- Do not upload the Android adaptive-icon foreground alone; use the square icon
  with its background, as the launcher shows it.
- Google Play also shows a 512 × 512 icon on the listing, and an Android TV banner
  is **not** needed.

## 2. Feature graphic — 1024 × 500 PNG or JPEG

- No transparency, no important text or logo within ~40 px of the edges (Play
  overlays UI there).
- Suggested content: the app name `Fatorati`, a line such as
  "Offline invoices for small business" (English/French/Arabic as needed), and a
  device mock-up made from one of the real screenshots below.
- Budget: one graphic, optionally localised per language.

## 3. Phone screenshots — minimum 2, ideally 6

- Format: PNG or JPEG, 16:9 or 9:16, shortest side ≥ 320 px, longest side ≤ 3840 px.
- Take them on a real device or emulator with the release-style build, sample data
  entered, and the language set to the one you are publishing that listing in.
- Suggested shots (nothing to fake — all of these screens exist):
  1. Dashboard with a few invoices and expenses per currency.
  2. Invoice form with items, tax rate and total.
  3. Invoices list showing statuses (sent, paid, overdue).
  4. Subscriptions with the per-currency totals card.
  5. Tax assistant panel or tax guide page (the one with the "general
     information, not tax advice" line visible).
  6. Settings → About (version, privacy policy and support rows, and the
     tax-assistant disclaimer).
- Keep the status bar clean (no notifications) and do not include real personal
  data anywhere on screen.
- Localise captions if you add them: capture once per language you publish.

## Tablet screenshots (7-inch / 10-inch)

Optional, but recommended: the layout is responsive (`grid-cols-1 lg:grid-cols-2`
in Settings and the panels), so a tablet capture shows the two-column layout.
Same rules as phone screenshots.

## Promo video (optional)

A 30-second screen recording is enough: create an invoice, export the PDF, open
the subscriptions list, show Settings → Security. No voice-over needed; the app's
own labels are on screen.

## Text assets that must be filled in before upload

| Asset | Where it comes from |
|---|---|
| Support email | The address that also goes into `src/lib/appConfig.ts` (`SUPPORT_EMAIL`); today the documents use the `[SUPPORT EMAIL]` placeholder |
| Privacy policy URL | Host `docs/legal/privacy.en.md` (plus the `.fr.md` / `.ar.md` translations) at a public URL and put it in `PRIVACY_POLICY_URL` and in the Play Console form |
| Terms URL (optional) | Host `docs/legal/terms.*.md` and set `TERMS_URL` |
| `[LAST UPDATED]` dates | Replace the placeholder in `PRIVACY.md`, `TERMS.md` and `docs/legal/*` with the publication date |
| Listing copy | `store/listing.en.md`, `store/listing.fr.md`, `store/listing.ar.md` (Spanish and Portuguese listings are still to be written; the app itself already ships in both languages) |
| Console answers | `docs/PLAY-CONSOLE-ANSWERS.md` |

## Checklist before you press "Publish"

- [ ] Icon 512 × 512, feature graphic 1024 × 500, ≥ 2 phone screenshots — all real captures.
- [ ] `SUPPORT_EMAIL`, `PRIVACY_POLICY_URL` and (optionally) `TERMS_URL` set in `src/lib/appConfig.ts`.
- [ ] Privacy policy hosted and reachable in a private browser window; the same URL pasted in the Play Console.
- [ ] `[LAST UPDATED]` placeholders replaced everywhere.
- [ ] Signed `.aab` built with the upload key, `versionCode` higher than the last upload.
- [ ] Merged manifest checked for the documented permission list (see `PRIVACY.md`).
- [ ] Data safety, content rating, target audience and financial-features forms completed as in `docs/PLAY-CONSOLE-ANSWERS.md`.
