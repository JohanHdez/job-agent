/**
 * Job Agent UI — app.js (v2)
 * Handles tag inputs, form serialization, CV upload, and agent launch.
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
// CV Gate — lock / unlock form sections
// ══════════════════════════════════════════════════════════════════

let cvValidated = false;

/** Locks all sections with data-requires-cv and disables the submit button. */
function lockFormSections() {
  document.querySelectorAll('[data-requires-cv]').forEach((el) => {
    el.classList.add('section--locked');
  });

  const btn = document.getElementById('submit-btn');
  if (btn) {
    btn.disabled = true;
    btn.title = 'Upload your CV first';
  }

  const notice = document.getElementById('cv-gate-notice');
  if (notice) notice.style.display = 'flex';

  // Highlight the CV section as the active step
  const cvSection = document.querySelector('.section:not([data-requires-cv])');
  if (cvSection) cvSection.classList.add('section--active-step');
}

/** Unlocks sections with a staggered animation after CV is validated. */
function unlockFormSections() {
  if (cvValidated) return;
  cvValidated = true;

  const els = [...document.querySelectorAll('[data-requires-cv]')];
  els.forEach((el, i) => {
    setTimeout(() => {
      el.classList.remove('section--locked');
      el.classList.add('section--unlocking');
      setTimeout(() => el.classList.remove('section--unlocking'), 600);
    }, i * 90);
  });

  const btn = document.getElementById('submit-btn');
  if (btn) {
    btn.disabled = false;
    btn.title = '';
  }

  const notice = document.getElementById('cv-gate-notice');
  if (notice) {
    notice.style.opacity = '0';
    setTimeout(() => { notice.style.display = 'none'; }, 300);
  }

  // Remove active-step highlight from CV section
  document.querySelector('.section--active-step')?.classList.remove('section--active-step');
}

/**
 * On page load, checks if a CV is already saved on the server.
 * If so, restores the profile and unlocks the form without requiring re-upload.
 */
