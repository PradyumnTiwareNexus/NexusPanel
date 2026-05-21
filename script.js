/* ─── STATE ─────────────────────────────────────────── */
const STORAGE_KEY = 'bhd_urls_v2';
const CATS = {
  login:     { label: 'Login',     color: '#00d4ff', icon: '🔐' },
  signup:    { label: 'Signup',    color: '#00ff88', icon: '✍️'  },
  register:  { label: 'Register',  color: '#a855f7', icon: '📝' },
  dashboard: { label: 'Dashboard', color: '#ffa502', icon: '📊' },
};

let state = {
  urls: [],          // { id, url, category, note, addedAt }
  filter: 'all',
  search: '',
  deleteId: null,
};

/* ─── PERSIST ────────────────────────────────────────── */
function save()   { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.urls)); }
function load()   { try { state.urls = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { state.urls = []; } }

/* ─── CHART ─────────────────────────────────────────── */
let chartInstance = null;

function initChart() {
  const ctx = document.getElementById('catChart').getContext('2d');
  const data = getCounts();
  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.values(CATS).map(c => c.label),
      datasets: [{
        data: [data.login, data.signup, data.register, data.dashboard],
        backgroundColor: Object.values(CATS).map(c => c.color + '33'),
        borderColor:     Object.values(CATS).map(c => c.color),
        borderWidth: 2,
        hoverBorderWidth: 3,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a2235',
          borderColor: '#1e293b',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          callbacks: {
            label: ctx => ` ${ctx.parsed} URL${ctx.parsed !== 1 ? 's' : ''}`,
          }
        }
      }
    }
  });
}

function updateChart() {
  if (!chartInstance) return;
  const d = getCounts();
  chartInstance.data.datasets[0].data = [d.login, d.signup, d.register, d.dashboard];
  chartInstance.update();
}

/* ─── COUNTS ─────────────────────────────────────────── */
function getCounts() {
  const c = { login: 0, signup: 0, register: 0, dashboard: 0, total: 0 };
  state.urls.forEach(u => { c[u.category]++; c.total++; });
  return c;
}

function getDuplicateIds() {
  const seen = {}, dups = new Set();
  state.urls.forEach(u => {
    const k = u.url.trim().toLowerCase();
    if (seen[k] !== undefined) {
      dups.add(seen[k]);
      dups.add(u.id);
    } else {
      seen[k] = u.id;
    }
  });
  return dups;
}

/* ─── RENDER STATS ───────────────────────────────────── */
function renderStats() {
  const c = getCounts();
  const dupCount = getDuplicateIds().size;
  document.getElementById('stat-total').textContent     = c.total;
  document.getElementById('stat-login').textContent     = c.login;
  document.getElementById('stat-signup').textContent    = c.signup;
  document.getElementById('stat-register').textContent  = c.register;
  document.getElementById('stat-dashboard').textContent = c.dashboard;
  document.getElementById('stat-dups').textContent      = dupCount;
  document.getElementById('total-badge').innerHTML      = `Total: <span>${c.total}</span>`;

  // Nav counts
  document.getElementById('nav-all').textContent       = c.total;
  document.getElementById('nav-login').textContent     = c.login;
  document.getElementById('nav-signup').textContent    = c.signup;
  document.getElementById('nav-register').textContent  = c.register;
  document.getElementById('nav-dashboard').textContent = c.dashboard;

  // Progress bars + percentages + legend counts
  ['login','signup','register','dashboard'].forEach(cat => {
    const bar = document.getElementById(`bar-${cat}`);
    const pct = c.total ? Math.round(c[cat] / c.total * 100) : 0;
    if (bar) bar.style.width = pct + '%';
    const pctEl = document.getElementById(`pct-${cat}`);
    if (pctEl) pctEl.textContent = pct + '%';
    const legEl = document.getElementById(`stat-${cat}-leg`);
    if (legEl) legEl.textContent = c[cat];
  });

  updateChart();
}

