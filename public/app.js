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
  const navLinks = [
    { page: 'dashboard', label: 'Dashboard', svg: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' },
    { page: 'trips', label: 'Trips', svg: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>' },
    { page: 'roster', label: 'Roster', svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
    { page: 'reports', label: 'Reports', svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>' },
    { page: 'settings', label: 'Settings', svg: '<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 19.07l1.41-1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/>' },
  ];

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
      case 'trips':        [content, modals] = await renderTrips(); break;
      case 'trip-detail':  [content, modals] = await renderTripDetail(); break;
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
  return `
  <div class="min-h-screen flex items-center justify-center" style="background:linear-gradient(135deg,#0f172a 0%,#065f46 100%)">
    <div class="w-full max-w-sm fade-in">
      <div class="text-center mb-8">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style="background:#059669">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <h1 class="text-2xl font-bold text-white">Operation Pivot</h1>
        <p class="text-slate-400 text-sm mt-1">Athletic Director Platform</p>
      </div>
      <div class="bg-white rounded-2xl shadow-2xl p-8">
        <div id="login-error" class="hidden mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg"></div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input id="login-email" type="email" placeholder="you@school.edu" class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input id="login-password" type="password" placeholder="••••••••" class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
          </div>
          <button id="login-btn" class="w-full py-2.5 rounded-lg text-white text-sm font-semibold transition-colors" style="background:#059669">Sign in</button>
        </div>
        <p class="text-center text-xs text-slate-400 mt-5">Demo: admin@operationpivot.demo / pivot123</p>
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

async function logout() {
  await POST('/auth/logout');
  S.user = null; S._school = null;
  nav('login');
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function renderDashboard() {
  const d = await GET('/api/dashboard');

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
            ${d.activity.map(a => `
              <div class="flex items-start gap-3">
                <div class="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${a.action==='eligibility_change'?'bg-red-400':a.action==='roster_locked'?'bg-brand-500':'bg-slate-300'}"></div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-slate-700 leading-snug">${esc(a.detail||a.action)}</p>
                  <p class="text-xs text-slate-400 mt-0.5">${ago(a.created_at)} ${a.user_name?'· '+esc(a.user_name):''}</p>
                </div>
              </div>`).join('')}
          </div>`}
        </div>
      </div>
    </div>`;

  return [content, ''];
}

// ── Trips ─────────────────────────────────────────────────────────────────────
async function renderTrips() {
  const [trips, sports] = await Promise.all([GET('/api/trips'), GET('/api/sports')]);

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

  const content = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-bold text-slate-900">Trips</h1>
          <p class="text-slate-500 text-sm mt-0.5">${trips.length} total</p>
        </div>
        <button onclick="modal('new-trip-modal')" class="px-4 py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">+ New Trip</button>
      </div>

      ${upcoming.length > 0 ? `
        <div class="mb-6">
          <h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Upcoming & Active</h2>
          <div class="grid grid-cols-2 gap-4">${upcoming.map(tripCard).join('')}</div>
        </div>` : '<div class="text-center py-12 text-slate-400 bg-white rounded-xl shadow-sm"><p class="text-lg font-medium mb-1">No trips yet</p><p class="text-sm">Create your first trip to get started.</p></div>'}

      ${completed.length > 0 ? `
        <div>
          <h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Completed</h2>
          <div class="grid grid-cols-2 gap-4">${completed.map(tripCard).join('')}</div>
        </div>` : ''}
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

  const certStatus = trip.charter_vendor ? (
    matchCert
      ? `<div class="flex items-center gap-2 text-sm text-emerald-700 font-medium"><span class="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-xs">✓</span> ${esc(trip.charter_state)} cert on file — ${esc(matchCert.cert_number||'')} (expires ${fmt(matchCert.expiry_date)})</div>`
      : `<div class="flex items-center gap-2 text-sm text-red-700 font-medium"><span class="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-xs">!</span> No tax exemption cert on file for ${esc(trip.charter_state||'this state')} — <button onclick="nav('settings')" class="underline">Upload in Settings</button></div>`
  ) : `<p class="text-slate-400 text-sm">No charter vendor set for this trip.</p>`;

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
        <h3 class="font-semibold text-slate-800 text-sm mb-3">Tax Exemption Status</h3>
        ${certStatus}
        ${matchCert?.file_name ? `<div class="mt-3">
          <a href="/api/tax-certs/${matchCert.id}/download" class="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-50 text-brand-700 text-xs font-medium rounded-lg hover:bg-brand-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download ${esc(matchCert.file_name)}
          </a>
        </div>` : ''}
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
        <button onclick="deleteTrip(${id})" class="px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50">Delete Trip</button>
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
      </div>

      <div class="flex border-b border-slate-200 mb-5">
        ${tabs.map(t => `<button onclick="${tdNav(t)}" class="px-5 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${tab===t?'border-brand-500 text-brand-700':'border-transparent text-slate-500 hover:text-slate-700'}">${t}</button>`).join('')}
      </div>

      ${tabContent}
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

  return [content, addAthleteModal];
}

function openAddAthleteModal() { modal('add-athlete-manifest-modal'); }

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

async function deleteTrip(id) {
  if (!confirm('Delete this trip? This cannot be undone.')) return;
  try { await DEL(`/api/trips/${id}`); toast('Trip deleted'); nav('trips'); }
  catch (e) { toast(e.message, 'error'); }
}

// ── Roster ────────────────────────────────────────────────────────────────────
async function renderRoster() {
  const [athletes, sports] = await Promise.all([GET('/api/athletes'), GET('/api/sports')]);
  const filter = S.params?.filter || 'all';
  const sportFilter = S.params?.sport || '';

  const filtered = athletes.filter(a => {
    if (filter !== 'all' && a.eligibility_status !== filter) return false;
    if (sportFilter && String(a.sport_id) !== String(sportFilter)) return false;
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
          <button onclick="modal('import-csv-modal')" class="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">↑ Import CSV</button>
          <button onclick="modal('new-athlete-modal')" class="px-4 py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">+ Add Athlete</button>
        </div>
      </div>

      <div class="flex items-center gap-3 mb-5 flex-wrap">
        ${['all','eligible','ineligible','pending'].map(f => `
          <button onclick="nav('roster',{filter:'${f}',sport:'${sportFilter}'})"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter===f?'bg-brand-600 text-white':'bg-white text-slate-600 hover:bg-slate-100 shadow-sm'}">
            ${f==='all'?'All Athletes':f.charAt(0).toUpperCase()+f.slice(1)}
            <span class="ml-1 text-xs ${filter===f?'opacity-75':'text-slate-400'}">${counts[f]}</span>
          </button>`).join('')}
        <select onchange="nav('roster',{filter:'${filter}',sport:this.value})" class="ml-auto px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">All Sports</option>
          ${sports.map(s => `<option value="${s.id}" ${String(s.id)===String(sportFilter)?'selected':''}>${esc(s.name)}</option>`).join('')}
        </select>
      </div>

      ${Object.keys(grouped).length === 0
        ? '<div class="text-center py-12 bg-white rounded-xl shadow-sm text-slate-400"><p class="font-medium">No athletes found</p></div>'
        : Object.entries(grouped).map(([sport, list]) => `
          <div class="mb-5">
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
                    <tr class="border-b border-slate-100 last:border-0 ${a.eligibility_status!=='eligible'?'bg-red-50/30':'hover:bg-slate-50/30'}">
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
                        ${actionIcon('delete', `deleteAthlete(${a.id})`)}
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
  const [school, certs, users] = await Promise.all([GET('/api/school'), GET('/api/tax-certs'), GET('/api/users')]);

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
          <button onclick="saveSchool()" class="mt-4 px-5 py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">Save</button>
        </div>

        <!-- Tax Certs -->
        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="font-semibold text-slate-900 text-sm">Tax Exemption Certificates</h2>
              <p class="text-xs text-slate-500 mt-0.5">Upload state tax exemption certs — automatically matched to trips by state</p>
            </div>
            <button onclick="modal('upload-cert-modal')" class="px-3 py-1.5 text-xs font-semibold rounded-lg text-white" style="background:#059669">+ Upload Cert</button>
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
                    ${actionIcon('delete', `deleteCert(${c.id})`)}
                  </div>
                </div>`;}).join('')}
            </div>`}
        </div>

        <!-- Staff Users -->
        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-semibold text-slate-900 text-sm">Staff Accounts</h2>
            <button onclick="modal('new-user-modal')" class="px-3 py-1.5 text-xs font-semibold rounded-lg text-white" style="background:#059669">+ Add User</button>
          </div>
          <table class="w-full text-sm">
            <thead><tr class="bg-slate-50 border-b border-slate-200 rounded-lg">
              <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Name</th>
              <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Email</th>
              <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Role</th>
              <th class="px-4 py-2"></th>
            </tr></thead>
            <tbody>
              ${users.map(u => `
                <tr class="border-b border-slate-100 last:border-0">
                  <td class="px-4 py-3 font-medium text-slate-800">${esc(u.name)}</td>
                  <td class="px-4 py-3 text-slate-500">${esc(u.email)}</td>
                  <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-semibold ${u.role==='admin'?'bg-brand-100 text-brand-800':'bg-slate-100 text-slate-600'}">${esc(u.role)}</span></td>
                  <td class="px-4 py-3 text-right">
                    ${u.id !== S.user.id ? actionIcon('delete', `deleteUser(${u.id})`) : '<span class="text-xs text-slate-400 px-2">You</span>'}
                  </td>
                </tr>`).join('')}
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
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <select id="u-role" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div class="p-5 border-t border-slate-100 flex justify-end gap-3">
          <button onclick="closeModal('new-user-modal')" class="px-4 py-2 text-sm text-slate-600">Cancel</button>
          <button onclick="saveUser()" class="px-5 py-2 rounded-lg text-white text-sm font-semibold" style="background:#059669">Add User</button>
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

async function saveUser() {
  const name = document.getElementById('u-name').value.trim();
  const email = document.getElementById('u-email').value.trim();
  const password = document.getElementById('u-pass').value;
  if (!name || !email || !password) { document.getElementById('u-error').textContent='All fields required'; document.getElementById('u-error').classList.remove('hidden'); return; }
  try {
    await POST('/api/users', { name, email, password, role: document.getElementById('u-role').value });
    closeModal('new-user-modal');
    toast('User added');
    nav('settings');
  } catch (e) { document.getElementById('u-error').textContent = e.message; document.getElementById('u-error').classList.remove('hidden'); }
}

async function deleteUser(id) {
  if (!confirm('Remove this user?')) return;
  try { await DEL(`/api/users/${id}`); toast('User removed'); nav('settings'); }
  catch (e) { toast(e.message, 'error'); }
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
