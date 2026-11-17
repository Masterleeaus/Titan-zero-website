(()=>{
'use strict';
const data=window.TITAN_SITE_CONTENT;
const E=window.TitanToolsEngine;
if(!data||!E)return;
const rootUrl=new URL(document.body.dataset.siteRoot||'/',document.URL);
const pageUrl=(path)=>new URL(String(path).replace(/^\/+/,''),rootUrl).href;
const money=E.formatMoney;
const number=E.formatNumber;
const escContext=(value)=>String(value||'').trim().slice(0,240);
const industryById=Object.fromEntries(data.industries.map((item)=>[item.id,item]));
const verticalOptions=data.industries;
const query=new URLSearchParams(location.search);
// Calculation logic lives in assets/tools-engine.js (pure, tested). This file only handles the page.
const defaults={
admin:{title:'Admin cost',fields:[['adminHours','Admin hours each week',10,'hours/week'],['adminRate','Loaded hourly cost',45,'A$/hour']],calc:E.calculators.admin},
hire:{title:'Should I hire?',fields:[['salary','Annual salary',65000,'A$/year'],['oncost','Employment on-cost',18,'% of salary'],['margin','Average contribution per job',180,'A$/job']],calc:E.calculators.hire},
breakeven:{title:'Break-even',fields:[['fixed','Monthly fixed costs',12000,'A$/month'],['price','Average job revenue',450,'A$/job'],['variable','Average variable cost',180,'A$/job']],calc:E.calculators.breakeven},
profit:{title:'Job profitability',fields:[['jobRevenue','Job revenue',650,'A$'],['labour','Labour cost',220,'A$'],['materials','Materials',110,'A$'],['travel','Travel/other direct cost',45,'A$']],calc:E.calculators.profit},
capacity:{title:'Capacity',fields:[['workers','Field workers',4,'people'],['hours','Productive hours per worker/week',30,'hours'],['duration','Average job duration',2.5,'hours/job'],['currentJobs','Current jobs per month',150,'jobs']],calc:E.calculators.capacity},
calls:{title:'Missed calls',fields:[['calls','Calls/enquiries per month',120,'calls'],['missed','Missed/unanswered rate',12,'% of enquiries'],['convert','Likely conversion if answered',30,'% converted'],['jobValue','Average job value',350,'A$']],calc:E.calculators.calls},
leads:{title:'Lead conversion',fields:[['leads','Leads per month',100,'leads'],['current','Current conversion',20,'% converted'],['target','Scenario conversion',23,'% converted'],['value','Average customer/job value',450,'A$']],calc:E.calculators.leads},
invoice:{title:'Invoice collection',fields:[['invoices','Invoices per month',80,'invoices'],['avg','Average invoice',520,'A$'],['overdue','Beyond-terms share',18,'% of invoices'],['chase','Hours/month chasing payment',7,'hours']],calc:E.calculators.invoice}
};
// Stored locally on this device only. Migrates V2 to V3 once, then removes the V2 copy.
const loaded=(()=>{
let v3=null,v2=null;
try{v3=JSON.parse(localStorage.getItem(E.PROFILE_KEY)||'null');}catch(_){v3=null;}
try{v2=JSON.parse(localStorage.getItem(E.LEGACY_PROFILE_KEY)||'null');}catch(_){v2=null;}
return E.migrateProfile({v3,v2,industryIds:data.industries.map((item)=>item.id)});
})();
const profile=loaded.profile;
const requested=industryById[query.get('industry')]?query.get('industry'):'';
if(requested){profile.activeVertical=requested;if(!profile.verticals.includes(requested))profile.verticals.push(requested);}
let storageAvailable=true;
function saveProfile(){
try{
localStorage.setItem(E.PROFILE_KEY,JSON.stringify({schema:E.PROFILE_VERSION,verticals:profile.verticals,activeVertical:profile.activeVertical,businessName:profile.businessName,serviceName:profile.serviceName,assumptions:profile.assumptions}));
localStorage.removeItem(E.LEGACY_PROFILE_KEY);
storageAvailable=true;
}catch(_){storageAvailable=false;}
return storageAvailable;
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
if(clear)clear.addEventListener('click',()=>{try{localStorage.removeItem(E.PROFILE_KEY);localStorage.removeItem(E.LEGACY_PROFILE_KEY);}catch(_){}profile.verticals=['cleaning'];profile.activeVertical=industryById[query.get('industry')]?query.get('industry'):'cleaning';if(profile.activeVertical!=='cleaning')profile.verticals.push(profile.activeVertical);profile.businessName='';profile.serviceName='';profile.assumptions={};saveProfile();drawSummary();root.dispatchEvent(new CustomEvent('toolverticalchange'));});
drawSummary();
}
function showCalculatorResult(resultElement,definition,outcome){
resultElement.replaceChildren();
resultElement.append(textNode('p',definition.title,'eyebrow'));
const displayed=outcome.format==='unavailable'?'Not achievable':outcome.format==='count'?number(outcome.metric)+outcome.suffix:money(outcome.metric);
const metric=textNode('div',displayed,'metric');
resultElement.append(metric,textNode('h2',outcome.label));
const math=textNode('div','Calculation: '+outcome.math,'math');resultElement.append(math);
const notes=document.createElement('ul');
for(const note of outcome.notes||[])notes.append(textNode('li',note));
notes.append(textNode('li',`Industry context: ${currentIndustry().name}. ${currentIndustry().summary}`));
resultElement.append(notes);
if(!storageAvailable)resultElement.append(textNode('p','This browser could not save your numbers on this device. The result is still shown here; copy it if you need it.','fine-print'));
const context={tool:definition.title,vertical:currentIndustry().name,business:profile.businessName,service:profile.serviceName,result:displayed+' — '+outcome.label,calculation:outcome.math};
addHandoffButtons(resultElement,context);
}
function showInputErrors(resultElement,title,errors,fieldFor){
resultElement.replaceChildren(textNode('p',title,'eyebrow'),textNode('h2','Check these numbers'));
const list=document.createElement('ul');list.setAttribute('role','alert');
for(const error of errors){
const item=document.createElement('li');const field=fieldFor(error.key);
if(field){const link=createLink(error.message,'#'+field.id,'text-link');item.append(link);}else item.append(error.message);
list.append(item);
}
resultElement.append(list,textNode('p','No result is shown until the numbers are valid. Nothing has been saved for these entries.','fine-print'));
}
function initializeCalculator(root){
setupContext(root);
let active=root.dataset.initialTool||'';
const fieldsElement=root.querySelector('[data-tool-fields]');
const form=root.querySelector('[data-tool-form]');
const result=root.querySelector('[data-tool-result]');
if(!fieldsElement||!form||!result)return;
form.noValidate=true;
result.setAttribute('tabindex','-1');
const tabs=[...root.querySelectorAll('[data-tool-tab]')];
if(!active)active=tabs[0]?.dataset.toolTab||'admin';
function draw(){
const definition=defaults[active];if(!definition)return;
fieldsElement.replaceChildren();
for(const[key,label,fallback,unit]of definition.fields){
const spec=E.RULES[active][key];
const wrap=document.createElement('div');wrap.className='tool-field';
const lab=document.createElement('label');lab.htmlFor='tool-'+key;lab.textContent=label;
const input=document.createElement('input');input.id='tool-'+key;input.name=key;input.type='number';input.required=true;input.min=String(spec.min);input.max=String(spec.max);input.step=spec.kind==='money'?'0.01':'any';input.inputMode='decimal';input.value=String(defaultFor(key,fallback));
const unitNote=textNode('small',unit);
wrap.append(lab,input,unitNote);fieldsElement.append(wrap);
}
result.replaceChildren(textNode('p',definition.title,'eyebrow'),textNode('h2','Enter your numbers'),textNode('p','We will show the calculation, the assumptions used and a clear next step.'));
tabs.forEach(tab=>tab.setAttribute('aria-selected',String(tab.dataset.toolTab===active)));
}
form.addEventListener('submit',(event)=>{
event.preventDefault();
const definition=defaults[active];if(!definition)return;
const checked=E.validate(active,Object.fromEntries(new FormData(form)));
const fieldFor=(key)=>fieldsElement.querySelector('#tool-'+key);
for(const input of fieldsElement.querySelectorAll('input'))input.setAttribute('aria-invalid','false');
if(!checked.ok){
for(const error of checked.errors){const input=fieldFor(error.key);if(input)input.setAttribute('aria-invalid','true');}
showInputErrors(result,definition.title,checked.errors,fieldFor);
const first=checked.errors.map(error=>fieldFor(error.key)).find(Boolean);
(first||result).focus();
return;
}
for(const[key,value]of Object.entries(checked.values))getAssumptions()[key]=value;
saveProfile();
const outcome=definition.calc(checked.values);
showCalculatorResult(result,definition,outcome);
result.focus();
});
tabs.forEach(tab=>tab.addEventListener('click',()=>{if(!defaults[tab.dataset.toolTab])return;active=tab.dataset.toolTab;draw();}));
root.addEventListener('toolverticalchange',draw);
draw();
}
document.querySelectorAll('[data-tools-app]').forEach(initializeCalculator);
function initializeQuoteBuilder(root){
const form=root.querySelector('[data-quote-form]'),lines=root.querySelector('[data-quote-lines]'),output=root.querySelector('[data-quote-result]');
if(!form||!lines||!output)return;
form.noValidate=true;
const business=form.elements.namedItem('business');if(business)business.value=profile.businessName;
const service=form.elements.namedItem('service');if(service)service.value=profile.serviceName;
function addLine(description='',quantity=1,price=0){
const row=document.createElement('div');row.className='quote-line-row';
const desc=document.createElement('label');desc.textContent='Work item';const name=document.createElement('input');name.name='line-description';name.maxLength=160;name.value=description;name.placeholder='Service or item';desc.append(name);
const qtyLabel=document.createElement('label');qtyLabel.textContent='Quantity';const qty=document.createElement('input');qty.name='line-quantity';qty.type='number';qty.min='0';qty.max='10000';qty.step='any';qty.value=String(quantity);qty.inputMode='decimal';qtyLabel.append(qty);
const priceLabel=document.createElement('label');priceLabel.textContent='Unit price (A$)';const unit=document.createElement('input');unit.name='line-price';unit.type='number';unit.min='0';unit.step='0.01';unit.value=String(price);unit.inputMode='decimal';priceLabel.append(unit);
const remove=document.createElement('button');remove.type='button';remove.className='button button-secondary';remove.textContent='Remove';remove.setAttribute('aria-label','Remove quote line');remove.addEventListener('click',()=>{if(lines.children.length>1)row.remove();update();});
row.append(desc,qtyLabel,priceLabel,remove);lines.append(row);row.addEventListener('input',update);update();
}
function update(){
const rows=[...lines.querySelectorAll('.quote-line-row')];
const raw=rows.map(row=>({description:row.querySelector('[name=line-description]').value.trim(),quantity:row.querySelector('[name=line-quantity]').value,unit:row.querySelector('[name=line-price]').value}));
const checked=E.validateLines(raw.map(item=>({quantity:item.quantity,unit:item.unit})));
const discountRaw=Number(form.elements.namedItem('discount').value);
const discountOk=Number.isFinite(discountRaw)&&discountRaw>=0&&discountRaw<=100;
if(!checked.ok||!discountOk){
const errors=checked.ok?[]:checked.errors;
output.replaceChildren(textNode('p','Quote preview','eyebrow'),textNode('h2','Check these numbers'));
const list=document.createElement('ul');list.setAttribute('role','alert');
for(const error of errors)list.append(textNode('li',error.message));
if(!discountOk)list.append(textNode('li','Discount must be between 0 and 100%.'));
output.append(list);
return;
}
const includeGst=form.elements.namedItem('gst').checked;
let quoted;
try{quoted=E.quote({lines:checked.lines,discountPercent:discountRaw,includeGst});}
catch(error){output.replaceChildren(textNode('p','Quote preview','eyebrow'),textNode('h2','Check these numbers'),textNode('p',error.message,'fine-print'));return;}
const subtotal=quoted.subtotal,gst=quoted.gst,total=quoted.total,discount=discountRaw;
output.replaceChildren(textNode('p','Quote preview','eyebrow'),textNode('h2',form.elements.namedItem('service').value.trim()||'Service quote'));
const businessName=form.elements.namedItem('business').value.trim();if(businessName)output.append(textNode('p',businessName));
const customer=form.elements.namedItem('customer').value.trim();if(customer)output.append(textNode('p','Prepared for: '+customer));
const reference=form.elements.namedItem('reference').value.trim();if(reference)output.append(textNode('p','Reference: '+reference));
const table=document.createElement('table');table.className='quote-preview-table';const body=document.createElement('tbody');
raw.filter(item=>item.description||Number(item.unit)>0).forEach((item,index)=>{const tr=document.createElement('tr');const q=Number(item.quantity)||0,u=Number(item.unit)||0;tr.append(textNode('td',item.description||'Service item'),textNode('td',`${number(q,2)} × ${money(u)}`),textNode('td',money(E.quote({lines:[{quantity:q,unit:u}]}).subtotal)));body.append(tr);});table.append(body);output.append(table);
const totals=document.createElement('dl');totals.className='quote-totals';for(const[label,value]of[['Subtotal',subtotal],['Discount',quoted.discount],['GST',gst],['Total',total]]){totals.append(textNode('dt',label),textNode('dd',money(value)));}output.append(totals);
output.append(textNode('p','Check the scope, exclusions, due date and applicable tax details before sending.','fine-print'));
const context={tool:'Quote builder',vertical:currentIndustry().name,business:businessName,service:form.elements.namedItem('service').value.trim(),result:'Quote total '+money(total),calculation:`Subtotal ${money(subtotal)}; discount ${discount}%; GST ${money(gst)}.`};addHandoffButtons(output,context);
}
root.querySelector('[data-add-quote-line]').addEventListener('click',()=>addLine());
form.addEventListener('input',update);form.addEventListener('change',update);form.addEventListener('submit',event=>{event.preventDefault();update();});
addLine('Service',1,0);addLine();
}
function initializeJobCost(root){
const form=root.querySelector('[data-job-cost-form]'),output=root.querySelector('[data-job-cost-result]');if(!form||!output)return;
form.noValidate=true;
form.elements.namedItem('business').value=profile.businessName;form.elements.namedItem('service').value=profile.serviceName;
form.addEventListener('submit',(event)=>{
event.preventDefault();
const checked=E.validate('jobcost',Object.fromEntries(new FormData(form)));
if(!checked.ok){
output.replaceChildren(textNode('p','Job-cost result','eyebrow'),textNode('h2','Check these numbers'));
const list=document.createElement('ul');list.setAttribute('role','alert');for(const error of checked.errors)list.append(textNode('li',error.message));output.append(list);
output.focus();return;
}
const v=checked.values;
const cost=E.jobCost({workers:v.workers,hours:v.hours,rate:v.rate,materials:v.materials,travel:v.travel,other:v.other,overhead:v.overhead,price:v.price,target:v.target});
const labour=cost.labour,direct=cost.direct,totalCost=cost.total,contribution=cost.contribution,margin=cost.marginPercent,targetPrice=cost.targetPrice;
output.replaceChildren(textNode('p','Job-cost result','eyebrow'),textNode('h2',form.elements.namedItem('service').value.trim()||'Estimated job economics'));
const businessName=form.elements.namedItem('business').value.trim();if(businessName)output.append(textNode('p',businessName));
const list=document.createElement('dl');list.className='quote-totals';for(const[label,value]of[['Labour',labour],['Materials',v.materials],['Travel and vehicle',v.travel],['Other direct costs',v.other],['Direct job cost',direct],['Allocated overhead',v.overhead],['Estimated total cost',totalCost],['Customer price',v.price],['Contribution after estimated cost',contribution],['Margin at entered price',number(margin,1)+'%'],['Price at target margin',targetPrice===null?'Enter a target below 100%':money(targetPrice)]]){list.append(textNode('dt',label),textNode('dd',typeof value==='number'?money(value):value));}output.append(list);
output.append(textNode('p','The target price is an arithmetic scenario. Confirm scope, market conditions, tax and costs before quoting.','fine-print'));
const context={tool:'Job-cost sheet',vertical:currentIndustry().name,business:businessName,service:form.elements.namedItem('service').value.trim(),result:'Estimated cost '+money(totalCost)+'; entered price '+money(v.price)+'; contribution '+money(contribution)+'; margin '+number(margin,1)+'%.',calculation:`Labour ${money(labour)} + direct costs ${money(v.materials+v.travel+v.other)} + overhead ${money(v.overhead)}.`};addHandoffButtons(output,context);
output.setAttribute('tabindex','-1');output.focus();
});
}
const taskLists=data.checklists||{};
function initializeChecklist(root){
const select=root.querySelector('[data-checklist-vertical]'),list=root.querySelector('[data-generated-checklist]');if(!select||!list)return;
const initial=industryById[query.get('industry')]?query.get('industry'):'cleaning';let custom=[];
for(const industry of verticalOptions){const option=document.createElement('option');option.value=industry.id;option.textContent=industry.name;option.selected=industry.id===initial;select.append(option);}
const title=root.querySelector('[data-checklist-title]'),job=root.querySelector('[data-checklist-job]'),jobLabel=root.querySelector('[data-checklist-job-label]');
function render(){const industry=currentIndustry();title.textContent=industry.name+' service checklist';jobLabel.textContent=job.value.trim()?`Job/site: ${job.value.trim()}`:'';list.replaceChildren();[...(taskLists[industry.id]||[]),...custom].forEach((task)=>{const li=document.createElement('li');const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.setAttribute('aria-label','Mark task complete');label.append(input,textNode('span',task));li.append(label);list.append(li);});}
select.value=initial;profile.activeVertical=initial;
select.addEventListener('change',()=>{if(!industryById[select.value])return;profile.activeVertical=select.value;custom=[];render();});
job.addEventListener('input',render);
root.querySelector('[data-add-checklist-task]').addEventListener('click',()=>{const input=root.querySelector('[data-custom-checklist-task]');const value=escContext(input.value);if(!value)return;custom.push(value);input.value='';render();input.focus();});
root.querySelector('[data-reset-checklist]').addEventListener('click',()=>{custom=[];render();});
root.querySelector('[data-print-checklist]').addEventListener('click',()=>window.print());
render();
}
document.querySelectorAll('[data-quote-builder]').forEach(initializeQuoteBuilder);
document.querySelectorAll('[data-job-cost]').forEach(initializeJobCost);
document.querySelectorAll('[data-checklist-tool]').forEach(initializeChecklist);
if(loaded.migratedFromV2)saveProfile();
})();
