/* =========================================================================
   Caderno de Viagem — app offline de organização de viagens
   Dados: localStorage (texto)
   ========================================================================= */

/* ---------- utilidades ---------- */
const $ = (s,r=document)=>r.querySelector(s);
const uid = ()=> Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const esc = s => (s??'').toString().replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2200);}
function setHeaderH(){const h=$('header');if(h)document.documentElement.style.setProperty('--header-h',h.offsetHeight+'px');}
function lockScroll(on){document.body.style.overflow=on?'hidden':'';}
window.addEventListener('resize',setHeaderH);

const CURRENCIES = ['EUR','BRL','USD','GBP','CHF'];
function money(n,cur){
  const v = Number(n)||0;
  try{return new Intl.NumberFormat('pt-BR',{style:'currency',currency:cur||'EUR'}).format(v);}
  catch(e){return (cur||'EUR')+' '+v.toFixed(2);}
}
function fmtDate(iso){
  if(!iso) return '';
  const d = new Date(iso+'T00:00:00');
  if(isNaN(d)) return iso;
  return new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',month:'short'}).format(d).replace('.','');
}
function fmtDateFull(iso){
  if(!iso) return '';
  const d = new Date(iso+'T00:00:00');
  if(isNaN(d)) return iso;
  return new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(d);
}
function mapsSearch(q){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q);}
function mapsDir(a,b){return 'https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(a||'')+'&destination='+encodeURIComponent(b||'');}
function compareDateTime(date,time){
  if(!date) return null;
  const dt = new Date(`${date}T${time||'00:00'}`);
  return isNaN(dt) ? null : dt;
}
function isPastItem(kind,x){
  const now=new Date();
  if(kind==='acomodacoes'){
    const dt = compareDateTime(x.checkoutDate || x.checkinDate, x.checkoutTime || x.checkinTime || '23:59');
    return !!dt && dt < now;
  }
  if(kind==='deslocamentos'){
    const dt = compareDateTime(x.departDate, x.departTime || '00:00');
    return !!dt && dt < now;
  }
  if(kind==='atracoes'){
    const dt = compareDateTime(x.date, x.time || '23:59');
    return !!dt && dt < now;
  }
  return false;
}
function sortByRecency(kind,list){
  return list.slice().sort((a,b)=>{
    const ap=isPastItem(kind,a), bp=isPastItem(kind,b);
    if(ap!==bp) return ap ? 1 : -1;
    const ka = kind==='acomodacoes' ? `${a.checkoutDate || a.checkinDate || ''}|${a.checkoutTime || a.checkinTime || '23:59'}`
      : kind==='deslocamentos' ? `${a.departDate || ''}|${a.departTime || '00:00'}`
      : `${a.date || ''}|${a.time || '23:59'}`;
    const kb = kind==='acomodacoes' ? `${b.checkoutDate || b.checkinDate || ''}|${b.checkoutTime || b.checkinTime || '23:59'}`
      : kind==='deslocamentos' ? `${b.departDate || ''}|${b.departTime || '00:00'}`
      : `${b.date || ''}|${b.time || '23:59'}`;
    return ka.localeCompare(kb);
  });
}
function mapLinkFor(kind,x){
  if(kind==='deslocamentos'){
    if(x.from||x.to) return mapsDir(x.from,x.to);
    return '';
  }
  if(x.location) return mapsSearch(x.location);
  return '';
}

/* ---------- estado ---------- */
const LS='cadernoViagem.v1';
let state = load();
function load(){
  try{const s=JSON.parse(localStorage.getItem(LS));if(s&&s.trips)return s;}catch(e){}
  const t={id:uid(),name:'Minha viagem',currency:'EUR'};
  return {trips:[t],currentTripId:t.id,acomodacoes:[],deslocamentos:[],atracoes:[]};
}
function save(){localStorage.setItem(LS,JSON.stringify(state));}
function trip(){return state.trips.find(t=>t.id===state.currentTripId)||state.trips[0];}
function items(kind){return state[kind].filter(x=>x.tripId===state.currentTripId);}

let activeTab='acomodacoes';
const FONT_SCALE_KEY='cadernoViagem.fontScale';
let fontScale = Number(localStorage.getItem(FONT_SCALE_KEY)) || 1;
function applyFontScale(scale){
  fontScale = Number(scale) || 1;
  document.documentElement.style.setProperty('--font-scale', fontScale.toFixed(2));
  localStorage.setItem(FONT_SCALE_KEY, fontScale.toFixed(2));
}
applyFontScale(fontScale);

/* =========================================================================
   RENDER
   ========================================================================= */
function itemCost(kind,x){
  if(kind==='acomodacoes'){
    const guests=Math.max(1,Number(x.guests)||1);
    return (Number(x.cost)||0)/guests;
  }
  return Number(x.cost)||0;
}
function sectionTotal(kind){
  return items(kind).reduce((s,x)=>s+itemCost(kind,x),0);
}
function render(){
  $('#tripNameText').textContent = trip().name;
  const cur = trip().currency;
  const sum = ['acomodacoes','deslocamentos','atracoes'].reduce((a,k)=>a+sectionTotal(k),0);
  $('#tripTotal').innerHTML = 'total <b>'+esc(money(sum,cur))+'</b>';
  [...$('#tabs').children].forEach(b=>b.classList.toggle('active',b.dataset.tab===activeTab));
  const m=$('#main');
  if(activeTab==='acomodacoes') m.innerHTML=renderAcomodacoes();
  else if(activeTab==='deslocamentos') m.innerHTML=renderDeslocamentos();
  else if(activeTab==='resumo') m.innerHTML=renderResumo();
  else m.innerHTML=renderAtracoes();
}

function emptyState(icon,title,text){
  return `<div class="empty"><div class="mk">${icon}</div><h3>${title}</h3><p>${text}</p></div>`;
}
const ICO = {
  bed:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8v10M21 18V12a2 2 0 00-2-2H7a2 2 0 00-2 2M3 14h18"/><path d="M7 10V7a1 1 0 011-1h3a1 1 0 011 1v3"/></svg>`,
  route:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3 3 0 000-6H9a3 3 0 010-6h6.5"/></svg>`,
  pin:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>`,
  clip:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5l-8.4 8.4a5 5 0 01-7.1-7.1l8.5-8.5a3.3 3.3 0 014.7 4.7l-8.5 8.5a1.7 1.7 0 01-2.4-2.4l7.8-7.8"/></svg>`,
  map:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>`,
  ext:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>`
};

/* ---- Alojamento ---- */
function renderAcomodacoes(){
  const list=sortByRecency('acomodacoes', items('acomodacoes'));
  if(!list.length) return emptyState(ICO.bed,'Nenhum alojamento ainda',
    'Toque em + para registrar seu primeiro hotel ou Airbnb — com valores, check-in e confirmação.');
  const cur=trip().currency;
  return list.map(a=>{
    const plat=a.platform?`<span class="tag plat">${esc(a.platform)}</span>`:'';
    const guests=Math.max(1,Number(a.guests)||1);
    const share=itemCost('acomodacoes',a);
    const nights = a.checkinDate&&a.checkoutDate ?
      Math.max(1,Math.round((new Date(a.checkoutDate)-new Date(a.checkinDate))/864e5)) : null;
    const guestTag=guests>1?`<span class="tag">${guests} hóspede${guests>1?'s':''}</span>`:'';
    const isPast=isPastItem('acomodacoes',a)?' is-past':'';
    const location=a.location?`<a class="map-link" href="${mapLinkFor('acomodacoes',a)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${esc(a.location)}</a>`:'';
    const checkoutLine=a.checkoutDate?`<div class="sub">saída ${fmtDate(a.checkoutDate)}</div>`:'';
    return `<div class="row${isPast}" data-open="acomodacoes:${a.id}">
      <div class="gutter">${a.checkinDate?fmtDate(a.checkinDate):'—'}${nights?`<div class="sub">${nights} noite${nights>1?'s':''}</div>`:''}${checkoutLine}</div>
      <div class="body">
        <div class="title">${esc(a.name||'Sem nome')}</div>
        <div class="meta">
          ${plat}
          ${guestTag}
          ${location?`<span>${location}</span>`:''}
          ${a.checkinTime||a.checkoutTime?`<span class="mono">in ${esc(a.checkinTime||'—')} · out ${esc(a.checkoutTime||'—')}</span>`:''}
        </div>
      </div>
      <div class="price">${share?esc(money(share,cur)):''}${guests>1?`<div class="sub">por pessoa</div>`:''}</div>
    </div>`;
  }).join('');
}

/* ---- Deslocamentos ---- */
const TRANS_ICON={Voo:'✈',Trem:'🚆',Ônibus:'🚌',Ferry:'⛴',Carro:'🚗',Metrô:'🚇',Outro:'•'};
function travelDur(d){
  if(!d.departTime||!d.arriveTime)return '';
  const [dh,dm]=d.departTime.split(':').map(Number);
  const [ah,am]=d.arriveTime.split(':').map(Number);
  let mins=(ah*60+am)-(dh*60+dm);
  if(mins<=0)mins+=24*60;
  const h=Math.floor(mins/60),m=mins%60;
  return h?(m?`${h}h${String(m).padStart(2,'0')}`:`${h}h`):`${m}min`;
}
function renderDeslocamentos(){
  const list=sortByRecency('deslocamentos', items('deslocamentos'));
  if(!list.length) return emptyState(ICO.route,'Nenhum deslocamento ainda',
    'Voos, trens, ônibus ou ferries — registre partida, chegada, companhia e valor. Toque em +.');
  const cur=trip().currency;
  // agrupado por data
  const groups={};
  list.forEach(d=>{const k=d.departDate||'';(groups[k]=groups[k]||[]).push(d);});
  return Object.keys(groups).sort((a,b)=>(a||'~').localeCompare(b||'~')).map(date=>{
    const head=`<div class="daylabel">${date?fmtDateFull(date):'Sem data marcada'}</div>`;
    const rows=groups[date].map(d=>{
      const dur=travelDur(d);
      const isPast=isPastItem('deslocamentos',d)?' is-past':'';
      const routeHref=mapLinkFor('deslocamentos',d);
      const routeLabel=routeHref?`<a class="map-link" href="${routeHref}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${esc(d.from||'?')} → ${esc(d.to||'?')}</a>`:`${esc(d.from||'?')} → ${esc(d.to||'?')}`;
      return `<div class="row${isPast}" data-open="deslocamentos:${d.id}">
        <div class="gutter">${esc(d.departTime||'—')}${d.arriveTime?`<div class="sub">${esc(d.arriveTime)}</div>`:''}</div>
        <div class="body">
          <div class="title">${TRANS_ICON[d.type]||'•'}${dur?` <span class="dur-badge">${dur}</span>`:''} ${routeLabel}</div>
          <div class="meta">
            ${d.type?`<span class="tag">${esc(d.type)}</span>`:''}
            ${d.company?`<span>${esc(d.company)}</span>`:''}
          </div>
        </div>
        <div class="price">${d.cost?esc(money(d.cost,cur)):''}</div>
      </div>`;
    }).join('');
    return head+rows;
  }).join('');
}

/* ---- Resumo ---- */
function renderResumo(){
  const cur=trip().currency;
  const sections=[
    {key:'acomodacoes',label:'Alojamento',icon:ICO.bed},
    {key:'deslocamentos',label:'Transporte',icon:ICO.route},
    {key:'atracoes',label:'Atrações',icon:ICO.pin}
  ];
  const total=sections.reduce((s,x)=>s+sectionTotal(x.key),0);
  return `<div class="summary-card">
    <h3>Resumo financeiro</h3>
    <p>Os alojamentos aparecem divididos pelo número de hóspedes quando você informa essa quantidade.</p>
    <div class="summary-list">
      ${sections.map(s=>`<div class="summary-row"><div class="label">${s.icon} ${esc(s.label)}</div><div class="amount">${esc(money(sectionTotal(s.key),cur))}</div></div>`).join('')}
    </div>
    <div class="summary-total"><span>Total geral</span><span class="amount">${esc(money(total,cur))}</span></div>
  </div>`;
}

/* ---- Atrações (roteiro por dia) ---- */
function renderAtracoes(){
  const list=sortByRecency('atracoes', items('atracoes'));
  if(!list.length) return emptyState(ICO.pin,'Roteiro vazio',
    'Monte seu roteiro dia a dia: cada atração com horário, local e link do mapa. Toque em +.');
  const cur=trip().currency;
  const groups={};
  list.forEach(a=>{const k=a.date||'';(groups[k]=groups[k]||[]).push(a);});
  const keys=Object.keys(groups).sort((a,b)=>{
    if(!a) return 1; if(!b) return -1; return a.localeCompare(b);
  });
  return keys.map(date=>{
    const head=`<div class="daylabel">${date?fmtDateFull(date):'Sem data marcada'}</div>`;
    const rows=groups[date].slice().sort((x,y)=>(x.time||'~').localeCompare(y.time||'~')).map(a=>{
      const isPast=isPastItem('atracoes',a)?' is-past':'';
      const location=a.location?`<a class="map-link" href="${mapLinkFor('atracoes',a)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${esc(a.location)}</a>`:'';
      return `<div class="row${isPast}" data-open="atracoes:${a.id}">
        <div class="gutter">${a.time?esc(a.time):'—'}</div>
        <div class="body">
          <div class="title">${esc(a.name||'Atração')}</div>
          <div class="meta">
            ${location?`<span>${location}</span>`:''}
            ${a.notes?`<span>${esc(a.notes.slice(0,60))}${a.notes.length>60?'…':''}</span>`:''}
          </div>
        </div>
        <div class="price">${a.cost?esc(money(a.cost,cur)):''}</div>
      </div>`;
    }).join('');
    return head+rows;
  }).join('');
}

/* =========================================================================
   MODAIS (formulário + detalhe)
   ========================================================================= */
const root=$('#modalRoot');
function closeModal(){root.innerHTML='';lockScroll(false);}
function sheet(inner){
  lockScroll(true);
  root.innerHTML=`<div class="scrim" data-scrim><div class="sheet" role="dialog" aria-modal="true">
    <div class="sheet-grip"></div>${inner}</div></div>`;
  $('[data-scrim]').addEventListener('click',e=>{if(e.target.hasAttribute('data-scrim'))closeModal();});
}

function formatTimeValue(value){
  const s=String(value??'').trim();
  if(!s) return '';
  const m=s.match(/^(\d{1,2}):(\d{1,2})/);
  if(!m) return s;
  const h=String(Math.min(23,Math.max(0,Number(m[1])))).padStart(2,'0');
  const min=String(Math.min(59,Math.max(0,Number(m[2])))).padStart(2,'0');
  return `${h}:${min}`;
}
function timePickerHTML(id,value){
  const v=formatTimeValue(value);
  return `<input id="${esc(id)}" type="time" class="mono-in" value="${esc(v)}">`;
}

/* ---------- Formulário: Alojamento ---------- */
function formAcomodacao(a){
  a=a||{};
  sheet(`
    <h2>${a.id?'Editar alojamento':'Novo alojamento'}</h2>
    <div class="field"><label>Nome / descrição</label>
      <input id="f_name" value="${esc(a.name)}" placeholder="Ex.: Casa em Florença, quarto duplo"></div>
    <div class="two">
      <div class="field"><label>Onde comprou</label>
        <select id="f_platform">
          ${['','Booking.com','Airbnb','Hotel direto','Outro'].map(p=>`<option ${a.platform===p?'selected':''}>${p}</option>`).join('')}
        </select></div>
      <div class="field"><label>Valor total</label>
        <input id="f_cost" class="mono-in" inputmode="decimal" value="${a.cost??''}" placeholder="0,00"></div>
    </div>
    <div class="two">
      <div class="field"><label>Hóspedes</label>
        <input id="f_guests" type="number" min="1" step="1" value="${esc(String(a.guests ?? 1))}" placeholder="1"></div>
      <div class="field">
        <label class="check-row"><input id="f_paid" type="checkbox" ${a.paid?'checked':''}> Pago</label>
      </div>
    </div>
    <div class="field" id="f_due_wrap" ${a.paid?'style="display:none"':''}>
      <label>Quando vai cair o pagamento</label>
      <input id="f_due_date" type="date" class="mono-in" value="${esc(a.paymentDueDate)}">
    </div>
    <div class="field"><label>Localização (endereço ou nome do lugar)</label>
      <input id="f_location" value="${esc(a.location)}" placeholder="Rua, cidade — abre no Google Maps depois"></div>
    <div class="two">
      <div class="field"><label>Check-in — data</label><input id="f_ci_d" type="date" class="mono-in" value="${esc(a.checkinDate)}"></div>
      <div class="field"><label>Check-in — hora</label>${timePickerHTML('f_ci_t', a.checkinTime)}</div>
    </div>
    <div class="two">
      <div class="field"><label>Check-out — data</label><input id="f_co_d" type="date" class="mono-in" value="${esc(a.checkoutDate)}"></div>
      <div class="field"><label>Check-out — hora</label>${timePickerHTML('f_co_t', a.checkoutTime)}</div>
    </div>
    <div class="field"><label>Link da reserva (opcional)</label>
      <input id="f_url" value="${esc(a.url)}" placeholder="https://..."></div>
    <div class="field"><label>Notas (código da reserva, wi-fi, contato do anfitrião…)</label>
      <textarea id="f_notes" placeholder="Tudo que você quer ter à mão">${esc(a.notes)}</textarea></div>
    <div class="sheet-actions">
      ${a.id?`<button class="btn danger" data-del="acomodacoes:${a.id}">Excluir</button>`:''}
      <div class="spacer"></div>
      <button class="btn ghost" data-cancel>Cancelar</button>
      <button class="btn primary" data-save="acomodacoes">Salvar</button>
    </div>`);
  wireForm('acomodacoes',a);
}

/* ---------- Formulário: Deslocamento ---------- */
function formDeslocamento(d){
  d=d||{};
  sheet(`
    <h2>${d.id?'Editar deslocamento':'Novo deslocamento'}</h2>
    <div class="two">
      <div class="field"><label>Tipo</label>
        <select id="f_type">${['Voo','Trem','Ônibus','Ferry','Carro','Metrô','Outro'].map(t=>`<option ${d.type===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label>Companhia</label>
        <input id="f_company" value="${esc(d.company)}" placeholder="Ex.: Trenitalia, Ryanair"></div>
    </div>
    <div class="two">
      <div class="field"><label>Partida — local</label><input id="f_from" value="${esc(d.from)}" placeholder="Cidade / estação"></div>
      <div class="field"><label>Chegada — local</label><input id="f_to" value="${esc(d.to)}" placeholder="Cidade / estação"></div>
    </div>
    <div class="field"><label>Partida — data</label><input id="f_dep_d" type="date" class="mono-in" value="${esc(d.departDate)}"></div>
    <div class="two">
      <div class="field"><label>Partida — hora</label>${timePickerHTML('f_dep_t', d.departTime)}</div>
      <div class="field"><label>Chegada — hora</label>${timePickerHTML('f_arr_t', d.arriveTime)}</div>
    </div>
    <div class="hint">Se a chegada for no dia seguinte, escreva isso na observação para não confundir o registro.</div>
    <div class="field"><label>Valor</label>
      <input id="f_cost" class="mono-in" inputmode="decimal" value="${d.cost??''}" placeholder="0,00"></div>
    <div class="field"><label>Notas (assento, localizador, plataforma…)</label>
      <textarea id="f_notes">${esc(d.notes)}</textarea></div>
    <div class="sheet-actions">
      ${d.id?`<button class="btn danger" data-del="deslocamentos:${d.id}">Excluir</button>`:''}
      <div class="spacer"></div>
      <button class="btn ghost" data-cancel>Cancelar</button>
      <button class="btn primary" data-save="deslocamentos">Salvar</button>
    </div>`);
  wireForm('deslocamentos',d);
}

/* ---------- Formulário: Atração ---------- */
function formAtracao(a){
  a=a||{};
  sheet(`
    <h2>${a.id?'Editar atração':'Nova atração'}</h2>
    <div class="field"><label>Nome</label>
      <input id="f_name" value="${esc(a.name)}" placeholder="Ex.: Galleria degli Uffizi"></div>
    <div class="field"><label>Localização</label>
      <input id="f_location" value="${esc(a.location)}" placeholder="Endereço ou nome — abre no mapa"></div>
    <div class="two">
      <div class="field"><label>Data</label><input id="f_date" type="date" class="mono-in" value="${esc(a.date)}"></div>
      <div class="field"><label>Horário</label>${timePickerHTML('f_time', a.time)}</div>
    </div>
    <div class="two">
      <div class="field"><label>Custo (deixe vazio se grátis)</label>
        <input id="f_cost" class="mono-in" inputmode="decimal" value="${a.cost??''}" placeholder="0,00"></div>
      <div class="field"><label>Link (site / ingresso)</label>
        <input id="f_url" value="${esc(a.url)}" placeholder="https://..."></div>
    </div>
    <div class="field"><label>Notas</label>
      <textarea id="f_notes" placeholder="Reservar com antecedência? Fecha na segunda?">${esc(a.notes)}</textarea></div>
    <div class="sheet-actions">
      ${a.id?`<button class="btn danger" data-del="atracoes:${a.id}">Excluir</button>`:''}
      <div class="spacer"></div>
      <button class="btn ghost" data-cancel>Cancelar</button>
      <button class="btn primary" data-save="atracoes">Salvar</button>
    </div>`);
  wireForm('atracoes',a);
}

/* ---------- ligações comuns do formulário ---------- */
function wireForm(kind,obj){
  const paid=$('#f_paid'); const dueWrap=$('#f_due_wrap');
  if(paid && dueWrap){
    const toggleDue=()=>{dueWrap.style.display=paid.checked?'none':'block';};
    paid.addEventListener('change',toggleDue); toggleDue();
  }
  $('[data-cancel]').addEventListener('click',closeModal);
  $('[data-save]').addEventListener('click',()=>saveEntry(kind,obj));
  const del=$('[data-del]');
  if(del) del.addEventListener('click',()=>confirmDelete(kind,obj.id));
}
// reabre mantendo os valores já digitados (para atualizar só o bloco de arquivo)
function reopenForm(kind,obj){
  const snap=collect(kind); Object.assign(obj,snap);
  if(kind==='acomodacoes')formAcomodacao(obj);
  else if(kind==='deslocamentos')formDeslocamento(obj);
  else formAtracao(obj);
}

function val(id){const el=$('#'+id);return el?el.value.trim():'';}
function num(id){const v=val(id).replace(',','.');return v===''?'':(Number(v)||0);}

function collect(kind){
  if(kind==='acomodacoes') return {
    name:val('f_name'),platform:val('f_platform'),cost:num('f_cost'),location:val('f_location'),
    checkinDate:val('f_ci_d'),checkinTime:val('f_ci_t'),checkoutDate:val('f_co_d'),checkoutTime:val('f_co_t'),
    url:val('f_url'),notes:val('f_notes'),guests:Math.max(1,Number(val('f_guests'))||1),
    paid: $('#f_paid') ? $('#f_paid').checked : false, paymentDueDate: val('f_due_date')};
  if(kind==='deslocamentos') return {
    type:val('f_type'),company:val('f_company'),from:val('f_from'),to:val('f_to'),
    departDate:val('f_dep_d'),departTime:val('f_dep_t'),arriveTime:val('f_arr_t'),
    cost:num('f_cost'),notes:val('f_notes')};
  return {name:val('f_name'),location:val('f_location'),date:val('f_date'),time:val('f_time'),
    cost:num('f_cost'),url:val('f_url'),notes:val('f_notes')};
}

async function saveEntry(kind,obj){
  const data=collect(kind);
  if(obj.id){
    const arr=state[kind];const i=arr.findIndex(x=>x.id===obj.id);
    arr[i]={...arr[i],...data};
  }else{
    state[kind].push({id:uid(),tripId:state.currentTripId,...data});
  }
  save();closeModal();render();
  toast('Salvo');
}

function confirmDelete(kind,id){
  const obj=state[kind].find(x=>x.id===id);
  sheet(`<h2>Excluir?</h2>
    <p style="color:var(--ink-soft);margin:0 0 4px">Isto remove o item. Não dá pra desfazer.</p>
    <div class="sheet-actions"><div class="spacer"></div>
      <button class="btn ghost" data-cancel>Cancelar</button>
      <button class="btn primary" style="background:var(--danger);border-color:var(--danger)" data-really>Excluir</button></div>`);
  $('[data-cancel]').addEventListener('click',()=>openDetailOrForm(kind,id));
  $('[data-really]').addEventListener('click',async()=>{
    state[kind]=state[kind].filter(x=>x.id!==id);
    save();closeModal();render();toast('Excluído');
  });
}

/* ---------- Detalhe ---------- */
function openDetailOrForm(kind,id){detail(kind,id);}
function detail(kind,id){
  const x=state[kind].find(e=>e.id===id); if(!x)return;
  const cur=trip().currency;
  let rows='';
  const add=(k,v,mono)=>{if(v)rows+=`<div><dt>${k}</dt><dd class="${mono?'mono':''}">${v}</dd></div>`;};

  if(kind==='acomodacoes'){
    add('Onde comprou',esc(x.platform));
    add('Valor total',x.cost?esc(money(x.cost,cur)):'',true);
    add('Hóspedes',esc(String(Math.max(1,Number(x.guests)||1))),true);
    add('Pago',x.paid?'Sim':'Não',true);
    if(!x.paid && x.paymentDueDate) add('Vence em',fmtDate(x.paymentDueDate),true);
    add('Valor por pessoa',x.cost?esc(money(itemCost(kind,x),cur)):'',true);
    add('Local',x.location?`<a class="map-link" href="${mapsSearch(x.location)}" target="_blank" rel="noopener">${esc(x.location)}</a>`:'');
    add('Check-in',[fmtDate(x.checkinDate),x.checkinTime].filter(Boolean).join(' · '),true);
    add('Check-out',[fmtDate(x.checkoutDate),x.checkoutTime].filter(Boolean).join(' · '),true);
    add('Notas',esc(x.notes).replace(/\n/g,'<br>'));
  }else if(kind==='deslocamentos'){
    add('Tipo',esc(x.type)); add('Companhia',esc(x.company));
    add('Partida',[esc(x.from),fmtDate(x.departDate),x.departTime].filter(Boolean).join(' · '),true);
    add('Chegada',[esc(x.to),x.arriveTime].filter(Boolean).join(' · '),true);
    add('Rota',x.from||x.to?`<a class="map-link" href="${mapsDir(x.from,x.to)}" target="_blank" rel="noopener">${[x.from,x.to].filter(Boolean).join(' → ')}</a>`:'');
    add('Valor',x.cost?esc(money(x.cost,cur)):'',true);
    add('Notas',esc(x.notes).replace(/\n/g,'<br>'));
  }else{
    add('Local',x.location?`<a class="map-link" href="${mapsSearch(x.location)}" target="_blank" rel="noopener">${esc(x.location)}</a>`:'');
    add('Quando',[fmtDate(x.date),x.time].filter(Boolean).join(' · '),true);
    add('Custo',x.cost?esc(money(x.cost,cur)):'',true);
    add('Notas',esc(x.notes).replace(/\n/g,'<br>'));
  }

  // botões de link
  let links='';
  if(kind==='deslocamentos' && (x.from||x.to))
    links+=`<a class="link-btn" target="_blank" rel="noopener" href="${mapsDir(x.from,x.to)}">${ICO.map} Rota no mapa</a>`;
  else if(x.location)
    links+=`<a class="link-btn" target="_blank" rel="noopener" href="${mapsSearch(x.location)}">${ICO.map} Abrir no mapa</a>`;
  if(x.url) links+=`<a class="link-btn" target="_blank" rel="noopener" href="${esc(x.url)}">${ICO.ext} Abrir reserva/site</a>`;
  const title = kind==='deslocamentos' ? `${esc(x.from||'?')} → ${esc(x.to||'?')}` : esc(x.name||'Sem nome');
  sheet(`<h2>${title}</h2>
    ${links?`<div style="margin:-4px 0 14px">${links}</div>`:''}
    <dl class="dl">${rows||'<div><dd style="color:var(--ink-faint)">Sem detalhes preenchidos.</dd></div>'}</dl>
    <div class="sheet-actions">
      <button class="btn danger" data-del2>Excluir</button>
      <div class="spacer"></div>
      <button class="btn ghost" data-cancel>Fechar</button>
      <button class="btn primary" data-edit>Editar</button>
    </div>`);
  $('[data-cancel]').addEventListener('click',closeModal);
  $('[data-edit]').addEventListener('click',()=>openForm(kind,x));
  $('[data-del2]').addEventListener('click',()=>confirmDelete(kind,id));
}

function openForm(kind,obj){
  if(kind==='acomodacoes')formAcomodacao(obj);
  else if(kind==='deslocamentos')formDeslocamento(obj);
  else formAtracao(obj);
}

/* =========================================================================
   VIAGENS + MENU + BACKUP
   ========================================================================= */
function tripPicker(){
  const opts=state.trips.map(t=>`<button data-pick="${t.id}">${t.id===state.currentTripId?'● ':'○ '}${esc(t.name)} <span style="color:var(--ink-faint);font-family:var(--mono);font-size:12px;margin-left:auto">${esc(t.currency)}</span></button>`).join('');
  sheet(`<h2>Suas viagens</h2>
    <div class="menu-card" style="box-shadow:none;margin-bottom:14px">${opts}</div>
    <div class="sheet-actions">
      <button class="btn danger" data-deltrip ${state.trips.length<2?'style="display:none"':''}>Excluir esta viagem</button>
      <div class="spacer"></div>
      <button class="btn" data-rename>Renomear</button>
      <button class="btn primary" data-new>Nova viagem</button>
    </div>`);
  root.querySelectorAll('[data-pick]').forEach(b=>b.addEventListener('click',()=>{
    state.currentTripId=b.dataset.pick;save();closeModal();render();
  }));
  $('[data-new]').addEventListener('click',tripForm);
  $('[data-rename]').addEventListener('click',()=>tripForm(trip()));
  const dt=$('[data-deltrip]'); if(dt)dt.addEventListener('click',deleteTrip);
}
function tripForm(t){
  t=t||{};
  sheet(`<h2>${t.id?'Renomear viagem':'Nova viagem'}</h2>
    <div class="field"><label>Nome</label><input id="t_name" value="${esc(t.name)}" placeholder="Ex.: Itália + Provença 2026"></div>
    <div class="field"><label>Moeda principal</label>
      <select id="t_cur">${CURRENCIES.map(c=>`<option ${((t.currency||'EUR')===c)?'selected':''}>${c}</option>`).join('')}</select></div>
    <div class="sheet-actions"><div class="spacer"></div>
      <button class="btn ghost" data-cancel>Cancelar</button>
      <button class="btn primary" data-savetrip>Salvar</button></div>`);
  $('[data-cancel]').addEventListener('click',tripPicker);
  $('[data-savetrip]').addEventListener('click',()=>{
    const name=val('t_name')||'Viagem';const currency=val('t_cur')||'EUR';
    if(t.id){const o=state.trips.find(x=>x.id===t.id);o.name=name;o.currency=currency;}
    else{const nt={id:uid(),name,currency};state.trips.push(nt);state.currentTripId=nt.id;}
    save();closeModal();render();
  });
}
function deleteTrip(){
  sheet(`<h2>Excluir viagem?</h2>
    <p style="color:var(--ink-soft);margin:0 0 4px">Remove a viagem "<b>${esc(trip().name)}</b>" e todos os alojamentos, deslocamentos e atrações dela.</p>
    <div class="sheet-actions"><div class="spacer"></div>
      <button class="btn ghost" data-cancel>Cancelar</button>
      <button class="btn primary" style="background:var(--danger);border-color:var(--danger)" data-really>Excluir tudo</button></div>`);
  $('[data-cancel]').addEventListener('click',tripPicker);
  $('[data-really]').addEventListener('click',async()=>{
    const id=state.currentTripId;
    for(const k of ['acomodacoes','deslocamentos','atracoes']) state[k]=state[k].filter(e=>e.tripId!==id);
    state.trips=state.trips.filter(t=>t.id!==id);
    state.currentTripId=state.trips[0].id;
    save();closeModal();render();toast('Viagem excluída');
  });
}

/* ---------- menu ---------- */
function openMenu(){
  lockScroll(true);
  root.innerHTML=`<div class="menu" data-scrim>
    <div class="menu-card">
      <div class="sec">Texto</div>
      <div class="font-scale-row">
        <button data-act="font-small" data-font-scale="0.9">A-</button>
        <button data-act="font-default" data-font-scale="1">A</button>
        <button data-act="font-large" data-font-scale="1.15">A+</button>
      </div>
      <div class="sec">Dados</div>
      <button data-act="export">${ICO.ext} Exportar backup (.json)</button>
      <button data-act="import">${ICO.clip} Importar backup</button>
      <div class="sec">Sobre</div>
      <button data-act="about">${ICO.pin} Como funciona / offline</button>
    </div></div>`;
  $('[data-scrim]').addEventListener('click',e=>{if(e.target.hasAttribute('data-scrim'))closeModal();});
  document.querySelectorAll('[data-act^="font"]').forEach(btn=>btn.addEventListener('click',()=>{
    applyFontScale(btn.dataset.fontScale);
    document.querySelectorAll('.font-scale-row button').forEach(b=>b.classList.toggle('active', Number(b.dataset.fontScale)===fontScale));
  }));
  $('[data-act="export"]').addEventListener('click',exportBackup);
  $('[data-act="import"]').addEventListener('click',importBackup);
  $('[data-act="about"]').addEventListener('click',about);
  document.querySelectorAll('.font-scale-row button').forEach(b=>b.classList.toggle('active', Number(b.dataset.fontScale)===fontScale));
}

async function exportBackup(){
  toast('Preparando backup…');
  const payload={_app:'CadernoDeViagem',_v:1,exportedAt:new Date().toISOString(),state};
  const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download='caderno-viagem-backup-'+new Date().toISOString().slice(0,10)+'.json';
  a.click();URL.revokeObjectURL(url);closeModal();toast('Backup salvo');
}
function importBackup(){
  const inp=document.createElement('input');inp.type='file';inp.accept='application/json';
  inp.onchange=async()=>{
    const f=inp.files[0];if(!f)return;
    try{
      const p=JSON.parse(await f.text());
      if(!p.state||!p.state.trips)throw new Error('formato');
      state=p.state;save();
      closeModal();render();toast('Backup importado');
    }catch(e){toast('Arquivo inválido');}
  };
  inp.click();
}
function about(){
  sheet(`<h2>Como funciona</h2>
    <div style="font-size:14px;color:var(--ink);line-height:1.6">
      <p style="margin:.2em 0 1em"><b>Offline.</b> Depois de abrir uma vez, tudo funciona sem internet — inclusive as confirmações em PDF. Só os botões de mapa e os links precisam de conexão.</p>
      <p style="margin:0 0 1em"><b>Onde ficam seus dados.</b> Tudo é salvo <b>só neste navegador, neste aparelho</b>. Nada vai pra nuvem. Se você limpar os dados do navegador, apaga.</p>
      <p style="margin:0 0 1em"><b>Backup = sua segurança.</b> Antes de viajar, use <i>Exportar backup</i>. O arquivo <code>.json</code> guarda suas viagens e pode ser importado em outro aparelho.</p>
      <p style="margin:0 0 1em"><b>Instalar no celular.</b> No navegador, use "Adicionar à tela de início" para virar um ícone de app.</p>
      <p style="margin:0;color:var(--ink-soft)">Mapas abrem no Google Maps com o endereço que você digitou.</p>
    </div>
    <div class="sheet-actions"><div class="spacer"></div><button class="btn primary" data-cancel>Entendi</button></div>`);
  $('[data-cancel]').addEventListener('click',closeModal);
}

/* =========================================================================
   EVENTOS GLOBAIS
   ========================================================================= */
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;activeTab=b.dataset.tab;render();});
$('#main').addEventListener('click',e=>{const r=e.target.closest('[data-open]');if(!r)return;
  const [kind,id]=r.dataset.open.split(':');detail(kind,id);});
$('#fab').addEventListener('click',()=>{
  if(activeTab==='acomodacoes')formAcomodacao();
  else if(activeTab==='deslocamentos')formDeslocamento();
  else formAtracao();});
$('#menuBtn').addEventListener('click',openMenu);
$('#tripName').addEventListener('click',tripPicker);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

render();
setHeaderH();

/* service worker: só ativa quando servido por http(s) (ex.: GitHub Pages). Em file:// não faz nada. */
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}
