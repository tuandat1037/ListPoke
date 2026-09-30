const TYPE_VN = {
  normal:{vn:'Thường',c:'#A8A77A',i:'●'}, fire:{vn:'Lửa',c:'#EE8130',i:'🔥'}, water:{vn:'Nước',c:'#6390F0',i:'💧'},
  electric:{vn:'Điện',c:'#F7D02C',i:'⚡'}, grass:{vn:'Cỏ',c:'#3EAD2D',i:'🌿'}, ice:{vn:'Băng',c:'#96D9D6',i:'❄'},
  fighting:{vn:'Giác đấu',c:'#C22E28',i:'🥊'}, poison:{vn:'Độc',c:'#A33EA1',i:'☠'}, ground:{vn:'Đất',c:'#E2BF65',i:'⛰'},
  flying:{vn:'Bay',c:'#89AEF5',i:'🪶'}, psychic:{vn:'Siêu linh',c:'#F95587',i:'🔮'}, bug:{vn:'Bọ',c:'#A6B91A',i:'🐛'},
  rock:{vn:'Đá',c:'#B6A136',i:'🪨'}, ghost:{vn:'Ma',c:'#735797',i:'👻'}, dragon:{vn:'Rồng',c:'#6F35FC',i:'🐉'},
  dark:{vn:'Bóng tối',c:'#705746',i:'🌙'}, steel:{vn:'Thép',c:'#B7B7CE',i:'⚙'}, fairy:{vn:'Tiên',c:'#D685AD',i:'✨'}
};

let allPokemon = [];
let visible = 32;
let featuredIndex = 0;
// state form tìm kiếm
let fTypes = new Set();
let fRegions = new Set();
let fMin = 1, fMax = 1025, fAbility = 'all';
const REGIONS = [
  {id:'kanto', label:'vùng Kanto', min:1, max:151},
  {id:'johto', label:'vùng Johto', min:152, max:251},
  {id:'hoenn', label:'vùng Hoenn', min:252, max:386},
  {id:'sinnoh', label:'vùng Sinnoh', min:387, max:493},
  {id:'isshu', label:'vùng Isshu', min:494, max:649},
  {id:'kalos', label:'vùng Kalos', min:650, max:721},
  {id:'alola', label:'vùng Alola', min:722, max:809},
  {id:'galar', label:'Vùng Galar', min:810, max:905},
  {id:'hisui', label:'Vùng Hisui', min:906, max:905, special:'hisui'},
  {id:'paldea', label:'Vùng Paldea', min:906, max:1025},
];
function regionOf(p){
  const n = (p.name||'').toLowerCase();
  if(n.includes('alola')) return 'alola';
  if(n.includes('galar')) return 'galar';
  if(n.includes('hisui')) return 'hisui';
  if(n.includes('paldea')) return 'paldea';
  const b = getBase(p);
  const r = REGIONS.find(r=>b>=r.min && b<=r.max);
  return r?r.id:'';
}

// hero ids: mix giống ảnh mẫu (Charizard, Solgaleo, Tangela...)
const heroIds = [6,102,870,884,875,877,879,889,892,894,1007,1010,791,792,800,899,905,912,915,918,925,930,937,940,12,25,94,130,143,149,150,151,196,248,384,483,484,487];

