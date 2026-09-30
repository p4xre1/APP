/**
 * FAQ content: data only, so every answer can be reviewed in one place and the
 * screens stay free of prose. `question` and `answer` are i18n keys: the English
 * dictionary holds the text below, and all five dictionaries hold a translation.
 *
 * Every answer here was checked against this repository. Where an answer depends
 * on Android behaviour rather than on app code it says so in plain words (vendor
 * battery optimization, uninstalling, a reset phone) - those parts cannot be
 * verified from the source tree and are marked NOT-VERIFIABLE-IN-REPO below:
 *
 *   - "uninstall deletes the records": Android platform behaviour. The app's own
 *     contribution (allowBackup=false, fullBackupContent=false) is verifiable.
 *   - "battery optimization can delay notifications": vendor behaviour. The app's
 *     contribution (inexact alarms, permission asked only when reminders are on)
 *     is verifiable in src/lib/notifications.ts.
 *   - "a new phone starts empty": Android platform behaviour, follows from there
 *     being no server, no account and no automatic backup.
 *   - reminders "a few minutes late": Android scheduling behaviour.
 */

export const FAQ_TOPICS = ['data', 'backup', 'invoices', 'tax', 'subscriptions', 'general'] as const
export type FaqTopic = typeof FAQ_TOPICS[number]

/** Section headings of the FAQ screen. */
export const FAQ_TOPIC_LABEL: Record<FaqTopic, string> = {
  data: 'Data & security',
  backup: 'Backup',
  invoices: 'Invoices',
  tax: 'Tax guide',
  subscriptions: 'Subscriptions',
  general: 'General',
}

export interface FaqItem {
  id: string
  topic: FaqTopic
  /** i18n key of the question. */
  question: string
  /** i18n key of the answer. */
  answer: string
}

