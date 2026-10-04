# Bug scan — Fatorati Offline (v2.2.0)

**Status: all three bugs are fixed on this branch (see `CHANGES.md`).** The report
below is kept as the record of the scan - each section marks the fix and the
regression test that now covers it. Probe scripts live in `.tmp/` (git-ignored).

Scope: the whole repo at `b774f995` (React 19 + Vite + Capacitor Android, offline vault).
Method: static reading of `src/**` plus targeted runtime probes — bug 1 through the
app's own data layer (`.tmp/probe2.ts`, `.tmp/probe3.ts`), bug 2 through a React
harness that replicates the Settings effect exactly (`.tmp/rt/harness.mjs`, with a
control), plus audit scripts (`.tmp/check-*.ts`, `.tmp/check-i18n.mjs`). Baseline
before the scan: `pnpm typecheck` clean and `pnpm test` = 306 pass / 0 fail, so
everything below is a **test gap**, not a regression of the current suite.

| # | Severity | Where | Summary |
|---|----------|-------|---------|
| 1 | High (data corruption) | `src/lib/backup-format.ts:469` via `src/lib/db.ts:48,59` | A line discount is dropped from the stored line total on every save and every backup import |
| 2 | High (feature broken) | `src/modules/Settings.tsx:52,69–88,203,211` | “Choose logo” / “Choose stamp” silently does nothing |
| 3 | Medium (wrong default date) | `src/modules/Invoices.tsx:34,52`, `src/modules/Estimates.tsx:128–129,162–163`, `src/modules/Subscriptions.tsx:42` | New documents are dated with the **UTC** day while the rest of the app uses the device's local day |

---

## 1. Line discounts are destroyed on save and on import — FIXED

**What happens.** `normalizeRecord()` re-derives every document line as
`quantity × unitPrice`, ignoring `item.discount`:

```ts
// src/lib/backup-format.ts:469
row.items = row.items.map(item => ({ ...item,
  unitPrice: roundMoney(item.unitPrice, currency),
  total: roundMoney(item.quantity * roundMoney(item.unitPrice, currency), currency) }))
```

That function is not import-only. It is on the normal write path:
`db.add()` / `db.update()` (`src/lib/db.ts:48,59`) → `normalize()` (`src/lib/db.ts:22–31`)
→ `normalizeRecord()`, and also on `importBackup()` (`src/lib/db.ts:82`) and
`exportBackup()` (`src/lib/db.ts:78–79`). The form, meanwhile, correctly computes
`total: lineTotal(item.quantity, item.unitPrice, currency, item.discount)`
(`src/modules/Invoices.tsx:207`, same in `Estimates.tsx`).

**Reproduction (executed).** `.tmp/probe2.ts` saves through the real `db.add()`:

```
form line total : 269.73
form totals     : { subtotal: 269.73, tax: 0, total: 269.73 }
stored item     : {"quantity":3,"unitPrice":99.9,"discount":10,"total":299.7}
stored totals   : { subtotal: 269.73, tax: 0, total: 269.73 }
```

**Impact.**

- The printed PDF shows a Total column built from `item.total`
  (`src/lib/template-render.ts:221`) under a totals block built from `doc.subtotal`
  (`src/lib/template-render.ts:180`), so a discounted invoice doesn't add up. The
  document's own `subtotal/tax/total` stay correct, which makes the contradiction
  visible to the customer.
- Any restore of an exported `.fatorati` file rewrites discounted lines to the
  undiscounted amount.
- Second-order effect on issued documents: `lockedFieldChanged()` compares submitted
  items with stored items field by field (`src/lib/credit-notes.ts:53–69`), so a
  notes-only edit of a sent/paid discounted invoice is rejected with
  “An issued document is locked: … items …”. `.tmp/probe3.ts` prints
  `lockedFieldChanged(notes-only edit): items`. There is no way to edit such an
  invoice in the app.

