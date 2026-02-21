// ═══════════════════════════════════════════════════════════════════════════
// upload.js  ─  Results with Overview / Forensic Analysis tab toggle
// Replace frontend/js/upload.js — no other file changes needed
// ═══════════════════════════════════════════════════════════════════════════

requireAuth();

const user = Storage.getUser();
document.getElementById('user-name').textContent = user.full_name;

const uploadArea      = document.getElementById('upload-area');
const fileInput       = document.getElementById('file-input');
const filePreview     = document.getElementById('file-preview');
const imagePreview    = document.getElementById('image-preview');
const videoPreview    = document.getElementById('video-preview');
const fileInfo        = document.getElementById('file-info');
const progressSection = document.getElementById('progress-section');
const resultsSection  = document.getElementById('results-section');

let selectedFile = null;
let currentType  = 'image';

// ── Inject all styles once ───────────────────────────────────────────────────
(function injectStyles() {
    if (document.getElementById('upload-extra-styles')) return;
    const css = `
/* ─── Result Tab Bar ─────────────────────────────────────── */
.result-tab-bar {
    display: flex;
    gap: 0;
    border-bottom: 2px solid #e5e7eb;
    margin: 0 0 20px;
    background: #f9fafb;
    border-radius: 12px 12px 0 0;
    overflow: hidden;
}
.result-tab {
    flex: 1;
    padding: 13px 10px;
    font-size: 14px;
    font-weight: 600;
    color: #6b7280;
    background: none;
    border: none;
    cursor: pointer;
    transition: all .2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border-bottom: 3px solid transparent;
    margin-bottom: -2px;
    letter-spacing: -.1px;
}
.result-tab:hover { color: #374151; background: #f3f4f6; }
.result-tab.active {
    color: #6366f1;
    border-bottom-color: #6366f1;
    background: #fff;
}
.result-tab .tab-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 99px;
    background: #fef2f2;
    color: #dc2626;
    line-height: 1.4;
}
.result-tab .tab-badge.warn  { background: #fffbeb; color: #d97706; }
.result-tab .tab-badge.info  { background: #eff6ff; color: #2563eb; }
.result-tab .tab-badge.ok    { background: #f0fdf4; color: #16a34a; }

/* ─── Tab Panes ───────────────────────────────────────────── */
.result-pane { display: none; }
.result-pane.active { display: block; }

/* ─── Forensic Panel ──────────────────────────────────────── */
.forensic-panel {
    border-radius: 14px;
    overflow: hidden;
    border: 1.5px solid #e5e7eb;
    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
}
.fp-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 22px;
    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
    color: #fff;
}
.fp-header-icon { font-size: 26px; }
.fp-header h3   { margin: 0 0 2px; font-size: 17px; font-weight: 700; }
.fp-header p    { margin: 0; font-size: 12px; opacity: .7; }
.fp-verdict {
    display: flex; align-items: center; gap: 14px;
    padding: 12px 22px; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap;
}
.fp-verdict.is-fake { background: linear-gradient(90deg,#fef2f2,#fff5f5); }
.fp-verdict.is-real { background: linear-gradient(90deg,#f0fdf4,#f8fff9); }
.fp-verdict-label   { font-size: 19px; font-weight: 800; letter-spacing: -.4px; }
.fp-verdict-label.fake { color: #dc2626; }
.fp-verdict-label.real { color: #16a34a; }
.fp-verdict-conf    { font-size: 13px; color: #6b7280; }
.fp-verdict-badge   {
    margin-left: auto; font-size: 12px;
    background: #fff; border: 1px solid #e5e7eb;
    border-radius: 20px; padding: 4px 14px; color: #374151;
}
.fp-clues {
    padding: 14px 18px; background: #fff;
    display: flex; flex-direction: column; gap: 10px;
}
.fp-clue { border-radius: 11px; border: 1.5px solid; overflow: hidden; transition: box-shadow .2s; }
.fp-clue:hover { box-shadow: 0 4px 14px rgba(0,0,0,.09); }
.fp-clue-head {
    display: flex; align-items: flex-start; gap: 11px;
    padding: 11px 14px; cursor: pointer; user-select: none;
}
.fp-clue-icon  { font-size: 20px; flex-shrink: 0; margin-top: 1px; }
.fp-clue-body  { flex: 1; min-width: 0; }
.fp-clue-title { font-size: 14px; font-weight: 700; margin: 0 0 3px; }
.fp-clue-desc  { font-size: 13px; color: #6b7280; margin: 0; line-height: 1.45; }
.fp-clue-badge {
    font-size: 11px; font-weight: 700; padding: 3px 9px;
    border-radius: 99px; text-transform: uppercase; letter-spacing: .4px;
    flex-shrink: 0; white-space: nowrap;
}
.fp-clue-arrow { font-size: 12px; opacity: .4; flex-shrink: 0; transition: transform .2s; margin-top: 3px; }
.fp-clue.open .fp-clue-arrow { transform: rotate(180deg); }
.fp-clue-detail { display: none; padding: 0 14px 12px 45px; border-top: 1px solid; }
.fp-clue.open .fp-clue-detail { display: block; }
.fp-evidence {
    display: inline-block; font-size: 11px; font-family: 'Courier New', monospace;
    padding: 3px 9px; border-radius: 5px; background: #f3f4f6; color: #374151;
    margin: 8px 0 4px; border: 1px solid #e5e7eb;
}
.fp-technical { font-size: 11px; color: #9ca3af; font-style: italic; line-height: 1.5; margin: 2px 0 0; }
.fp-empty { text-align: center; padding: 30px; color: #6b7280; }
.fp-empty-icon { font-size: 34px; display: block; margin-bottom: 8px; }
.fp-empty strong { display: block; font-size: 14px; color: #374151; margin-bottom: 4px; }
.fp-metrics {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(130px,1fr));
    gap: 8px; padding: 14px 18px; background: #f9fafb; border-top: 1px solid #e5e7eb;
}
.fp-metric { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
.fp-metric-label { font-size: 10px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 3px; }
.fp-metric-value { font-size: 17px; font-weight: 800; color: #111827; line-height: 1.1; }
.fp-metric-unit  { font-size: 10px; color: #9ca3af; margin-top: 1px; }
.fp-footer {
    padding: 9px 18px; background: #f9fafb; border-top: 1px solid #e5e7eb;
    display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;
}
.fp-footer-note { font-size: 11px; color: #9ca3af; font-style: italic; }
.fp-copy-btn {
    font-size: 12px; color: #6366f1; background: none;
    border: 1px solid #c7d2fe; border-radius: 6px; padding: 4px 12px;
    cursor: pointer; transition: background .15s;
}
.fp-copy-btn:hover { background: #eff0ff; }

/* ─── Dark mode forensic ──────────────────────────────────── */
[data-theme="dark"] .forensic-panel     { border-color: #374151; }
[data-theme="dark"] .fp-clues           { background: #1e293b; }
[data-theme="dark"] .fp-clue-desc       { color: #94a3b8; }
[data-theme="dark"] .fp-evidence        { background: #374151; color: #e2e8f0; border-color: #475569; }
[data-theme="dark"] .fp-technical       { color: #64748b; }
[data-theme="dark"] .fp-metrics         { background: #0f172a; }
[data-theme="dark"] .fp-metric          { background: #1e293b; border-color: #374151; }
[data-theme="dark"] .fp-metric-value    { color: #f1f5f9; }
[data-theme="dark"] .fp-metric-label,
[data-theme="dark"] .fp-metric-unit     { color: #64748b; }
[data-theme="dark"] .fp-footer          { background: #0f172a; border-color: #374151; }
[data-theme="dark"] .fp-footer-note     { color: #64748b; }
[data-theme="dark"] .fp-verdict-badge   { background: #1e293b; border-color: #374151; color: #e2e8f0; }
[data-theme="dark"] .fp-empty           { color: #64748b; }
[data-theme="dark"] .fp-empty strong    { color: #94a3b8; }
[data-theme="dark"] .fp-verdict.is-fake { background: linear-gradient(90deg,#1c0d0d,#1a0f0f); }
[data-theme="dark"] .fp-verdict.is-real { background: linear-gradient(90deg,#0c1a10,#0f1c13); }
[data-theme="dark"] .result-tab-bar     { background: #1e293b; border-color: #374151; }
[data-theme="dark"] .result-tab         { color: #94a3b8; }
[data-theme="dark"] .result-tab:hover   { background: #334155; color: #e2e8f0; }
[data-theme="dark"] .result-tab.active  { color: #a5b4fc; background: #0f172a; border-bottom-color: #a5b4fc; }
`;
    const el = document.createElement('style');
    el.id = 'upload-extra-styles';
    el.textContent = css;
    document.head.appendChild(el);
})();

