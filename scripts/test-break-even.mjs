// Regression scenarios for the free public break-even calculator.
// Extracts the actual source formula to prevent a duplicated test-only implementation.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { strict as assert } from 'node:assert';
const source=readFileSync(new URL('../assets/tools.js',import.meta.url),'utf8');
const from=source.indexOf('const defaults={');
const until=source.indexOf('\n};\nfunction readProfile',from);
assert.ok(from>=0 && until>from, 'calculator definitions available');
const definitions=source.slice(from,until+3);
const calc=runInNewContext(definitions+'\ndefaults.breakeven.calc;',{
  money:(n)=>'A$'+Number(n).toFixed(2),
  number:(n)=>String(n),
});
const cases=[
  [{fixed:12000,price:450,variable:180},45,'count'],
  [{fixed:12000,price:180,variable:180},null,'unavailable'],
  [{fixed:12000,price:100,variable:180},null,'unavailable'],
  [{fixed:0,price:180,variable:180},0,'count'],
  [{fixed:0,price:100,variable:180},0,'count'],
];
for(const [inputs,metric,format] of cases){
  const actual=calc(inputs);
  assert.equal(actual.metric,metric,JSON.stringify(inputs));
  assert.equal(actual.format,format,JSON.stringify(inputs));
  assert.ok(!actual.math.includes('÷ (A$180.00 − A$180.00)'), 'avoid division-by-zero explanation');
}
console.log('PASS: five real break-even edge-case scenarios');