/* ─── RENDER TABLE ───────────────────────────────────── */
function renderTable() {
  const tbody  = document.getElementById('url-tbody');
  const empty  = document.getElementById('empty-state');
  const dupIds = getDuplicateIds();

  let rows = [...state.urls];

  // Filter by category
  if (state.filter !== 'all') rows = rows.filter(r => r.category === state.filter);

  // Search
  if (state.search.trim()) {
    const q = state.search.toLowerCase();
    rows = rows.filter(r => r.url.toLowerCase().includes(q) || (r.note || '').toLowerCase().includes(q));
  }

  if (!rows.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = rows.map((r, idx) => {
    const isDup = dupIds.has(r.id);
    const cat   = CATS[r.category];
    const date  = new Date(r.addedAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' });
    return `
    <tr class="${isDup ? 'duplicate-row' : ''}" data-id="${r.id}">
      <td style="color:var(--text-muted);font-size:12px;">${String(idx + 1).padStart(2,'0')}</td>
      <td class="url-cell" title="${escHtml(r.url)}">
        <a href="${escHtml(r.url)}" target="_blank" rel="noopener noreferrer">${escHtml(truncUrl(r.url))}</a>
      </td>
      <td>
        <span class="cat-badge cat-${r.category}">
          <span class="cat-dot" style="background:${cat.color}"></span>
          ${cat.label}
        </span>
      </td>
      <td>
        ${isDup
          ? '<span class="status-dup"><span class="status-dot" style="background:#ff4757"></span>⚠ Duplicate</span>'
          : '<span class="status-ok"><span class="status-dot" style="background:#00ff88"></span>Unique</span>'}
      </td>
      <td style="font-size:12px;color:var(--text-muted);">${date}</td>
      <td style="font-size:12px;color:var(--text-muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(r.note || '—')}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost btn-icon btn-sm" onclick="copyUrl('${r.id}')" title="Copy URL">📋</button>
          <button class="btn btn-danger btn-icon btn-sm" onclick="openDelete('${r.id}')" title="Delete">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function truncUrl(url) {
  try {
    const u = new URL(url);
    const full = u.hostname + u.pathname;
    return full.length > 55 ? full.substring(0, 52) + '…' : full;
  } catch { return url.length > 55 ? url.substring(0, 52) + '…' : url; }
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── ADD URL ────────────────────────────────────────── */
function addUrl() {
  const urlInput = document.getElementById('inp-url');
  const catSel   = document.getElementById('inp-cat');
  const noteInp  = document.getElementById('inp-note');
  const errEl    = document.getElementById('url-error');

  const rawUrl  = urlInput.value.trim();
  const cat     = catSel.value;
  const note    = noteInp.value.trim();

  // Reset
  urlInput.classList.remove('error','success');
  errEl.textContent = '';

  // Validate non-empty
  if (!rawUrl) {
    urlInput.classList.add('error');
    errEl.textContent = '⚠ URL cannot be empty';
    urlInput.focus();
    return;
  }

  // Validate URL format
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl);
  } catch {
    urlInput.classList.add('error');
    errEl.textContent = '⚠ Invalid URL format — e.g. https://example.com/login';
    urlInput.focus();
    return;
  }

  const normalised = parsedUrl.href;

  // Duplicate check
  const exists = state.urls.some(u => u.url.trim().toLowerCase() === normalised.toLowerCase());
  if (exists) {
    urlInput.classList.add('error');
    errEl.innerHTML = '🔴 This URL already exists in your list!';
    urlInput.focus();
    toast(`Duplicate detected! URL already in ${CATS[cat].label}`, 'error');
    return;
  }

  // Add
  const entry = {
    id:       crypto.randomUUID(),
    url:      normalised,
    category: cat,
    note:     note,
    addedAt:  Date.now(),
  };

  state.urls.unshift(entry);
  save();

  urlInput.value  = '';
  noteInp.value   = '';
  urlInput.classList.add('success');
  setTimeout(() => urlInput.classList.remove('success'), 1500);

  renderStats();
  renderTable();
  toast(`✅ URL added to ${CATS[cat].label}`, 'success');
}

/* ─── DELETE ─────────────────────────────────────────── */
function openDelete(id) {
  state.deleteId = id;
  const entry = state.urls.find(u => u.id === id);
  if (!entry) return;
  document.getElementById('del-url-preview').textContent = entry.url;
  document.getElementById('del-modal').classList.add('open');
}

function closeDelete() {
  state.deleteId = null;
  document.getElementById('del-modal').classList.remove('open');
}

function confirmDelete() {
  if (!state.deleteId) return;
  state.urls = state.urls.filter(u => u.id !== state.deleteId);
  save();
  renderStats();
  renderTable();
  toast('🗑 URL deleted', 'info');
  closeDelete();
}

/* ─── COPY ───────────────────────────────────────────── */
function copyUrl(id) {
  const entry = state.urls.find(u => u.id === id);
  if (!entry) return;
  navigator.clipboard.writeText(entry.url).then(() => toast('📋 Copied to clipboard!', 'success'));
}

/* ─── EXPORT TO EXCEL ───────────────────────────────── */
function exportExcel() {
  if (!state.urls.length) { toast('No URLs to export', 'error'); return; }
  const dupIds = getDuplicateIds();

  const data = [
    ['#', 'URL', 'Category', 'Status', 'Note', 'Date Added'],
    ...state.urls.map((r, i) => [
      i + 1,
      r.url,
      CATS[r.category].label,
      dupIds.has(r.id) ? 'DUPLICATE' : 'Unique',
      r.note || '',
      new Date(r.addedAt).toLocaleString('en-IN'),
    ])
  ];

  const wb  = XLSX.utils.book_new();
  const ws  = XLSX.utils.aoa_to_sheet(data);

  // Column widths
  ws['!cols'] = [{ wch: 4 }, { wch: 60 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 20 }];

  XLSX.utils.book_append_sheet(wb, ws, 'BugHunter URLs');

  // Per-category sheets
  Object.entries(CATS).forEach(([key, cat]) => {
    const catData = state.urls.filter(r => r.category === key);
    if (!catData.length) return;
    const wsC = XLSX.utils.aoa_to_sheet([
      ['#', 'URL', 'Status', 'Note', 'Date Added'],
      ...catData.map((r, i) => [
        i + 1, r.url,
        dupIds.has(r.id) ? 'DUPLICATE' : 'Unique',
        r.note || '',
        new Date(r.addedAt).toLocaleString('en-IN'),
      ])
    ]);
    wsC['!cols'] = [{ wch: 4 }, { wch: 60 }, { wch: 12 }, { wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsC, cat.label);
  });

  const fname = `BugHunter_URLs_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, fname);
  toast(`📥 Exported: ${fname}`, 'success');
}

/* ─── CLEAR ALL ──────────────────────────────────────── */
function clearAll() {
  if (!state.urls.length) return;
  if (!confirm(`Delete ALL ${state.urls.length} URLs? This cannot be undone.`)) return;
  state.urls = [];
  save();
  renderStats();
  renderTable();
  toast('🗑 All URLs cleared', 'info');
}

/* ─── FILTER ─────────────────────────────────────────── */
function setFilter(cat) {
  state.filter = cat;
  // Update tabs
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
  // Update sidebar
  document.querySelectorAll('.nav-item[data-cat]').forEach(n => n.classList.toggle('active', n.dataset.cat === cat));
  renderTable();
}

/* ─── SEARCH ─────────────────────────────────────────── */
function onSearch(e) {
  state.search = e.target.value;
  renderTable();
}

/* ─── TOAST ─────────────────────────────────────────── */
function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '🔴', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type]}</span> <span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

/* ─── INIT ───────────────────────────────────────────── */
function init() {
  load();

  // Add button
  document.getElementById('btn-add').addEventListener('click', addUrl);

  // Enter key on URL input
  document.getElementById('inp-url').addEventListener('keydown', e => { if (e.key === 'Enter') addUrl(); });

  // Search
  document.getElementById('search-input').addEventListener('input', onSearch);

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(t => {
    t.addEventListener('click', () => setFilter(t.dataset.cat));
  });

  // Sidebar nav
  document.querySelectorAll('.nav-item[data-cat]').forEach(n => {
    n.addEventListener('click', () => setFilter(n.dataset.cat));
  });

  // Export
  document.getElementById('btn-export').addEventListener('click', exportExcel);

  // Clear all
  document.getElementById('btn-clear').addEventListener('click', clearAll);

  // Delete modal
  document.getElementById('btn-del-confirm').addEventListener('click', confirmDelete);
  document.getElementById('btn-del-cancel').addEventListener('click', closeDelete);
  document.getElementById('del-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeDelete(); });

  // Render
  renderStats();
  renderTable();
  initChart();
}

document.addEventListener('DOMContentLoaded', init);
