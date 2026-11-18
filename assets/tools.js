(()=>{
'use strict';
// Shared, tested engine (assets/tools-engine.js): validation, cents arithmetic and profile migration.
// Calculator pages load it before this file (scripts/check-tool-parity.mjs enforces the order).
// Other pages load this file for site scripts only, so without the engine it does nothing.
const engine=globalThis.TitanToolsEngine;
const data=window.TITAN_SITE_CONTENT;
if(!data||!engine)return;
const rootUrl=new URL(document.body.dataset.siteRoot||'/',document.URL);
const pageUrl=(path)=>new URL(String(path).replace(/^\/+/,''),rootUrl).href;
const money=(n)=>'A$'+new Intl.NumberFormat('en-AU',{maximumFractionDigits:2}).format(Number(n)||0);
const number=(n,digits=0)=>new Intl.NumberFormat('en-AU',{maximumFractionDigits:digits}).format(Number(n)||0);
const escContext=(value)=>String(value||'').trim().slice(0,240);
const storageKey='titanBusinessToolProfileV3';
const industryById=Object.fromEntries(data.industries.map((item)=>[item.id,item]));
const verticalOptions=data.industries;
const query=new URLSearchParams(location.search);
const calcs=()=>engine.formulas;
const rowLabelIsCount=(label)=>/\bjobs\b|enquir|\bspare\b|\bover\b/i.test(label);
const rowText=(label,value)=>typeof value==='number'?(rowLabelIsCount(label)?number(value):money(value)):String(value);
const defaults={
admin:{title:'Admin cost',fields:[['adminHours','Admin hours each week',10,'hours/week'],['adminRate','Hourly wage before on-costs',45,'A$/hour'],['oncostPct','On-costs on top of wage (super, leave, overhead)',0,'% of wage (0 = none added)',0,200],['reclaimPct','Share of admin time you could reclaim',25,'% (your estimate)',0,100],['cashPct','Share of recovered time turned into cash',0,'% (0 = none counted)',0,100],['reinvestPct','Share of recovered time reinvested',0,'% (not cash)',0,100]],calc:v=>{const r=calcs().adminCost(v);return{metric:r.capacityValue,format:'currency',label:'Estimated monthly admin labour value',math:`${v.adminHours} hrs/week × 52 ÷ 12 × ${money(r.loadedRate)}/hr loaded (${money(v.adminRate)} wage + ${number(v.oncostPct??0,1)}% on-costs)`,rows:r.rows.map(([l,x])=>[l,rowText(l,x)]),notes:[`Recovered capacity: ${number(r.recoveredHoursPerMonth,1)} hours/month, valued at ${money(r.recoveredValue)} at your loaded rate. Recovered time is not cash unless you enter a cash share.`,'Cash is counted only for the share you enter. Reinvested time is shown separately.','The reclaim, cash and reinvestment shares are your own estimates, not benchmarks.','52 ÷ 12 converts weeks to an average month of 4.33 weeks. It is not a calendar month.','Supercharged or Agent services are optional. Any benefit from them is a scenario you estimate, and none is included in this result.']}}},
hire:{title:'Should I hire?',fields:[['salary','Annual salary',65000,'A$/year'],['superPct','Super or retirement contribution',0,'% of salary (your figure)',0,100],['leavePct','Leave loading',0,'% of salary (your figure)',0,100],['oncost','Other on-costs (insurance, allowances, employer taxes)',18,'% of salary (your figure)',0,100],['paidHours','Paid hours each week',38,'hours/week'],['utilisationPct','Billable share of paid hours',80,'% (roster utilisation)',0,100],['margin','Average contribution per job',180,'A$/job'],['jobHours','Average job duration',2.5,'hours/job',0.1],['contractorRate','Contractor hourly rate (optional comparison)',0,'A$/hour']],calc:v=>{const r=calcs().hiringCost(v);return{metric:engine.calculators.hire({salary:v.salary,oncost:r.onCostPct,margin:v.margin}).metric,format:'currency',label:'Estimated monthly employment cost',math:`${money(v.salary)}/year × (1 + ${r.onCostPct}%) ÷ 12`,rows:r.rows.map(([l,x])=>[l,rowText(l,x)]),notes:[r.jobsNeeded===null?'Enter a positive contribution per job to estimate the job count.':`At ${money(v.margin)} contribution per job, about ${number(r.jobsNeeded)} additional jobs/month would cover this cost (${number(r.jobsExact,1)} exact).`,r.extraHours===null?'Job hours cannot be estimated until contribution per job is above zero.':`The ${number(r.jobsNeeded)} jobs need about ${number(r.extraHours,1)} job hours a month beyond the hours you already work. Compare that with your spare billable hours.`,r.contractorCheaper===null?'Enter a contractor hourly rate to compare employee and contractor cost at the same billable hours.':(r.contractorCheaper?'At the contractor rate you entered, a contractor costs less than the employee at these billable hours. Contract terms, insurance and tax are not modelled.':'At the contractor rate you entered, the employee cost is lower or equal at these billable hours. Contract terms, insurance and tax are not modelled.'),'Super, leave, insurance and employment rules are the figures you enter, not statutory facts. This is a cost threshold, not a recommendation to hire.']}}},
breakeven:{title:'Break-even',fields:[['fixed','Monthly fixed costs',12000,'A$/month'],['price','Average job revenue',450,'A$/job'],['variable','Average variable cost',180,'A$/job']],calc:v=>{const r=engine.calculators.breakeven({fixed:v.fixed,price:v.price,variable:v.variable});const contribution=v.price-v.variable;const possible=r.status==='ok';const jobs=possible?r.metric:null;return{metric:jobs,format:possible?'count':'unavailable',suffix:' jobs/month',label:possible?'Jobs per month to cover fixed costs':'No break-even job count at these assumptions',math:v.fixed===0?'No fixed costs entered (0 jobs required).':contribution<=0?'No finite solution: the contribution per job is zero or negative.':`${money(v.fixed)} ÷ (${money(v.price)} − ${money(v.variable)})`,notes:[v.fixed===0?'Fixed costs are zero; this is not a claim that the service is profitable.':contribution>0?`Contribution per job: ${money(contribution)}.`:'Average job revenue must exceed variable cost before a break-even job count can be calculated.','Tax, financing and owner drawings are not included unless you put them into fixed costs.']}}},
profit:{title:'Job profitability',fields:[['jobRevenue','Job revenue',650,'A$'],['taxMode','Is the revenue GST-inclusive?','exclusive','',undefined,undefined,[['exclusive','No, excludes GST'],['inclusive','Yes, includes GST']]],['taxRate','GST rate',10,'%',0,100],['labour','Labour cost',220,'A$'],['materials','Materials',110,'A$'],['travel','Travel/other direct cost',45,'A$'],['overhead','Overhead allocated to this job',0,'A$ (your allocation)'],['discountPct','Discount (agreed price reduction)',0,'% of revenue',0,100],['writeOffPct','Write-off (revenue not collected)',0,'% of revenue (your estimate)',0,100],['targetMarginPct','Target gross margin',30,'%',0,99.9]],calc:v=>{const r=calcs().jobProfitability(v);return{metric:r.contribution,format:'currency',label:'Contribution before overhead',math:`${money(r.netRevenue)} net revenue − ${money(r.directCost)} direct cost`,rows:r.rows.map(([l,x])=>[l,rowText(l,x)]),notes:[`Gross margin: ${r.grossMarginPct===null?'not available (no revenue)':r.grossMarginPct.toFixed(1)+'% of net revenue'}. Markup on direct cost: ${r.markupPct===null?'not available (no direct cost)':r.markupPct.toFixed(1)+'%'}. Margin and markup are different measures.`,r.priceForTarget===null?'Enter a target below 100% to see the price needed.':`Net revenue needed for the target gross margin (before overhead): ${money(r.priceForTarget)}. Gap to your entered net revenue: ${money(r.targetGap)}.`,r.priceForNetTarget===null?'':`Net revenue needed for the same target after overhead: ${money(r.priceForNetTarget)}.`,'Contribution is before overhead. Net profit is after the overhead you allocated. Tax is removed only when the revenue includes it. Discount and write-off both reduce net revenue once, and together cannot exceed 100%.','Revenue, discount, write-off, tax and costs are checked to reconcile before any result is shown.'].filter(Boolean)}}},
capacity:{title:'Capacity',fields:[['workers','Field workers',4,'people'],['hours','Productive hours per worker/week',30,'hours'],['duration','Average job duration',2.5,'hours/job',0.1],['currentJobs','Current jobs per month',150,'jobs'],['daysPerWeek','Available days each week',5,'days',0.5,7],['leaveDays','Leave days per worker each year',0,'days'],['nonbillPct','Non-billable share of hours',0,'% (admin, training, meetings)',0,100],['travelMin','Travel and time buffer per job',0,'minutes/job'],['cancelPct','Cancellations and no-shows',0,'% of booked jobs',0,100],['skillPct','Share of hours held by workers qualified for this job type',100,'% (100 = all workers)',0,100]],calc:v=>{const r=calcs().capacityPlanner(v);return{metric:r.bookableJobs,format:'count',suffix:' jobs/month',label:'Estimated bookable jobs/month',math:`${v.workers} workers × ${v.hours} hrs/week × 52 ÷ 12 ÷ ${v.duration} hrs/job, less your leave, non-billable time, buffers, cancellations and skill coverage`,rows:r.rows.map(([l,x])=>[l,rowText(l,x)]),notes:[r.spare>=0?`Approximate spare capacity against current volume: ${number(r.spare)} jobs/month.`:`Current volume is about ${number(Math.abs(r.spare))} jobs/month above this estimate.`,'Theoretical jobs ignore leave, buffers and cancellations. Bookable jobs are the figure to plan with, and are still an estimate.','This does not check travel routes, which worker holds which skill, or customer locations. Those need a scheduling tool, such as the optional ScheduledAt.Work app.','Daylight-saving changes are not modelled; hours are the working hours you enter.'].filter(Boolean)}}},
calls:{title:'Missed calls',fields:[['calls','Calls/enquiries per month',120,'calls'],['missed','Missed/unanswered rate',12,'% of enquiries',0,100],['convert','Likely conversion if answered',30,'% converted',0,100],['jobValue','Average job value',350,'A$'],['reachPct','Missed enquiries you can realistically follow up',0,'% of missed (0 = none assumed)',0,100],['recoveryPct','Recovery conversion: followed-up enquiries that book',30,'% (cannot exceed likely conversion)',0,100],['smsPct','Follow-ups sent by SMS',0,'% of follow-ups',0,100],['smsCost','Cost per SMS',0,'A$ per message'],['emailPct','Follow-ups sent by email',0,'% of follow-ups',0,100],['emailCost','Cost per email',0,'A$ per email'],['contribPct','Contribution margin on that work',100,'%',0,100]],calc:v=>{const r=calcs().missedEnquiry(v);return{metric:engine.calculators.calls({calls:v.calls,missed:v.missed,convert:v.convert,jobValue:v.jobValue}).metric,format:'currency',label:'Monthly revenue opportunity exposed (before follow-up)',math:`${v.calls} × ${v.missed}% missed × ${v.convert}% conversion × ${money(v.jobValue)}`,rows:r.rows.map(([l,x])=>[l,rowText(l,x)]),notes:['Opportunity is what is exposed before any follow-up. It is not revenue you will get back.','Recoverable value applies only the reach and recovery shares you enter. It is an assumption, not a guaranteed result, and no tool or receptionist can promise recovery of these enquiries.',`Messaging cost is weighted by the SMS and email shares: ${money(r.blendedCostPerFollowUp)} per follow-up at your entered costs. Phone callbacks are staff time and are not costed here.`,'Contribution and messaging costs are your own inputs.','Titan Front Desk and SuperchargedAt.Work are options to read about for follow-up. This result does not assume you will use either.'].filter(Boolean)}}},
leads:{title:'Lead conversion',fields:[['mode','How detailed should this be?','funnel','',undefined,undefined,[['funnel','Stage funnel: contacted, qualified, booked, completed'],['simple','Simple: one current rate and one scenario rate']]],['leads','Leads per month',100,'leads'],['value','Average customer/job value',450,'A$'],['contribPct','Contribution margin on that work',100,'%',0,100],['simpleBase','Simple mode: current lead-to-completed rate',21.6,'% of leads that complete',0,100,undefined,'simple'],['simpleAlt','Simple mode: scenario lead-to-completed rate',22.8,'% of leads that complete',0,100,undefined,'simple'],['base_contacted','Funnel: current leads contacted',90,'%',0,100,undefined,'funnel'],['base_qualified','Funnel: current contacted leads qualified',50,'%',0,100,undefined,'funnel'],['base_booked','Funnel: current qualified leads booked',60,'%',0,100,undefined,'funnel'],['base_completed','Funnel: current booked jobs completed',80,'%',0,100,undefined,'funnel'],['alt_contacted','Funnel: scenario leads contacted',92,'%',0,100,undefined,'funnel'],['alt_qualified','Funnel: scenario contacted leads qualified',50,'%',0,100,undefined,'funnel'],['alt_booked','Funnel: scenario qualified leads booked',62,'%',0,100,undefined,'funnel'],['alt_completed','Funnel: scenario booked jobs completed',80,'%',0,100,undefined,'funnel']],calc:v=>{const r=calcs().leadConversion(v);return{metric:r.revenueDelta,format:'currency',label:'Scenario revenue difference/month',math:`${v.leads} leads × (${(r.scenRate*100).toFixed(1)}% − ${(r.baseRate*100).toFixed(1)}%) × ${money(v.value)}`,rows:r.rows.map(([l,x])=>[l,rowText(l,x)]),notes:[r.direction==='reduction'?'The scenario is lower than the current response. The difference is shown as a reduction, not clamped to zero.':'This shows what the response changes would be worth, using your own rates.',v.mode==='simple'?'Simple mode uses one lead-to-completed rate for each response. Use the stage funnel to see where the change happens.':'Each stage is a share of the previous stage, from 0% to 100%. The contribution row shows what the revenue difference keeps after your contribution margin.','Revenue and contribution are assumptions from your own rates. No software, marketing or AI tool is assumed to cause the change, and nothing here is guaranteed.','The missed-enquiry calculator and SuperchargedAt.Work are related tools to read about. This result does not assume either.'].filter(Boolean)}}},
invoice:{title:'Invoice collection',fields:[['invoices','Invoices per month',80,'invoices'],['avg','Average invoice',520,'A$'],['age_d0_30','Unpaid from this month (0-30 days)',0,'% of monthly billing',0,100],['age_d31_60','Unpaid 31-60 days',10,'% of monthly billing',0,100],['age_d61_90','Unpaid 61-90 days',5,'% of monthly billing',0,100],['age_d90','Unpaid over 90 days',3,'% of monthly billing',0,100],['collect_d0_30','Expected collection within 13 weeks: 0-30 days',95,'% (your assumption)',0,100],['collect_d31_60','Expected collection within 13 weeks: 31-60 days',80,'% (your assumption)',0,100],['collect_d61_90','Expected collection within 13 weeks: 61-90 days',50,'% (your assumption)',0,100],['collect_d90','Expected collection within 13 weeks: 90+ days',20,'% (your assumption)',0,100],['terms','Payment terms (days from issue to due date)',30,'days',0,120],['within4','Share of expected cash received within 4 weeks',60,'% (your assumption)',0,100],['chase','Hours/month chasing payment',7,'hours']],calc:v=>{const r=calcs().invoiceCollection(v);const perK=r.hoursPerThousandBeyondTerms===null?'no balance beyond terms to measure against':`${r.hoursPerThousandBeyondTerms.toFixed(1)} hours per A$1,000 beyond terms`;return{metric:r.beyondTerms,format:'currency',label:`Value beyond ${r.terms}-day terms`,math:`${v.invoices} × ${money(v.avg)} billed = ${money(r.billed)}; ageing shares as entered; due ${r.terms} days after issue`,rows:r.rows.map(([l,x])=>[l,rowText(l,x)]),notes:[`Expected cash within 13 weeks on your assumptions: ${money(r.cashIn13Weeks)}, of which ${money(r.cashIn4Weeks)} within 4 weeks. Older balances are not guaranteed to be recoverable.`,`${v.chase} hours/month are spent on collection activity (${perK}).`,'Collecting sooner moves cash earlier. It does not create new revenue. The collection shares are starter assumptions: replace them with your own records.','For the cash view across the next 13 weeks, use the Thirteen-week cash flow forecast.']}}}
};
// Reads the local profile through the shared engine (#43): V3 first, then V2 once.
// Malformed or unknown parts are dropped by engine.migrateProfile, never partly applied.
function readProfile(){
let v3=null,v2=null;
try{v3=JSON.parse(localStorage.getItem(storageKey)||'null');}catch(_){v3=null;}
try{v2=JSON.parse(localStorage.getItem('titanBusinessToolProfileV2')||'null');}catch(_){v2=null;}
const saved=engine.migrateProfile({v3,v2,industryIds:data.industries.map(item=>item.id)}).profile;
const allowed=saved.verticals.slice();
const requested=industryById[query.get('industry')]?query.get('industry'):'';
const active=requested||(industryById[saved.activeVertical]?saved.activeVertical:'cleaning');
if(!allowed.includes(active))allowed.push(active);
if(!allowed.length)allowed.push('cleaning');
return{verticals:allowed,activeVertical:active,businessName:saved.businessName,serviceName:saved.serviceName,assumptions:saved.assumptions};
}
const profile=readProfile();
// Writes the V3 profile and only then removes the V2 copy, so a failed write never loses data.
// Returns false when the browser refuses the write (disabled or full storage), so the caller can say so (#107).
function saveProfile(){
try{
localStorage.setItem(storageKey,JSON.stringify({schema:engine.PROFILE_VERSION,...profile}));
localStorage.removeItem(engine.LEGACY_PROFILE_KEY);
return true;
}catch(_){return false;}
}
function currentIndustry(){return industryById[profile.activeVertical]||industryById.cleaning;}
function getAssumptions(){return profile.assumptions[profile.activeVertical]||(profile.assumptions[profile.activeVertical]={});}
function defaultFor(key,fallback){const stored=Number(getAssumptions()[key]);if(Number.isFinite(stored))return stored;const tuned=Number(currentIndustry().defaults[key]);return Number.isFinite(tuned)?tuned:fallback;}
function createLink(text,href,className='text-link'){const a=document.createElement('a');a.className=className;a.href=href;a.textContent=text;return a;}
function toolContextUrl(route){
const url=new URL(pageUrl(route));
// Never place business information, numeric assumptions or quote details in the URL.
url.searchParams.delete('tool_context');
return url.href;
}
function safeHandoffSummary(context){
// Only copy an explicitly requested, bounded calculation summary. Never include
// the business, service, customer, staff or free-text quote fields.
const field=(name)=>escContext(context?.[name]).replace(/[\r\n\t]+/g,' ');
return [
'Titan Zero business tool result',
'Tool: '+field('tool'),
'Industry: '+field('vertical'),
'Result: '+field('result'),
'Calculation: '+field('calculation')
].join('\n');
}
function addPrintButton(parent,label='Print / save PDF'){const b=document.createElement('button');b.type='button';b.className='button button-secondary';b.textContent=label;b.addEventListener('click',()=>window.print());parent.append(b);}
function addHandoffButtons(parent,context){
const row=document.createElement('div');row.className='button-row result-actions';
row.append(createLink('Explore Titan pricing',toolContextUrl('pricing/')));
row.append(createLink('Open support (no data sent)',toolContextUrl('support/'),'button button-secondary'));
const copy=document.createElement('button');copy.type='button';copy.className='button button-secondary';
copy.textContent='Copy calculation for manual sharing';
const status=textNode('p','These links do not send your business information or calculation. Copying is optional; review numerical figures before sharing them.','fine-print handoff-note');
status.setAttribute('role','status');
let fallback;
copy.addEventListener('click',async()=>{
const summary=safeHandoffSummary(context);
try{
if(!navigator.clipboard||typeof navigator.clipboard.writeText!=='function')throw new Error('Clipboard unavailable');
await navigator.clipboard.writeText(summary);
status.textContent='Calculation copied locally. Review before pasting it into any external form.';
}catch(_){
if(!fallback){
fallback=document.createElement('textarea');fallback.readOnly=true;fallback.rows=5;
fallback.setAttribute('aria-label','Calculation summary for manual copying');
parent.append(fallback);
}
fallback.value=summary;fallback.focus();fallback.select();
status.textContent='Automatic copying is unavailable. Select and copy the summary below manually.';
}
});
row.append(copy);
addPrintButton(row);
parent.append(row,status);
}
function textNode(tag,text,className){const el=document.createElement(tag);if(className)el.className=className;el.textContent=text;return el;}
function setupContext(root){
const business=root.querySelector('[data-business-name]');
const service=root.querySelector('[data-service-name]');
const select=root.querySelector('[data-vertical-select]');
const addSelect=root.querySelector('[data-new-vertical]');
const summary=root.querySelector('[data-vertical-summary]');
const copy=root.querySelector('[data-tool-context-copy]');
if(business)business.value=profile.businessName;
if(service)service.value=profile.serviceName;
function options(selectEl,ids,selected){
if(!selectEl)return;
selectEl.replaceChildren();
for(const id of ids){const item=industryById[id];if(!item)continue;const option=document.createElement('option');option.value=id;option.textContent=item.name;option.selected=id===selected;selectEl.append(option);}
}
function drawSummary(){
const industry=currentIndustry();
if(select)options(select,profile.verticals,profile.activeVertical);
if(addSelect){const choices=verticalOptions.filter(item=>!profile.verticals.includes(item.id)).map(item=>item.id);options(addSelect,choices,choices[0]);const button=root.querySelector('[data-add-vertical]');if(button)button.disabled=!choices.length;}
if(summary){summary.replaceChildren();const strong=textNode('strong',`${profile.businessName||'This business'} · ${industry.name}`);const span=textNode('span',industry.summary);summary.append(strong,span);}
if(copy)copy.textContent=`Starter assumptions are tuned for ${industry.name}. They are examples; replace them with your own records.`;
}
if(select)select.addEventListener('change',()=>{if(!industryById[select.value])return;profile.activeVertical=select.value;saveProfile();drawSummary();});
if(business)business.addEventListener('change',()=>{profile.businessName=escContext(business.value);saveProfile();drawSummary();});
if(service)service.addEventListener('change',()=>{profile.serviceName=escContext(service.value);saveProfile();});
const addButton=root.querySelector('[data-add-vertical]');
if(addButton&&addSelect)addButton.addEventListener('click',()=>{const id=addSelect.value;if(!industryById[id]||profile.verticals.includes(id))return;profile.verticals.push(id);profile.activeVertical=id;saveProfile();drawSummary();root.dispatchEvent(new CustomEvent('toolverticalchange'));});
const clear=root.querySelector('[data-clear-profile]');
if(clear)clear.addEventListener('click',()=>{try{localStorage.removeItem(storageKey);localStorage.removeItem('titanBusinessToolProfileV2');localStorage.removeItem(engine.formulas.QUOTE_STORE_KEY);}catch(_){}profile.verticals=['cleaning'];profile.activeVertical=industryById[query.get('industry')]?query.get('industry'):'cleaning';if(profile.activeVertical!=='cleaning')profile.verticals.push(profile.activeVertical);profile.businessName='';profile.serviceName='';profile.assumptions={};drawSummary();root.dispatchEvent(new CustomEvent('toolverticalchange'));});
drawSummary();
}
// Keyboard focus (#108): a refused input moves focus to its error message; a result moves focus to the result.
function showCalculatorError(resultElement,definition,message){
resultElement.replaceChildren(textNode('p',definition?definition.title:'Calculator','eyebrow'),textNode('h2','Check your numbers'),textNode('p',message,'form-error'));
resultElement.setAttribute('role','alert');
const error=resultElement.querySelector('.form-error');
if(error){error.tabIndex=-1;error.focus();}
}
function showCalculatorResult(resultElement,definition,outcome,values){
resultElement.removeAttribute('role');
resultElement.replaceChildren();
resultElement.append(textNode('p',definition.title,'eyebrow'));
const displayed=outcome.format==='unavailable'?'Not achievable':outcome.format==='count'?number(outcome.metric)+outcome.suffix:money(outcome.metric);
const metric=textNode('div',displayed,'metric');
resultElement.append(metric,textNode('h2',outcome.label));
const math=textNode('div','Calculation: '+outcome.math,'math');resultElement.append(math);
if(outcome.rows&&outcome.rows.length){const dl=document.createElement('dl');dl.className='quote-totals';for(const[label,value]of outcome.rows)dl.append(textNode('dt',label),textNode('dd',String(value)));resultElement.append(dl);}
const notes=document.createElement('ul');
for(const note of outcome.notes||[])notes.append(textNode('li',note));
notes.append(textNode('li',`Industry context: ${currentIndustry().name}. ${currentIndustry().summary}`));
resultElement.append(notes);
const context={tool:definition.title,vertical:currentIndustry().name,business:profile.businessName,service:profile.serviceName,result:displayed+' — '+outcome.label,calculation:outcome.math};
addHandoffButtons(resultElement,context);
resultElement.tabIndex=-1;resultElement.focus();
}
function initializeCalculator(root){
setupContext(root);
let active=root.dataset.initialTool||'';
const fieldsElement=root.querySelector('[data-tool-fields]');
const form=root.querySelector('[data-tool-form]');
const result=root.querySelector('[data-tool-result]');
if(!fieldsElement||!form||!result)return;
const tabs=[...root.querySelectorAll('[data-tool-tab]')];
if(!active)active=tabs[0]?.dataset.toolTab||'admin';
function draw(){
const definition=defaults[active];if(!definition)return;
fieldsElement.replaceChildren();
for(const[key,label,fallback,unit,min=0,max,options,only]of definition.fields){
const wrap=document.createElement('div');wrap.className='tool-field';
// Fields for one mode only (#29): shown and submitted only when that mode is chosen.
if(only){wrap.dataset.only=only;}
const lab=document.createElement('label');lab.htmlFor='tool-'+key;lab.textContent=label;
let input;
if(options){input=document.createElement('select');for(const[value,text]of options){const o=document.createElement('option');o.value=value;o.textContent=text;o.selected=value===String(defaultFor(key,fallback));input.append(o);}}
else{input=document.createElement('input');input.type='number';input.required=true;input.min=String(min);if(max!==undefined)input.max=String(max);input.step='any';input.inputMode='decimal';input.value=String(defaultFor(key,fallback));}
input.id='tool-'+key;input.name=key;
const unitNote=textNode('small',unit);
wrap.append(lab,input,unitNote);fieldsElement.append(wrap);
}
syncModeFields();
result.replaceChildren(textNode('p',definition.title,'eyebrow'),textNode('h2','Enter your numbers'),textNode('p','We will show the calculation, the assumptions used and a clear next step.'));
tabs.forEach(tab=>tab.setAttribute('aria-selected',String(tab.dataset.toolTab===active)));
}
form.addEventListener('submit',(event)=>{
event.preventDefault();if(!form.reportValidity())return;
const definition=defaults[active];
const values={};
for(const[key,value]of new FormData(form).entries()){const field=definition.fields.find(item=>item[0]===key);values[key]=field&&field[6]?String(value):Number(value);}
for(const[key,value]of Object.entries(values)){if(typeof value==='number'&&(!Number.isFinite(value)||value<0)){showCalculatorError(result,definition,'Enter zero or a positive number for '+key+'.');return;}}
// Shared rules (#42): blanks, NaN, infinity, out-of-range values and over-precise money are refused
// before any result. Only tools whose form fields match the engine rules are checked here.
// Validate the raw form strings: Number('') is 0, so blanks must be refused before conversion (#105).
const rules=engine.RULES[active];
if(rules&&Object.keys(rules).every(key=>key in values)){
const checked=engine.validate(active,Object.fromEntries(new FormData(form).entries()));
if(!checked.ok){showCalculatorError(result,definition,checked.errors.map(item=>item.message).join(' '));return;}
}
let outcome;
try{outcome=definition.calc(values);}
catch(error){showCalculatorError(result,definition,error.message);return;}
for(const[key,value]of Object.entries(values))if(typeof value==='number')getAssumptions()[key]=value;
const saved=saveProfile();
showCalculatorResult(result,definition,outcome,values);
// A storage failure is shown in the result, not hidden (#107).
if(!saved)result.append(textNode('p','This browser would not save your assumptions, so they will not be here on your next visit.','form-error'));
});
tabs.forEach(tab=>tab.addEventListener('click',()=>{if(!defaults[tab.dataset.toolTab])return;active=tab.dataset.toolTab;draw();}));
// Shows only the fields for the chosen mode and disables the hidden ones, so they are neither required nor submitted (#29).
function syncModeFields(){
const modeInput=fieldsElement.querySelector('[name="mode"]');
const mode=modeInput?modeInput.value:'';
for(const wrap of fieldsElement.querySelectorAll('[data-only]')){
const show=wrap.dataset.only===mode;
wrap.style.display=show?'':'none';
for(const control of wrap.querySelectorAll('input,select'))control.disabled=!show;
}
}
fieldsElement.addEventListener('change',syncModeFields);
root.addEventListener('toolverticalchange',draw);
draw();
addAssumptionsTools(root);
offerProfitHandoff(root);
}
// Portable assumptions file (#106). Numbers for the active service type only. Import is all-or-nothing:
// the engine refuses the whole file on any problem, and the values are applied only after the user confirms.
function addAssumptionsTools(root){
const ids=verticalOptions.map(item=>item.id);
const panel=document.createElement('section');panel.className='assumptions-tools';panel.setAttribute('aria-label','Assumptions file');
const heading=textNode('h3','Save or load your assumptions');
const note=textNode('p','The file holds numbers only for the service type shown above. It has no business name, customer, staff or quote text.','fine-print');
const exportButton=document.createElement('button');exportButton.type='button';exportButton.className='button button-secondary';exportButton.textContent='Download assumptions file';
const label=document.createElement('label');label.htmlFor='assumptions-file';label.textContent='Load an assumptions file';
const input=document.createElement('input');input.type='file';input.id='assumptions-file';input.accept='.json,application/json';
const status=textNode('p','','fine-print');status.setAttribute('role','status');
const preview=document.createElement('div');
exportButton.addEventListener('click',()=>{
try{
const doc=engine.exportAssumptions(profile,profile.activeVertical,ids);
const blob=new Blob([JSON.stringify(doc,null,2)],{type:'application/json'});
const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='titan-tool-assumptions-'+profile.activeVertical+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
status.textContent='Downloaded '+Object.keys(doc.assumptions).length+' saved values for '+currentIndustry().name+'.';
}catch(error){status.textContent=error.message;}
});
input.addEventListener('change',()=>{
preview.replaceChildren();
const file=input.files&&input.files[0];
if(!file)return;
if(file.size>engine.PORTABLE_MAX_CHARS){status.textContent='The file is too large to import. Nothing was imported.';input.value='';return;}
const reader=new FileReader();
reader.addEventListener('load',()=>{
const checked=engine.validateImport(String(reader.result||''),ids);
input.value='';
if(!checked.ok){status.textContent='Not imported. '+checked.errors.map(item=>item.message).join(' ');return;}
if(checked.value.vertical!==profile.activeVertical){status.textContent='This file is for '+(industryById[checked.value.vertical]?.name||'another service type')+'. Switch to that service type first. Nothing was imported.';return;}
const pairs=Object.entries(checked.value.assumptions).map(([key,value])=>key+': '+value);
const list=textNode('p','Values ready to import ('+pairs.length+'): '+pairs.join('; '),'fine-print');
const apply=document.createElement('button');apply.type='button';apply.className='button button-primary';apply.textContent='Import these values';
apply.addEventListener('click',()=>{
const next=engine.applyImport(profile,checked);
profile.assumptions=next.profile.assumptions;saveProfile();
preview.replaceChildren();status.textContent='Imported '+next.applied.length+' values. Submit the calculator to see new results.';
root.dispatchEvent(new CustomEvent('toolverticalchange'));
});
preview.append(list,apply);
});
reader.addEventListener('error',()=>{status.textContent='The file could not be read. Nothing was imported.';});
reader.readAsText(file);
});
panel.append(heading,note,exportButton,label,input,status,preview);
root.append(panel);
}
document.querySelectorAll('[data-tools-app]').forEach(initializeCalculator);
function dateText(iso){return new Date(iso+'T00:00:00Z').toLocaleDateString('en-AU',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'});}
const QUOTE_TAX_TEXT={none:'No GST applied on this quote.',exclusive:'Prices exclude GST. GST is added on top.',inclusive:'Prices include GST. GST is shown inside the total.'};
// Offers the figures saved by Service pricing, but only when the user clicks. The saved figures are
// read through the calc parser, so a damaged or hand-edited value is ignored and nothing is shown.
function offerPricingHandoff(box,calc,apply){
if(!box||!calc||typeof calc.parsePricingHandoff!=='function')return;
let figures=null;
try{figures=calc.parsePricingHandoff(localStorage.getItem(calc.PRICING_HANDOFF_KEY));}catch(_){figures=null;}
if(!figures)return;
const label=figures.role?'for '+figures.role:'from your last calculation';
const note=textNode('p',`Service pricing figures ${label} are saved on this device. They exclude GST. Nothing is uploaded.`,'fine-print');
note.setAttribute('role','status');
const button=document.createElement('button');button.type='button';button.className='button button-secondary';button.textContent='Use the Service pricing figures';
button.addEventListener('click',()=>apply(figures));
box.replaceChildren(note,button);box.hidden=false;
}
// Job profitability (#26): offers the Service pricing figures and fills the inputs only after a click.
// Revenue is the target price (ex GST). Labour is hours x rate; travel includes equipment. Contingency is
// not applied, because this calculator has no contingency line. Discount and write-off stay as entered.
function offerProfitHandoff(root){
const box=root.querySelector('[data-pricing-handoff]');
if(!box||!root.querySelector('#tool-jobRevenue'))return;
offerPricingHandoff(box,calcs(),(figures)=>{
const set=(key,value)=>{const el=root.querySelector('#tool-'+key);if(el)el.value=String(value);};
set('taxMode','exclusive');
if(typeof figures.targetPrice==='number')set('jobRevenue',figures.targetPrice);
set('labour',Math.round(figures.labourHours*figures.labourRate*100)/100);
set('materials',figures.materials);
set('travel',Math.round((figures.travel+figures.equipment)*100)/100);
set('overhead',figures.overhead);
let status=box.querySelector('[data-handoff-status]');
if(!status){status=textNode('p','','fine-print');status.dataset.handoffStatus='1';status.setAttribute('role','status');box.append(status);}
status.textContent='Figures filled in. Contingency is not applied here. Check them, then press Calculate.';
});
}
function initializeQuoteBuilder(root){
const calc=engine.formulas;
const form=root.querySelector('[data-quote-form]'),lines=root.querySelector('[data-quote-lines]'),output=root.querySelector('[data-quote-result]');
if(!form||!lines||!output||!calc)return;
const status=root.querySelector('[data-quote-status]'),savedSelect=root.querySelector('[data-quote-saved]');
const f=(name)=>form.elements.namedItem(name);
f('business').value=profile.businessName;f('service').value=profile.serviceName;
offerPricingHandoff(root.querySelector('[data-pricing-handoff]'),calc,(figures)=>{
f('service').value=figures.role||f('service').value;
f('taxMode').value='exclusive';
lines.replaceChildren();addLine('Service from pricing tool',1,figures.targetPrice);
render();say('Figures from Service pricing added. Prices exclude GST; check the scope and quantities before you save.');
});
let version=0;let savedAt=null;
const say=(text)=>{if(status)status.textContent=text;};
function readStore(){try{const s=JSON.parse(localStorage.getItem(calc.QUOTE_STORE_KEY)||'{}');return{quotes:Array.isArray(s.quotes)?s.quotes:[]};}catch(_){return{quotes:[]};}}
function writeStore(store){try{localStorage.setItem(calc.QUOTE_STORE_KEY,JSON.stringify(store));return true;}catch(_){return false;}}
function lineRows(){return[...lines.querySelectorAll('.quote-line-row')];}
function collect(){return{business:f('business').value.trim(),customer:f('customer').value.trim(),service:f('service').value.trim(),reference:f('reference').value.trim(),validDays:f('validDays').value,scope:f('scope').value.trim(),exclusions:f('exclusions').value.trim(),terms:f('terms').value.trim(),taxMode:f('taxMode').value,taxRate:f('taxRate').value,discountPct:f('discount').value,consentToStoreCustomer:f('consent').checked,lines:lineRows().map(row=>({description:row.querySelector('[name=line-description]').value.trim(),quantity:row.querySelector('[name=line-quantity]').value,unitPrice:row.querySelector('[name=line-price]').value}))};}
function totalsFor(q){return calc.quoteTotals({lines:q.lines,discountPct:q.discountPct,taxMode:q.taxMode,taxRate:q.taxRate});}
function addLine(description='',quantity=1,price=0){
const row=document.createElement('div');row.className='quote-line-row';
const desc=document.createElement('label');desc.textContent='Work item';const name=document.createElement('input');name.name='line-description';name.maxLength=160;name.value=description;name.placeholder='Service or item';desc.append(name);
const qtyLabel=document.createElement('label');qtyLabel.textContent='Quantity';const qty=document.createElement('input');qty.name='line-quantity';qty.type='number';qty.min='0';qty.step='any';qty.value=String(quantity);qty.inputMode='decimal';qtyLabel.append(qty);
const priceLabel=document.createElement('label');priceLabel.textContent='Unit price (A$)';const unit=document.createElement('input');unit.name='line-price';unit.type='number';unit.min='0';unit.step='0.01';unit.value=String(price);unit.inputMode='decimal';priceLabel.append(unit);
const remove=document.createElement('button');remove.type='button';remove.className='button button-secondary';remove.textContent='Remove';remove.setAttribute('aria-label','Remove quote line');remove.addEventListener('click',()=>{if(lines.children.length>1)row.remove();render();});
row.append(desc,qtyLabel,priceLabel,remove);lines.append(row);
}
function refreshSaved(selectRef){
if(!savedSelect)return;
const store=readStore();savedSelect.replaceChildren();
if(!store.quotes.length){const o=document.createElement('option');o.value='';o.textContent='None saved on this device';savedSelect.append(o);refreshVersions();return;}
for(const item of store.quotes){const o=document.createElement('option');o.value=item.reference;o.textContent=`${item.reference} (version ${item.version})`;o.selected=item.reference===selectRef;savedSelect.append(o);}
refreshVersions();
}
// Lists the stored earlier versions of the selected saved quote, for reopening.
function refreshVersions(){
const pick=root.querySelector('[data-quote-version]');if(!pick)return;
const ref=savedSelect?savedSelect.value:'';const rec=readStore().quotes.find(item=>item.reference===ref);
pick.replaceChildren();const latest=document.createElement('option');latest.value='';latest.textContent='Latest version';pick.append(latest);
for(const h of(rec&&Array.isArray(rec.history)?rec.history:[])){const o=document.createElement('option');o.value=String(h.version);o.textContent=`Version ${h.version} (saved ${new Date(h.savedAt).toLocaleDateString('en-AU')})`;pick.append(o);}
}
function render(){
const q=collect();
let t;
try{t=totalsFor(q);}
catch(error){output.replaceChildren(textNode('p','Quote preview','eyebrow'),textNode('p',error.message,'form-error'));return;}
const money2=(cents)=>money(cents/100);
output.replaceChildren(textNode('p','Quote preview','eyebrow'),textNode('h2',q.service||'Service quote'));
if(q.business)output.append(textNode('p',q.business));
if(q.customer)output.append(textNode('p','Prepared for: '+q.customer));
const ref=q.reference||'Not yet saved';
output.append(textNode('p',`Reference: ${ref}${version?' (version '+version+')':''}`));
const days=Number(q.validDays)||0;
const issuedOn=savedAt||new Date().toISOString();
let until=null;try{until=calc.quoteValidUntil(issuedOn,days);}catch(error){output.append(textNode('p',error.message,'form-error'));}
output.append(textNode('p',until?`Valid for ${days} days from ${dateText(issuedOn.slice(0,10))}, until ${dateText(until)}.`:'No validity period entered.'));
const table=document.createElement('table');table.className='quote-preview-table';const body=document.createElement('tbody');
t.lines.filter(line=>line.description||line.unitCents>0).forEach(line=>{const tr=document.createElement('tr');tr.append(textNode('td',line.description||'Service item'),textNode('td',`${number(line.quantity,2)} × ${money2(line.unitCents)}`),textNode('td',money2(line.lineCents)));body.append(tr);});
table.append(body);output.append(table);
const totals=document.createElement('dl');totals.className='quote-totals';
totals.append(textNode('dt','Subtotal'),textNode('dd',money2(t.subtotalCents)));
totals.append(textNode('dt','Discount'),textNode('dd',t.discountCents?'− '+money2(t.discountCents):money2(0)));
if(t.taxMode!=='none'){totals.append(textNode('dt','Before GST'),textNode('dd',money2(t.exTaxCents)));totals.append(textNode('dt','GST'),textNode('dd',money2(t.gstCents)));}
totals.append(textNode('dt','Total'),textNode('dd',money2(t.totalCents)));
output.append(totals);
output.append(textNode('p',QUOTE_TAX_TEXT[t.taxMode],'fine-print'));
for(const[label,value]of[['Scope of work',q.scope],['Exclusions',q.exclusions],['Terms and payment',q.terms]]){if(value){output.append(textNode('h3',label));output.append(textNode('p',value));}}
output.append(textNode('p','Check the scope, exclusions, validity and tax details before sending.','fine-print'));
const context={tool:'Quote builder',vertical:currentIndustry().name,business:q.business,service:q.service,result:'Quote total '+money2(t.totalCents),calculation:`Subtotal ${money2(t.subtotalCents)}; discount ${money2(t.discountCents)}; GST ${money2(t.gstCents)}.`};
addHandoffButtons(output,context);
}
function resetForm(){
for(const name of['business','customer','service','reference','scope','exclusions','terms'])f(name).value='';
f('business').value=profile.businessName;f('service').value=profile.serviceName;
f('validDays').value='14';f('taxMode').value='exclusive';f('taxRate').value='10';f('discount').value='0';f('consent').checked=false;
lines.replaceChildren();addLine('Service',1,0);addLine();version=0;savedAt=null;
}
function currentRecord(){const q=collect();return q;}
function saveDraft(){
const q=currentRecord();
try{
const store=readStore();
const r=calc.saveQuoteRecord(store,{...q,consentToStoreCustomer:q.consentToStoreCustomer},new Date().toISOString());
if(!writeStore({quotes:r.quotes})){say('This browser would not keep the quote. Use Download quote file to keep a copy.');return;}
version=r.saved.version;savedAt=r.saved.savedAt;f('reference').value=r.saved.reference;
say(`Saved ${r.saved.reference} as version ${r.saved.version} on this device.`+(q.customer&&!q.consentToStoreCustomer?' The customer name was not saved because consent was not ticked.':''));
refreshSaved(r.saved.reference);render();
}catch(error){say(error.message);}
}
function openSaved(){
const ref=savedSelect?savedSelect.value:'';
const rec=readStore().quotes.find(item=>item.reference===ref);
if(!rec){say('Choose a saved quote to open.');return;}
const pick=root.querySelector('[data-quote-version]');
const chosen=pick&&pick.value!==''?Number(pick.value):undefined;
let r;try{r=calc.restoreQuote(rec,chosen);}catch(error){say(error.message);return;}
f('business').value=r.business;f('customer').value=r.customer;f('service').value=r.service;f('reference').value=r.reference;
f('validDays').value=String(r.validDays);f('scope').value=r.scope;f('exclusions').value=r.exclusions;f('terms').value=r.terms;
f('taxMode').value=r.taxMode;f('taxRate').value=String(r.taxRate);f('discount').value=String(r.discountPct);f('consent').checked=r.consentToStoreCustomer;
lines.replaceChildren();(r.lines.length?r.lines:[{description:'',quantity:1,unitPrice:0}]).forEach(line=>addLine(line.description,line.quantity,line.unitPrice));
version=rec.version;savedAt=r.version===rec.version?rec.savedAt:((rec.history||[]).find(h=>h.version===r.version)||{}).savedAt||null;
const older=r.version===rec.version?'':' This is an earlier version; saving creates a new latest version.';
say(`Opened ${rec.reference} version ${r.version}.${older} Save again to create a new version.`);render();
}
function deleteSaved(){
const ref=savedSelect?savedSelect.value:'';
if(!ref)return;
if(!window.confirm('Delete the saved quote '+ref+' from this device? This cannot be undone.'))return;
const store={quotes:readStore().quotes.filter(item=>item.reference!==ref)};
writeStore(store);refreshSaved('');say('Deleted '+ref+' from this device.');
}
function downloadQuote(){
const q=currentRecord();let t,validUntil;
try{t=totalsFor(q);validUntil=calc.quoteValidUntil(savedAt||new Date().toISOString(),q.validDays);}catch(error){say(error.message);return;}
const doc={format:'titan-zero-quote',formatVersion:1,exportedAt:new Date().toISOString(),version:version||null,issuedAt:savedAt,validUntil,quote:{...q,consentToStoreCustomer:undefined,totals:{subtotal:t.subtotalCents/100,discount:t.discountCents/100,beforeGst:t.exTaxCents/100,gst:t.gstCents/100,total:t.totalCents/100}}};
delete doc.quote.consentToStoreCustomer;
const blob=new Blob([JSON.stringify(doc,null,2)],{type:'application/json'});
const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='quote-'+(calc.quoteRecordId(q.reference)||'draft')+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
say('Quote file downloaded to this device. It includes any customer name you entered.');
}
root.querySelector('[data-add-quote-line]').addEventListener('click',()=>{addLine();render();});
const newButton=root.querySelector('[data-quote-new]');if(newButton)newButton.addEventListener('click',()=>{if(window.confirm('Start a new quote? Unsaved changes will be cleared.')){resetForm();say('Started a new quote.');render();}});
const saveButton=root.querySelector('[data-quote-save]');if(saveButton)saveButton.addEventListener('click',saveDraft);
const downloadButton=root.querySelector('[data-quote-download]');if(downloadButton)downloadButton.addEventListener('click',downloadQuote);
const openButton=root.querySelector('[data-quote-open]');if(openButton)openButton.addEventListener('click',openSaved);
if(savedSelect)savedSelect.addEventListener('change',refreshVersions);
const deleteButton=root.querySelector('[data-quote-delete]');if(deleteButton)deleteButton.addEventListener('click',deleteSaved);
const printButton=root.querySelector('[data-quote-print]');if(printButton)printButton.addEventListener('click',()=>window.print());
form.addEventListener('input',render);form.addEventListener('change',render);
form.addEventListener('submit',event=>{event.preventDefault();render();});
const incoming=takeQuoteTransfer();
if(incoming){lines.replaceChildren();addLine(incoming.description||'Service',1,incoming.unitPrice);addLine();say('A price from the job-cost sheet was added as a line. Check it before saving.');}
else{addLine('Service',1,0);addLine();}
render();refreshSaved('');
// Reads and clears the one-off line sent from the job-cost sheet. Stored on this device only.
function takeQuoteTransfer(){try{const raw=localStorage.getItem(calc.QUOTE_TRANSFER_KEY);if(raw===null)return null;localStorage.removeItem(calc.QUOTE_TRANSFER_KEY);return calc.readQuoteTransfer(raw);}catch(_){return null;}}
}
function initializeJobCost(root){
const calc=engine.formulas;
const form=root.querySelector('[data-job-cost-form]'),output=root.querySelector('[data-job-cost-result]'),roles=root.querySelector('[data-job-roles]');
if(!form||!output||!roles||!calc)return;
const f=(name)=>form.elements.namedItem(name);
f('business').value=profile.businessName;f('service').value=profile.serviceName;
offerPricingHandoff(root.querySelector('[data-pricing-handoff]'),calc,(figures)=>{
roles.replaceChildren();addRole(figures.role||'Labour',figures.labourHours,figures.labourRate);
f('materials').value=figures.materials;f('materialMarkupPct').value=0;f('equipment').value=figures.equipment;
f('km').value=0;f('kmRate').value=0;f('travel').value=figures.travel;f('overhead').value=figures.overhead;
f('contingencyPct').value=figures.contingencyPct;f('target').value=figures.targetMarginPct;f('price').value=figures.targetPrice;
});
function addRole(name='',hours=1,rate=0){
const row=document.createElement('div');row.className='quote-line-row';
const wrap=(label,input)=>{const l=document.createElement('label');l.textContent=label;l.append(input);return l;};
const n=document.createElement('input');n.name='role-name';n.maxLength=80;n.value=name;n.placeholder='Role, e.g. technician';
const h=document.createElement('input');h.name='role-hours';h.type='number';h.min='0';h.step='0.1';h.inputMode='decimal';h.value=String(hours);
const r=document.createElement('input');r.name='role-rate';r.type='number';r.min='0';r.step='0.01';r.inputMode='decimal';r.value=String(rate);
const remove=document.createElement('button');remove.type='button';remove.className='button button-secondary';remove.textContent='Remove';remove.setAttribute('aria-label','Remove labour line');
remove.addEventListener('click',()=>{if(roles.querySelectorAll('.quote-line-row').length>1)row.remove();});
row.append(wrap('Role',n),wrap('Hours',h),wrap('Hourly cost (A$)',r),remove);roles.append(row);
}
root.querySelector('[data-add-role]').addEventListener('click',()=>addRole());
addRole('Technician',2,45);
form.addEventListener('submit',(event)=>{
event.preventDefault();if(!form.reportValidity())return;
const labour=[...roles.querySelectorAll('.quote-line-row')].map(row=>({hours:row.querySelector('[name=role-hours]').value,rate:row.querySelector('[name=role-rate]').value}));
const input={roles:labour,materials:f('materials').value,materialMarkupPct:f('materialMarkupPct').value,equipment:f('equipment').value,km:f('km').value,kmRate:f('kmRate').value,travel:f('travel').value,contingencyPct:f('contingencyPct').value,overhead:f('overhead').value,price:f('price').value,targetMarginPct:f('target').value};
let c;
try{c=calc.jobCostSheet(input);}
catch(error){output.replaceChildren(textNode('p','Job-cost result','eyebrow'),textNode('p',error.message,'form-error'));output.setAttribute('tabindex','-1');output.focus();return;}
const businessName=f('business').value.trim();
output.replaceChildren(textNode('p','Job-cost result','eyebrow'),textNode('h2',f('service').value.trim()||'Estimated job economics'));
if(businessName)output.append(textNode('p',businessName));
const list=document.createElement('dl');list.className='quote-totals';
const rows=[...c.rows,['Target price (ex GST)',c.targetPrice===null?'Enter a target below 100%':money(c.targetPrice)],['Margin at entered price',c.marginPct===null?'No price entered':c.marginPct.toFixed(1)+'%']];
for(const[label,value]of rows){list.append(textNode('dt',label),textNode('dd',typeof value==='number'?money(value):String(value)));}
output.append(list);
output.append(textNode('p','Costs are kept separate from the price. GST is not included in any cost or in the price shown here. The target price is an arithmetic scenario, not a recommendation.','fine-print'));
const send=document.createElement('button');send.type='button';send.className='button button-secondary';send.textContent='Send price to the quote builder';
const sendStatus=textNode('p','Sends the customer price ex GST as one quote line. It stays on this device and is not put in a link.','fine-print');sendStatus.setAttribute('role','status');
send.addEventListener('click',()=>{try{// Fixed line text: the service name is job text and is never sent (#106).
const rec=calc.quoteTransferRecord(c,'Service from job-cost sheet',new Date().toISOString());localStorage.setItem(calc.QUOTE_TRANSFER_KEY,JSON.stringify(rec));sendStatus.textContent='Price sent. Open the quote builder on this device to review the line.';}catch(error){sendStatus.textContent=error.message;}});
output.append(send,sendStatus);
const context={tool:'Job-cost sheet',vertical:currentIndustry().name,business:businessName,service:f('service').value.trim(),result:'Total cost '+money(c.totalCost)+'; price (ex GST) '+money(c.price)+'; margin '+(c.marginPct===null?'n/a':c.marginPct.toFixed(1)+'%')+'.',calculation:`Labour ${money(c.labour)}; direct costs ${money(c.directCost)}; contingency ${money(c.contingency)}; overhead ${money(c.overhead)}.`};
addHandoffButtons(output,context);
output.setAttribute('tabindex','-1');
output.focus();
});
}
const TEMPLATE_REVISION=1;
const CHECKLIST_DRAFT_KEY='titanChecklistDraftV1';
const taskLists=data.checklists||{};
function initializeChecklist(root){
const calc=engine.formulas;
const select=root.querySelector('[data-checklist-vertical]'),list=root.querySelector('[data-generated-checklist]');
if(!select||!list||!calc)return;
const title=root.querySelector('[data-checklist-title]'),job=root.querySelector('[data-checklist-job]'),jobLabel=root.querySelector('[data-checklist-job-label]');
const progressEl=root.querySelector('[data-checklist-progress]'),signOff=root.querySelector('[data-checklist-signoff]');
const initial=industryById[query.get('industry')]?query.get('industry'):'cleaning';
for(const industry of verticalOptions){const option=document.createElement('option');option.value=industry.id;option.textContent=industry.name;option.selected=industry.id===initial;select.append(option);}
function persist(){try{localStorage.setItem(CHECKLIST_DRAFT_KEY,JSON.stringify({savedAt:new Date().toISOString(),state}));}catch(_){}}
let state;
let draft=null;
try{draft=calc.parseChecklistDraft(localStorage.getItem(CHECKLIST_DRAFT_KEY),initial,taskLists);}catch(_){draft=null;}
if(draft){state=calc.reconcileChecklist(draft,initial,taskLists,TEMPLATE_REVISION);}
else{state={...calc.emptyChecklist(initial),tasks:calc.templateTasks(initial,taskLists,TEMPLATE_REVISION)};}
let nextId=1;
function refreshProgress(){const p=calc.checklistProgress(state);if(progressEl)progressEl.textContent=`${p.done} of ${p.total} tasks done${p.complete?'. All tasks complete.':'.'}`;}
function render(){
const industry=industryById[state.industry]||industryById.cleaning;
select.value=state.industry;profile.activeVertical=state.industry;
title.textContent=industry.name+' service checklist';
jobLabel.textContent=state.job?`Job/site: ${state.job}`:'';
if(job.value!==state.job)job.value=state.job;
if(signOff&&signOff.value!==(state.signOffNote||''))signOff.value=state.signOffNote||'';
list.replaceChildren();
state.tasks.forEach((task,index)=>{
const li=document.createElement('li');li.className='checklist-task'+(task.done?' is-done':'');li.dataset.taskId=task.id;
const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.checked=task.done;input.setAttribute('aria-label','Mark complete: '+task.text);
input.addEventListener('change',()=>{state=calc.setTaskDone(state,task.id,input.checked);li.classList.toggle('is-done',input.checked);persist();refreshProgress();});
label.append(input,textNode('span',task.text));li.append(label);
const controls=document.createElement('div');controls.className='button-row checklist-task-controls';
const btn=(text,label,handler,disabled)=>{const b=document.createElement('button');b.type='button';b.className='button button-secondary';b.textContent=text;b.setAttribute('aria-label',label);b.disabled=Boolean(disabled);b.addEventListener('click',handler);return b;};
controls.append(btn('Up','Move up: '+task.text,()=>{state=calc.moveTask(state,task.id,-1);persist();render();},index===0));
controls.append(btn('Down','Move down: '+task.text,()=>{state=calc.moveTask(state,task.id,1);persist();render();},index===state.tasks.length-1));
controls.append(btn('Edit','Edit task: '+task.text,()=>{const next=window.prompt('Edit task',task.text);if(next===null)return;try{state=calc.editTask(state,task.id,next);persist();render();}catch(error){window.alert(error.message);}}));
controls.append(btn('Remove','Remove task: '+task.text,()=>{if(!window.confirm('Remove this task from the checklist?'))return;state=calc.removeTask(state,task.id);persist();render();}));
li.append(controls);
const note=document.createElement('input');note.type='text';note.maxLength=300;note.value=task.note||'';note.placeholder='Evidence or note (optional)';note.setAttribute('aria-label','Evidence or note for: '+task.text);
note.addEventListener('change',()=>{state=calc.setTaskNote(state,task.id,note.value);persist();});
li.append(note);
list.append(li);
});
refreshProgress();
}
select.addEventListener('change',()=>{
const result=calc.switchIndustry(state,select.value,taskLists,false);
if(result.needsConfirm){if(!window.confirm('Switching service type clears the ticks and notes on this checklist. Continue?')){select.value=state.industry;return;}}
const switched=calc.switchIndustry(state,select.value,taskLists,true);
state=switched.state;persist();render();
});
job.addEventListener('input',()=>{state={...state,job:job.value.trim().slice(0,120)};persist();jobLabel.textContent=state.job?`Job/site: ${state.job}`:'';});
if(signOff)signOff.addEventListener('change',()=>{state={...state,signOffNote:signOff.value.slice(0,500)};persist();});
root.querySelector('[data-add-checklist-task]').addEventListener('click',()=>{
const input=root.querySelector('[data-custom-checklist-task]');
try{state=calc.addCustomTask(state,input.value,Date.now().toString(36)+'-'+(nextId++));input.value='';persist();render();input.focus();}
catch(error){window.alert(error.message);input.focus();}
});
root.querySelector('[data-reset-checklist]').addEventListener('click',()=>{
const anyDone=state.tasks.some(task=>task.done||task.note);
if(anyDone&&!window.confirm('Reset all ticks, notes and custom tasks for this checklist?'))return;
state={...calc.emptyChecklist(state.industry),job:state.job,tasks:calc.templateTasks(state.industry,taskLists,TEMPLATE_REVISION)};persist();render();
});
root.querySelector('[data-print-checklist]').addEventListener('click',()=>window.print());
const exportButton=root.querySelector('[data-export-checklist]');
if(exportButton)exportButton.addEventListener('click',()=>{
const text=calc.checklistText(state,(industryById[state.industry]||{}).name||state.industry);
const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
const link=document.createElement('a');link.href=url;link.download=state.industry+'-checklist.txt';document.body.append(link);link.click();link.remove();
setTimeout(()=>URL.revokeObjectURL(url),1000);
if(progressEl)progressEl.textContent='Checklist text downloaded. It was made in this browser and was not uploaded.';
});
render();
}
document.querySelectorAll('[data-quote-builder]').forEach(initializeQuoteBuilder);
document.querySelectorAll('[data-job-cost]').forEach(initializeJobCost);
document.querySelectorAll('[data-checklist-tool]').forEach(initializeChecklist);
})();
