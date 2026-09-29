import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n, usePreferences } from '../i18n'
import { locale, number } from '../lib/format'
import { addMonths, monthGrid, monthLabel } from '../lib/calendar'
/** Date-only calendar: navigation and week start are local preferences, never UTC instants. */
export default function DateCalendar({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  const {t}=useI18n(),p=usePreferences()
  const [month,setMonth]=useState(()=>value.slice(0,7))
  const grid=monthGrid(month,p.firstDay)
  return <details className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13px]">
    <summary className="cursor-pointer">{t('Calendar')}</summary>
    <div className="flex justify-between items-center my-2">
      <button type="button" aria-label={t('Previous month')} onClick={()=>setMonth(addMonths(month,-1))}><ChevronLeft className="directional w-5 h-5"/></button>
      <span>{monthLabel(month,p.language,p.digits)}</span>
      <button type="button" aria-label={t('Next month')} onClick={()=>setMonth(addMonths(month,1))}><ChevronRight className="directional w-5 h-5"/></button>
    </div>
    <div className="grid grid-cols-7 gap-1 text-center">
      {Array.from({length:7},(_,i)=>new Intl.DateTimeFormat(locale(),{weekday:'short',timeZone:'UTC'}).format(Date.UTC(2026,0,4+(p.firstDay+i)%7))).map((day,i)=><span className="text-[12px] text-muted" key={i}>{day}</span>)}
      {grid.map((date,index)=>date
        ? <button type="button" key={date} aria-pressed={value.slice(0,10)===date} className={`p-1 rounded ${value.slice(0,10)===date?'bg-brand text-white':'hover:bg-canvas'}`} onClick={()=>onChange(date)}>{number(Number(date.slice(8,10)), p.language)}</button>
        : <span key={'blank'+index}/>) }
    </div>
  </details>
}
