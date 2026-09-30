import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defaultPreferences } from '../src/lib/preferences'
function sources(directory: string): string[] {
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?sources(join(directory,entry.name)):[join(directory,entry.name)])
}
const read=(file:string)=>readFileSync(file,'utf8')
test('all src files, five dictionaries and export text contain zero emoji',()=>{
  const emoji=/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\uFE0F\u20E3]/u
  for(const file of sources('src')) {
    const text=read(file).replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})/gi,(_,a:string,b:string)=>String.fromCodePoint(parseInt(a||b,16)))
    assert.equal(emoji.test(text),false,file)
  }
})
test('FatooraLaw 2400f72 light tokens match; dark mode changes colors, not structure',()=>{
  const css=read('src/index.css'),theme=css.slice(css.indexOf('@theme'),css.indexOf('\n:root'))
  const tokens:Record<string,string>={ink:'#0b1220',canvas:'#f4f6f9',surface:'#ffffff',line:'#e5e8ee','line-strong':'#d3d8e2',muted:'#475569',faint:'#5b6b80',brand:'#2563eb','brand-50':'#eef3ff','brand-100':'#dbe6ff','brand-700':'#1d4ed8',navy:'#0f172a',sidebar:'#0f172a','sidebar-hover':'#1e293b','sidebar-active':'#2563eb','sidebar-ink':'#cbd5e1','sidebar-faint':'#94a3b8',good:'#10b981','emerald-brand':'#047857',warn:'#b45309',serious:'#b91c1c'}
  for(const [name,value] of Object.entries(tokens))assert.ok(theme.includes(`--color-${name}: ${value};`),name)
  for(const [i,color] of ['#2563eb','#10b981','#f59e0b','#8b5cf6'].entries())assert.ok(theme.includes(`--chart-${i+1}: ${color};`))
  const dark=css.match(/:root\[data-theme="dark"\] \{([^}]+)\}/)![1]
  assert.doesNotMatch(dark,/\b(padding|margin|height|width|display|font-size|border-radius):/)
  assert.equal(defaultPreferences.theme,'light');assert.equal(defaultPreferences.accent,'#2563eb')
  assert.match(css,/\[dir='rtl'\]/)
})
test('reference fonts are local WOFF2 with licenses; no remote fonts or style imports',()=>{
  const css=read('src/fonts.css')
  for(const family of ['Inter','Tajawal','Sora','JetBrains Mono'])assert.ok(css.includes(`font-family: '${family}'`))
  for(const [,name] of css.matchAll(/url\('\/fonts\/([^']+)'\)/g))assert.equal(readFileSync('public/fonts/'+name).subarray(0,4).toString(),'wOF2')
  assert.equal([...css.matchAll(/url\(/g)].length,14)
  for(const family of ['inter','tajawal','sora','jetbrains-mono'])assert.match(read(`public/fonts/${family}-LICENSE.txt`),/SIL OPEN FONT LICENSE/i)
  assert.doesNotMatch(css+read('src/index.css'),/@import\s+url|https?:\/\//)
})
test('reference kit, fields, sidebar and infographics use shared semantic styles',()=>{
  const kit=read('src/components/kit.tsx')
  assert.ok(kit.includes('shadow-[0_1px_2px_rgba(15,23,42,0.04)]'))
  assert.ok(kit.includes('text-[20px] font-bold tracking-tight text-ink'))
  for(const name of ['PreferencesPanel','SecurityPanel','SecurityGate','LanguagePicker','CurrencyPicker']){
    const source=read(`src/components/${name}.tsx`)
    assert.ok(source.includes('border-line-strong'),name)
    assert.ok(source.includes('text-[13.5px]'),name)
    assert.ok(source.includes('uppercase tracking-[0.06em]'),name)
  }
  const shell=read('src/components/AppShell.tsx'),dashboard=read('src/modules/Dashboard.tsx')
  for(const name of ['dashboard','customers','projects','invoices','estimates','expenses','products','reports','settings'])assert.ok(shell.includes(`key:'${name}'`))
  assert.ok(shell.includes('lg:flex'));assert.ok(shell.includes('showModal()'))
  for(const chart of ['AreaChart','BarChart','Donut'])assert.ok(dashboard.includes(`<${chart}`))
  assert.ok(dashboard.includes('chartData(invoices,expenses,currency'))
})
