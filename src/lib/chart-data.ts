import type { Invoice, Expense } from '../store/types'
import { sumMoney } from './format'

/** Billing-month buckets in the selected zone. Never combine currencies or seed fake values. */
export function chartData(invoices:Invoice[], expenses:Expense[], currency:string, months:number, now:number, timeZone:string, locale:string, defaultCurrency=currency) {
  const formatter=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit'})
  const key=(timestamp:number)=>{const p=formatter.formatToParts(timestamp);return `${p.find(x=>x.type==='year')!.value}-${p.find(x=>x.type==='month')!.value}`}
  const [year,month]=key(now).split('-').map(Number)
  const dates=Array.from({length:months},(_,i)=>new Date(Date.UTC(year,month-months+i,15)))
  const keys=dates.map(date=>`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`)
  const labels=dates.map(date=>new Intl.DateTimeFormat(locale,{timeZone:'UTC',calendar:'gregory',month:'short',year:'2-digit'}).format(date))
  const paid=invoices.filter(row=>row.status==='paid'&&(row.currency||defaultCurrency)===currency)
  const spent=expenses.filter(row=>(row.currency||defaultCurrency)===currency)
  const revenue=keys.map(month=>sumMoney(paid.filter(row=>key(row.occurredAt??row.createdAt)===month).map(row=>row.total),currency))
  const expense=keys.map(month=>sumMoney(spent.filter(row=>key(row.occurredAt??row.createdAt)===month).map(row=>row.amount),currency))
  const grouped=new Map<string,number[]>()
  for(const row of spent)if(row.amount>0&&keys.includes(key(row.occurredAt??row.createdAt)))grouped.set(row.category,[...(grouped.get(row.category)||[]),row.amount])
  const categories=[...grouped].map(([label,amounts])=>({label,value:sumMoney(amounts,currency)})).sort((a,b)=>b.value-a.value)
  return {labels,keys,revenue,expense,net:revenue.map((value,i)=>sumMoney([value,-expense[i]],currency)),categories}
}
