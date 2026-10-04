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

## Construction law & tax additions of 2026-10-03

The construction content shipped on 2026-10-03 (`Construction and public works` for
MA, `Contractors and construction` for US) and the US 1099-NEC card in Reports were
compiled from public sources on that date, not from a primary legal text held by the
project. Each row below names what was shipped and what an accountant or a native
reviewer should confirm before release. The guide still says "general information,
not tax advice" and keeps its dated `Last reviewed`.

| Item | Value shipped | Verify against |
|---|---|---|
| MA construction TVA | 20% standard; only two rates since 1 Jan 2026 (20% / 10%); conventional social housing exempt within price and surface caps | CGI art. 92-I-28°, art. 99; Finance Law 50-25 |
| MA retenue de garantie | 10% of each interim payment, capped at 7% of the initial contract amount plus amendments; replaceable by a personal and solidary surety; released by mainlevée after réception définitive | Dahir 1-56-211 and Circulaire 72-CAB (1992); CCAG-T; SGG Avis 435/13; the CPS examples published by mem.gov.ma |
| MA public payment deadline | 60 days from the constatation du service fait (45 days ordonnancement + 15 days règlement); intérêts moratoires beyond it, including for an unpaid retenue de garantie | Décret n° 2-16-344 of 22 July 2016, arts. 2 and 8 |
| MA subcontracting | subcontractor declared by the contractor and accepted by the contracting authority; only a share of the contract may be subcontracted; an accepted subcontractor can be paid directly | Décret 2-22-431 (2023), arts. 141-143 — **confirm the article numbers and the 50% cap against the Bulletin Officiel; secondary sources only** |
| "Retention is not a discount" | Bookkeeping guidance shipped in both guides: the full price stays revenue, the withheld part is a receivable | An accountant should confirm the wording matches practice in both regions |
| US contractor as consumer of materials | Majority rule (pay tax to the supplier, no separate line to the customer); reseller treatment in Texas under a separated contract, Arizona and Nebraska in defined cases; contract form and work type can change the answer | Each state's tax authority (e.g. CDTFA, Texas Comptroller, NY Tax Department); no per-state list is shipped |
| US retainage | California and New York cap most private retainage at 5% on covered work (CA from 1 Jan 2026, Civ. Code § 8811; NY GBL § 757 as amended from 19 Dec 2025), with flow-down to subcontractors and statutory release deadlines | The state statutes; the guide deliberately prints no release deadline table |
| US 1099 practice | W-9 before the first payment; 2,000 USD threshold; most corporations exempt (attorneys are not); card and third-party network payments go on a 1099-K; a missing TIN can require backup withholding | IRC §6041A, IRS form instructions, OBBBA §70433 |
| Reports: 1099-NEC card | Groups recorded Expenses per vendor for the CURRENT year and flags 2,000 USD or more; it never decides who must be reported | An accountant should confirm the card cannot be read as a filing decision; the card's own footnote says so |

The fr/ar/es/pt renderings of the new bullets were written with the rest of the
guide and need the same native review as the earlier entries (the MA bullets mix
French legal terms — retenue de garantie, mainlevée, réception définitive — that
Moroccan practice uses as-is).

## Facts taken from the owner's research file (2026-10-03)

The owner supplied `Morocco_US_Construction_Law_Tax_Research_2026` (a synthesis of
CGI 2026, Finance Laws 2024-2026, CNSS rules, the Labour Code and DGI practice). Its
facts were checked one by one; four of its figures were wrong or outdated and the
VERIFIED value ships instead. Everything below is what actually went into the guide.

**Confirmed and shipped as reported**

| Fact from the file | Shipped as |
|---|---|
| Only 20% and 10% TVA remain, CGI 2026 Art. 99, with transitional exceptions by decree | rates section now cites Article 99 and names the transitional exceptions (energy, transport) — keep 20%/10% as the rule |
| Employer CNSS 21.09% / employee 6.74%; 6,000 MAD cap only on the short- and long-term social branches (not AMO, not family allowances) | `employing-staff` section, exact branch breakdown included — re-verified 2026-10-03 against the 2026 CNSS tables |
| SMIG 17.92 MAD/h from 1 Jan 2026 and SMAG 97.44 MAD/day from 1 Apr 2026 (Decree 2.25.983) | `employing-staff` section, with the decree number — re-verified 2026-10-03 |
| Work-accident insurance compulsory (Law 18-12), premiums contract-specific | `employing-staff` section, no rate printed |
| Local taxes TP/TSC: no single national rate (Law 47-06) | `formalities` section, pointing to the commune |
| Cotisation minimale base excludes VAT (HT) | `formalities` section, cited as Article 144 CGI |

