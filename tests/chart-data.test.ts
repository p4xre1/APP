import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { chartData } from '../src/lib/chart-data'
import { AreaChart, BarChart, Donut } from '../src/components/charts'
import { fixture } from './fixtures'

test('chart buckets separate currencies, use the chosen zone and retain minor-unit precision',()=>{
  const source=fixture(),now=Date.UTC(2026,8,20),edge=Date.UTC(2026,8,1,0,30)
  const invoices=[{...source.invoices[0],currency:'KWD',total:1.235,occurredAt:edge},{...source.invoices[0],currency:'JPY',total:999,occurredAt:edge}]
  const expenses=[{...source.expenses[0],currency:'KWD',amount:.1,occurredAt:edge},{...source.expenses[0],currency:'KWD',amount:.2,occurredAt:edge}]
  const result=chartData(invoices,expenses,'KWD',2,now,'America/New_York','en','USD')
  assert.deepEqual(result.keys,['2026-08','2026-09']);assert.deepEqual(result.revenue,[1.235,0]);assert.deepEqual(result.expense,[.3,0]);assert.deepEqual(result.net,[.935,0]);assert.equal(result.categories[0].value,.3)
  assert.deepEqual(chartData(invoices,expenses,'KWD',2,now,'UTC','en').revenue,[0,1.235])
})
test('empty charts have no seeded numbers; positive-only donut does not treat refunds as spending',()=>{
  const now=Date.UTC(2026,8,20),source=fixture()
  const empty=chartData([],[],'USD',8,now,'UTC','ar-u-nu-arab')
  assert.equal(empty.labels.length,8);assert.ok(empty.net.every(x=>x===0));assert.deepEqual(empty.categories,[])
  const data=chartData([],[{...source.expenses[0],currency:'USD',amount:-5,occurredAt:now}],'USD',6,now,'UTC','en')
  assert.equal(data.expense.at(-1),-5);assert.equal(data.net.at(-1),5);assert.deepEqual(data.categories,[])
})
test('chart SVG renders negative bars, zero bars and empty donuts without invalid geometry (no browser)',()=>{
  const props={label:'Net',labels:['Jan','Feb','Mar'],series:[{name:'Net',values:[-40,0,20]}]}
  for(const component of [AreaChart,BarChart]){
    const svg=renderToStaticMarkup(createElement(component,props))
    assert.doesNotMatch(svg,/NaN|Infinity|height="-/);assert.match(svg,/role="img"/);assert.match(svg,/>-50</)
    if(component===AreaChart){
      const path=svg.match(/d="M [\d.]+ ([\d.]+) L [\d.]+ ([\d.]+) L [\d.]+ ([\d.]+)/)!
      assert.ok(Number(path[1])>Number(path[2])&&Number(path[2])>Number(path[3]))
    } else {
      const bars=[...svg.matchAll(/<rect[^>]+width="26"[^>]+height="([\d.]+)"/g)].map(match=>Number(match[1]))
      assert.equal(bars.length,3);assert.equal(bars[1],0);assert.ok(bars[0]>0&&bars[2]>0)
      assert.ok(Math.abs(bars[0]-2*bars[2])<1e-9)
    }
  }
  const empty=renderToStaticMarkup(createElement(Donut,{segments:[],label:'Expenses'}))
  assert.doesNotMatch(empty,/NaN|Infinity/);assert.match(empty,/var\(--color-line\)/)
})
