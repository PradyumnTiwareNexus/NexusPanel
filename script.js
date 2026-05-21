/* ── STATE ── */
const KEY = 'bhd_v3';
const CATS = {
  login:     { label:'Login',     icon:'🔐', color:'#00d4ff', cls:'cb-login'     },
  signup:    { label:'Signup',    icon:'✍️',  color:'#00e676', cls:'cb-signup'    },
  register:  { label:'Register',  icon:'📝', color:'#a855f7', cls:'cb-register'  },
  dashboard: { label:'Dashboard', icon:'📊', color:'#ff9800', cls:'cb-dashboard' },
};

let DB = {
  urls:   [],   // { id, url, category, tags:[], note, addedAt }
  filter: 'all',
  search: '',
  deleteId: null,
};

let chartInst = null;
let currentTagInput = [];

/* ── PERSIST ── */
function persist() { localStorage.setItem(KEY, JSON.stringify(DB.urls)); }
function hydrate()  {
  try { DB.urls = JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { DB.urls = []; }
}

/* ── COUNTS ── */
function counts() {
  const c = { login:0, signup:0, register:0, dashboard:0, total:0 };
  DB.urls.forEach(u => { c[u.category]++; c.total++; });
  return c;
}

function dupIds() {
  const seen = {}, set = new Set();
  DB.urls.forEach(u => {
    const k = norm(u.url);
    if (seen[k] != null) { set.add(seen[k]); set.add(u.id); }
    else seen[k] = u.id;
  });
  return set;
}

function norm(url) { return url.trim().toLowerCase().replace(/\/$/, ''); }

/* ── TIME STATS ── */
function timeStats() {
  const now = Date.now();
  const dayMs  = 86400000;
  const weekMs = 7 * dayMs;
  const monMs  = 30 * dayMs;
  return {
    today: DB.urls.filter(u => now - u.addedAt < dayMs).length,
    week:  DB.urls.filter(u => now - u.addedAt < weekMs).length,
    month: DB.urls.filter(u => now - u.addedAt < monMs).length,
    total: DB.urls.length,
  };
}

/* ── SPARKLINE ── */
function sparklineSvg(color, count) {
  const w = 110, h = 32, pts = 8;
  // Generate pseudo-random-ish values based on count
  const vals = Array.from({length: pts}, (_, i) => {
    const base = count > 0 ? Math.max(1, count - pts + i + 1) : 0;
    return base + (i % 3 === 0 ? 0.3 : i % 2 === 0 ? 0.6 : 0.1) * base;
  });
  const max = Math.max(...vals, 1);
  const coords = vals.map((v, i) => {
    const x = (i / (pts - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return [x, y];
  });
  const path = coords.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const fill = coords.map((p, i) => (i === 0 ? `M${p[0]},${h} L${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ') + ` L${w},${h} Z`;

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sg${color.replace('#','')}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${fill}" fill="url(#sg${color.replace('#','')})" />
    <path d="${path}" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/* ── RENDER STATS ── */
function renderStats() {
  const c  = counts();
  const ds = dupIds();
  const ts = timeStats();
  const dupCount = ds.size;

  // Stat cards
  const cards = [
    { id:'sc-total',     val: c.total,     sub: 'All saved URLs',          color:'#00d4ff', icon:'🌐',  bg:'rgba(0,212,255,.1)'  },
    { id:'sc-login',     val: c.login,     sub: 'Possible login pages',    color:'#00d4ff', icon:'🔐',  bg:'rgba(0,212,255,.1)'  },
    { id:'sc-signup',    val: c.signup,    sub: 'Possible signup pages',   color:'#00e676', icon:'👤',  bg:'rgba(0,230,118,.1)'  },
    { id:'sc-register',  val: c.register,  sub: 'Possible register pages', color:'#a855f7', icon:'📝',  bg:'rgba(168,85,247,.1)' },
    { id:'sc-dashboard', val: c.dashboard, sub: 'Dashboard pages',         color:'#ff9800', icon:'⊞',   bg:'rgba(255,152,0,.1)'  },
    { id:'sc-dups',      val: dupCount,    sub: 'Duplicate entries',       color:'#ff4757', icon:'⚠️',   bg:'rgba(255,71,87,.1)'  },
  ];

  cards.forEach(cd => {
    const el = document.getElementById(cd.id);
    if (!el) return;
    el.querySelector('.stat-num').textContent = cd.val;
    el.querySelector('.stat-num').style.color = cd.color;
    el.querySelector('.stat-icon-box').style.background = cd.bg;
    el.querySelector('.sparkline').innerHTML = sparklineSvg(cd.color, cd.val);
  });

  // Sidebar counts
  document.getElementById('sb-all').textContent      = c.total;
  document.getElementById('sb-login').textContent    = c.login;
  document.getElementById('sb-signup').textContent   = c.signup;
  document.getElementById('sb-register').textContent = c.register;
  document.getElementById('sb-dups').textContent     = dupCount;

  // Quick stats
  document.getElementById('qs-today').textContent = ts.today;
  document.getElementById('qs-week').textContent  = ts.week;
  document.getElementById('qs-month').textContent = ts.month;
  document.getElementById('qs-scan').textContent  = ts.total;

  // Distribution legend
  ['login','signup','register','dashboard'].forEach(k => {
    const el  = document.getElementById(`dist-${k}`);
    const pct = c.total ? Math.round(c[k] / c.total * 100) : 0;
    if (el) el.innerHTML = `<span class="dist-val">${c[k]}</span><span class="dist-pct">(${pct}%)</span>`;
  });

  updateChart(c);
}

/* ── CHART ── */
function initChart() {
  const ctx = document.getElementById('distChart').getContext('2d');
  const c   = counts();
  chartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Login','Signup','Register','Dashboard'],
      datasets: [{
        data: [c.login, c.signup, c.register, c.dashboard],
        backgroundColor: ['#00d4ff22','#00e67622','#a855f722','#ff980022'],
        borderColor:     ['#00d4ff',  '#00e676',  '#a855f7',  '#ff9800'  ],
        borderWidth: 2,
        hoverBorderWidth: 3,
        hoverOffset: 5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111827',
          borderColor: '#1e2d40',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#8899aa',
          callbacks: { label: c => ` ${c.parsed} URL${c.parsed !== 1 ? 's' : ''}` }
        }
      }
    }
  });
  updateChartCenter(counts().total);
}

function updateChart(c) {
  if (!chartInst) return;
  chartInst.data.datasets[0].data = [c.login, c.signup, c.register, c.dashboard];
  chartInst.update();
  updateChartCenter(c.total);
}

function updateChartCenter(total) {
  document.getElementById('chart-center-num').textContent = total;
}

/* ── TAGS ── */
function renderTags() {
  const wrap = document.getElementById('tags-wrap');
  // Remove old chips (keep input)
  wrap.querySelectorAll('.tag-chip').forEach(c => c.remove());
  const inp = wrap.querySelector('.tags-input');
  currentTagInput.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${esc(tag)}<button class="tag-rm" data-tag="${esc(tag)}">×</button>`;
    wrap.insertBefore(chip, inp);
  });
  // Remove listeners then re-add
  wrap.querySelectorAll('.tag-rm').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTagInput = currentTagInput.filter(t => t !== btn.dataset.tag);
      renderTags();
    });
  });
}

