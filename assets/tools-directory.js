(()=>{
'use strict';
// Keyword filter for the tool directory. Every word typed must match the tool card.
const normalise=(value)=>String(value||'').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\s+/g,' ').trim();
const matches=(haystack,query)=>{const terms=normalise(query).split(' ').filter(Boolean);const text=normalise(haystack);return terms.every(term=>text.includes(term));};
const api={normalise,matches};
if(typeof window!=='undefined')window.TitanToolDirectory=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof document==='undefined')return;
const root=document.querySelector('[data-tool-directory]');
if(!root)return;
const input=root.querySelector('[data-tool-search]');
const status=root.querySelector('[data-tool-status]');
const empty=root.querySelector('[data-tool-empty]');
const items=[...root.querySelectorAll('[data-tool]')];
const sections=[...root.querySelectorAll('[data-tool-section]')];
if(!input||!status||!empty)return;
function apply(){
const query=input.value;
let shown=0;
for(const item of items){const ok=!query.trim()||matches(`${item.dataset.keywords||''} ${item.textContent}`,query);item.hidden=!ok;if(ok)shown++;}
for(const section of sections)section.hidden=![...section.querySelectorAll('[data-tool]')].some(item=>!item.hidden);
empty.hidden=shown>0;
status.textContent=query.trim()?`${shown} of ${items.length} tools match.`:`All ${items.length} tools shown.`;
}
input.addEventListener('input',apply);
input.form&&input.form.addEventListener('submit',(event)=>{event.preventDefault();apply();});
apply();
})();
