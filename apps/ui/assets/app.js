/**
 * Job Agent UI — app.js
 * Handles tag inputs, form serialization, API submission, and CV upload.
 */

'use strict';

const API_BASE = 'http://localhost:3000/api';

// ══════════════════════════════════════════════════════════════════
// Tag Input Component
// ══════════════════════════════════════════════════════════════════

class TagInput {
  constructor(containerId, initialTags = []) {
    this.container = document.getElementById(containerId);
    this.tags = [...initialTags];
    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = '';

    this.tags.forEach((tag, i) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.innerHTML = `${escapeHtml(tag)}<button class="tag-remove" data-index="${i}" title="Remove">×</button>`;
      this.container.appendChild(span);
    });

    this.input = document.createElement('input');
    this.input.className = 'tag-input';
    this.input.placeholder = this.container.dataset.placeholder || 'Type and press Enter';
    this.container.appendChild(this.input);
  }

  bindEvents() {
    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('tag-remove')) {
        const idx = parseInt(e.target.dataset.index, 10);
        this.tags.splice(idx, 1);
        this.render();
        this.bindEvents();
      } else {
        this.input?.focus();
      }
    });

    const addTag = () => {
      const val = this.input.value.trim();
      if (val && !this.tags.includes(val)) {
        this.tags.push(val);
        this.render();
        this.bindEvents();
      } else {
        this.input.value = '';
      }
    };

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag();
      } else if (e.key === 'Backspace' && this.input.value === '' && this.tags.length > 0) {
        this.tags.pop();
        this.render();
        this.bindEvents();
      }
    });

    this.input.addEventListener('blur', addTag);
  }

  getTags() { return [...this.tags]; }
}

// ══════════════════════════════════════════════════════════════════
// Toast Notifications
// ══════════════════════════════════════════════════════════════════

function showToast(title, body, type = 'success', duration = 5000) {
  const container = document.getElementById('toast-container');
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div>
      <div class="toast-title">${escapeHtml(title)}</div>
      ${body ? `<div class="toast-body">${escapeHtml(body)}</div>` : ''}
    </div>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ══════════════════════════════════════════════════════════════════
// Slider Labels
// ══════════════════════════════════════════════════════════════════

function bindSliders() {
  document.querySelectorAll('input[type="range"]').forEach((slider) => {
    const display = document.getElementById(slider.id + '-display');
    if (display) display.textContent = slider.value;
    slider.addEventListener('input', () => {
      if (display) display.textContent = slider.value;
    });
  });
}

// ══════════════════════════════════════════════════════════════════
// CV Upload
// ══════════════════════════════════════════════════════════════════

function initCvUpload() {
  const zone = document.getElementById('cv-upload-zone');
  const input = document.getElementById('cv-file-input');
  const status = document.getElementById('cv-status');

  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) uploadCv(file, status);
  });

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) uploadCv(file, status);
  });
}

async function uploadCv(file, statusEl) {
  const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|docx)$/i)) {
    showToast('Invalid file type', 'Please upload a PDF or DOCX file.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('cv', file);

  try {
    const res = await fetch(`${API_BASE}/cv/upload`, { method: 'POST', body: formData });
    const data = await res.json();

    if (res.ok) {
      if (statusEl) {
        statusEl.style.display = 'flex';
        statusEl.querySelector('.cv-filename').textContent = file.name;
      }
      showToast('CV uploaded', file.name);
    } else {
      showToast('Upload failed', data.error || 'Unknown error', 'error');
    }
  } catch {
    showToast('Upload failed', 'Could not connect to the API server.', 'error');
  }
}

// ══════════════════════════════════════════════════════════════════
// Form Submission
// ══════════════════════════════════════════════════════════════════

function getCheckedValues(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((el) => el.value);
}

function getRadioValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value ?? null;
}

