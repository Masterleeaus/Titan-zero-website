(()=>{
'use strict';
const data=window.TITAN_SITE_CONTENT;
if(!data)return;
const rootUrl=new URL(document.body.dataset.siteRoot||'/',document.URL);
const pageUrl=(path)=>new URL(String(path).replace(/^\/+/,''),rootUrl).href;
const money=(n)=>'A$'+new Intl.NumberFormat('en-AU',{maximumFractionDigits:2}).format(Number(n)||0);
const number=(n,digits=0)=>new Intl.NumberFormat('en-AU',{maximumFractionDigits:digits}).format(Number(n)||0);
const escContext=(value)=>String(value||'').trim().slice(0,240);
const storageKey='titanBusinessToolProfileV3';
const industryById=Object.fromEntries(data.industries.map((item)=>[item.id,item]));
const verticalOptions=data.industries;
const query=new URLSearchParams(location.search);
const defaults={
admin:{title:'Admin cost',fields:[['adminHours','Admin hours each week',10,'hours/week'],['adminRate','Loaded hourly cost',45,'A$/hour']],calc:v=>({metric:v.adminHours*52/12*v.adminRate,format:'currency',label:'Estimated monthly admin labour value',math:`${v.adminHours} hrs/week × 52 ÷ 12 × ${money(v.adminRate)}/hr`,notes:['This is labour capacity value, not automatically cash savings.','Use a loaded hourly cost if you want super, leave and overhead reflected.']})},
hire:{title:'Should I hire?',fields:[['salary','Annual salary',65000,'A$/year'],['oncost','Employment on-cost',18,'% of salary',0,100],['margin','Average contribution per job',180,'A$/job']],calc:v=>{const monthly=v.salary*(1+v.oncost/100)/12;const jobs=v.margin>0?Math.ceil(monthly/v.margin):null;return{metric:monthly,format:'currency',label:'Estimated monthly employment cost',math:`${money(v.salary)}/year × (1 + ${v.oncost}%) ÷ 12`,notes:[jobs===null?'Enter a positive contribution per job to estimate the job count.':`At ${money(v.margin)} contribution per job, about ${number(jobs)} additional jobs/month would cover this cost.`,'This is a cost threshold, not a recommendation to hire.']}}},
breakeven:{title:'Break-even',fields:[['fixed','Monthly fixed costs',12000,'A$/month'],['price','Average job revenue',450,'A$/job'],['variable','Average variable cost',180,'A$/job']],calc:v=>{const contribution=v.price-v.variable;const jobs=contribution>0?Math.ceil(v.fixed/contribution):0;return{metric:jobs,format:'count',suffix:' jobs/month',label:'Jobs per month to cover fixed costs',math:`${money(v.fixed)} ÷ (${money(v.price)} − ${money(v.variable)})`,notes:[contribution>0?`Contribution per job: ${money(contribution)}.`:'Average job revenue must exceed variable cost before a break-even job count can be calculated.','Tax, financing and owner drawings are not included unless you put them into fixed costs.']}}},
profit:{title:'Job profitability',fields:[['jobRevenue','Job revenue',650,'A$'],['labour','Labour cost',220,'A$'],['materials','Materials',110,'A$'],['travel','Travel/other direct cost',45,'A$']],calc:v=>{const contribution=v.jobRevenue-v.labour-v.materials-v.travel;return{metric:contribution,format:'currency',label:'Contribution before overhead',math:`${money(v.jobRevenue)} − ${money(v.labour)} − ${money(v.materials)} − ${money(v.travel)}`,notes:[`Contribution margin: ${v.jobRevenue?((contribution/v.jobRevenue)*100).toFixed(1):0}%.`,'This is not net profit until overhead, tax and other costs are considered.']}}},
capacity:{title:'Capacity',fields:[['workers','Field workers',4,'people'],['hours','Productive hours per worker/week',30,'hours'],['duration','Average job duration',2.5,'hours/job',0.1],['currentJobs','Current jobs per month',150,'jobs']],calc:v=>{const cap=v.workers*v.hours*52/12/v.duration;const spare=Math.floor(cap-v.currentJobs);return{metric:Math.floor(cap),format:'count',suffix:' jobs/month',label:'Estimated jobs/month capacity',math:`${v.workers} workers × ${v.hours} productive hrs/week × 52 ÷ 12 ÷ ${v.duration} hrs/job`,notes:[spare>=0?`Approximate spare capacity: ${number(spare)} jobs/month.`:`Current volume is about ${number(Math.abs(spare))} jobs/month above this simple estimate.`,'Travel, cancellations, skills and scheduling constraints can reduce real capacity.']}}},
calls:{title:'Missed calls',fields:[['calls','Calls/enquiries per month',120,'calls'],['missed','Missed/unanswered rate',12,'% of enquiries',0,100],['convert','Likely conversion if answered',30,'% converted',0,100],['jobValue','Average job value',350,'A$']],calc:v=>{const missed=v.calls*v.missed/100;const opportunity=missed*v.convert/100*v.jobValue;return{metric:opportunity,format:'currency',label:'Monthly revenue opportunity exposed',math:`${v.calls} × ${v.missed}% missed × ${v.convert}% conversion × ${money(v.jobValue)}`,notes:[`About ${missed.toFixed(1)} enquiries/month are exposed under these assumptions.`,'This is opportunity exposure—not revenue Titan or any receptionist can guarantee.']}}},
leads:{title:'Lead conversion',fields:[['leads','Leads per month',100,'leads'],['current','Current conversion',20,'% converted',0,100],['target','Scenario conversion',23,'% converted',0,100],['value','Average customer/job value',450,'A$']],calc:v=>{const difference=v.leads*(v.target-v.current)/100*v.value;return{metric:difference,format:'currency',label:'Scenario revenue difference/month',math:`${v.leads} leads × (${v.target}% − ${v.current}%) × ${money(v.value)}`,notes:['This shows what the selected conversion change would be worth.','It does not claim that software, marketing or AI will cause that improvement.']}}},
invoice:{title:'Invoice collection',fields:[['invoices','Invoices per month',80,'invoices'],['avg','Average invoice',520,'A$'],['overdue','Beyond-terms share',18,'% of invoices',0,100],['chase','Hours/month chasing payment',7,'hours']],calc:v=>{const billed=v.invoices*v.avg;const overdue=billed*v.overdue/100;return{metric:overdue,format:'currency',label:'Value typically beyond terms',math:`${v.invoices} × ${money(v.avg)} × ${v.overdue}%`,notes:[`Monthly invoicing represented: ${money(billed)}.`,`${v.chase} hours/month are also spent on collection activity.`,'Faster collection improves cash availability; it does not create new revenue.']}}}
};
function readProfile(){
let saved={};
try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}')||{};}
catch(_){saved={};}
if(!Object.keys(saved).length){
try{
const old=JSON.parse(localStorage.getItem('titanBusinessToolProfileV2')||'{}')||{};
const active=industryById[old.activeVertical]?old.activeVertical:'cleaning';
saved={verticals:old.verticals,activeVertical:active,businessName:old.businessName,serviceName:old.serviceName,
assumptions:{[active]:Object.fromEntries(Object.entries(old).filter(([key,value])=>key!=='verticals'&&key!=='activeVertical'&&key!=='businessName'&&key!=='serviceName'&&Number.isFinite(Number(value))))}};
}catch(_){saved={};}
}
const allowed=Array.isArray(saved.verticals)?saved.verticals.filter((id,index,array)=>industryById[id]&&array.indexOf(id)===index):[];
const requested=industryById[query.get('industry')]?query.get('industry'):'';
const active=requested||(industryById[saved.activeVertical]?saved.activeVertical:'cleaning');
if(!allowed.includes(active))allowed.push(active);
if(!allowed.length)allowed.push('cleaning');
const assumptions=saved.assumptions&&typeof saved.assumptions==='object'?saved.assumptions:{};
for(const id of Object.keys(assumptions))if(!industryById[id]||!assumptions[id]||typeof assumptions[id]!=='object')delete assumptions[id];
return{verticals:allowed,activeVertical:active,businessName:escContext(saved.businessName),serviceName:escContext(saved.serviceName),assumptions};
}
const profile=readProfile();
function saveProfile(){try{localStorage.setItem(storageKey,JSON.stringify(profile));}catch(_){}}
function currentIndustry(){return industryById[profile.activeVertical]||industryById.cleaning;}
function getAssumptions(){return profile.assumptions[profile.activeVertical]||(profile.assumptions[profile.activeVertical]={});}
function defaultFor(key,fallback){const stored=Number(getAssumptions()[key]);if(Number.isFinite(stored))return stored;const tuned=Number(currentIndustry().defaults[key]);return Number.isFinite(tuned)?tuned:fallback;}
function createLink(text,href,className='text-link'){const a=document.createElement('a');a.className=className;a.href=href;a.textContent=text;return a;}
function toolContextUrl(route,context){
const url=new URL(pageUrl(route));
url.searchParams.set('tool_context',JSON.stringify(context));
return url.href;
}
function addPrintButton(parent,label='Print / save PDF'){const b=document.createElement('button');b.type='button';b.className='button button-secondary';b.textContent=label;b.addEventListener('click',()=>window.print());parent.append(b);}
function addHandoffButtons(parent,context){
const row=document.createElement('div');row.className='button-row result-actions';
row.append(createLink('Take result to Titan pricing',toolContextUrl('pricing/',context)));
row.append(createLink('Prepare a support enquiry',toolContextUrl('support/',context),'button button-secondary'));
addPrintButton(row);
parent.append(row,textNode('p','The optional handoff includes this result in the destination URL for prefill. It may remain in browser history or ordinary hosting logs; leave out customer or confidential details.','fine-print handoff-note'));
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
if(clear)clear.addEventListener('click',()=>{try{localStorage.removeItem(storageKey);localStorage.removeItem('titanBusinessToolProfileV2');}catch(_){}profile.verticals=['cleaning'];profile.activeVertical=industryById[query.get('industry')]?query.get('industry'):'cleaning';if(profile.activeVertical!=='cleaning')profile.verticals.push(profile.activeVertical);profile.businessName='';profile.serviceName='';profile.assumptions={};saveProfile();drawSummary();root.dispatchEvent(new CustomEvent('toolverticalchange'));});
drawSummary();
}
function showCalculatorResult(resultElement,definition,outcome,values){
resultElement.replaceChildren();
resultElement.append(textNode('p',definition.title,'eyebrow'));
const metric=textNode('div',outcome.format==='count'?number(outcome.metric)+outcome.suffix:money(outcome.metric),'metric');
resultElement.append(metric,textNode('h2',outcome.label));
const math=textNode('div','Calculation: '+outcome.math,'math');resultElement.append(math);
const notes=document.createElement('ul');
for(const note of outcome.notes||[])notes.append(textNode('li',note));
notes.append(textNode('li',`Industry context: ${currentIndustry().name}. ${currentIndustry().summary}`));
resultElement.append(notes);
const context={tool:definition.title,vertical:currentIndustry().name,business:profile.businessName,service:profile.serviceName,result:(outcome.format==='count'?number(outcome.metric)+outcome.suffix:money(outcome.metric))+' — '+outcome.label,calculation:outcome.math};
addHandoffButtons(resultElement,context);
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
for(const[key,label,fallback,unit,min=0,max]of definition.fields){
const wrap=document.createElement('div');wrap.className='tool-field';
const lab=document.createElement('label');lab.htmlFor='tool-'+key;lab.textContent=label;
const input=document.createElement('input');input.id='tool-'+key;input.name=key;input.type='number';input.required=true;input.min=String(min);if(max!==undefined)input.max=String(max);input.step='any';input.inputMode='decimal';input.value=String(defaultFor(key,fallback));
const unitNote=textNode('small',unit);
wrap.append(lab,input,unitNote);fieldsElement.append(wrap);
}
result.replaceChildren(textNode('p',definition.title,'eyebrow'),textNode('h2','Enter your numbers'),textNode('p','We will show the calculation, the assumptions used and a clear next step.'));
tabs.forEach(tab=>tab.setAttribute('aria-selected',String(tab.dataset.toolTab===active)));
}
form.addEventListener('submit',(event)=>{
event.preventDefault();if(!form.reportValidity())return;
const values={};for(const[key,value]of new FormData(form).entries())values[key]=Number(value);
for(const[key,value]of Object.entries(values)){if(!Number.isFinite(value)||value<0)return;getAssumptions()[key]=value;}
saveProfile();
const outcome=defaults[active].calc(values);
showCalculatorResult(result,defaults[active],outcome,values);
});
tabs.forEach(tab=>tab.addEventListener('click',()=>{if(!defaults[tab.dataset.toolTab])return;active=tab.dataset.toolTab;draw();}));
root.addEventListener('toolverticalchange',draw);
draw();
}
document.querySelectorAll('[data-tools-app]').forEach(initializeCalculator);
function initializeQuoteBuilder(root){
const form=root.querySelector('[data-quote-form]'),lines=root.querySelector('[data-quote-lines]'),output=root.querySelector('[data-quote-result]');
if(!form||!lines||!output)return;
const business=form.elements.namedItem('business');if(business)business.value=profile.businessName;
const service=form.elements.namedItem('service');if(service)service.value=profile.serviceName;
function addLine(description='',quantity=1,price=0){
const row=document.createElement('div');row.className='quote-line-row';
const desc=document.createElement('label');desc.textContent='Work item';const name=document.createElement('input');name.name='line-description';name.maxLength=160;name.value=description;name.placeholder='Service or item';desc.append(name);
const qtyLabel=document.createElement('label');qtyLabel.textContent='Quantity';const qty=document.createElement('input');qty.name='line-quantity';qty.type='number';qty.min='0';qty.step='any';qty.value=String(quantity);qty.inputMode='decimal';qtyLabel.append(qty);
const priceLabel=document.createElement('label');priceLabel.textContent='Unit price (A$)';const unit=document.createElement('input');unit.name='line-price';unit.type='number';unit.min='0';unit.step='0.01';unit.value=String(price);unit.inputMode='decimal';priceLabel.append(unit);
const remove=document.createElement('button');remove.type='button';remove.className='button button-secondary';remove.textContent='Remove';remove.setAttribute('aria-label','Remove quote line');remove.addEventListener('click',()=>{if(lines.children.length>1)row.remove();update();});
row.append(desc,qtyLabel,priceLabel,remove);lines.append(row);row.addEventListener('input',update);update();
}
function update(){
const rows=[...lines.querySelectorAll('.quote-line-row')];
const raw=rows.map(row=>({description:row.querySelector('[name=line-description]').value.trim(),quantity:Number(row.querySelector('[name=line-quantity]').value)||0,unit:Number(row.querySelector('[name=line-price]').value)||0}));
const subtotal=raw.reduce((sum,item)=>sum+item.quantity*item.unit,0);const discount=Math.min(100,Math.max(0,Number(form.elements.namedItem('discount').value)||0));const discounted=subtotal*(1-discount/100);const gst=form.elements.namedItem('gst').checked?discounted*0.1:0;const total=discounted+gst;
output.replaceChildren(textNode('p','Quote preview','eyebrow'),textNode('h2',form.elements.namedItem('service').value.trim()||'Service quote'));
const businessName=form.elements.namedItem('business').value.trim();if(businessName)output.append(textNode('p',businessName));
const customer=form.elements.namedItem('customer').value.trim();if(customer)output.append(textNode('p','Prepared for: '+customer));
const reference=form.elements.namedItem('reference').value.trim();if(reference)output.append(textNode('p','Reference: '+reference));
const table=document.createElement('table');table.className='quote-preview-table';const body=document.createElement('tbody');
raw.filter(item=>item.description||item.unit>0).forEach(item=>{const tr=document.createElement('tr');tr.append(textNode('td',item.description||'Service item'),textNode('td',`${number(item.quantity,2)} × ${money(item.unit)}`),textNode('td',money(item.quantity*item.unit)));body.append(tr);});table.append(body);output.append(table);
const totals=document.createElement('dl');totals.className='quote-totals';for(const[label,value]of[['Subtotal',subtotal],['Discount',-subtotal*discount/100],['GST',gst],['Total',total]]){totals.append(textNode('dt',label),textNode('dd',money(value)));}output.append(totals);
output.append(textNode('p','Check the scope, exclusions, due date and applicable tax details before sending.','fine-print'));
const context={tool:'Quote builder',vertical:currentIndustry().name,business:businessName,service:form.elements.namedItem('service').value.trim(),result:'Quote total '+money(total),calculation:`Subtotal ${money(subtotal)}; discount ${discount}%; GST ${money(gst)}.`};addHandoffButtons(output,context);
}
root.querySelector('[data-add-quote-line]').addEventListener('click',()=>addLine());
form.addEventListener('input',update);form.addEventListener('change',update);form.addEventListener('submit',event=>{event.preventDefault();update();});
addLine('Service',1,0);addLine();
}
function initializeJobCost(root){
const form=root.querySelector('[data-job-cost-form]'),output=root.querySelector('[data-job-cost-result]');if(!form||!output)return;
form.elements.namedItem('business').value=profile.businessName;form.elements.namedItem('service').value=profile.serviceName;
form.addEventListener('submit',(event)=>{
event.preventDefault();if(!form.reportValidity())return;
const v=Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,Number(value)||0]));
const labour=v.workers*v.hours*v.rate,direct=labour+v.materials+v.travel+v.other,totalCost=direct+v.overhead,contribution=v.price-totalCost,margin=v.price>0?contribution/v.price*100:0,targetPrice=v.target<100?totalCost/(1-v.target/100):null;
output.replaceChildren(textNode('p','Job-cost result','eyebrow'),textNode('h2',form.elements.namedItem('service').value.trim()||'Estimated job economics'));
const businessName=form.elements.namedItem('business').value.trim();if(businessName)output.append(textNode('p',businessName));
const list=document.createElement('dl');list.className='quote-totals';for(const[label,value]of[['Labour',labour],['Materials',v.materials],['Travel and vehicle',v.travel],['Other direct costs',v.other],['Direct job cost',direct],['Allocated overhead',v.overhead],['Estimated total cost',totalCost],['Customer price',v.price],['Contribution after estimated cost',contribution],['Margin at entered price',margin.toFixed(1)+'%'],['Price at target margin',targetPrice===null?'Enter a target below 100%':money(targetPrice)]]){list.append(textNode('dt',label),textNode('dd',typeof value==='number'?money(value):value));}output.append(list);
output.append(textNode('p','The target price is an arithmetic scenario. Confirm scope, market conditions, tax and costs before quoting.','fine-print'));
const context={tool:'Job-cost sheet',vertical:currentIndustry().name,business:businessName,service:form.elements.namedItem('service').value.trim(),result:'Estimated cost '+money(totalCost)+'; entered price '+money(v.price)+'; contribution '+money(contribution)+'; margin '+margin.toFixed(1)+'%.',calculation:`Labour ${money(labour)} + direct costs ${money(v.materials+v.travel+v.other)} + overhead ${money(v.overhead)}.`};addHandoffButtons(output,context);
});
}
const taskLists=data.checklists||{};
function initializeChecklist(root){
const select=root.querySelector('[data-checklist-vertical]'),list=root.querySelector('[data-generated-checklist]');if(!select||!list)return;
const initial=industryById[query.get('industry')]?query.get('industry'):'cleaning';let custom=[];
for(const industry of verticalOptions){const option=document.createElement('option');option.value=industry.id;option.textContent=industry.name;option.selected=industry.id===initial;select.append(option);}
const title=root.querySelector('[data-checklist-title]'),job=root.querySelector('[data-checklist-job]'),jobLabel=root.querySelector('[data-checklist-job-label]');
function render(){const industry=currentIndustry();title.textContent=industry.name+' service checklist';jobLabel.textContent=job.value.trim()?`Job/site: ${job.value.trim()}`:'';list.replaceChildren();[...(taskLists[industry.id]||[]),...custom].forEach((task,index)=>{const li=document.createElement('li');const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.setAttribute('aria-label','Mark task complete');label.append(input,textNode('span',task));li.append(label);list.append(li);});}
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
})();