function art(id){ return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`; }

function prettyForm(name){
  const parts = name.split('-');
  const base = cap(parts[0]);
  const rest = parts.slice(1).join('-');
  if(!rest) return base;
  if(rest==='mega') return 'Mega '+base;
  if(rest==='mega-x') return 'Mega '+base+' X';
  if(rest==='mega-y') return 'Mega '+base+' Y';
  if(rest==='gmax' || rest==='gigantamax') return base+' Gigamax';
  if(rest==='alola') return 'Alolan '+base;
  if(rest==='galar') return 'Galarian '+base;
  if(rest==='hisui') return 'Hisuian '+base;
  if(rest==='paldea') return 'Paldean '+base;
  if(rest.startsWith('mega')) return 'Mega '+base+' '+cap(rest.replace('mega-',''));
  return base+' '+parts.slice(1).map(cap).join(' ');
}
function getBase(p){ return p.base || (p.id<=1025?p.id:9999); }
// Cache localStorage để lần 2 mở tức thì
const CACHE_KEY = 'pokedex-cache-v1';
let detailCache = {};
try{ detailCache = JSON.parse(localStorage.getItem(CACHE_KEY)||'{}'); }catch{ detailCache = {}; }
let saveT = null;
function saveCache(){ clearTimeout(saveT); saveT = setTimeout(()=>{ try{
  const obj = {};
  for(const p of allPokemon){ if(p._loaded) obj[p.name] = {t:p.types,h:p.height,w:p.weight,a:p.abilities||[],b:p.base,n:p.no,d:p.display}; }
  localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
}catch{} }, 1500); }
let renderToken = 0, enriching = false;

async function ensureDetails(items){
  const miss = items.filter(p=>!p._loaded);
  if(!miss.length) return;
  await Promise.all(miss.map(async (p)=>{
    try{
      const r = await fetch(p.url); const d = await r.json();
      applyDetail(p, d);
    }catch{}
  }));
  saveCache();
}
function applyDetail(p, d){
  p.types = d.types.map(t=>t.type.name);
  p.height = d.height; p.weight = d.weight; p._loaded = true;
  p.abilities = (d.abilities||[]).map(a=>a.ability.name);
  if(p.id>1025 && d.species?.url){
    const sm = d.species.url.match(/\/pokemon-species\/(\d+)\//);
    if(sm){ p.base = parseInt(sm[1]); p.no = 'No.'+String(p.base).padStart(4,'0'); p.display = prettyForm(p.name); return; }
  }
  p.base = p.id<=1025 ? p.id : (p.base||9999);
  p.no = 'No.'+String(getBase(p)).padStart(4,'0');
}
// Nền: chỉ chạy khi lọc theo hệ/đặc tính (cần quét toàn bộ), từng batch nhỏ, không chặn UI
async function enrichBackground(){
  if(enriching) return; enriching = true;
  const BATCH = 24;
  for(let i=0;i<allPokemon.length;i+=BATCH){
    if(!enriching) break;
    const chunk = allPokemon.slice(i,i+BATCH).filter(p=>!p._loaded);
    if(chunk.length){
      await Promise.all(chunk.map(async (p)=>{ try{ const r=await fetch(p.url); applyDetail(p, await r.json()); }catch{} }));
      saveCache();
      const done = allPokemon.filter(p=>p._loaded).length;
      const btn = document.getElementById('loadMore');
      if(btn && (fTypes.size || fAbility!=='all')) btn.textContent = `Đang nạp hệ... ${done}/${allPokemon.length}`;
      render(true);
    }
    await new Promise(r=>setTimeout(r,30)); // nhường UI
    // dừng khi không còn filter nặng
    if(!fTypes.size && fAbility==='all' && allPokemon.filter(p=>!p._loaded).length > allPokemon.length - 150) break;
  }
  enriching = false;
}

async function loadData(){
  const grid = document.getElementById('grid');
  grid.innerHTML = '<p style="grid-column:1/-1;text-align:center">Đang tải danh sách Pokémon...</p>';
  try{
    // Chỉ 2 request list (~KB) là hiện web ngay, KHÔNG chờ 1300 request chi tiết
    const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025');
    const j = await res.json();
    let formList = [];
    try{
      const rf = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1000&offset=1025');
      formList = (await rf.json()).results || [];
    }catch{}
    const baseMap = {};
    for(const p of j.results){
      const m = p.url.match(/\/pokemon\/(\d+)\//);
      if(m){ const id = parseInt(m[1]); if(id<=1025) baseMap[p.name] = id; }
    }
    const guessBase = (name)=>{
      let best = 0, bestLen = -1;
      for(const k in baseMap){ if(name===k || name.startsWith(k+'-')){ if(k.length>bestLen){ bestLen=k.length; best=baseMap[k]; } } }
      return best || 9999;
    };
    const mkBase = (p)=>{
      const m = p.url.match(/\/pokemon\/(\d+)\//);
      const id = m?parseInt(m[1]):0;
      const c = detailCache[p.name];
      if(c) return { id, name:p.name, display:c.d||prettyForm(p.name), types:c.t, height:c.h, weight:c.w, abilities:c.a, base:c.b, no:c.n, _loaded:true, url:p.url, form:id>1025 };
      if(id>1025){ const g = guessBase(p.name); return { id, name:p.name, display:prettyForm(p.name), types:[], height:7, weight:69, abilities:[], _loaded:false, url:p.url, base:g, no:'No.'+String(g).padStart(4,'0'), form:true }; }
      return { id, name:p.name, display:prettyForm(p.name), types:[], height:7, weight:69, abilities:[], _loaded:false, url:p.url, base:id, no:'No.'+String(id).padStart(4,'0'), form:false };
    };
    allPokemon = [...j.results.map(mkBase), ...formList.map(mkBase)].filter(p=>p.id>0);
    allPokemon.sort((a,b)=>(getBase(a)-getBase(b)) || (a.id-b.id));
    buildSearchForm();
    buildHero();
    render();
  }catch(e){
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center">Lỗi tải API. Kiểm tra mạng rồi reload.</p>';
  }
}

function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

function buildSearchForm(){
  // Hệ
  const tg = document.getElementById('fTypeGrid');
  const order = ['normal','grass','fire','water','electric','bug','flying','ground','poison','rock','ice','fighting','psychic','ghost','dragon','dark','steel','fairy'];
  const labelFix = {normal:'hệ Thường',grass:'hệ Cỏ',fire:'hệ Lửa',water:'hệ Nước',electric:'hệ Điện',bug:'hệ Côn Trùng',flying:'hệ Bay',ground:'hệ Đá',poison:'hệ Độc',rock:'hệ Đất',ice:'hệ Băng',fighting:'hệ Giác Đấu',psychic:'hệ Siêu Linh',ghost:'hệ Ma',dragon:'hệ Rồng',dark:'hệ Bóng Tối',steel:'hệ Thép',fairy:'hệ Tiên'};
  tg.innerHTML = order.map(k=>{ const v=TYPE_VN[k]; return `<button class="f-type" data-t="${k}"><i style="background:${v.c}">${v.i}</i><span>${labelFix[k]||v.vn}</span></button>`; }).join('');
  tg.querySelectorAll('.f-type').forEach(b=>b.onclick=()=>{ const t=b.dataset.t;
    if(fTypes.has(t)){ fTypes.delete(t); b.classList.remove('active'); } else { fTypes.add(t); b.classList.add('active'); }
    render();
  });
  // Vùng
  const rg = document.getElementById('fRegionGrid');
  rg.innerHTML = REGIONS.map(r=>`<button class="f-region" data-r="${r.id}">${r.label}</button>`).join('');
  rg.querySelectorAll('.f-region').forEach(b=>b.onclick=()=>{ const r=b.dataset.r;
    if(fRegions.has(r)){ fRegions.delete(r); b.classList.remove('active'); } else { fRegions.add(r); b.classList.add('active'); }
    render();
  });
  // Số
  const mn = document.getElementById('fMin'), mx = document.getElementById('fMax');
  const upd = ()=>{
    fMin = Math.min(parseInt(mn.value), parseInt(mx.value));
    fMax = Math.max(parseInt(mn.value), parseInt(mx.value));
    document.getElementById('fNumLabel').textContent = String(fMin).padStart(4,'0')+' - '+String(fMax).padStart(4,'0');
    const fill = document.getElementById('fFill');
    fill.style.left = ((fMin-1)/1024*100)+'%'; fill.style.right = (100-(fMax-1)/1024*100)+'%';
    render();
  };
  mn.oninput = upd; mx.oninput = upd; upd();
  document.getElementById('fAbility').onchange = (e)=>{ fAbility = e.target.value; render(); };
  document.getElementById('fSearchText').oninput = render;
  document.getElementById('fGo').onclick = render;
  document.getElementById('fSubmit').onclick = ()=>{ document.getElementById('searchModal').classList.remove('open'); render(); window.scrollTo({top:document.querySelector('.grid-wrap').offsetTop-70,behavior:'smooth'}); };
  document.getElementById('fReset').onclick = ()=>{
    fTypes.clear(); fRegions.clear(); fMin=1; fMax=1025; fAbility='all';
    document.getElementById('fSearchText').value='';
    document.getElementById('fMin').value=1; document.getElementById('fMax').value=1025;
    document.getElementById('fAbility').value='all';
    document.querySelectorAll('.f-type.active,.f-region.active').forEach(x=>x.classList.remove('active'));
    document.getElementById('fNumLabel').textContent='0001 - 1025';
    document.getElementById('fFill').style.left='0%'; document.getElementById('fFill').style.right='0%';
    visible=32; render();
  };
  // dropdown đặc tính tự cập nhật trong refreshAbilityOptions(), không cần interval
}

function buildHero(){
  const top = document.getElementById('trackTop');
  const bot = document.getElementById('trackBottom');
  const half = Math.ceil(heroIds.length/2);
  const mk = (arr)=> arr.map(id=>`<div class="poke-ball" data-id="${id}"><img loading="lazy" src="${art(id)}" /></div>`).join('');
  top.innerHTML = mk(heroIds.slice(0,half)) + mk(heroIds.slice(0,half));
  bot.innerHTML = mk(heroIds.slice(half)) + mk(heroIds.slice(half));
  top.querySelectorAll('.poke-ball').forEach(el=>el.onclick=()=>setFeatured(parseInt(el.dataset.id)));
  bot.querySelectorAll('.poke-ball').forEach(el=>el.onclick=()=>setFeatured(parseInt(el.dataset.id)));
  setFeatured(791);
  setInterval(()=>{ featuredIndex=(featuredIndex+1)%heroIds.length; setFeatured(heroIds[featuredIndex]); },3500);
  document.getElementById('prevBtn').onclick=()=>{ featuredIndex=(featuredIndex-1+heroIds.length)%heroIds.length; setFeatured(heroIds[featuredIndex]); };
  document.getElementById('nextBtn').onclick=()=>{ featuredIndex=(featuredIndex+1)%heroIds.length; setFeatured(heroIds[featuredIndex]); };
}
function setFeatured(id){
  const img = document.getElementById('featuredImg');
  img.style.opacity=0; img.style.transform='scale(.8)';
  setTimeout(()=>{ img.src=art(id); img.onload=()=>{ img.style.opacity=1; img.style.transform='scale(1)'; }; },220);
  // không fetch nữa: lấy tên từ cache sẵn có
  const p = allPokemon.find(x=>x.id===id);
  document.getElementById('featuredName').textContent = p ? p.display : ('Pokémon #'+id);
}

function filtered(){
  let list=[...allPokemon];
  const inp = document.getElementById('fSearchText');
  const q=(inp?inp.value:'').trim().toLowerCase();
  if(q) list=list.filter(p=>(p.display||'').toLowerCase().includes(q)||String(getBase(p)).padStart(4,'0').includes(q.replace('no.',''))||p.name.includes(q));
  if(fTypes.size) list=list.filter(p=>p.types.some(t=>fTypes.has(t)));
  if(fRegions.size) list=list.filter(p=>fRegions.has(regionOf(p)));
  if(fAbility!=='all') list=list.filter(p=>(p.abilities||[]).includes(fAbility));
  list=list.filter(p=>{ const b=getBase(p); return b>=fMin && b<=fMax; });
  const s=document.getElementById('sortSelect').value;
  if(s==='asc') list.sort((a,b)=>(getBase(a)-getBase(b))||(a.id-b.id));
  if(s==='desc') list.sort((a,b)=>(getBase(b)-getBase(a))||(b.id-a.id));
  if(s==='az') list.sort((a,b)=>a.display.localeCompare(b.display));
  if(s==='za') list.sort((a,b)=>b.display.localeCompare(a.display));
  return list;
}

async function render(silent){
  const my = ++renderToken;
  const grid=document.getElementById('grid');
  const full=filtered();
  const list=full.slice(0,visible);
  const paint = ()=>{
    grid.innerHTML=list.map(p=>{
      const no=p.no||('No.'+String(getBase(p)).padStart(4,'0'));
      const badges=(p.types.length?p.types:['?']).map(t=>t==='?'
        ? `<span title="Đang tải..." style="background:#bbb">…</span>`
        : `<span title="${TYPE_VN[t]?.vn||t}" style="background:${TYPE_VN[t]?.c||'#888'}">${TYPE_VN[t]?.i||'●'}</span>`).join('');
      return `<div class="card" data-name="${p.name}" data-id="${p.id}">
        <div class="card-top"><span>${no}</span><div class="type-badges">${badges}</div></div>
        <div class="card-body"><h3>${p.display}</h3><div class="ball-bg"><img loading="lazy" src="${art(p.id)}" alt="${p.display}"/></div></div>
      </div>`;
    }).join('') || '<p style="grid-column:1/-1;text-align:center">Không tìm thấy Pokémon nào.</p>';
    grid.querySelectorAll('.card').forEach(c=>c.onclick=()=>openModal(c.dataset.id,c.dataset.name));
    const btn = document.getElementById('loadMore');
    const loaded = allPokemon.filter(p=>p._loaded).length;
    btn.style.display = full.length>visible?'inline-block':'none';
    if(!silent) btn.textContent = `Xem thêm (${Math.min(visible,full.length)}/${full.length})`;
    else if(btn.textContent.startsWith('Xem thêm')) btn.textContent = `Xem thêm (${Math.min(visible,full.length)}/${full.length})`;
    if(!allPokemon.some(p=>!p._loaded)) btn.textContent = 'Xem thêm';
  };
  paint();
  // chỉ fetch chi tiết cho thẻ đang hiện (≤64 request), không fetch cả 1300
  await ensureDetails(list);
  if(my!==renderToken) return; // user đã thao tác khác, bỏ repaint cũ
  paint();
  refreshAbilityOptions();
  // nếu lọc theo hệ/đặc tính mà nhiều con chưa có data → quét nền
  if((fTypes.size || fAbility!=='all') && allPokemon.some(p=>!p._loaded)) enrichBackground();
}

function refreshAbilityOptions(){
  const abs = [...new Set(allPokemon.flatMap(p=>p.abilities||[]))].sort();
  if(!abs.length) return;
  const sel = document.getElementById('fAbility');
  if(sel.options.length < abs.length+1){
    const cur = sel.value;
    sel.innerHTML = '<option value="all">All</option>'+abs.map(a=>`<option value="${a}">${cap(a)}</option>`).join('');
    sel.value = [...sel.options].some(o=>o.value===cur) ? cur : fAbility;
  }
}

async function openModal(id,name){
  const p=allPokemon.find(x=>x.name===name)||allPokemon.find(x=>x.id==id);
  if(!p._loaded){ try{ const r=await fetch(p.url); applyDetail(p, await r.json()); saveCache(); render(true); }catch{} }
  document.getElementById('mNo').textContent=p.no||('No.'+String(getBase(p)).padStart(4,'0'));
  document.getElementById('mName').textContent=p.display;
  document.getElementById('mImg').src=art(p.id);
  document.getElementById('mHeight').textContent=(p.height/10)+' m';
  document.getElementById('mWeight').textContent=(p.weight/10)+' kg';
  document.getElementById('mTypes').innerHTML=p.types.map(t=>`<span style="background:${TYPE_VN[t]?.c}">${TYPE_VN[t]?.vn}</span>`).join('');
  document.getElementById('mTypeText').textContent=p.types.map(t=>TYPE_VN[t]?.vn).join(', ');
  document.getElementById('modal').classList.add('open');
}
document.getElementById('modalClose').onclick=()=>document.getElementById('modal').classList.remove('open');
document.getElementById('modal').onclick=(e)=>{ if(e.target.id==='modal') e.target.classList.remove('open'); };
document.getElementById('loadMore').onclick=()=>{ visible+=32; render(); };
document.getElementById('sortSelect').onchange=render;
document.getElementById('searchToggle').onclick=()=>document.getElementById('searchModal').classList.add('open');
document.getElementById('searchClose').onclick=()=>document.getElementById('searchModal').classList.remove('open');
document.getElementById('searchModal').addEventListener('click',(e)=>{ if(e.target.id==='searchModal') e.target.classList.remove('open'); });

loadData();
