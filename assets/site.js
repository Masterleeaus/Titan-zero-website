window.TITAN_BOS_DATA={"apps":{"build":{"name":"ScheduledAt.Work","short":"Services, growth & new opportunities","prices":[49,59,89]},"desk":{"name":"SuperchargedAt.Work","short":"Customers, conversations & bookings","prices":[99,129,179]},"field":{"name":"SortedAt.Work","short":"Scheduling, people & service delivery","prices":[49,59,99]},"synced":{"name":"SyncedAt.Work","short":"Omnichannel inbox & campaigns","prices":[49,59,99]},"solo":{"name":"SoloAt.Work","short":"Agent departments for one-person businesses","prices":[49,79,149]}},"tiers":[{"name":"BYO AI and API keys","slug":"byo"},{"name":"Standard AI","slug":"standard"},{"name":"Unlimited AI","slug":"unlimited"}],"industries":["Cleaning","Plumbing","Electrical","HVAC","Property maintenance","Landscaping & gardening","Pest control","Locksmiths & security","Roofing & guttering","Appliance & equipment repair"],"configurator":{"version":1,"currency":"AUD","catalogueRevision":"2026-10-06-calculator-5","pricingNote":"App prices are retained from the existing marketing source. New add-on and deployment prices require a scoped quote; historical provisional rates are not published.","limits":{"nodes":500,"locations":100,"models":20,"knowledgeSources":10000},"intelligence":[{"id":"existing","name":"Use my existing AI connection","description":"Keep your current model or provider. No new model service is added here; provider and compute costs remain separate."},{"id":"industry-pro","name":"Titan Zero Industry Pro AI Model","description":"A white-labelled industry AI model with embedded business knowledge and RAG. Scope your branding, model variants and approved knowledge sources together."},{"id":"private-model","name":"Private model integration","description":"Connect and configure a private model for your business. Choose where it runs below; add private knowledge integration separately when needed."}],"deployments":[{"id":"current","name":"Keep my current deployment","description":"No new infrastructure package selected. Existing hosting, AI provider and hardware costs are not included in the subtotal."},{"id":"business-node","name":"Business-owned node","description":"Run on your approved business hardware. Configure the total nodes and choose self-managed or assisted setup."},{"id":"private-cloud","name":"Private cloud model environment","description":"A dedicated private model environment. Hosting, capacity and support requirements are scoped for your business."},{"id":"sovereign","name":"Titan Sovereign Mode","description":"Scope a business-owned AI environment, private knowledge and approved infrastructure. Full business-node setup and handover are scoped together."}],"products":[{"id":"industry-pro","name":"Titan Zero Industry Pro AI Model","description":"White-labelled model, industry configuration and embedded RAG/business knowledge. Initial model configuration is scoped once.","status":"quote","rates":{"monthly":null,"oneOff":null},"unit":"model","quantityKey":"models"},{"id":"private-model","name":"Private model integration","description":"Private runtime integration and model configuration. Model licences, compute and optional support are agreed separately.","status":"quote","rates":{"monthly":null,"oneOff":null},"unit":"model","quantityKey":"models"},{"id":"private-cloud","name":"Private cloud environment","description":"Dedicated private hosting. Capacity, location, compute usage and responsibility for management require confirmation.","status":"quote","rates":{"monthly":null},"unit":"environment"},{"id":"sovereign","name":"Titan Sovereign deployment & setup","description":"Ownership and infrastructure scope, private data boundaries, full node deployment and handover. Node setup and existing model/knowledge preparation are not added twice.","status":"quote","rates":{"oneOff":null},"unit":"deployment"},{"id":"federation","name":"Titan Sovereign Federated Git Network","description":"A private, closed Git-based network across approved Titan Nodes for version-controlled business configuration, AI policies, workflows, knowledge definitions and deployment manifests. Operational databases, secrets, vector stores and model weights remain in their appropriate private data/runtime layers.","status":"quote","rates":{"monthly":null},"unit":"federated Git network"},{"id":"node-setup","name":"Full business-node deployment & setup","description":"Install and deploy the configured model and knowledge services, enrol nodes, validate and hand over. Model creation and knowledge preparation are scoped under the selected intelligence package.","status":"quote","rates":{"oneOff":null},"unit":"deployment"},{"id":"private-rag","name":"Private business knowledge / RAG","description":"Connect approved documents, procedures and business knowledge to your existing or private model. Included in the Industry Pro scope.","status":"quote","rates":{"monthly":null,"oneOff":null},"unit":"knowledge environment","optional":true,"group":"knowledge"},{"id":"voice","name":"Titan Voice","description":"Scope voice conversations, transcription and call workflows. Provider usage is separate; Sovereign-compatible routing must be confirmed.","status":"quote","rates":{"monthly":null},"unit":"business","optional":true,"group":"operations"},{"id":"vision","name":"Titan Vision","description":"Scope image analysis, document reading and evidence interpretation. Model usage and private deployment suitability are confirmed separately.","status":"quote","rates":{"monthly":null},"unit":"business","optional":true,"group":"operations"},{"id":"vault","name":"Titan Vault","description":"Additional private storage, versioning and retention. Capacity, location and access requirements are scoped before activation.","status":"quote","rates":{"monthly":null},"unit":"business","optional":true,"group":"operations"},{"id":"integrations","name":"Titan Integrations","description":"Scope the business systems and approved data connections you need. Connector setup and provider costs are identified in your quote.","status":"quote","rates":{"monthly":null,"oneOff":null},"unit":"integration scope","optional":true,"group":"operations"},{"id":"migration","name":"Business data migration & preparation","description":"Extra legacy-data cleanup, mapping and migration beyond standard knowledge configuration. Scoped separately to avoid duplicate setup work.","status":"quote","rates":{"oneOff":null},"unit":"migration scope","optional":true,"group":"operations"}]}};
(function(global,factory){
if(typeof module==='object'&&module.exports)module.exports=factory();
else global.TitanQuote=factory();
})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const own=(o,key)=>Object.prototype.hasOwnProperty.call(o,key);
const isObject=(o)=>o&&typeof o==='object'&&!Array.isArray(o);
const money=(cents)=>'A$'+new Intl.NumberFormat('en-AU',{
minimumFractionDigits:cents%100?2:0,maximumFractionDigits:2
}).format(cents/100);
function create(config){
const apps=config.apps,tiers=config.tiers,catalog=config.configurator;
if(!isObject(apps)||!Array.isArray(tiers)||!catalog)throw new Error('Missing pricing configuration.');
const products=Object.fromEntries(catalog.products.map(p=>[p.id,p]));
const optional=catalog.products.filter(p=>p.optional).map(p=>p.id);
const deploymentIds=catalog.deployments.map(x=>x.id);
const intelligenceIds=catalog.intelligence.map(x=>x.id);
const locationIds=['on-premises','customer-cloud','mixed'];
const defaults=()=>({version:1,apps:{desk:0},intelligence:'existing',deployment:'current',
sovereignLocation:'on-premises',federation:false,nodes:1,locations:1,models:1,
knowledgeSources:1,setup:'self',addons:[],publicFallback:false});
function normalize(input){
if(!isObject(input))throw new Error('Invalid setup configuration.');
if(input.version!==undefined&&input.version!==1)throw new Error('Unsupported configuration version.');
const d=defaults();
const readEnum=(key,choices)=>{
const value=own(input,key)?input[key]:d[key];
if(!choices.includes(value))throw new Error('Invalid '+key+' option.');
return value;
};
const integer=(key,max)=>{
const raw=own(input,key)?input[key]:d[key];
const value=typeof raw==='number'?raw:(typeof raw==='string'&&/^\d+$/.test(raw)?Number(raw):NaN);
if(!Number.isSafeInteger(value)||value<1||value>max)throw new Error(`${key} must be a whole number from 1 to ${max}.`);
return value;
};
const boolean=(key)=>{
if(own(input,key)&&typeof input[key]!=='boolean')throw new Error('Invalid '+key+' selection.');
return own(input,key)?input[key]:d[key];
};
const selected=own(input,'apps')?input.apps:d.apps;
if(!isObject(selected)||Object.keys(selected).length>4)throw new Error('Invalid app selection.');
const selectedApps={};
for(const key of Object.keys(apps)){
if(!own(selected,key))continue;
const index=selected[key];
if(!Number.isInteger(index)||index<0||!tiers[index])throw new Error('Invalid operating level.');
selectedApps[key]=index;
}
if(Object.keys(selected).some(key=>!own(apps,key)))throw new Error('Unknown app.');
const list=own(input,'addons')?input.addons:[];
if(!Array.isArray(list)||list.length>30||list.some(id=>!optional.includes(id)))throw new Error('Unknown add-on.');
const s={version:1,apps:selectedApps,intelligence:readEnum('intelligence',intelligenceIds),
deployment:readEnum('deployment',deploymentIds),sovereignLocation:readEnum('sovereignLocation',locationIds),
federation:boolean('federation'),nodes:integer('nodes',catalog.limits.nodes),
locations:integer('locations',catalog.limits.locations),models:integer('models',catalog.limits.models),
knowledgeSources:integer('knowledgeSources',catalog.limits.knowledgeSources),
setup:readEnum('setup',['self','full']),addons:[...new Set(list)].sort(),publicFallback:boolean('publicFallback')};
if(s.intelligence==='industry-pro')s.addons=s.addons.filter(id=>id!=='private-rag');
if(s.deployment==='sovereign'){s.publicFallback=false;s.setup='full';}
if(s.federation)s.publicFallback=false;
if(s.federation&&s.deployment==='current')throw new Error('Choose a private deployment before adding the federated Git network.');
if(s.federation&&s.nodes<2)throw new Error('The federated Git network needs at least two approved nodes.');
if(s.locations>s.nodes)throw new Error('Business locations cannot exceed the total approved nodes.');
return s;
}
function calculate(input){
const state=normalize(input),lines=[];
let monthlyCents=0,oneOffCents=0;
for(const[key,index]of Object.entries(state.apps)){
const cents=Math.round(apps[key].prices[index]*100);
if(!Number.isSafeInteger(cents)||cents<0)throw new Error('Invalid catalogue app price.');
lines.push({id:'app-'+key,name:'Titan '+apps[key].name+' — '+tiers[index].name,period:'monthly',amount:cents,quantity:1,unit:'app'});
}
function add(id){
const p=products[id];
if(!p)throw new Error('Unknown catalogue product.');
const quantity=p.quantityKey?state[p.quantityKey]:1;
for(const period of Object.keys(p.rates)){
if(!['monthly','oneOff'].includes(period))throw new Error('Invalid catalogue billing period.');
const rate=p.rates[period];
const priced=p.status==='confirmed'&&Number.isSafeInteger(rate)&&rate>=0;
const amount=priced?rate*quantity:null;
if(amount!==null&&!Number.isSafeInteger(amount))throw new Error('Catalogue price is out of range.');
lines.push({id,name:p.name,period,amount,quantity,unit:p.unit});
}
}
if(state.intelligence!=='existing')add(state.intelligence);
if(['private-cloud','sovereign'].includes(state.deployment))add(state.deployment);
if(state.federation)add('federation');
if(state.setup==='full'&&state.deployment!=='sovereign')add('node-setup');
state.addons.forEach(add);
for(const line of lines){
if(line.amount===null)continue;
if(line.period==='monthly')monthlyCents+=line.amount;else oneOffCents+=line.amount;
}
const quoteLines=lines.filter(line=>line.amount===null);
return{state,lines,quoteLines,monthlyCents,oneOffCents,yearCents:monthlyCents*12+oneOffCents,
monthlyPending:quoteLines.filter(l=>l.period==='monthly').length,
setupPending:quoteLines.filter(l=>l.period==='oneOff').length,complete:quoteLines.length===0};
}
function rateLabel(id){
const p=products[id];
if(!p)throw new Error('Unknown catalogue product.');
const periods=Object.keys(p.rates);
const known=periods.some(period=>p.status==='confirmed'&&Number.isSafeInteger(p.rates[period])&&p.rates[period]>=0);
if(!known)return'Quote required · '+(periods.length===2?'monthly & setup':periods[0]==='monthly'?'monthly':'one-off');
return periods.map(period=>{
const amount=p.rates[period];
const valid=p.status==='confirmed'&&Number.isSafeInteger(amount)&&amount>=0;
return(valid?money(amount)+(p.quantityKey?' per '+p.unit:''):'Quote required')+(period==='monthly'?' / month':' setup');
}).join(' · ');
}
function describe(input){
const r=calculate(input),s=r.state;
const label=(array,id)=>array.find(o=>o.id===id).name;
const rows=['TITAN BOS — BUILD YOUR SETUP','Planning estimate, not an order or binding quote.',
'Catalogue: '+catalog.catalogueRevision,'Currency: AUD. Before usage and applicable taxes.','',
'Core: Titan Zero Core — free','Intelligence: '+(s.deployment==='sovereign'&&s.intelligence==='existing'?'Existing private/local model (Sovereign suitability to confirm)':label(catalog.intelligence,s.intelligence)),
'Deployment: '+label(catalog.deployments,s.deployment)];
if(s.intelligence!=='existing')rows.push('Models / variants to configure: '+s.models);
if(s.intelligence==='industry-pro'||s.addons.includes('private-rag'))rows.push('Approved knowledge sources to scope: '+s.knowledgeSources+' (sizing input, not a per-file price)');
if(s.deployment!=='current'||s.federation||s.setup==='full')rows.push('Node scope: '+s.nodes+' total approved nodes (including the main node); '+s.locations+' business locations');
if(s.deployment==='sovereign')rows.push('Sovereign location: '+({'on-premises':'Business premises','customer-cloud':'Customer-controlled private cloud',mixed:'Mixed approved business locations'}[s.sovereignLocation]),
'Sovereign boundary requested: business controls data, private knowledge, keys and approved nodes. Public AI fallback is OFF.',
'Ownership/handover of bespoke model work is agreed in scope; third-party base-model licences still apply.',
'Full business-node deployment and setup included in the Sovereign scope; not added twice.');
else rows.push('Public AI provider fallback requested: '+(s.publicFallback?'Only with explicit business approval':'Off'),
'Setup: '+(s.setup==='full'?'Full business-node deployment & setup':'Self-managed / existing setup; no new setup service selected'));
rows.push('Managed operations: separate from software pricing; Titan Managed Operations administration, growth or broader business operations are scoped and quoted independently. ');
rows.push('Network: '+(s.federation?'Titan Sovereign Federated Git Network — private Git federation across approved Titan Nodes for versioned configuration, AI policies, workflows, knowledge definitions and deployment manifests. Live databases, secrets, vector stores and model weights stay in their appropriate private layers.':'No federated Git network selected.'));
if(s.intelligence==='industry-pro')rows.push('Embedded RAG/business knowledge included in the Industry Pro scope; not added twice.');
for(const period of['monthly','oneOff']){
rows.push('',period==='monthly'?'MONTHLY SERVICES':'ONE-OFF SETUP & SERVICES');
const items=r.lines.filter(l=>l.period===period);
if(!items.length)rows.push('No additional '+(period==='monthly'?'paid monthly':'one-off')+' services selected.');
items.forEach(l=>rows.push('- '+l.name+(l.quantity>1?' × '+l.quantity+' '+l.unit+'s':'')+': '+(l.amount===null?'Quote required':money(l.amount)+(period==='monthly'?' / month':''))));
}
rows.push('','Known monthly subtotal: '+money(r.monthlyCents)+' / month'+(r.monthlyPending?' + quoted monthly services':''),
'One-off known subtotal: '+(r.oneOffCents?money(r.oneOffCents):r.setupPending?'Quote required':'No one-off services selected')+(r.oneOffCents&&r.setupPending?' + quoted setup':''),
'12-month known cost: '+money(r.yearCents)+' (12 × known monthly + known one-off; no annual discount assumed)',
'Unpriced service components: '+r.quoteLines.length+'. These are excluded, not free.',
'Excluded: model/API usage, cloud compute, hardware, network connectivity, electricity, third-party provider charges and applicable taxes.',
'Sovereign-compatible voice, vision, integrations and backups must be confirmed during scoping. No cloud egress is authorised by this calculator.',
'Deployment, licensing, allowances, support and availability must be confirmed before purchase. Nothing is provisioned or sent by this website.');
return rows.join('\n');
}
function encode(input){return JSON.stringify(normalize(input));}
function decode(text){
if(typeof text!=='string'||text.length>12000)throw new Error('Shared setup is too large or invalid.');
let data;try{data=JSON.parse(text);}catch(_){throw new Error('Shared setup could not be read.');}
return normalize(data);
}
return{catalog,defaults,normalize,calculate,describe,encode,decode,money,rateLabel};
}
return{create,money};
});
(()=>{
'use strict';
const config=window.TITAN_BOS_DATA;
if(!config?.configurator||!window.TitanQuote)return;
const engine=window.TitanQuote.create(config);
window.TITAN_QUOTE_ENGINE=engine;
const form=document.querySelector('[data-estimator]');
if(!form)return;
const $=(s)=>form.querySelector(s);
const $$=(s)=>[...form.querySelectorAll(s)];
const control=(name)=>form.elements.namedItem(name);
const base=new URL(document.baseURI);
const root=new URL(document.body.dataset.siteRoot||'index.html',base);
const query=new URLSearchParams(base.search);
const appBoxes=$$('[name="selected-app"]');
const addonBoxes=$$('[name="addon"]');
const submitLink=$('[data-estimate-enquire]');
const actionButtons=$$('[data-quote-download],[data-quote-share],[data-quote-copy]');
let current=null;
let lastAnnouncement='';
function apply(input){
const state=engine.normalize(input);
appBoxes.forEach(box=>{
box.checked=Object.prototype.hasOwnProperty.call(state.apps,box.value);
$(`[data-estimate-tier="${box.value}"]`).value=String(state.apps[box.value]??0);
});
['intelligence','deployment','sovereignLocation','nodes','locations','models','knowledgeSources','setup'].forEach(name=>{control(name).value=String(state[name]);});
['federation','publicFallback'].forEach(name=>{control(name).checked=state[name];});
addonBoxes.forEach(box=>{box.checked=state.addons.includes(box.value);});
}
function syncOptions(event){
const sovereign=control('deployment').value==='sovereign';
const pro=control('intelligence').value==='industry-pro';
const model=control('intelligence').value!=='existing';
const closedNetwork=control('federation').checked;
const existingOption=control('intelligence').querySelector('option[value=existing]');
existingOption.textContent=sovereign?'Use my existing private/local model':'Use my existing AI connection';
const rag=$('#addon-private-rag');
if(pro)rag.checked=false;
rag.disabled=pro;
$('[data-rag-price]').textContent=pro?'Included in Industry Pro · not added twice':engine.rateLabel('private-rag');
$('[data-industry-pro]').hidden=!pro;
$('[data-model-scope]').hidden=!model;
control('models').disabled=!model;
const knowledge=pro||rag.checked;
$('[data-knowledge-scope]').hidden=!knowledge;
control('knowledgeSources').disabled=!knowledge;
$('[data-sovereign-detail]').hidden=!sovereign;
control('sovereignLocation').disabled=!sovereign;
$('[data-sovereign-boundary]').hidden=!sovereign;
control('publicFallback').disabled=sovereign||closedNetwork;
if(closedNetwork)control('publicFallback').checked=false;
if(sovereign){control('publicFallback').checked=false;control('setup').value='full';}
control('setup').disabled=sovereign;
$('[data-fallback-note]').textContent=(sovereign||closedNetwork)?'Unavailable in Sovereign Mode or a closed federated Git network. The requested setup has no public AI fallback.':'Off by default. Provider charges and data-sharing rules require explicit agreement.';
$('[data-setup-note]').textContent=sovereign?'Full business-node deployment, setup and handover are included in the Sovereign scope. There is no duplicate node-setup line.':'Choose assisted installation, model and knowledge configuration, node enrolment and handover when you need it. One-off setup is separate from ongoing services.';
const network=control('federation').checked;
if(event?.target===control('federation')&&network&&Number(control('nodes').value)===1){
control('nodes').value='2';
$('[data-quote-feedback]').textContent='The private network needs at least two nodes. The total node count is now 2.';
}
const showNodes=control('deployment').value!=='current'||network||control('setup').value==='full';
$('[data-node-scope]').hidden=!showNodes;
control('nodes').disabled=!showNodes;control('locations').disabled=!showNodes;
control('nodes').min=network?'2':'1';
$('[data-network-detail]').hidden=!network;
$('[data-intelligence-description]').textContent=(sovereign&&control('intelligence').value==='existing')?'Reuse an existing private/local model within the agreed business boundary. A public provider endpoint is not a Sovereign deployment.':config.configurator.intelligence.find(x=>x.id===control('intelligence').value).description;
$('[data-deployment-description]').textContent=config.configurator.deployments.find(x=>x.id===control('deployment').value).description;
appBoxes.forEach(box=>{$(`[data-estimate-tier="${box.value}"]`).disabled=!box.checked;});
}
function collect(){
const state=engine.defaults();state.apps={};
appBoxes.filter(b=>b.checked).forEach(box=>{state.apps[box.value]=Number($(`[data-estimate-tier="${box.value}"]`).value);});
['intelligence','deployment','sovereignLocation','setup'].forEach(name=>{state[name]=control(name).value;});
['nodes','locations','models','knowledgeSources'].forEach(name=>{state[name]=control(name).disabled?1:control(name).value;});
state.federation=control('federation').checked;state.publicFallback=control('publicFallback').checked;
state.addons=addonBoxes.filter(b=>b.checked&&!b.disabled).map(b=>b.value);
return state;
}
function listLines(target,lines){
const nodes=lines.map(line=>{
const li=document.createElement('li');
const name=document.createElement('span');
name.textContent=line.name+(line.quantity>1?' × '+line.quantity:'');
const price=document.createElement('strong');
price.textContent=line.amount===null?'Quote required':engine.money(line.amount);
if(line.amount===null)price.classList.add('quote-needed');
li.append(name,price);return li;
});
if(!nodes.length){const li=document.createElement('li');li.textContent='No paid services selected.';nodes.push(li);}
target.replaceChildren(...nodes);
}
function clearCopy(){
$('[data-quote-copy-fallback]').hidden=true;$('[data-quote-copy-text]').value='';
}
function update(event){
if(event?.target===$('[data-quote-copy-text]'))return;
clearCopy();
if(event){$('[data-quote-feedback]').textContent='';$('[data-quote-import]').hidden=true;}
syncOptions(event);
let quote;
try{quote=engine.calculate(collect());}
catch(error){
current=null;
document.querySelector('[data-quote-mobile-status]').textContent='Configuration needs attention';
$('[data-quote-error]').hidden=false;$('[data-quote-error]').textContent=error.message;
form.classList.add('quote-invalid');
submitLink.removeAttribute('href');submitLink.setAttribute('aria-disabled','true');submitLink.tabIndex=-1;
actionButtons.forEach(button=>{button.disabled=true;});
$('[data-quote-feedback]').textContent='Finish the configuration before saving or requesting a quote. The amounts shown are from your last valid selection. '+error.message;
$$('input[type="number"]').forEach(input=>{input.setAttribute('aria-invalid',String(!input.disabled&&!input.validity.valid));});
return;
}
current=quote;
$('[data-quote-error]').hidden=true;form.classList.remove('quote-invalid');
submitLink.removeAttribute('aria-disabled');submitLink.tabIndex=0;
actionButtons.forEach(button=>{button.disabled=false;});
$$('input[type="number"]').forEach(input=>input.removeAttribute('aria-invalid'));
const s=quote.state;
$('[data-estimate-total]').textContent=engine.money(quote.monthlyCents);
$('[data-quote-setup-total]').textContent=quote.oneOffCents?engine.money(quote.oneOffCents)+(quote.setupPending?' + quote':''):quote.setupPending?'Quote required':'None selected';
$('[data-quote-year]').textContent=engine.money(quote.yearCents)+(quote.quoteLines.length?' + quoted services':'');
const pending=$('[data-quote-pending]');pending.hidden=!quote.quoteLines.length;
if(!pending.hidden){const count=new Set(quote.quoteLines.map(l=>l.id)).size;pending.textContent=`${count} selected ${count===1?'service needs':'services need'} a scoped quote. Known totals exclude those charges—they are not free.`;}
listLines($('[data-quote-monthly-lines]'),quote.lines.filter(l=>l.period==='monthly'));
const setupLines=quote.lines.filter(l=>l.period==='oneOff');
$('[data-quote-setup-section]').hidden=!setupLines.length;listLines($('[data-quote-setup-lines]'),setupLines);
const count=Object.keys(s.apps).length;
$('[data-estimate-note]').textContent=count?`${count} ${count===1?'app':'apps'} selected. The core remains free.`:'No paid apps selected. The core is free; any selected custom services still require a quote.';
appBoxes.forEach(box=>{const i=s.apps[box.value];$(`[data-app-row-price="${box.value}"]`).textContent=i===undefined?'Not selected':engine.money(Math.round(config.apps[box.value].prices[i]*100))+' / month';});
const target=new URL('support/index.html',root);
target.searchParams.set('setup',engine.encode(s));
const selections=Object.entries(s.apps).map(([key,index])=>key+':'+config.tiers[index].slug);
if(selections.length)target.searchParams.set('apps',selections.join(','));else target.searchParams.set('app','bos');
submitLink.href=target.href;
document.querySelector('[data-quote-mobile-total]').textContent=engine.money(quote.monthlyCents)+' / month';
document.querySelector('[data-quote-mobile-status]').textContent=quote.quoteLines.length?'Plus services to quote':'Known app subtotal';
const announcement=`Known monthly subtotal ${engine.money(quote.monthlyCents)}. ${quote.quoteLines.length} cost components require a quote.`;
if(announcement!==lastAnnouncement){$('[data-quote-announcement]').textContent=announcement;lastAnnouncement=announcement;}
}
function fallback(text,message){
const box=$('[data-quote-copy-text]');$('[data-quote-copy-fallback]').hidden=false;
box.value=text;box.focus();box.select();$('[data-quote-feedback]').textContent=message;
}
async function copy(text,success){
try{
if(!navigator.clipboard||!window.isSecureContext)throw new Error('Clipboard is unavailable');
await navigator.clipboard.writeText(text);$('[data-quote-feedback]').textContent=success;
}catch(_){fallback(text,'Automatic copying is unavailable. Select and copy the text below.');}
}
function downloadSummary(){
if(!current)return;
try{
const blob=new Blob([engine.describe(current.state)],{type:'text/plain;charset=utf-8'});
const href=URL.createObjectURL(blob),a=document.createElement('a');
a.href=href;a.download='Titan-BOS-Setup-Breakdown.txt';document.body.append(a);a.click();a.remove();
setTimeout(()=>URL.revokeObjectURL(href),10000);
$('[data-quote-feedback]').textContent='Your itemised breakdown is ready to save. No information was sent.';
}catch(_){fallback(engine.describe(current.state),'Saving is unavailable here. Copy the breakdown below instead.');}
}
$('[data-quote-download]').addEventListener('click',downloadSummary);
$('[data-quote-copy]').addEventListener('click',()=>{if(current)copy(engine.describe(current.state),'Itemised setup copied. No information was sent.');});
$('[data-quote-share]').addEventListener('click',()=>{
if(!current)return;
if(!['https:','http:'].includes(base.protocol)){$('[data-quote-feedback]').textContent='This is a local preview. Save the breakdown instead; shareable links work from the hosted website.';return;}
const link=new URL('pricing/index.html',root);link.searchParams.set('setup',engine.encode(current.state));link.hash='calculator';
copy(link.href,'Setup link copied. It contains these choices, not personal details or a locked-in price.');
});
$('[data-quote-reset]').addEventListener('click',()=>{
apply(engine.defaults());update();$('[data-quote-import]').hidden=true;
$('[data-quote-feedback]').textContent='Reset to SuperchargedAt.Work. No add-ons selected.';
$('#quote-check-desk').focus();
});
submitLink.addEventListener('click',event=>{if(!current){event.preventDefault();$('[data-quote-error]').scrollIntoView({block:'center'});}});
form.addEventListener('input',event=>{if(event.target.matches('input[type=number]'))update(event);});form.addEventListener('change',update);
form.addEventListener('submit',event=>event.preventDefault());
let initial=engine.defaults();
if(query.has('setup')){
try{initial=engine.decode(query.get('setup'));$('[data-quote-import]').textContent='Your shared configuration is loaded. All prices have been recalculated from this site’s current catalogue.';}
catch(_){$('[data-quote-import]').textContent='That shared setup is invalid or unsupported. The calculator has loaded its default selection; no untrusted values were applied.';}
$('[data-quote-import]').hidden=false;
}else if(query.get('addon')==='voice'){
initial.apps={desk:0};initial.addons=['voice'];
}else if(query.get('deployment')==='sovereign'){
initial={...engine.defaults(),apps:{},deployment:'sovereign',setup:'full'};
}else if(query.has('apps')){
const chosen={};(query.get('apps')||'').split(',').slice(0,4).forEach(item=>{
const[id,slug]=item.split(':'),index=config.tiers.findIndex(t=>t.slug===slug);
if(Object.prototype.hasOwnProperty.call(config.apps,id)&&index>=0)chosen[id]=index;
});if(Object.keys(chosen).length)initial.apps=chosen;
}else if(Object.prototype.hasOwnProperty.call(config.apps,query.get('app'))){
const index=config.tiers.findIndex(t=>t.slug===query.get('level'));initial.apps={[query.get('app')]:index<0?0:index};
}else if(query.get('app')==='bos')initial.apps={};
$$('[data-addon-rate]').forEach(el=>{el.textContent=engine.rateLabel(el.dataset.addonRate);});
apply(initial);update();
const mobileBar=document.querySelector('[data-quote-mobilebar]');
mobileBar.querySelector('a').addEventListener('click',event=>{
event.preventDefault();
const summary=$('.quote-summary');
summary.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
summary.focus({preventScroll:true});
});
if('IntersectionObserver'in window){
let formSeen=false,summarySeen=false;
const observer=new IntersectionObserver(entries=>{
entries.forEach(entry=>{if(entry.target===form)formSeen=entry.isIntersecting;else summarySeen=entry.isIntersecting;});
mobileBar.hidden=!formSeen||summarySeen;
},{rootMargin:'-110px 0px -20px 0px'});
observer.observe(form);observer.observe($('.quote-summary'));
}
})();
(()=>{
'use strict';
const config=window.TITAN_BOS_DATA;
if(!config||!config.apps||!Array.isArray(config.tiers))return;
const apps=config.apps;
const tiers=config.tiers;
const documentUrl=new URL(document.baseURI);
const root=new URL(document.body.dataset.siteRoot||'index.html',documentUrl);
const pageUrl=(path)=>new URL(path,root).href;
const hasApp=(value)=>Object.prototype.hasOwnProperty.call(apps,value);
const money=(value)=>'A$'+new Intl.NumberFormat('en-AU',{maximumFractionDigits:0}).format(value);
const query=new URLSearchParams(documentUrl.search);
// Compatibility defence: previously shared business-tool links embedded sensitive
// context in their query. Never consume, render, forward or submit that context.
// Replace the *current* browser-history entry to avoid continuing propagation.
// Previously generated HTTP logs/referrer entries cannot be erased client-side.
if(query.has('tool_context')){
query.delete('tool_context');
try{
const clean=new URL(documentUrl.href);clean.searchParams.delete('tool_context');
window.history.replaceState(window.history.state,'',clean.pathname+clean.search+clean.hash);
}catch(_){/* A restricted history API must never block normal pricing/support usage. */}
}
document.documentElement.classList.add('js');
document.querySelectorAll('[data-js-control]').forEach((element)=>{element.hidden=false;});
document.querySelectorAll('[data-current-year]').forEach((element)=>{
element.textContent=String(new Date().getFullYear());
});
const navToggle=document.querySelector('[data-nav-toggle]');
const navigation=document.getElementById('site-navigation');
const disclosures=[...document.querySelectorAll('.nav-disclosure')];
const closeNavigation=(returnFocus=false)=>{
if(!navToggle||!navigation)return;
const wasOpen=navToggle.getAttribute('aria-expanded')==='true';
navigation.classList.remove('is-open');
navToggle.setAttribute('aria-expanded','false');
navToggle.setAttribute('aria-label','Open navigation');
disclosures.forEach((details)=>{details.open=false;});
if(returnFocus&&wasOpen)navToggle.focus();
};
navToggle?.addEventListener('click',()=>{
const open=navToggle.getAttribute('aria-expanded')!=='true';
navigation.classList.toggle('is-open',open);
navToggle.setAttribute('aria-expanded',String(open));
navToggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');
});
disclosures.forEach((details)=>{
details.addEventListener('toggle',()=>{
if(details.open)disclosures.forEach((other)=>{if(other!==details)other.open=false;});
});
});
document.addEventListener('click',(event)=>{
if(!event.target.closest('.site-header'))closeNavigation(false);
});
document.addEventListener('keydown',(event)=>{
if(event.key!=='Escape')return;
const active=disclosures.find((details)=>details.open&&details.contains(document.activeElement));
if(active){
active.open=false;
active.querySelector('summary').focus();
}else closeNavigation(true);
});
window.matchMedia('(min-width: 1121px)').addEventListener('change',(event)=>{
if(event.matches)closeNavigation(false);
});
navigation?.addEventListener('click',(event)=>{
if(event.target.closest('a'))closeNavigation(false);
});
document.querySelectorAll('[data-tabs]').forEach((widget)=>{
const tabs=[...widget.querySelectorAll('[role="tab"]')].filter((tab)=>tab.closest('[data-tabs]')===widget);
if(!tabs.length)return;
const panels=tabs.map((tab)=>document.getElementById(tab.getAttribute('aria-controls')));
if(panels.some((panel)=>!panel))return;
let selected=Math.max(0,tabs.findIndex((tab)=>tab.getAttribute('aria-selected')==='true'));
const previous=widget.querySelector('[data-walk-prev]');
const next=widget.querySelector('[data-walk-next]');
const status=widget.querySelector('[data-walk-status]');
function select(index,focus=false){
selected=(index+tabs.length)%tabs.length;
tabs.forEach((tab,i)=>{
const active=i===selected;
tab.setAttribute('aria-selected',String(active));
tab.tabIndex=active?0:-1;
panels[i].hidden=!active;
});
if(previous)previous.disabled=selected===0;
if(next)next.firstChild.textContent=selected===tabs.length-1?'Start again ':'Next step ';
if(status)status.textContent=`Step ${selected + 1} of ${tabs.length}`;
if(focus)tabs[selected].focus();
}
tabs.forEach((tab,index)=>{
tab.addEventListener('click',()=>select(index));
tab.addEventListener('keydown',(event)=>{
const actions={ArrowRight:selected+1,ArrowDown:selected+1,
ArrowLeft:selected-1,ArrowUp:selected-1,Home:0,End:tabs.length-1};
if(!Object.prototype.hasOwnProperty.call(actions,event.key))return;
event.preventDefault();
select(actions[event.key],true);
});
});
previous?.addEventListener('click',()=>select(Math.max(0,selected-1)));
next?.addEventListener('click',()=>select(selected+1));
select(selected);
});
const priceSelector=document.querySelector('[data-pricing-app]');
if(priceSelector){
if(hasApp(query.get('app')))priceSelector.value=query.get('app');
const updatePrices=()=>{
const key=priceSelector.value;
if(!hasApp(key))return;
document.querySelector('[data-pricing-title]').textContent='Titan '+apps[key].name;
document.querySelectorAll('[data-price-tier]').forEach((card)=>{
const index=Number(card.dataset.priceTier);
if(!Number.isInteger(index)||!tiers[index])return;
card.querySelector('[data-price-value]').textContent=money(apps[key].prices[index]);
const target=new URL(pageUrl('support/index.html'));
target.searchParams.set('app',key);
target.searchParams.set('level',tiers[index].slug);
card.querySelector('[data-plan-link]').href=target.href;
});
};
priceSelector.addEventListener('change',updatePrices);
updatePrices();
}
const enquiry=document.querySelector('[data-enquiry-form]');
if(enquiry){
const appSelect=enquiry.querySelector('[name="app"]');
const levelSelect=enquiry.querySelector('[name="level"]');
const context=[];
let calculatorState=null;
if(query.has('setup')&&window.TITAN_QUOTE_ENGINE){
try{
const engine=window.TITAN_QUOTE_ENGINE;
calculatorState=engine.decode(query.get('setup'));
const fullSummary=engine.describe(calculatorState);
context.push(fullSummary);
enquiry.querySelector('[data-quote-review-text]').textContent=fullSummary;
enquiry.querySelector('[data-quote-review]').hidden=false;
const edit=new URL(pageUrl('pricing/index.html'));
edit.searchParams.set('setup',engine.encode(calculatorState));edit.hash='calculator';
enquiry.querySelector('[data-quote-edit]').href=edit.href;
levelSelect.closest('label').hidden=true;
}catch(_){
const warning=enquiry.querySelector('[data-quote-review-warning]');
warning.hidden=false;
warning.textContent='The supplied calculator setup is invalid or unsupported. No custom setup was imported; describe your requirements below.';
}
}
if(hasApp(query.get('app')))appSelect.value=query.get('app');
if(tiers.some((tier)=>tier.slug===query.get('level')))levelSelect.value=query.get('level');
const industry=query.get('industry');
if(config.industries.includes(industry))context.push('Industry: '+industry);
const requested=(query.get('apps')||'').split(',').slice(0,4);
const validSelections=[];
const seen=new Set();
requested.forEach((item)=>{
const[key,level]=item.split(':');
const tier=tiers.find((t)=>t.slug===level);
if(hasApp(key)&&tier&&!seen.has(key)){
seen.add(key);validSelections.push(`Titan ${apps[key].name} — ${tier.name}`);
}
});
if(validSelections.length&&!calculatorState)context.push('Requested setup: '+validSelections.join('; '));
const contextElement=enquiry.querySelector('[data-enquiry-context]');
if(context.length&&!calculatorState){
contextElement.hidden=false;
contextElement.textContent=context.join('\n');
}
if(calculatorState){
const labels=Object.entries(calculatorState.apps).map(([key,index])=>`Titan ${apps[key].name} — ${tiers[index].name}`);
contextElement.hidden=false;
contextElement.textContent=labels.length?'Requested setup: '+labels.join('; '):'Free core plus any custom services shown in your calculator selection.';
}
const status=enquiry.querySelector('[data-enquiry-status]');
const result=enquiry.querySelector('[data-enquiry-result]');
const draftBox=enquiry.querySelector('[data-enquiry-draft]');
const clearDraft=()=>{
result.hidden=true;
draftBox.value='';
enquiry.querySelector('[data-email-link]').href='mailto:support@titanzero.io';
};
enquiry.addEventListener('input',(event)=>{
if(event.target===draftBox)return;
if(typeof event.target.setCustomValidity==='function')event.target.setCustomValidity('');
clearDraft();
});
enquiry.addEventListener('change',clearDraft);
function prepare(){
['name','message'].forEach((name)=>{
const field=enquiry.elements.namedItem(name);
field.setCustomValidity(field.value.trim()?'':'Please enter more than spaces.');
});
if(!enquiry.reportValidity())return null;
const get=(name,limit)=>String(new FormData(enquiry).get(name)||'').trim().slice(0,limit);
const topic=appSelect.selectedOptions[0].textContent;
const level=levelSelect.selectedOptions[0].textContent;
const body=[
'Hello Titan Zero,','','I would like to discuss '+topic+'.','',
'Name: '+get('name',100),'Business: '+(get('business',160)||'Not specified'),
'Reply email: '+get('email',200),...(calculatorState?[]:['Operating level: '+level]),
...context,'','What I would like to improve:',get('message',2000),'','Thank you.'
].join('\n');
const subject='Titan BOS enquiry — '+topic;
draftBox.value='Subject: '+subject+'\n\n'+body;
enquiry.querySelector('[data-email-link]').href='mailto:support@titanzero.io?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
result.hidden=false;
status.textContent='Your draft is ready. Open your email app, review the message and send it. Nothing has been sent by this website.';
return draftBox.value;
}
enquiry.addEventListener('submit',(event)=>{
event.preventDefault();
prepare();
});
enquiry.querySelector('[data-copy-enquiry]')?.addEventListener('click',async()=>{
const draft=prepare();
if(!draft)return;
try{
if(!navigator.clipboard||!window.isSecureContext)throw new Error('Clipboard is unavailable');
await navigator.clipboard.writeText(draft);
status.textContent='Enquiry copied. Paste it into your email app and send it to support@titanzero.io. Nothing has been sent by this website.';
}catch(_){
const details=draftBox.closest('details');
if(details)details.open=true;
draftBox.focus();draftBox.select();
status.textContent='Automatic copying is unavailable here. Your draft is selected below; copy it using your device, or open the email app link.';
}
});
}
})();
(()=>{
const root=document.querySelector('[data-optimiser-app]');if(!root)return;
const form=root.querySelector('[data-opt-form]'),steps=[...root.querySelectorAll('[data-opt-step]')];
const prev=root.querySelector('[data-opt-prev]'),next=root.querySelector('[data-opt-next]'),submit=root.querySelector('[data-opt-submit]');
const report=root.querySelector('[data-opt-report]'),progress=root.querySelector('[data-opt-progress]'),bar=root.querySelector('[data-opt-bar]');
let step=0;const clamp=n=>Math.max(0,Math.min(100,Math.round(n)));
function show(){steps.forEach((x,i)=>x.hidden=i!==step);prev.hidden=step===0;next.hidden=step===steps.length-1;submit.hidden=step!==steps.length-1;progress.textContent=`Step ${step+1} of ${steps.length}`;bar.value=step+1;steps[step].querySelector('h2')?.focus?.()}
prev.addEventListener('click',()=>{step=Math.max(0,step-1);show()});next.addEventListener('click',()=>{step=Math.min(steps.length-1,step+1);show()});
form.addEventListener('submit',e=>{
e.preventDefault();const fd=new FormData(form),deps=fd.getAll('dependency'),priorities=fd.getAll('priority');
const ownerHours=Math.max(0,Number(fd.get('ownerHours'))||0),repeat=Math.max(0,Number(fd.get('repeatHours'))||0);
const process=Number(fd.get('process'))||0,data=Number(fd.get('data'))||0,response=Number(fd.get('response'))||0;
const ownerDependency=clamp(deps.length*9+Math.min(28,ownerHours*1.5));
const readiness=clamp(30+process*12+data*10+Math.min(20,repeat/2)-(deps.length>6?8:0));
const health=clamp(82-deps.length*4-Math.min(18,ownerHours)+process*5+data*4+response*5);
const findings=[];
if(ownerDependency>=55)findings.push(['Owner dependency','Several recurring workflows still rely directly on the owner.',`You selected ${deps.length} owner-dependent workflows and ${ownerHours} owner coordination hours/week.`,'Document one high-frequency workflow this week and define who can handle it without you.','Use a repeatable checklist for one high-frequency hand-off, then review the relevant app only if it solves that workflow.']);
if(repeat>=20)findings.push(['Repetitive administration',`${repeat} hours/month of repetitive admin is material enough to examine.`,`This comes directly from your stated ${repeat} hours/month.`,'List the top five repeated tasks and remove, template or rules-automate the simplest ones first.','Check the admin-cost estimate, then compare a suitable Titan app only if the economics support it.']);
if(response<2)findings.push(['Customer response','Delayed or missed enquiries deserve a response-process review.',`You described missed/delayed enquiries as ${response===0?'often':'sometimes'}.`,'Set one response owner, callback window and escalation rule before buying anything.','Measure missed enquiries first. SuperchargedAt.Work is an existing app; optional Titan Voice is scoped through pricing.']);
if(priorities.includes('privacy'))findings.push(['Privacy & ownership','You prioritised control of business data and AI infrastructure.','This recommendation is preference-driven, not a claim that public cloud is unsuitable.','Document what data/models must stay under business control and what can use external providers.','Review Titan Sovereign Mode and the federated Git scope only after the business boundary is defined.']);
if(!findings.length)findings.push(['No dominant red flag','Your answers do not expose one obvious operational constraint.','The assessment has limited inputs and should not manufacture a problem.','Run the individual calculators for the areas you care about most.','Titan may not be necessary yet; use the free tools first.']);
const linkMap={
'Owner dependency':[['Open checklist generator','/tools/checklist-generator/'],['SuperchargedAt.Work','/apps/desk/'],['SortedAt.Work','/apps/field/']],
'Repetitive administration':[['Admin cost calculator','/tools/admin-cost/'],['Titan pricing planner','/pricing/#calculator']],
'Customer response':[['Missed enquiry calculator','/tools/missed-calls/'],['SuperchargedAt.Work','/apps/desk/'],['Scope Titan Voice','/pricing/?app=desk&addon=voice#calculator']],
'Privacy & ownership':[['Review Titan Sovereign Mode','/pricing/?deployment=sovereign#calculator']],
'No dominant red flag':[['Browse free calculators','/tools/'],['Read practical guides','/resources/']]
};
const linksFor=title=>(linkMap[title]||[['Browse free calculators','/tools/']]).map(([label,url])=>`<a class="text-link" href="${pageUrl(url.replace(/^\/+/,''))}">${label}</a>`).join(' ');
const cards=findings.slice(0,3).map((f,i)=>`<article class="finding-card"><p class="eyebrow">Priority ${i+1}</p><h3>${f[0]}</h3><p>${f[1]}</p><p class="evidence-note"><strong>Why this appeared:</strong> ${f[2]}</p><div><strong>Free/process action</strong><p>${f[3]}</p></div><div><strong>Optional next step</strong><p>${f[4]}</p>${linksFor(f[0])}</div></article>`).join('');
report.innerHTML=`<div class="section-heading"><p class="eyebrow">Your business report</p><h2>Useful signals, not a mystery score.</h2><p>Scores are directional summaries of the answers above. The evidence underneath matters more than the number.</p></div><div class="score-grid"><article class="score-card"><span>Business health</span><strong>${health}/100</strong><p>Higher means fewer obvious process/owner-dependency signals in this short assessment.</p></article><article class="score-card"><span>Owner dependency</span><strong>${ownerDependency}/100</strong><p>Higher means more recurring work currently depends on the owner.</p></article><article class="score-card"><span>Automation readiness</span><strong>${readiness}/100</strong><p>Higher means more structured data/processes and enough repetitive work to assess.</p></article></div><div class="finding-list">${cards}</div><div class="button-row"><a class="button" href="${pageUrl('tools/')}">Open free calculators</a><a class="button button-secondary" href="${pageUrl('pricing/#calculator')}">Optional: configure Titan</a></div>`;
report.hidden=false;form.hidden=true;root.querySelector('.optimiser-progress').hidden=true;report.scrollIntoView({block:'start'});
});show();
})();