function initTagInput() {
  const inp = document.getElementById('tag-inp');
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = inp.value.trim().replace(/,$/, '');
      if (val && !currentTagInput.includes(val)) {
        currentTagInput.push(val);
        renderTags();
      }
      inp.value = '';
    }
    if (e.key === 'Backspace' && inp.value === '' && currentTagInput.length) {
      currentTagInput.pop();
      renderTags();
    }
  });
  document.getElementById('tags-wrap').addEventListener('click', () => inp.focus());
}

/* ── ADD URL ── */
function addUrl() {
  const urlInp  = document.getElementById('inp-url');
  const catSel  = document.getElementById('inp-cat');
  const noteInp = document.getElementById('inp-note');
  const errEl   = document.getElementById('url-err');

  const raw  = urlInp.value.trim();
  const cat  = catSel.value;
  const note = noteInp.value.trim();

  urlInp.classList.remove('inp-error','inp-ok');
  errEl.textContent = '';

  if (!raw) {
    urlInp.classList.add('inp-error');
    errEl.textContent = '⚠ URL cannot be empty';
    urlInp.focus();
    return;
  }

  let finalUrl;
  try {
    finalUrl = new URL(raw.startsWith('http') ? raw : 'https://' + raw).href;
  } catch {
    urlInp.classList.add('inp-error');
    errEl.textContent = '⚠ Invalid URL — try https://example.com/login';
    urlInp.focus();
    return;
  }

  // Duplicate check
  const dup = DB.urls.some(u => norm(u.url) === norm(finalUrl));
  if (dup) {
    urlInp.classList.add('inp-error');
    errEl.innerHTML = '🔴 This URL already exists in your list!';
    toast('Duplicate detected! URL already in list', 'error');
    urlInp.focus();
    return;
  }

  DB.urls.unshift({ id: crypto.randomUUID(), url: finalUrl, category: cat, tags: [...currentTagInput], note, addedAt: Date.now() });
  persist();

  // Reset form
  urlInp.value = '';
  noteInp.value = '';
  currentTagInput = [];
  renderTags();
  urlInp.classList.add('inp-ok');
  setTimeout(() => urlInp.classList.remove('inp-ok'), 1500);

  renderStats();
  renderTable();
  toast(`✅ URL added to ${CATS[cat].label}`, 'success');
}