**Why the suite misses it.** The only discount test (`tests/templates.test.ts:316–335`)
hands `buildDocumentModel` a hand-written `total: 180` and never round-trips a document
through `db.add()`/`normalizeRecord()`. The only `normalizeRecord` tests cover expense
and product fields (`tests/expense-fields.test.ts:33–36`,
`tests/product-inventory.test.ts:24–29`).

**Fix applied.** `normalizeRecord()` now derives the line with `format.lineTotal`
(quantity x unit price less the discount); `template-render.lineAmount()` derives the
printed total from the line itself, so a record written by the old build still adds up;
and `credit-notes.itemsEquivalent()` compares what a line *says* (description, quantity,
price, discount, unit) instead of its derived total, so the form's recomputed total is
no longer mistaken for an edit.
Regression tests: `tests/documents.test.ts` ("a line discount survives every write path
and every backup round-trip"), `tests/templates.test.ts` ("the printed line total is
derived..."), `tests/credit-notes.test.ts` ("the derived line total is not history...").

---

## 2. “Choose logo” / “Choose stamp” in Settings silently discards the picked file — FIXED

**Where.** `src/modules/Settings.tsx:52` (state), `:69–88` (effect), `:203`/`:211`
(buttons); picker in `src/lib/backup-picker.ts:22–29`.

```tsx
const [imageTarget, setImageTarget] = useState<'logo' | 'stamp' | null>(null)
useEffect(() => {
  const receive = () => {
    const file = takePickedLogo()
    const target = imageTarget          // closure value
    setImageTarget(null)                // resets the state the closure needs
    if (!file || !target) return
    ...
  }
  receive()
  return subscribePickedLogo(receive)
}, [imageTarget, updateBusiness])
```

**Sequence.** Clicking “Choose logo” runs `setImageTarget('logo')` + `chooseLogoFile()`.
The effect re-runs (its dependencies changed), `receive()` executes immediately with
no file picked yet and resets `imageTarget` to `null`, which re-runs the effect once
more; the listener subscribed for the file dialog is therefore the one whose closure
reads `target === null`. When the OS picker finally fires `change`
(`backup-picker.ts:27`), the closure calls `takePickedLogo()` — consuming and clearing
the file — then returns at `if (!file || !target)` (`Settings.tsx:74`). **No image, no
alert, nothing.**

`Onboarding.tsx:51–54` uses the same picker but has no target state, which is why logo
import looks healthy during first-run setup. No test covers `chooseLogoFile`,
`takePickedLogo` or this effect (grep over `tests/` is empty).

**Reproduction (executed).** `.tmp/rt/harness.mjs` mounts this effect chain with
`react-test-renderer`, taps the button, then delivers the file the way
`backup-picker.ts:27` does:

```
exact Settings pattern (reset inside receive): {"applied":[],"listenersAfterTap":1}
control (no reset inside receive):            {"applied":["logo:logo.png"],"listenersAfterTap":1}
```

The control (identical code minus `setImageTarget(null)`) applies the file, which
shows the harness would catch a working implementation.

**Fix applied.** `chooseLogoFile(target)` carries the target and `takePickedLogo()`
returns `{ file, target }` - the same shape the backup picker uses for its import mode -
so the listener holds no state at all; Settings dropped `imageTarget` entirely. Logo
picks also got their own listener set, so they no longer wake the backup listeners.
Regression test: `tests/image-picker.test.ts`.

---

## 3. New documents default to the UTC calendar day (the app otherwise uses the local day) — FIXED

`new Date().toISOString().slice(0, 10)` returns the UTC date, while everything else
uses `todayISO()` (`src/lib/subscriptions.ts:68–75`), which returns the device's local
calendar date — lists and overdue badges (`status.ts:25,33,89`), reminders,
cash-flow, the calendar, and document numbering (`fatorati.ts:25` uses
`date.getFullYear()`, i.e. the **local** year).

Sites: `src/modules/Invoices.tsx:34` (issueDate) and `:52` (dueDate), `:284`
(credit-note issue date); `src/modules/Estimates.tsx:128–129` and `:162–163`;
`src/modules/Subscriptions.tsx:42` (startDate); fallback in `src/lib/status.ts:62`;
sample preview in `src/lib/template-render.ts:305` (cosmetic).

**Impact.** For any time zone ahead of UTC the default is yesterday's date from local
midnight until local time = UTC offset (1 h/day in Morocco, 8 h/day in Tokyo); for
zones behind UTC it is tomorrow's date in the evening. Around 31 December the
`PREFIX-YYYY` document number (local year) disagrees with the issue date (UTC day) —
e.g. `INV-2026-0001` dated `2025-12-31`. File names built the same way (`csv.ts:47`,
`db.ts:120`, `subscription-export.ts:124,235`) are cosmetic.

**Fix applied.** Every site now uses `todayISO()` (the device's local calendar day) and
`dueDateFromTerms(issueDate, days)` for the due/expiry arithmetic, including the export
file names. Regression tests: `tests/due-days.test.ts` ("a due date is issue date + days
on the calendar...") plus a source audit that rejects `new Date().toISOString().slice(0, 10)`
as a date default anywhere in `src/`.

---

## Checked and clean (no defect found)

- **i18n**: every literal key used in `src/**` exists in `en.json`; all five
  dictionaries have the same 1 148 keys; no empty values; no `{placeholder}`
  mismatches between languages (`.tmp/check-i18n.mjs`).
- **Product option maps**: every billing/duration/format/renewal value has a label and
  every label exists in `en.json` (`.tmp/check-product-labels.ts`).
- **Sort mutation audit**: every `.sort(` in `src/` operates on a fresh array
  (`chart-data.ts:25`, `notes.ts:201`, `notifications.ts:136,197,279`,
  `subscriptions.ts:224`, `Subscriptions.tsx:154`) — no store array is mutated in place.
- **Rest of the code**: the vault/storage/cache layer (PBKDF2 600 k, AES-GCM with AAD,
  revision CAS, lock epoch), the money math (BigInt minor units, half away from zero),
  payments/credit notes, reports/cash-flow, notes and notes-draft,
  calendar/chart-data/text-search, images/share-file, backup validation/migration, the
  Android shell (manifest, `MainActivity`, `ScreenSecurityPlugin`) and every module and
  component in `src/` were read (a few large JSX tails were skimmed rather than read
  line by line). No other defect was confirmed. Items in `REVIEW-NEEDED.md` are
  owner/legal verification tasks (tax text, store assets, support address) and are
  deliberately not treated as code bugs.

## Smaller observations (not filed as bugs)

- ~~`subscribePickedLogo` is a literal alias of `subscribePickedBackup`~~ - fixed as
  part of bug 2: logo picks now have their own listener set.
- The manual exchange-rate field (`DocumentOptions.tsx:12`) accepts `0` (the truthiness
  test lets the string `'0'` through) while `db.ts:28` rejects `exchangeRate <= 0` with
  the generic message “Invalid amount”. The user gets a vague error for a value the UI
  offered; either reject it in the field or treat 0 as “no rate”.

## Not covered by this scan

- No Android build/run (no JDK/SDK here) and no browser run: `tests/browser-check.mjs`
  needs a Playwright Chromium download (`playwright install chromium`), which was not
  performed. Both would be worth a pass after the fixes above — especially a UI test
  for fix #2.

*Probes live in `.tmp/` and can be re-run with `npx tsx .tmp/probe2.ts` (bug 1),
`npx tsx .tmp/probe3.ts` (bug 1, locked-edit consequence), `node .tmp/rt/harness.mjs`
(bug 2, from the scan, before the fix),
`node .tmp/check-i18n.mjs` (i18n audit).*
