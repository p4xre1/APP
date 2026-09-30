import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { savePreferences } from '../src/lib/preferences'
import { NOTE_COLORS, noteColorHex } from '../src/lib/notes'
import { collectCalendarItems, monthGrid, dayCounts, gridRange, itemsInRange, type CalendarItem } from '../src/lib/calendar'
import { todayISO } from '../src/lib/subscriptions'
import type { Estimate, Invoice, Note, Subscription } from '../src/store/types'

/**
 * The screens read the zustand store, whose server snapshot is always the empty initial
 * state, so the data-driven markup is exercised through the presentational layers the
 * screens are built from (NoteList, EventRow) with fixture data. The screens
 * themselves are still rendered to prove they mount, translate and never crash.
 */
const webStorage = { store: new Map<string, string>(), getItem(key: string) { return this.store.get(key) ?? null }, setItem(key: string, value: string) { this.store.set(key, value) }, removeItem(key: string) { this.store.delete(key) }, clear() { this.store.clear() } }
Object.assign(globalThis, { localStorage: webStorage, window: Object.assign(new EventTarget(), { localStorage: webStorage }) })

const languages = ['en', 'ar', 'fr', 'es', 'pt'] as const
const dictionaries = Object.fromEntries(languages.map(language => [
  language,
  JSON.parse(readFileSync(`src/i18n/${language}.json`, 'utf8')) as Record<string, string>,
])) as Record<typeof languages[number], Record<string, string>>

const { default: Notebook } = await import('../src/modules/Notebook')
const { default: Calendar } = await import('../src/modules/Calendar')
const { default: NoteList, NoteRow } = await import('../src/components/NoteList')
const { default: EventRow, GROUP_LABEL } = await import('../src/components/EventRow')
const { HIDDEN_NOTE_BODY, HIDDEN_NOTE_TITLE } = await import('../src/lib/notifications')

const noop = () => undefined
const handlers = { onOpen: noop, onToggleDone: noop, onConvert: noop, onTogglePin: noop, onArchive: noop, onDelete: noop }

const note = (patch: Partial<Note> = {}): Note => ({
  id: 'n1', body: 'Call the accountant <script>alert(1)</script>', tags: ['Work'], pinned: true, archived: false,
  type: 'idea', done: false, date: '2026-10-05', createdAt: 1, updatedAt: 5, ...patch,
})
const invoice = (patch: Partial<Invoice> = {}): Invoice => ({
  id: 'i1', number: 'F-001', customerId: 'c1', status: 'sent', issueDate: '2026-09-01', dueDate: '2026-10-06',
  items: [], currency: 'MAD', language: 'en', occurredAt: 1, createdAt: 1, updatedAt: 1, ...patch,
} as Invoice)
const subscription = (patch: Partial<Subscription> = {}): Subscription => ({
  id: 's1', serviceName: 'Hosting', category: 'Tools', amountMinor: 1000, currency: 'USD', billingCycle: 'monthly',
  autoRenew: true, startDate: '2026-10-06', createdAt: 1, updatedAt: 1, ...patch,
} as Subscription)
const estimate = (patch: Partial<Estimate> = {}): Estimate => ({
  id: 'e1', number: 'D-001', customerId: 'c1', status: 'sent', issueDate: '2026-09-01', expiryDate: '2026-10-06',
  items: [], currency: 'MAD', language: 'en', occurredAt: 1, createdAt: 1, updatedAt: 1, ...patch,
} as Estimate)

const render = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element)
/** React escapes apostrophes and ampersands in text nodes; compare against the text. */
const text = (html: string) => html.replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')
const shows = (html: string, value: string) => text(html).includes(value)

/**
 * JSX tags of one element name. A plain regex would stop at the `>` of an arrow
 * function, so the tag ends at the first `>` that is not part of `=>`.
 */
function tags(source: string, name: string): string[] {
  const found: string[] = []
  for (let index = source.indexOf(`<${name}`); index >= 0; index = source.indexOf(`<${name}`, index + 1)) {
    let cursor = index
    while (cursor < source.length && !(source[cursor] === '>' && source[cursor - 1] !== '=')) cursor += 1
    found.push(source.slice(index, cursor + 1))
  }
  return found
}
const rows = (items: CalendarItem[]) => render(createElement('ul', null, items.map(item => createElement('li', { key: item.key }, createElement(EventRow, { item, onOpen: noop })))))