/* ── TABLE ── */
function renderTable() {
  const tbody  = document.getElementById('tbl-body');
  const empty  = document.getElementById('empty-st');
  const dups   = dupIds();

  let rows = [...DB.urls];
  if (DB.filter !== 'all') rows = rows.filter(r => r.category === DB.filter);
  if (DB.search.trim()) {
    const q = DB.search.toLowerCase();
    rows = rows.filter(r =>
      r.url.toLowerCase().includes(q) ||
      (r.note || '').toLowerCase().includes(q) ||
      (r.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  if (!rows.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const ds = dups;
  tbody.innerHTML = rows.map((r, i) => {
    const isDup = ds.has(r.id);
    const cat   = CATS[r.category];
    const date  = new Date(r.addedAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' });
    const tags  = (r.tags || []).map(t => `<span class="tag-pill">${esc(t)}</span>`).join('');
    return `
    <tr class="${isDup ? 'dup-row' : ''}">
      <td style="color:var(--text3);font-size:11px;">${String(i+1).padStart(2,'0')}</td>
      <td class="url-td" title="${esc(r.url)}"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(truncUrl(r.url))}</a></td>
      <td><span class="cat-badge ${cat.cls}">${cat.icon} ${cat.label}</span></td>
      <td>${tags || '<span style="color:var(--text3);font-size:11px;">—</span>'}</td>
      <td style="font-size:11.5px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(r.note || '—')}</td>
      <td style="font-size:11px;color:var(--text3);white-space:nowrap;">${date}</td>
      <td>
        ${isDup
          ? '<span class="st-dup"><span class="st-dot" style="background:#ff4757"></span>Duplicate</span>'
          : '<span class="st-ok"><span class="st-dot" style="background:#00e676"></span>Unique</span>'}
      </td>
      <td>
        <div class="row-acts">
          <button class="btn btn-ghost btn-icon btn-sm" onclick="copyUrl('${r.id}')" title="Copy">📋</button>
          <button class="btn btn-danger btn-icon btn-sm" onclick="openDel('${r.id}')" title="Delete">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function truncUrl(url) {
  try {
    const u = new URL(url);
    const s = u.hostname + u.pathname;
    return s.length > 48 ? s.slice(0,45) + '…' : s;
  } catch { return url.length > 48 ? url.slice(0,45) + '…' : url; }
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── FILTER ── */
function setFilter(cat) {
  DB.filter = cat;
  document.querySelectorAll('.ftab').forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
  document.querySelectorAll('.sb-item[data-cat]').forEach(n => n.classList.toggle('active', n.dataset.cat === cat));
  renderTable();
}

/* ── SEARCH ── */
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    document.getElementById('search-inp').focus();
  }
});

/* ── DELETE ── */
function openDel(id) {
  DB.deleteId = id;
  const r = DB.urls.find(u => u.id === id);
  if (!r) return;
  document.getElementById('del-preview').textContent = r.url;
  document.getElementById('del-modal').classList.add('open');
}

function closeDel() {
  DB.deleteId = null;
  document.getElementById('del-modal').classList.remove('open');
}

function confirmDel() {
  if (!DB.deleteId) return;
  DB.urls = DB.urls.filter(u => u.id !== DB.deleteId);
  persist();
  renderStats();
  renderTable();
  toast('🗑 URL deleted', 'info');
  closeDel();
}

/* ── COPY ── */
function copyUrl(id) {
  const r = DB.urls.find(u => u.id === id);
  if (!r) return;
  navigator.clipboard.writeText(r.url).then(() => toast('📋 Copied!', 'success'));
}

/* ── EXPORT ── */
function exportExcel() {
  if (!DB.urls.length) { toast('No URLs to export', 'error'); return; }
  const dups = dupIds();
  const data = [
    ['#','URL','Category','Tags','Notes','Status','Date Added'],
    ...DB.urls.map((r,i) => [
      i+1, r.url, CATS[r.category].label,
      (r.tags||[]).join(', '), r.note||'',
      dups.has(r.id) ? 'DUPLICATE' : 'Unique',
      new Date(r.addedAt).toLocaleString('en-IN'),
    ])
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:4},{wch:60},{wch:12},{wch:25},{wch:30},{wch:10},{wch:20}];
  XLSX.utils.book_append_sheet(wb, ws, 'All URLs');

  Object.entries(CATS).forEach(([key,cat]) => {
    const rows = DB.urls.filter(r => r.category === key);
    if (!rows.length) return;
    const wsC = XLSX.utils.aoa_to_sheet([
      ['#','URL','Tags','Notes','Status','Date'],
      ...rows.map((r,i) => [i+1,r.url,(r.tags||[]).join(', '),r.note||'',dups.has(r.id)?'DUPLICATE':'Unique',new Date(r.addedAt).toLocaleString('en-IN')])
    ]);
    wsC['!cols'] = [{wch:4},{wch:60},{wch:25},{wch:30},{wch:10},{wch:20}];
    XLSX.utils.book_append_sheet(wb, wsC, cat.label);
  });

  const fname = `BugHunter_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, fname);
  toast(`📥 Exported: ${fname}`, 'success');
}

/* ── IMPORT ── */
function openImport() { document.getElementById('import-modal').classList.add('open'); }
function closeImport() { document.getElementById('import-modal').classList.remove('open'); }

function doImport() {
  const text = document.getElementById('import-text').value.trim();
  const cat  = document.getElementById('import-cat').value;
  if (!text) { toast('Paste some URLs first', 'error'); return; }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let added = 0, skipped = 0;

  lines.forEach(raw => {
    let url;
    try { url = new URL(raw.startsWith('http') ? raw : 'https://' + raw).href; }
    catch { skipped++; return; }

    if (DB.urls.some(u => norm(u.url) === norm(url))) { skipped++; return; }

    DB.urls.unshift({ id: crypto.randomUUID(), url, category: cat, tags: [], note: '', addedAt: Date.now() });
    added++;
  });

  persist();
  renderStats();
  renderTable();
  document.getElementById('import-text').value = '';
  closeImport();
  toast(`✅ Imported ${added} URLs${skipped ? ` (${skipped} skipped)` : ''}`, 'success');
}

/* ── SCAN MODAL ── */
function openScan() { document.getElementById('scan-modal').classList.add('open'); }
function closeScan() { document.getElementById('scan-modal').classList.remove('open'); }

/* ── CLEAR ALL ── */
function clearAll() {
  if (!DB.urls.length) return;
  if (!confirm(`Delete ALL ${DB.urls.length} URLs?`)) return;
  DB.urls = [];
  persist();
  renderStats();
  renderTable();
  toast('🗑 All URLs cleared', 'info');
}

/* ── TOAST ── */
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast t-${type}`;
  el.innerHTML = `<span>${msg}</span>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3000);
}

/* ── INIT ── */
function init() {
  hydrate();
  initTagInput();

  document.getElementById('btn-add').addEventListener('click', addUrl);
  document.getElementById('inp-url').addEventListener('keydown', e => { if (e.key === 'Enter') addUrl(); });
  document.getElementById('btn-reset').addEventListener('click', () => {
    document.getElementById('inp-url').value = '';
    document.getElementById('inp-note').value = '';
    document.getElementById('url-err').textContent = '';
    document.getElementById('inp-url').classList.remove('inp-error','inp-ok');
    currentTagInput = []; renderTags();
  });

  document.getElementById('search-inp').addEventListener('input', e => { DB.search = e.target.value; renderTable(); });

  document.querySelectorAll('.ftab').forEach(t => t.addEventListener('click', () => setFilter(t.dataset.cat)));
  document.querySelectorAll('.sb-item[data-cat]').forEach(n => n.addEventListener('click', () => setFilter(n.dataset.cat)));

  document.getElementById('btn-export').addEventListener('click', exportExcel);
  document.getElementById('btn-clear').addEventListener('click', clearAll);

  // Import
  document.getElementById('sb-import').addEventListener('click', openImport);
  document.getElementById('btn-import-close').addEventListener('click', closeImport);
  document.getElementById('btn-import-do').addEventListener('click', doImport);
  document.getElementById('import-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeImport(); });

  // Scan
  document.getElementById('sb-scan').addEventListener('click', openScan);
  document.getElementById('btn-scan-close').addEventListener('click', closeScan);
  document.getElementById('scan-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeScan(); });

  // Delete
  document.getElementById('btn-del-ok').addEventListener('click', confirmDel);
  document.getElementById('btn-del-no').addEventListener('click', closeDel);
  document.getElementById('del-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeDel(); });

  renderStats();
  renderTable();
  initChart();
}

document.addEventListener('DOMContentLoaded', init);