async function checkExistingCv() {
  try {
    const [cvData, profileData] = await Promise.all([
      fetch(`${API_BASE}/cv`).then((r) => r.json()).catch(() => ({ hasCV: false })),
      fetch(`${API_BASE}/cv/profile`).then((r) => r.json()).catch(() => ({ hasProfile: false })),
    ]);

    if (!cvData.hasCV) return;

    // Restore upload zone to "already uploaded" state
    const zone = document.getElementById('cv-upload-zone');
    if (zone) {
      zone.innerHTML = `
        <div class="upload-icon">✅</div>
        <p><strong>${escapeHtml(cvData.fileName ?? 'CV')}</strong></p>
        <p style="margin-top:0.375rem;font-size:0.8rem;color:var(--text-muted)">Click or drop to replace · uploaded ${
          cvData.uploadedAt ? new Date(cvData.uploadedAt).toLocaleDateString() : ''
        }</p>`;
    }

    const statusEl = document.getElementById('cv-status');
    if (statusEl) {
      statusEl.style.display = 'flex';
      const fn = statusEl.querySelector('.cv-filename');
      if (fn) fn.textContent = cvData.fileName ?? 'CV';
    }

    if (profileData.hasProfile && profileData.profile) {
      fillFormFromProfile(profileData.profile);
    }

    unlockFormSections();
  } catch {
    // API offline — stay locked (normal; user will see "API Offline" toast below)
  }
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
  // ── 1. Extension validation ───────────────────────────────────────
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  if (!['pdf', 'docx'].includes(ext)) {
    showToast(
      'Invalid file type',
      `".${ext}" is not supported. Please upload a PDF or DOCX file.`,
      'error',
    );
    return;
  }

  // ── 2. MIME type validation ───────────────────────────────────────
  const validMimes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '', // some browsers report empty MIME for local files — allow it
  ];
  if (file.type && !validMimes.includes(file.type)) {
    showToast(
      'Invalid file',
      `The file does not appear to be a valid PDF or DOCX (reported type: ${file.type}).`,
      'error',
    );
    return;
  }

  // ── 3. Empty file check ───────────────────────────────────────────
  if (file.size === 0) {
    showToast('Empty file', 'The selected file is empty (0 bytes). Please upload a valid CV.', 'error');
    return;
  }

  // ── 4. Size limit (10 MB) ─────────────────────────────────────────
  const MAX_BYTES = 10 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    const mb = (file.size / 1_048_576).toFixed(1);
    showToast('File too large', `Your file is ${mb} MB. Maximum allowed size is 10 MB.`, 'error');
    return;
  }

  // ── 5. Show "analyzing" state ─────────────────────────────────────
  const zone = document.getElementById('cv-upload-zone');
  const originalHtml = zone?.innerHTML;
  if (zone) {
    zone.innerHTML = `
      <div class="upload-icon">⏳</div>
      <p><strong>Analysing your CV…</strong></p>
      <p style="margin-top:0.375rem;font-size:0.8rem;color:var(--text-muted)">Extracting skills, experience and languages — this may take a few seconds</p>`;
  }

  const formData = new FormData();
  formData.append('cv', file);

  try {
    const res = await fetch(`${API_BASE}/cv/upload`, { method: 'POST', body: formData });

    // ── 6. HTTP error check ─────────────────────────────────────────
    if (!res.ok) {
      let errMsg = `Server returned ${res.status}`;
      try {
        const errData = await res.json();
        errMsg = errData.error ?? errData.message ?? errMsg;
      } catch { /* ignore JSON parse error */ }

      if (zone && originalHtml) zone.innerHTML = originalHtml;
      showToast('Upload failed', errMsg, 'error');
      return;
    }

    const data = await res.json();

    // ── 7. Success — update upload zone ────────────────────────────
    if (zone) {
      zone.innerHTML = `
        <div class="upload-icon">✅</div>
        <p><strong>${escapeHtml(file.name)}</strong></p>
        <p style="margin-top:0.375rem;font-size:0.8rem;color:var(--text-muted)">Click or drop to replace</p>`;
    }
    if (statusEl) {
      statusEl.style.display = 'flex';
      const fn = statusEl.querySelector('.cv-filename');
      if (fn) fn.textContent = file.name;
    }

    // ── 8. Profile extraction result ───────────────────────────────
    if (data.profile) {
      fillFormFromProfile(data.profile);
      unlockFormSections();          // unlock all sections
    } else {
      // Upload OK but parsing failed — still unlock (CV is saved)
      unlockFormSections();
      showToast(
        'CV uploaded',
        'File saved but automatic profile extraction failed. Fill in the search options manually.',
        'info',
        7000,
      );
    }

  } catch (err) {
    if (zone && originalHtml) zone.innerHTML = originalHtml;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
      showToast('Connection error', 'Could not reach the API server. Make sure it is running with: npm start', 'error', 8000);
    } else {
      showToast('Upload failed', msg || 'Unexpected error during upload.', 'error');
    }
  }
}

/**
 * Auto-fills the search filter form using data extracted from the uploaded CV.
 * Populates: keywords, location, languages, seniority.
 */
