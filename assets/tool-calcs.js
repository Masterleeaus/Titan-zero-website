// Pure calculation helpers for the free Titan Zero tools (#24-#33).
// No DOM, no network. Every function validates its inputs and throws a plain
// Error with a message the tool can show. Money is handled in whole cents where
// rounding matters (quotes and job costs). Nothing here states a statutory rate,
// a price or a savings figure: every rate or percentage comes from the user.
(function () {
  'use strict';

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
        ['Contractor or employee at these hours', contractorRate > 0 ? (contractorCost < monthlyCost ? 'Contractor rate is lower' : 'Employee cost is lower or equal') : 'Not compared (no contractor rate entered)'],
        ['Additional jobs/month to cover the cost', jobsNeeded === null ? 'Not achievable' : jobsNeeded],
        ['Job hours/month needed for those extra jobs', extraHours === null ? 'Not achievable' : extraHours.toFixed(1) + ' hours']
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
  // Each saved version keeps its content. Up to QUOTE_HISTORY_LIMIT earlier versions
  // are kept with the current one. The customer name is kept in any stored copy only
  // while consent is recorded, so withdrawing consent clears it from every version.
  const QUOTE_HISTORY_LIMIT = 5;
  const QUOTE_VALID_MAX_DAYS = 365;
  const QUOTE_TEXT_FIELDS = { business: 120, service: 160, scope: 1000, exclusions: 1000, terms: 1000 };

  // Validates and copies the content fields of a quote. Throws on bad numbers, lines,
  // tax mode or GST rate, so a stored quote can always be totalled again.
  function quoteContent(quote, keepCustomer) {
    quoteTotals(quote);
    const content = {};
    for (const [key, max] of Object.entries(QUOTE_TEXT_FIELDS)) content[key] = String(quote[key] ?? '').slice(0, max);
    content.customer = keepCustomer ? String(quote.customer ?? '').slice(0, 120) : '';
    content.validDays = num(quote.validDays ?? 14, 'Validity in days', 0, QUOTE_VALID_MAX_DAYS);
    content.taxMode = quote.taxMode ?? 'none';
    content.taxRate = pct(quote.taxRate ?? 10, 'GST rate');
    content.discountPct = pct(quote.discountPct ?? 0, 'Discount');
    content.lines = (quote.lines || []).map(line => ({
      description: String(line.description ?? '').trim().slice(0, 160),
      quantity: nonNeg(line.quantity ?? 0, 'Quantity'),
      unitPrice: nonNeg(line.unitPrice ?? 0, 'Unit price')
    }));
    return content;
  }
  function saveQuoteRecord(store, quote, now) {
    const ref = quoteRecordId(quote.reference);
    if (!ref) fail('Enter a quote reference before saving.');
    const consent = Boolean(quote.consentToStoreCustomer);
    const list = Array.isArray(store.quotes) ? store.quotes.slice() : [];
    const existing = list.find(item => item.reference === ref);
    const version = existing ? existing.version + 1 : 1;
    const content = quoteContent(quote, consent);
    const prior = existing
      ? [
          { version: existing.version, savedAt: existing.savedAt, ...quoteContent(existing, consent) },
          ...(Array.isArray(existing.history) ? existing.history.map(h => ({ ...h, customer: consent ? h.customer || '' : '' })) : [])
        ].slice(0, QUOTE_HISTORY_LIMIT)
      : [];
    const record = {
      reference: ref,
      version,
      savedAt: now,
      consentToStoreCustomer: consent,
      ...content,
      history: prior
    };
    const others = list.filter(item => item.reference !== ref);
    const next = [record, ...others].slice(0, QUOTE_LIMIT);
    return { quotes: next, saved: record, history: existing ? existing.version : 0 };
  }

  // Returns the form values for the current or an earlier stored version.
  function restoreQuote(record, version) {
    const src = version === undefined || version === record.version
      ? record
      : (Array.isArray(record.history) ? record.history : []).find(h => h.version === version);
    if (!src) fail('That version is not stored on this device.');
    return {
      reference: record.reference,
      version: src.version,
      business: src.business || '',
      customer: src.customer || '',
      consentToStoreCustomer: Boolean(record.consentToStoreCustomer),
      service: src.service || '',
      scope: src.scope || '',
      exclusions: src.exclusions || '',
      terms: src.terms || '',
      validDays: src.validDays ?? 14,
      taxMode: src.taxMode || 'none',
      taxRate: src.taxRate ?? 10,
      discountPct: src.discountPct ?? 0,
      lines: (src.lines || []).map(line => ({ ...line }))
    };
  }

  // Validity runs from the saved date of the version, in UTC calendar days.
  // Returns null when no validity period is set.
  function quoteValidUntil(savedAt, validDays) {
    const days = num(validDays ?? 0, 'Validity in days', 0, QUOTE_VALID_MAX_DAYS);
    if (days === 0) return null;
    const start = Date.parse(savedAt);
    if (!Number.isFinite(start)) fail('The saved date is not valid.');
    return new Date(start + days * 86400000).toISOString().slice(0, 10);
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
    restoreQuote,
    quoteValidUntil,
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
  globalThis.TitanToolCalcs = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