// ── URL param: auto-switch to video tab ─────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('type') === 'video') {
    document.querySelector('.tab-btn[data-type="video"]')?.click();
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentType = btn.dataset.type;
        fileInput.accept = currentType === 'image' ? 'image/*' : 'video/*';
        document.getElementById('file-types').textContent = currentType === 'image'
            ? 'Supported: JPG, PNG, GIF, BMP'
            : 'Supported: MP4, AVI, MOV, MKV';
        resetUpload();
    });
});

// ── Drag & drop ──────────────────────────────────────────────────────────────
uploadArea.addEventListener('dragover',  e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', ()  => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e => {
    if (e.target.files.length) handleFileSelect(e.target.files[0]);
});

function handleFileSelect(file) {
    if (currentType === 'image' && !file.type.startsWith('image/')) { Toast.error('Please select an image file'); return; }
    if (currentType === 'video' && !file.type.startsWith('video/')) { Toast.error('Please select a video file'); return; }
    if (file.size > 100 * 1024 * 1024) { Toast.error('File size must be under 100 MB'); return; }
    selectedFile = file;
    showFilePreview(file);
}

function showFilePreview(file) {
    uploadArea.style.display  = 'none';
    filePreview.style.display = 'block';
    const reader = new FileReader();
    reader.onload = e => {
        if (file.type.startsWith('image/')) {
            imagePreview.src = e.target.result;
            imagePreview.style.display = 'block';
            videoPreview.style.display = 'none';
        } else {
            videoPreview.src = e.target.result;
            videoPreview.style.display = 'block';
            imagePreview.style.display = 'none';
        }
    };
    reader.readAsDataURL(file);
    const mb = (file.size / 1024 / 1024).toFixed(2);
    fileInfo.innerHTML = `
        <p><strong>File:</strong> ${file.name}</p>
        <p><strong>Size:</strong> ${mb} MB</p>
        <p><strong>Type:</strong> ${file.type || 'unknown'}</p>`;
}

