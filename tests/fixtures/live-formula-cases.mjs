// Input grid shared by the before-fixture generator and the regression test (#104).
// Each case is run against a calculator module C and must match tests/fixtures/live-formulas.json.
// Default inputs mirror the live form defaults; non-default inputs exercise every optional share.
export function formulaCases(C) {
  const lineSet = [
    { description: 'Service', quantity: 1, unitPrice: 0 },
    { description: 'Deep clean', quantity: 2.5, unitPrice: 180.1 },
    { description: 'Materials', quantity: 3, unitPrice: 12.35 },
  ];
  const quoteLines = [
    { description: 'Gutter clean', quantity: 1, unitPrice: 245.5 },
    { description: 'Fascia repair', quantity: 0.75, unitPrice: 320 },
    { description: 'Sealant', quantity: 4, unitPrice: 9.99 },
  ];
  const roles = [{ hours: 2, rate: 45 }, { hours: 1.5, rate: 62.5 }];
  
  return {
    'admin/default': () => C.adminCost({ adminHours: 10, adminRate: 45, reclaimPct: 25, cashPct: 0, reinvestPct: 0 }),
    'admin/non-default': () => C.adminCost({ adminHours: 7.5, adminRate: 52.35, reclaimPct: 50, cashPct: 25, reinvestPct: 25 }),
    'admin/zero': () => C.adminCost({ adminHours: 0, adminRate: 0, reclaimPct: 0 }),
    'admin/error-shares': () => C.adminCost({ adminHours: 5, adminRate: 40, cashPct: 70, reinvestPct: 40 }),
    'hire/default': () => C.hiringCost({ salary: 65000, superPct: 0, leavePct: 0, oncost: 18, paidHours: 38, utilisationPct: 80, margin: 180, jobHours: 2.5, contractorRate: 0 }),
    'hire/non-default': () => C.hiringCost({ salary: 81250.5, superPct: 12, leavePct: 2, oncost: 4, paidHours: 40, utilisationPct: 75, margin: 133.33, jobHours: 3, contractorRate: 65 }),
    'hire/zero-margin': () => C.hiringCost({ salary: 62000, superPct: 0, leavePct: 0, oncost: 20, paidHours: 38, utilisationPct: 80, margin: 0, jobHours: 2.5, contractorRate: 0 }),
    'hire/error-paid-hours': () => C.hiringCost({ salary: 65000, paidHours: 0, margin: 180 }),
    'profit/default': () => C.jobProfitability({ jobRevenue: 650, taxMode: 'exclusive', taxRate: 10, labour: 220, materials: 110, travel: 45, overhead: 0, discountPct: 0, targetMarginPct: 30 }),
    'profit/inclusive-discount': () => C.jobProfitability({ jobRevenue: 660, taxMode: 'inclusive', taxRate: 10, labour: 220, materials: 110, travel: 45, overhead: 40, discountPct: 5, targetMarginPct: 35 }),
    'profit/zero-revenue': () => C.jobProfitability({ jobRevenue: 0, taxMode: 'exclusive', taxRate: 10, labour: 0, materials: 0, travel: 0, overhead: 0, discountPct: 0, targetMarginPct: 30 }),
    'capacity/default': () => C.capacityPlanner({ workers: 4, hours: 30, duration: 2.5, currentJobs: 150, daysPerWeek: 5, leaveDays: 0, nonbillPct: 0, travelMin: 0, cancelPct: 0 }),
    'capacity/non-default': () => C.capacityPlanner({ workers: 3, hours: 40, duration: 1.5, currentJobs: 90, daysPerWeek: 4.5, leaveDays: 10, nonbillPct: 12.5, travelMin: 20, cancelPct: 7 }),
    'capacity/error-leave': () => C.capacityPlanner({ workers: 2, hours: 30, duration: 2, currentJobs: 10, daysPerWeek: 5, leaveDays: 300, nonbillPct: 0, travelMin: 0, cancelPct: 0 }),
    // #28: recovery conversion is set equal to likely conversion, and the old flat messaging cost is
    // entered as an SMS cost on 100% of follow-ups. These inputs reproduce the pre-#28 scenario.
    'calls/default': () => C.missedEnquiry({ calls: 120, missed: 12, convert: 30, jobValue: 350, reachPct: 0, recoveryPct: 30, contribPct: 100, smsPct: 0, smsCost: 0 }),
    'calls/non-default': () => C.missedEnquiry({ calls: 77, missed: 13.5, convert: 41.25, jobValue: 289.99, reachPct: 40, recoveryPct: 41.25, contribPct: 65, smsPct: 100, smsCost: 1.2 }),
    'leads/default': () => C.leadConversion({ leads: 100, value: 450, contribPct: 100, base_contacted: 90, base_qualified: 50, base_booked: 60, base_completed: 80, alt_contacted: 92, alt_qualified: 50, alt_booked: 62, alt_completed: 80 }),
    'leads/reduction': () => C.leadConversion({ leads: 64, value: 289.5, contribPct: 40, base_contacted: 90, base_qualified: 50, base_booked: 60, base_completed: 80, alt_contacted: 85, alt_qualified: 45, alt_booked: 60, alt_completed: 70 }),
    'invoice/default': () => C.invoiceCollection({ invoices: 80, avg: 520, chase: 7, age_d0_30: 0, age_d31_60: 10, age_d61_90: 5, age_d90: 3, collect_d0_30: 95, collect_d31_60: 80, collect_d61_90: 50, collect_d90: 20 }),
    'invoice/non-default': () => C.invoiceCollection({ invoices: 33, avg: 412.5, chase: 3.5, age_d0_30: 20, age_d31_60: 15, age_d61_90: 10, age_d90: 5, collect_d0_30: 90, collect_d31_60: 70, collect_d61_90: 40, collect_d90: 10 }),
    'admin/oncost': () => C.adminCost({ adminHours: 12, adminRate: 40, oncostPct: 22, reclaimPct: 30, cashPct: 10, reinvestPct: 5 }),
    'invoice/terms': () => C.invoiceCollection({ invoices: 50, avg: 380, chase: 4, terms: 45, within4: 50, age_d0_30: 20, age_d31_60: 15, age_d61_90: 10, age_d90: 5, collect_d0_30: 95, collect_d31_60: 75, collect_d61_90: 45, collect_d90: 15 }),
    'invoice/error-ageing': () => C.invoiceCollection({ invoices: 10, avg: 100, chase: 0, age_d0_30: 60, age_d31_60: 30, age_d61_90: 10, age_d90: 5 }),
    'quote/none': () => C.quoteTotals({ lines: quoteLines, discountPct: 0, taxMode: 'none', taxRate: 10 }),
    'quote/exclusive': () => C.quoteTotals({ lines: quoteLines, discountPct: 10, taxMode: 'exclusive', taxRate: 10 }),
    'quote/inclusive': () => C.quoteTotals({ lines: lineSet, discountPct: 7.5, taxMode: 'inclusive', taxRate: 10 }),
    'quote/error-mode': () => C.quoteTotals({ lines: quoteLines, taxMode: 'bogus' }),
    'jobcost/default': () => C.jobCostSheet({ roles, materials: 120, materialMarkupPct: 10, equipment: 15, km: 42, kmRate: 0.85, travel: 5, contingencyPct: 5, overhead: 30, price: 480, targetMarginPct: 30 }),
    'jobcost/zero-price': () => C.jobCostSheet({ roles: [{ hours: 0, rate: 0 }], materials: 0, materialMarkupPct: 0, equipment: 0, km: 0, kmRate: 0, travel: 0, contingencyPct: 0, overhead: 0, price: 0, targetMarginPct: 30 }),
    'jobcost/error-roles': () => C.jobCostSheet({ roles: Array.from({ length: 51 }, () => ({ hours: 1, rate: 1 })) }),
    'cost-to-quote-line': () => C.costToQuoteLine({ price: 480.005 }, 'Service'),
    'quote-record/save': () => C.saveQuoteRecord({ quotes: [] }, { reference: 'q 1-a', validDays: 14, business: 'Biz', customer: 'Cust', consentToStoreCustomer: false, service: 'S', scope: '', exclusions: '', terms: '', taxMode: 'exclusive', taxRate: 10, discountPct: 0, lines: lineSet }, '2026-11-18T00:00:00.000Z'),
  };
}
