/**
 * Job Agent UI — progress.js
 * Connects to the SSE endpoint and updates the progress UI in real time.
 */

'use strict';

const API_BASE = 'http://localhost:3000/api';

const TOTAL_STEPS = 8;
const STEP_LABELS = [
  '',                                // 0 (unused)
  'Loading configuration',           // 1
  'Finding CV file',                 // 2
  'Parsing CV',                      // 3
  'Searching jobs',                  // 4
  'Scoring & ranking',               // 5
  'Applying (Easy Apply)',           // 6
  'Saving output files',             // 7
  'Generating report',               // 8
];

let currentStep = 0;
let eventSource = null;
let semanticSource = null;

// ── DOM references ────────────────────────────────────────────────
const progressFill    = document.getElementById('progress-fill');
const progressPct     = document.getElementById('progress-pct');
const progressStepLbl = document.getElementById('progress-step-label');
const stepList        = document.getElementById('step-list');
const logPanel        = document.getElementById('log-panel');
const doneBanner      = document.getElementById('done-banner');
const progressCard    = document.getElementById('progress-card');
const statusBadge     = document.getElementById('status-badge');
const statusDesc      = document.getElementById('status-description');
const cntFound        = document.getElementById('cnt-found');
const cntApplied      = document.getElementById('cnt-applied');
const cntSkipped      = document.getElementById('cnt-skipped');

// ── Step list state ───────────────────────────────────────────────
const stepItems = [];

function initStepList() {
  stepList.innerHTML = '';
  stepItems.length = 0;

  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const li = document.createElement('li');
    li.className = 'step-item';
    li.dataset.step = String(i);
    li.innerHTML = `<span class="step-icon">⏳</span><span class="step-text">${STEP_LABELS[i]}</span>`;
    stepList.appendChild(li);
    stepItems.push(li);
  }
}

function updateStep(step, level) {
  const li = stepItems[step - 1];
  if (!li) return;

  li.classList.remove('active', 'done', 'error', 'warning');

  if (level === 'success') {
    li.classList.add('done');
    li.querySelector('.step-icon').textContent = '✅';
  } else if (level === 'error') {
    li.classList.add('error');
    li.querySelector('.step-icon').textContent = '❌';
  } else if (level === 'warn') {
    li.classList.add('warning');
    li.querySelector('.step-icon').textContent = '⚠️';
  } else {
    li.classList.add('active');
    li.querySelector('.step-icon').textContent = '⚙️';
  }
}

function updateProgress(step, total, label) {
  const pct = Math.round((step / total) * 100);
  progressFill.style.width = `${pct}%`;
  progressPct.textContent = `${pct}%`;
  progressStepLbl.textContent = label || STEP_LABELS[step] || `Step ${step}`;
  currentStep = step;
}

function appendLog(message, level) {
  const div = document.createElement('div');
  div.className = `log-line ${level}`;
  const ts = new Date().toLocaleTimeString();
  div.textContent = `[${ts}] ${message}`;
  logPanel.appendChild(div);
  logPanel.scrollTop = logPanel.scrollHeight;
}

// ── SSE connection ────────────────────────────────────────────────

function connect() {
  if (eventSource) {
    eventSource.close();
  }

  statusBadge.textContent = 'Connecting...';

  eventSource = new EventSource(`${API_BASE}/run/progress`);

  eventSource.onopen = () => {
    statusBadge.textContent = 'Running...';
    appendLog('Connected to agent', 'info');
  };

  eventSource.onmessage = (evt) => {
    let data;
    try {
      data = JSON.parse(evt.data);
    } catch {
      return;
    }

    // Update step UI
    if (data.step && data.step > 0) {
      updateStep(data.step, data.level);
      updateProgress(data.step, data.total || TOTAL_STEPS, data.message);
    }

    // Log the message
    appendLog(data.message || '', data.level || 'info');

    // Handle completion
    if (data.done) {
      eventSource.close();

      if (data.error) {
        showDone('error', '❌', 'Session Failed', data.error);
        statusBadge.textContent = 'Failed';
        statusDesc.textContent = data.error;
      } else {
        showDone('success', '🎉', 'Session Complete!', data.message || 'Your report is ready.');
        statusBadge.textContent = 'Done';
      }
    }
  };

  eventSource.onerror = () => {
    appendLog('Connection lost — retrying in 3s...', 'warn');
    statusBadge.textContent = 'Reconnecting...';
    eventSource.close();

    // Retry once after 3 seconds
    setTimeout(() => {
      // Check if session is still running before reconnecting
      fetch(`${API_BASE}/health`)
        .then(() => connect())
        .catch(() => {
          showDone('error', '⚠️', 'Connection Lost', 'Could not reconnect to the server. Check if it is running.');
        });
    }, 3000);
  };
}

function showDone(type, icon, title, subtitle) {
  progressCard.style.opacity = '0.6';
  doneBanner.classList.add('visible');

  document.getElementById('done-icon').textContent = icon;
  document.getElementById('done-title').textContent = title;
  document.getElementById('done-subtitle').textContent = subtitle;

  // Show error styling
  if (type === 'error') {
    doneBanner.style.color = 'var(--danger)';
    document.getElementById('view-report-btn').style.display = 'none';
  }

  // Scroll to done banner
  doneBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Toast (reused from app.js pattern) ───────────────────────────

function showToast(title, body, type = 'success', duration = 5000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icon}</span><div><div class="toast-title">${title}</div>${body ? `<div class="toast-body">${body}</div>` : ''}</div>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ── Counter helpers ───────────────────────────────────────────────

function setCounter(el, value) {
  if (!el) return;
  el.textContent = String(value);
  el.classList.remove('bump');
  // Trigger reflow to restart animation
  void el.offsetWidth;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 200);
}

// ── Typed SSE (GET /api/search/events) ───────────────────────────

function connectSemantic() {
  if (semanticSource) semanticSource.close();

  semanticSource = new EventSource(`${API_BASE}/search/events`);

  semanticSource.addEventListener('job_found', (e) => {
    const data = JSON.parse(e.data);
    setCounter(cntFound, data.totalFound);
  });

  semanticSource.addEventListener('job_applied', (e) => {
    const data = JSON.parse(e.data);
    setCounter(cntApplied, data.totalApplied);
    appendLog(`✓ Applied: ${data.title} @ ${data.company} via ${data.method}`, 'success');
  });

  semanticSource.addEventListener('job_skipped', (e) => {
    const data = JSON.parse(e.data);
    setCounter(cntSkipped, data.totalSkipped);
  });

  semanticSource.addEventListener('captcha_detected', (e) => {
    const data = JSON.parse(e.data);
    appendLog(`⚠️ CAPTCHA detected on ${data.platform}: ${data.message}`, 'warn');
    showToast('CAPTCHA detected', `Stopped on ${data.platform}. Manual action required.`, 'warn');
  });

  semanticSource.addEventListener('session_complete', () => {
    semanticSource.close();
  });
}

// ── Init ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initStepList();
  connect();
  connectSemantic();
});