function fillFormFromProfile(profile) {
  // ── 1. Keywords: headline + no-seniority variant ──────────────────────────
  const newKeywords = [];
  if (profile.headline) {
    const h = profile.headline.trim();
    newKeywords.push(h);
    const noSeniority = h.replace(/^(senior|junior|mid|lead|principal|staff|director)\s+/i, '').trim();
    if (noSeniority !== h) newKeywords.push(noSeniority);
  }
  // Add top tech-stack items as "<Tech> Developer" keyword
  (profile.techStack || []).slice(0, 2).forEach((tech) => {
    const kw = `${tech} Developer`;
    if (!newKeywords.some((k) => k.toLowerCase() === kw.toLowerCase())) {
      newKeywords.push(kw);
    }
  });

  if (window.keywordsTag) {
    const existing = new Set(window.keywordsTag.tags.map((k) => k.toLowerCase()));
    newKeywords.forEach((kw) => {
      if (!existing.has(kw.toLowerCase())) {
        window.keywordsTag.tags.push(kw);
        existing.add(kw.toLowerCase());
      }
    });
    window.keywordsTag.render();
    window.keywordsTag.bindEvents();
  }

  // ── 2. Location ───────────────────────────────────────────────────────────
  if (profile.location) {
    const locationEl = document.getElementById('location');
    if (locationEl) locationEl.value = profile.location;
  }

  // ── 3. Languages ──────────────────────────────────────────────────────────
  const langNormalize = {
    english: 'English', inglés: 'English', ingles: 'English', 'english (c2)': 'English',
    spanish: 'Spanish', español: 'Spanish', espanol: 'Spanish', castellano: 'Spanish',
    portuguese: 'Portuguese', portugués: 'Portuguese', portugues: 'Portuguese',
    french: 'French', francés: 'French', frances: 'French',
  };
  // Uncheck all first
  document.querySelectorAll('input[name="languages"]').forEach((cb) => { cb.checked = false; });
  (profile.languages || []).forEach((lang) => {
    const rawName = (typeof lang === 'string' ? lang : (lang.name ?? '')).toLowerCase().trim();
    // Try exact match, then prefix match
    const mapped = langNormalize[rawName]
      ?? Object.entries(langNormalize).find(([k]) => rawName.startsWith(k) || k.startsWith(rawName))?.[1];
    if (mapped) {
      const cb = document.querySelector(`input[name="languages"][value="${mapped}"]`);
      if (cb) cb.checked = true;
    }
  });

  // ── 4. Seniority ──────────────────────────────────────────────────────────
  const seniorityMap = {
    Junior: ['Junior'],
    Mid: ['Mid'],
    Senior: ['Senior'],
    Lead: ['Lead'],
    Principal: ['Senior', 'Lead'],
    Executive: ['Lead'],
  };
  document.querySelectorAll('input[name="seniority"]').forEach((cb) => { cb.checked = false; });
  const levels = seniorityMap[profile.seniority] || ['Mid'];
  levels.forEach((level) => {
    const cb = document.querySelector(`input[name="seniority"][value="${level}"]`);
    if (cb) cb.checked = true;
  });

  // ── 5. Profile summary card ───────────────────────────────────────────────
  const card = document.getElementById('profile-card');
  if (card) {
    document.getElementById('profile-name').textContent = profile.fullName || 'Unknown';
    document.getElementById('profile-headline').textContent = profile.headline || '';
    document.getElementById('profile-seniority').textContent = profile.seniority || '';
    document.getElementById('profile-location-text').textContent = profile.location || 'Not specified';
    document.getElementById('profile-langs-text').textContent =
      (profile.languages || []).map((l) => (typeof l === 'string' ? l : l.name)).join(', ') || 'Not specified';
    document.getElementById('profile-exp-text').textContent =
      profile.yearsOfExperience ? `${profile.yearsOfExperience} yrs exp` : 'Experience not specified';

    const skillsList = document.getElementById('profile-skills-list');
    skillsList.innerHTML = '';
    (profile.skills || []).slice(0, 18).forEach((skill) => {
      const span = document.createElement('span');
      span.style.cssText = 'font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:20px;background:var(--bg-card);border:1px solid var(--border);color:var(--text-secondary);';
      span.textContent = skill;
      skillsList.appendChild(span);
    });

    card.style.display = 'block';
  }

  showToast(
    `Profile loaded — ${profile.fullName}`,
    `${profile.seniority} · ${(profile.skills || []).length} skills · Form auto-filled`,
    'success',
    6000,
  );
}

// ══════════════════════════════════════════════════════════════════
// Form Helpers
// ══════════════════════════════════════════════════════════════════

function getCheckedValues(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((el) => el.value);
}

function getRadioValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value ?? null;
}

// ══════════════════════════════════════════════════════════════════
// Form Submission — saves config then launches agent
// ══════════════════════════════════════════════════════════════════

