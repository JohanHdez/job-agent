/**
 * Job Agent UI — report.js
 * Fetches /api/report and renders stats, platform chart, and job cards.
 */

'use strict';

const API_BASE = 'http://localhost:3000/api';

const PLATFORM_LABELS = {
  linkedin:     { name: 'LinkedIn',     color: '#0077b5', cls: 'plat-linkedin' },
  indeed:       { name: 'Indeed',       color: '#003399', cls: 'plat-indeed' },
  computrabajo: { name: 'Computrabajo', color: '#e83010', cls: 'plat-computrabajo' },
  bumeran:      { name: 'Bumeran',      color: '#ff6400', cls: 'plat-bumeran' },
  getonboard:   { name: 'Get on Board', color: '#00c2a8', cls: 'plat-getonboard' },
  infojobs:     { name: 'InfoJobs',     color: '#1b5ea7', cls: 'plat-infojobs' },
  greenhouse:   { name: 'Greenhouse',   color: '#3d9970', cls: 'plat-greenhouse' },
};

const STATUS_LABELS = {
  applied:                   { text: '✅ Applied',      cls: 'status-applied' },
  skipped_low_score:         { text: '⏭️ Skipped',      cls: 'status-skipped' },
  failed:                    { text: '❌ Failed',        cls: 'status-failed' },
  already_applied:           { text: '🔄 Already',      cls: 'status-already_applied' },
  easy_apply_not_available:  { text: '🔗 Aplica aquí',  cls: 'status-easy_apply_not_available' },
};

const METHOD_LABELS = {
  linkedin_easy_apply: { text: 'Easy Apply',     color: '#0077b5' },
  greenhouse_api:      { text: 'Greenhouse API', color: '#3d9970' },
  lever_api:           { text: 'Lever API',       color: '#c0392b' },
  email:               { text: 'Email',           color: '#9b59b6' },
  manual:              { text: 'Manual',          color: '#64748b' },
};

let allApplications = [];
let currentFilter = 'all';
let currentMethodFilter = 'all';

// ── Fetch & render ────────────────────────────────────────────────

async function loadReport() {
  try {
    const res = await fetch(`${API_BASE}/report`);
    const data = await res.json();

    if (!res.ok || !data.available) {
      showEmpty(data.message || 'No report found. Run the agent first.');
      return;
    }

    allApplications = data.applications || [];
    renderStats(data.summary, data.applications);
    renderPlatformChart(data.applications);
    renderMethodChart(data.applications);
    renderFilters();
    renderMethodFilters(data.applications);
    renderCards(data.applications);
    updateReportMeta(data.summary);

  } catch (err) {
    showEmpty('Could not connect to the API server. Make sure it is running (npm start).');
  }
}

function updateReportMeta(summary) {
  const el = document.getElementById('report-meta');
  if (!el || !summary) return;

  const dur = summary.durationSeconds;
  const durStr = dur >= 60 ? `${Math.round(dur / 60)}m` : `${dur}s`;
  const date = new Date(summary.sessionStartedAt).toLocaleString();
  el.textContent = `Session started ${date} · Duration: ${durStr}`;
}

// ── Stats row ─────────────────────────────────────────────────────

function renderStats(summary, applications) {
  const statsRow = document.getElementById('stats-row');
  if (!statsRow || !summary) return;

  const platformCount = new Set(applications.map((a) => a.job?.platform)).size;

  const cards = [
    { value: summary.totalFound,   label: 'Encontradas',     cls: 'blue' },
    { value: summary.totalApplied, label: 'Aplicadas',       cls: 'green' },
    { value: summary.totalManual ?? 0, label: 'Aplica tú',  cls: '' },
    { value: summary.totalSkipped, label: 'Bajo score',      cls: 'yellow' },
    { value: summary.totalFailed,  label: 'Fallidas',        cls: 'red' },
  ];

  statsRow.innerHTML = cards.map(({ value, label, cls }) => `
    <div class="stat-card">
      <div class="stat-value ${cls}">${value ?? 0}</div>
      <div class="stat-label">${label}</div>
    </div>
  `).join('');
}

// ── Platform chart ────────────────────────────────────────────────

function renderPlatformChart(applications) {
  const section = document.getElementById('platform-chart');
  const barsEl  = document.getElementById('platform-bars');
  if (!section || !barsEl || !applications.length) return;

  const counts = {};
  for (const app of applications) {
    const p = app.job?.platform || 'unknown';
    counts[p] = (counts[p] || 0) + 1;
  }

  const maxCount = Math.max(...Object.values(counts), 1);
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (entries.length < 2) { section.style.display = 'none'; return; }

  barsEl.innerHTML = entries.map(([platform, count]) => {
    const info = PLATFORM_LABELS[platform] || { name: platform, color: '#6366f1' };
    const pct  = Math.max(4, Math.round((count / maxCount) * 100));
    return `
      <div class="bar-row">
        <div class="bar-label">${info.name}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${info.color}"></div>
        </div>
        <div class="bar-count">${count}</div>
      </div>
    `;
  }).join('');

  section.style.display = 'block';
}

