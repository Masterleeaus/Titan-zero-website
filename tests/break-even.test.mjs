// Regression tests for the public break-even calculator (#23).
// Evaluate only its literal pure calculator definitions, with no DOM or network.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const text=readFileSync(new URL('../assets/tools.js', import.meta.url),'utf8');
const start=text.indexOf('const defaults={');
const end=text.indexOf('\n};',start);
assert.ok(start!==-1&&end>start,'calculator registry must exist');
const source=text.slice(start+'const defaults='.length,end+2);
const formats={
  money(n){return 'A$'+Number(n).toFixed(2);},
  number(n){return String(n);}
};
const defaults=runInNewContext('('+source+')',formats);
test('normal contribution calculates rounded-up count',()=>{
  const r=defaults.breakeven.calc({fixed:12000,price:450,variable:180});
  assert.equal(r.metric,45);
  assert.equal(r.format,'count');
});
test('non-positive contribution with positive fixed cost is impossible',()=>{
  for(const [price,variable] of [[100,100],[80,100],[0,0]]){
    const r=defaults.breakeven.calc({fixed:12000,price,variable});
    assert.equal(r.metric,null);
    assert.equal(r.format,'unavailable');
    assert.match(r.label,/No break-even/i);
  }
});
test('zero fixed costs require no jobs regardless of margin',()=>{
  for(const [price,variable] of [[100,100],[20,100],[300,100]]){
    const r=defaults.breakeven.calc({fixed:0,price,variable});
    assert.equal(r.metric,0);
    assert.equal(r.format,'count');
  }
});
test('unavailable result is displayed as words rather than coerced to zero',()=>{
  assert.match(text,/outcome\.format==='unavailable'\?'Not achievable'/);
  assert.match(text,/result:displayed\+' — '/);
});
