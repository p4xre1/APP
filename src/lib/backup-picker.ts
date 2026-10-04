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

/** Which business image the file dialog was opened for. */
export type ImageTarget='logo'|'stamp'
export interface PickedLogo{file:File;target:ImageTarget}

let pickedLogo:PickedLogo|null=null
const logoListeners=new Set<()=>void>()
export const takePickedLogo=()=>{const result=pickedLogo;pickedLogo=null;return result}
// Its own listener set: a logo pick must never wake the backup import listeners.
export const subscribePickedLogo=(fn:()=>void)=>{logoListeners.add(fn);return()=>{logoListeners.delete(fn)}}
/**
 * The handoff of one picked image. The target travels WITH the file (the same shape
 * the backup picker uses), so a listener never has to remember, in a closure, which
 * button opened the dialog - the bug that silently dropped every chosen logo.
 * Exported for the tests; `chooseLogoFile` is the only caller in the app.
 */
export function pickLogo(file:File|undefined,target:ImageTarget){
  pickedLogo=file?{file,target}:null
  logoListeners.forEach(fn=>fn())
}
export function chooseLogoFile(target:ImageTarget){
  const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg';input.hidden=true
  input.addEventListener('change',()=>{pickLogo(input.files?.[0],target);input.remove()},{once:true})
  input.addEventListener('cancel',()=>input.remove(),{once:true});document.body.appendChild(input);input.click()
}
