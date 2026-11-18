/* Titan business tools: pure calculation engine (#42, #23, #43).
 * No DOM, no network, no storage access. Every calculator is a pure function of
 * validated inputs. Money is handled as integer cents so that rounding is explicit.
 * Loaded before assets/tools.js on calculator pages; also loadable by Node tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TitanToolsEngine = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const PROFILE_VERSION = 3;
  const LEGACY_PROFILE_KEY = 'titanBusinessToolProfileV2';
  const PROFILE_KEY = 'titanBusinessToolProfileV3';
  const MAX_AMOUNT = 1e9;          // A$1 billion per money input; far above any small business entry
  const MAX_COUNT = 1e6;
  const MAX_TEXT = 120;
  const MAX_SAFE_CENTS = Number.MAX_SAFE_INTEGER;

  // ---- Money in integer cents -------------------------------------------------
  // Rounds half away from zero. The tiny nudge avoids binary artefacts such as 1.005 * 100 = 100.4999...
  function toCents(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) throw new RangeError('Amount must be a finite number');
    return Math.round(n * 100 + Math.sign(n) * 1e-7);
  }
  function fromCents(cents) { return cents / 100; }
  function safeCents(cents) {
    if (!Number.isSafeInteger(cents) || Math.abs(cents) > MAX_SAFE_CENTS) {
      throw new RangeError('Amount is too large to calculate exactly');
    }
    return cents;
  }
  function hasAtMostTwoDecimals(n) {
    return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
  }

  // en-AU display. Negative values use a true minus sign and are never shown as "A$-".
  function formatMoney(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return 'Not available';
    const body = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
      .format(Math.abs(n));
    return (n < 0 ? '−' : '') + 'A$' + body;
  }
  function formatNumber(n, digits = 0) {
    const value = Number(n);
    if (!Number.isFinite(value)) return 'Not available';
    return new Intl.NumberFormat('en-AU', { maximumFractionDigits: digits }).format(value);
  }

  // ---- Input rules -----------------------------------------------------------
  const rule = {
    money: (label, min = 0) => ({ kind: 'money', label, min, max: MAX_AMOUNT }),
    percent: (label) => ({ kind: 'number', label, min: 0, max: 100 }),
    number: (label, min, max) => ({ kind: 'number', label, min, max }),
    count: (label, min = 0) => ({ kind: 'number', label, min, max: MAX_COUNT }),
  };

  // Funnel stages and ageing buckets used by the live forms (#105). Defined before RULES, which reads them.
  const FUNNEL_STAGES = ['contacted', 'qualified', 'booked', 'completed'];
  const FUNNEL_LABELS = {
    contacted: 'leads contacted', qualified: 'contacted leads qualified',
    booked: 'qualified leads booked', completed: 'booked jobs completed',
  };
  const AGEING_BUCKETS = ['d0_30', 'd31_60', 'd61_90', 'd90'];
  const AGEING_LABELS = {
    d0_30: 'Unpaid from this month (0-30 days)', d31_60: 'Unpaid 31-60 days',
    d61_90: 'Unpaid 61-90 days', d90: 'Unpaid over 90 days',
  };
  const COLLECT_LABELS = { d0_30: '0-30 days', d31_60: '31-60 days', d61_90: '61-90 days', d90: '90+ days' };

  const RULES = {
    admin: {
      adminHours: rule.number('Admin hours each week', 0, 168),
      adminRate: rule.money('Loaded hourly cost'),
    },
    hire: {
      salary: rule.money('Annual salary'),
      oncost: rule.percent('Employment on-cost'),
      margin: rule.money('Average contribution per job'),
    },
    breakeven: {
      fixed: rule.money('Monthly fixed costs'),
      price: rule.money('Average job revenue'),
      variable: rule.money('Average variable cost'),
    },
    profit: {
      jobRevenue: rule.money('Job revenue'),
      labour: rule.money('Labour cost'),
      materials: rule.money('Materials'),
      travel: rule.money('Travel/other direct cost'),
    },
    capacity: {
      workers: rule.count('Field workers'),
      hours: rule.number('Productive hours per worker/week', 0, 168),
      duration: rule.number('Average job duration', 0.1, 24),
      currentJobs: rule.count('Current jobs per month'),
    },
    calls: {
      calls: rule.count('Calls/enquiries per month'),
      missed: rule.percent('Missed/unanswered rate'),
      convert: rule.percent('Likely conversion if answered'),
      jobValue: rule.money('Average job value'),
    },
    // Lead conversion and invoice collection use the live four-stage funnel and ageing buckets (#105).
    // Labels match the visible form fields so refusal messages name what the user sees.
    leads: {
      leads: rule.count('Leads per month'),
      value: rule.money('Average customer/job value'),
      contribPct: rule.percent('Contribution margin on that work'),
      ...Object.fromEntries(FUNNEL_STAGES.map((stage) => ['base_' + stage, rule.percent('Current: ' + FUNNEL_LABELS[stage])])),
      ...Object.fromEntries(FUNNEL_STAGES.map((stage) => ['alt_' + stage, rule.percent('Scenario: ' + FUNNEL_LABELS[stage])])),
    },
    invoice: {
      invoices: rule.count('Invoices per month'),
      avg: rule.money('Average invoice'),
      ...Object.fromEntries(AGEING_BUCKETS.map((bucket) => ['age_' + bucket, rule.percent(AGEING_LABELS[bucket])])),
      ...Object.fromEntries(AGEING_BUCKETS.map((bucket) => ['collect_' + bucket, rule.percent('Expected collection within 13 weeks: ' + COLLECT_LABELS[bucket])])),
      chase: rule.number('Hours/month chasing payment', 0, 744),
    },
    jobcost: {
      workers: rule.count('Workers'),
      hours: rule.number('Hours per worker', 0, 744),
      rate: rule.money('Hourly labour rate'),
      materials: rule.money('Materials'),
      travel: rule.money('Travel and vehicle'),
      other: rule.money('Other direct costs'),
      overhead: rule.money('Allocated overhead'),
      price: rule.money('Customer price'),
      target: rule.percent('Target margin'),
    },
  };

  // Returns { ok:true, values } with finite numbers, or { ok:false, errors:[{key,message}] }.
  // Rejects blanks, NaN, Infinity, negatives beyond the minimum, out-of-range values and
  // money amounts with more than two decimal places (no silent rounding of user input).
  function validate(toolKey, raw) {
    const rules = RULES[toolKey];
    if (!rules) return { ok: false, errors: [{ key: '', message: 'Unknown calculator' }] };
    const values = {};
    const errors = [];
    for (const [key, spec] of Object.entries(rules)) {
      const text = raw && raw[key] !== undefined && raw[key] !== null ? String(raw[key]).trim() : '';
      const n = text === '' ? NaN : Number(text);
      if (!Number.isFinite(n)) {
        errors.push({ key, message: spec.label + ' needs a number.' });
        continue;
      }
      if (n < spec.min || n > spec.max) {
        errors.push({ key, message: spec.label + ' must be between ' + spec.min + ' and ' + spec.max + '.' });
        continue;
      }
      if (spec.kind === 'money' && !hasAtMostTwoDecimals(n)) {
        errors.push({ key, message: spec.label + ' can have at most two decimal places.' });
        continue;
      }
      values[key] = n;
    }
    return errors.length ? { ok: false, errors } : { ok: true, values };
  }

  // ---- Calculators ------------------------------------------------------------
  // Each returns { metric, format, label, math, notes, suffix?, status }.
  // format: 'currency' (metric in dollars), 'count' (whole number), or 'unavailable' (metric null).

  function admin(v) {
    const monthly = safeCents(Math.round(v.adminHours * 52 / 12 * toCents(v.adminRate)));
    return {
      status: 'ok', metric: fromCents(monthly), format: 'currency',
      label: 'Estimated monthly admin labour value',
      math: v.adminHours + ' hrs/week × 52 ÷ 12 × ' + formatMoney(v.adminRate) + '/hr',
      notes: [
        'This is labour capacity value, not automatically cash savings.',
        'Use a loaded hourly cost if you want super, leave and overhead reflected.',
      ],
    };
  }

  function hire(v) {
    const monthlyCents = safeCents(Math.round(toCents(v.salary) * (1 + v.oncost / 100) / 12));
    const marginCents = toCents(v.margin);
    const jobs = marginCents > 0 ? Math.ceil(monthlyCents / marginCents) : null;
    return {
      status: 'ok', metric: fromCents(monthlyCents), format: 'currency',
      label: 'Estimated monthly employment cost',
      math: formatMoney(v.salary) + '/year × (1 + ' + v.oncost + '%) ÷ 12',
      notes: [
        jobs === null
          ? 'Enter a positive contribution per job to estimate the job count.'
          : 'At ' + formatMoney(v.margin) + ' contribution per job, about ' + formatNumber(jobs) + ' additional jobs/month would cover this cost.',
        'This is a cost threshold, not a recommendation to hire.',
      ],
    };
  }

  // Break-even (#23). Three distinct states:
  //  - zero fixed costs: 0 jobs needed, regardless of margin (not a profit claim);
  //  - positive fixed costs and contribution <= 0: no finite break-even exists ('unavailable');
  //  - positive fixed costs and contribution > 0: smallest whole job count, computed in integer cents.
  function breakeven(v) {
    const fixedC = toCents(v.fixed);
    const priceC = toCents(v.price);
    const variableC = toCents(v.variable);
    const contributionC = priceC - variableC;
    if (fixedC === 0) {
      return {
        status: 'ok', metric: 0, format: 'count', suffix: ' jobs/month',
        label: 'Jobs per month to cover fixed costs',
        math: 'No fixed costs entered (0 jobs required).',
        notes: [
          'Fixed costs are zero; this is not a claim that the service is profitable.',
          'Tax, financing and owner drawings are not included unless you put them into fixed costs.',
        ],
      };
    }
    if (contributionC <= 0) {
      return {
        status: 'unavailable', metric: null, format: 'unavailable', suffix: '',
        label: 'No break-even job count at these assumptions',
        math: 'No finite solution: the contribution per job is zero or negative.',
        notes: [
          'Average job revenue must exceed variable cost before a break-even job count can be calculated.',
          'Tax, financing and owner drawings are not included unless you put them into fixed costs.',
        ],
      };
    }
    const jobs = safeCents(Math.floor((fixedC + contributionC - 1) / contributionC));
    return {
      status: 'ok', metric: jobs, format: 'count', suffix: ' jobs/month',
      label: 'Jobs per month to cover fixed costs',
      math: formatMoney(v.fixed) + ' ÷ (' + formatMoney(v.price) + ' − ' + formatMoney(v.variable) + ')',
      notes: [
        'Contribution per job: ' + formatMoney(fromCents(contributionC)) + '.',
        'Tax, financing and owner drawings are not included unless you put them into fixed costs.',
      ],
    };
  }

  function profit(v) {
    const revenueC = toCents(v.jobRevenue);
    const contributionC = safeCents(revenueC - toCents(v.labour) - toCents(v.materials) - toCents(v.travel));
    const marginText = revenueC > 0
      ? 'Contribution margin: ' + formatNumber(contributionC / revenueC * 100, 1) + '%.'
      : 'Enter a job revenue above zero to calculate a margin.';
    return {
      status: 'ok', metric: fromCents(contributionC), format: 'currency',
      label: 'Contribution before overhead',
      math: formatMoney(v.jobRevenue) + ' − ' + formatMoney(v.labour) + ' − ' + formatMoney(v.materials) + ' − ' + formatMoney(v.travel),
      notes: [marginText, 'This is not net profit until overhead, tax and other costs are considered.'],
    };
  }

  function capacity(v) {
    const cap = v.workers * v.hours * 52 / 12 / v.duration;
    // Small epsilon stops binary floating point from dropping an exact whole job (e.g. 207.9999999).
    const whole = Math.floor(cap + 1e-9);
    const spare = whole - v.currentJobs;
    return {
      status: 'ok', metric: whole, format: 'count', suffix: ' jobs/month',
      label: 'Estimated jobs/month capacity',
      math: v.workers + ' workers × ' + v.hours + ' productive hrs/week × 52 ÷ 12 ÷ ' + v.duration + ' hrs/job',
      notes: [
        spare >= 0
          ? 'Approximate spare capacity: ' + formatNumber(spare) + ' jobs/month.'
          : 'Current volume is about ' + formatNumber(Math.abs(spare)) + ' jobs/month above this simple estimate.',
        'Travel, cancellations, skills and scheduling constraints can reduce real capacity.',
      ],
    };
  }

  function calls(v) {
    const missed = v.calls * v.missed / 100;
    const cents = safeCents(Math.round(missed * (v.convert / 100) * toCents(v.jobValue)));
    return {
      status: 'ok', metric: fromCents(cents), format: 'currency',
      label: 'Monthly revenue opportunity exposed',
      math: v.calls + ' × ' + v.missed + '% missed × ' + v.convert + '% conversion × ' + formatMoney(v.jobValue),
      notes: [
        'About ' + missed.toFixed(1) + ' enquiries/month are exposed under these assumptions.',
        'This is opportunity exposure, not revenue Titan or any receptionist can guarantee.',
      ],
    };
  }

  // Live four-stage funnel (#105): the lead-to-completed rate is the product of the stage shares.
  function funnelShare(v, prefix) {
    return FUNNEL_STAGES.reduce((rate, stage) => rate * v[prefix + '_' + stage] / 100, 1);
  }
  function leads(v) {
    const baseRate = funnelShare(v, 'base');
    const scenRate = funnelShare(v, 'alt');
    const cents = safeCents(Math.round(v.leads * (scenRate - baseRate) * toCents(v.value)));
    return {
      status: 'ok', metric: fromCents(cents), format: 'currency',
      label: 'Scenario revenue difference/month',
      math: v.leads + ' leads × (' + (scenRate * 100).toFixed(1) + '% − ' + (baseRate * 100).toFixed(1) + '%) × ' + formatMoney(v.value),
      notes: [
        'This shows what the selected conversion change would be worth.',
        'It does not claim that software, marketing or AI will cause that improvement.',
      ],
    };
  }

  // Beyond terms means unpaid 31 days or more (#105): the 31-60, 61-90 and 90+ buckets.
  function invoice(v) {
    const billedCents = safeCents(v.invoices * toCents(v.avg));
    const beyondShare = AGEING_BUCKETS.filter((b) => b !== 'd0_30').reduce((sum, b) => sum + v['age_' + b], 0);
    const overdueCents = safeCents(Math.round(billedCents * beyondShare / 100));
    return {
      status: 'ok', metric: fromCents(overdueCents), format: 'currency',
      label: 'Value typically beyond terms',
      math: v.invoices + ' × ' + formatMoney(v.avg) + ' × ' + beyondShare + '%',
      notes: [
        'Monthly invoicing represented: ' + formatMoney(fromCents(billedCents)) + '.',
        v.chase + ' hours/month are also spent on collection activity.',
        'Faster collection improves cash availability; it does not create new revenue.',
      ],
    };
  }

  // Quote lines: quantity 0 to 10,000 (any decimal), unit price 0 to MAX_AMOUNT with at most two decimals.
  function validateLines(lines) {
    const errors = [];
    const clean = [];
    lines.forEach((line, index) => {
      const q = Number(line.quantity);
      const u = Number(line.unit);
      const n = index + 1;
      if (!Number.isFinite(q) || q < 0 || q > 10000) errors.push({ key: 'line-' + n, message: 'Line ' + n + ' quantity must be between 0 and 10,000.' });
      else if (!Number.isFinite(u) || u < 0 || u > MAX_AMOUNT || !hasAtMostTwoDecimals(u)) errors.push({ key: 'line-' + n, message: 'Line ' + n + ' unit price must be between 0 and ' + MAX_AMOUNT + ' with at most two decimal places.' });
      else clean.push({ quantity: q, unit: u });
    });
    return errors.length ? { ok: false, errors } : { ok: true, lines: clean };
  }

  // Quote builder. lines: [{ quantity, unit }] with unit price in dollars.
  // GST is added on top of the discounted subtotal when includeGst is true.
  function quote({ lines, discountPercent = 0, includeGst = false }) {
    const discount = Math.min(100, Math.max(0, Number(discountPercent) || 0));
    let subtotalC = 0;
    for (const line of lines) {
      subtotalC = safeCents(subtotalC + safeCents(Math.round(Number(line.quantity) * toCents(line.unit))));
    }
    const discountC = safeCents(Math.round(subtotalC * discount / 100));
    const discountedC = subtotalC - discountC;
    const gstC = includeGst ? safeCents(Math.round(discountedC * 10 / 100)) : 0;
    const totalC = safeCents(discountedC + gstC);
    return {
      subtotal: fromCents(subtotalC), discount: -fromCents(discountC), gst: fromCents(gstC), total: fromCents(totalC),
      cents: { subtotal: subtotalC, discount: discountC, gst: gstC, total: totalC },
    };
  }

  // Splits a GST-inclusive total (Australian 10% GST) into ex-GST and GST amounts, in cents.
  function splitGstInclusive(totalAmount) {
    const totalC = toCents(totalAmount);
    const gstC = Math.round(totalC / 11);
    return { net: fromCents(totalC - gstC), gst: fromCents(gstC), total: fromCents(totalC) };
  }

  function jobCost(v) {
    const rateC = toCents(v.rate);
    const labourC = safeCents(Math.round(v.workers * v.hours * rateC));
    const materialsC = toCents(v.materials);
    const travelC = toCents(v.travel);
    const otherC = toCents(v.other);
    const overheadC = toCents(v.overhead);
    const priceC = toCents(v.price);
    const directC = safeCents(labourC + materialsC + travelC + otherC);
    const totalC = safeCents(directC + overheadC);
    const contributionC = safeCents(priceC - totalC);
    const marginPercent = priceC > 0 ? contributionC / priceC * 100 : 0;
    const targetPriceC = v.target < 100 ? safeCents(Math.round(totalC / (1 - v.target / 100))) : null;
    return {
      labour: fromCents(labourC), direct: fromCents(directC), total: fromCents(totalC),
      contribution: fromCents(contributionC), marginPercent,
      targetPrice: targetPriceC === null ? null : fromCents(targetPriceC),
      cents: { labour: labourC, direct: directC, total: totalC, contribution: contributionC, targetPrice: targetPriceC },
    };
  }

  const calculators = { admin, hire, breakeven, profit, capacity, calls, leads, invoice };

  // ---- Local profile schema (#43/#44) -------------------------------------------
  // Every assumption a live tool persists must survive migration. These are the extra
  // fields on the public tool forms (shares, rates, ageing buckets, funnel stages).
  const EXTRA_ASSUMPTION_KEYS = [
    'reclaimPct', 'cashPct', 'reinvestPct', 'superPct', 'leavePct', 'paidHours', 'utilisationPct',
    'jobHours', 'contractorRate', 'taxRate', 'discountPct', 'overhead', 'targetMarginPct',
    'daysPerWeek', 'leaveDays', 'nonbillPct', 'travelMin', 'cancelPct', 'reachPct', 'contribPct',
    'commsPerEnquiry', 'chase',
    ...FUNNEL_STAGES.flatMap((stage) => ['base_' + stage, 'alt_' + stage]),
    ...AGEING_BUCKETS.flatMap((bucket) => ['age_' + bucket, 'collect_' + bucket]),
  ];
  const ASSUMPTION_KEYS = new Set([
    ...Object.values(RULES).flatMap((rules) => Object.keys(rules)),
    ...EXTRA_ASSUMPTION_KEYS,
  ]);

  function boundedText(value) {
    return typeof value === 'string' ? value.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, MAX_TEXT) : '';
  }

  // Builds a V3 profile from stored V3 and/or legacy V2 data. Malformed parts are dropped,
  // never partially applied. Returns { profile, migratedFromV2 }.
  function migrateProfile({ v3, v2, industryIds }) {
    const known = new Set(industryIds);
    // V3 profiles saved before the schema field existed have no `schema`; they are still V3.
    const fromV3 = Boolean(v3) && typeof v3 === 'object' && !Array.isArray(v3)
      && (v3.schema === undefined || v3.schema === PROFILE_VERSION);
    const source = fromV3 ? v3 : null;
    const legacy = !source && v2 && typeof v2 === 'object' && !Array.isArray(v2) ? v2 : null;
    const profile = { schema: PROFILE_VERSION, verticals: [], activeVertical: 'cleaning', businessName: '', serviceName: '', assumptions: {} };

    if (source) {
      profile.verticals = Array.isArray(source.verticals) ? source.verticals : [];
      profile.activeVertical = source.activeVertical;
      profile.businessName = boundedText(source.businessName);
      profile.serviceName = boundedText(source.serviceName);
      profile.assumptions = source.assumptions;
    } else if (legacy) {
      const { verticals, activeVertical, businessName, serviceName, ...rest } = legacy;
      profile.verticals = Array.isArray(verticals) ? verticals : [];
      profile.activeVertical = known.has(activeVertical) ? activeVertical : 'cleaning';
      profile.businessName = boundedText(businessName);
      profile.serviceName = boundedText(serviceName);
      // Legacy values were flat, shared across verticals; keep them under the active vertical only.
      const flat = {};
      for (const [key, value] of Object.entries(rest)) {
        if (ASSUMPTION_KEYS.has(key) && Number.isFinite(Number(value))) flat[key] = Number(value);
      }
      profile.assumptions = { [profile.activeVertical]: flat };
    }

    profile.verticals = profile.verticals.filter((id, index, list) => known.has(id) && list.indexOf(id) === index);
    if (!known.has(profile.activeVertical)) profile.activeVertical = 'cleaning';
    if (!profile.verticals.includes(profile.activeVertical)) profile.verticals.push(profile.activeVertical);

    const cleanAssumptions = {};
    const storedAssumptions = profile.assumptions && typeof profile.assumptions === 'object' ? profile.assumptions : {};
    for (const [vertical, values] of Object.entries(storedAssumptions)) {
      if (!known.has(vertical) || !values || typeof values !== 'object' || Array.isArray(values)) continue;
      const clean = {};
      for (const [key, value] of Object.entries(values)) {
        const n = Number(value);
        if (ASSUMPTION_KEYS.has(key) && Number.isFinite(n) && Math.abs(n) <= MAX_AMOUNT) clean[key] = n;
      }
      cleanAssumptions[vertical] = clean;
    }
    profile.assumptions = cleanAssumptions;

    return { profile, migratedFromV2: !source && Boolean(legacy) };
  }

  return {
    PROFILE_KEY, LEGACY_PROFILE_KEY, PROFILE_VERSION, MAX_AMOUNT,
    RULES, validate, toCents, fromCents, formatMoney, formatNumber,
    calculators, quote, validateLines, jobCost, splitGstInclusive, migrateProfile,
  };
});
