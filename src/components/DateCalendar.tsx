import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n, usePreferences } from '../i18n'
import { locale, number, weekDays } from '../lib/format'
/** Date-only calendar: navigation and week start are local preferences, never UTC instants. */
export default function DateCalendar({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  const {t}=useI18n(),p=usePreferences()
  const [month,setMonth]=useState(()=>new Date(value.slice(0,7)+'-01T12:00:00Z'))
  const year=month.getUTCFullYear(),m=month.getUTCMonth()
  const offset=(month.getUTCDay()-p.firstDay+7)%7,days=new Date(Date.UTC(year,m+1,0)).getUTCDate()
  const move=(step:number)=>setMonth(new Date(Date.UTC(year,m+step,1,12)))
  return <details className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13px]">
    <summary className="cursor-pointer">{t('Calendar')}</summary>
    <div className="flex justify-between items-center my-2">
      <button type="button" aria-label={t('Previous month')} onClick={()=>move(-1)}><ChevronLeft className="directional w-5 h-5"/></button>
      <span>{new Intl.DateTimeFormat(locale(),{month:'long',year:'numeric',timeZone:'UTC'}).format(month)}</span>
      <button type="button" aria-label={t('Next month')} onClick={()=>move(1)}><ChevronRight className="directional w-5 h-5"/></button>
    </div>
    <div className="grid grid-cols-7 gap-1 text-center">
      {weekDays().map((day,i)=><span className="text-[12px] text-muted" key={i}>{day}</span>)}
      {Array.from({length:offset},(_,i)=><span key={'blank'+i}/>)}
      {Array.from({length:days},(_,i)=>{
        const date=`${year}-${String(m+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`
        return <button type="button" key={date} aria-pressed={value.slice(0,10)===date} className={`p-1 rounded ${value.slice(0,10)===date?'bg-brand text-white':'hover:bg-canvas'}`} onClick={()=>onChange(date)}>{number(i+1)}</button>
      })}
    </div>
  </details>
}