async function submitConfig(e) {
  e.preventDefault();

  const btn = document.getElementById('submit-btn');
  btn.classList.add('loading');
  btn.disabled = true;

  const keywords = window.keywordsTag?.getTags() ?? [];
  const excludedCompanies = window.excludedTag?.getTags() ?? [];

  // Keywords are optional — the agent derives them from the CV profile automatically
  if (keywords.length === 0) {
    showToast('No keywords set', 'Keywords will be auto-detected from your CV.', 'info', 4000);
  }

  const platforms = getCheckedValues('platforms');
  if (platforms.length === 0) {
    showToast('Validation error', 'Please select at least one platform.', 'error');
    btn.classList.remove('loading');
    btn.disabled = false;
    return;
  }

  const greenhouseCompanies = window.greenhouseTag?.getTags() ?? [];
  // No validation needed — searcher uses a built-in default list when none are configured

  const salaryRaw  = document.getElementById('salary-expectation')?.value?.trim() || '';
  const githubRaw  = document.getElementById('github-url')?.value?.trim() || '';
  const portfolioRaw = document.getElementById('portfolio-url')?.value?.trim() || '';

  const config = {
    search: {
      keywords,
      location: document.getElementById('location')?.value?.trim() || 'Worldwide',
      modality: getCheckedValues('modality'),
      languages: getCheckedValues('languages'),
      seniority: getCheckedValues('seniority'),
      datePosted: getRadioValue('datePosted') || 'past_week',
      excludedCompanies,
      platforms,
      maxJobsToFind: parseInt(document.getElementById('max-jobs')?.value || '100', 10),
      ...(greenhouseCompanies.length > 0 ? { greenhouseCompanies } : {}),
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
    applicationDefaults: {
      authorizedToWork:    getRadioValue('authorizedToWork')    !== 'false',
      requiresSponsorship: getRadioValue('requiresSponsorship') === 'true',
      willingToRelocate:   getRadioValue('willingToRelocate')   === 'true',
      ...(salaryRaw    ? { salaryExpectation: salaryRaw }    : {}),
      availableFrom: document.getElementById('available-from')?.value?.trim() || 'Immediately',
      howDidYouHear: document.getElementById('how-did-you-hear')?.value?.trim() || 'LinkedIn',
      ...(githubRaw    ? { githubUrl:    githubRaw }    : {}),
      ...(portfolioRaw ? { portfolioUrl: portfolioRaw } : {}),
    },
  };

  try {
    // Step 1: Save config
    const configRes = await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    if (!configRes.ok) {
      const data = await configRes.json();
      showToast('Config error', data.error || 'Failed to save config', 'error');
      btn.classList.remove('loading');
      btn.disabled = false;
      return;
    }

    // Step 2: Launch agent
    const runRes = await fetch(`${API_BASE}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });

    const runData = await runRes.json();

    if (runRes.ok && runData.sessionId) {
      // Navigate to progress page
      window.location.href = `progress.html?sessionId=${encodeURIComponent(runData.sessionId)}`;
    } else if (runRes.status === 409) {
      showToast('Already running', runData.error || 'Agent is already running.', 'error');
      btn.classList.remove('loading');
      btn.disabled = false;
    } else {
      showToast('Launch failed', runData.error || 'Failed to start agent', 'error');
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  } catch {
    // Fallback: download config.yaml locally
    const yaml = configToYaml(config);
    downloadFile('config.yaml', yaml, 'text/yaml');
    showToast('API offline', 'Config saved locally. Start the server with: npm start', 'error', 8000);
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════════════════
// YAML serializer (minimal, for fallback download)
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
  lines.push(`  platforms:`);
  config.search.platforms.forEach((p) => lines.push(`    - ${p}`));
  lines.push(`  maxJobsToFind: ${config.search.maxJobsToFind ?? 100}`);
  if (config.search.greenhouseCompanies?.length > 0) {
    lines.push(`  greenhouseCompanies:`);
    config.search.greenhouseCompanies.forEach((c) => lines.push(`    - ${c}`));
  }

  lines.push(`\nmatching:`);
  lines.push(`  minScoreToApply: ${config.matching.minScoreToApply}`);
  lines.push(`  maxApplicationsPerSession: ${config.matching.maxApplicationsPerSession}`);

  lines.push(`\ncoverLetter:`);
  lines.push(`  language: ${config.coverLetter.language}`);
  lines.push(`  tone: ${config.coverLetter.tone}`);

  lines.push(`\nreport:`);
  lines.push(`  format: ${config.report.format}`);

  if (config.applicationDefaults) {
    const d = config.applicationDefaults;
    lines.push('\napplicationDefaults:');
    lines.push(`  authorizedToWork: ${d.authorizedToWork ?? true}`);
    lines.push(`  requiresSponsorship: ${d.requiresSponsorship ?? false}`);
    lines.push(`  willingToRelocate: ${d.willingToRelocate ?? false}`);
    lines.push(`  availableFrom: "${d.availableFrom ?? 'Immediately'}"`);
    lines.push(`  howDidYouHear: "${d.howDidYouHear ?? 'LinkedIn'}"`);
    if (d.salaryExpectation) lines.push(`  salaryExpectation: "${d.salaryExpectation}"`);
    if (d.githubUrl)         lines.push(`  githubUrl: "${d.githubUrl}"`);
    if (d.portfolioUrl)      lines.push(`  portfolioUrl: "${d.portfolioUrl}"`);
    if (d.yearsOfExperience !== undefined) lines.push(`  yearsOfExperience: ${d.yearsOfExperience}`);
  }

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
// Platform pill styles (inject badge CSS variables)
// ══════════════════════════════════════════════════════════════════

function injectPlatformStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .platforms-grid { grid-template-columns: repeat(auto-fill, minmax(165px, 1fr)); }
    .platform-pill  { display: flex; align-items: center; gap: 0.5rem; }
    .platform-logo  { display: inline-flex; align-items: center; justify-content: center;
                      width: 1.4rem; height: 1.4rem; border-radius: 4px;
                      font-size: 0.6rem; font-weight: 800; color: #fff; flex-shrink: 0; }
    .platform-linkedin  { background: #0077b5; }
    .platform-indeed    { background: #003399; }
    .platform-ct        { background: #e83010; }
    .platform-bu        { background: #ff6400; }
    .platform-gob       { background: #00c2a8; }
    .platform-ij        { background: #1b5ea7; }
    .platform-gh        { background: #3d9970; }
    .platform-tag       { margin-left: auto; font-size: 0.65rem; padding: 0.1rem 0.35rem;
                          border-radius: 3px; background: var(--bg-elevated);
                          color: var(--text-muted); }
  `;
  document.head.appendChild(style);
}

// ══════════════════════════════════════════════════════════════════
// Init
// ══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  injectPlatformStyles();

  // Tag inputs
  window.keywordsTag      = new TagInput('keywords-tags', []);
  window.excludedTag      = new TagInput('excluded-tags', []);
  window.greenhouseTag    = new TagInput('greenhouse-tags', []);

  // Show/hide Greenhouse companies section when the platform checkbox changes
  const ghCb = document.getElementById('gh-platform-cb');
  ghCb?.addEventListener('change', () => {
    const section = document.getElementById('greenhouse-section');
    if (section) section.style.display = ghCb.checked ? 'block' : 'none';
  });

  // Sliders
  bindSliders();

  // CV upload
  initCvUpload();

  // Form submission
  document.getElementById('config-form')?.addEventListener('submit', submitConfig);

  // ── CV Gate: lock sections, then check if CV already exists ──────
  lockFormSections();
  checkExistingCv();

  // Check API health
  fetch(`${API_BASE}/health`)
    .then((r) => r.json())
    .then(() => { /* API online */ })
    .catch(() => {
      showToast('API Offline', 'Start the server with: npm start', 'error', 8000);
    });
});
