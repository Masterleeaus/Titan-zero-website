/* Titan business planners: pure calculation definitions for issues #34-#41.
 * No DOM, no network, no storage. Money is integer cents internally; every
 * money result is rounded to the cent at the step where it is produced.
 * Loaded by pages/tool-*.html via assets/planner-ui.js; also loadable by Node tests.
 * Every result is an estimate from the user's own inputs, not a market price,
 * guaranteed saving or return on investment. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TitanPlanners = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const MAX_AMOUNT = 1e9;
  const GST_RATE = 0.1; // Australian GST is 10 per cent.
  const MONTH_FACTOR = 52 / 12; // Assumption: 52 weeks a year spread evenly over 12 months.
  const VISITS_PER_YEAR = { weekly: 52, fortnightly: 26, monthly: 12 };

  // Approved AI band prices, A$ per month including GST (README: Pricing rules on the site).
  const AI_BANDS = {
    light: { assistant: 19, agent: 79 },
    standard: { assistant: 29, agent: 99 },
    heavy: { assistant: 39, agent: 129 }
  };

  // ---- cents helpers -------------------------------------------------------
  const cents = (amount) => Math.round(Number((Number(amount) * 100).toFixed(6)));
  const roundC = (c) => Math.round(Number(c.toFixed(6)));
  const ceilC = (c) => Math.ceil(Number(c.toFixed(6)));
  const floorC = (c) => Math.floor(Number(c.toFixed(6)));
  const amt = (c) => c / 100;

  function fail(error) { return { ok: false, error }; }

  // ---- field descriptors (single source for form and validation) -----------
  const F = {
    money: (key, label, def = 0, min = 0, max = MAX_AMOUNT) => ({ key, label, type: 'money', unit: 'A$', def, min, max }),
    num: (key, label, def, unit, min = 0, max = MAX_AMOUNT, integer = false) => ({ key, label, type: 'number', unit, def, min, max, integer }),
    pct: (key, label, def, min = 0, max = 100) => ({ key, label, type: 'number', unit: '%', def, min, max }),
    select: (key, label, def, options) => ({ key, label, type: 'select', def, options }),
    text: (key, label, def) => ({ key, label, type: 'text', def })
  };

  function validate(values, fields) {
    for (const f of fields) {
      if (f.type === 'text') continue;
      if (f.type === 'select') {
        if (!f.options.some((o) => o.value === values[f.key])) return fail(`${f.label}: choose one of the listed options.`);
        continue;
      }
      const n = values[f.key];
      if (typeof n !== 'number' || !Number.isFinite(n)) return fail(`${f.label}: enter a number.`);
      if (n < f.min || n > f.max) return fail(`${f.label}: enter a value from ${f.min} to ${f.max}.`);
      if (f.type === 'money' && Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return fail(`${f.label}: enter dollars and cents, with no more than two decimal places.`);
      if (f.integer && !Number.isInteger(n)) return fail(`${f.label}: enter a whole number.`);
    }
    return null;
  }

  // Result cells carry their own format so the UI can display them consistently.
  const money = (c) => ({ v: amt(c), f: 'money' });
  const hours = (h) => ({ v: h, f: 'hours' });
  const count = (n) => ({ v: n, f: 'count' });
  const pct = (p) => ({ v: p, f: 'pct' });
  const text = (t) => ({ v: t, f: 'text' });
  const ok = (body) => Object.assign({ ok: true }, body);

  // ---- #34 Service pricing and minimum quote -------------------------------
  const SERVICE_FIELDS = [
    F.text('role', 'Labour role (for your records)', ''),
    F.num('labourHours', 'Labour hours for one job', 0, 'hours', 0, 10000),
    F.money('labourRate', 'Labour cost per hour', 0, 0, 1000000),
    F.money('materials', 'Materials per job', 0),
    F.money('travel', 'Travel per job', 0),
    F.money('equipment', 'Equipment or consumables per job', 0),
    F.money('overhead', 'Overhead allocated per job', 0),
    F.pct('contingencyPct', 'Contingency on direct costs', 0),
    F.pct('targetMarginPct', 'Target margin', 0, 0, 100),
    F.pct('discountPct', 'Discount you may offer', 0, 0, 99.99),
    F.select('gst', 'GST', 'no', [
      { value: 'no', label: 'Not registered for GST: no GST added' },
      { value: 'yes', label: 'Registered for GST: add 10% GST to the price' }
    ])
  ];

  function servicePricing(v) {
    const err = validate(v, SERVICE_FIELDS);
    if (err) return err;
    const rateC = cents(v.labourRate);
    const labourC = roundC(v.labourHours * rateC);
    const materialsC = cents(v.materials);
    const travelC = cents(v.travel);
    const equipmentC = cents(v.equipment);
    const overheadC = cents(v.overhead);
    const directC = labourC + materialsC + travelC + equipmentC;
    const contingencyC = roundC(directC * v.contingencyPct / 100);
    const unitCostC = directC + contingencyC + overheadC;
    const gstOn = v.gst === 'yes';
    const incl = (c) => (gstOn ? c + roundC(c * GST_RATE) : c);
    const targetOk = v.targetMarginPct < 100;
    const targetC = targetOk ? ceilC(unitCostC * 100 / (100 - v.targetMarginPct)) : null;
    const listC = targetOk ? ceilC(targetC * 100 / (100 - v.discountPct)) : null;
    const discountC = targetOk ? floorC(listC * v.discountPct / 100) : null;
    const afterC = targetOk ? listC - discountC : null;
    const marginAfter = targetOk && afterC > 0 ? (afterC - unitCostC) / afterC * 100 : null;
    const marginAt = (c) => (c > 0 ? (c - unitCostC) / c * 100 : null);
    const scenarios = [
      { label: 'Floor price (covers cost, no margin)', exGst: money(unitCostC), incGst: money(incl(unitCostC)), margin: pct(marginAt(unitCostC)) },
      { label: 'Price at target margin', exGst: targetOk ? money(targetC) : text('Not achievable at 100%'), incGst: targetOk ? money(incl(targetC)) : text('Not achievable'), margin: pct(targetOk ? v.targetMarginPct : null) },
      { label: 'List price before discount', exGst: targetOk ? money(listC) : text('Not achievable'), incGst: targetOk ? money(incl(listC)) : text('Not achievable'), margin: pct(targetOk ? marginAt(targetC) : null) },
      { label: 'Price after discount', exGst: targetOk ? money(afterC) : text('Not achievable'), incGst: targetOk ? money(incl(afterC)) : text('Not achievable'), margin: pct(targetOk ? marginAfter : null) }
    ];
    return ok({
      headline: { label: 'Floor price, excluding GST', ...money(unitCostC) },
      summary: [
        { label: 'True unit cost, excluding GST', ...money(unitCostC) },
        { label: 'Floor price (zero margin)', ...money(unitCostC) },
        targetOk
          ? { label: 'Recommended price at target margin', ...money(targetC) }
          : { label: 'Recommended price at target margin', ...text('Not achievable at 100% margin') },
        { label: 'Margin at price after discount', ...pct(marginAfter) }
      ],
      tables: [{ caption: 'Price scenarios', headers: ['Scenario', 'Excluding GST', 'Including GST', 'Margin'], rows: scenarios.map((s) => [s.label, s.exGst, s.incGst, s.margin]) }],
      math: [
        'Labour = hours × hourly cost',
        'Direct cost = labour + materials + travel + equipment',
        'Contingency = direct cost × contingency %',
        'True unit cost = direct cost + contingency + overhead per job',
        'Target price = unit cost ÷ (1 − target margin)',
        'List price = target price ÷ (1 − discount), rounded up to the cent',
        'Margin = (price − unit cost) ÷ price'
      ],
      notes: [
        'This is an arithmetic scenario from your inputs. It is not a market quote or a price guide.',
        'Each cost is counted once. Overhead is added per job, not per hour.',
        targetOk ? 'Prices are rounded up to the cent so the margin is never below the target.' : 'A 100% margin needs an infinite price, so no target price is shown.',
        'Check scope, exclusions, tax and local market conditions before quoting.'
      ]
    });
  }

  // ---- #35 Booking revenue, cancellation and no-show -----------------------
  const BOOKING_SHARED = [
    F.num('bookingsPerWeek', 'Bookings made each week', 0, 'bookings', 0, 100000),
    F.money('serviceValue', 'Average booked service value', 0),
    F.money('costPerJob', 'Actual cost per completed job (labour, materials, travel)', 0)
  ];
  const BOOKING_SCENARIO = [
    F.pct('noShowPct', 'No-show rate', 0),
    F.pct('cancelPct', 'Cancellation rate (given before the visit)', 0),
    F.pct('rebookPct', 'Lost bookings rebooked after follow-up', 0),
    F.pct('depositPct', 'Lost value recovered by deposit or fee', 0)
  ];

  function bookingWeekly(v) {
    const err = validate(v, [...BOOKING_SHARED, ...BOOKING_SCENARIO]);
    if (err) return err;
    if (v.noShowPct + v.cancelPct > 100) return fail('No-show and cancellation rates together cannot exceed 100%.');
    const valueC = cents(v.serviceValue);
    const costC = cents(v.costPerJob);
    const bookings = v.bookingsPerWeek;
    const lost = bookings * (v.noShowPct + v.cancelPct) / 100;
    const completed = bookings - lost;
    const rebooked = lost * v.rebookPct / 100;
    const unrecovered = lost - rebooked;
    const bookedC = roundC(bookings * valueC);
    const lostValueC = roundC(lost * valueC);
    const completedRevenueC = roundC((completed + rebooked) * valueC);
    const depositC = roundC(unrecovered * v.depositPct / 100 * valueC);
    const cashC = completedRevenueC + depositC;
    const jobsDone = completed + rebooked;
    const jobCostC = roundC(jobsDone * costC);
    const contributionC = cashC - jobCostC;
    return { bookings, lost, jobsDone, bookedC, lostValueC, completedRevenueC, depositC, cashC, jobCostC, contributionC };
  }

  function bookingRevenue(v) {
    const w = bookingWeekly(v);
    if (w.ok === false) return w;
    const m = (c) => roundC(c * MONTH_FACTOR);
    const row = (label, weekly, monthly, f = 'money') => [label, { v: f === 'money' ? amt(weekly) : weekly, f }, { v: f === 'money' ? amt(monthly) : monthly, f }];
    return ok({
      headline: { label: 'Contribution per month, after actual job cost', ...money(m(w.contributionC)) },
      summary: [
        { label: 'Booked value per month', ...money(m(w.bookedC)) },
        { label: 'Cash collected per month', ...money(m(w.cashC)) }
      ],
      tables: [{
        caption: 'Booking pipeline (weekly and monthly)',
        headers: ['Measure', 'Per week', 'Per month'],
        rows: [
          row('Bookings', w.bookings, w.bookings * MONTH_FACTOR, 'count'),
          row('Booked value', w.bookedC, m(w.bookedC)),
          row('Lost to no-show or cancellation', w.lostValueC, m(w.lostValueC)),
          row('Completed revenue (includes rebooked jobs)', w.completedRevenueC, m(w.completedRevenueC)),
          row('Deposits or fees recovered', w.depositC, m(w.depositC)),
          row('Cash collected', w.cashC, m(w.cashC)),
          row('Job cost for completed work', w.jobCostC, m(w.jobCostC)),
          row('Contribution after job cost', w.contributionC, m(w.contributionC))
        ]
      }],
      math: [
        'Lost bookings = bookings × (no-show % + cancellation %)',
        'Rebooked = lost × rebook %; unrecovered = lost − rebooked',
        'Completed revenue = (bookings − lost + rebooked) × service value',
        'Deposits or fees = unrecovered × deposit % × service value (not counted twice)',
        'Cash collected = completed revenue + deposits or fees',
        'Contribution = cash collected − jobs done × actual cost per job',
        'Monthly = weekly × 52 ÷ 12'
      ],
      notes: [
        'These are scenarios from your rates. No recovery rate is guaranteed.',
        'No-show and cancelled visits are assumed to cost nothing. Enter any travel or setup cost you still pay for them in the cost per job.',
        'Scheduled and Agent services are optional next steps. Front Desk Free works without them.'
      ]
    });
  }

  function pairBooking(a, b) {
    if (!a.ok || !b.ok) return [];
    return [{ label: 'Monthly contribution difference (scenario minus current)', ...money(roundC((b.headline.v - a.headline.v) * 100)), f: 'money' }];
  }

  // ---- #36 Travel and route cost --------------------------------------------
  const TRAVEL_SHARED = [
    F.num('jobsPerDay', 'Jobs per working day', 0, 'jobs', 0, 500),
    F.num('jobHours', 'Average paid time on site per job', 0, 'hours', 0, 24),
    F.money('wageRate', 'Driver or technician cost per hour', 0, 0, 10000),
    F.money('vehicleCostPerKm', 'Vehicle cost per km (fuel, wear, insurance share)', 0, 0, 100),
    F.num('paidHoursPerDay', 'Paid hours in the working day', 0, 'hours', 0, 24),
    F.num('daysPerWeek', 'Working days per week', 0, 'days', 0, 7)
  ];
  const TRAVEL_SCENARIO = [
    F.num('gapKm', 'Average distance between jobs', 0, 'km', 0, 1000),
    F.num('gapMinutes', 'Average travel time between jobs', 0, 'minutes', 0, 600),
    F.num('setupMinutes', 'Setup and parking time per job (not billed)', 0, 'minutes', 0, 240)
  ];

  function travelDay(v) {
    const err = validate(v, [...TRAVEL_SHARED, ...TRAVEL_SCENARIO]);
    if (err) return err;
    const gaps = Math.max(v.jobsPerDay - 1, 0);
    const driveKm = gaps * v.gapKm;
    const driveHours = gaps * v.gapMinutes / 60;
    const setupHours = v.jobsPerDay * v.setupMinutes / 60;
    const onSiteHours = v.jobsPerDay * v.jobHours;
    const nonBillableHours = driveHours + setupHours;
    const totalHours = onSiteHours + nonBillableHours;
    const wageC = roundC(nonBillableHours * cents(v.wageRate));
    const vehicleC = roundC(driveKm * cents(v.vehicleCostPerKm));
    const dayC = wageC + vehicleC;
    // Weekly and monthly parts are rounded separately so the rows always add up to the total.
    const weekWageC = roundC(wageC * v.daysPerWeek);
    const weekVehicleC = roundC(vehicleC * v.daysPerWeek);
    const monthWageC = roundC(weekWageC * MONTH_FACTOR);
    const monthVehicleC = roundC(weekVehicleC * MONTH_FACTOR);
    const weekC = weekWageC + weekVehicleC;
    const monthC = monthWageC + monthVehicleC;
    return { ok: true, driveKm, nonBillableHours, totalHours, paidHours: v.paidHoursPerDay, wageC, vehicleC, dayC, weekWageC, weekVehicleC, weekC, monthWageC, monthVehicleC, monthC, jobHours: v.jobHours, jobs: v.jobsPerDay };
  }

  function travelRoute(v) {
    const d = travelDay(v);
    if (d.ok === false) return d;
    const over = d.totalHours - d.paidHours;
    return ok({
      nonBillableHours: d.nonBillableHours, monthC: d.monthC, jobHours: d.jobHours,
      headline: { label: 'Travel and route cost per month', ...money(d.monthC) },
      summary: [
        { label: 'Driving distance per day', ...{ v: d.driveKm, f: 'km' } },
        { label: 'Non-billable hours per day', ...hours(d.nonBillableHours) },
        { label: 'Hours over (+) or under (−) the paid day', ...hours(over) }
      ],
      tables: [{
        caption: 'Cost of travel and setup',
        headers: ['Measure', 'Per day', 'Per week', 'Per month'],
        rows: [
          ['Driver time for travel and setup', money(d.wageC), money(d.weekWageC), money(d.monthWageC)],
          ['Vehicle cost for distance driven', money(d.vehicleC), money(d.weekVehicleC), money(d.monthVehicleC)],
          ['Total travel and route cost', money(d.dayC), money(d.weekC), money(d.monthC)]
        ]
      }],
      math: [
        'Gaps between jobs = jobs per day − 1 (none if there is one job or none)',
        'Driving km = gaps × km between jobs',
        'Non-billable hours = gaps × travel minutes ÷ 60 + jobs × setup minutes ÷ 60',
        'Driver cost = non-billable hours × cost per hour; vehicle cost = driving km × cost per km',
        'Weekly = daily × working days; monthly = weekly × 52 ÷ 12'
      ],
      notes: [
        'Distances and times are your estimates. This tool does not optimise a route or check a map.',
        'Driver time for travel is counted once, in the driver cost. Vehicle cost is counted once, per km.',
        d.totalHours > d.paidHours ? 'The day needs more hours than the paid day. Check the on-site time or the paid hours.' : 'The day fits within the paid hours you entered.',
        'Any recovered capacity is hypothetical and only real if the time is used for paid work.'
      ]
    });
  }

  function pairTravel(a, b) {
    if (!a.ok || !b.ok) return [];
    const recovered = Math.max(a.nonBillableHours - b.nonBillableHours, 0);
    const out = [
      { label: 'Hypothetical hours recovered per day in the scenario', ...hours(recovered) },
      { label: 'Monthly saving on travel cost in the scenario (before any extra work)', ...money(roundC(Math.max(a.monthC - b.monthC, 0))) }
    ];
    const jobHours = a.jobHours;
    if (jobHours > 0) out.push({ label: 'Hypothetical extra jobs per day if the time is resold', ...{ v: recovered / jobHours, f: 'count1' } });
    else out.push({ label: 'Hypothetical extra jobs per day if the time is resold', ...text('Enter paid time per job') });
    return out;
  }

  // ---- #37 Recurring service revenue and retention --------------------------
  const RECURRING_FIELDS = [
    F.num('clients', 'Active recurring clients now', 0, 'clients', 0, 100000),
    F.select('frequency', 'Visit frequency', 'monthly', [
      { value: 'weekly', label: 'Weekly (52 visits a year)' },
      { value: 'fortnightly', label: 'Fortnightly (26 visits a year)' },
      { value: 'monthly', label: 'Monthly (12 visits a year)' }
    ]),
    F.money('price', 'Price per visit, excluding GST', 0),
    F.money('variableCost', 'Variable delivery cost per visit delivered', 0),
    F.pct('cancelPct', 'Visits cancelled by the client', 0),
    F.pct('churnPct', 'Clients leaving each month', 0),
    F.num('newClients', 'New clients onboarded each month', 0, 'clients', 0, 10000),
    F.pct('collectedSamePct', 'Share of fulfilled revenue received in the same month', 100),
    F.pct('rateChangePct', 'Rate change (can be negative)', 0, -100, 500),
    F.num('rateChangeMonth', 'Month the rate change starts (0 for none, 1 to 12)', 0, 'month', 0, 12, true)
  ];

  function recurringRevenue(v) {
    const err = validate(v, RECURRING_FIELDS);
    if (err) return err;
    const visits = VISITS_PER_YEAR[v.frequency];
    const priceC = cents(v.price);
    const varC = cents(v.variableCost);
    let active = v.clients;
    let deferredPrev = 0;
    const months = [];
    for (let m = 1; m <= 12; m++) {
      if (m > 1) active = active * (1 - v.churnPct / 100) + v.newClients;
      const rateOn = v.rateChangeMonth > 0 && m >= v.rateChangeMonth;
      const mPriceC = rateOn ? roundC(priceC * (1 + v.rateChangePct / 100)) : priceC;
      const scheduled = active * visits / 12;
      const fulfilled = scheduled * (1 - v.cancelPct / 100);
      const grossC = roundC(scheduled * mPriceC);
      const fulfilledC = roundC(fulfilled * mPriceC);
      const contribC = fulfilledC - roundC(fulfilled * varC);
      const deferredC = roundC(fulfilledC * (1 - v.collectedSamePct / 100));
      const cashC = fulfilledC - deferredC + deferredPrev;
      deferredPrev = deferredC;
      months.push({ m, active, mPriceC, grossC, fulfilledC, contribC, cashC, deferredC });
    }
    const sum = (key) => months.reduce((t, r) => t + r[key], 0);
    const year = { grossC: sum('grossC'), fulfilledC: sum('fulfilledC'), contribC: sum('contribC'), cashC: sum('cashC') };
    const endDeferred = months[11].deferredC;
    const lastPrice = months[11].mPriceC;
    return ok({
      headline: { label: '12-month fulfilled revenue', ...money(year.fulfilledC) },
      summary: [
        { label: '12-month gross contract value', ...money(year.grossC) },
        { label: '12-month contribution after delivery cost', ...money(year.contribC) },
        { label: 'Deferred receipts at end of month 12', ...money(endDeferred) }
      ],
      tables: [{
        caption: 'Month by month',
        headers: ['Month', 'Active clients', 'Price per visit', 'Gross contract value', 'Fulfilled revenue', 'Contribution', 'Cash received', 'Deferred'],
        rows: months.map((r) => [`Month ${r.m}`, { v: r.active, f: 'count1' }, money(r.mPriceC), money(r.grossC), money(r.fulfilledC), money(r.contribC), money(r.cashC), money(r.deferredC)])
      }],
      math: [
        'Active clients: month 1 = clients now; later months = previous × (1 − churn %) + new clients',
        'Visits per month = clients × visits per year ÷ 12 (52 weeks a year is spread over 12 months)',
        'Fulfilled visits = visits × (1 − cancellation %)',
        'Gross contract value = all scheduled visits × price; fulfilled revenue = fulfilled visits × price',
        'Deferred receipts = fulfilled revenue not received in the same month; received the next month'
      ],
      notes: [
        'Rate change: the new price applies from the month you enter, and stays for the rest of the year. Final price used in month 12: ' + amt(lastPrice).toFixed(2) + '.',
        'Gross contract value is what the agreements would bill if every visit happened. It is not cash.',
        'Deferred receipts still owed at the end of the year are not counted as cash received.',
        'Connect bookings in Front Desk Free and agreements in SortedAt.Work only if you use them; neither is required.'
      ]
    });
  }

  // ---- #38 13-week cash flow forecast ---------------------------------------
  const CASH_GLOBAL = [
    F.money('opening', 'Opening cash in the bank today (can be negative if overdrawn)', 0, -MAX_AMOUNT, MAX_AMOUNT),
    F.pct('sensitivityPct', 'Sensitivity: cut all money coming in by', 10)
  ];
  const CASH_ROW = [
    F.money('receipts', 'Expected customer receipts'),
    F.money('overdue', 'Overdue customer payments you expect to collect'),
    F.money('wages', 'Wages and on-costs'),
    F.money('suppliers', 'Supplier costs'),
    F.money('tax', 'Tax reserve or payments'),
    F.money('oneOff', 'One-off expenses')
  ];

  function runCash(openC, rows, haircutPct) {
    let open = openC;
    let lowest = null;
    let lowestWeek = null;
    let firstNegative = null;
    let totalIn = 0;
    let totalOut = 0;
    const weeks = rows.map((r, i) => {
      const inC = cents(r.receipts) + cents(r.overdue);
      const inAdjC = roundC(inC * (1 - haircutPct / 100));
      const outC = cents(r.wages) + cents(r.suppliers) + cents(r.tax) + cents(r.oneOff);
      const close = open + inAdjC - outC;
      const row = { week: i + 1, open, inflow: inAdjC, outflow: outC, close };
      totalIn += inAdjC;
      totalOut += outC;
      if (lowest === null || close < lowest) { lowest = close; lowestWeek = i + 1; }
      if (firstNegative === null && close < 0) firstNegative = i + 1;
      open = close;
      return row;
    });
    return { weeks, lowest, lowestWeek, gap: Math.max(0, -lowest), firstNegative, totalIn, totalOut, closing: open };
  }

  function cashFlow(v) {
    const { rows } = v;
    if (!Array.isArray(rows) || rows.length !== 13) return fail('Enter 13 weeks of figures.');
    const err = validate(v, CASH_GLOBAL) || rows.map((r) => validate(r, CASH_ROW)).find(Boolean);
    if (err) return err;
    const openC = cents(v.opening);
    const base = runCash(openC, rows, 0);
    const sens = runCash(openC, rows, v.sensitivityPct);
    const weekLabel = (w) => (w ? `Week ${w}` : 'None');
    return ok({
      headline: { label: 'Negative cash gap over 13 weeks (base case)', ...money(base.gap) },
      summary: [
        { label: 'Lowest closing cash (base case)', ...money(base.lowest) },
        { label: 'Lowest week (base case)', ...text(weekLabel(base.lowestWeek)) },
        { label: 'First week below zero (base case)', ...text(weekLabel(base.firstNegative)) },
        { label: 'Lowest closing cash (sensitivity case)', ...money(sens.lowest) },
        { label: 'Negative cash gap (sensitivity case)', ...money(sens.gap) }
      ],
      tables: [{
        caption: 'Weekly close',
        headers: ['Week', 'Opening', 'Money in', 'Money out', 'Close (base)', 'Close (sensitivity)'],
        rows: base.weeks.map((w, i) => [`Week ${w.week}`, money(w.open), money(w.inflow), money(w.outflow), money(w.close), money(sens.weeks[i].close)])
      }],
      math: [
        'Money in = customer receipts + overdue payments (sensitivity case: × (1 − cut %))',
        'Money out = wages + supplier costs + tax reserve + one-off expenses',
        'Close = opening + money in − money out; next week opens at this close',
        'Negative cash gap = the lowest close below zero, shown as a positive amount (0 if cash never falls below zero)'
      ],
      notes: [
        'This is a planning scenario from your own estimates. It is not a financial forecast or advice.',
        'Overdue payments are only counted if you enter them in the week you expect them.',
        'Amounts are in dollars and cents. Nothing is uploaded; keep a copy of the sheet yourself.'
      ]
    });
  }

  // ---- #39 Staff utilisation and training ----------------------------------
  const STAFF_GLOBAL = [
    F.pct('targetUtilPct', 'Target utilisation for your team', 75)
  ];
  const STAFF_ROW = [
    F.text('role', 'Role or team', ''),
    F.num('headcount', 'People', 0, 'people', 0, 10000),
    F.num('contractedHours', 'Contracted hours each (per week)', 0, 'hours', 0, 168),
    F.num('leaveHours', 'Leave each (per week, average)', 0, 'hours', 0, 168),
    F.num('trainingHours', 'Training each (per week)', 0, 'hours', 0, 168),
    F.num('travelHours', 'Non-billable travel each (per week)', 0, 'hours', 0, 168),
    F.money('contribPerHour', 'Contribution per productive hour', 0, 0, 10000)
  ];

  function staffRow(r, targetUtilPct) {
    const availablePP = Math.max(0, r.contractedHours - r.leaveHours);
    const nonProductivePP = Math.min(availablePP, r.trainingHours + r.travelHours);
    const productivePP = availablePP - nonProductivePP;
    const hc = r.headcount;
    const availT = availablePP * hc;
    const prodT = productivePP * hc;
    const utilisation = availablePP > 0 ? productivePP / availablePP * 100 : null;
    const contribC = roundC(prodT * cents(r.contribPerHour));
    const targetHours = availT * targetUtilPct / 100;
    const gapHours = prodT - targetHours;
    const trainingAtRiskC = roundC(r.trainingHours * hc * cents(r.contribPerHour));
    return { role: r.role, hc, availT, prodT, utilisation, trainingT: r.trainingHours * hc, travelT: r.travelHours * hc, contribC, gapHours, trainingAtRiskC };
  }

  function staffUtilisation(v) {
    const { rows } = v;
    if (!Array.isArray(rows) || rows.length === 0) return fail('Enter at least one role or team.');
    const err = validate(v, STAFF_GLOBAL) || rows.map((r) => validate(r, STAFF_ROW)).find(Boolean);
    if (err) return err;
    const computed = rows.map((r) => staffRow(r, v.targetUtilPct));
    const tot = computed.reduce((t, r) => ({
      hc: t.hc + r.hc, avail: t.avail + r.availT, prod: t.prod + r.prodT, contribC: t.contribC + r.contribC,
      training: t.training + r.trainingT, atRiskC: t.atRiskC + r.trainingAtRiskC
    }), { hc: 0, avail: 0, prod: 0, contribC: 0, training: 0, atRiskC: 0 });
    const teamUtil = tot.avail > 0 ? tot.prod / tot.avail * 100 : null;
    const monthC = roundC(tot.contribC * MONTH_FACTOR);
    const teamGap = tot.prod - tot.avail * v.targetUtilPct / 100;
    return ok({
      headline: { label: 'Team utilisation (productive ÷ available hours)', ...pct(teamUtil) },
      summary: [
        { label: 'Productive hours per week, all teams', ...hours(tot.prod) },
        { label: 'Contribution per week from productive hours', ...money(tot.contribC) },
        { label: 'Hours above (+) or below (−) target', ...hours(teamGap) },
        { label: 'Contribution per week at risk while in training (hypothetical)', ...money(tot.atRiskC) }
      ],
      tables: [{
        caption: 'By role or team (weekly)',
        headers: ['Role or team', 'People', 'Available hours', 'Productive hours', 'Utilisation', 'Training hours', 'Contribution'],
        rows: computed.map((r) => [r.role || 'Unnamed role', count(r.hc), hours(r.availT), hours(r.prodT), pct(r.utilisation), hours(r.trainingT), money(r.contribC)])
      }],
      math: [
        'Available hours = contracted hours − leave (never below zero), per person',
        'Productive hours = available − (training + travel), never below zero',
        'Utilisation = productive ÷ available × 100',
        'Contribution = productive hours for the team × contribution per productive hour',
        'Target gap = productive hours − available hours × target utilisation %'
      ],
      notes: [
        'Training is recorded as time only. This tool does not infer skills or competence from training hours.',
        'Skilled (SkilledAt.Work) is optional and needs verified credentials, not presumed from training time.',
        'Contracted hours and role scope come from your own records. Check them against any award or contract.',
        'When training or travel is larger than the available hours, productive hours show as zero.'
      ]
    });
  }

  // ---- #40 Customer response and follow-up ---------------------------------
  const CUSTOMER_SHARED = [
    F.num('enquiries', 'Enquiries received each month', 0, 'enquiries', 0, 1000000),
    F.pct('sharePhone', 'Share from phone calls', 100),
    F.pct('shareWeb', 'Share from web forms', 0),
    F.pct('shareEmail', 'Share from email and social messages', 0),
    F.money('avgJobValue', 'Average value of a completed booking', 0),
    F.money('jobVariableCost', 'Variable cost of a completed booking', 0)
  ];
  const CUSTOMER_SCENARIO = [
    F.pct('reachPhone', 'Reached by first contact: phone calls', 0),
    F.pct('reachWeb', 'Reached by first contact: web forms', 0),
    F.pct('reachEmail', 'Reached by first contact: email and social', 0),
    F.pct('timelyPct', 'First contact made within your response window', 100),
    F.pct('consentPct', 'Enquirers who consented to follow-up messages', 0),
    F.num('followUps', 'Consented follow-up messages per unreached enquiry', 0, 'messages', 0, 5, true),
    F.pct('recoveryPct', 'Consented unreached enquiries recovered by follow-up', 0),
    F.pct('qualifiedPct', 'Reached enquiries that qualify as leads', 0),
    F.pct('bookPct', 'Qualified leads that book', 0),
    F.pct('completionPct', 'Booked work that is completed', 100),
    F.money('costPerMessage', 'Cost per follow-up message', 0, 0, 100),
    F.num('touchesPerEnquiry', 'Staff touches per enquiry (calls, replies)', 0, 'touches', 0, 20),
    F.num('minutesPerTouch', 'Minutes per staff touch', 0, 'minutes', 0, 120)
  ];

  function customerResponse(v) {
    const err = validate(v, [...CUSTOMER_SHARED, ...CUSTOMER_SCENARIO]);
    if (err) return err;
    const shareSum = v.sharePhone + v.shareWeb + v.shareEmail;
    if (Math.abs(shareSum - 100) > 0.01) return fail('Channel shares must add up to 100%.');
    const reachFrac = (v.sharePhone * v.reachPhone + v.shareWeb * v.reachWeb + v.shareEmail * v.reachEmail) / 10000;
    const effReach = reachFrac * v.timelyPct / 100;
    const E = v.enquiries;
    const reached = E * effReach;
    const unreached = E - reached;
    const consentedUnreached = unreached * v.consentPct / 100;
    const recovered = v.followUps > 0 ? consentedUnreached * v.recoveryPct / 100 : 0;
    const leads = reached + recovered;
    const qualified = leads * v.qualifiedPct / 100;
    const booked = qualified * v.bookPct / 100;
    const completed = booked * v.completionPct / 100;
    const messages = consentedUnreached * v.followUps;
    const valueC = cents(v.avgJobValue);
    const jobCostC = cents(v.jobVariableCost);
    const revenueC = roundC(completed * valueC);
    const variableC = roundC(completed * jobCostC);
    const messageC = roundC(messages * cents(v.costPerMessage));
    const contribC = revenueC - variableC - messageC;
    const touches = E * v.touchesPerEnquiry;
    const staffHours = touches * v.minutesPerTouch / 60;
    return ok({
      headline: { label: 'Completed bookings per month', ...count(completed) },
      summary: [
        { label: 'Contribution per month, before staff time', ...money(contribC) },
        { label: 'Staff hours per month on responses', ...hours(staffHours) }
      ],
      tables: [
        {
          caption: 'Funnel (per month)',
          headers: ['Stage', 'Count'],
          rows: [
            ['Enquiries', count(E)], ['Reached by first contact (in window)', count(reached)],
            ['Recovered by consented follow-up', count(recovered)], ['Qualified leads', count(qualified)],
            ['Booked', count(booked)], ['Completed', count(completed)]
          ]
        },
        {
          caption: 'Staff workload and messages (per month)',
          headers: ['Measure', 'Value'],
          rows: [['Staff touches', count(touches)], ['Staff hours', hours(staffHours)], ['Automated follow-up messages', count(messages)]]
        },
        {
          caption: 'Contribution (per month)',
          headers: ['Measure', 'Amount'],
          rows: [['Completed revenue', money(revenueC)], ['Variable job cost', money(variableC)], ['Follow-up message cost', money(messageC)], ['Contribution before staff time', money(contribC)]]
        }
      ],
      math: [
        'Reach = channel share × first-contact reach, added up, then × timely %',
        'Unreached consented enquiries = enquiries × (1 − reach) × consent %',
        'Recovered = unreached consented × recovery % (only if at least one follow-up)',
        'Leads = reached + recovered; qualified, booked and completed use the rates you entered',
        'Messages = unreached consented × follow-ups per enquiry',
        'Contribution = completed × (value − variable cost) − messages × cost per message; staff time shown separately'
      ],
      notes: [
        'Only send follow-up messages to people who have agreed to receive them. Honour opt-outs at once, and avoid sending outside agreed hours.',
        'Manual and configured workflows are compared using your own baseline rates. No AI benefit is assumed or guaranteed.',
        'Staff time is shown separately from contribution, so the two are not netted against each other.'
      ]
    });
  }

  function pairCustomer(a, b) {
    if (!a.ok || !b.ok) return [];
    return [
      { label: 'Completed bookings difference per month (scenario minus current)', ...count(b.headline.v - a.headline.v) },
      { label: 'Staff hours difference per month (scenario minus current)', ...hours(b.summary[1].v - a.summary[1].v) }
    ];
  }

  // ---- #41 Titan Zero upgrade configurator ----------------------------------
  const UPGRADE_KEYS = ['assistant', 'agent', 'supercharged', 'scheduled', 'sorted', 'skilled'];
  const UPGRADE_FIELDS = [
    F.select('assistantBand', 'AI Assistant workload band', 'standard', [
      { value: 'light', label: 'Light' }, { value: 'standard', label: 'Standard' }, { value: 'heavy', label: 'Heavy' }
    ]),
    F.select('agentBand', 'AI Agent Team workload band', 'standard', [
      { value: 'light', label: 'Light' }, { value: 'standard', label: 'Standard' }, { value: 'heavy', label: 'Heavy' }
    ]),
    F.num('hoursSavedPerWeek', 'Your scenario: hours of admin you expect to move each week', 0, 'hours', 0, 168),
    F.money('valuePerHour', 'Your scenario: value you put on each hour', 0, 0, 10000)
  ];

  function upgradePlan(v) {
    if (UPGRADE_KEYS.some((k) => typeof v[k] !== 'boolean')) return fail('Choose yes or no for each upgrade.');
    const err = validate(v, UPGRADE_FIELDS);
    if (err) return err;
    const agentOn = v.agent === true;
    const lines = [];
    let knownIncC = 0;
    let knownExC = 0;
    let knownGstC = 0;
    const addLine = (name, status, incC, note) => {
      let exC = null;
      let gstC = null;
      if (incC !== null) {
        exC = roundC(incC / (1 + GST_RATE));
        gstC = incC - exC;
        knownIncC += incC; knownExC += exC; knownGstC += gstC;
      }
      lines.push({ name, status, incC, exC, gstC, note });
    };
    addLine('Free foundation: Front Desk Free plugin and Titan Zero Core', 'Included', 0, 'No payment needed.');
    const assistantBand = AI_BANDS[v.assistantBand];
    if (v.assistant && agentOn) {
      addLine('AI Assistant', 'Included in AI Agent Team', 0, 'The Agent Team includes the Assistant, so it is not charged twice.');
    } else if (v.assistant) {
      addLine('AI Assistant', 'Selected', assistantBand.assistant * 100, `${v.assistantBand} band`);
    } else {
      addLine('AI Assistant', 'Not selected', null, '');
    }
    if (agentOn) addLine('AI Agent Team', 'Selected', AI_BANDS[v.agentBand].agent * 100, `${v.agentBand} band`);
    else addLine('AI Agent Team', 'Not selected', null, '');
    const appLabels = { supercharged: 'SuperchargedAt.Work', scheduled: 'ScheduledAt.Work', sorted: 'SortedAt.Work', skilled: 'SkilledAt.Work' };
    let appsOnRequest = 0;
    for (const key of ['supercharged', 'scheduled', 'sorted', 'skilled']) {
      if (v[key]) { appsOnRequest += 1; addLine(appLabels[key], 'Request quote', null, 'No app upgrade price is published yet.'); }
      else addLine(appLabels[key], 'Not selected', null, '');
    }
    const scenarioValueC = roundC(v.hoursSavedPerWeek * MONTH_FACTOR * cents(v.valuePerHour));
    return ok({
      headline: { label: 'Known AI upgrade fees per month, including GST', ...money(knownIncC) },
      summary: [
        { label: 'Known fees per month, excluding GST', ...money(knownExC) },
        { label: 'GST inside the known fees', ...money(knownGstC) },
        { label: 'App upgrades on request quote', ...count(appsOnRequest) },
        { label: 'Your scenario value per month (your figures, not a forecast)', ...money(scenarioValueC) }
      ],
      tables: [{
        caption: 'Upgrade by upgrade (per month)',
        headers: ['Upgrade', 'Status', 'Including GST', 'Excluding GST'],
        rows: lines.map((l) => [l.name, text(l.status), l.incC === null ? text(l.status === 'Request quote' ? 'Request quote' : '—') : money(l.incC), l.exC === null ? text('—') : money(l.exC)])
      }],
      math: [
        'AI band prices are per month including GST: Assistant A$19, A$29 or A$39; Agent Team A$79, A$99 or A$129 (Light, Standard, Heavy)',
        'Excluding GST = including GST ÷ 1.1, rounded to the cent; GST = the difference',
        'Your scenario value = hours per week × 52 ÷ 12 × value per hour, shown on its own line and not netted against fees'
      ],
      notes: [
        'Each upgrade is independent. Choosing one does not add another.',
        'App upgrades show "Request quote" and are not added to the total.',
        'Not included above: optional SMS or voice pass-through (usage-based, request quote), one-off setup (request quote), and any plan eligibility check.',
        'Your scenario value is not a return on investment and is not a promised saving.'
      ]
    });
  }

  // ---- definitions for the UI -----------------------------------------------
  const definitions = {
    'service-pricing': { slug: 'service-pricing', title: 'Service pricing and minimum quote', mode: 'single', fields: SERVICE_FIELDS, calc: servicePricing },
    'booking-revenue': { slug: 'booking-revenue', title: 'Booking revenue and no-show planner', mode: 'compare', shared: BOOKING_SHARED, scenarioFields: BOOKING_SCENARIO, scenarioLabels: ['Current', 'Scenario'], calc: bookingRevenue, pair: pairBooking },
    'travel-route-cost': { slug: 'travel-route-cost', title: 'Travel and route cost', mode: 'compare', shared: TRAVEL_SHARED, scenarioFields: TRAVEL_SCENARIO, scenarioLabels: ['Current route', 'Route scenario'], calc: travelRoute, pair: pairTravel },
    'recurring-service-revenue': { slug: 'recurring-service-revenue', title: 'Recurring service revenue and retention', mode: 'single', fields: RECURRING_FIELDS, calc: recurringRevenue },
    'cash-flow-forecast': { slug: 'cash-flow-forecast', title: 'Thirteen-week cash flow forecast', mode: 'rows', globalFields: CASH_GLOBAL, rowFields: CASH_ROW, rowCount: 13, rowLabel: 'Week', calc: cashFlow },
    'staff-utilisation': { slug: 'staff-utilisation', title: 'Staff utilisation and training', mode: 'rows', globalFields: STAFF_GLOBAL, rowFields: STAFF_ROW, rowCount: 3, rowLabel: 'Team', calc: staffUtilisation },
    'customer-response': { slug: 'customer-response', title: 'Customer response and follow-up planner', mode: 'compare', shared: CUSTOMER_SHARED, scenarioFields: CUSTOMER_SCENARIO, scenarioLabels: ['Manual workflow', 'Configured workflow'], calc: customerResponse, pair: pairCustomer },
    'titan-zero-upgrade-planner': { slug: 'titan-zero-upgrade-planner', title: 'Titan Zero upgrade cost planner', mode: 'upgrades', upgradeKeys: UPGRADE_KEYS, fields: UPGRADE_FIELDS, calc: upgradePlan }
  };

  return {
    definitions, AI_BANDS, GST_RATE, MONTH_FACTOR, VISITS_PER_YEAR, MAX_AMOUNT,
    validate, runCash,
    servicePricing, bookingRevenue, travelRoute, recurringRevenue, cashFlow, staffUtilisation, customerResponse, upgradePlan,
    pairBooking, pairTravel, pairCustomer
  };
});
