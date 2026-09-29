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
import NumberInput from '../components/NumberInput'
import { Field, TextField, fieldInputClass } from '../components/Field'
import { numberError } from '../lib/number-input'

export default function Estimates(){
  const {t}=useI18n(),{estimates,customers,business,addEstimate,updateEstimate}=useFatorati()
  const [showAdd,setShowAdd]=useState(false),[busy,setBusy]=useState(false)
  const [errors,setErrors]=useState<{customerId?:string;description?:string;quantity?:string;unitPrice?:string}>({})
  const [form,setForm]=useState({customerId:'',description:'',quantity:null as number|null,unitPrice:null as number|null,notes:'',currency:getPreferences().defaultCurrency,language:getPreferences().language,pdfColor:getPreferences().pdfColor,exchangeRate:undefined as number|undefined,rateCurrency:undefined as string|undefined})
  const save=async()=>{
    const next={
      customerId: form.customerId ? undefined : 'Required field',
      description: form.description.trim() ? undefined : 'Required field',
      quantity: numberError(form.quantity,{required:true,min:0})||undefined,
      unitPrice: numberError(form.unitPrice,{required:true,min:0})||undefined,
    }
    setErrors(next)
    if(Object.values(next).some(Boolean))return
    setBusy(true)
    try{
      const quantity=form.quantity??0, rawPrice=form.unitPrice??0
      const unitPrice=roundMoney(rawPrice,form.currency),total=roundMoney(quantity*unitPrice,form.currency)
      await addEstimate({number:generateEstimateNumber(),customerId:form.customerId,currency:form.currency,language:form.language,pdfColor:form.pdfColor,exchangeRate:form.exchangeRate,rateCurrency:form.rateCurrency,items:[{id:crypto.randomUUID(),description:form.description.trim(),quantity,unitPrice,total}],subtotal:total,tax:0,total,status:'draft',issueDate:new Date().toISOString().slice(0,10),expiryDate:new Date(Date.now()+30*86400_000).toISOString().slice(0,10),notes:form.notes})
      setForm({...form,customerId:'',description:'',quantity:null,unitPrice:null,notes:''})
      setErrors({})
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
    {showAdd&&<div className="bg-surface rounded-xl border border-line p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="text-[14px] font-bold text-ink mb-4">{t('Create Estimate')}</h2>
      <div className="space-y-4">
        <DocumentOptions value={form} onChange={patch=>setForm({...form,...patch})}/>
        <Field label={t('Customer')} required error={errors.customerId}>
          <select aria-label={t('Customer')} value={form.customerId} onChange={e=>setForm({...form,customerId:e.target.value})} className={fieldInputClass}><option value="">{t('Select customer')}</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </Field>
        <TextField label={t('Description')} required value={form.description} error={errors.description} hint={t('Line description')} placeholder={t('Service or product')} onChange={description=>setForm({...form,description})}/>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <NumberInput label={t('Quantity')} required value={form.quantity} min={0} error={errors.quantity} hint={t('Quantity')} onChange={quantity=>setForm({...form,quantity})}/>
          <NumberInput label={t('Unit price')} required value={form.unitPrice} min={0} error={errors.unitPrice} suffix={form.currency} hint={`${t('Unit price')} (${form.currency})`} onChange={unitPrice=>setForm({...form,unitPrice})}/>
        </div>
        <p className="text-[12px] text-muted">{t('Total')}: <span className="tnum font-semibold text-ink">{money(roundMoney((form.quantity??0)*roundMoney(form.unitPrice??0,form.currency),form.currency),form.currency)}</span></p>
        <button disabled={busy} onClick={()=>void save()} className="w-full bg-brand hover:bg-brand-700 text-white py-2.5 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{t('Save')}</button>
      </div>
    </div>}
    <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {estimates.length === 0 ? <div className="text-center py-12">
        <p className="text-muted text-[13px]">{t('No estimates yet')}</p>
        <p className="text-[12px] text-faint mt-1">{t('Estimates will appear here')}</p>
      </div> : <div className="divide-y divide-line">
        {estimates.map(est=><div key={est.id}>
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-[13px] text-ink break-words">{est.number}</p>
              <p className="text-[12px] text-muted break-words">{customers.find(c=>c.id===est.customerId)?.name} • {t(est.status)}</p>
            </div>
            <p className="tnum font-bold text-[13px] shrink-0">{money(est.total,est.currency,false,est.language)}</p>
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
