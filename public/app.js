// ── State ─────────────────────────────────────────────────────────────────────
const S = { user: null, page: 'login', params: {} };

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(d) { if (!d) return '—'; const p = d.split('T')[0].split('-'); return `${p[1]}/${p[2]}/${p[0]}`; }
function ago(d) { if (!d) return ''; const h = Math.floor((Date.now()-new Date(d))/3600000); if (h<1) return 'just now'; if (h<24) return `${h}h ago`; return `${Math.floor(h/24)}d ago`; }
function daysUntil(d) { if (!d) return null; return Math.ceil((new Date(d)-Date.now())/86400000); }

async function apiFetch(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}
const GET = url => apiFetch('GET', url);
const POST = (url, b) => apiFetch('POST', url, b);
const PUT = (url, b) => apiFetch('PUT', url, b);
const DEL = url => apiFetch('DELETE', url);

function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `fixed bottom-4 right-4 px-4 py-3 rounded-lg text-white text-sm font-medium shadow-lg z-50 fade-in ${type==='error'?'bg-red-600':'bg-brand-600'}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function modal(id) { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

function nav(page, params) {
  S.page = page;
  S.params = params || {};
  render();
}

function eligBadge(status) {
  const map = { eligible: 'bg-emerald-100 text-emerald-800', ineligible: 'bg-red-100 text-red-800', pending: 'bg-amber-100 text-amber-800' };
  return `<span class="px-2 py-0.5 rounded-full text-xs font-semibold ${map[status]||'bg-slate-100 text-slate-600'}">${esc(status)}</span>`;
}

function tripStatusBadge(status) {
  const map = { planning: 'bg-slate-100 text-slate-600', confirmed: 'bg-emerald-100 text-emerald-800', departed: 'bg-blue-100 text-blue-800', completed: 'bg-gray-100 text-gray-600' };
  return `<span class="px-2 py-0.5 rounded-full text-xs font-semibold ${map[status]||'bg-slate-100 text-slate-600'}">${esc(status)}</span>`;
}

function actionIcon(icon, onclick, cls = '') {
  const icons = {
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    delete: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>',
    remove: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  };
  return `<button onclick="${onclick}" class="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors ${cls}">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[icon]||''}</svg>
  </button>`;
}

// ── Shell ─────────────────────────────────────────────────────────────────────
function shell(content, modals = '') {
  const school = S._school?.name || 'Operation Pivot';
  const isCoach = S.user?.role === 'coach';
  const allNavLinks = [
    { page: 'dashboard', label: 'Dashboard', svg: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' },
    { page: 'gameday', label: 'Game Day', svg: '<path d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>' },
    { page: 'trips', label: 'Trips', svg: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>' },
    { page: 'sports', label: 'Sports', svg: '<circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l4.24 4.24"/><path d="M14.83 9.17l4.24-4.24"/><path d="M14.83 14.83l4.24 4.24"/><path d="M9.17 14.83l-4.24 4.24"/><circle cx="12" cy="12" r="4"/>', adminOnly: true },
    { page: 'roster', label: 'Roster', svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
    { page: 'reports', label: 'Reports', svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>', adminOnly: true },
    { page: 'settings', label: 'Settings', svg: '<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 19.07l1.41-1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/>', adminOnly: true },
  ];
  const navLinks = allNavLinks.filter(l => !l.adminOnly || !isCoach);

  return `
  <div class="flex min-h-screen">
    <aside class="w-56 flex-shrink-0 flex flex-col" style="background:#0f172a;position:fixed;top:0;left:0;bottom:0;z-index:40">
      <div class="px-4 py-5 border-b border-slate-700/50">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:#059669">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <div>
            <div class="text-white font-bold text-sm tracking-wide">PIVOT</div>
            <div class="text-slate-400 text-xs truncate max-w-32">${esc(school)}</div>
          </div>
        </div>
      </div>
      <nav class="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        ${navLinks.map(l => `
          <a class="nav-link ${S.page===l.page?'active':''}" onclick="nav('${l.page}')">
            <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${l.svg}</svg>
            ${l.label}
          </a>`).join('')}
      </nav>
      <div class="px-2 py-3 border-t border-slate-700/50">
        <div class="px-3 py-2">
          <div class="text-white text-sm font-medium truncate">${esc(S.user?.name||'')}</div>
          <div class="text-slate-400 text-xs capitalize">${esc(S.user?.role||'')}</div>
        </div>
        <a class="nav-link mt-1" onclick="logout()">
          <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign out
        </a>
      </div>
    </aside>
    <main class="flex-1 ml-56 min-h-screen">
      <div class="max-w-6xl mx-auto px-6 py-6">
        ${content}
      </div>
    </main>
  </div>
  ${modals}`;
}

// ── Render ────────────────────────────────────────────────────────────────────
async function render() {
  const app = document.getElementById('app');
  if (!S.user && S.page !== 'login') { nav('login'); return; }
  if (S.page === 'login') { app.innerHTML = renderLogin(); bindLoginEvents(); return; }

  if (!S._school) {
    try { S._school = await GET('/api/school'); } catch {}
  }

  let content = '', modals = '';
  try {
    switch (S.page) {
      case 'dashboard':    [content, modals] = await renderDashboard(); break;
      case 'gameday':      [content, modals] = await renderGameDay(); break;
      case 'gameday-roster': [content, modals] = await renderGameRoster(); break;
      case 'trips':        [content, modals] = await renderTrips(); break;
      case 'trip-detail':  [content, modals] = await renderTripDetail(); break;
      case 'sports':       [content, modals] = await renderSports(); break;
      case 'roster':       [content, modals] = await renderRoster(); break;
      case 'reports':      [content, modals] = await renderReports(); break;
      case 'settings':     [content, modals] = await renderSettings(); break;
      default: content = '<p class="text-slate-500">Page not found.</p>'; modals = '';
    }
  } catch (e) {
    content = `<div class="p-4 bg-red-50 text-red-700 rounded-lg text-sm">Error: ${esc(e.message)}</div>`;
    modals = '';
  }
  app.innerHTML = shell(content, modals);
}

// ── Login ─────────────────────────────────────────────────────────────────────
function renderLogin() {
  const demoAccounts = [
    { name: 'Marcus Webb', role: 'Athletic Director', badge: 'AD', email: 'admin@operationpivot.demo', color: '#059669', bg: '#d1fae5', text: '#065f46' },
    { name: 'Jordan Hayes', role: 'Staff / Asst. AD', badge: 'ST', email: 'staff@operationpivot.demo', color: '#2563eb', bg: '#dbeafe', text: '#1e40af' },
    { name: 'Coach Davis', role: 'Head Coach', badge: 'HC', email: 'coach@operationpivot.demo', color: '#7c3aed', bg: '#ede9fe', text: '#5b21b6' },
  ];
  return `
  <div class="min-h-screen flex items-center justify-center px-4 py-8" style="background:linear-gradient(135deg,#0f172a 0%,#065f46 100%)">
    <div class="w-full max-w-sm fade-in">
      <div class="text-center mb-7">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style="background:#059669">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <h1 class="text-2xl font-bold text-white">Operation Pivot</h1>
        <p class="text-slate-400 text-sm mt-1">Athletic Director Platform</p>
      </div>

      <div class="bg-white rounded-2xl shadow-2xl p-6 mb-4">
        <div id="login-error" class="hidden mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg"></div>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input id="login-email" type="email" placeholder="you@school.edu" class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input id="login-password" type="password" placeholder="••••••••" class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
          </div>
          <button id="login-btn" class="w-full py-2.5 rounded-lg text-white text-sm font-semibold transition-colors" style="background:#059669">Sign In</button>
        </div>
      </div>

      <div class="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
        <p class="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 text-center">Demo Accounts — click to sign in</p>
        <div class="space-y-2">
          ${demoAccounts.map(a => `
            <button onclick="quickLogin('${a.email}')"
              class="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-left group">
              <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold" style="background:${a.bg};color:${a.text}">${a.badge}</div>
              <div class="flex-1 min-w-0">
                <div class="text-white text-sm font-semibold">${a.name}</div>
                <div class="text-slate-400 text-xs">${a.role}</div>
              </div>
              <svg class="text-slate-500 group-hover:text-white transition-colors" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>`).join('')}
        </div>
        <p class="text-center text-xs text-slate-500 mt-3">Password for all accounts: <span class="text-slate-400 font-mono">pivot123</span></p>
      </div>
    </div>
  </div>`;
}

function bindLoginEvents() {
  document.getElementById('login-btn')?.addEventListener('click', doLogin);
  document.getElementById('login-password')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  err.classList.add('hidden');
  try {
    S.user = await POST('/auth/login', { email, password });
    S._school = null;
    nav('dashboard');
  } catch (e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
  }
}

async function quickLogin(email) {
  try {
    S.user = await POST('/auth/login', { email, password: 'pivot123' });
    S._school = null;
    nav('dashboard');
  } catch (e) {
    const err = document.getElementById('login-error');
    if (err) { err.textContent = e.message; err.classList.remove('hidden'); }
  }
}

