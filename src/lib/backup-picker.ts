import type { ImportMode } from './backup-format'
// A File handle, not decrypted data. Android's chooser can background/lock the
// app and unmount React; an independent DOM listener safely retains the handoff.
let picked:{file:File;mode:ImportMode}|null=null
const listeners=new Set<()=>void>()
export const hasPickedBackup=()=>!!picked
export const subscribePickedBackup=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn)}}
export function takePickedBackup(){const result=picked;picked=null;return result}
export function chooseBackupFile(mode:ImportMode){
  const input=document.createElement('input')
  input.type='file';input.accept='.fatorati,.json';input.hidden=true
  const cleanup=()=>input.remove()
  input.addEventListener('change',()=>{
    const file=input.files?.[0]
    if(file){picked={file,mode};listeners.forEach(fn=>fn())}
    cleanup()
  },{once:true})
  input.addEventListener('cancel',cleanup,{once:true})
  document.body.appendChild(input);input.click()
}

/** Same handoff rules as backups: Android's chooser can unmount React. */
let pickedExport:File|null=null
export const takePickedExport=()=>{const file=pickedExport;pickedExport=null;return file}
export const subscribePickedExport=subscribePickedBackup
export function chooseExportFile(){
  const input=document.createElement('input')
  input.type='file';input.accept='.fatorati-export,application/json';input.hidden=true
  const cleanup=()=>input.remove()
  input.addEventListener('change',()=>{pickedExport=input.files?.[0]||null;listeners.forEach(fn=>fn());cleanup()},{once:true})
  input.addEventListener('cancel',cleanup,{once:true})
  document.body.appendChild(input);input.click()
}

let pickedLogo:File|null=null
export const takePickedLogo=()=>{const file=pickedLogo;pickedLogo=null;return file}
export const subscribePickedLogo=subscribePickedBackup
export function chooseLogoFile(){
  const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg';input.hidden=true
  input.addEventListener('change',()=>{pickedLogo=input.files?.[0]||null;listeners.forEach(fn=>fn());input.remove()},{once:true})
  input.addEventListener('cancel',()=>input.remove(),{once:true});document.body.appendChild(input);input.click()
}
