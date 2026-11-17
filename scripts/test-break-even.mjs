// Break-even scenarios (#23) run against the shared engine in assets/tools-engine.js.
// The old version extracted source text from tools.js; the engine is now a pure module.
import { createRequire } from 'node:module';
import { strict as assert } from 'node:assert';
const require = createRequire(import.meta.url);
const { calculators, validate } = require('../assets/tools-engine.js');
const calc = calculators.breakeven;
const cases = [
  [{ fixed: 12000, price: 450, variable: 180 }, 45, 'count'],
  [{ fixed: 12000, price: 180, variable: 180 }, null, 'unavailable'],
  [{ fixed: 12000, price: 100, variable: 180 }, null, 'unavailable'],
  [{ fixed: 0, price: 180, variable: 180 }, 0, 'count'],
  [{ fixed: 0, price: 100, variable: 180 }, 0, 'count'],
];
for (const [inputs, metric, format] of cases) {
  const actual = calc(inputs);
  assert.equal(actual.metric, metric, JSON.stringify(inputs));
  assert.equal(actual.format, format, JSON.stringify(inputs));
  assert.ok(!actual.math.includes('÷ (A$180.00 − A$180.00)'), 'avoid division-by-zero explanation');
}
assert.equal(validate('breakeven', { fixed: 12000, price: 450, variable: 'NaN' }).ok, false);
console.log('PASS: five break-even edge-case scenarios and invalid-input rejection');