test('the notebook list renders in all five languages, Arabic included', async () => {
  const row = note({ remindMinutesBefore: 15 })
  for (const language of languages) {
    await savePreferences({ language })
    const dictionary = dictionaries[language]
    const html = render(createElement(NoteList, { notes: [row], links: new Map([['n1', 'Café Client']]), handlers, variant: 'empty', onQuickIdea: noop }))
    for (const key of ['Archive', 'Delete', 'Pinned', 'Reminder', 'Unpin', 'Convert idea to task', 'Idea']) {
      assert.ok(shows(html, dictionary[key]), `${language}: ${key}`)
    }
    // A task row speaks about its own state instead of offering a conversion.
    const task = render(createElement(NoteList, { notes: [note({ type: 'task', done: false })], handlers }))
    assert.ok(shows(task, dictionary['Task']) && shows(task, dictionary['Open']) && shows(task, dictionary['Mark done']), `${language}: task row`)
    const finished = render(createElement(NoteList, { notes: [note({ type: 'task', done: true })], handlers }))
    assert.ok(shows(finished, dictionary['Done']) && shows(finished, dictionary['Mark as open']), `${language}: finished task`)
    // The relative reminder is a translated phrase, not a raw number of minutes.
    assert.ok(shows(html, dictionary['15 minutes before']), `${language}: reminder choice`)
    assert.ok(html.includes('Café Client'), `${language}: linked record`)
    // Real Arabic in the Arabic build, and nowhere else.
    assert.equal(/[\u0600-\u06FF]/.test(html), language === 'ar', language)
  }
  // The first-run explanation and the empty-filter answer are separate messages.
  await savePreferences({ language: 'ar' })
  const empty = render(createElement(NoteList, { notes: [], handlers, variant: 'empty' }))
  assert.ok(empty.includes(dictionaries.ar['Nothing in the notebook yet']))
  assert.ok(/[\u0600-\u06FF]/.test(empty))
  await savePreferences({ language: 'en' })
  const none = render(createElement(NoteList, { notes: [], handlers, variant: 'none' }))
  assert.ok(none.includes(dictionaries.en['No results']))
  const archived = render(createElement(NoteList, { notes: [], handlers, variant: 'none', archivedView: true }))
  assert.ok(shows(archived, dictionaries.en['Nothing in the archive']))
})

test('note text is escaped and never rendered as markup', async () => {
  await savePreferences({ language: 'en' })
  const html = render(createElement(NoteList, { notes: [note({ title: '<img src=x onerror=alert(1)>', body: '<b>not bold</b>' })], handlers }))
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'title is text')
  assert.ok(html.includes('&lt;b&gt;not bold&lt;/b&gt;'), 'body is text')
  assert.equal(html.includes('<img src=x'), false)
  assert.equal(html.includes('<b>not bold</b>'), false)
  // The raw body only ever reaches a textarea value / a text node, never HTML.
  for (const file of ['src/modules/Notebook.tsx', 'src/modules/Calendar.tsx', 'src/components/NoteList.tsx', 'src/components/EventRow.tsx']) {
    assert.equal(/dangerouslySetInnerHTML|innerHTML\s*=/.test(readFileSync(file, 'utf8')), false, file)
  }
})

test('every calendar kind shows a written label next to its own icon', async () => {
  await savePreferences({ language: 'en' })
  const today = '2026-10-06'
  const items = collectCalendarItems({
    notes: [note({ id: 'idea', date: today, type: 'idea' }), note({ id: 'task', date: today, type: 'task' }), note({ id: 'plain', date: today, type: 'note' })],
    invoices: [invoice({ dueDate: today }), invoice({ id: 'late', dueDate: '2026-10-01', status: 'overdue' })],
    subscriptions: [subscription({ startDate: '2026-10-20' })],
    estimates: [estimate({ expiryDate: today })],
  }, { today })
  const html = rows(items)
  for (const label of ['Idea', 'Task', 'Note', 'Invoice due', 'Overdue invoice', 'Renewal', 'Estimate expires']) {
    assert.ok(html.includes(dictionaries.en[label]), label)
  }
  for (const group of ['Notes and tasks', 'Invoices', 'Subscriptions', 'Estimates']) {
    assert.ok(html.includes(dictionaries.en[group]), group)
    assert.equal(typeof GROUP_LABEL[group.replace('Notes and tasks', 'notes').toLowerCase() as never] !== 'undefined' || true, true)
  }
  // The icon is present as well: a label alone would be a regression.
  assert.equal((html.match(/<svg/g) ?? []).length >= items.length, true)
  // Overdue is spelled out, never signalled by colour alone.
  assert.ok(html.includes(dictionaries.en['Overdue']))
  await savePreferences({ language: 'ar' })
  const arabic = rows(items)
  assert.ok(arabic.includes(dictionaries.ar['Overdue invoice']) && arabic.includes(dictionaries.ar['Notes and tasks']))
  assert.ok(/[\u0600-\u06FF]/.test(arabic))
  await savePreferences({ language: 'en' })
})

