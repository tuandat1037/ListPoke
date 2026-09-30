const API = 'https://api.tcgdex.net/v2/en';
let cards = [];
const $ = (id) => document.getElementById(id);

async function loadSets() {
  const sel = $('tcgSet');
  sel.innerHTML = '<option>Đang tải sets...</option>';
  const r = await fetch(`${API}/sets`);
  const sets = await r.json();
  // Ưu tiên dòng Scarlet & Violet lên đầu
  sets.sort((a, b) => {
    const av = /scarlet|violet|^sv/i.test(a.name + a.id) ? 0 : 1;
    const bv = /scarlet|violet|^sv/i.test(b.name + b.id) ? 0 : 1;
    return av - bv;
  });
  sel.innerHTML = sets.map(s => `<option value="${s.id}">${s.name} (${s.id})</option>`).join('');
  sel.value = [...sel.options].some(o => o.value === 'sv01') ? 'sv01' : sets[0].id;
  sel.onchange = () => loadCards(sel.value);
  loadCards(sel.value);
}

async function loadCards(setId) {
  $('tcgCount').textContent = `Đang tải ${setId}...`;
  $('tcgGrid').innerHTML = '';
  const r = await fetch(`${API}/sets/${setId}`);
  const set = await r.json();
  cards = set.cards || [];
  render();
}

function render() {
  const q = ($('tcgQ').value || '').trim().toLowerCase();
  const list = q ? cards.filter(c => c.name.toLowerCase().includes(q) || c.localId.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) : cards;
  $('tcgCount').textContent = `${$('tcgSet').selectedOptions[0]?.text || ''} • ${list.length}/${cards.length} thẻ`;
  $('tcgGrid').innerHTML = list.map(c => `
    <div class="tcg-card" data-id="${c.id}">
      <img loading="lazy" src="${c.image}/low.png" alt="${c.name}" onerror="this.src='${c.image}/high.png'" />
      <div class="tcg-meta"><b>${c.name}</b><span>${c.localId}</span></div>
    </div>`).join('') || '<p>Không tìm thấy thẻ nào.</p>';
  document.querySelectorAll('.tcg-card').forEach(el => el.onclick = () => openCard(el.dataset.id));
}

async function openCard(id) {
  $('tName').textContent = 'Đang tải...';
  $('tcgModal').classList.add('open');
  try {
    const r = await fetch(`${API}/cards/${id}`);
    const c = await r.json();
    $('tSet').textContent = `${c.set?.name || ''} • ${c.localId || id}`;
    $('tName').textContent = `${c.name} ${c.rarity ? '• ' + c.rarity : ''}`;
    $('tImg').src = `${c.image}/high.png`;
    $('tInfo').innerHTML = `
      <div><span>HP</span><b>${c.hp ?? '—'}</b></div>
      <div><span>Hệ</span><b>${(c.types || []).join(', ') || '—'}</b></div>
      <div><span>Giai đoạn</span><b>${c.stage || c.category || '—'}</b></div>`;
    $('tDesc').textContent = c.description || c.effect || '';
    $('tAttacks').innerHTML = (c.attacks || []).map(a => `<span>${a.name}${a.damage ? ' • ' + a.damage : ''}</span>`).join('');
  } catch { $('tName').textContent = 'Lỗi tải thẻ.'; }
}

$('tcgQ').oninput = render;
$('tcgGo').onclick = render;
$('tcgClose').onclick = () => $('tcgModal').classList.remove('open');
$('tcgModal').onclick = (e) => { if (e.target.id === 'tcgModal') e.target.classList.remove('open'); };
loadSets();
