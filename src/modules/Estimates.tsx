import { Plus, Share2 } from 'lucide-react'
import { showAlert } from '../lib/dialogs'
import { useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import { money, number, roundMoney, formatDate } from '../lib/format'
import { generateEstimateNumber } from '../lib/fatorati'
import { getPreferences } from '../lib/preferences'
import { shareInvoicePdf } from '../lib/invoice-pdf'
import { useI18n, errorText } from '../i18n'
import DocumentOptions from '../components/DocumentOptions'
export default function Estimates(){
  const {t}=useI18n(),{estimates,customers,business,addEstimate,updateEstimate}=useFatorati()
  const [showAdd,setShowAdd]=useState(false),[busy,setBusy]=useState(false)
  const [form,setForm]=useState({customerId:'',description:'',quantity:1,unitPrice:0,notes:'',currency:getPreferences().defaultCurrency,language:getPreferences().language,pdfColor:getPreferences().pdfColor,exchangeRate:undefined as number|undefined,rateCurrency:undefined as string|undefined})
  const save=async()=>{
    if(!form.customerId||!form.description.trim())return
    setBusy(true)
    try{
      const unitPrice=roundMoney(form.unitPrice,form.currency),total=roundMoney(form.quantity*unitPrice,form.currency)
      await addEstimate({number:generateEstimateNumber(),customerId:form.customerId,currency:form.currency,language:form.language,pdfColor:form.pdfColor,exchangeRate:form.exchangeRate,rateCurrency:form.rateCurrency,items:[{id:crypto.randomUUID(),description:form.description,quantity:form.quantity,unitPrice,total}],subtotal:total,tax:0,total,status:'draft',issueDate:new Date().toISOString().slice(0,10),expiryDate:new Date(Date.now()+30*86400_000).toISOString().slice(0,10),notes:form.notes})
      setShowAdd(false)
    }catch(e){showAlert(errorText(e))}finally{setBusy(false)}
  }
  return <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-ink">{t('Estimates')}</h1>
        <p className="text-[13px] text-muted mt-1">{number(estimates.length)} {t('estimates • 100% offline')}</p>
      </div>
      <button onClick={()=>setShowAdd(!showAdd)} className="bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg flex items-center gap-2 text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm"><Plus className="w-4 h-4" />{t('Create Estimate')}</button>
    </div>
    {showAdd&&<div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="text-[14px] font-bold text-ink mb-4">{t('Create Estimate')}</h2>
      <div className="space-y-4">
        <DocumentOptions value={form} onChange={patch=>setForm({...form,...patch})}/>
        <label className="block">
          <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Customer')}</span>
          <select aria-label={t('Customer')} value={form.customerId} onChange={e=>setForm({...form,customerId:e.target.value})} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15"><option value="">{t('Select customer')}</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Description')}</span>
          <input aria-label={t('Description')} placeholder={t('Description')} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15"/>
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Quantity')}</span>
          <input type="number" min="0" step="any" value={form.quantity} onChange={e=>setForm({...form,quantity:Number(e.target.value)})} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15"/>
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Unit price')}</span>
          <input type="number" min="0" step="any" value={form.unitPrice} onChange={e=>setForm({...form,unitPrice:Number(e.target.value)})} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15"/>
        </label>
        <button disabled={busy} onClick={()=>void save()} className="w-full bg-brand hover:bg-brand-700 text-white py-2.5 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{t('Save')}</button>
      </div>
    </div>}
    <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {estimates.length === 0 ? <div className="text-center py-12">
        <p className="text-muted text-[13px]">{t('No estimates yet')}</p>
        <p className="text-[12px] text-faint mt-1">{t('Estimates will appear here')}</p>
      </div> : <div className="divide-y divide-line">
        {estimates.map(est=><div key={est.id}>
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-[13px] text-ink">{est.number}</p>
              <p className="text-[12px] text-muted">{customers.find(c=>c.id===est.customerId)?.name} • {t(est.status)}</p>
            </div>
            <p className="font-bold text-[13px]">{money(est.total,est.currency,false,est.language)}</p>
          </div>
          <details className="px-4 pb-4">
            <summary className="text-[12px] cursor-pointer text-muted">{t('Document options')}</summary>
            <div className="space-y-4 mt-4">
              <p className="text-[12px] text-muted">{formatDate(est.occurredAt||est.createdAt,true,est.language)}</p>
              <DocumentOptions value={est} onChange={patch=>void updateEstimate(est.id,patch).catch(e=>showAlert(errorText(e)))}/>
              <button disabled={busy} onClick={async()=>{setBusy(true);try{await shareInvoicePdf(est,business,customers.find(c=>c.id===est.customerId),est.currency)}catch(e){showAlert(errorText(e))}finally{setBusy(false)}}} className="text-brand text-[13px] flex items-center gap-2"><Share2 className="w-4 h-4" />{t('Share PDF')}</button>
            </div>
          </details>
        </div>)}
      </div>}
    </div>
  </div>
}