async function logout() {
  await POST('/auth/logout');
  S.user = null; S._school = null;
  nav('login');
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function renderDashboard() {
  const [d, atRisk] = await Promise.all([
    GET('/api/dashboard'),
    GET('/api/academic/at-risk').catch(() => []),
  ]);

  const actionLabels = {
    roster_locked: 'Roster Locked', eligibility_change: 'Eligibility Change',
    trip_created: 'Trip Created', athlete_added: 'Athlete Added',
    manifest_removed: 'Manifest Updated', cert_uploaded: 'Cert Uploaded',
    report_generated: 'Report Generated'
  };

  const conflictBanner = d.conflicts > 0 ? `
    <div class="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
      <div class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <div class="flex-1">
        <p class="text-red-800 font-semibold text-sm">${d.conflicts} Eligibility Conflict${d.conflicts>1?'s':''} — Action Required</p>
        <div class="mt-2 space-y-1">
          ${d.conflictDetails.map(c => `
            <div class="text-red-700 text-xs flex items-center gap-2">
              <span class="font-medium">${esc(c.athlete_name)}</span>
              <span class="text-red-400">•</span>
              <span>${eligBadge(c.eligibility_status)}</span>
              <span class="text-red-400">•</span>
              <span>on manifest for <button onclick="nav('trip-detail',{id:${c.trip_id}})" class="underline font-medium">${esc(c.trip_name)}</button> (${fmt(c.depart_date)})</span>
            </div>`).join('')}
        </div>
      </div>
    </div>` : '';

  const certWarning = d.expiringCerts > 0 ? `
    <div class="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span><strong>${d.expiringCerts} tax exemption cert${d.expiringCerts>1?'s':''}</strong> expiring within 60 days. <button onclick="nav('settings')" class="underline font-medium">Review in Settings →</button></span>
    </div>` : '';

  const stats = [
    { label: 'Upcoming Trips', value: d.upcomingTrips, color: 'border-brand-500', icon: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>', click: "nav('trips')" },
    { label: 'Eligibility Alerts', value: d.conflicts, color: d.conflicts>0?'border-red-500':'border-brand-500', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', click: "nav('roster')" },
    { label: 'Certs Expiring', value: d.expiringCerts, color: d.expiringCerts>0?'border-amber-500':'border-brand-500', icon: '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="16" y1="6" x2="8" y2="6"/><line x1="16" y1="10" x2="8" y2="10"/><line x1="11" y1="14" x2="8" y2="14"/>', click: "nav('settings')" },
    { label: 'Ineligible Athletes', value: d.ineligibleAthletes, color: d.ineligibleAthletes>0?'border-orange-400':'border-brand-500', icon: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', click: "nav('roster',{filter:'ineligible'})" },
  ];

  const content = `
    <div class="fade-in">
      <div class="mb-6">
        <h1 class="text-xl font-bold text-slate-900">Dashboard</h1>
        <p class="text-slate-500 text-sm mt-0.5">${S._school?.name||''} · ${S._school?.division||''}</p>
      </div>

      ${conflictBanner}${certWarning}

      ${atRisk.length > 0 ? `
      <div class="mb-5 p-4 rounded-xl border ${atRisk.some(a=>a.academic_risk_level==='critical')?'bg-red-50 border-red-200':'bg-amber-50 border-amber-200'}">
        <div class="flex items-center justify-between mb-2">
          <p class="${atRisk.some(a=>a.academic_risk_level==='critical')?'text-red-800':'text-amber-800'} font-semibold text-sm">
            📚 ${atRisk.length} Athlete${atRisk.length>1?'s':''} at Academic Risk — Intervene Before Ineligibility
          </p>
          <button onclick="triggerAcademicSync()" class="text-xs text-slate-500 hover:text-slate-700 underline">Sync now</button>
        </div>
        <div class="space-y-1.5">
          ${atRisk.slice(0,5).map(a => {
            const data = typeof a.academic_risk_data === 'string' ? JSON.parse(a.academic_risk_data) : (a.academic_risk_data || {});
            const isCritical = a.academic_risk_level === 'critical';
            return `
            <div class="flex items-start gap-2 text-xs ${isCritical?'text-red-700':'text-amber-700'}">
              <span class="font-bold flex-shrink-0">${isCritical?'🚨':'⚠️'} ${esc(a.name)}</span>
              <span class="text-slate-400">·</span>
              <span class="text-slate-500">${esc(a.sport_name)}</span>
              <span class="text-slate-400">·</span>
              <span>${esc((data.risk_reasons||[]).join(' · '))}</span>
            </div>`;
          }).join('')}
          ${atRisk.length > 5 ? `<p class="text-xs text-slate-400 mt-1">+ ${atRisk.length - 5} more — <button onclick="nav('roster',{filter:'at-risk'})" class="underline">View all</button></p>` : ''}
        </div>
      </div>` : ''}

      <div class="grid grid-cols-4 gap-4 mb-6">
        ${stats.map(s => `
          <div onclick="${s.click}" class="bg-white rounded-xl shadow-sm border-l-4 ${s.color} p-4 cursor-pointer hover:shadow-md transition-shadow">
            <div class="flex items-center justify-between mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${s.icon}</svg>
            </div>
            <div class="text-2xl font-bold text-slate-900">${s.value}</div>
            <div class="text-xs text-slate-500 mt-0.5">${s.label}</div>
          </div>`).join('')}
      </div>

      <div class="grid grid-cols-2 gap-5">
        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-semibold text-slate-900 text-sm">Upcoming Trips</h2>
            <button onclick="nav('trips')" class="text-xs text-brand-600 font-medium hover:underline">View all</button>
          </div>
          ${d.trips.length === 0 ? '<p class="text-slate-400 text-sm">No upcoming trips.</p>' : `
          <div class="space-y-3">
            ${d.trips.map(t => `
              <div onclick="nav('trip-detail',{id:${t.id}})" class="p-3 rounded-lg border border-slate-100 hover:border-brand-200 hover:bg-brand-50/30 cursor-pointer transition-colors">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-slate-800 text-sm truncate">${esc(t.name)}</p>
                    <p class="text-slate-500 text-xs mt-0.5">${esc(t.sport_name)} · ${fmt(t.depart_date)}</p>
                  </div>
                  <div class="flex flex-col items-end gap-1">
                    ${tripStatusBadge(t.status)}
                    ${t.conflict_count > 0 ? `<span class="text-xs text-red-600 font-medium">⚠ ${t.conflict_count} conflict</span>` : ''}
                  </div>
                </div>
                <div class="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  <span>${t.manifest_count} athletes</span>
                  ${t.charter_vendor ? `<span>· ${esc(t.charter_vendor)}</span>` : ''}
                  ${t.destination ? `<span>· ${esc(t.destination)}</span>` : ''}
                </div>
              </div>`).join('')}
          </div>`}
        </div>

        <div class="bg-white rounded-xl shadow-sm p-5">
          <h2 class="font-semibold text-slate-900 text-sm mb-4">Recent Activity</h2>
          ${d.activity.length === 0 ? '<p class="text-slate-400 text-sm">No recent activity.</p>' : `
          <div class="space-y-3">
            ${d.activity.map(a => {
              const isTrip = a.entity_id && a.entity_type === 'trip';
              const isAthlete = a.entity_id && a.entity_type === 'athlete';
              const clickable = isTrip || isAthlete;
              const onclick = isTrip ? `nav('trip-detail',{id:${a.entity_id}})` : isAthlete ? `nav('roster')` : '';
              return `
              <div class="${clickable?'cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors':''} flex items-start gap-3 py-0.5"
                ${clickable?`onclick="${onclick}"`:''}>
                <div class="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${a.action==='eligibility_change'?'bg-red-400':a.action==='roster_locked'?'bg-brand-500':'bg-slate-300'}"></div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-slate-700 leading-snug">${esc(a.detail||a.action)}</p>
                  <p class="text-xs text-slate-400 mt-0.5">${ago(a.created_at)} ${a.user_name?'· '+esc(a.user_name):''}${clickable?'<span class="ml-1 text-brand-400">→</span>':''}</p>
                </div>
              </div>`;}).join('')}
          </div>`}
        </div>
      </div>
    </div>`;

  return [content, ''];
}

// ── Trips ─────────────────────────────────────────────────────────────────────
async function renderTrips() {
  const [trips, sports] = await Promise.all([GET('/api/trips'), GET('/api/sports')]);
  const statusFilter = S.params?.status || 'active';

  const statusGroups = {
    active: trips.filter(t => t.status !== 'completed'),
    planning: trips.filter(t => t.status === 'planning'),
    confirmed: trips.filter(t => t.status === 'confirmed'),
    departed: trips.filter(t => t.status === 'departed'),
    completed: trips.filter(t => t.status === 'completed'),
  };
  const displayTrips = statusGroups[statusFilter] || statusGroups.active;
  const upcoming = trips.filter(t => t.status !== 'completed');
  const completed = trips.filter(t => t.status === 'completed');

  function tripCard(t) {
    const days = daysUntil(t.depart_date);
    return `
      <div onclick="nav('trip-detail',{id:${t.id}})" class="bg-white rounded-xl shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow border border-transparent hover:border-brand-200">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-slate-900 text-sm truncate">${esc(t.name)}</h3>
            <p class="text-slate-500 text-xs mt-0.5">${esc(t.sport_name||'—')}</p>
          </div>
          <div class="flex flex-col items-end gap-1 flex-shrink-0">
            ${tripStatusBadge(t.status)}
            ${t.roster_locked ? '<span class="text-xs text-brand-600 font-medium">🔒 Locked</span>' : ''}
          </div>
        </div>
        ${t.conflict_count > 0 ? `<div class="mb-3 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">⚠ ${t.conflict_count} eligibility conflict${t.conflict_count>1?'s':''} on manifest</div>` : ''}
        <div class="grid grid-cols-2 gap-2 text-xs text-slate-600">
          <div><span class="text-slate-400">Departs:</span> ${fmt(t.depart_date)} ${days !== null && days >= 0 ? `<span class="text-slate-400">(${days===0?'today':days+'d'} away)</span>` : ''}</div>
          ${t.return_date ? `<div><span class="text-slate-400">Returns:</span> ${fmt(t.return_date)}</div>` : '<div></div>'}
          <div><span class="text-slate-400">Athletes:</span> ${t.manifest_count}</div>
          <div><span class="text-slate-400">Charter:</span> ${t.charter_vendor ? esc(t.charter_vendor) : '<span class="text-slate-300">None set</span>'}</div>
          ${t.destination ? `<div class="col-span-2"><span class="text-slate-400">Destination:</span> ${esc(t.destination)}</div>` : ''}
        </div>
      </div>`;
  }

  const tripFilterTabs = [
    { key: 'active', label: 'All Active', count: statusGroups.active.length },
    { key: 'planning', label: 'Planning', count: statusGroups.planning.length },
    { key: 'confirmed', label: 'Confirmed', count: statusGroups.confirmed.length },
    { key: 'departed', label: 'Departed', count: statusGroups.departed.length },
    { key: 'completed', label: 'Completed', count: statusGroups.completed.length },
  ];

  const content = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-5">
        <div>
          <h1 class="text-xl font-bold text-slate-900">Trips</h1>
          <p class="text-slate-500 text-sm mt-0.5">${trips.length} total</p>
        </div>
        <button onclick="modal('new-trip-modal')" class="px-4 py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">+ New Trip</button>
      </div>

      <div class="flex items-center gap-2 mb-5 flex-wrap">
        ${tripFilterTabs.map(t => `
          <button onclick="nav('trips',{status:'${t.key}'})"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter===t.key?'bg-brand-600 text-white':'bg-white text-slate-600 hover:bg-slate-100 shadow-sm'}">
            ${t.label}
            <span class="ml-1 text-xs ${statusFilter===t.key?'opacity-75':'text-slate-400'}">${t.count}</span>
          </button>`).join('')}
      </div>

      ${displayTrips.length > 0
        ? `<div class="grid grid-cols-2 gap-4">${displayTrips.map(tripCard).join('')}</div>`
        : '<div class="text-center py-12 text-slate-400 bg-white rounded-xl shadow-sm"><p class="text-lg font-medium mb-1">No trips here</p><p class="text-sm">Try a different filter or create a new trip.</p></div>'}
    </div>`;

  const modals = `
    <div id="new-trip-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 class="font-semibold text-slate-900">New Trip</h3>
          <button onclick="closeModal('new-trip-modal')" class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div class="p-6 space-y-4">
          <div id="nt-error" class="hidden p-3 bg-red-50 text-red-700 text-sm rounded-lg"></div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Trip Name *</label>
            <input id="nt-name" type="text" placeholder="@ Albany State — Conference Game" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Sport *</label>
              <select id="nt-sport" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Select sport…</option>
                ${sports.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Event Type</label>
              <select id="nt-type" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="game">Game</option>
                <option value="tournament">Tournament</option>
                <option value="scrimmage">Scrimmage</option>
                <option value="practice">Practice</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Depart Date *</label>
              <input id="nt-depart" type="date" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Return Date</label>
              <input id="nt-return" type="date" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Destination</label>
              <input id="nt-dest" type="text" placeholder="Albany, NY" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Opponent</label>
              <input id="nt-opponent" type="text" placeholder="Albany State" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Charter Vendor</label>
            <input id="nt-charter" type="text" placeholder="Northeast Charter Services" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Charter Amount ($)</label>
              <input id="nt-amount" type="number" step="0.01" placeholder="1850.00" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Charter State</label>
              <input id="nt-state" type="text" placeholder="NY" maxlength="2" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea id="nt-notes" rows="2" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"></textarea>
          </div>
        </div>
        <div class="p-6 border-t border-slate-100 flex gap-3 justify-end">
          <button onclick="closeModal('new-trip-modal')" class="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button onclick="saveTrip()" class="px-5 py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">Create Trip</button>
        </div>
      </div>
    </div>`;

  return [content, modals];
}

async function saveTrip() {
  const name = document.getElementById('nt-name').value.trim();
  const sport_id = document.getElementById('nt-sport').value;
  const depart_date = document.getElementById('nt-depart').value;
  if (!name || !sport_id || !depart_date) { document.getElementById('nt-error').textContent='Name, sport and depart date required'; document.getElementById('nt-error').classList.remove('hidden'); return; }
  try {
    const r = await POST('/api/trips', {
      name, sport_id, depart_date,
      return_date: document.getElementById('nt-return').value || null,
      event_type: document.getElementById('nt-type').value,
      destination: document.getElementById('nt-dest').value.trim() || null,
      opponent: document.getElementById('nt-opponent').value.trim() || null,
      charter_vendor: document.getElementById('nt-charter').value.trim() || null,
      charter_amount: document.getElementById('nt-amount').value || null,
      charter_state: document.getElementById('nt-state').value.trim().toUpperCase() || null,
      notes: document.getElementById('nt-notes').value.trim() || null,
    });
    closeModal('new-trip-modal');
    toast('Trip created');
    nav('trip-detail', { id: r.id });
  } catch (e) {
    document.getElementById('nt-error').textContent = e.message;
    document.getElementById('nt-error').classList.remove('hidden');
  }
}

// ── Trip Detail ───────────────────────────────────────────────────────────────
async function renderTripDetail() {
  const { id, tab = 'manifest' } = S.params;
  const [trip, manifest, certs, sports] = await Promise.all([
    GET(`/api/trips/${id}`),
    GET(`/api/trips/${id}/manifest`),
    GET('/api/tax-certs'),
    GET('/api/sports'),
  ]);

  const allAthletes = await GET(`/api/athletes?sport_id=${trip.sport_id}`);
  const onManifest = new Set(manifest.map(m => m.athlete_id));
  const available = allAthletes.filter(a => !onManifest.has(a.id));

  const conflicts = manifest.filter(m => m.eligibility_status !== 'eligible');
  const matchCert = certs.find(c => c.state?.toUpperCase() === trip.charter_state?.toUpperCase());

  function tdNav(t) { return `nav('trip-detail',{id:${id},tab:'${t}'})`; }
  const tabs = ['manifest', 'documents', 'details'];

  const manifestContent = `
    ${conflicts.length > 0 ? `
      <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
        <p class="text-red-800 font-semibold text-sm mb-2">⚠ ${conflicts.length} Eligibility Conflict${conflicts.length>1?'s':''} on This Manifest</p>
        ${conflicts.map(c => `
          <div class="flex items-center gap-2 text-sm text-red-700">
            <span class="font-medium">${esc(c.name)}</span> ${eligBadge(c.eligibility_status)}
            ${c.eligibility_note ? `<span class="text-red-500 text-xs">— ${esc(c.eligibility_note)}</span>` : ''}
            ${trip.roster_locked ? '<span class="text-red-500 text-xs ml-auto">Remove or resolve before departing</span>' : ''}
          </div>`).join('')}
      </div>` : ''}

    <div class="flex items-center justify-between mb-3">
      <p class="text-sm text-slate-600">${manifest.length} athlete${manifest.length!==1?'s':''} on manifest</p>
      <div class="flex items-center gap-2">
        <button onclick="printManifest(${id})" class="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">🖨 Print</button>
        ${trip.roster_locked
          ? `<button onclick="unlockRoster(${id})" class="px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200">🔓 Unlock Roster</button>`
          : `<button onclick="openAddAthleteModal()" class="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">+ Add Athlete</button>
             <button onclick="lockRoster(${id})" class="px-3 py-1.5 text-xs font-medium rounded-lg text-white" style="background:#059669">🔒 Lock Roster</button>`}
      </div>
    </div>

    ${manifest.length === 0 ? '<p class="text-slate-400 text-sm text-center py-8">No athletes on manifest yet.</p>' : `
    <div class="border border-slate-200 rounded-xl overflow-hidden">
      <table class="w-full text-sm">
        <thead><tr class="bg-slate-50 border-b border-slate-200">
          <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Name</th>
          <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">ID</th>
          <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Year</th>
          <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Eligibility</th>
          <th class="px-4 py-2.5"></th>
        </tr></thead>
        <tbody>
          ${manifest.map(m => `
            <tr class="border-b border-slate-100 last:border-0 ${m.eligibility_status!=='eligible'?'bg-red-50/50':'hover:bg-slate-50/50'}">
              <td class="px-4 py-3 font-medium text-slate-800">${esc(m.name)}</td>
              <td class="px-4 py-3 text-slate-500 font-mono text-xs">${esc(m.student_id||'—')}</td>
              <td class="px-4 py-3 text-slate-600">${esc(m.year||'—')}</td>
              <td class="px-4 py-3">
                ${eligBadge(m.eligibility_status)}
                ${m.eligibility_note ? `<div class="text-xs text-slate-400 mt-0.5">${esc(m.eligibility_note)}</div>` : ''}
              </td>
              <td class="px-4 py-3 text-right">
                ${!trip.roster_locked ? actionIcon('remove', `removeFromManifest(${id},${m.athlete_id})`, 'text-red-400 hover:text-red-600') : ''}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`}`;

  const today = new Date().toISOString().split('T')[0];
  const certExpired = matchCert && matchCert.expiry_date && matchCert.expiry_date < today;
  const certExpiring = matchCert && matchCert.expiry_date && !certExpired &&
    matchCert.expiry_date <= new Date(Date.now() + 60*86400000).toISOString().split('T')[0];

  function certRow(c) {
    const exp = c.expiry_date && c.expiry_date < today;
    const expiring = c.expiry_date && !exp && c.expiry_date <= new Date(Date.now()+60*86400000).toISOString().split('T')[0];
    const color = exp ? 'text-red-700' : expiring ? 'text-amber-700' : 'text-emerald-700';
    const bg = exp ? 'bg-red-100' : expiring ? 'bg-amber-100' : 'bg-emerald-100';
    const icon = exp ? '✕' : expiring ? '!' : '✓';
    const label = exp ? 'EXPIRED' : expiring ? 'EXPIRING SOON' : 'ACTIVE';
    return `<div class="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
      <div class="flex items-center gap-2">
        <span class="w-5 h-5 rounded-full ${bg} ${color} flex items-center justify-center text-xs font-bold">${icon}</span>
        <div>
          <span class="text-sm font-semibold text-slate-800">${esc(c.state)}</span>
          ${c.cert_number ? `<span class="text-slate-500 text-xs ml-1">— ${esc(c.cert_number)}</span>` : ''}
          <span class="ml-2 text-xs font-semibold ${color}">${label}</span>
          <div class="text-xs text-slate-400 mt-0.5">Expires ${fmt(c.expiry_date)}</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        ${c.file_name ? `<a href="/api/tax-certs/${c.id}/download" class="text-xs text-brand-600 hover:underline">↓ Download</a>` : ''}
        ${S.user?.role === 'admin' ? `<button onclick="openQuickCert('${esc(c.state)}')" class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">${exp ? 'Replace' : 'Renew'}</button>` : ''}
      </div>
    </div>`;
  }

  const charterStateCerts = certs.filter(c => c.state?.toUpperCase() === trip.charter_state?.toUpperCase());
  const otherCerts = certs.filter(c => c.state?.toUpperCase() !== trip.charter_state?.toUpperCase());

  let certStatusHtml = '';
  if (!trip.charter_vendor) {
    certStatusHtml = `<p class="text-slate-400 text-sm">No charter vendor set for this trip.</p>`;
  } else if (charterStateCerts.length === 0) {
    certStatusHtml = `<div class="flex items-center justify-between py-1">
      <div class="flex items-center gap-2 text-sm text-red-700 font-medium">
        <span class="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold">!</span>
        No cert on file for ${esc(trip.charter_state||'this state')}
      </div>
      ${S.user?.role === 'admin' ? `<button onclick="openQuickCert('${esc(trip.charter_state||'')}')" class="px-3 py-1.5 text-xs font-semibold rounded-lg text-white" style="background:#059669">+ Add Cert</button>` : ''}
    </div>`;
  } else {
    certStatusHtml = charterStateCerts.map(certRow).join('');
  }

  if (otherCerts.length > 0) {
    certStatusHtml += `<div class="mt-3 pt-3 border-t border-slate-200">
      <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Other States on File</p>
      ${otherCerts.map(certRow).join('')}
    </div>`;
  }

  const documentsContent = `
    <div class="space-y-5">
      <div class="bg-slate-50 rounded-xl p-4">
        <h3 class="font-semibold text-slate-800 text-sm mb-3">Charter Details</h3>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><span class="text-slate-500">Vendor:</span> <span class="font-medium">${esc(trip.charter_vendor||'—')}</span></div>
          <div><span class="text-slate-500">Contact:</span> <span class="font-medium">${esc(trip.charter_contact||'—')}</span></div>
          <div><span class="text-slate-500">Amount:</span> <span class="font-medium">${trip.charter_amount ? '$'+Number(trip.charter_amount).toLocaleString() : '—'}</span></div>
          <div><span class="text-slate-500">State:</span> <span class="font-medium">${esc(trip.charter_state||'—')}</span></div>
        </div>
      </div>

      <div class="bg-slate-50 rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-slate-800 text-sm">Per Diem</h3>
          ${S.user?.role === 'admin' ? `<button onclick="editPerDiem(${id})" class="text-xs text-brand-600 font-medium hover:underline" id="per-diem-edit-btn">${trip.per_diem_rate ? 'Edit' : 'Set Rate'}</button>` : ''}
        </div>
        <div id="per-diem-display">
          ${renderPerDiemDisplay(trip, manifest)}
        </div>
      </div>

      <div class="bg-slate-50 rounded-xl p-4" id="cert-status-block">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-slate-800 text-sm">Tax Exemption Status</h3>
          ${S.user?.role === 'admin' ? `<button onclick="openQuickCert('')" class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">+ Add for Different State</button>` : ''}
        </div>
        <div id="cert-status-inner">
          ${certStatusHtml}
        </div>
      </div>

      <div class="bg-slate-50 rounded-xl p-4">
        <h3 class="font-semibold text-slate-800 text-sm mb-2">Manifest Summary</h3>
        <div class="grid grid-cols-3 gap-3 text-sm">
          <div class="text-center bg-white rounded-lg p-3">
            <div class="text-xl font-bold text-slate-900">${manifest.length}</div>
            <div class="text-xs text-slate-500">Total Athletes</div>
          </div>
          <div class="text-center bg-white rounded-lg p-3">
            <div class="text-xl font-bold text-emerald-700">${manifest.filter(m=>m.eligibility_status==='eligible').length}</div>
            <div class="text-xs text-slate-500">Eligible</div>
          </div>
          <div class="text-center bg-white rounded-lg p-3">
            <div class="text-xl font-bold ${conflicts.length>0?'text-red-600':'text-slate-300'}">${conflicts.length}</div>
            <div class="text-xs text-slate-500">Conflicts</div>
          </div>
        </div>
      </div>
    </div>`;

  const detailsContent = `
    <div class="max-w-lg space-y-4">
      <div id="td-error" class="hidden p-3 bg-red-50 text-red-700 text-sm rounded-lg"></div>
      <input type="hidden" id="td-id" value="${id}" />
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Trip Name</label>
        <input id="td-name" type="text" value="${esc(trip.name)}" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Sport</label>
          <select id="td-sport" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            ${sports.map(s => `<option value="${s.id}" ${s.id==trip.sport_id?'selected':''}>${esc(s.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <select id="td-status" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            ${['planning','confirmed','departed','completed'].map(s => `<option value="${s}" ${s===trip.status?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Depart Date</label>
          <input id="td-depart" type="date" value="${trip.depart_date||''}" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Return Date</label>
          <input id="td-return" type="date" value="${trip.return_date||''}" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Destination</label>
          <input id="td-dest" type="text" value="${esc(trip.destination||'')}" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Opponent</label>
          <input id="td-opponent" type="text" value="${esc(trip.opponent||'')}" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Charter Vendor</label>
        <input id="td-charter" type="text" value="${esc(trip.charter_vendor||'')}" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Charter Contact</label>
          <input id="td-contact" type="text" value="${esc(trip.charter_contact||'')}" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Charter Amount ($)</label>
          <input id="td-amount" type="number" step="0.01" value="${trip.charter_amount||''}" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Charter State</label>
        <input id="td-cstate" type="text" maxlength="2" value="${esc(trip.charter_state||'')}" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase" placeholder="NY" />
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea id="td-notes" rows="3" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none">${esc(trip.notes||'')}</textarea>
      </div>
      <div class="flex items-center gap-3 pt-2">
        <button onclick="updateTrip(${id})" class="px-5 py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">Save Changes</button>
        ${S.user?.role === 'admin' ? `<button onclick="deleteTrip(${id})" class="px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50">Delete Trip</button>` : ''}
      </div>
    </div>`;

  const tabContent = tab === 'manifest' ? manifestContent : tab === 'documents' ? documentsContent : detailsContent;

  const content = `
    <div class="fade-in">
      <div class="flex items-center gap-3 mb-5">
        <button onclick="nav('trips')" class="text-slate-400 hover:text-slate-700 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div class="flex-1">
          <h1 class="text-xl font-bold text-slate-900">${esc(trip.name)}</h1>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="text-slate-500 text-sm">${esc(trip.sport_name||'—')}</span>
            <span class="text-slate-300">·</span>
            <span class="text-slate-500 text-sm">${fmt(trip.depart_date)}</span>
            ${trip.return_date ? `<span class="text-slate-300">→</span><span class="text-slate-500 text-sm">${fmt(trip.return_date)}</span>` : ''}
            <span class="text-slate-300">·</span>
            ${tripStatusBadge(trip.status)}
            ${trip.roster_locked ? '<span class="text-xs text-brand-600 font-medium">🔒 Roster Locked</span>' : ''}
          </div>
        </div>
        ${conflicts.length > 0 ? `<div class="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">⚠ ${conflicts.length} Conflict${conflicts.length>1?'s':''}</div>` : ''}
        <button onclick="shareTrip(${id})" class="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          Share
        </button>
      </div>

      <div class="flex border-b border-slate-200 mb-5">
        ${tabs.map(t => `<button onclick="${tdNav(t)}" class="px-5 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${tab===t?'border-brand-500 text-brand-700':'border-transparent text-slate-500 hover:text-slate-700'}">${t}</button>`).join('')}
      </div>

      ${tabContent}
    </div>`;

  const quickCertModal = `
    <div id="quick-cert-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div class="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 class="font-semibold text-slate-900">Add Tax Exemption Certificate</h3>
          <button onclick="closeModal('quick-cert-modal')" class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form id="quick-cert-form" class="p-5 space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">State *</label>
              <input id="qc-state" name="state" type="text" maxlength="2" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase font-mono" required />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Certificate #</label>
              <input name="cert_number" type="text" placeholder="NY-EX-2024-0001" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Issued Date</label>
              <input name="issued_date" type="date" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Expiry Date</label>
              <input name="expiry_date" type="date" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Certificate File (optional)</label>
            <input name="cert_file" type="file" accept=".pdf,.jpg,.jpeg,.png" class="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
          </div>
        </form>
        <div class="p-5 border-t border-slate-100 flex justify-end gap-3">
          <button onclick="closeModal('quick-cert-modal')" class="px-4 py-2 text-sm text-slate-600">Cancel</button>
          <button onclick="saveQuickCert(${id})" class="px-5 py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">Save Cert</button>
        </div>
      </div>
    </div>`;

  const addAthleteModal = `
    <div id="add-athlete-manifest-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div class="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 class="font-semibold text-slate-900">Add Athlete to Manifest</h3>
          <button onclick="closeModal('add-athlete-manifest-modal')" class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div class="p-5">
          ${available.length === 0
            ? '<p class="text-slate-400 text-sm">All eligible athletes are already on the manifest.</p>'
            : `<select id="manifest-add-athlete" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Select athlete…</option>
                ${available.map(a => `<option value="${a.id}">${esc(a.name)} (${esc(a.year||'')}) ${a.eligibility_status!=='eligible'?'⚠ '+a.eligibility_status:''}</option>`).join('')}
              </select>`}
        </div>
        <div class="p-5 border-t border-slate-100 flex justify-end gap-3">
          <button onclick="closeModal('add-athlete-manifest-modal')" class="px-4 py-2 text-sm text-slate-600">Cancel</button>
          ${available.length > 0 ? `<button onclick="addToManifest(${id})" class="px-5 py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">Add</button>` : ''}
        </div>
      </div>
    </div>`;

  return [content, quickCertModal + addAthleteModal];
}

function openAddAthleteModal() { modal('add-athlete-manifest-modal'); }

function openQuickCert(state) {
  document.getElementById('qc-state').value = state;
  document.getElementById('quick-cert-form').reset();
  document.getElementById('qc-state').value = state;
  modal('quick-cert-modal');
}

async function saveQuickCert(tripId) {
  const form = document.getElementById('quick-cert-form');
  const fd = new FormData(form);
  const state = fd.get('state');
  if (!state) { toast('State is required', 'error'); return; }
  try {
    const r = await fetch('/api/tax-certs', { method: 'POST', body: fd });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Failed to save cert');
    closeModal('quick-cert-modal');
    toast('Certificate saved');
    // In-place update — swap just the cert status section, no page flash
    const inner = document.getElementById('cert-status-inner');
    if (inner) {
      const certNum = form.querySelector('[name="cert_number"]')?.value || '';
      const expiry = form.querySelector('[name="expiry_date"]')?.value || '';
      const fileName = form.querySelector('[name="cert_file"]')?.files[0]?.name || '';
      inner.innerHTML = `
        <div class="flex items-center gap-2 text-sm text-emerald-700 font-medium">
          <span class="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-xs">✓</span>
          ${esc(state.toUpperCase())} cert on file${certNum ? ' — ' + esc(certNum) : ''}${expiry ? ' (expires ' + fmt(expiry) + ')' : ''}
        </div>
        ${fileName ? `<div class="mt-3"><span class="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-50 text-brand-700 text-xs font-medium rounded-lg">${esc(fileName)}</span></div>` : ''}`;
    }
  } catch (e) { toast(e.message, 'error'); }
}

async function addToManifest(tripId) {
  const athleteId = document.getElementById('manifest-add-athlete')?.value;
  if (!athleteId) return;
  try {
    await POST(`/api/trips/${tripId}/manifest`, { athlete_id: athleteId });
    closeModal('add-athlete-manifest-modal');
    toast('Athlete added to manifest');
    nav('trip-detail', { id: tripId, tab: 'manifest' });
  } catch (e) { toast(e.message, 'error'); }
}

async function removeFromManifest(tripId, athleteId) {
  if (!confirm('Remove this athlete from the manifest?')) return;
  try {
    await DEL(`/api/trips/${tripId}/manifest/${athleteId}`);
    toast('Removed from manifest');
    nav('trip-detail', { id: tripId, tab: 'manifest' });
  } catch (e) { toast(e.message, 'error'); }
}

async function lockRoster(tripId) {
  if (!confirm('Lock the roster for this trip? The manifest will be finalized.')) return;
  try {
    await POST(`/api/trips/${tripId}/lock`);
    toast('Roster locked');
    nav('trip-detail', { id: tripId, tab: 'manifest' });
  } catch (e) { toast(e.message, 'error'); }
}

async function unlockRoster(tripId) {
  try {
    await POST(`/api/trips/${tripId}/unlock`);
    toast('Roster unlocked');
    nav('trip-detail', { id: tripId, tab: 'manifest' });
  } catch (e) { toast(e.message, 'error'); }
}

async function updateTrip(id) {
  try {
    await PUT(`/api/trips/${id}`, {
      name: document.getElementById('td-name').value.trim(),
      sport_id: document.getElementById('td-sport').value,
      status: document.getElementById('td-status').value,
      depart_date: document.getElementById('td-depart').value,
      return_date: document.getElementById('td-return').value || null,
      destination: document.getElementById('td-dest').value.trim() || null,
      opponent: document.getElementById('td-opponent').value.trim() || null,
      charter_vendor: document.getElementById('td-charter').value.trim() || null,
      charter_contact: document.getElementById('td-contact').value.trim() || null,
      charter_amount: document.getElementById('td-amount').value || null,
      charter_state: document.getElementById('td-cstate').value.trim().toUpperCase() || null,
      notes: document.getElementById('td-notes').value.trim() || null,
    });
    toast('Trip updated');
    nav('trip-detail', { id, tab: 'details' });
  } catch (e) { toast(e.message, 'error'); }
}

async function shareTrip(id) {
  try {
    const { url } = await POST(`/api/trips/${id}/share`);
    const existing = document.getElementById('share-modal');
    if (existing) existing.remove();
    const m = document.createElement('div');
    m.id = 'share-modal';
    m.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
    m.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div class="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 class="font-semibold text-slate-900">Share Trip with Coach</h3>
          <button onclick="document.getElementById('share-modal').remove()" class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div class="p-5 space-y-4">
          <p class="text-sm text-slate-600">Send this link to your coach. It shows the live manifest, cert status, and trip details — no login needed. Updates every 10 seconds.</p>
          <div class="flex gap-2">
            <input id="share-url" type="text" readonly value="${url}" class="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700 font-mono" onclick="this.select()" />
            <button onclick="copyShareLink()" class="px-4 py-2 rounded-lg text-white text-sm font-semibold flex-shrink-0" style="background:#059669" id="copy-btn">Copy</button>
          </div>
          <a href="${url}" target="_blank" class="block text-center text-xs text-brand-600 hover:underline">Preview link →</a>
        </div>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  } catch (e) { toast(e.message, 'error'); }
}

function copyShareLink() {
  const input = document.getElementById('share-url');
  navigator.clipboard.writeText(input.value).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  });
}

async function deleteTrip(id) {
  if (!confirm('Delete this trip? This cannot be undone.')) return;
  try { await DEL(`/api/trips/${id}`); toast('Trip deleted'); nav('trips'); }
  catch (e) { toast(e.message, 'error'); }
}

// ── Sports ────────────────────────────────────────────────────────────────────
async function renderSports() {
  const sports = await GET('/api/sports');

  const seasonLabel = { fall: 'Fall', winter: 'Winter', spring: 'Spring', 'year-round': 'Year-Round' };
  const genderLabel = { mens: "Men's", womens: "Women's", coed: 'Co-Ed' };

  const rows = sports.length === 0
    ? '<tr><td colspan="5" class="px-5 py-10 text-center text-slate-400 text-sm">No sports yet — add your first sport to get started.</td></tr>'
    : sports.map(s => `
      <tr data-sport-row data-name="${esc(s.name)}" class="border-b border-slate-100 last:border-0 hover:bg-slate-50/40">
        <td class="px-5 py-3 font-medium text-slate-800">
          <button onclick="nav('roster',{sport:'${s.id}'})" class="hover:text-brand-600 hover:underline text-left">${esc(s.name)}</button>
        </td>
        <td class="px-5 py-3">
          <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">${esc(seasonLabel[s.season] || s.season || '—')}</span>
        </td>
        <td class="px-5 py-3 text-slate-600 text-sm">${esc(genderLabel[s.gender] || s.gender || '—')}</td>
        <td class="px-5 py-3 text-slate-600 text-sm">${esc(s.head_coach || '—')}</td>
        <td class="px-5 py-3 text-right flex justify-end gap-1">
          ${S.user?.role === 'admin' ? actionIcon('edit', `openEditSport(${s.id},'${esc(s.name)}','${s.season||''}','${s.gender||''}','${esc(s.head_coach||'')}')`) : ''}
          ${S.user?.role === 'admin' ? actionIcon('delete', `deleteSport(${s.id},'${esc(s.name)}')`) : ''}
        </td>
      </tr>`).join('');

  const content = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-bold text-slate-900">Sports</h1>
          <p class="text-slate-500 text-sm mt-0.5">${sports.length} program${sports.length !== 1 ? 's' : ''}</p>
        </div>
        ${S.user?.role === 'admin' ? `<button onclick="openNewSport()" class="px-4 py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">+ Add Sport</button>` : ''}
      </div>

      <div class="mb-4 relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Search sports…" oninput="sportFilterInPlace(this.value)"
          class="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table class="w-full text-sm">
          <thead><tr class="bg-slate-50 border-b border-slate-200">
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Sport</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Season</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Gender</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Head Coach</th>
            <th class="px-5 py-3"></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      ${sports.length > 0 ? `
      <div class="mt-5 grid grid-cols-3 gap-4">
        ${['fall','winter','spring'].map(season => {
          const list = sports.filter(s => s.season === season);
          return list.length === 0 ? '' : `
          <div class="bg-white rounded-xl shadow-sm p-4">
            <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">${seasonLabel[season]} Season</h3>
            <div class="space-y-2">
              ${list.map(s => `
                <div class="flex items-center gap-2 text-sm">
                  <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:#059669"></span>
                  <span class="font-medium text-slate-800">${esc(s.name)}</span>
                  ${s.head_coach ? `<span class="text-slate-400 text-xs ml-auto truncate">${esc(s.head_coach)}</span>` : ''}
                </div>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}
    </div>`;

  const modal = `
    <div id="sport-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div class="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 id="sport-modal-title" class="font-semibold text-slate-900">Add Sport</h3>
          <button onclick="closeModal('sport-modal')" class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div class="p-5 space-y-3">
          <input type="hidden" id="sp-id" value="" />
          <div id="sp-error" class="hidden p-3 bg-red-50 text-red-700 text-sm rounded-lg"></div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Sport Name *</label>
            <input id="sp-name" type="text" placeholder="Men's Basketball" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Season</label>
              <select id="sp-season" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="fall">Fall</option>
                <option value="winter">Winter</option>
                <option value="spring">Spring</option>
                <option value="year-round">Year-Round</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Gender</label>
              <select id="sp-gender" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="mens">Men's</option>
                <option value="womens">Women's</option>
                <option value="coed">Co-Ed</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Head Coach</label>
            <input id="sp-coach" type="text" placeholder="Coach Smith" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        </div>
        <div class="p-5 border-t border-slate-100 flex justify-end gap-3">
          <button onclick="closeModal('sport-modal')" class="px-4 py-2 text-sm text-slate-600">Cancel</button>
          <button onclick="saveSport()" class="px-5 py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">Save</button>
        </div>
      </div>
    </div>`;

  return [content, modal];
}

function sportFilterInPlace(val) {
  const q = val.toLowerCase();
  document.querySelectorAll('[data-sport-row]').forEach(row => {
    const name = (row.dataset.name || '').toLowerCase();
    row.classList.toggle('hidden', q && !name.includes(q));
  });
}

function openNewSport() {
  document.getElementById('sport-modal-title').textContent = 'Add Sport';
  document.getElementById('sp-id').value = '';
  document.getElementById('sp-name').value = '';
  document.getElementById('sp-season').value = 'fall';
  document.getElementById('sp-gender').value = 'mens';
  document.getElementById('sp-coach').value = '';
  document.getElementById('sp-error').classList.add('hidden');
  modal('sport-modal');
}

function openEditSport(id, name, season, gender, coach) {
  document.getElementById('sport-modal-title').textContent = 'Edit Sport';
  document.getElementById('sp-id').value = id;
  document.getElementById('sp-name').value = name;
  document.getElementById('sp-season').value = season || 'fall';
  document.getElementById('sp-gender').value = gender || 'mens';
  document.getElementById('sp-coach').value = coach;
  document.getElementById('sp-error').classList.add('hidden');
  modal('sport-modal');
}

async function saveSport() {
  const id = document.getElementById('sp-id').value;
  const name = document.getElementById('sp-name').value.trim();
  if (!name) { document.getElementById('sp-error').textContent = 'Sport name is required'; document.getElementById('sp-error').classList.remove('hidden'); return; }
  const body = {
    name,
    season: document.getElementById('sp-season').value,
    gender: document.getElementById('sp-gender').value,
    head_coach: document.getElementById('sp-coach').value.trim() || null,
  };
  try {
    if (id) { await PUT(`/api/sports/${id}`, body); toast('Sport updated'); }
    else { await POST('/api/sports', body); toast('Sport added'); }
    closeModal('sport-modal');
    nav('sports');
  } catch (e) { document.getElementById('sp-error').textContent = e.message; document.getElementById('sp-error').classList.remove('hidden'); }
}

async function deleteSport(id, name) {
  if (!confirm(`Delete ${name}? All athletes and trips linked to this sport will be affected.`)) return;
  try { await DEL(`/api/sports/${id}`); toast('Sport removed'); nav('sports'); }
  catch (e) { toast(e.message, 'error'); }
}

// ── Roster ────────────────────────────────────────────────────────────────────
async function renderRoster() {
  const [athletes, sports] = await Promise.all([GET('/api/athletes'), GET('/api/sports')]);
  const filter = S.params?.filter || 'all';
  const sportFilter = S.params?.sport || '';
  const search = (S.params?.search || '').toLowerCase();

  const filtered = athletes.filter(a => {
    if (filter !== 'all' && a.eligibility_status !== filter) return false;
    if (sportFilter && String(a.sport_id) !== String(sportFilter)) return false;
    if (search && !a.name.toLowerCase().includes(search) && !(a.student_id||'').toLowerCase().includes(search)) return false;
    return true;
  });

  const grouped = {};
  filtered.forEach(a => { if (!grouped[a.sport_name]) grouped[a.sport_name] = []; grouped[a.sport_name].push(a); });

  const counts = {
    all: athletes.length,
    eligible: athletes.filter(a => a.eligibility_status === 'eligible').length,
    ineligible: athletes.filter(a => a.eligibility_status === 'ineligible').length,
    pending: athletes.filter(a => a.eligibility_status === 'pending').length,
  };

  const content = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-bold text-slate-900">Roster</h1>
          <p class="text-slate-500 text-sm mt-0.5">${athletes.length} athletes across ${sports.length} sports</p>
        </div>
        <div class="flex items-center gap-2">
          ${S.user?.role === 'admin' ? `<button onclick="modal('import-csv-modal')" class="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">↑ Import CSV</button>` : ''}
          <button onclick="modal('new-athlete-modal')" class="px-4 py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">+ Add Athlete</button>
        </div>
      </div>

      <div class="flex items-center gap-3 mb-5 flex-wrap">
        ${['all','eligible','ineligible','pending'].map(f => `
          <button onclick="nav('roster',{filter:'${f}',sport:'${sportFilter}',search:S.params?.search||''})"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter===f?'bg-brand-600 text-white':'bg-white text-slate-600 hover:bg-slate-100 shadow-sm'}">
            ${f==='all'?'All Athletes':f.charAt(0).toUpperCase()+f.slice(1)}
            <span class="ml-1 text-xs ${filter===f?'opacity-75':'text-slate-400'}">${counts[f]}</span>
          </button>`).join('')}
        <select onchange="nav('roster',{filter:'${filter}',sport:this.value,search:S.params?.search||''})" class="ml-auto px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">All Sports</option>
          ${sports.map(s => `<option value="${s.id}" ${String(s.id)===String(sportFilter)?'selected':''}>${esc(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="mb-4 relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="roster-search" type="text" value="${esc(search)}" placeholder="Search by name or student ID…"
          oninput="rosterFilterInPlace(this.value)"
          class="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
        <button id="roster-search-clear" onclick="rosterClearSearch()" class="${search ? '' : 'hidden'} absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-lg leading-none">&times;</button>
      </div>

      ${Object.keys(grouped).length === 0
        ? '<div class="text-center py-12 bg-white rounded-xl shadow-sm text-slate-400"><p class="font-medium">No athletes found</p></div>'
        : Object.entries(grouped).map(([sport, list]) => `
          <div class="mb-5" data-sport-group>
            <h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">${esc(sport)}</h2>
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table class="w-full text-sm">
                <thead><tr class="bg-slate-50 border-b border-slate-200">
                  <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Name</th>
                  <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Student ID</th>
                  <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Year</th>
                  <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Eligibility</th>
                  <th class="px-4 py-2.5"></th>
                </tr></thead>
                <tbody>
                  ${list.map(a => `
                    <tr data-athlete-row data-name="${esc(a.name)}" data-sid="${esc(a.student_id||'')}" class="border-b border-slate-100 last:border-0 ${a.eligibility_status!=='eligible'?'bg-red-50/30':'hover:bg-slate-50/30'}">
                      <td class="px-4 py-3 font-medium text-slate-800">${esc(a.name)}</td>
                      <td class="px-4 py-3 text-slate-500 font-mono text-xs">${esc(a.student_id||'—')}</td>
                      <td class="px-4 py-3 text-slate-600">${esc(a.year||'—')}</td>
                      <td class="px-4 py-3">
                        <select onchange="patchEligibility(${a.id}, this.value)"
                          class="text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 ${a.eligibility_status==='eligible'?'bg-emerald-100 text-emerald-800':a.eligibility_status==='ineligible'?'bg-red-100 text-red-800':'bg-amber-100 text-amber-700'}">
                          <option value="eligible" ${a.eligibility_status==='eligible'?'selected':''}>eligible</option>
                          <option value="ineligible" ${a.eligibility_status==='ineligible'?'selected':''}>ineligible</option>
                          <option value="pending" ${a.eligibility_status==='pending'?'selected':''}>pending</option>
                        </select>
                        ${a.eligibility_note ? `<div class="text-xs text-slate-400 mt-0.5">${esc(a.eligibility_note)}</div>` : ''}
                      </td>
                      <td class="px-4 py-3 text-right flex justify-end gap-1">
                        ${actionIcon('edit', `openEditAthlete(${a.id},'${esc(a.name)}','${a.sport_id}','${esc(a.student_id||'')}','${esc(a.year||'')}','${a.eligibility_status}','${esc(a.eligibility_note||'')}')`)}
                        ${S.user?.role === 'admin' ? actionIcon('delete', `deleteAthlete(${a.id})`) : ''}
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>`).join('')}
    </div>`;

  const modals = `
    <div id="import-csv-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div class="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 class="font-semibold text-slate-900">Import Roster from CSV</h3>
          <button onclick="closeModal('import-csv-modal')" class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div class="p-5 space-y-4">
          <div class="p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
            <p class="font-semibold mb-1">Required columns: <code>name</code>, <code>sport</code></p>
            <p>Optional: <code>student_id</code>, <code>year</code>, <code>gender</code>, <code>eligibility_status</code>, <code>eligibility_note</code></p>
            <p class="mt-1 text-slate-400">Sport name must match exactly (e.g. "Men's Basketball")</p>
          </div>
          <div id="import-error" class="hidden p-3 bg-red-50 text-red-700 text-sm rounded-lg"></div>
          <div id="import-result" class="hidden p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg"></div>
          <input id="import-file" type="file" accept=".csv" class="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
        </div>
        <div class="p-5 border-t border-slate-100 flex justify-end gap-3">
          <button onclick="closeModal('import-csv-modal')" class="px-4 py-2 text-sm text-slate-600">Cancel</button>
          <button onclick="importCSVRoster()" class="px-5 py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">Import</button>
        </div>
      </div>
    </div>

    <div id="new-athlete-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div class="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 id="athlete-modal-title" class="font-semibold text-slate-900">Add Athlete</h3>
          <button onclick="closeModal('new-athlete-modal')" class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div class="p-5 space-y-3">
          <input type="hidden" id="a-id" value="" />
          <div id="a-error" class="hidden p-3 bg-red-50 text-red-700 text-sm rounded-lg"></div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Name *</label>
            <input id="a-name" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Sport *</label>
              <select id="a-sport" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Select…</option>
                ${sports.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Year</label>
              <select id="a-year" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">—</option>
                ${['FR','SO','JR','SR','GR'].map(y => `<option value="${y}">${y}</option>`).join('')}
              </select>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Student ID</label>
            <input id="a-sid" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Eligibility Status</label>
            <select id="a-elig" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="eligible">Eligible</option>
              <option value="ineligible">Ineligible</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Eligibility Note</label>
            <input id="a-note" type="text" placeholder="e.g. GPA hold, transfer pending…" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        </div>
        <div class="p-5 border-t border-slate-100 flex justify-end gap-3">
          <button onclick="closeModal('new-athlete-modal')" class="px-4 py-2 text-sm text-slate-600">Cancel</button>
          <button onclick="saveAthlete()" class="px-5 py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">Save</button>
        </div>
      </div>
    </div>`;

  return [content, modals];
}

function rosterFilterInPlace(val) {
  const q = val.toLowerCase();
  document.querySelectorAll('[data-athlete-row]').forEach(row => {
    const name = (row.dataset.name || '').toLowerCase();
    const sid = (row.dataset.sid || '').toLowerCase();
    const match = !q || name.includes(q) || sid.includes(q);
    row.classList.toggle('hidden', !match);
  });
  document.querySelectorAll('[data-sport-group]').forEach(group => {
    const hasVisible = group.querySelector('[data-athlete-row]:not(.hidden)');
    group.classList.toggle('hidden', !hasVisible);
  });
  const clearBtn = document.getElementById('roster-search-clear');
  if (clearBtn) clearBtn.classList.toggle('hidden', !val);
  S.params = { ...S.params, search: val };
}

function rosterClearSearch() {
  const input = document.getElementById('roster-search');
  if (input) { input.value = ''; input.focus(); }
  rosterFilterInPlace('');
}

function openEditAthlete(id, name, sportId, studentId, year, elig, note) {
  document.getElementById('athlete-modal-title').textContent = 'Edit Athlete';
  document.getElementById('a-id').value = id;
  document.getElementById('a-name').value = name;
  document.getElementById('a-sport').value = sportId;
  document.getElementById('a-year').value = year;
  document.getElementById('a-sid').value = studentId;
  document.getElementById('a-elig').value = elig;
  document.getElementById('a-note').value = note;
  modal('new-athlete-modal');
}

async function saveAthlete() {
  const id = document.getElementById('a-id').value;
  const name = document.getElementById('a-name').value.trim();
  const sport_id = document.getElementById('a-sport').value;
  if (!name || !sport_id) { document.getElementById('a-error').textContent='Name and sport required'; document.getElementById('a-error').classList.remove('hidden'); return; }
  const body = {
    name, sport_id,
    year: document.getElementById('a-year').value || null,
    student_id: document.getElementById('a-sid').value.trim() || null,
    eligibility_status: document.getElementById('a-elig').value,
    eligibility_note: document.getElementById('a-note').value.trim() || null,
    gender: null, dob: null,
  };
  try {
    if (id) { await PUT(`/api/athletes/${id}`, body); toast('Athlete updated'); }
    else { await POST('/api/athletes', body); toast('Athlete added'); }
    closeModal('new-athlete-modal');
    nav('roster', { filter: S.params?.filter || 'all', sport: S.params?.sport || '' });
  } catch (e) { document.getElementById('a-error').textContent = e.message; document.getElementById('a-error').classList.remove('hidden'); }
}

async function deleteAthlete(id) {
  if (!confirm('Delete this athlete?')) return;
  try { await DEL(`/api/athletes/${id}`); toast('Athlete removed'); nav('roster', S.params); }
  catch (e) { toast(e.message, 'error'); }
}

// ── Reports ───────────────────────────────────────────────────────────────────
async function renderReports() {
  const [reports, sports] = await Promise.all([GET('/api/reports'), GET('/api/sports')]);

  const currentYear = '2025-26';

  const content = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-bold text-slate-900">Federal Reports</h1>
          <p class="text-slate-500 text-sm mt-0.5">Equity in Athletics Disclosure Act (EADA) & GSA Roster Reporting</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-5 mb-6">
        <div class="bg-white rounded-xl shadow-sm p-5">
          <h2 class="font-semibold text-slate-900 text-sm mb-4">Generate New Report</h2>
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Academic Year</label>
              <select id="rpt-year" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="2025-26">2025–26</option>
                <option value="2024-25">2024–25</option>
                <option value="2023-24">2023–24</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Sport (leave blank for all sports)</label>
              <select id="rpt-sport" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">All Sports</option>
                ${sports.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Report Type</label>
              <select id="rpt-type" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="eada">EADA — Equity in Athletics Disclosure</option>
                <option value="gsa">GSA Roster Collection</option>
                <option value="title9">Title IX Participation</option>
              </select>
            </div>
            <button onclick="generateReport()" class="w-full py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">Generate Report</button>
          </div>
        </div>

        <div class="bg-brand-50 rounded-xl p-5 border border-brand-100">
          <h2 class="font-semibold text-slate-900 text-sm mb-3">What This Does</h2>
          <ul class="space-y-2.5 text-sm text-slate-700">
            <li class="flex items-start gap-2"><span class="text-brand-600 font-bold mt-0.5">✓</span> Pulls all roster data from the system automatically</li>
            <li class="flex items-start gap-2"><span class="text-brand-600 font-bold mt-0.5">✓</span> Generates a compliance-ready CSV with required fields</li>
            <li class="flex items-start gap-2"><span class="text-brand-600 font-bold mt-0.5">✓</span> Includes eligibility status for each athlete</li>
            <li class="flex items-start gap-2"><span class="text-brand-600 font-bold mt-0.5">✓</span> Summary counts by sport, gender, and status</li>
            <li class="flex items-start gap-2"><span class="text-brand-600 font-bold mt-0.5">✓</span> Timestamped — keeps a history of every report generated</li>
          </ul>
        </div>
      </div>

      <div id="rpt-preview" class="hidden bg-white rounded-xl shadow-sm p-5 mb-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold text-slate-900 text-sm">Report Preview</h2>
          <div class="flex items-center gap-2" id="rpt-actions"></div>
        </div>
        <div id="rpt-content"></div>
      </div>

      <div class="bg-white rounded-xl shadow-sm">
        <div class="p-5 border-b border-slate-100">
          <h2 class="font-semibold text-slate-900 text-sm">Report History</h2>
        </div>
        ${reports.length === 0 ? '<p class="p-5 text-slate-400 text-sm">No reports generated yet.</p>' : `
        <table class="w-full text-sm">
          <thead><tr class="bg-slate-50 border-b border-slate-200">
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Year</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Sport</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Generated</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
            <th class="px-5 py-3"></th>
          </tr></thead>
          <tbody>
            ${reports.map(r => `
              <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50/30">
                <td class="px-5 py-3 font-medium text-slate-800">${esc(r.academic_year)}</td>
                <td class="px-5 py-3 text-slate-600 uppercase text-xs font-semibold">${esc(r.report_type)}</td>
                <td class="px-5 py-3 text-slate-600">${esc(r.sport_name||'All Sports')}</td>
                <td class="px-5 py-3 text-slate-500">${ago(r.generated_at)}</td>
                <td class="px-5 py-3">
                  ${r.submitted_at
                    ? `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Submitted</span>`
                    : `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Not submitted</span>`}
                </td>
                <td class="px-5 py-3 text-right">
                  <a href="/api/reports/${r.id}/csv" class="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 text-brand-700 text-xs font-medium rounded-lg hover:bg-brand-100">↓ CSV</a>
                  ${!r.submitted_at ? `<button onclick="markSubmitted(${r.id})" class="ml-2 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-200">Mark Submitted</button>` : ''}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>`}
      </div>
    </div>`;

  return [content, ''];
}

async function generateReport() {
  const academic_year = document.getElementById('rpt-year').value;
  const sport_id = document.getElementById('rpt-sport').value || null;
  const report_type = document.getElementById('rpt-type').value;
  try {
    const r = await POST('/api/reports/generate', { academic_year, sport_id, report_type });
    const d = r.data;
    const preview = document.getElementById('rpt-preview');
    const content = document.getElementById('rpt-content');
    const actions = document.getElementById('rpt-actions');
    preview.classList.remove('hidden');
    actions.innerHTML = `<a href="/api/reports/${r.id}/csv" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700">↓ Download CSV</a>`;
    content.innerHTML = `
      <div class="grid grid-cols-4 gap-3 mb-4">
        ${[['Total Athletes',d.summary.total,'text-slate-900'],['Eligible',d.summary.eligible,'text-emerald-700'],['Ineligible',d.summary.ineligible,'text-red-600'],['Pending',d.summary.pending,'text-amber-600']].map(([l,v,c])=>`
          <div class="text-center bg-slate-50 rounded-lg p-3">
            <div class="text-xl font-bold ${c}">${v}</div>
            <div class="text-xs text-slate-500">${l}</div>
          </div>`).join('')}
      </div>
      <div class="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
        <table class="w-full text-xs">
          <thead><tr class="bg-slate-50 border-b border-slate-200 sticky top-0">
            <th class="text-left px-3 py-2 font-semibold text-slate-500">Name</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-500">Student ID</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-500">Sport</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-500">Year</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-500">Eligibility</th>
          </tr></thead>
          <tbody>
            ${d.athletes.map(a=>`<tr class="border-b border-slate-100 last:border-0">
              <td class="px-3 py-2 font-medium">${esc(a.name)}</td>
              <td class="px-3 py-2 font-mono text-slate-500">${esc(a.student_id||'—')}</td>
              <td class="px-3 py-2 text-slate-600">${esc(a.sport)}</td>
              <td class="px-3 py-2 text-slate-600">${esc(a.year||'—')}</td>
              <td class="px-3 py-2">${eligBadge(a.eligibility)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    toast('Report generated');
    nav('reports');
  } catch (e) { toast(e.message, 'error'); }
}

async function markSubmitted(id) {
  try { await PUT(`/api/reports/${id}/submit`); toast('Marked as submitted'); nav('reports'); }
  catch (e) { toast(e.message, 'error'); }
}

// ── Settings ──────────────────────────────────────────────────────────────────
async function renderSettings() {
  const [school, certs, users, sports] = await Promise.all([GET('/api/school'), GET('/api/tax-certs'), GET('/api/users'), GET('/api/sports')]);

  const today = new Date().toISOString().split('T')[0];
  const in60 = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];

  const content = `
    <div class="fade-in">
      <div class="mb-6">
        <h1 class="text-xl font-bold text-slate-900">Settings</h1>
      </div>

      <div class="space-y-6">
        <!-- School Info -->
        <div class="bg-white rounded-xl shadow-sm p-5">
          <h2 class="font-semibold text-slate-900 text-sm mb-4">School Information</h2>
          <div class="grid grid-cols-2 gap-4 max-w-xl">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">School Name</label>
              <input id="sch-name" type="text" value="${esc(school.name||'')}" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Division</label>
              <select id="sch-div" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                ${['D2','D3','NAIA','JUCO','NJCAA'].map(d => `<option value="${d}" ${d===school.division?'selected':''}>${d}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">State</label>
              <input id="sch-state" type="text" value="${esc(school.state||'')}" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">EIN / Tax ID</label>
              <input id="sch-ein" type="text" value="${esc(school.ein||'')}" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <input id="sch-phone" type="text" value="${esc(school.phone||'')}" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Address</label>
              <input id="sch-addr" type="text" value="${esc(school.address||'')}" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          ${S.user?.role === 'admin' ? `<button onclick="saveSchool()" class="mt-4 px-5 py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">Save</button>` : '<p class="mt-3 text-xs text-slate-400">Admin access required to edit school info.</p>'}
        </div>

        <!-- Tax Certs -->
        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="font-semibold text-slate-900 text-sm">Tax Exemption Certificates</h2>
              <p class="text-xs text-slate-500 mt-0.5">Upload state tax exemption certs — automatically matched to trips by state</p>
            </div>
            ${S.user?.role === 'admin' ? `<button onclick="modal('upload-cert-modal')" class="px-3 py-1.5 text-xs font-semibold rounded-lg text-white" style="background:#059669">+ Upload Cert</button>` : ''}
          </div>
          ${certs.length === 0
            ? '<p class="text-slate-400 text-sm">No certificates uploaded yet.</p>'
            : `<div class="space-y-2">
              ${certs.map(c => {
                const expiring = c.expiry_date && c.expiry_date <= in60 && c.expiry_date >= today;
                const expired = c.expiry_date && c.expiry_date < today;
                return `<div class="flex items-center gap-3 p-3 border border-slate-200 rounded-lg ${expired?'bg-red-50 border-red-200':expiring?'bg-amber-50 border-amber-200':''}">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${expired?'bg-red-100':expiring?'bg-amber-100':'bg-brand-100'}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${expired?'#dc2626':expiring?'#d97706':'#059669'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="16" y1="6" x2="8" y2="6"/><line x1="16" y1="10" x2="8" y2="10"/><line x1="11" y1="14" x2="8" y2="14"/></svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-semibold text-sm text-slate-800">${esc(c.state)} — ${esc(c.cert_number||'No cert #')}</span>
                      ${expired ? '<span class="text-xs text-red-700 font-semibold">EXPIRED</span>' : expiring ? '<span class="text-xs text-amber-700 font-semibold">EXPIRING SOON</span>' : '<span class="text-xs text-emerald-700 font-semibold">ACTIVE</span>'}
                    </div>
                    <div class="text-xs text-slate-500 mt-0.5">Issued: ${fmt(c.issued_date)} · Expires: ${fmt(c.expiry_date)} ${c.file_name ? '· '+esc(c.file_name) : ''}</div>
                  </div>
                  <div class="flex items-center gap-1">
                    ${c.file_path ? `<a href="/api/tax-certs/${c.id}/download" class="p-1.5 rounded hover:bg-slate-100 text-slate-400">${actionIcon('download','')}</a>` : ''}
                    ${S.user?.role === 'admin' ? actionIcon('delete', `deleteCert(${c.id})`) : ''}
                  </div>
                </div>`;}).join('')}
            </div>`}
        </div>

        <!-- Staff Users -->
        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-semibold text-slate-900 text-sm">Staff Accounts</h2>
            ${S.user?.role === 'admin' ? `<button onclick="modal('new-user-modal')" class="px-3 py-1.5 text-xs font-semibold rounded-lg text-white" style="background:#059669">+ Add User</button>` : ''}
          </div>
          <table class="w-full text-sm">
            <thead><tr class="bg-slate-50 border-b border-slate-200 rounded-lg">
              <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Name</th>
              <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Email</th>
              <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Role</th>
              <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Sport</th>
              <th class="px-4 py-2"></th>
            </tr></thead>
            <tbody>
              ${users.map(u => {
                const sport = sports.find(s => s.id === u.sport_id);
                return `
                <tr class="border-b border-slate-100 last:border-0">
                  <td class="px-4 py-3 font-medium text-slate-800">${esc(u.name)}</td>
                  <td class="px-4 py-3 text-slate-500">${esc(u.email)}</td>
                  <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-semibold ${u.role==='admin'?'bg-brand-100 text-brand-800':u.role==='coach'?'bg-purple-100 text-purple-800':'bg-slate-100 text-slate-600'}">${esc(u.role)}</span></td>
                  <td class="px-4 py-3 text-slate-500 text-xs">${sport ? esc(sport.name) : '<span class="text-slate-300">—</span>'}</td>
                  <td class="px-4 py-3 text-right flex justify-end gap-1">
                    ${u.id === S.user.id
                      ? '<span class="text-xs text-slate-400 px-2">You</span>'
                      : S.user?.role === 'admin'
                        ? actionIcon('edit', `openEditUser(${u.id},'${esc(u.name)}','${esc(u.email)}','${u.role}',${u.sport_id||'null'})`) + actionIcon('delete', `deleteUser(${u.id})`)
                        : ''}
                  </td>
                </tr>`;}).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  const modals = `
    <div id="upload-cert-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div class="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 class="font-semibold text-slate-900">Upload Tax Exemption Certificate</h3>
          <button onclick="closeModal('upload-cert-modal')" class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form id="cert-form" class="p-5 space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">State *</label>
              <input name="state" type="text" maxlength="2" placeholder="NY" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase" required />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Certificate #</label>
              <input name="cert_number" type="text" placeholder="NY-EX-2024-7743" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Issued Date</label>
              <input name="issued_date" type="date" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Expiry Date</label>
              <input name="expiry_date" type="date" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Certificate File (PDF/Image)</label>
            <input name="cert_file" type="file" accept=".pdf,.jpg,.jpeg,.png" class="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
          </div>
        </form>
        <div class="p-5 border-t border-slate-100 flex justify-end gap-3">
          <button onclick="closeModal('upload-cert-modal')" class="px-4 py-2 text-sm text-slate-600">Cancel</button>
          <button onclick="uploadCert()" class="px-5 py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">Upload</button>
        </div>
      </div>
    </div>

    <div id="new-user-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div class="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 class="font-semibold text-slate-900">Add Staff User</h3>
          <button onclick="closeModal('new-user-modal')" class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div class="p-5 space-y-3">
          <div id="u-error" class="hidden p-3 bg-red-50 text-red-700 text-sm rounded-lg"></div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <input id="u-name" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input id="u-email" type="email" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Password</label>
            <input id="u-pass" type="password" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Role</label>
              <select id="u-role" onchange="toggleUserSportField('u-sport-row',this.value)" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="staff">Staff</option>
                <option value="coach">Coach</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div id="u-sport-row" class="hidden">
              <label class="block text-xs font-medium text-slate-600 mb-1">Sport</label>
              <select id="u-sport" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Select…</option>
                ${sports.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="p-5 border-t border-slate-100 flex justify-end gap-3">
          <button onclick="closeModal('new-user-modal')" class="px-4 py-2 text-sm text-slate-600">Cancel</button>
          <button onclick="saveUser()" class="px-5 py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">Add User</button>
        </div>
      </div>
    </div>

    <div id="edit-user-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div class="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 class="font-semibold text-slate-900">Edit User</h3>
          <button onclick="closeModal('edit-user-modal')" class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div class="p-5 space-y-3">
          <input type="hidden" id="eu-id" />
          <div id="eu-error" class="hidden p-3 bg-red-50 text-red-700 text-sm rounded-lg"></div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <input id="eu-name" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input id="eu-email" type="email" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">New Password <span class="text-slate-400 font-normal">(leave blank to keep current)</span></label>
            <input id="eu-pass" type="password" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Role</label>
              <select id="eu-role" onchange="toggleUserSportField('eu-sport-row',this.value)" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="staff">Staff</option>
                <option value="coach">Coach</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div id="eu-sport-row">
              <label class="block text-xs font-medium text-slate-600 mb-1">Sport</label>
              <select id="eu-sport" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">None</option>
                ${sports.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="p-5 border-t border-slate-100 flex justify-end gap-3">
          <button onclick="closeModal('edit-user-modal')" class="px-4 py-2 text-sm text-slate-600">Cancel</button>
          <button onclick="updateUser()" class="px-5 py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">Save Changes</button>
        </div>
      </div>
    </div>`;

  return [content, modals];
}

async function saveSchool() {
  try {
    await PUT('/api/school', {
      name: document.getElementById('sch-name').value.trim(),
      division: document.getElementById('sch-div').value,
      state: document.getElementById('sch-state').value.trim(),
      ein: document.getElementById('sch-ein').value.trim(),
      phone: document.getElementById('sch-phone').value.trim(),
      address: document.getElementById('sch-addr').value.trim(),
    });
    S._school = null;
    toast('School info saved');
  } catch (e) { toast(e.message, 'error'); }
}

async function uploadCert() {
  const form = document.getElementById('cert-form');
  const fd = new FormData(form);
  if (!fd.get('state')) { toast('State is required', 'error'); return; }
  try {
    const r = await fetch('/api/tax-certs', { method: 'POST', body: fd });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Upload failed');
    closeModal('upload-cert-modal');
    toast('Certificate uploaded');
    nav('settings');
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteCert(id) {
  if (!confirm('Delete this certificate?')) return;
  try { await DEL(`/api/tax-certs/${id}`); toast('Certificate removed'); nav('settings'); }
  catch (e) { toast(e.message, 'error'); }
}

function toggleUserSportField(rowId, role) {
  const row = document.getElementById(rowId);
  if (!row) return;
  row.classList.toggle('hidden', role !== 'coach');
}

async function saveUser() {
  const name = document.getElementById('u-name').value.trim();
  const email = document.getElementById('u-email').value.trim();
  const password = document.getElementById('u-pass').value;
  const role = document.getElementById('u-role').value;
  if (!name || !email || !password) { document.getElementById('u-error').textContent='All fields required'; document.getElementById('u-error').classList.remove('hidden'); return; }
  try {
    await POST('/api/users', { name, email, password, role, sport_id: document.getElementById('u-sport')?.value || null });
    closeModal('new-user-modal');
    toast('User added');
    nav('settings');
  } catch (e) { document.getElementById('u-error').textContent = e.message; document.getElementById('u-error').classList.remove('hidden'); }
}

function openEditUser(id, name, email, role, sportId) {
  document.getElementById('eu-id').value = id;
  document.getElementById('eu-name').value = name;
  document.getElementById('eu-email').value = email;
  document.getElementById('eu-role').value = role;
  document.getElementById('eu-sport').value = sportId || '';
  document.getElementById('eu-pass').value = '';
  document.getElementById('eu-error').classList.add('hidden');
  toggleUserSportField('eu-sport-row', role);
  modal('edit-user-modal');
}

async function updateUser() {
  const id = document.getElementById('eu-id').value;
  const name = document.getElementById('eu-name').value.trim();
  const email = document.getElementById('eu-email').value.trim();
  const role = document.getElementById('eu-role').value;
  const password = document.getElementById('eu-pass').value;
  if (!name || !email) { document.getElementById('eu-error').textContent='Name and email required'; document.getElementById('eu-error').classList.remove('hidden'); return; }
  try {
    await PUT(`/api/users/${id}`, { name, email, role, sport_id: document.getElementById('eu-sport')?.value || null, ...(password ? { password } : {}) });
    closeModal('edit-user-modal');
    toast('User updated');
    nav('settings');
  } catch (e) { document.getElementById('eu-error').textContent = e.message; document.getElementById('eu-error').classList.remove('hidden'); }
}

async function deleteUser(id) {
  if (!confirm('Remove this user?')) return;
  try { await DEL(`/api/users/${id}`); toast('User removed'); nav('settings'); }
  catch (e) { toast(e.message, 'error'); }
}

function renderPerDiemDisplay(trip, manifest) {
  if (!trip.per_diem_rate) {
    return `<p class="text-slate-400 text-sm">No per diem rate set for this trip.</p>`;
  }
  const rate = Number(trip.per_diem_rate);
  const depart = trip.depart_date ? new Date(trip.depart_date) : null;
  const ret = trip.return_date ? new Date(trip.return_date) : null;
  const days = depart && ret ? Math.max(1, Math.round((ret - depart) / 86400000) + 1) : 1;
  const perAthlete = rate * days;
  const total = perAthlete * (manifest?.length || 0);
  return `
    <div class="grid grid-cols-2 gap-3 mb-3">
      <div class="bg-white rounded-lg p-3 text-center">
        <div class="text-lg font-bold text-slate-900">$${rate.toFixed(2)}</div>
        <div class="text-xs text-slate-500">Per Day / Athlete</div>
      </div>
      <div class="bg-white rounded-lg p-3 text-center">
        <div class="text-lg font-bold text-slate-900">${days}</div>
        <div class="text-xs text-slate-500">Trip Day${days !== 1 ? 's' : ''}</div>
      </div>
      <div class="bg-white rounded-lg p-3 text-center">
        <div class="text-lg font-bold text-emerald-700">$${perAthlete.toFixed(2)}</div>
        <div class="text-xs text-slate-500">Per Athlete Total</div>
      </div>
      <div class="bg-white rounded-lg p-3 text-center">
        <div class="text-lg font-bold text-emerald-700">$${total.toFixed(2)}</div>
        <div class="text-xs text-slate-500">Total Budget (${manifest?.length || 0} athletes)</div>
      </div>
    </div>
    <div class="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
      <span class="text-xs text-slate-500">Virtual card issuance via Stripe — <strong>coming soon</strong></span>
    </div>`;
}

function editPerDiem(tripId) {
  const display = document.getElementById('per-diem-display');
  const btn = document.getElementById('per-diem-edit-btn');
  const currentRate = display.querySelector('.text-lg')?.textContent?.replace('$','') || '';
  display.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">$</span>
        <input id="per-diem-input" type="number" min="0" step="0.01" value="${currentRate}"
          placeholder="45.00"
          class="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          onkeydown="if(event.key==='Enter')savePerDiem(${tripId})" />
      </div>
      <span class="text-slate-400 text-sm">/day per athlete</span>
      <button onclick="savePerDiem(${tripId})" class="px-4 py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">Save</button>
      <button onclick="nav('trip-detail',{id:${tripId},tab:'documents'})" class="px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
    </div>`;
  btn.textContent = '';
  document.getElementById('per-diem-input')?.focus();
}

async function savePerDiem(tripId) {
  const val = document.getElementById('per-diem-input')?.value;
  try {
    await fetch(`/api/trips/${tripId}/per-diem`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ per_diem_rate: val || null })
    });
    toast('Per diem saved');
    nav('trip-detail', { id: tripId, tab: 'documents' });
  } catch (e) { toast(e.message, 'error'); }
}

async function patchEligibility(id, status) {
  try {
    await fetch(`/api/athletes/${id}/eligibility`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eligibility_status: status })
    });
    toast(status === 'eligible' ? 'Marked eligible' : `Marked ${status}`);
    nav('roster', S.params);
  } catch (e) { toast(e.message, 'error'); }
}

async function printManifest(tripId) {
  const [trip, manifest] = await Promise.all([GET(`/api/trips/${tripId}`), GET(`/api/trips/${tripId}/manifest`)]);
  const school = S._school?.name || '';
  const w = window.open('', '_blank', 'width=820,height=650');
  w.document.write(`<!DOCTYPE html><html><head><title>Manifest — ${trip.name}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;margin:28px;color:#111}
  h1{font-size:17px;margin:0 0 3px}
  .meta{color:#555;font-size:11px;margin-bottom:18px;line-height:1.6}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{background:#f3f3f3;border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em}
  td{border:1px solid #ddd;padding:7px 10px;vertical-align:top}
  .conflict td{background:#fff5f5}
  .badge{display:inline-block;padding:1px 7px;border-radius:20px;font-size:10px;font-weight:700}
  .eligible{background:#d1fae5;color:#065f46}
  .ineligible{background:#fee2e2;color:#991b1b}
  .pending{background:#fef3c7;color:#92400e}
  .note{color:#888;font-size:10px;margin-top:2px}
  .footer{margin-top:20px;font-size:10px;color:#888;border-top:1px solid #ddd;padding-top:8px;display:flex;justify-content:space-between}
  .print-btn{margin-top:16px;padding:6px 16px;background:#059669;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px}
  @media print{.print-btn{display:none}}
</style></head><body>
<h1>${trip.name}</h1>
<div class="meta">
  ${school}${trip.sport_name ? ' &nbsp;·&nbsp; ' + trip.sport_name : ''} &nbsp;·&nbsp; Departs: ${trip.depart_date}${trip.return_date ? ' → ' + trip.return_date : ''}
  ${trip.destination ? '<br>Destination: ' + trip.destination : ''}${trip.opponent ? ' &nbsp;vs&nbsp; ' + trip.opponent : ''}
  ${trip.charter_vendor ? '<br>Charter: ' + trip.charter_vendor + (trip.charter_amount ? ' ($' + Number(trip.charter_amount).toLocaleString() + ')' : '') + (trip.charter_state ? ' — ' + trip.charter_state : '') : ''}
  ${trip.roster_locked ? '<br>🔒 Roster Locked' : ''}
</div>
<table><thead><tr><th>#</th><th>Name</th><th>Student ID</th><th>Year</th><th>Eligibility</th></tr></thead><tbody>
${manifest.map((m, i) => `<tr class="${m.eligibility_status !== 'eligible' ? 'conflict' : ''}">
  <td>${i + 1}</td><td>${m.name}</td>
  <td style="font-family:monospace">${m.student_id || '—'}</td>
  <td>${m.year || '—'}</td>
  <td><span class="badge ${m.eligibility_status}">${m.eligibility_status}</span>${m.eligibility_note ? '<div class="note">' + m.eligibility_note + '</div>' : ''}</td>
</tr>`).join('')}
</tbody></table>
<div class="footer">
  <span>Total: ${manifest.length} &nbsp;·&nbsp; Eligible: ${manifest.filter(m => m.eligibility_status === 'eligible').length} &nbsp;·&nbsp; Conflicts: ${manifest.filter(m => m.eligibility_status !== 'eligible').length}</span>
  <span>Generated: ${new Date().toLocaleString()}</span>
</div>
<button class="print-btn" onclick="window.print()">Print</button>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

async function importCSVRoster() {
  const file = document.getElementById('import-file')?.files[0];
  const errEl = document.getElementById('import-error');
  const resEl = document.getElementById('import-result');
  errEl.classList.add('hidden');
  resEl.classList.add('hidden');
  if (!file) { errEl.textContent = 'Select a CSV file first'; errEl.classList.remove('hidden'); return; }
  const fd = new FormData();
  fd.append('csv_file', file);
  try {
    const r = await fetch('/api/athletes/import', { method: 'POST', body: fd });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Import failed');
    resEl.textContent = `Imported ${d.imported} athletes${d.skipped > 0 ? ` (${d.skipped} skipped — unknown sport or blank name)` : ''}.`;
    resEl.classList.remove('hidden');
    setTimeout(() => { closeModal('import-csv-modal'); nav('roster', S.params); }, 1800);
  } catch (e) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
}

// ── Bind Events ───────────────────────────────────────────────────────────────
function bindEvents() {
  document.querySelectorAll('[data-modal-close]').forEach(el => {
    el.addEventListener('click', () => closeModal(el.dataset.modalClose));
  });
  document.querySelectorAll('.modal-backdrop').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) el.classList.add('hidden'); });
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const me = await GET('/api/auth/me');
    S.user = me;
    nav('dashboard');
  } catch {
    nav('login');
  }
}

init();

// ── Game Day Readiness Board ──────────────────────────────────────────────────
const SPORT_EMOJI = {football:'🏈',volleyball:'🏐',soccer:'⚽',basketball:'🏀','men\'s basketball':'🏀','women\'s basketball':'🏀','men\'s soccer':'⚽','women\'s soccer':'⚽',baseball:'⚾',softball:'🥎',track:'🏃',swimming:'🏊',tennis:'🎾',golf:'⛳',wrestling:'🤼',lacrosse:'🥍',hockey:'🏒'};
function sportEmoji(name) { return SPORT_EMOJI[(name||'').toLowerCase()] || '🏅'; }

async function renderGameDay() {
  const today = new Date().toISOString().split('T')[0];
  const games = await GET(`/api/gameday/readiness?date=${today}`);

  const totalAthletes = games.reduce((s,g)=>s+g.total_athletes,0);
  const totalCleared  = games.reduce((s,g)=>s+g.cleared,0);
  const totalBlocked  = games.reduce((s,g)=>s+g.blocked,0);
  const totalConflicts= games.reduce((s,g)=>s+g.conflicts,0);
  const overallPct    = totalAthletes > 0 ? Math.round(totalCleared/totalAthletes*100) : 0;
  const pctColor      = overallPct >= 90 ? '#10b981' : overallPct >= 75 ? '#f59e0b' : '#ef4444';

  const content = `
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Game Day Command</h1>
      <p class="text-sm text-slate-500 mt-0.5">${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</p>
    </div>
    <button onclick="nav('gameday')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg transition-colors">↻ Refresh</button>
  </div>

  ${games.length === 0 ? `
  <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center">
    <div class="text-5xl mb-3">📅</div>
    <p class="text-slate-600 font-medium">No games scheduled today</p>
    <p class="text-slate-400 text-sm mt-1">Add a game event to start tracking eligibility</p>
    <button onclick="showAddGameModal()" class="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">+ Add Today's Game</button>
  </div>` : `

  <!-- Overall clearance banner -->
  <div class="rounded-2xl p-5 mb-5 text-white" style="background:linear-gradient(135deg,#0f172a,#1e293b)">
    <div class="flex items-center justify-between mb-3">
      <span class="text-sm font-semibold text-slate-400 uppercase tracking-wider">Overall Game Day Readiness</span>
      <span class="text-3xl font-black" style="color:${pctColor}">${overallPct}%</span>
    </div>
    <div class="w-full bg-slate-700 rounded-full h-2.5 mb-3">
      <div class="h-2.5 rounded-full transition-all" style="width:${overallPct}%;background:${pctColor}"></div>
    </div>
    <div class="flex gap-4 text-xs">
      <span class="text-emerald-400 font-bold">✓ ${totalCleared} cleared</span>
      <span class="text-red-400 font-bold">✗ ${totalBlocked} blocked</span>
      ${totalConflicts > 0 ? `<span class="text-amber-400 font-bold">⚡ ${totalConflicts} conflict${totalConflicts>1?'s':''}</span>` : ''}
      <span class="text-slate-400">${totalAthletes} total</span>
    </div>
  </div>

  <!-- Per-game cards -->
  ${games.map(g => {
    const emoji = sportEmoji(g.sport_name || g.team_name);
    const pct = g.cleared_pct;
    const barColor = pct >= 90 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#ef4444';
    const gameTime = g.game_time ? g.game_time.slice(0,5) : '';
    const checked = g.last_checked_at ? new Date(g.last_checked_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}) : 'Not yet';
    return `
    <div class="bg-white rounded-2xl border border-slate-200 p-5 mb-4 hover:border-slate-300 transition-colors">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-3">
          <span class="text-3xl">${emoji}</span>
          <div>
            <p class="font-bold text-slate-900">${esc(g.sport_name||g.team_name)}</p>
            <p class="text-sm text-slate-500">vs ${esc(g.opponent)} · ${gameTime} · ${g.is_home?'Home':'Away'}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="text-xl font-black" style="color:${barColor}">${pct}%</span>
          <p class="text-xs text-slate-400">cleared</p>
        </div>
      </div>
      <div class="w-full bg-slate-100 rounded-full h-2 mb-3">
        <div class="h-2 rounded-full" style="width:${pct}%;background:${barColor}"></div>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex gap-3 text-xs">
          <span class="text-emerald-600 font-semibold">✓ ${g.cleared}</span>
          <span class="text-red-600 font-semibold">✗ ${g.blocked}</span>
          ${g.conflicts > 0 ? `<span class="text-amber-600 font-semibold">⚡ ${g.conflicts} conflict</span>` : ''}
          ${g.unchecked > 0 ? `<span class="text-slate-400">${g.unchecked} unchecked</span>` : ''}
        </div>
        <div class="flex gap-2">
          <button onclick="runGameCheck(${g.game_event_id})" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded-lg transition-colors">Run Check</button>
          <button onclick="nav('gameday-roster',{gameId:${g.game_event_id},gameName:'${esc(g.sport_name||g.team_name)} vs ${esc(g.opponent)}'})" class="text-xs bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 rounded-lg transition-colors">View Roster →</button>
        </div>
      </div>
      <p class="text-xs text-slate-400 mt-2">Last checked: ${checked}</p>
    </div>`;
  }).join('')}

  <button onclick="showAddGameModal()" class="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:border-orange-300 hover:text-orange-500 transition-colors">+ Add Game Event</button>
  `}`;

  const modals = `
  <div id="add-game-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl w-full max-w-md p-6">
      <h3 class="font-bold text-slate-900 mb-4">Add Game Event</h3>
      <div class="space-y-3">
        <select id="ag-sport" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"><option value="">Select sport…</option></select>
        <input id="ag-opponent" type="text" placeholder="Opponent name" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"/>
        <div class="flex gap-2">
          <input id="ag-date" type="date" value="${today}" class="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"/>
          <input id="ag-time" type="time" class="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"/>
        </div>
        <input id="ag-location" type="text" placeholder="Location" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"/>
        <label class="flex items-center gap-2 text-sm text-slate-600"><input id="ag-home" type="checkbox" checked/> Home game</label>
      </div>
      <div class="flex gap-2 mt-5">
        <button onclick="closeModal('add-game-modal')" class="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onclick="submitAddGame()" class="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600">Add Game</button>
      </div>
    </div>
  </div>`;

  // Load sports into select
  setTimeout(async () => {
    const sports = await GET('/api/sports').catch(()=>[]);
    const sel = document.getElementById('ag-sport');
    if (sel) sel.innerHTML = '<option value="">Select sport…</option>' + sports.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
  }, 50);

  return [content, modals];
}

async function showAddGameModal() { modal('add-game-modal'); }

async function submitAddGame() {
  const sport_id = document.getElementById('ag-sport').value;
  const opponent = document.getElementById('ag-opponent').value.trim();
  const game_date = document.getElementById('ag-date').value;
  const game_time = document.getElementById('ag-time').value;
  const location = document.getElementById('ag-location').value.trim();
  const is_home = document.getElementById('ag-home').checked;
  if (!sport_id || !opponent || !game_date) { toast('Sport, opponent, and date are required', 'error'); return; }
  try {
    await POST('/api/gameday/games', { sport_id: parseInt(sport_id), opponent, game_date, game_time: game_time||null, location: location||null, is_home });
    closeModal('add-game-modal');
    toast('Game added — running eligibility check…');
    nav('gameday');
  } catch(e) { toast(e.message, 'error'); }
}

async function runGameCheck(gameId) {
  try {
    toast('Running eligibility check…', 'info');
    await POST(`/api/gameday/game/${gameId}/check`);
    toast('Eligibility updated ✓');
    nav('gameday');
  } catch(e) { toast(e.message, 'error'); }
}

// ── Game Roster ───────────────────────────────────────────────────────────────
async function renderGameRoster() {
  const { gameId, gameName } = S.params;
  if (!gameId) { nav('gameday'); return ['',''] }

  const [roster, atRisk] = await Promise.all([
    GET(`/api/gameday/game/${gameId}/roster`),
    GET('/api/academic/at-risk').catch(() => []),
  ]);
  const atRiskById = Object.fromEntries(atRisk.map(a => [a.id, a]));
  const cleared   = roster.filter(r => r.is_cleared);
  const blocked   = roster.filter(r => !r.is_cleared && !r.conflict_flag);
  const conflicts = roster.filter(r => r.conflict_flag && !r.conflict_resolved);

  const content = `
  <div class="mb-5 flex items-center gap-3">
    <button onclick="nav('gameday')" class="text-slate-400 hover:text-slate-700">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
    </button>
    <div>
      <h1 class="text-xl font-bold text-slate-900">Game Day Roster</h1>
      <p class="text-sm text-slate-500">${esc(gameName||'')}</p>
    </div>
    <a href="/api/gameday/roster-export/${gameId}" class="ml-auto text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg">↓ Export CSV</a>
  </div>

  <!-- Summary pills -->
  <div class="flex gap-2 mb-5 flex-wrap">
    <span class="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">✓ ${cleared.length} Cleared</span>
    <span class="px-3 py-1.5 bg-red-100 text-red-800 rounded-full text-xs font-bold">✗ ${blocked.length} Blocked</span>
    ${conflicts.length ? `<span class="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">⚡ ${conflicts.length} Conflict</span>` : ''}
    <button onclick="runGameCheck(${gameId}).then(()=>nav('gameday-roster',S.params))" class="ml-auto text-xs bg-orange-500 text-white px-3 py-1.5 rounded-full font-semibold hover:bg-orange-600 transition-colors">↻ Re-Check</button>
  </div>

  ${roster.length === 0 ? '<p class="text-slate-400 text-center py-10">No athletes found for this sport.</p>' :
    roster.map(a => {
      const isCleared = a.is_cleared;
      const hasConflict = a.conflict_flag && !a.conflict_resolved;
      const bgClass = hasConflict ? 'border-amber-300 bg-amber-50' : isCleared ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50';
      const badge = hasConflict
        ? '<span class="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">⚡ Conflict</span>'
        : isCleared
        ? '<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">✓ Cleared</span>'
        : '<span class="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-bold rounded-full">✗ Blocked</span>';

      const periodsHtml = a.periods_total > 0 ? (() => {
        const attended = a.periods_attended || 0;
        const total = a.periods_total || 7;
        return Array.from({length:total},(_,i)=>`<div class="w-6 h-6 rounded-md text-xs flex items-center justify-center font-bold ${i<attended?'bg-emerald-500 text-white':'bg-slate-200 text-slate-400'}">${i+1}</div>`).join('');
      })() : '';

      const athleteRisk = atRiskById[a.athlete_id];
      return `
      <div class="bg-white border rounded-xl p-4 mb-3 ${bgClass}">
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span class="font-bold text-slate-900">${esc(a.athlete_name)}</span>
              ${badge}
              ${a.eligibility_status !== 'eligible' ? `<span class="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-xs rounded">${esc(a.eligibility_status)}</span>` : ''}
            </div>
            <p class="text-xs text-slate-500">${esc(a.student_id||'')} · ${esc(a.year||'')}</p>
            ${a.blocked_reason ? `<p class="text-xs text-red-600 mt-1">${esc(a.blocked_reason)}</p>` : ''}
            ${athleteRisk ? academicRiskBadge(athleteRisk.academic_risk_level, athleteRisk.academic_risk_data) : ''}
            ${periodsHtml ? `<div class="flex gap-1 mt-2">${periodsHtml}</div>` : ''}
            ${hasConflict && a.conflict_data ? `
            <div class="mt-2 p-2 bg-amber-100 rounded-lg text-xs text-amber-800">
              <strong>Conflict:</strong> ${esc(JSON.parse(typeof a.conflict_data==='string'?a.conflict_data:JSON.stringify(a.conflict_data)).reason||'')}
            </div>
            <div class="flex gap-2 mt-2">
              <button onclick="resolveConflict(${a.eligibility_id},'override_cleared')" class="text-xs bg-emerald-500 text-white px-2.5 py-1 rounded-lg hover:bg-emerald-600">✓ Clear to Play</button>
              <button onclick="resolveConflict(${a.eligibility_id},'override_blocked')" class="text-xs bg-red-500 text-white px-2.5 py-1 rounded-lg hover:bg-red-600">✗ Block</button>
            </div>` : ''}
          </div>
        </div>
      </div>`;
    }).join('')}`;

  return [content, ''];
}

async function resolveConflict(eligibilityId, resolution) {
  try {
    await POST('/api/gameday/conflict/resolve', { eligibility_id: eligibilityId, resolution });
    toast(resolution === 'override_cleared' ? 'Cleared for play ✓' : 'Athlete blocked ✗');
    nav('gameday-roster', S.params);
  } catch(e) { toast(e.message, 'error'); }
}

async function triggerAcademicSync() {
  try {
    toast('Syncing academic data from SchoolBridge…', 'info');
    await POST('/api/academic/sync');
    toast('Academic sync complete ✓');
    nav('dashboard');
  } catch(e) { toast(e.message, 'error'); }
}

// Academic risk badge helper used in roster and game day views
function academicRiskBadge(riskLevel, riskData) {
  if (!riskLevel || riskLevel === 'safe') return '';
  const data = typeof riskData === 'string' ? JSON.parse(riskData || '{}') : (riskData || {});
  const reasons = (data.risk_reasons || []).join(' · ');
  if (riskLevel === 'critical') {
    return `<div class="mt-1.5 px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium">🚨 Academic Critical: ${esc(reasons)}</div>`;
  }
  return `<div class="mt-1.5 px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium">⚠️ Academic Warning: ${esc(reasons)}</div>`;
}