**Corrected before shipping (the file's value would have been wrong)**

| File said | Verified value shipped | Why |
|---|---|---|
| E-invoicing = "CGI Art. 119 (LF 2026)" | Still Article 145-IX, with the 145-X/145-XI exclusions | Two independent 2026 sources (and the pre-existing audit) place the requirement in Art. 145-IX; Art. 119 is not corroborated. **Reconcile against the CGI text before release.** |
| Annual leave "24 days/yr" | 1.5 working days per month worked = **18 days/yr** (Labour Code Art. 231), 24 being the under-18 rate or a seniority case | Four 2026 HR sources agree on 1.5 days/month; 24 days is not the general rule. Shipped with the Code reference and no seniority table. |
| Interest "1%/month (Art. 230)", penalties "0.5%-2%/month" | Declaration majorations **5% (<=30 days) / 15% / 20%**, late payment **penalty + 5% first month + 0.5%/month (Art. 208)** | TGR's own taxpayer guide and CGI commentary give 0.5%/month as the monthly component; the 1%/month figure is not corroborated. |
| Non-resident withholding "15% services/leases, 7.5% dividends, 10% royalties" | **10%** on service fees, royalties and interest; dividends on the progressive schedule (**11.25% for 2026 distributions, 10% from 2027**) | 2026 sources (including the LF 2024-2026 dividend schedule) contradict the 15% and 7.5% rates. |

**Shipped but still to confirm against a primary text**

- Dependent deduction **600 MAD per dependent per year, up to 6** (file's value; the
  amount has moved in recent Finance Laws - confirm the current one).
- Salary abatement **35% up to 78,000 MAD / 25% above, capped at 35,000 MAD**
  (standard since LF 2023, but confirm the caps in the Finance Law in force).
- Registration duty **1% of capital, min 300 MAD, max 20,000 MAD; 0.25% on capital
  increases** — confirm against the CGI registration-duty annex and any Finance Law
  exemption list.
- Article numbers for the audit window (**226**), fraud extension (**228**),
  late-payment scale (**208**) and the cotisation minimale (**144**): the statements
  are standard, the subdivisions should be checked in the CGI 2026 text.

**Deliberately NOT adopted from the file**

- Its COUNTRY / TAX_AGENCY / TAX_TYPE / TAX_RATE / TREATY data model and the proposed
  income-type-by-country treaty matrix. The app is offline and single-business: a
  treaty table would need verified per-country rates for every income type, which
  cannot be shipped as information. The guide ships the rule ("check the treaty and
  keep the residence certificate") instead of a table that could be wrong.
- Per-commune TP/TSC rate tables, per-state US lien/nexus/licensing data, and the
  Labour Code dismissal formulas: the file itself lists these as
  "requires direct legal verification", and the guide says so instead of guessing.
- The file's labour/criminal-procedure items (dismissal indemnity formulas, Penal
  Code articles, AML/FATCA reporting): out of scope for an invoicing guide, and the
  figures were not verified.

## Facts from the owner's second research file (2026-10-03)

The owner then supplied a fuller synthesis (LF 2026, CGI 2026, DGI Circular 737,
PwC/Upsilon summaries). Its figures were checked the same way; the corrections below
are what the app ships. Sources are named per row.

**Confirmed and shipped**

| Fact | Where it ships | Checked against |
|---|---|---|
| IS 2026: 20% below 100M MAD of net taxable profit, 35% at/above, 40% for banks-insurers, proportional (whole profit at the rate) | `formalities` | Upsilon, Lembra Conseil, Clicpaie, sahlcompta (all 2026) |
| Cotisation minimale **0.25%** of the turnover base excluding VAT, floor 3,000 MAD, 0.15% in regulated sectors, 36-month exemption for new companies | `formalities` | Clicpaie, Upsilon, Lembra (2026) |
| VAT declaration by the **20th of the month after the period**, monthly above 1,000,000 MAD and quarterly below | `audits` | Wafir, Clair Expert, Création Société (2026) |
| Salary abatement 35% up to 78,000 MAD / 25% above, cap 35,000 MAD (CGI art. 59-I-A); family deduction 600 MAD per dependant, max 6 (3,600 MAD, CGI art. 74, raised by LF 2026); 40,000 MAD exemption threshold; top rate 37% | `employing-staff` | Calculteur du Maroc, Lembra, CAS Patrimoine, Clicpaie, Upsilon (2026) |
| CNSS shares and the 6,000 MAD cap on the social branches only | `employing-staff` (from file 1, re-confirmed) | 2026 CNSS tables |

**Corrected before shipping (the file's value would have been wrong)**

| File said | Verified value shipped | Why |
|---|---|---|
| Cotisation minimale "0.75% of HT" | **0.25%** (floor 3,000 MAD) | 0.75% matches no source; LF 2023 halved the rate to 0.25% for the IS regime. |
| VAT registration "300,000 MAD goods / 500,000 MAD services" | No figure shipped: the bullet says thresholds exist, differ between sales and services and come with a franchise regime | 2026 sources conflict (500k services + 2M retailers; 500k/200k; a unified 500k), so no number can be printed as fact. |
| Registration duty "0.5% with a 3,000 MAD cap" | Hedged bullet: "commonly cited as 1% with a 1,000 MAD minimum", Finance Law exemptions noted, amount to confirm | Sources split between 1% (OMPIC, notary guides) and abolition for company-creation acts (2026 studio sources); the figure cannot be asserted. The earlier 300/20,000 scale (file 1) was removed for the same reason. |
| Late payment "1% per month (12% p.a.)" | Unchanged shipped scale: declaration majorations 5/15/20%, late payment penalty + 5% first month + 0.5% per month (Art. 208) | TGR's own guide and CGI commentary; 1%/month is not corroborated (the file itself hedges later). |
| Audit window "3 years from filing" | **4 years** (Art. 226), 10 for fraud (Art. 228) | The 2026 summaries and the earlier audit put the reprise at four years. |
| "Casablanca Finance City flat 17.5%" | **20%** (like industrial acceleration zones) | 2026 sources give 20% for CFC after the rate convergence. |
| "Resident individuals pay 15% WHT on dividends" | Unchanged: dividends follow the 2026 schedule 11.25% → 10% in 2027 (the shipped bullet is in the non-resident section, where the rate is documented) | The 15% figure is the pre-2023 rate; keep the schedule documented in the non-resident section. |
| Payroll example "CNSS 674 / 2,109 for 10,000 MAD gross" | Not used | Both ignore the 6,000 MAD cap and the branch split (employee is 494.80 and employer 1,790.80 in the 2026 tables). |
| E-invoicing "CGI Art. 119 / Law 59-20" | Unchanged: **Article 145-IX** with the 145-X/145-XI exclusions | Consistent with both earlier research files' own statements and the 2026 sources. "Law 59-20" could not be verified. |

**Not adopted from the file**

- Its sample tax-burden scenarios and the CNSS net-salary examples (numbers depend on
  assumptions the app cannot make, and the CNSS example was wrong).
- The ERP/SQL data model (`cit_rate`, `vat_rate`, `cnss_rate`, `ir_params`,
  `wht_rate`): the same reasoning as the country/treaty model - an offline single
  business app needs the rule, not a rate database it cannot verify.
- Customs duties, excise, insurance levies, AML/FATCA, labour-law formulas, judicial
  appeal procedure: out of scope for an invoicing app and unverified here.
- The 2% social-solidarity contribution and the phasing-out "25% surcharge": the file
  itself is contradictory about these; nothing is shipped.

**Still to confirm with an accountant (shipped with a caveat)**

- The 5% withholding on rent paid to a professional lessor from 1 July 2026 (two 2026
  sources; the bullet says "check whether your lease is in scope").
- The VAT franchise thresholds and the 1,000,000 MAD monthly/quarterly filing line.

## Facts from the owner's third research file (2026-10-03)

A third, larger synthesis (CGI article-by-article, payroll, penalties, filing calendar,
transfer pricing, JSON schema). Three sources now disagree on several figures, which is
itself the finding: only what at least two independent 2026 references support was
shipped.

**Confirmed and shipped**

| Fact | Where it ships | Checked against |
|---|---|---|
| IS return and balance due within 3 months of the year end (31 March for a calendar year); four advance payments of 25% at 31 March, 30 June, 30 September, 31 December (CGI arts. 20, 169-170) | `formalities` | Izri, Lembra, Clicpaie, Upsilon, chy.ma closing guide (all 2026) |
| Expenses not settled by crossed cheque, transfer, bill of exchange or electronic means are deductible only up to 5,000 MAD/day and 50,000 MAD/month per supplier (CGI art. 11-II), excess added back with a 6% fine | `formalities` | Upsilon "charges non deductibles" (2026), indicac, Challenge (LF 2019 origin) |
| Cotisation minimale base HT, 0.25%/0.15%, floor 3,000 MAD (IS) / 1,500 MAD (IR) | `formalities` (already shipped from file 2; this file confirms it) | three 2026 sources |
| Annual leave 18 days (CGI... Labour Code art. 231-232) | `employing-staff` | third independent agreement - the rule stands |
| CNSS family allowances actually paid: **300 MAD/month for each of the first 3 children, 36 MAD for each of the next 3** (six-child ceiling, 1,008 MAD/month max); the employer 6.40% contribution funds them and the 600 MAD/dependant tax deduction is a separate mechanism | `employing-staff` | cnss.ma (official) + wafir.ma + humantal.ma + Upsilon payroll 2026. The file's "100 MAD from the 4th child" is wrong; one secondary source (yabiladi) repeats that wrong figure - the CNSS page gives 36. |
| **CSS solidarity contribution**: due when net taxable profit reaches 1,000,000 MAD, bands **1.5% (1-5 M) / 2.5% (5-10 M) / 3.5% (10-40 M) / 5% (>=40 M)**, not deductible, **extended through 2028 by the 2026 Finance Law** | `formalities` | ecoactu.ma, comptable-tanger.com, Upsilon, Clicpaie, LesEco (2026). One source folds the 2.5% and 3.5% bands into a single 5-40 M band; the four-band reading is what four sources give and is what ships. |
| Company-law minimum capital: **a SARL has none** (the partners fix it in the statutes; 10,000 MAD is common practice, not a legal floor), an **SA needs 300,000 MAD** (3,000,000 MAD if it offers shares to the public) | `formalities` | Moroccan company-formation sources (2026) + OMPIC/Casablanca-registry guides |

**Rejected: the file's value contradicts verified sources**

| File said | Verified / shipped |
|---|---|
| "35% on profit >=100M for CERTAIN companies (CFC, zones, new large investors)" | 35% is the GENERAL rate at/above 100M; CFC and industrial acceleration zones pay 20% regardless (Upsilon, Lembra 2026). The shipped `formalities` bullet already states this. |
| IR brackets "0% to 40k, 10% to 120k, 20% to 300k, 30% to 600k, 34% above" | Stale: 2026 has six tranches from 0% to **37%**, exemption threshold 40,000 MAD (Art. 73 CGI). The app prints no bracket table. |
| Severance "1/5 month per year, then 1/3" | That is French law. Moroccan Labour Code art. 53 uses hours of salary by seniority band (96/144/192/240 h). Nothing shipped; the guide points to the Code. |
| VAT returns "by the 30th" | **20th** of the following month (three 2026 sources). |
| Registration duty "1% min ~100 MAD max 30,000 MAD" | THIRD different scale (file 1: 300/20,000; file 2: 0.5%/3,000; file 3: 100/30,000). No figure can be asserted - the shipped bullet names the widely cited 1%/1,000 MAD anchor, the Finance Law exemptions, and sends the user to the notary. |
| TSC "fixed tariff per m2 (Rabat 0.30 DH/m2)" | File 1 said ~10% of rent. Both cannot be right; the shipped bullet keeps "no single national rate, ask the commune" (Law 47-06). |
| Criminal fines "5k-50k" in one line and "up to 200k" in another | Internally inconsistent and unverified; nothing shipped. |
| Withholding "5% salaries / 10% other / 20% interest on bonds and Sukuk" | Partly unverified nuance (Art. 15-bis/15-ter payments by public bodies). The shipped bullet keeps the documented 10% on service fees, royalties and interest, and the dividend schedule; add the 15-bis/15-ter categories only after checking them in the CGI text. |
| "VAT credit refundable after 2 idle years (art. 102)" | Unverified detail; nothing shipped. |
| Family allowances "100 MAD from the 4th child" | Wrong: the CNSS pays 300 MAD/month for children 1-3 and **36 MAD** for children 4-6 (official CNSS page). The 100 MAD figure is repeated by one secondary source and is in the file. |
| IR "top rate ~34%, brackets unchanged since 2006" | Stale: the 2026 scale runs 0% to **37%** with the 40,000 MAD exemption (Art. 73 CGI). Nothing shipped from this table. |
| "There is no VAT registration threshold (0) - all businesses are subject" | Unverified against the franchise regime the guide already describes; nothing shipped, the franchise caution stands. |
| IUC vehicle tax, a construction "SMAG licence", Art. 103-104 holding-company exemption, Art. 81 group integration, free-zone 0% to 8.75% under Law 8-95, lease-back, PPP Law 17-08, AML declaration at 100,000 MAD | Unverified single-file claims, several outside an offline invoicing tool's scope; nothing shipped. |
| Its JSON schema, ER/Gantt diagrams and integration plan | Same reasoning as the previous two files: the app is an offline single-business invoicing tool, not a payroll/tax engine. The payroll, transfer-pricing, customs and criminal chapters are out of scope. |

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