// ── Method chart ──────────────────────────────────────────────────

function renderMethodChart(applications) {
  const section = document.getElementById('method-chart');
  const barsEl  = document.getElementById('method-bars');
  if (!section || !barsEl || !applications.length) return;

  const counts = {};
  for (const app of applications) {
    const m = app.applicationMethod || 'unknown';
    counts[m] = (counts[m] || 0) + 1;
  }

  const entries = Object.entries(counts)
    .filter(([m]) => m !== 'unknown')
    .sort((a, b) => b[1] - a[1]);

  // Only show if there are at least 2 distinct methods
  if (entries.length < 2) { section.style.display = 'none'; return; }

  const maxCount = Math.max(...Object.values(counts), 1);

  barsEl.innerHTML = entries.map(([method, count]) => {
    const info = METHOD_LABELS[method] || { text: method, color: '#6366f1' };
    const pct  = Math.max(4, Math.round((count / maxCount) * 100));
    const applied = applications.filter(
      (a) => a.applicationMethod === method && a.status === 'applied',
    ).length;
    const appliedNote = applied > 0 ? ` <span style="font-size:0.7rem;color:#4ade80">(${applied} enviadas)</span>` : '';
    return `
      <div class="bar-row">
        <div class="bar-label" style="width:130px">${info.text}${appliedNote}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${info.color}"></div>
        </div>
        <div class="bar-count">${count}</div>
      </div>
    `;
  }).join('');

  section.style.display = 'block';
}

// ── Method filters ────────────────────────────────────────────────

/**
 * Shows the method filter row only if there are ATS/email applications
 * and wires click handlers for each method button.
 */
function renderMethodFilters(applications) {
  const row = document.getElementById('method-filters-row');
  if (!row) return;

  const methods = new Set(applications.map((a) => a.applicationMethod).filter(Boolean));
  // Only show row if there are non-LinkedIn / non-manual methods
  const atsOrEmail = [...methods].filter(
    (m) => m !== 'linkedin_easy_apply' && m !== 'manual',
  );
  if (atsOrEmail.length === 0) return;

  row.style.display = 'flex';

  row.querySelectorAll('.filter-btn').forEach((btn) => {
    const method = btn.dataset.methodFilter;
    // Hide buttons for methods not present in this dataset
    if (method !== 'all' && !methods.has(method)) {
      btn.style.display = 'none';
      return;
    }
    btn.addEventListener('click', () => {
      currentMethodFilter = method;
      row.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderCards(allApplications);
    });
  });
}

// ── Filters ───────────────────────────────────────────────────────

function renderFilters() {
  const row = document.getElementById('filters-row');
  if (!row) return;

  row.style.display = 'flex';

  row.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      row.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderCards(allApplications);
    });
  });
}

// ── Job cards ─────────────────────────────────────────────────────

function renderCards(applications) {
  const grid = document.getElementById('jobs-grid');
  if (!grid) return;

  let filtered = currentFilter === 'all'
    ? applications
    : applications.filter((a) => a.status === currentFilter);

  if (currentMethodFilter !== 'all') {
    filtered = filtered.filter((a) => a.applicationMethod === currentMethodFilter);
  }

  if (!filtered.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-muted)">No results for this filter.</div>`;
    return;
  }

  grid.innerHTML = filtered.map((app) => renderCard(app)).join('');
}

/**
 * Builds a styled "receipt" panel for applications submitted via ATS API or email.
 * Shows the confirmation ID with a copy button and a method-specific icon/label.
 */
