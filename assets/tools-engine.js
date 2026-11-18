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

  // Splits a GST-inclusive total (Australian 10% GST) into ex-GST and GST amounts, in cents.
  function splitGstInclusive(totalAmount) {
    const totalC = toCents(totalAmount);
    const gstC = Math.round(totalC / 11);
    return { net: fromCents(totalC - gstC), gst: fromCents(gstC), total: fromCents(totalC) };
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

  // ---- Live formulas (#104) ------------------------------------------------------
  // The full formulas behind the live calculators, moved here unchanged from the former
  // assets/tool-calcs.js so that all calculation lives in one tested module. Every
  // visible result is identical; tests/fixtures/live-formulas.json records the outputs.
  function buildFormulas() {

  const WEEKS_PER_YEAR = 52;
  const MONTHS_PER_YEAR = 12;
  const WEEKS_PER_MONTH = WEEKS_PER_YEAR / MONTHS_PER_YEAR; // 52 / 12 by design

  function fail(message) {
    throw new Error(message);
  }

  function num(value, name, min = -Infinity, max = Infinity) {
    const n = typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
    if (!Number.isFinite(n)) fail(name + ' must be a number.');
    if (n < min || n > max) {
      const range = max === Infinity ? 'at least ' + min : min === -Infinity ? 'at most ' + max : min + ' to ' + max;
      fail(name + ' must be ' + range + '.');
    }
    return n;
  }

  const pct = (value, name) => num(value, name, 0, 100);
  const nonNeg = (value, name) => num(value, name, 0);

  // Round half away from zero, for integer cents.
  function roundCents(value) {
    return value < 0 ? -Math.round(-value) : Math.round(value);
  }

  // ---------------------------------------------------------------- #24 admin cost
  // Default inputs (hours 10, rate 45) reproduce the original monthly value:
  // hours x 52/12 x rate. Recovered time is a separate figure from cash savings.
  function adminCost(v) {
    const hours = nonNeg(v.adminHours, 'Admin hours each week');
    const wage = nonNeg(v.adminRate, 'Hourly wage');
    const oncost = num(v.oncostPct ?? 0, 'On-costs on wage', 0, 200);
    // Loaded rate = wage plus any on-costs the user enters (super, leave, overhead). Zero by default.
    const rate = wage * (1 + oncost / 100);
    const reclaim = pct(v.reclaimPct ?? 0, 'Reclaimable share of admin time');
    const cash = pct(v.cashPct ?? 0, 'Share of recovered time turned into cash');
    const reinvest = pct(v.reinvestPct ?? 0, 'Share of recovered time reinvested');
    if (cash + reinvest > 100) fail('Cash share and reinvested share together cannot exceed 100%.');
    const capacityValue = hours * WEEKS_PER_MONTH * rate;
    const reclaimedHours = hours * reclaim / 100 * WEEKS_PER_MONTH;
    const recoveredValue = reclaimedHours * rate;
    const cashSavings = recoveredValue * cash / 100;
    const reinvested = recoveredValue * reinvest / 100;
    const unassigned = recoveredValue - cashSavings - reinvested;
    return {
      metric: capacityValue,
      capacityValue,
      loadedRate: rate,
      weeksPerMonth: WEEKS_PER_MONTH,
      recoveredHoursPerMonth: reclaimedHours,
      recoveredValue,
      cashSavings,
      reinvestedValue: reinvested,
      unassignedValue: unassigned,
      rows: [
        ['Admin time value (all hours)', capacityValue],
        ['Recovered capacity value', recoveredValue],
        ['Cash savings (only the share you enter)', cashSavings],
        ['Reinvested in other work (not cash)', reinvested],
        ['Recovered but not yet assigned', unassigned]
      ]
    };
  }

  // ---------------------------------------------------------------- #25 hiring cost
  // Default on-cost total (other 18%, super and leave 0) reproduces the original
  // salary x (1 + 18%) / 12. Every on-cost rate is user-supplied.
  function hiringCost(v) {
    const salary = nonNeg(v.salary, 'Annual salary');
    const superPct = pct(v.superPct ?? 0, 'Super or retirement contribution');
    const leavePct = pct(v.leavePct ?? 0, 'Leave loading');
    const otherPct = pct(v.oncost ?? 18, 'Other on-costs');
    const onCostPct = superPct + leavePct + otherPct;
    const paidHours = nonNeg(v.paidHours ?? 38, 'Paid hours each week');
    const utilisation = pct(v.utilisationPct ?? 80, 'Billable share of paid hours');
    const margin = num(v.margin, 'Contribution per additional job');
    const jobHours = num(v.jobHours ?? 2.5, 'Average job duration', 0.1);
    const contractorRate = nonNeg(v.contractorRate ?? 0, 'Contractor hourly rate');
    if (paidHours === 0) fail('Paid hours each week must be above zero.');

    const monthlyCost = salary * (1 + onCostPct / 100) / MONTHS_PER_YEAR;
    const billableHours = paidHours * utilisation / 100 * WEEKS_PER_MONTH;
    const employeeCostPerBillableHour = billableHours > 0 ? monthlyCost / billableHours : null;
    const contractorCost = contractorRate * billableHours;
    const jobsExact = margin > 0 ? monthlyCost / margin : null;
    const jobsNeeded = jobsExact === null ? null : Math.ceil(jobsExact);
    const extraHours = jobsNeeded === null ? null : jobsNeeded * jobHours;
    return {
      metric: monthlyCost,
      onCostPct,
      monthlyCost,
      billableHours,
      employeeCostPerBillableHour,
      contractorCost,
      contractorCheaper: contractorRate > 0 ? contractorCost < monthlyCost : null,
      jobsExact,
      jobsNeeded,
      extraHours,
      rows: [
        ['On-cost allowance (your figures)', onCostPct + '%'],
        ['Billable hours per month (roster)', billableHours.toFixed(1)],
        ['Employee cost per billable hour', employeeCostPerBillableHour === null ? 'n/a' : employeeCostPerBillableHour],
        ['Contractor cost at the same billable hours', contractorRate > 0 ? contractorCost : 'Not entered'],
        ['Additional jobs/month to cover the cost', jobsNeeded === null ? 'Not achievable' : jobsNeeded]
      ]
    };
  }

  // ---------------------------------------------------------------- #26 job profitability
  // Direct-cost contribution is kept as its own metric. Tax is removed only when
  // the entered revenue includes it. Overhead is subtracted once, after contribution.
  function jobProfitability(v) {
    const revenueEntered = nonNeg(v.jobRevenue, 'Job revenue');
    const taxInclusive = v.taxMode === 'inclusive';
    const taxRate = pct(v.taxRate ?? 10, 'Tax rate');
    const discount = pct(v.discountPct ?? 0, 'Discount or write-off');
    const labour = nonNeg(v.labour, 'Labour cost');
    const materials = nonNeg(v.materials, 'Materials');
    const travel = nonNeg(v.travel, 'Travel/other direct cost');
    const overhead = nonNeg(v.overhead ?? 0, 'Overhead allocated to this job');
    const target = pct(v.targetMarginPct ?? 30, 'Target gross margin');

    const taxPart = taxInclusive ? revenueEntered - revenueEntered / (1 + taxRate / 100) : 0;
    const netRevenueBeforeDiscount = revenueEntered - taxPart;
    const discountAmount = netRevenueBeforeDiscount * discount / 100;
    const netRevenue = netRevenueBeforeDiscount - discountAmount;
    const directCost = labour + materials + travel;
    const contribution = netRevenue - directCost;
    const netProfit = contribution - overhead;
    const grossMarginPct = netRevenue > 0 ? contribution / netRevenue * 100 : null;
    const markupPct = directCost > 0 ? contribution / directCost * 100 : null;
    const fullCost = directCost + overhead;
    const priceForTarget = target < 100 ? fullCost / (1 - target / 100) : null;

    return {
      metric: contribution,
      directCost,
      contribution,
      overhead,
      netProfit,
      netRevenue,
      taxInside: taxPart,
      discountAmount,
      grossMarginPct,
      markupPct,
      priceForTarget,
      targetGap: priceForTarget === null ? null : priceForTarget - netRevenue,
      reconciles: Math.abs(netProfit - (netRevenue - directCost - overhead)) < 1e-9,
      rows: [
        ['Net revenue (tax removed, discount applied)', netRevenue],
        ['Direct costs', directCost],
        ['Contribution before overhead', contribution],
        ['Overhead allocated', overhead],
        ['Net profit for this job', netProfit]
      ]
    };
  }

  // ---------------------------------------------------------------- #27 capacity planner
  // With no extra inputs (5 days, no leave, no buffers, no cancellations) the
  // bookable figure equals the original worker-hours x 52/12 / duration.
  function capacityPlanner(v) {
    const workers = nonNeg(v.workers, 'Field workers');
    const hours = nonNeg(v.hours, 'Productive hours per worker/week');
    const duration = num(v.duration, 'Average job duration', 0.1);
    const currentJobs = nonNeg(v.currentJobs, 'Current jobs per month');
    const travelMin = nonNeg(v.travelMin ?? 0, 'Travel and time buffer per job (minutes)');
    const nonbill = pct(v.nonbillPct ?? 0, 'Non-billable share of hours');
    const cancel = pct(v.cancelPct ?? 0, 'Cancellation and no-show share');
    const days = num(v.daysPerWeek ?? 5, 'Available days each week', 0.5, 7);
    const leave = nonNeg(v.leaveDays ?? 0, 'Leave days per worker each year');
    if (leave > WEEKS_PER_YEAR * days) fail('Leave days cannot exceed the available days in a year.');

    const theoretical = workers * hours * WEEKS_PER_MONTH / duration;
    const availableShare = (WEEKS_PER_YEAR * days - leave) / (WEEKS_PER_YEAR * days);
    const billableHours = workers * hours * (1 - nonbill / 100) * availableShare * WEEKS_PER_MONTH;
    const perJobHours = duration + travelMin / 60;
    const bookable = billableHours * (1 - cancel / 100) / perJobHours;
    const bookableJobs = Math.floor(bookable);
    const spare = bookableJobs - currentJobs;
    return {
      metric: bookableJobs,
      theoreticalJobs: Math.floor(theoretical),
      bookableJobs,
      spare,
      billableHours,
      perJobHours,
      rows: [
        ['Theoretical jobs/month (hours only)', Math.floor(theoretical)],
        ['Bookable jobs/month (after buffers, leave, cancellations)', bookableJobs],
        ['Spare (+) or over (-) against current volume', spare]
      ]
    };
  }

  // ---------------------------------------------------------------- #28 missed enquiries
  // "Opportunity" keeps the original definition. "Recoverable" applies the share
  // of missed enquiries you can realistically reach. Nothing is guaranteed.
  function missedEnquiry(v) {
    const enquiries = nonNeg(v.calls, 'Calls/enquiries per month');
    const missedPct = pct(v.missed, 'Missed/unanswered rate');
    const convert = pct(v.convert, 'Likely conversion if answered');
    const jobValue = nonNeg(v.jobValue, 'Average job value');
    const reach = pct(v.reachPct ?? 0, 'Share of missed enquiries you can follow up');
    const contribPct = pct(v.contribPct ?? 100, 'Contribution margin');
    const commsPerEnquiry = nonNeg(v.commsPerEnquiry ?? 0, 'External messaging cost per follow-up');
    const missed = enquiries * missedPct / 100;
    const opportunity = missed * convert / 100 * jobValue;
    const recoverable = opportunity * reach / 100;
    const recoverableContribution = recoverable * contribPct / 100;
    const comms = missed * reach / 100 * commsPerEnquiry;
    return {
      metric: opportunity,
      missedEnquiries: missed,
      opportunity,
      recoverable,
      recoverableContribution,
      commsCost: comms,
      netRecoveryContribution: recoverableContribution - comms,
      rows: [
        ['Missed enquiries per month', missed.toFixed(1)],
        ['Opportunity exposed (before follow-up)', opportunity],
        ['Recoverable if followed up (assumed share)', recoverable],
        ['Contribution on the recoverable share', recoverableContribution],
        ['External messaging cost', comms],
        ['Net contribution (assumed, not guaranteed)', recoverableContribution - comms]
      ]
    };
  }

  // ---------------------------------------------------------------- #29 lead conversion
  // A four-stage funnel: contacted, qualified, booked, completed. Baseline and
  // scenario are compared. Stage rates are limited to 0-100. Negative uplift is
  // reported as a reduction.
  const STAGES = ['contacted', 'qualified', 'booked', 'completed'];
  function funnelRate(stages, label) {
    return STAGES.reduce((rate, key) => {
      const share = pct(stages[key], label + ' ' + key + ' rate');
      return rate * share / 100;
    }, 1);
  }
  function leadConversion(v) {
    const leads = nonNeg(v.leads, 'Leads per month');
    const value = nonNeg(v.value, 'Average customer/job value');
    const contribPct = pct(v.contribPct ?? 100, 'Contribution margin');
    const base = {};
    const scen = {};
    for (const key of STAGES) {
      base[key] = v['base_' + key];
      scen[key] = v['alt_' + key];
    }
    const baseRate = funnelRate(base, 'Baseline');
    const scenRate = funnelRate(scen, 'Scenario');
    const baseCompleted = leads * baseRate;
    const scenCompleted = leads * scenRate;
    const deltaCompleted = scenCompleted - baseCompleted;
    const revenueDelta = deltaCompleted * value;
    const contributionDelta = revenueDelta * contribPct / 100;
    return {
      metric: revenueDelta,
      baseRate,
      scenRate,
      baseCompleted,
      scenCompleted,
      deltaCompleted,
      revenueDelta,
      contributionDelta,
      direction: deltaCompleted > 0 ? 'increase' : deltaCompleted < 0 ? 'reduction' : 'no change',
      rows: [
        ['Baseline lead-to-completed rate', (baseRate * 100).toFixed(1) + '%'],
        ['Scenario lead-to-completed rate', (scenRate * 100).toFixed(1) + '%'],
        ['Completed jobs/month: baseline to scenario', baseCompleted.toFixed(1) + ' to ' + scenCompleted.toFixed(1)],
        ['Revenue difference/month', revenueDelta],
        ['Contribution difference/month', contributionDelta]
      ]
    };
  }

  // ---------------------------------------------------------------- #30 invoice collection
  // Ageing is a share of one month's billing still unpaid. Collection shares are
  // the user's own assumptions. Moving money earlier is not new revenue.
  // Ageing buckets count days since the invoice was issued. Terms are the days allowed
  // before an invoice is due. A bucket counts as beyond terms only when it starts after
  // the terms day, so a bucket that straddles the due date is not counted (decision on
  // the PR). Cash timing splits the 13-week expected cash into receipts within 4 weeks
  // and weeks 5 to 13, using one share the user enters.
  const AGEING = ['d0_30', 'd31_60', 'd61_90', 'd90'];
  const AGEING_START = { d0_30: 0, d31_60: 31, d61_90: 61, d90: 91 };
  const TERMS_DEFAULT = 30;
  function invoiceCollection(v) {
    const invoices = nonNeg(v.invoices, 'Invoices per month');
    const avg = nonNeg(v.avg, 'Average invoice');
    const chase = nonNeg(v.chase, 'Hours/month chasing payment');
    const terms = nonNeg(v.terms ?? TERMS_DEFAULT, 'Payment terms in days');
    if (terms > 120) fail('Payment terms must be 120 days or fewer.');
    const within4 = pct(v.within4 ?? 60, 'Share of expected cash received within 4 weeks');
    const shares = {};
    const collect = {};
    let total = 0;
    for (const key of AGEING) {
      shares[key] = pct(v['age_' + key] ?? 0, 'Unpaid share ' + key);
      total += shares[key];
      collect[key] = pct(v['collect_' + key] ?? 100, 'Expected collection within 13 weeks ' + key);
    }
    if (total > 100) fail('The ageing shares cannot add up to more than 100%.');
    const billed = invoices * avg;
    const outstanding = {};
    let cashIn13Weeks = 0;
    let beyondTerms = 0;
    for (const key of AGEING) {
      outstanding[key] = billed * shares[key] / 100;
      cashIn13Weeks += outstanding[key] * collect[key] / 100;
      if (AGEING_START[key] > terms) beyondTerms += outstanding[key];
    }
    const cashIn4Weeks = cashIn13Weeks * within4 / 100;
    const cashWeeks5To13 = cashIn13Weeks - cashIn4Weeks;
    const notCollectedIn13Weeks = billed * total / 100 - cashIn13Weeks;
    return {
      metric: beyondTerms,
      billed,
      terms,
      outstanding,
      beyondTerms,
      cashIn13Weeks,
      cashIn4Weeks,
      cashWeeks5To13,
      notCollectedIn13Weeks,
      chaseHours: chase,
      hoursPerThousandBeyondTerms: beyondTerms > 0 ? chase / (beyondTerms / 1000) : null,
      rows: [
        ['Monthly billing represented', billed],
        ['Unpaid 0-30 days', outstanding.d0_30],
        ['Unpaid 31-60 days', outstanding.d31_60],
        ['Unpaid 61-90 days', outstanding.d61_90],
        ['Unpaid 90+ days', outstanding.d90],
        ['Expected cash within 4 weeks (your assumptions)', cashIn4Weeks],
        ['Expected cash in weeks 5 to 13 (your assumptions)', cashWeeks5To13],
        ['Expected cash within 13 weeks (your assumptions)', cashIn13Weeks]
      ]
    };
  }

  // ---------------------------------------------------------------- #31 quote builder
  // Lines are entered as dollars and converted to cents. Discount is applied to
  // the subtotal once. GST is either not applied, added on top (prices exclude
  // GST), or taken out of GST-inclusive prices. The total is always the sum of
  // the rounded cents, so the printed figures add up.
  const QUOTE_TAX_MODES = ['none', 'exclusive', 'inclusive'];
  function quoteTotals(input) {
    const mode = input.taxMode ?? 'none';
    if (!QUOTE_TAX_MODES.includes(mode)) fail('Tax mode must be none, exclusive or inclusive.');
    const rate = pct(input.taxRate ?? 10, 'GST rate');
    const discount = pct(input.discountPct ?? 0, 'Discount');
    const lines = Array.isArray(input.lines) ? input.lines : [];
    if (lines.length > 200) fail('A quote can have at most 200 lines.');
    const priced = lines.map((line, index) => {
      const description = String(line.description ?? '').trim();
      if (description.length > 160) fail('Line ' + (index + 1) + ' description is too long.');
      const quantity = nonNeg(line.quantity ?? 0, 'Quantity on line ' + (index + 1));
      const unit = nonNeg(line.unitPrice ?? 0, 'Unit price on line ' + (index + 1));
      const unitCents = roundCents(unit * 100);
      const lineCents = roundCents(quantity * unitCents);
      return { description, quantity, unitCents, lineCents };
    });
    const subtotalCents = priced.reduce((sum, line) => sum + line.lineCents, 0);
    if (!Number.isSafeInteger(subtotalCents)) fail('Quote total is too large to calculate exactly.');
    const discountCents = roundCents(subtotalCents * discount / 100);
    const afterDiscountCents = subtotalCents - discountCents;
    let gstCents = 0;
    let totalCents;
    let exTaxCents;
    if (mode === 'exclusive') {
      gstCents = roundCents(afterDiscountCents * rate / 100);
      exTaxCents = afterDiscountCents;
      totalCents = afterDiscountCents + gstCents;
    } else if (mode === 'inclusive') {
      gstCents = roundCents(afterDiscountCents * rate / (100 + rate));
      exTaxCents = afterDiscountCents - gstCents;
      totalCents = afterDiscountCents;
    } else {
      exTaxCents = afterDiscountCents;
      totalCents = afterDiscountCents;
    }
    return {
      lines: priced,
      subtotalCents,
      discountCents,
      exTaxCents,
      gstCents,
      totalCents,
      taxMode: mode,
      taxRate: rate
    };
  }

  // Stores quotes only where the user has chosen to save them. The customer name
  // is kept only when consent is recorded. Quotes never go into a URL.
  const QUOTE_STORE_KEY = 'titanQuotesV1';
  const QUOTE_LIMIT = 20;
  function quoteRecordId(reference) {
    return String(reference || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
  }
  function saveQuoteRecord(store, quote, now) {
    const ref = quoteRecordId(quote.reference);
    if (!ref) fail('Enter a quote reference before saving.');
    const list = Array.isArray(store.quotes) ? store.quotes.slice() : [];
    const existing = list.find(item => item.reference === ref);
    const version = existing ? existing.version + 1 : 1;
    const record = {
      reference: ref,
      version,
      savedAt: now,
      validDays: nonNeg(quote.validDays ?? 14, 'Validity in days'),
      business: String(quote.business ?? '').slice(0, 120),
      customer: quote.consentToStoreCustomer ? String(quote.customer ?? '').slice(0, 120) : '',
      consentToStoreCustomer: Boolean(quote.consentToStoreCustomer),
      service: String(quote.service ?? '').slice(0, 160),
      scope: String(quote.scope ?? '').slice(0, 1000),
      exclusions: String(quote.exclusions ?? '').slice(0, 1000),
      terms: String(quote.terms ?? '').slice(0, 1000),
      taxMode: quote.taxMode ?? 'none',
      taxRate: quote.taxRate ?? 10,
      discountPct: quote.discountPct ?? 0,
      lines: (quote.lines || []).map(line => ({
        description: String(line.description ?? '').slice(0, 160),
        quantity: Number(line.quantity) || 0,
        unitPrice: Number(line.unitPrice) || 0
      }))
    };
    const others = list.filter(item => item.reference !== ref);
    const next = [record, ...others].slice(0, QUOTE_LIMIT);
    return { quotes: next, saved: record, history: existing ? existing.version : 0 };
  }

  // ---------------------------------------------------------------- #32 job cost sheet
  // Costs are kept apart from price and GST. Mileage and equipment are entered
  // as totals, not as hidden rates. Contingency applies to direct cost only.
  function jobCostSheet(v) {
    const roles = Array.isArray(v.roles) ? v.roles : [];
    if (roles.length > 50) fail('A job can have at most 50 labour lines.');
    let labour = 0;
    for (const [index, role] of roles.entries()) {
      const hours = nonNeg(role.hours, 'Hours on labour line ' + (index + 1));
      const rate = nonNeg(role.rate, 'Rate on labour line ' + (index + 1));
      labour += hours * rate;
    }
    const materialsCost = nonNeg(v.materials ?? 0, 'Materials purchased');
    const markupPct = pct(v.materialMarkupPct ?? 0, 'Materials markup');
    const equipment = nonNeg(v.equipment ?? 0, 'Equipment cost');
    const km = nonNeg(v.km ?? 0, 'Kilometres driven');
    const kmRate = nonNeg(v.kmRate ?? 0, 'Cost per kilometre');
    const travel = nonNeg(v.travel ?? 0, 'Other travel cost');
    const contingencyPct = pct(v.contingencyPct ?? 0, 'Contingency');
    const overhead = nonNeg(v.overhead ?? 0, 'Allocated overhead');
    const price = nonNeg(v.price ?? 0, 'Customer price excluding GST');
    const targetMarginPct = pct(v.targetMarginPct ?? 30, 'Target margin');

    const mileage = km * kmRate;
    const materialsWithMarkup = materialsCost * (1 + markupPct / 100);
    const directCost = labour + materialsCost + equipment + mileage + travel;
    const contingency = directCost * contingencyPct / 100;
    const totalCost = directCost + contingency + overhead;
    const margin = price - totalCost;
    const marginPct = price > 0 ? margin / price * 100 : null;
    const targetPrice = targetMarginPct < 100 ? totalCost / (1 - targetMarginPct / 100) : null;
    const materialMarkupValue = materialsWithMarkup - materialsCost;
    const sellPriceMaterials = materialsWithMarkup;
    return {
      metric: totalCost,
      labour,
      directCost,
      contingency,
      overhead,
      totalCost,
      mileage,
      materialMarkupValue,
      sellPriceMaterials,
      price,
      margin,
      marginPct,
      targetPrice,
      rows: [
        ['Labour', labour],
        ['Materials (at cost)', materialsCost],
        ['Equipment, mileage and other travel', equipment + mileage + travel],
        ['Contingency', contingency],
        ['Allocated overhead', overhead],
        ['Total job cost', totalCost],
        ['Margin at entered price (ex GST)', margin]
      ]
    };
  }

  // Turns a costed job into a single quote line, so the quote and the job cost
  // sheet use the same ex-GST price.
  function costToQuoteLine(cost, description) {
    return { description: String(description ?? 'Service').slice(0, 160), quantity: 1, unitPrice: Math.round(cost.price * 100) / 100 };
  }

  // ---------------------------------------------------------------- #33 checklist state
  // Tasks have stable IDs (template id or custom id). Completion and notes are
  // keyed by ID, so they survive re-rendering, reordering and template revisions.
  function templateTasks(industryId, templates, revision) {
    const list = templates[industryId];
    if (!Array.isArray(list)) fail('No checklist template for this service type.');
    return list.map((text, index) => ({
      id: industryId + '-' + (revision ?? 1) + '-' + index,
      key: industryId + ':' + index,
      text: String(text),
      done: false,
      note: '',
      custom: false
    }));
  }

  function emptyChecklist(industryId) {
    return { industry: industryId, revision: 1, job: '', tasks: [], signOffNote: '' };
  }

  // Reconcile a new template with an existing state: a task keeps its completion
  // when its template key is still present.
  function reconcileChecklist(state, industryId, templates, revision) {
    const fresh = templateTasks(industryId, templates, revision);
    const previous = new Map((state.tasks || []).map(task => [task.key, task]));
    const merged = fresh.map(task => {
      const old = previous.get(task.key);
      return old ? { ...task, id: task.id, done: old.done, note: old.note } : task;
    });
    const customs = (state.tasks || []).filter(task => task.custom);
    return { ...state, industry: industryId, revision: revision ?? state.revision, tasks: merged.concat(customs) };
  }

  // Switching service type is explicit. If any work is ticked, the caller must
  // pass confirmed = true; otherwise the state is returned unchanged.
  function switchIndustry(state, industryId, templates, confirmed) {
    const anyDone = (state.tasks || []).some(task => task.done || task.note);
    if (industryId === state.industry) return { state, changed: false, needsConfirm: false };
    if (anyDone && !confirmed) return { state, changed: false, needsConfirm: true };
    return { state: { ...emptyChecklist(industryId), job: state.job, tasks: templateTasks(industryId, templates, 1) }, changed: true, needsConfirm: false };
  }

  function addCustomTask(state, text, nextId) {
    const clean = String(text ?? '').trim().slice(0, 240);
    if (!clean) fail('Enter a task before adding it.');
    const id = 'custom-' + nextId;
    return { ...state, tasks: [...state.tasks, { id, key: id, text: clean, done: false, note: '', custom: true }] };
  }

  function editTask(state, id, text) {
    const clean = String(text ?? '').trim().slice(0, 240);
    if (!clean) fail('A task cannot be empty.');
    return { ...state, tasks: state.tasks.map(task => (task.id === id ? { ...task, text: clean } : task)) };
  }

  function removeTask(state, id) {
    return { ...state, tasks: state.tasks.filter(task => task.id !== id) };
  }

  function moveTask(state, id, direction) {
    const index = state.tasks.findIndex(task => task.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= state.tasks.length) return state;
    const tasks = state.tasks.slice();
    [tasks[index], tasks[target]] = [tasks[target], tasks[index]];
    return { ...state, tasks };
  }

  function setTaskDone(state, id, done) {
    return { ...state, tasks: state.tasks.map(task => (task.id === id ? { ...task, done: Boolean(done) } : task)) };
  }

  function setTaskNote(state, id, note) {
    return { ...state, tasks: state.tasks.map(task => (task.id === id ? { ...task, note: String(note ?? '').slice(0, 300) } : task)) };
  }

  function checklistProgress(state) {
    const total = state.tasks.length;
    const done = state.tasks.filter(task => task.done).length;
    return { total, done, complete: total > 0 && done === total };
  }

  const api = {
    WEEKS_PER_MONTH,
    adminCost,
    hiringCost,
    jobProfitability,
    capacityPlanner,
    missedEnquiry,
    leadConversion,
    invoiceCollection,
    quoteTotals,
    quoteRecordId,
    saveQuoteRecord,
    jobCostSheet,
    costToQuoteLine,
    templateTasks,
    emptyChecklist,
    reconcileChecklist,
    switchIndustry,
    addCustomTask,
    editTask,
    removeTask,
    moveTask,
    setTaskDone,
    setTaskNote,
    checklistProgress,
    QUOTE_STORE_KEY,
    QUOTE_LIMIT
  };
    return api;
  }
  const formulas = buildFormulas();

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

  return {
    PROFILE_KEY, LEGACY_PROFILE_KEY, PROFILE_VERSION, MAX_AMOUNT,
    PORTABLE_FORMAT, PORTABLE_VERSION, PORTABLE_MAX_CHARS, PORTABLE_MAX_KEYS, ASSUMPTION_KEY_LIST,
    RULES, validate, toCents, fromCents, formatMoney, formatNumber,
    calculators, formulas, validateLines, splitGstInclusive, migrateProfile,
    exportAssumptions, validateImport, applyImport,
  };
});