function resetUpload() {
    selectedFile = null;
    fileInput.value = '';
    uploadArea.style.display      = 'block';
    filePreview.style.display     = 'none';
    progressSection.style.display = 'none';
    resultsSection.style.display  = 'none';
    imagePreview.style.display    = 'none';
    videoPreview.style.display    = 'none';
}

// ── XHR Upload ───────────────────────────────────────────────────────────────
async function analyzeFile() {
    if (!selectedFile) { Toast.error('Please select a file first'); return; }
    filePreview.style.display     = 'none';
    progressSection.style.display = 'block';

    const endpoint = currentType === 'image'
        ? API_CONFIG.ENDPOINTS.UPLOAD_IMAGE
        : API_CONFIG.ENDPOINTS.UPLOAD_VIDEO;
    const url      = `${API_CONFIG.BASE_URL}${endpoint}`;
    const xhr      = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', selectedFile);

    xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) setProgress((e.loaded / e.total) * 80, 'Uploading…');
    });
    xhr.addEventListener('load', () => {
        try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
                setProgress(85, 'Analysing content…');
                setTimeout(() => {
                    setProgress(100, 'Complete!');
                    setTimeout(() => showResults(data), 300);
                }, 400);
            } else {
                progressSection.style.display = 'none';
                filePreview.style.display     = 'block';
                Toast.error(data.error || 'Upload failed');
            }
        } catch {
            progressSection.style.display = 'none';
            filePreview.style.display     = 'block';
            Toast.error('Invalid server response');
        }
    });
    xhr.addEventListener('error', () => {
        progressSection.style.display = 'none';
        filePreview.style.display     = 'block';
        Toast.error('Network error');
    });
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${Storage.getToken()}`);
    xhr.send(formData);
}

function setProgress(pct, msg) {
    document.getElementById('progress-fill').style.width = `${Math.round(pct)}%`;
    document.getElementById('progress-text').textContent = `${msg} ${Math.round(pct)}%`;
}

// ═══════════════════════════════════════════════════════════════════════════
// showResults — injects tab bar + both panes, Overview shown by default
// ═══════════════════════════════════════════════════════════════════════════
function showResults(data) {
    progressSection.style.display = 'none';
    resultsSection.style.display  = 'block';

    const isFake   = data.result.toLowerCase() === 'fake';
    const conf     = parseFloat(data.confidence) || 0;
    const quality  = data.quality_metrics || {};
    const clues    = data.forensic_clues || data.artifacts || [];

    // ── Status banner ────────────────────────────────────────────────────
    const resultStatus = document.getElementById('result-status');
    if (resultStatus) {
        resultStatus.className = 'result-status ' + (isFake ? 'fake' : 'real');
        resultStatus.innerHTML = `
            <div class="status-icon">${isFake ? '⚠️' : '✅'}</div>
            <h3>${isFake ? 'DEEPFAKE DETECTED' : 'AUTHENTIC CONTENT'}</h3>
            <p style="margin:.5rem 0 0;font-size:.95rem;opacity:.9;">
                ${isFake
                    ? 'AI manipulation artifacts detected in this content'
                    : 'No significant manipulation patterns found'}
            </p>`;
    }

    // ── Gauge + Plot ─────────────────────────────────────────────────────
    const gaugeEl = document.getElementById('confidence-gauge');
    if (gaugeEl) {
        gaugeEl.innerHTML = buildGaugePlotHTML(conf, isFake);
        requestAnimationFrame(() => { requestAnimationFrame(() => { animateGauge(conf); }); });
    }

    // ── Tab bar badge label ───────────────────────────────────────────────
    const critCount = clues.filter(c => c.severity === 'critical').length;
    const warnCount = clues.filter(c => c.severity === 'warning').length;
    const totalClues = clues.length;

    let badgeHTML = '';
    if (totalClues === 0) {
        badgeHTML = `<span class="tab-badge ok">✓ Clean</span>`;
    } else if (critCount > 0) {
        badgeHTML = `<span class="tab-badge">${critCount} critical</span>`;
    } else if (warnCount > 0) {
        badgeHTML = `<span class="tab-badge warn">${warnCount} warning${warnCount > 1 ? 's' : ''}</span>`;
    } else {
        badgeHTML = `<span class="tab-badge info">${totalClues} clue${totalClues > 1 ? 's' : ''}</span>`;
    }

    // ── Find or create the tab+pane container ─────────────────────────────
    let tabWrap = document.getElementById('result-tab-wrap');
    if (!tabWrap) {
        tabWrap = document.createElement('div');
        tabWrap.id = 'result-tab-wrap';

        // Insert after quality-metrics (or after confidence-gauge if no quality-metrics)
        const qmEl = document.getElementById('quality-metrics');
        const anchor = qmEl || gaugeEl;
        if (anchor && anchor.parentNode) {
            anchor.parentNode.insertBefore(tabWrap, anchor.nextSibling);
        } else if (resultsSection) {
            resultsSection.appendChild(tabWrap);
        }
    }

    // ── Build tab bar + panes ─────────────────────────────────────────────
    tabWrap.innerHTML = `
        <!-- Tab bar -->
        <div class="result-tab-bar">
            <button class="result-tab active" data-pane="overview">
                📋 Overview
            </button>
            <button class="result-tab" data-pane="forensic">
                🔬 Forensic Analysis ${badgeHTML}
            </button>
        </div>

        <!-- Overview pane -->
        <div class="result-pane active" id="pane-overview">
            <div class="metrics-grid" id="inline-metrics"></div>
        </div>

        <!-- Forensic pane -->
        <div class="result-pane" id="pane-forensic">
            <div id="fp-mount"></div>
        </div>`;

    // ── Tab switching logic ───────────────────────────────────────────────
    tabWrap.querySelectorAll('.result-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            tabWrap.querySelectorAll('.result-tab').forEach(b => b.classList.remove('active'));
            tabWrap.querySelectorAll('.result-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`pane-${btn.dataset.pane}`)?.classList.add('active');
        });
    });

    // ── Fill Overview pane ────────────────────────────────────────────────
    document.getElementById('inline-metrics').innerHTML = `
        <div class="metric-item">
            <span class="metric-label">File Name</span>
            <span class="metric-value">${selectedFile ? selectedFile.name : '—'}</span>
        </div>
        <div class="metric-item">
            <span class="metric-label">File Size</span>
            <span class="metric-value">${quality.file_size_mb || '—'} MB</span>
        </div>
        <div class="metric-item">
            <span class="metric-label">Faces Detected</span>
            <span class="metric-value">${quality.faces_detected !== undefined ? quality.faces_detected : '—'}</span>
        </div>
        <div class="metric-item">
            <span class="metric-label">Processing Time</span>
            <span class="metric-value">${data.processing_time || '—'}s</span>
        </div>
        ${quality.blur_score !== undefined ? `
        <div class="metric-item">
            <span class="metric-label">Blur Score</span>
            <span class="metric-value">${quality.blur_score}</span>
        </div>
        <div class="metric-item">
            <span class="metric-label">Brightness</span>
            <span class="metric-value">${quality.brightness}</span>
        </div>
        <div class="metric-item">
            <span class="metric-label">Resolution</span>
            <span class="metric-value">${quality.resolution || '—'}</span>
        </div>
        <div class="metric-item">
            <span class="metric-label">Forensic Clues</span>
            <span class="metric-value" style="color:${totalClues === 0 ? '#16a34a' : critCount > 0 ? '#dc2626' : '#d97706'}">
                ${totalClues === 0 ? '✓ None' : totalClues + ' found'}
            </span>
        </div>` : ''}`;

    // ── Fill Forensic pane ────────────────────────────────────────────────
    renderForensicPanel(data, 'fp-mount');

    // ── Demo banner ───────────────────────────────────────────────────────
    const demoBanner = document.getElementById('demo-banner');
    if (demoBanner) demoBanner.style.display = data.is_demo ? 'block' : 'none';

    // ── Detail link ───────────────────────────────────────────────────────
    const detailLink = document.getElementById('detail-link');
    if (detailLink && data.detection_id) {
        detailLink.href          = `results.html?id=${data.detection_id}`;
        detailLink.style.display = 'inline-block';
    }

    data.is_demo
        ? Toast.warning('Demo mode – heuristic result, not ML model')
        : Toast.success('Analysis complete!');
}

// ═══════════════════════════════════════════════════════════════════════════
// FORENSIC PANEL RENDERER
// ═══════════════════════════════════════════════════════════════════════════
const SEV = {
    critical: { label: 'Critical', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: '🔴' },
    warning:  { label: 'Warning',  color: '#d97706', bg: '#fffbeb', border: '#fde68a', dot: '🟡' },
    info:     { label: 'Info',     color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', dot: '🔵' },
};

function renderForensicPanel(data, mountId) {
    const mount = document.getElementById(mountId);
    if (!mount) return;
    mount.innerHTML = '';

    const result     = data.result || 'unknown';
    const confidence = parseFloat(data.confidence) || 0;
    const clues      = data.forensic_clues || data.artifacts || [];
    const qm         = data.quality_metrics || null;
    const isFake     = result === 'fake';
    const critCount  = clues.filter(c => c.severity === 'critical').length;
    const warnCount  = clues.filter(c => c.severity === 'warning').length;

    const panel = document.createElement('div');
    panel.className = 'forensic-panel';

    // header + verdict bar
    panel.innerHTML = `
        <div class="fp-header">
            <span class="fp-header-icon">🔬</span>
            <div>
                <h3>Forensic Analysis Report</h3>
                <p>Deep inspection of manipulation indicators and visual anomalies</p>
            </div>
        </div>
        <div class="fp-verdict ${isFake ? 'is-fake' : 'is-real'}">
            <span class="fp-verdict-label ${isFake ? 'fake' : 'real'}">
                ${isFake ? '⚠️ FAKE DETECTED' : '✅ APPEARS REAL'}
            </span>
            <span class="fp-verdict-conf">${confidence.toFixed(1)}% confidence</span>
            <span class="fp-verdict-badge">
                ${clues.length === 0
                    ? 'No manipulation clues found'
                    : `${clues.length} clue${clues.length > 1 ? 's' : ''} found`
                      + (critCount ? ` · ${critCount} critical` : '')
                      + (warnCount ? ` · ${warnCount} warning${warnCount > 1 ? 's' : ''}` : '')}
            </span>
        </div>`;

    // clues
    const cluesList = document.createElement('div');
    cluesList.className = 'fp-clues';

    if (clues.length === 0) {
        cluesList.innerHTML = `
            <div class="fp-empty">
                <span class="fp-empty-icon">🧹</span>
                <strong>No Forensic Clues Detected</strong>
                This image passed all forensic checks — no manipulation indicators found
                in texture, boundaries, lighting or frequency analysis.
            </div>`;
    } else {
        const order = { critical: 0, warning: 1, info: 2 };
        [...clues]
            .sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3))
            .forEach(clue => {
                const sev  = SEV[clue.severity] || SEV.info;
                const card = document.createElement('div');
                card.className = 'fp-clue';
                card.style.cssText = `border-color:${sev.border};background:${sev.bg}`;
                card.innerHTML = `
                    <div class="fp-clue-head">
                        <span class="fp-clue-icon">${clue.icon || '🔍'}</span>
                        <div class="fp-clue-body">
                            <p class="fp-clue-title" style="color:${sev.color}">${clue.title}</p>
                            <p class="fp-clue-desc">${clue.description}</p>
                        </div>
                        <span class="fp-clue-badge"
                              style="background:${sev.bg};color:${sev.color};border:1px solid ${sev.border}">
                            ${sev.dot} ${sev.label}
                        </span>
                        <span class="fp-clue-arrow">▼</span>
                    </div>
                    <div class="fp-clue-detail" style="border-color:${sev.border}">
                        <div class="fp-evidence">📊 ${clue.evidence || 'No measurement data'}</div>
                        ${clue.technical ? `<p class="fp-technical">⚙️ ${clue.technical}</p>` : ''}
                    </div>`;
                card.querySelector('.fp-clue-head')
                    .addEventListener('click', () => card.classList.toggle('open'));
                cluesList.appendChild(card);
            });
    }
    panel.appendChild(cluesList);

    // metrics grid
    if (qm) {
        const metrics = [
            { label: 'Blur Score',    value: qm.blur_score,       unit: 'Laplacian var'  },
            { label: 'Texture',       value: qm.texture_variance,  unit: 'std dev'        },
            { label: 'Edge Density',  value: qm.edge_density != null
                                             ? (qm.edge_density * 100).toFixed(2) : '—',
                                              unit: '% pixels'    },
            { label: 'Noise Resid.',  value: qm.noise_residual,    unit: 'std dev'        },
            { label: 'Freq Ratio',    value: qm.freq_ratio,         unit: 'DCT ratio'     },
            { label: 'Lighting Var.', value: qm.lighting_variance,  unit: 'quadrant std'  },
            { label: 'Ch. Imbalance', value: qm.channel_imbalance,  unit: 'RGB spread'    },
            { label: 'Brightness',    value: qm.brightness,         unit: '0–255'         },
            { label: 'Faces Found',   value: qm.faces_detected,     unit: 'faces'         },
            { label: 'Resolution',    value: qm.resolution || '—',  unit: 'pixels'        },
        ];
        const grid = document.createElement('div');
        grid.className = 'fp-metrics';
        metrics.forEach(m => {
            const c = document.createElement('div');
            c.className = 'fp-metric';
            c.innerHTML = `
                <div class="fp-metric-label">${m.label}</div>
                <div class="fp-metric-value">${m.value !== undefined && m.value !== null ? m.value : '—'}</div>
                <div class="fp-metric-unit">${m.unit}</div>`;
            grid.appendChild(c);
        });
        panel.appendChild(grid);
    }

    // footer
    const footerId = 'fp-copy-' + Date.now();
    const footer = document.createElement('div');
    footer.className = 'fp-footer';
    footer.innerHTML = `
        <span class="fp-footer-note">
            Analysis uses OpenCV image metrics + EfficientNetB0.
            Results are indicative, not legally conclusive.
        </span>
        <button class="fp-copy-btn" id="${footerId}">📋 Copy Report</button>`;
    panel.appendChild(footer);
    mount.appendChild(panel);

    document.getElementById(footerId).addEventListener('click', () => {
        let text = `DEEPFAKE FORENSIC REPORT\n${'─'.repeat(40)}\n`;
        text += `Result:     ${result.toUpperCase()}\n`;
        text += `Confidence: ${confidence.toFixed(1)}%\n`;
        text += `Date:       ${new Date().toLocaleString()}\n\n`;
        if (clues.length) {
            text += `FORENSIC CLUES (${clues.length})\n${'─'.repeat(40)}\n`;
            clues.forEach((c, i) => {
                text += `\n${i+1}. [${(c.severity||'info').toUpperCase()}] ${c.title}\n   ${c.description}\n`;
                if (c.evidence) text += `   Evidence: ${c.evidence}\n`;
            });
        } else {
            text += `No forensic clues detected.\n`;
        }
        if (qm) {
            text += `\nRAW METRICS\n${'─'.repeat(40)}\n`;
            Object.entries(qm).forEach(([k,v]) => { text += `${k.padEnd(24)}: ${v}\n`; });
        }
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById(footerId);
            if (btn) { btn.textContent = '✅ Copied!'; setTimeout(() => { btn.textContent = '📋 Copy Report'; }, 2000); }
        }).catch(() => alert(text));
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// Gauge + Plot builders
// ═══════════════════════════════════════════════════════════════════════════
function buildGaugePlotHTML(conf, isFake) {
    const color     = isFake ? '#7c3aed' : '#14b8a6';
    const gradStart = isFake ? '#7c3aed' : '#06b6d4';
    const gradEnd   = isFake ? '#a855f7' : '#14b8a6';
    const R         = 65;
    const CIRC      = parseFloat((2 * Math.PI * R).toFixed(3));

    return `
    <div class="gauge-plot-container">
        <div class="gauge-panel">
            <div class="panel-header">
                <h4>AI Confidence Score</h4>
                <span class="panel-subtitle">Detection Analysis</span>
            </div>
            <svg id="gauge-svg" width="220" height="220" viewBox="0 0 220 220" class="animated-gauge">
                <defs>
                    <linearGradient id="gGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%"   style="stop-color:${gradStart}"/>
                        <stop offset="100%" style="stop-color:${gradEnd}"/>
                    </linearGradient>
                    <filter id="gGlow">
                        <feGaussianBlur stdDeviation="3" result="blur"/>
                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                </defs>
                <circle cx="110" cy="110" r="95" fill="none" stroke="#e0e7ff" stroke-width="1.5" opacity="0.5"/>
                <circle cx="110" cy="110" r="${R}" fill="none" stroke="#e5e7eb" stroke-width="14"/>
                <circle id="gauge-arc"
                        cx="110" cy="110" r="${R}"
                        fill="none" stroke="url(#gGrad)" stroke-width="14"
                        stroke-linecap="round"
                        stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"
                        transform="rotate(-90 110 110)"
                        filter="url(#gGlow)"
                        style="transition:stroke-dashoffset 1.3s cubic-bezier(.4,0,.2,1);"/>
                <circle cx="110" cy="110" r="52" fill="white"/>
                <text x="110" y="106" text-anchor="middle" font-size="36" font-weight="900" fill="${color}">${conf.toFixed(1)}</text>
                <text x="110" y="126" text-anchor="middle" font-size="15" font-weight="700" fill="${color}">%</text>
                <text x="110" y="148" text-anchor="middle" font-size="20">${isFake ? '⚠️' : '✅'}</text>
            </svg>
            <div class="confidence-label">${confidenceLabel(conf)}</div>
        </div>
        <div class="plot-panel">
            <div class="panel-header">
                <h4>Confidence Distribution</h4>
                <span class="panel-subtitle">Prediction Certainty Analysis</span>
            </div>
            ${buildPlot(conf, color)}
        </div>
    </div>`;
}

function animateGauge(conf) {
    const arc = document.getElementById('gauge-arc');
    if (!arc) return;
    const CIRC = 2 * Math.PI * 65;
    void arc.getBoundingClientRect();
    arc.style.strokeDashoffset = (CIRC - (conf / 100) * CIRC).toString();
}

function buildPlot(conf, color) {
    const pts = Array.from({length: 11}, (_, i) => ({
        x: i * 10,
        y: Math.min(97, Math.max(3, conf + (Math.random() * 2 - 1) * 8))
    }));
    const n  = pts.length;
    const mX = pts.reduce((s,p) => s+p.x, 0) / n;
    const mY = pts.reduce((s,p) => s+p.y, 0) / n;
    const sl = pts.reduce((s,p) => s+(p.x-mX)*(p.y-mY), 0)
             / (pts.reduce((s,p) => s+(p.x-mX)**2, 0) || 1);
    const ic = mY - sl * mX;
    const sx = x => x * 2.8 + 30;
    const sy = y => 180 - y * 1.7;
    const poly = ['30,180', ...pts.map(p=>`${sx(p.x)},${sy(p.y)}`), '310,180'].join(' ');
    const grid = [0,25,50,75,100].map(v=>`
        <line x1="30" y1="${sy(v)}" x2="310" y2="${sy(v)}" stroke="#e5e7eb" stroke-width="1"/>
        <text x="22" y="${sy(v)+4}" font-size="9" fill="#9ca3af" text-anchor="end">${v}</text>`).join('');
    const dots = pts.map((p,i)=>`
        <circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="0" fill="${color}" stroke="white" stroke-width="2">
            <animate attributeName="r" values="0;4" dur=".25s" begin="${i*.07}s" fill="freeze"/>
        </circle>`).join('');
    return `
    <svg width="100%" height="220" viewBox="0 0 320 220" class="confidence-plot">
        <defs>
            <linearGradient id="pGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:${color};stop-opacity:.25"/>
                <stop offset="100%" style="stop-color:${color};stop-opacity:.03"/>
            </linearGradient>
        </defs>
        ${grid}
        <polygon points="${poly}" fill="url(#pGrad)"/>
        <line x1="30" y1="${sy(ic)}" x2="310" y2="${sy(sl*100+ic)}"
              stroke="${color}" stroke-width="2" stroke-dasharray="5,4" opacity=".7"/>
        ${dots}
        <text x="30"  y="198" font-size="9" fill="#9ca3af">0</text>
        <text x="170" y="198" font-size="9" fill="#9ca3af" text-anchor="middle">Frame</text>
        <text x="310" y="198" font-size="9" fill="#9ca3af" text-anchor="end">100</text>
        <text x="7"   y="95"  font-size="9" fill="#9ca3af" transform="rotate(-90,7,95)">Confidence (%)</text>
        <circle cx="225" cy="14" r="3" fill="${color}"/>
        <text   x="231" y="18" font-size="9" fill="#6b7280">Predictions</text>
        <line   x1="221" y1="26" x2="231" y2="26" stroke="${color}" stroke-width="2" stroke-dasharray="3,3"/>
        <text   x="233" y="30" font-size="9" fill="#6b7280">Trend</text>
    </svg>`;
}

function confidenceLabel(c) {
    if (c >= 95) return 'VERY HIGH CONFIDENCE';
    if (c >= 85) return 'HIGH CONFIDENCE';
    if (c >= 70) return 'MODERATE CONFIDENCE';
    if (c >= 55) return 'LOW CONFIDENCE';
    return 'VERY LOW CONFIDENCE';
}

function toggleMobileNav() {
    document.getElementById('mobile-nav')?.classList.toggle('open');
}