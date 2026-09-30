import { CalendarDays, FileText, Lightbulb, ListTodo, Repeat, StickyNote } from 'lucide-react'
import type { CalendarItem } from '../lib/calendar'

/**
 * Icon of one calendar row. Each kind keeps its own icon, and every place that draws
 * an item prints the written label next to it, so the kind is never carried by colour
 * or by the icon alone. Shared by the calendar and the dashboard card so the two stay
 * identical.
 */
export default function EventIcon({ item, className }: { item: CalendarItem; className?: string }) {
  if (item.group === 'notes') {
    if (item.kind === 'task') return <ListTodo className={className} />
    if (item.kind === 'note') return <StickyNote className={className} />
    return <Lightbulb className={className} />
  }
  if (item.group === 'invoices') return <FileText className={className} />
  if (item.group === 'subscriptions') return <Repeat className={className} />
  return <CalendarDays className={className} />
}