async function submitConfig(e) {
  e.preventDefault();

  const btn = document.getElementById('submit-btn');
  btn.classList.add('loading');
  btn.disabled = true;

  const keywords = window.keywordsTag?.getTags() ?? [];
  const excludedCompanies = window.excludedTag?.getTags() ?? [];

  if (keywords.length === 0) {
    showToast('Validation error', 'Please add at least one keyword.', 'error');
    btn.classList.remove('loading');
    btn.disabled = false;
    return;
  }

  const config = {
    search: {
      keywords,
      location: document.getElementById('location')?.value?.trim() || 'Worldwide',
      modality: getCheckedValues('modality'),
      languages: getCheckedValues('languages'),
      seniority: getCheckedValues('seniority'),
      datePosted: getRadioValue('datePosted') || 'past_week',
      excludedCompanies,
    },
    matching: {
      minScoreToApply: parseInt(document.getElementById('min-score')?.value || '70', 10),
      maxApplicationsPerSession: parseInt(document.getElementById('max-apps')?.value || '10', 10),
    },
    coverLetter: {
      language: getRadioValue('coverLang') || 'en',
      tone: getRadioValue('coverTone') || 'professional',
    },
    report: {
      format: 'both',
    },
  };

  try {
    const res = await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    const data = await res.json();

    if (res.ok) {
      showToast('Configuration saved!', 'You can now run the agent with: npm start');
    } else {
      showToast('Error', data.error || 'Failed to save config', 'error');
    }
  } catch {
    // Save locally as YAML fallback (download)
    const yaml = configToYaml(config);
    downloadFile('config.yaml', yaml, 'text/yaml');
    showToast('Saved locally', 'config.yaml downloaded — place it in the project root.');
  }

  btn.classList.remove('loading');
  btn.disabled = false;
}

// ══════════════════════════════════════════════════════════════════
// YAML serializer (minimal, for fallback)
// ══════════════════════════════════════════════════════════════════

function configToYaml(config) {
  const lines = [];

  lines.push('search:');
  lines.push(`  keywords:`);
  config.search.keywords.forEach((k) => lines.push(`    - "${k}"`));
  lines.push(`  location: "${config.search.location}"`);
  lines.push(`  modality:`);
  config.search.modality.forEach((m) => lines.push(`    - ${m}`));
  lines.push(`  languages:`);
  config.search.languages.forEach((l) => lines.push(`    - ${l}`));
  lines.push(`  seniority:`);
  config.search.seniority.forEach((s) => lines.push(`    - ${s}`));
  lines.push(`  datePosted: ${config.search.datePosted}`);
  lines.push(`  excludedCompanies:`);
  config.search.excludedCompanies.forEach((c) => lines.push(`    - "${c}"`));

  lines.push(`\nmatching:`);
  lines.push(`  minScoreToApply: ${config.matching.minScoreToApply}`);
  lines.push(`  maxApplicationsPerSession: ${config.matching.maxApplicationsPerSession}`);

  lines.push(`\ncoverLetter:`);
  lines.push(`  language: ${config.coverLetter.language}`);
  lines.push(`  tone: ${config.coverLetter.tone}`);

  lines.push(`\nreport:`);
  lines.push(`  format: ${config.report.format}`);

  return lines.join('\n');
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════════════
// Utilities
// ══════════════════════════════════════════════════════════════════

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ══════════════════════════════════════════════════════════════════
// Init
// ══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // Tag inputs
  window.keywordsTag = new TagInput('keywords-tags', ['Software Engineer', 'TypeScript Developer']);
  window.excludedTag = new TagInput('excluded-tags', []);

  // Sliders
  bindSliders();

  // CV upload
  initCvUpload();

  // Form
  document.getElementById('config-form')?.addEventListener('submit', submitConfig);

  // Check API health
  fetch(`${API_BASE}/health`)
    .then((r) => r.json())
    .then(() => { /* API online */ })
    .catch(() => {
      showToast('API Offline', 'Start the server with: npm run dev -w packages/api', 'error', 8000);
    });
});
