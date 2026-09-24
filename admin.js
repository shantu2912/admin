/* ===== CONFIG: change these to match your database ===== */
const ORDERS_TABLE = 'jobs';          // your orders/bookings table name
const DONE = ['completed', 'done'];       // statuses that count as revenue
const ORDER_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
/* Column fallbacks: first one that exists on the row is used */
const COL = {
  name:    ['customer_name', 'name', 'user_name'],
  phone:   ['customer_phone', 'phone', 'mobile'],
  service: ['service', 'service_name', 'category'],
  amount:  ['amount', 'total', 'price', 'total_amount'],
  tech:    ['technician_id', 'assigned_to']
};

window.sb = supabase.createClient(
  "https://kzxdxnxgouthsywbsnvl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6eGR4bnhnb3V0aHN5d2JzbnZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMTczMzIsImV4cCI6MjA4MTg5MzMzMn0.nqzn89vmTFKVNuZPHfGRxdTg6UHT6GMud238rr49qag"
);

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick = (o, keys) => { for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k]; return ''; };
const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const lc = s => String(s || 'pending').toLowerCase();

let orders = [], techs = [];
let orderFilter = 'all', techFilter = 'pending', query = '';
const freshIds = new Set();

const ORDER_TABS = {
  all: { label: 'All', test: () => true },
  pending: { label: 'Pending', test: o => lc(o.status) === 'pending' },
  active: { label: 'Active', test: o => ['confirmed', 'accepted', 'in_progress', 'assigned'].includes(lc(o.status)) },
  completed: { label: 'Completed', test: o => DONE.includes(lc(o.status)) },
  cancelled: { label: 'Cancelled', test: o => ['cancelled', 'canceled', 'rejected'].includes(lc(o.status)) }
};
const BADGE = {
  pending: 'bg-yellow-100 text-yellow-800', confirmed: 'bg-blue-100 text-blue-800', accepted: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-indigo-100 text-indigo-800', completed: 'bg-green-100 text-green-800', done: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800', approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800'
};

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), 4000);
}
function ago(d) {
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
  if (m < 1440) return Math.floor(m / 60) + ' h ago';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
const isToday = d => new Date(d).toDateString() === new Date().toDateString();

/* ===== DATA ===== */
async function loadOrders() {
  const { data, error } = await sb.from(ORDERS_TABLE).select('*').order('created_at', { ascending: false }).limit(300);
  if (error) {
    $('orderList').innerHTML = '';
    $('orderEmpty').textContent = `Could not load "${ORDERS_TABLE}": ${error.message}. Check ORDERS_TABLE in admin.js and your RLS policies.`;
    $('orderEmpty').classList.remove('hidden');
    return;
  }
  orders = data || [];
  renderOrders(); renderKpis(); renderChart(); renderHero();
}
async function loadTechs() {
  const { data, error } = await sb.from('technicians').select('*').order('created_at', { ascending: false });
  if (error) return console.error('Error loading technicians:', error);
  techs = data || [];
  $('pendingCount').innerText = techs.filter(t => t.status === 'pending').length;
  $('approvedCount').innerText = techs.filter(t => t.status === 'approved').length;
  $('rejectedCount').innerText = techs.filter(t => t.status === 'rejected').length;
  renderHero();
  renderTechs();
}
async function loadAll() {
  await Promise.all([loadOrders(), loadTechs()]);
  $('lastSync').textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/* ===== RENDER: KPIs + CHART ===== */
function renderKpis() {
  const today = orders.filter(o => isToday(o.created_at));
  const yest = orders.filter(o => new Date(o.created_at).toDateString() === new Date(Date.now() - 864e5).toDateString());
  $('kOrdersToday').textContent = today.length;
  const diff = today.length - yest.length;
  $('kOrdersDelta').textContent = diff === 0 ? 'Same as yesterday' : `${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'} than yesterday`;
  $('kOrdersPending').textContent = orders.filter(ORDER_TABS.pending.test).length;
  $('kRevenue').textContent = inr(today.filter(ORDER_TABS.completed.test).reduce((s, o) => s + Number(pick(o, COL.amount) || 0), 0));
}
function renderChart() {
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const counts = days.map(d => orders.filter(o => new Date(o.created_at).toDateString() === d.toDateString()).length);
  const max = Math.max(...counts, 1);
  $('chartNote').textContent = counts.reduce((a, b) => a + b, 0) + ' orders this week';
  $('chart').innerHTML = days.map((d, i) => `
    <div class="flex-1 flex flex-col items-center justify-end h-full gap-1">
      <span class="text-[11px] font-semibold text-brand-olive">${counts[i]}</span>
      <div class="w-full rounded-t-md ${i === 6 ? 'bg-brand-gold' : 'bg-brand-olive/30'}" style="height:${Math.max(counts[i] / max * 100, 4)}%"></div>
      <span class="text-[11px] text-brand-dark/50">${d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
    </div>`).join('');
}

/* ===== RENDER: ORDERS ===== */
function renderTabs() {
  $('orderTabs').innerHTML = Object.entries(ORDER_TABS).map(([k, t]) => {
    const n = orders.filter(t.test).length;
    return `<button data-tab="${k}" class="px-4 py-2 rounded-full whitespace-nowrap ${orderFilter === k ? 'tab-on' : 'bg-brand-cream/70 text-brand-olive'}">${t.label} <span class="opacity-60">${n}</span></button>`;
  }).join('');
}
function renderOrders() {
  renderTabs();
  const q = query.toLowerCase();
  const rows = orders.filter(ORDER_TABS[orderFilter].test).filter(o =>
    !q || [pick(o, COL.name), pick(o, COL.phone), pick(o, COL.service)].join(' ').toLowerCase().includes(q));
  $('orderEmpty').textContent = 'No orders match this filter.';
  $('orderEmpty').classList.toggle('hidden', rows.length > 0);
  $('orderList').innerHTML = rows.slice(0, 100).map(o => {
    const s = lc(o.status);
    const opts = [...new Set([...ORDER_STATUSES, s])].map(x => `<option value="${esc(x)}" ${x === s ? 'selected' : ''}>${esc(x.replace('_', ' '))}</option>`).join('');
    return `<tr data-open="${esc(o.id)}" class="cursor-pointer hover:bg-brand-cream/30 ${freshIds.has(o.id) ? 'new-row' : ''}">
      <td class="px-5 py-3"><p class="font-semibold text-brand-olive">${esc(pick(o, COL.name)) || 'Unnamed customer'}</p>
        <p class="text-xs text-brand-dark/50">${esc(pick(o, COL.phone))}</p></td>
      <td class="px-5 py-3">${esc(pick(o, COL.service)) || '-'}</td>
      <td class="px-5 py-3 text-brand-dark/60 whitespace-nowrap">${ago(o.created_at)}</td>
      <td class="px-5 py-3 text-right font-semibold">${inr(pick(o, COL.amount))}</td>
      <td class="px-5 py-3"><select data-order="${esc(o.id)}" aria-label="Order status" class="text-xs font-semibold rounded-full px-3 py-1.5 border-0 ${BADGE[s] || 'bg-gray-100 text-gray-700'}">${opts}</select></td>
    </tr>`;
  }).join('');
}

/* ===== RENDER: TECHNICIANS ===== */
function renderTechs() {
  $('techTabs').innerHTML = ['pending', 'approved', 'rejected'].map(k =>
    `<button data-tt="${k}" class="px-3 py-1.5 rounded-full capitalize ${techFilter === k ? 'tab-on' : 'bg-brand-cream/70 text-brand-olive'}">${k}</button>`).join('');
  const rows = techs.filter(t => t.status === techFilter);
  $('techList').innerHTML = rows.length ? rows.map(t => `
    <li class="px-5 py-4 flex items-center justify-between gap-3">
      <div class="min-w-0"><p class="font-semibold text-brand-olive truncate">${esc(t.name)}</p>
        <p class="text-xs text-brand-dark/50 truncate">${esc(t.category)} &middot; ${esc(t.phone)}</p></div>
      <div class="flex gap-2 shrink-0">
        ${t.status !== 'approved' ? `<button data-tech="${esc(t.id)}" data-to="approved" aria-label="Approve ${esc(t.name)}" class="w-9 h-9 bg-green-50 text-green-700 rounded-lg hover:bg-green-600 hover:text-white"><i class="fa-solid fa-check"></i></button>` : ''}
        ${t.status !== 'rejected' ? `<button data-tech="${esc(t.id)}" data-to="rejected" aria-label="Reject ${esc(t.name)}" class="w-9 h-9 bg-red-50 text-red-700 rounded-lg hover:bg-red-600 hover:text-white"><i class="fa-solid fa-xmark"></i></button>` : ''}
      </div></li>`).join('')
    : `<li class="p-8 text-center text-sm text-brand-dark/50">No ${techFilter} technicians.</li>`;
}

/* ===== ACTIONS (event delegation, no inline handlers) ===== */
$('orderTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { orderFilter = b.dataset.tab; renderOrders(); } });
$('techTabs').addEventListener('click', e => { const b = e.target.closest('[data-tt]'); if (b) { techFilter = b.dataset.tt; renderTechs(); } });
$('orderSearch').addEventListener('input', e => { query = e.target.value.trim(); renderOrders(); });
$('refreshBtn').addEventListener('click', loadAll);

$('orderList').addEventListener('change', async e => {
  const sel = e.target.closest('[data-order]'); if (!sel) return;
  const { error } = await sb.from(ORDERS_TABLE).update({ status: sel.value }).eq('id', sel.dataset.order);
  if (error) { toast('Could not update order: ' + error.message); return loadOrders(); }
  toast('Order marked ' + sel.value.replace('_', ' ')); loadOrders();
});
$('techList').addEventListener('click', async e => {
  const b = e.target.closest('[data-tech]'); if (!b) return;
  const { error } = await sb.from('technicians').update({ status: b.dataset.to }).eq('id', b.dataset.tech);
  if (error) return toast('Could not update technician: ' + error.message);
  toast('Technician ' + b.dataset.to); loadTechs();
});

/* ===== HERO ===== */
function renderHero() {
  const h = new Date().getHours();
  $('greet').textContent = (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + ', admin';
  $('hOrders').textContent = orders.filter(ORDER_TABS.pending.test).length;
  $('hTechs').textContent = techs.filter(t => t.status === 'pending').length;
}

/* ===== ORDER DRAWER (details + assign technician) ===== */
const HIDE = ['id'];
function openOrder(id) {
  const o = orders.find(x => String(x.id) === String(id)); if (!o) return;
  $('dTitle').textContent = pick(o, COL.name) || 'Order';
  const techCol = COL.tech.find(k => k in o) || COL.tech[0];
  const approved = techs.filter(t => t.status === 'approved');
  const phone = String(pick(o, COL.phone)).replace(/[^\d+]/g, '');
  const rows = Object.entries(o).filter(([k, v]) => v !== null && v !== '' && !HIDE.includes(k) && typeof v !== 'object')
    .map(([k, v]) => `<div class="py-2 border-b border-brand-cream/70"><p class="text-xs text-brand-dark/50">${esc(k.replace(/_/g, ' '))}</p><p class="text-sm font-medium break-words">${esc(v)}</p></div>`).join('');
  $('dBody').innerHTML = `
    ${phone ? `<a href="tel:${esc(phone)}" class="flex items-center justify-center gap-2 w-full py-3 mb-4 rounded-xl bg-brand-olive text-white font-bold text-sm"><i class="fa-solid fa-phone"></i> Call customer</a>` : ''}
    <label class="text-xs font-semibold text-brand-olive" for="dTech">Assigned technician</label>
    <select id="dTech" data-oid="${esc(o.id)}" data-col="${esc(techCol)}" class="w-full mt-1 mb-4 px-4 py-3 rounded-xl bg-brand-cream/60 text-sm">
      <option value="">Unassigned</option>
      ${approved.map(t => `<option value="${esc(t.id)}" ${String(o[techCol]) === String(t.id) ? 'selected' : ''}>${esc(t.name)} (${esc(t.category)})</option>`).join('')}
    </select>${rows}`;
  $('drawer').classList.remove('hidden'); $('dClose').focus();
}
const closeDrawer = () => $('drawer').classList.add('hidden');
$('orderList').addEventListener('click', e => { const r = e.target.closest('[data-open]'); if (r && !e.target.closest('select')) openOrder(r.dataset.open); });
$('dClose').addEventListener('click', closeDrawer); $('drawerBg').addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
$('dBody').addEventListener('change', async e => {
  const s = e.target.closest('#dTech'); if (!s) return;
  const { error } = await sb.from(ORDERS_TABLE).update({ [s.dataset.col]: s.value || null }).eq('id', s.dataset.oid);
  toast(error ? 'Could not assign: ' + error.message : 'Technician assigned'); loadOrders();
});

/* ===== CSV EXPORT (formula-injection safe) ===== */
$('exportBtn').addEventListener('click', () => {
  if (!orders.length) return toast('No orders to export');
  const keys = [...new Set(orders.flatMap(o => Object.keys(o).filter(k => typeof o[k] !== 'object' || o[k] === null)))];
  const cell = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const csv = [keys.join(','), ...orders.map(o => keys.map(k => cell(o[k])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `fixzen-orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
});

/* ===== AUTH GATE: sign-in, admin check, idle logout ===== */
const IDLE_MS = 15 * 60 * 1000;
let started = false, idleT, fails = 0, lockUntil = 0;
function showGate(msg) { $('gate').classList.remove('hidden'); $('gateErr').textContent = msg || ''; }
function resetIdle() { clearTimeout(idleT); idleT = setTimeout(() => sb.auth.signOut(), IDLE_MS); }

async function requireAdmin(session) {
  if (!session) return showGate();
  const { data, error } = await sb.rpc('is_admin');
  if (error || data !== true) { await sb.auth.signOut(); return showGate('This account does not have admin access.'); }
  $('gate').classList.add('hidden'); startApp();
}
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (Date.now() < lockUntil) return showGate('Too many attempts. Wait a minute and try again.');
  $('loginBtn').disabled = true;
  const { data, error } = await sb.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
  $('loginBtn').disabled = false; $('password').value = '';
  if (error) { if (++fails >= 5) { lockUntil = Date.now() + 60000; fails = 0; } return showGate('Email or password is incorrect.'); }
  fails = 0; requireAdmin(data.session);
});
$('googleBtn').addEventListener('click', async () => {
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  if (error) showGate('Google sign-in failed: ' + error.message);
});
$('logoutBtn').addEventListener('click', () => sb.auth.signOut());
sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') location.reload(); }); // clears data from memory

/* ===== REALTIME (starts only after admin sign-in) ===== */
function setLive(ok) {
  $('liveDot').className = 'live-dot w-2 h-2 rounded-full ' + (ok ? 'bg-green-500' : 'bg-gray-300');
  $('liveText').textContent = ok ? 'Live' : 'Offline';
}
function startApp() {
  if (started) return; started = true;
  sb.channel('admin-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: ORDERS_TABLE }, p => {
      if (p.eventType === 'INSERT') { freshIds.add(p.new.id); toast('New order from ' + (pick(p.new, COL.name) || 'a customer')); }
      loadOrders();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'technicians' }, p => {
      if (p.eventType === 'INSERT') toast('New technician request: ' + (p.new.name || ''));
      loadTechs();
    })
    .subscribe(s => setLive(s === 'SUBSCRIBED'));
  setInterval(loadAll, 60000);
  ['click', 'keydown', 'mousemove', 'touchstart'].forEach(ev => document.addEventListener(ev, resetIdle, { passive: true }));
  resetIdle(); loadAll();
}
sb.auth.getSession().then(({ data }) => requireAdmin(data.session));
