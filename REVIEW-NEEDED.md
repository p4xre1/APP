# Items a human must verify before release

Everything in this file was implemented from the work order of 2026-09-30. None
of it is invented, but each entry is either a legal value that must be confirmed
against the current official text, or a translated legal/accounting term that a
native reviewer should approve. **The app ships these as information, never as
advice**, and the tax guide keeps its "general information, not tax advice"
disclaimer and its "Last reviewed" date.

## Tax guide figures (Morocco)

| Item | Value shipped | Verify against |
|---|---|---|
| Auto-entrepreneur ceiling, services | 200,000 DH / year | CGI / Law 114-13, current Finance Law |
| Auto-entrepreneur ceiling, commerce-industry-artisanat | 500,000 DH / year | CGI / Law 114-13, current Finance Law |
| Auto-entrepreneur flat tax | 1% services, 0.5% others | CGI, current Finance Law |
| Single-client rule | **Re-audited 2026-09-30:** shipped as settled law — for services, 30% withholding at source by the client on the excess above 80,000 DH/year from one same professional client, in force since the 2023 finance law. Secondary sources cite Art. 73-II-G-8° CGI; confirm the exact article and whether any non-service case is caught | CGI Art. 73, LF 2023 text on tax.gov.ma |
| Payment deadlines | 60 days default / 120 days max by contract / up to 180 days by regulated sector derogation, B2B only, period from end of month of delivery when the invoice is missing or late, Treasury fine based on the BAM policy rate and growing monthly, periodic declarations, applies above 2M DH turnover. The precise fine formula (policy rate the first month + 0.85% per further month per secondary sources) is **not shipped as a figure** — confirm in the decree before ever printing it | Law 69-21 and its decrees, DGI/SIMPL notices |
| Record keeping | **Verified 2026-09-30 against the CGI text:** 10 years (Art. 211); lost document reported by registered letter within 15 days, 30 in force majeure (LF 2018 wording) | Art. 211 / 211 bis CGI |

## Tax guide figures (United States)

| Item | Value shipped | Verify against |
|---|---|---|
| 1099-NEC/1099-MISC threshold | **Re-verified 2026-09-30:** 2,000 USD for payments after 31 Dec 2025 (OBBBA §70433 amending IRC §6041(a)/§6041A(a)(2)), inflation-indexed from 2027. Guide now adds that other 1099 categories keep their own thresholds (royalties, attorney payments) without printing those figures | OBBBA (PL 119-21), IRS form instructions |
| 1099-K threshold | **Re-verified 2026-09-30:** more than 20,000 USD and more than 200 transactions (federal TPSO rule); guide notes a platform may report below it and some states set lower limits, without listing states | IRS Fact Sheet 2025-08, state rules |
| Sales-tax sourcing | Shipped as "depends on the state and the transaction - destination, origin or mixed"; no per-state list shipped | Each state's tax authority |
| Sales-tax record retention | Shipped as "each state sets its own period, commonly three to five years from the return, longer or unlimited after fraud or a missing return"; federal shipped as "usually three years, longer in several situations, employment-tax records four" | State statutes, IRS recordkeeping guidance |

## Legal/tax accuracy audit of 2026-09-30 — items an accountant should confirm

Every material statement in `src/lib/taxGuide.ts` was re-checked on 2026-09-30
(the `TAX_GUIDE_LAST_REVIEWED` date was kept only after that check). Items the
official sources available to this audit could not fully settle:

- **Auto-entrepreneur TVA characterization (MA).** The app prints
  "TVA non applicable" for the auto-entrepreneur preset, which matches the
  wording Moroccan practice recommends. Secondary sources disagree on the
  underlying basis: "hors champ d'application de la TVA" (outside the scope)
  versus "exonéré sans droit à déduction, Art. 91-II-3° CGI". The guide now
  says "outside the scope" and recommends adding the status to the mention;
  an accountant should confirm the characterization and whether the mention
  should cite an article. Do NOT copy the French "article 293 B du CGI"
  wording — that is France's CGI, not Morocco's.
- **TP identifier on auto-entrepreneur invoices (MA).** The MA template block
  demands ICE, IF, TP (and CNIE for the exempt preset) and flags an empty TP
  as "missing". Auto-entrepreneurs are commonly described as outside the
  taxe professionnelle; confirm whether a TP number should be demanded on
  their invoices, and relax `mandatoryFields` if not. (Not changed in the
  audit: it is a behaviour change, not a wording fix.)
- **Law 69-21 fine formula (MA).** Secondary sources state: unpaid amount
  incl. tax × (BAM policy rate for the first month + 0.85% per additional
  month), with declaration fines of 5,000–250,000 MAD. The guide ships only
  the qualitative statement; confirm the figures in the decree before ever
  printing them.
- **E-invoicing (MA).** As of 2026-09-30 the implementing decree of
  Art. 145-IX CGI was still unpublished (announced rollout starting with
  large businesses; clearance model reported). The guide states the
  announcement, states no date, and now warns that an offline PDF alone may
  not satisfy an electronic submission/validation duty. Re-check the DGI and
  the Bulletin Officiel; update the guide when the decree is published.