function buildReceiptHtml(app) {
  if (app.status !== 'applied') return '';

  const method = app.applicationMethod;
  const id     = app.confirmationId;

  // Metadata per method
  const META = {
    greenhouse_api:      { icon: '🌱', label: 'Greenhouse Application ID', color: '#3d9970' },
    lever_api:           { icon: '⚡', label: 'Lever Application UUID',    color: '#c0392b' },
    email:               { icon: '📧', label: 'SMTP Message-ID',           color: '#9b59b6' },
    linkedin_easy_apply: { icon: '✅', label: 'Easy Apply sent',           color: '#0077b5' },
  };

  const meta = META[method];
  if (!meta) return '';

  if (!id) {
    // Method is known but no confirmation ID — just show a sent confirmation
    return `
      <div style="margin-top:0.75rem;padding:0.6rem 0.75rem;border-radius:6px;
                  background:${meta.color}0d;border:1px solid ${meta.color}33">
        <div style="font-size:0.72rem;font-weight:600;color:${meta.color};margin-bottom:0.1rem">
          ${meta.icon} ${meta.label}
        </div>
        <div style="font-size:0.7rem;color:var(--text-muted)">Enviada correctamente</div>
      </div>`;
  }

  const safeId = escapeHtml(id);
  return `
    <div style="margin-top:0.75rem;padding:0.6rem 0.75rem;border-radius:6px;
                background:${meta.color}0d;border:1px solid ${meta.color}33">
      <div style="font-size:0.72rem;font-weight:600;color:${meta.color};margin-bottom:0.35rem">
        ${meta.icon} ${meta.label}
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
        <code
          title="Click para copiar"
          style="font-size:0.68rem;background:var(--bg-elevated,#1e293b);color:#4ade80;
                 padding:0.2rem 0.5rem;border-radius:4px;cursor:pointer;flex:1;min-width:0;
                 border:1px solid #4ade8033;letter-spacing:0.02em;word-break:break-all;
                 white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
          onclick="navigator.clipboard.writeText('${safeId}').then(()=>{
            this.style.color='#a3e635';
            this.title='¡Copiado!';
            setTimeout(()=>{this.style.color='#4ade80';this.title='Click para copiar'},1500)
          })"
        >${safeId}</code>
        <button
          onclick="navigator.clipboard.writeText('${safeId}').then(()=>{
            this.textContent='✓';setTimeout(()=>this.textContent='Copiar',1500)
          })"
          style="flex-shrink:0;font-size:0.68rem;padding:0.2rem 0.6rem;border-radius:4px;
                 border:1px solid ${meta.color}55;background:${meta.color}18;
                 color:${meta.color};cursor:pointer;font-weight:600"
        >Copiar</button>
      </div>
    </div>`;
}

function renderCard(app) {
  const job = app.job || {};
  const statusInfo = STATUS_LABELS[app.status] || { text: app.status, cls: '' };
  const platformInfo = PLATFORM_LABELS[job.platform] || { name: job.platform || 'Unknown', color: '#6366f1', cls: '' };

  const score = job.compatibilityScore ?? 0;
  const scoreClass = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';

  const errorHtml = app.errorMessage
    ? `<div style="font-size:0.72rem;color:var(--danger);margin-top:0.5rem;word-break:break-word">${escapeHtml(app.errorMessage)}</div>`
    : '';

  const methodInfo  = METHOD_LABELS[app.applicationMethod];
  const methodBadge = methodInfo
    ? `<span style="font-size:0.65rem;padding:0.15rem 0.5rem;border-radius:3px;background:${methodInfo.color}22;color:${methodInfo.color};border:1px solid ${methodInfo.color}44;font-weight:600;">via ${methodInfo.text}</span>`
    : '';

  // Receipt panel — proof of submission for ATS/email applications
  const confirmHtml = buildReceiptHtml(app);

  return `
    <div class="job-card">
      <div class="job-card-header">
        <div>
          <div class="job-title">${escapeHtml(job.title || 'Unknown Title')}</div>
          <div class="job-company">${escapeHtml(job.company || 'Unknown Company')}</div>
          <div class="job-location">${escapeHtml(job.location || '')} · ${escapeHtml(job.modality || '')}</div>
        </div>
        <div class="score-badge ${scoreClass}">${score}%</div>
      </div>
      ${errorHtml}
      ${confirmHtml}
      <div class="job-card-footer">
        <span class="status-badge ${statusInfo.cls}">${statusInfo.text}</span>
        ${methodBadge}
        <span class="platform-badge ${platformInfo.cls}">${platformInfo.name}</span>
        ${job.applyUrl ? `<a href="${escapeHtml(job.applyUrl)}" target="_blank" rel="noopener" class="btn-apply">Ver oferta →</a>` : ''}
      </div>
    </div>
  `;
}

// ── Empty state ───────────────────────────────────────────────────

function showEmpty(msg) {
  document.getElementById('stats-row').innerHTML = '';
  document.getElementById('platform-chart').style.display = 'none';
  document.getElementById('method-chart').style.display = 'none';
  document.getElementById('filters-row').style.display = 'none';
  document.getElementById('method-filters-row').style.display = 'none';
  document.getElementById('jobs-grid').innerHTML = '';

  const emptyState = document.getElementById('empty-state');
  const emptyMsg   = document.getElementById('empty-msg');
  if (emptyState) emptyState.style.display = 'block';
  if (emptyMsg) emptyMsg.textContent = msg;
}

// ── Utilities ─────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', loadReport);