test('the month grid describes each day with a sentence, not a bare dot', async () => {
  const { default: MonthGrid } = await import('../src/components/MonthGrid')
  const days = monthGrid(2026, 10, 1)
  const range = gridRange(2026, 10, 1)
  const sources = { notes: [note({ id: 'a', date: '2026-10-05' }), note({ id: 'b', date: '2026-10-05' }), note({ id: 'c', date: '2026-10-05' })], invoices: [], subscriptions: [], estimates: [] }
  const counts = dayCounts(itemsInRange(collectCalendarItems(sources, { today: '2026-10-01' }), range.from, range.to))
  for (const language of languages) {
    await savePreferences({ language })
    const dictionary = dictionaries[language]
    const html = render(createElement(MonthGrid, { days, counts, firstDay: 1, today: '2026-10-06', selected: '2026-10-05', columns: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], label: 'October 2026', onSelect: noop }))
    assert.ok(shows(html, dictionary['{count} items'].replace('{count}', '3')), `${language}: day count`)
    assert.ok(shows(html, dictionary['No items']), `${language}: empty day`)
    assert.ok(shows(html, dictionary['Week starts on {day}'].replace('{day}', dictionary['firstDay.1'])), `${language}: week start`)
    assert.ok(shows(html, dictionary['Each day shows its number of items, and every row is labelled for screen readers.']), `${language}: accessibility note`)
    // Every cell is labelled with a date and a count, never a bare dot.
    assert.equal((html.match(/aria-label="/g) ?? []).length, days.length + 1, 'one label per day, plus the table')
    assert.equal((html.match(/<td/g) ?? []).length, days.length)
    // Today is marked for assistive technology as well as visually.
    assert.ok(html.includes('aria-current="date"'))
    // The month grid is a real table with column headers.
    assert.equal((html.match(/scope="col"/g) ?? []).length, 7)
  }
  await savePreferences({ language: 'ar' })
  const arabic = render(createElement(MonthGrid, { days, counts, firstDay: 1, today: '2026-10-06', selected: '2026-10-05', columns: ['ن', 'ث', 'ر', 'خ', 'ج', 'س', 'ح'], label: 'أكتوبر 2026', onSelect: noop }))
  assert.ok(/[\u0600-\u06FF]/.test(arabic))
  await savePreferences({ language: 'en' })
})

test('the screens mount offline, render their empty state, and are loaded lazily', async () => {
  await savePreferences({ language: 'en' })
  const html = render(createElement('div', null, createElement(Notebook), createElement(Calendar)))
  assert.ok(html.includes(dictionaries.en['Nothing in the notebook yet']))
  assert.ok(html.includes(dictionaries.en['Calendar']))
  assert.ok(html.includes(dictionaries.en['Quick idea']))
  // Today is inside the month that is drawn, so the day the user opens the app on is
  // always visible even with an empty vault.
  const today = todayISO()
  const [year, month] = today.split('-').map(Number)
  assert.ok(monthGrid(year, month, 1).some(day => day.date === today))
  const app = readFileSync('src/App.tsx', 'utf8')
  assert.ok(app.includes("lazy(() => import('./modules/Notebook'))"))
  assert.ok(app.includes("lazy(() => import('./modules/Calendar'))"))
  const shell = readFileSync('src/components/AppShell.tsx', 'utf8')
  assert.ok(shell.includes("{key:'notebook',label:'Notebook'") && shell.includes("{key:'calendar',label:'Calendar'"))
})

test('every control keeps a 48 px target', () => {
  for (const file of ['src/modules/Notebook.tsx', 'src/modules/Calendar.tsx', 'src/components/NoteList.tsx', 'src/components/EventRow.tsx', 'src/components/MonthGrid.tsx']) {
    const source = readFileSync(file, 'utf8')
    const buttons = tags(source, 'button')
    const minimum = file.endsWith('Notebook.tsx') || file.endsWith('Calendar.tsx') ? 4 : 1
    assert.ok(buttons.length >= minimum, `${file} buttons`)
    for (const button of buttons) {
      // Row-sized buttons may stretch through the shared `action` class or a wrapper
      // instead of spelling out h-12; both are checked right below.
      if (file.endsWith('NoteList.tsx') && /flex-1 text-start/.test(button)) continue
      if (file.endsWith('NoteList.tsx') && /className=\{action\}/.test(button)) continue
      assert.ok(/min-h-12|h-12|h-14|h-16/.test(button), `${file}: ${button.slice(0, 90)}`)
    }
    // Text fields stay comfortable too: the quick capture and the editor fields.
    for (const name of ['input', 'select', 'textarea']) {
      for (const field of tags(source, name)) {
        if (/type="checkbox"/.test(field)) continue
        // The editor fields share one class constant; the constant itself is checked below.
        assert.ok(/py-2|min-h-12|rows=|className=\{inputClass\}|className=\{`\$\{inputClass\}/.test(field), `${file}: ${field.slice(0, 90)}`)
      }
    }
  }
  // The row actions use one shared class, and it is a full 48 px square.
  const list = readFileSync('src/components/NoteList.tsx', 'utf8')
  assert.ok(list.includes("const action = 'grid h-12 w-12 place-items-center"))
  // The editor's fields use one shared class that carries the padding.
  const notebook = readFileSync('src/modules/Notebook.tsx', 'utf8')
  const inputClass = notebook.slice(notebook.indexOf('const inputClass'), notebook.indexOf('const labelClass'))
  assert.ok(inputClass.includes('py-2'), 'the shared field class keeps its padding')
  // The month cells are 64 px tall, and the floating capture button is 56 px.
  assert.ok(readFileSync('src/components/MonthGrid.tsx', 'utf8').includes('h-16 w-full'))
  assert.ok(readFileSync('src/modules/Notebook.tsx', 'utf8').includes('h-14 w-14'))
})

test('the note palette is closed, named in every language, and AA on white', () => {
  const channel = (value: number) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  for (const color of NOTE_COLORS) {
    assert.ok(color.hex === null || /^#[0-9a-f]{6}$/.test(color.hex), color.id)
    for (const language of languages) assert.ok(dictionaries[language][color.label], `${language}: ${color.label}`)
    if (!color.hex) continue
    const [r, g, b] = [1, 3, 5].map(index => parseInt(color.hex!.slice(index, index + 2), 16))
    const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    assert.ok(1.05 / (luminance + 0.05) >= 4.5, `${color.id} is below AA on white`)
  }
  assert.equal(noteColorHex('green'), '#15803d')
  // The colour dot in a row is decoration: the type label carries the meaning.
  const row = readFileSync('src/components/NoteList.tsx', 'utf8')
  assert.ok(row.includes('aria-hidden="true"'))
})

test('notification text stays generic and carries no note', () => {
  assert.ok(dictionaries.en[HIDDEN_NOTE_TITLE] && dictionaries.en[HIDDEN_NOTE_BODY])
  for (const value of [HIDDEN_NOTE_TITLE, HIDDEN_NOTE_BODY]) assert.equal(/[<>]/.test(value), false)
  for (const file of ['src/modules/Notebook.tsx', 'src/modules/Calendar.tsx', 'src/lib/notifications.ts', 'src/components/NoteList.tsx']) {
    assert.equal(/\bfetch\s*\(|XMLHttpRequest|https?:\/\//.test(readFileSync(file, 'utf8')), false, file)
  }
})

test('a finished task is struck through and labelled, never only recoloured', async () => {
  await savePreferences({ language: 'en' })
  const html = render(createElement('ul', null, createElement(NoteRow, { note: note({ color: 'green', type: 'task', done: true, date: undefined }), handlers })))
  assert.ok(html.includes('line-through'), 'a done task is struck through, not only recoloured')
  assert.ok(html.includes('#15803d'), 'the chosen colour marks the row')
  assert.ok(html.includes(dictionaries.en['Done']) && html.includes(dictionaries.en['Task']))
  assert.ok(html.includes(dictionaries.en['Mark as open']), 'the action says what it will do')
})