- **Moroccan tax deadlines (VAT filing/payment, AE quarterly declarations,
  income tax).** Deliberately NOT shipped: the guide contains no filing
  calendar, and none was added because this audit could not verify one
  against a primary source. If the owner wants deadlines in the guide, an
  accountant must supply them from the current CGI/DGI calendar.

## Arabic / French terminology to approve (native reviewer)

- FR "auto-entrepreneur", "impôt forfaitaire", "lettre recommandée", "Trésor",
  "loi 69-21" — wording of the new guide bullets in `src/i18n/fr.json`.
- AR "المقاول الذاتي", "ضريبة دخل جزافية", "رسالة مضمونة", "الخزينة",
  "آجال الأداء (القانون 69-21)" — wording of the new guide bullets in
  `src/i18n/ar.json`.
- ES/PT renderings of the same bullets (checked for meaning, not legal usage,
  since the guide only covers MA and US).

## Payment-terms hint (task 1.8) — MA legal wording to approve

Shown under the due-date field of an invoice when the tax region is MA. It is
advisory only and never blocks saving. Please have a native reviewer confirm
the fr/ar phrasing against Law 69-21 before release:

Revised during the 2026-09-30 accuracy audit: both hints now say « entre
entreprises » (Law 69-21 is B2B) and the >120 hint mentions the regulated
sector derogations instead of presenting 120 days as absolute.

- FR (>60 days): « Cette date d'échéance dépasse de plus de 60 jours la date
  d'émission. Au Maroc, entre entreprises, les délais au-delà de 60 jours
  doivent être convenus par écrit ; le maximum contractuel est de 120 jours. »
- FR (>120 days): « Cette date d'échéance dépasse de plus de 120 jours la date
  d'émission. Au Maroc, entre entreprises, 120 jours est le délai de paiement
  maximal qu'un contrat peut fixer, hors dérogations sectorielles encadrées. »
- AR (>60): «تاريخ الاستحقاق هذا يتجاوز 60 يوماً بعد تاريخ الإصدار. في المغرب،
  بين المقاولات، ينبغي الاتفاق كتابياً على الآجال التي تتجاوز 60 يوماً؛ والحد
  الأقصى التعاقدي هو 120 يوماً.»
- AR (>120): «تاريخ الاستحقاق هذا يتجاوز 120 يوماً بعد تاريخ الإصدار. في
  المغرب، بين المقاولات، 120 يوماً هو أقصى أجل أداء يمكن أن يحدده العقد،
  باستثناء الاستثناءات القطاعية المنظمة.»

## Credit-note document title (task 2.1) — MA legal wording to approve

Credit notes print with the translated title of the `Credit note` key. Please
have a native reviewer confirm the printed titles before release:

- FR: « Avoir » (the usual Moroccan/French commercial term for a credit note).
- AR: «إشعار دائن». Alternative sometimes used: «فاتورة دائنة». Confirm which
  wording Moroccan accountants expect on the printed document.
- ES «Nota de crédito» / PT «Nota de crédito» are generic renderings; the app
  only claims legal terminology for MA (fr/ar).

The default number-series prefix is `AV` (from « avoir »), configurable in
Settings → Document numbering and tax.

## Tax summary screen (Reports)

Added 2026-09-30 (task 2.9). The "Tax summary (estimate)" card computes, per
period and currency: settled sales excluding tax, tax collected on those
sales, purchases excluding recorded tax, deductible tax recorded on expenses,
and the net position (collected − deductible). Points a reviewer should
confirm:

- Basis: the summary is CASH-BASIS (documents counted when settled, on their
  paid date). Morocco allows régime des encaissements (default) and régime
  des débits; US sales-tax timing varies by state. The screen never claims a
  regime — it is labelled an estimate to verify with an accountant. Confirm
  this wording is sufficient.
- Deductibility: the app sums whatever tax the user recorded on expenses and
  calls it "deductible tax recorded" — it never decides what is legally
  deductible (Morocco restricts deduction for some expense kinds). Confirm
  the label cannot be read as legal advice.
- Translations of "Tax summary (estimate)" and the disclaimer exist in all 5
  languages; the fr/ar wording should be checked by a Moroccan accountant.

## Legal documents (task 3.2)

- `[LAST UPDATED]` and `[SUPPORT EMAIL]` in TERMS.md / PRIVACY.md /
  docs/legal/* are OWNER items: fill them when publishing (the app renders
  "Date not set" and hides the contact row until then). Not invented here.
- GOVERNING LAW: the terms contain no governing-law / jurisdiction clause.
  Deciding it (e.g. Moroccan law, courts of Tangier) is a legal choice the
  owner must make with counsel - the app must not invent it. Once decided,
  add the clause to docs/legal/terms.{en,fr,ar}.md and run `pnpm legal:build`.
- Onboarding now shows a consent sentence ("By continuing you accept the
  terms of use and acknowledge the privacy policy:") above the two document
  links, in all five languages. Confirm this passive-consent wording is
  acceptable, or whether an explicit checkbox is preferred.

## Open owner decisions

- Confirm `TAX_GUIDE_LAST_REVIEWED` stays `2026-09-30` (the content above was
  re-checked on that date against the sources listed in the work order).
