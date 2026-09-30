import { useMemo, useState } from 'react'
import { TrendingUp, PiggyBank, ReceiptText, Landmark, FolderPlus, FileText, Users, Package, StickyNote } from 'lucide-react'
import { useFatorati } from '../store/useFatorati'
import { upcomingItems, type CalendarItem } from '../lib/calendar'
import { setIntent } from '../lib/navigation-intent'
import { todayISO } from '../lib/subscriptions'
import type { ModuleKey } from '../store/types'
import { useI18n, usePreferences } from '../i18n'
import { money, number, formatDate, locale } from '../lib/format'
import { reportTotals } from '../lib/reports'
import { chartData } from '../lib/chart-data'
import { useLastBackup } from '../lib/useLastBackup'
import { hasPickedBackup } from '../lib/backup-picker'
import { Card, SectionTitle, Btn } from '../components/kit'
import EventIcon from '../components/EventIcon'
import { AreaChart, BarChart, Donut, Legend } from '../components/charts'
import { SubscriptionAttentionBanner } from './Subscriptions'

export default function Dashboard({onNavigate}:{onNavigate:(key:ModuleKey)=>void}) {
  const {t,language}=useI18n(),prefs=usePreferences(),{invoices,expenses,customers,products,business,notes,subscriptions,estimates}=useFatorati(),{overdue}=useLastBackup()
  const today=todayISO()
  // The same aggregation as the calendar, so the two can never disagree.
  const upcoming=useMemo(()=>upcomingItems({notes,invoices,subscriptions,estimates},{today,days:7}).slice(0,6),[notes,invoices,subscriptions,estimates,today])
  const upcomingTotal=useMemo(()=>upcomingItems({notes,invoices,subscriptions,estimates},{today,days:7}).length,[notes,invoices,subscriptions,estimates,today])
  const [range,setRange]=useState(8),[selected,setSelected]=useState(prefs.defaultCurrency)
  const currencies=[...new Set([prefs.defaultCurrency,...invoices.map(row=>row.currency||prefs.defaultCurrency),...expenses.map(row=>row.currency||prefs.defaultCurrency)])]
  const currency=currencies.includes(selected)?selected:prefs.defaultCurrency
  const [now]=useState(Date.now)
  const data=useMemo(()=>chartData(invoices,expenses,currency,range,now,prefs.timeZone,locale(prefs.language),prefs.defaultCurrency),[invoices,expenses,currency,range,now,prefs.timeZone,prefs.language,prefs.digits,prefs.defaultCurrency])
  const result=reportTotals(invoices,expenses,prefs.defaultCurrency).totals.find(row=>row.currency===currency)||{revenue:0,profit:0,pending:0,expenses:0,tax:0,counts:{paid:0,sent:0,overdue:0,draft:0,total:0}}
  const metrics=[
    {label:'Total Revenue (Paid)',value:result.revenue,hint:t('{count} paid invoices',{count:result.counts.paid}),icon:TrendingUp,tint:'bg-brand-50 text-brand-700'},
    {label:'Net Profit',value:result.profit,hint:t('Revenue minus expenses'),icon:PiggyBank,tint:'bg-good-50 text-emerald-700'},
    {label:'Total Expenses',value:result.expenses,hint:t('Recorded expenses'),icon:ReceiptText,tint:'bg-brand-50 text-brand-700'},
    {label:'Pending Revenue',value:result.pending,hint:t('{sent} sent · {overdue} overdue',{sent:result.counts.sent,overdue:result.counts.overdue}),icon:Landmark,tint:'bg-warn-50 text-warn'},
  ]
  const quick=[{key:'projects' as const,label:'Projects',icon:FolderPlus,tint:'bg-brand'},{key:'expenses' as const,label:'Expenses',icon:ReceiptText,tint:'bg-emerald-brand text-white'},{key:'invoices' as const,label:'Invoices',icon:FileText,tint:'bg-navy text-white'},{key:'notebook' as const,label:'Quick idea',icon:StickyNote,tint:'bg-brand-50 text-brand-700'}]
  const series=[{name:t('Revenue'),values:data.revenue},{name:t('Expenses'),values:data.expense,color:'var(--chart-3)'}]
  return <div className="mz-view space-y-6">
    <SectionTitle title={t('Dashboard')} sub={`${t('Welcome back,')} ${business?.ownerName||''} · ${formatDate(now,true)}`} action={<div className="flex flex-wrap items-center gap-2">
      <select aria-label={t('Currency')} value={currency} onChange={e=>setSelected(e.target.value)} className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink outline-none focus:border-brand">{currencies.map(code=><option key={code}>{code}</option>)}</select>
      <select aria-label={t('Chart range')} value={range} onChange={e=>setRange(Number(e.target.value))} className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink outline-none focus:border-brand">{[6,8,12].map(count=><option key={count} value={count}>{t('Last months',{count})}</option>)}</select>
    </div>}/>
    {hasPickedBackup()&&<Card className="border-brand/20 bg-brand-50 p-4 text-[13px]"><button onClick={()=>onNavigate('settings')} className="text-start">{t('Backup selected; open Settings to finish importing')}</button></Card>}
    <SubscriptionAttentionBanner compact onOpen={()=>onNavigate('subscriptions')}/>
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[14px] font-bold">{t('Today and next 7 days')}</h2>
          <p className="text-[12px] text-muted">{t('Notes, due invoices and renewals coming up.')}</p>
        </div>
        <Btn variant="ghost" size="sm" onClick={()=>onNavigate('calendar')}>{t('Calendar')}</Btn>
      </div>
      {upcoming.length===0
        ? <p className="py-3 text-[13px] text-muted">{t('Nothing scheduled in the next 7 days.')}</p>
        : <ul className="divide-y divide-line">
          {upcoming.map((item:CalendarItem)=><li key={item.key}>
            <button onClick={()=>{setIntent(item.group==='notes'?'notebook':item.group==='invoices'?'invoices':item.group==='estimates'?'estimates':'subscriptions',item.id);onNavigate(item.group==='notes'?'notebook':item.group==='invoices'?'invoices':item.group==='estimates'?'estimates':'subscriptions')}} className="flex w-full min-h-12 items-center gap-3 py-2 text-start">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${item.overdue?'bg-serious-50 text-serious':'bg-brand-50 text-brand-700'}`}>
                <EventIcon item={item} className="h-4 w-4"/>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{item.detail}</span>
                <span className="block text-[11.5px] text-muted">{t(item.label)} · {formatDate(item.date,false,language)}{item.time?` ${item.time}`:''}</span>
              </span>
              {item.overdue&&<span className="rounded-full bg-serious-50 px-2 py-0.5 text-[11px] font-semibold text-serious">{t('Overdue')}</span>}
            </button>
          </li>)}
          {upcomingTotal>upcoming.length&&<li className="pt-2 text-[12px] text-muted">{t('{count} items in the next 7 days',{count:upcomingTotal})}</li>}
        </ul>}
    </Card>
    {overdue&&<Card className="border-warn/20 bg-warn-50 p-4 text-[13px] text-warn"><button onClick={()=>onNavigate('settings')} className="text-start">{t('Backup reminder: no backup in the last 7 days. Open Settings → Backup & Restore to protect your data.')}</button></Card>}
    <div className="grid gap-3 sm:grid-cols-3">{quick.map(action=><button key={action.key} onClick={()=>onNavigate(action.key)} className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-start shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-md"><span className={`grid h-10 w-10 place-items-center rounded-lg ${action.tint}`}><action.icon className="h-5 w-5"/></span><span className="text-[13.5px] font-semibold">{t(action.label)}</span></button>)}</div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(metric=><Card key={metric.label} className="p-5"><div className="flex items-start justify-between"><span className={`grid h-9 w-9 place-items-center rounded-lg ${metric.tint}`}><metric.icon className="h-4.5 w-4.5" strokeWidth={2.2}/></span><span className="text-[11.5px] font-semibold text-muted">{currency}</span></div><p className="mt-4 text-[12px] font-medium text-muted">{t(metric.label)}</p><p className="tnum mt-1 text-[22px] font-bold leading-none tracking-tight break-words">{money(metric.value,currency)}</p><p className="mt-1.5 text-[11.5px] text-muted">{metric.hint}</p></Card>)}</div>
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="min-w-0 p-5 lg:col-span-2"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[14px] font-bold">{t('Financial flow')}</h2><p className="text-[12px] text-muted">{t('Revenue vs expenses')} · {currency}</p></div><Legend series={series}/></div><AreaChart label={t('Financial flow')} labels={data.labels} series={series} format={value=>money(value,currency,true)}/></Card>
      <Card className="min-w-0 p-5"><h2 className="text-[14px] font-bold">{t('Expense breakdown')}</h2><p className="mb-4 text-[12px] text-muted">{t('Positive expenses by category')} · {currency}</p><Donut label={t('Expense breakdown')} percent={value=>new Intl.NumberFormat(locale(),{style:'percent',maximumFractionDigits:0}).format(value)} segments={data.categories.map((row,i)=>({...row,label:t(row.label),color:`var(--chart-${i%4+1})`}))}/>{!data.categories.length&&<p className="mt-3 text-[12px] text-muted">{t('No expenses yet')}</p>}</Card>
    </div>
    <Card className="min-w-0 p-5"><div className="mb-3"><h2 className="text-[14px] font-bold">{t('Monthly net flow')}</h2><p className="text-[12px] text-muted">{t('Revenue minus expenses')} · {currency}</p></div><BarChart label={t('Monthly net flow')} labels={data.labels} series={[{name:t('Net Profit'),values:data.net}]} format={value=>money(value,currency,true)}/></Card>
    <details className="rounded-xl border border-line bg-surface p-4 text-[12px]"><summary className="cursor-pointer font-semibold">{t('Chart data')}</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-start"><thead><tr>{['Month','Revenue','Expenses','Net Profit'].map(key=><th key={key} className="p-2 text-start text-muted">{t(key)}</th>)}</tr></thead><tbody>{data.labels.map((label,i)=><tr key={data.keys[i]} className="border-t border-line"><td className="p-2">{label}</td>{[data.revenue[i],data.expense[i],data.net[i]].map((value,j)=><td key={j} className="tnum p-2">{money(value,currency)}</td>)}</tr>)}</tbody></table></div></details>
    <Card><header className="flex items-center justify-between border-b border-line px-5 py-3.5"><h2 className="text-[14px] font-bold">{t('Recent Invoices')}</h2><Btn variant="ghost" size="sm" onClick={()=>onNavigate('invoices')}>{t('Invoices')}</Btn></header>{!invoices.length?<p className="px-5 py-8 text-center text-[13px] text-muted">{t('No invoices yet')}</p>:<ul className="divide-y divide-line">{invoices.slice(0,5).map(invoice=><li key={invoice.id} className="flex items-center gap-3 px-5 py-3 text-[13px]"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${invoice.status==='paid'?'bg-good-50 text-emerald-700 ring-good/20':'bg-warn-50 text-warn ring-warn/20'}`}>{t(invoice.status)}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{invoice.number}</p><p className="truncate text-[12px] text-muted">{customers.find(row=>row.id===invoice.customerId)?.name} · {formatDate(invoice.occurredAt??invoice.createdAt,true)}</p></div><span className="tnum font-semibold">{money(invoice.total,invoice.currency)}</span></li>)}</ul>}</Card>
    <div className="grid gap-3 sm:grid-cols-2">{[{key:'customers' as const,label:'Customers',count:customers.length,icon:Users},{key:'products' as const,label:'Products',count:products.length,icon:Package}].map(item=><button key={item.key} onClick={()=>onNavigate(item.key)} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-[13px] text-start"><item.icon className="h-4 w-4 text-brand"/><span>{t(item.label)}</span><span className="tnum ms-auto font-semibold">{number(item.count)}</span></button>)}</div>
  </div>
}
