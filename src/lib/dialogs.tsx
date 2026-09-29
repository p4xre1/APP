import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import { isUnlocked, subscribeLock } from './vault'
interface Message { text:string; confirm:boolean; action?:string; check?:{label:string;value:boolean}; resolve:(value:boolean)=>void }
let current:Message|null=null
const pending:Message[]=[]
const listeners=new Set<()=>void>()
const publish=()=>listeners.forEach(fn=>fn())
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn)}}
function finish(value:boolean){current?.resolve(value);current=pending.shift()||null;publish()}
function enqueue(message:Omit<Message,'resolve'>) {
  return new Promise<boolean>(resolve=>{const item={...message,resolve};if(current)pending.push(item);else{current=item;publish()}})
}
export const askConfirm=(text:string)=>enqueue({text,confirm:true})
/** One-time notice with a "don't show again" checkbox. */
export const askWarning=(text:string,action:string,checkLabel:string)=>{
  const message={text,confirm:true,action,check:{label:checkLabel,value:false}}
  return enqueue(message).then(ok=>({confirmed:ok,dontShow:ok&&message.check.value}))
}
export const showAlert=async(text:string)=>{await enqueue({text,confirm:false})}
export function DialogHost(){
  const {t}=useI18n(),message=useSyncExternalStore(subscribe,()=>current),ref=useRef<HTMLDialogElement>(null),[checked,setChecked]=useState(false)
  useEffect(()=>{if(message&&!ref.current?.open)ref.current?.showModal();else if(!message)ref.current?.close()},[message])
  useEffect(()=>{setChecked(false)},[message])
  useEffect(()=>subscribeLock(()=>{if(!isUnlocked()){for(const item of pending.splice(0))item.resolve(false);finish(false)}}),[])
  return <dialog ref={ref} aria-label={t('Fatorati')} onCancel={e=>{e.preventDefault();finish(false)}} className="rounded-xl bg-surface text-ink border border-line p-5 max-w-sm w-[calc(100%-2rem)] backdrop:bg-black/60 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    {message&&<><p className="text-[13px] whitespace-pre-wrap">{message.text}</p>
    {message.check&&<label className="flex items-center gap-2 mt-3 text-[13px] text-ink"><input type="checkbox" checked={checked} onChange={e=>{setChecked(e.target.checked);if(current?.check)current.check.value=e.target.checked}}/>{message.check.label}</label>}
    <div className="flex justify-end gap-2 mt-4">
      {message.confirm&&<button autoFocus onClick={()=>finish(false)} className="bg-canvas text-ink px-4 py-2 rounded-lg text-[13px] font-medium">{t('Cancel')}</button>}
      <button autoFocus={!message.confirm} onClick={()=>finish(true)} className="bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{message.action?t(message.action):t(message.confirm?'Confirm':'OK')}</button>
    </div></>}
  </dialog>
}
