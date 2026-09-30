import type { Invoice, Expense } from '../store/types'
import { getPreferences } from './preferences'
import { sumMoney, roundMoney, money } from './format'
export function totalsByCurrency(rows: {currency?:string;amount:number}[]) {
  const groups=new Map<string,number[]>()
  for(const row of rows){const currency=row.currency||getPreferences().defaultCurrency;groups.set(currency,[...(groups.get(currency)||[]),row.amount])}
  return [...groups].map(([currency,amounts])=>({currency,total:sumMoney(amounts,currency)}))
}
export function reportTotals(invoices:Invoice[],expenses:Expense[],defaultCurrency=getPreferences().defaultCurrency) {
  const currencies=[...new Set([...invoices,...expenses].map(row=>row.currency||defaultCurrency))]
  const totals=currencies.map(currency=>{
    const revenue=sumMoney(invoices.filter(row=>row.status==='paid'&&(row.currency||defaultCurrency)===currency).map(row=>row.total),currency)
    const pending=sumMoney(invoices.filter(row=>row.status==='sent'&&(row.currency||defaultCurrency)===currency).map(row=>row.total),currency)
    const spent=sumMoney(expenses.filter(row=>(row.currency||defaultCurrency)===currency).map(row=>row.amount),currency)
    const tax=sumMoney(invoices.filter(row=>(row.currency||defaultCurrency)===currency).map(row=>row.tax||0),currency)
    const counts={paid:0,sent:0,overdue:0,draft:0,total:invoices.length}
    for(const row of invoices.filter(row=>(row.currency||defaultCurrency)===currency)) counts[row.status]=(counts[row.status]||0)+1
    return {currency,revenue,pending,expenses:spent,tax,counts,profit:sumMoney([revenue,-spent],currency)}
  })
  let missing=0
  const converted:number[]=[]
  for(const row of [...invoices.filter(row=>row.status==='paid'),...expenses]) {
    const amount='total' in row?row.total:-row.amount
    if((row.currency||defaultCurrency)===defaultCurrency)converted.push(amount)
    else if(row.exchangeRate && row.rateCurrency===defaultCurrency)converted.push(roundMoney(amount*row.exchangeRate,defaultCurrency))
    else missing++
  }
  return {totals,converted:sumMoney(converted,defaultCurrency),missing}
}