export const FAQ_ITEMS: FaqItem[] = [
  // Data & security
  { id: 'data-storage', topic: 'data',
    question: 'Where is my data stored?',
    answer: 'On this phone only, in the private storage of the app (IndexedDB), encrypted with AES-256-GCM. The key is derived from your 6-digit PIN with PBKDF2-SHA256 (600 000 iterations and a random salt). Only a verifier of the PIN is kept, never the PIN itself.' },
  { id: 'data-upload', topic: 'data',
    question: 'Is anything uploaded to a server?',
    answer: 'No. There is no account and no server: the app is built without the Android INTERNET permission and its pages are pinned to connect-src \'none\'. Data leaves the phone only when you share a file yourself.' },
  { id: 'data-forgot-pin', topic: 'data',
    question: 'I forgot my PIN. What can I do?',
    answer: 'A forgotten PIN cannot be recovered: only a verifier is stored, and the records cannot be decrypted without the key derived from the PIN. If you exported an encrypted backup, open Reset app, create a new PIN, then import that backup with its own password.' },
  { id: 'data-lost-phone', topic: 'data',
    question: 'I lost or reset my phone.',
    answer: 'Nothing is stored online, so a new phone starts empty and Android automatic backup is switched off for this app. Install the app, create a PIN, then import your most recent .fatorati backup file with the password you saved.' },
  { id: 'data-uninstall', topic: 'data',
    question: 'What happens if I uninstall the app?',
    answer: 'Android removes the private storage of the app, including the encrypted records and your PIN. Export a backup and any file you still need before uninstalling. Files you already saved elsewhere, such as in Files or Drive, stay where you put them.' },
  { id: 'data-change-pin', topic: 'data',
    question: 'How do I change my PIN?',
    answer: 'Settings → Security: type the current PIN, then the new 6-digit PIN twice, and press Change PIN. Stored records are re-encrypted with a key derived from the new PIN, and any saved biometric key is deleted.' },
  { id: 'data-biometric', topic: 'data',
    question: 'How does biometric unlock work, and how do I turn it off?',
    answer: 'If the phone has an enrolled biometric, Settings → Security can turn biometrics on after you type your PIN once. A copy of the encryption key is then kept in the Android Keystore-backed credential storage of the biometric plugin and released only after a successful prompt. Turning it off deletes that copy; your PIN keeps working.' },

  // Backup
  { id: 'backup-create', topic: 'backup',
    question: 'How do I create an encrypted backup?',
    answer: 'Settings → Backup & Restore. Type a backup password (at least 8 characters) twice and press the export button. The app writes an encrypted .fatorati file (AES-256-GCM, key derived from that password with PBKDF2-SHA256, 600 000 iterations) and hands it to the Android share sheet, where you choose where to save it.' },
  { id: 'backup-restore', topic: 'backup',
    question: 'How do I restore a backup?',
    answer: 'Settings → Backup & Restore: pick the .fatorati file, type its password, then choose Merge / Sync or Replace all data. Merge matches records by id and keeps the newer updatedAt; replace deletes the current records first and asks you to confirm.' },
  { id: 'backup-password', topic: 'backup',
    question: 'Why does the backup password matter so much?',
    answer: 'The file is encrypted with that password and nothing else. There is no recovery and no reset: without the password the backup cannot be opened, not even on this phone. Keep it somewhere safe and outside the phone, and test the import before you need it.' },
  { id: 'backup-plaintext', topic: 'backup',
    question: 'Are the PDF, Excel and CSV exports encrypted?',
    answer: 'No. Only the .fatorati backup is encrypted. A PDF, Excel or CSV export is plain business data that anyone who opens the file can read, so send it only to the people who should see that invoice or report, and delete it when you are done.' },
  { id: 'backup-where', topic: 'backup',
    question: 'Where do exported files go?',
    answer: 'The export is staged in the private cache of the app and handed to the Android share sheet, where you choose the destination, for example Files or Drive. The staged copy is deleted the next time the app starts or unlocks, and Settings → Security has a Clear temporary files button.' },

  // Invoices
  { id: 'invoice-number', topic: 'invoices',
    question: 'How is an invoice number built?',
    answer: 'PREFIX-YEAR-0001. The prefix comes from Settings → Document defaults (INV for invoices, EST for estimates by default), and the four-digit counter continues from the highest number already used in the same year. A number that already exists is skipped.' },
  { id: 'invoice-sequential', topic: 'invoices',
    question: 'Why must invoice numbers stay sequential?',
    answer: 'The bundled tax guide states that Moroccan rules require a sequential, gap-free series (Art. 145 CGI). The app always offers the next number in the series and never reuses one, and it files nothing with any authority.' },
  { id: 'invoice-paid', topic: 'invoices',
    question: 'How do I mark an invoice as paid?',
    answer: 'In the invoice list, press Mark as paid, or set the status to paid in the status picker of that row. The paid date is stored and shown under the invoice number.' },
  { id: 'invoice-edit', topic: 'invoices',
    question: 'Can I edit, void or delete an invoice?',
    answer: 'You can edit a record, or delete it after a confirmation. There is no void status and no credit note: the statuses are draft, sent, paid and overdue. Deleting a number that a customer already received leaves a gap in the series, so check the numbering note in the tax guide first.' },
  { id: 'invoice-tax', topic: 'invoices',
    question: 'How do I add TVA or sales tax?',
    answer: 'Type the rate in the Tax rate field of the document, or set a default in Settings → Document defaults. The app applies it to the subtotal and prints the rate and the tax amount on the PDF.' },
  { id: 'invoice-region', topic: 'invoices',
    question: 'Morocco or the United States: which tax region should I pick?',
    answer: 'Settings → Tax region chooses the guidance and the default rate you see. Morocco uses the TVA rates and the ICE number; the United States uses the combined state and local sales-tax rate for the buyer\'s address, which you type yourself. Changing the region never rewrites an existing invoice.' },
  { id: 'invoice-identifiers', topic: 'invoices',
    question: 'What are ICE, IF, RC and TP? Where do I enter them?',
    answer: 'They are Moroccan tax identifiers: ICE (15 digits), IF (tax identifier), RC (trade register) and TP (taxe professionnelle). The app has one Tax number field in Settings → Business Information, labelled ICE (15 digits) for Morocco and Tax number for the United States. Enter the ICE there; there are no separate fields for IF, RC or TP, so put them in the invoice notes if your customer needs them.' },
  { id: 'invoice-estimates', topic: 'invoices',
    question: 'How do estimates become invoices?',
    answer: 'Open Estimates and press the convert button on an estimate. The app creates a draft invoice with the next sequential number and copies the customer, the items, the tax and the totals; the estimate is then marked accepted.' },

  // Tax guide
  { id: 'tax-advice', topic: 'tax',
    question: 'Is the tax guide official tax advice?',
    answer: 'No. It is general information bundled with the app, not tax, legal or accounting advice, and it is not certified or approved by any authority. Rates and rules change; check the current rules with the competent authority or your accountant before you rely on them.' },
  { id: 'tax-reviewed', topic: 'tax',
    question: 'Why do the guide pages show a last-reviewed date?',
    answer: 'So you can see how old the text is. The date is when the content was last checked against the sources the guide lists; it is not a statement that nothing has changed since.' },
  { id: 'tax-official', topic: 'tax',
    question: 'Where can I check the official rules?',
    answer: 'In Morocco, the DGI publishes the CGI and the current rules. In the United States, sales tax is set state by state, so check the revenue department of your state. For the Moroccan e-invoicing start date the app deliberately states no date: confirm it with the DGI.' },

  // Subscriptions
  { id: 'subscriptions-reminders', topic: 'subscriptions',
    question: 'How do subscription reminders work?',
    answer: 'Turn on Remind me before a renewal and the app schedules local notifications at 09:00 in the local time of the phone: one some days before the renewal (Days before, 1 to 30) and optionally one on the day itself. Everything is scheduled on the phone, and the in-app banner works even without notifications.' },
  { id: 'subscriptions-missing', topic: 'subscriptions',
    question: 'Why is a reminder late, or missing?',
    answer: 'Reminders are deliberately not exact alarms, so Android may deliver them a few minutes late. Battery optimization (some vendors are strict), a denied notification permission, or a force-stopped app can delay or block them. Allow notifications for Fatorati, remove the app from battery restrictions, and open the app once so the pending reminders are rebuilt.' },
  { id: 'subscriptions-status', topic: 'subscriptions',
    question: 'What is the difference between expiring soon and expired?',
    answer: 'Expiring soon means the renewal date is inside the warning window you chose (Days before). Expired means the date has passed. A subscription set to auto-renew never expires: it stays active or expiring soon.' },
  { id: 'subscriptions-currencies', topic: 'subscriptions',
    question: 'Are subscriptions in different currencies added together?',
    answer: 'Never. Each currency gets its own monthly and yearly total, in the summary card and in the Excel export, and no exchange rate is invented to merge them.' },
  { id: 'subscriptions-hidden', topic: 'subscriptions',
    question: 'What does Hide service names do?',
    answer: 'A hidden reminder only says that a subscription needs attention, so the service name does not appear on the lock screen. It is on by default; the in-app list always shows the real name.' },

  // General
  { id: 'general-offline', topic: 'general',
    question: 'Does Fatorati need an internet connection?',
    answer: 'No. The app is built without the Android INTERNET permission, so invoicing, PDFs, exports, backups and reminders all work in airplane mode. Nothing is downloaded and there are no updates to fetch.' },
  { id: 'general-language', topic: 'general',
    question: 'How do I change the language?',
    answer: 'Settings → Language and appearance → Language. All five languages apply immediately, including the right-to-left layout for Arabic.' },
  { id: 'general-free', topic: 'general',
    question: 'Is it really free, with no ads and no account?',
    answer: 'Yes. There is no subscription, no advertising, no analytics and no sign-up, and the app has no server to send anything to. Your records stay in the encrypted vault on this phone.' },
  { id: 'general-support', topic: 'general',
    question: 'How do I contact support?',
    answer: 'Open Get help. When this build has a support address configured, the Contact support row opens your email app; Report a problem prepares a message that contains only the app version, the Android version, the device model and the selected language.' },
  { id: 'general-english', topic: 'general',
    question: 'Why is the privacy policy shown in English?',
    answer: 'The privacy policy and the terms of use are published in English, French and Arabic. In another language the app shows the English document with a short notice, while the rest of the interface stays translated.' },
]

const MARKS = /[\u0300-\u036f\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g

/** Accent-, case- and diacritic-insensitive, so search works in AR, FR and EN. */
export function normalizeSearch(value: string): string {
  return value.normalize('NFKD').replace(MARKS, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064a')
    .replace(/\u0629/g, '\u0647')
    .toLowerCase().trim()
}

/**
 * Filters the FAQ in the language the user is reading. Every word of the query has
 * to appear in the translated question or answer, so a search for a French or
 * Arabic word finds the entries the user sees.
 */
export function filterFaq(query: string, translate: (key: string) => string, items: FaqItem[] = FAQ_ITEMS): FaqItem[] {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean)
  if (!words.length) return items
  return items.filter(item => {
    const haystack = normalizeSearch(`${translate(item.question)} ${translate(item.answer)}`)
    return words.every(word => haystack.includes(word))
  })
}
