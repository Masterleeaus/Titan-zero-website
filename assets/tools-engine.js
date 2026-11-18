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

  const RULES = {
    admin: {
      adminHours: rule.number('Admin hours each week', 0, 168),
      adminRate: rule.money('Hourly wage before on-costs'),
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
    leads: {
      leads: rule.count('Leads per month'),
      current: rule.percent('Current conversion'),
      target: rule.percent('Scenario conversion'),
      value: rule.money('Average customer/job value'),
    },
    invoice: {
      invoices: rule.count('Invoices per month'),
      avg: rule.money('Average invoice'),
      overdue: rule.percent('Beyond-terms share'),
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

  function leads(v) {
    const cents = safeCents(Math.round(v.leads * (v.target - v.current) / 100 * toCents(v.value)));
    return {
      status: 'ok', metric: fromCents(cents), format: 'currency',
      label: 'Scenario revenue difference/month',
      math: v.leads + ' leads × (' + v.target + '% − ' + v.current + '%) × ' + formatMoney(v.value),
      notes: [
        'This shows what the selected conversion change would be worth.',
        'It does not claim that software, marketing or AI will cause that improvement.',
      ],
    };
  }

  function invoice(v) {
    const billedCents = safeCents(v.invoices * toCents(v.avg));
    const overdueCents = safeCents(Math.round(billedCents * v.overdue / 100));
    return {
      status: 'ok', metric: fromCents(overdueCents), format: 'currency',
      label: 'Value typically beyond terms',
      math: v.invoices + ' × ' + formatMoney(v.avg) + ' × ' + v.overdue + '%',
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
  const FUNNEL_STAGES = ['contacted', 'qualified', 'booked', 'completed'];
  const AGEING_BUCKETS = ['d0_30', 'd31_60', 'd61_90', 'd90'];
  const EXTRA_ASSUMPTION_KEYS = [
    'reclaimPct', 'cashPct', 'reinvestPct', 'oncostPct', 'superPct', 'leavePct', 'paidHours', 'utilisationPct',
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

  // ---- Portable assumptions: redacted export and versioned import (#43, #44) ----------
  // A portable file carries only numeric assumptions for one service type. It never carries
  // business or service names, customer or staff details, quote text or the vertical list.
  // Imports are all-or-nothing: any unknown field, sensitive field, wrong version or bad value
  // rejects the whole file, so nothing is applied partially.
  const PORTABLE_FORMAT = 'titan-zero-tool-assumptions';
  const PORTABLE_VERSION = 1;
  const PORTABLE_MAX_CHARS = 20000;
  const PORTABLE_MAX_KEYS = 80;
  const PORTABLE_TOP_KEYS = ['format', 'formatVersion', 'vertical', 'assumptions'];
  const SENSITIVE_FIELD_HINTS = /name|customer|client|staff|employee|quote|email|phone|address|reference|note|terms|scope|exclusion|business|service|lines?$/i;
  const PERCENT_KEYS = new Set([
    'reclaimPct', 'cashPct', 'reinvestPct', 'superPct', 'leavePct', 'utilisationPct', 'taxRate',
    'discountPct', 'targetMarginPct', 'nonbillPct', 'cancelPct', 'reachPct', 'contribPct',
    'missed', 'convert', 'oncost', 'overdue', 'current', 'target',
  ]);
  const isPercentKey = (key) => PERCENT_KEYS.has(key) || /^(base|alt)_/.test(key) || /^(age|collect)_/.test(key);
  const ASSUMPTION_KEY_LIST = Object.freeze([...ASSUMPTION_KEYS].sort());

  // Redacted export of one vertical's numeric assumptions. Returns a plain object.
  function exportAssumptions(profile, verticalId, industryIds) {
    if (!industryIds.includes(verticalId)) throw new RangeError('Unknown service type');
    const stored = (profile && profile.assumptions && profile.assumptions[verticalId]) || {};
    const assumptions = {};
    for (const key of Object.keys(stored).sort()) {
      const n = Number(stored[key]);
      if (ASSUMPTION_KEYS.has(key) && Number.isFinite(n) && Math.abs(n) <= MAX_AMOUNT) assumptions[key] = n;
    }
    return { format: PORTABLE_FORMAT, formatVersion: PORTABLE_VERSION, vertical: verticalId, assumptions };
  }

  // Validates a portable file (JSON text or an already-parsed object).
  // Returns { ok:true, value:{ vertical, assumptions } } or { ok:false, errors:[{ key, message }] }.
  function validateImport(input, industryIds) {
    const errors = [];
    const fail = (key, message) => { errors.push({ key, message }); };
    let doc = input;
    if (typeof input === 'string') {
      if (input.length > PORTABLE_MAX_CHARS) return { ok: false, errors: [{ key: '', message: 'The file is too large to import.' }] };
      try { doc = JSON.parse(input); } catch (_) { return { ok: false, errors: [{ key: '', message: 'The file is not valid JSON.' }] }; }
    }
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { ok: false, errors: [{ key: '', message: 'The file must contain one settings object.' }] };
    if (doc.format !== PORTABLE_FORMAT) fail('format', 'This is not a Titan Zero tool assumptions file.');
    if (doc.formatVersion !== PORTABLE_VERSION) {
      fail('formatVersion', typeof doc.formatVersion === 'number' && doc.formatVersion > PORTABLE_VERSION
        ? 'This file is from a newer version of the tools and cannot be read here.'
        : 'This file is from an older version. Export it again from the current tools.');
    }
    for (const key of Object.keys(doc)) {
      if (!PORTABLE_TOP_KEYS.includes(key)) {
        fail(key, SENSITIVE_FIELD_HINTS.test(key)
          ? 'The file contains business or customer details, which are never imported.'
          : 'Unknown field: ' + boundedText(key) + '.');
      }
    }
    if (!industryIds.includes(doc.vertical)) fail('vertical', 'The service type in this file is not one of the Titan Zero service types.');
    const assumptions = doc.assumptions;
    const keys = assumptions && typeof assumptions === 'object' && !Array.isArray(assumptions) ? Object.keys(assumptions) : null;
    if (!keys) {
      fail('assumptions', 'The assumptions must be an object of numbers.');
    } else if (keys.length > PORTABLE_MAX_KEYS) {
      fail('assumptions', 'The file has too many assumptions.');
    } else {
      for (const key of keys) {
        const value = assumptions[key];
        if (!ASSUMPTION_KEYS.has(key)) {
          fail('assumptions.' + key, SENSITIVE_FIELD_HINTS.test(key)
            ? 'The file contains business or customer details, which are never imported.'
            : 'Unknown assumption: ' + boundedText(key) + '.');
          continue;
        }
        if (typeof value !== 'number' || !Number.isFinite(value)) { fail('assumptions.' + key, 'Assumption ' + key + ' must be a number.'); continue; }
        if (value < 0 || value > MAX_AMOUNT) { fail('assumptions.' + key, 'Assumption ' + key + ' must be between 0 and ' + MAX_AMOUNT + '.'); continue; }
        if (isPercentKey(key) && value > 100) fail('assumptions.' + key, 'Assumption ' + key + ' is a percentage and cannot exceed 100.');
      }
    }
    if (errors.length) return { ok: false, errors };
    const clean = {};
    for (const key of keys) clean[key] = assumptions[key];
    return { ok: true, value: { vertical: doc.vertical, assumptions: clean } };
  }

  // Applies a validated import to a profile copy for the named vertical only. Returns the new
  // profile and the list of values that were applied, so the page can show them.
  function applyImport(profile, validated) {
    if (!validated || !validated.ok) throw new TypeError('Only a validated import can be applied');
    const { vertical, assumptions } = validated.value;
    const next = { ...profile, assumptions: { ...(profile.assumptions || {}), [vertical]: { ...assumptions } } };
    const applied = Object.entries(assumptions).map(([key, value]) => ({ key, value }));
    return { profile: next, applied };
  }

  // ---- Explicit transfer flows (#44) ----------------------------------------------------
  // Each flow is a named contract: which source tool hands which assumption keys to which
  // target tool. A transfer only starts from a validated import for the same service type,
  // only carries the keys listed for that flow, and only runs when the user chooses it.
  const AGEING_AND_COLLECT = [
    'age_d0_30', 'age_d31_60', 'age_d61_90', 'age_d90',
    'collect_d0_30', 'collect_d31_60', 'collect_d61_90', 'collect_d90',
  ];
  const TRANSFER_FLOWS = Object.freeze({
    'job-cost-to-quote': Object.freeze({
      label: 'Job cost to pricing and quote', from: 'job-cost-sheet', to: 'quote-builder',
      keys: Object.freeze(['overhead', 'taxRate', 'discountPct', 'targetMarginPct']),
    }),
    'bookings-to-capacity': Object.freeze({
      label: 'Bookings to capacity', from: 'booking-revenue', to: 'capacity-planner',
      keys: Object.freeze(['duration', 'daysPerWeek', 'leaveDays', 'nonbillPct', 'travelMin', 'cancelPct']),
    }),
    'receivables-to-cash-flow': Object.freeze({
      label: 'Receivables to cash flow', from: 'invoice-collection', to: 'cash-flow-forecast',
      keys: Object.freeze(AGEING_AND_COLLECT),
    }),
    'leads-to-follow-up': Object.freeze({
      label: 'Leads to follow-up', from: 'lead-conversion', to: 'customer-response',
      keys: Object.freeze(['reachPct', 'commsPerEnquiry', 'contribPct', 'missed', 'convert']),
    }),
  });

  // Plans one transfer from a validated import. Returns { ok:true, flow, applied, missing }
  // with the exact values that would be applied, or { ok:false, errors }. Nothing is changed here.
  function planTransfer(flowId, validated, targetVertical) {
    const flow = Object.prototype.hasOwnProperty.call(TRANSFER_FLOWS, flowId) ? TRANSFER_FLOWS[flowId] : null;
    if (!flow) return { ok: false, errors: [{ key: 'flow', message: 'Unknown transfer.' }] };
    if (!validated || validated.ok !== true || !validated.value) {
      return { ok: false, errors: [{ key: 'file', message: 'Only a checked file can be transferred.' }] };
    }
    if (validated.value.vertical !== targetVertical) {
      return { ok: false, errors: [{ key: 'vertical', message: 'This file is for a different service type.' }] };
    }
    const source = validated.value.assumptions;
    const applied = [];
    const missing = [];
    for (const key of flow.keys) {
      if (Object.prototype.hasOwnProperty.call(source, key)) applied.push({ key, value: source[key] });
      else missing.push(key);
    }
    return { ok: true, flow: flowId, label: flow.label, vertical: targetVertical, applied, missing };
  }

  // Applies a plan from planTransfer to the active service type only. Refuses anything not planned.
  function applyTransfer(profile, plan) {
    if (!plan || plan.ok !== true) throw new TypeError('Only a planned transfer can be applied');
    const current = (profile.assumptions && profile.assumptions[plan.vertical]) || {};
    const merged = { ...current };
    for (const item of plan.applied) merged[item.key] = item.value;
    return {
      profile: { ...profile, assumptions: { ...(profile.assumptions || {}), [plan.vertical]: merged } },
      applied: plan.applied.slice(),
    };
  }

  return {
    PROFILE_KEY, LEGACY_PROFILE_KEY, PROFILE_VERSION, MAX_AMOUNT,
    PORTABLE_FORMAT, PORTABLE_VERSION, PORTABLE_MAX_CHARS, PORTABLE_MAX_KEYS, ASSUMPTION_KEY_LIST,
    RULES, validate, toCents, fromCents, formatMoney, formatNumber,
    calculators, quote, validateLines, jobCost, splitGstInclusive, migrateProfile,
    exportAssumptions, validateImport, applyImport,
    TRANSFER_FLOWS, planTransfer, applyTransfer,
  };
});
