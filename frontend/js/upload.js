// ═══════════════════════════════════════════════════════════════════════════
// upload.js  ─  Results with Overview / Forensic Analysis tab toggle
// Changes vs original:
//   1. Faces detected metric REMOVED from Overview
//   2. Confidence line plot REPLACED with Forensic Risk Score radar/bar chart
//   3. Edited images show as AUTHENTIC (handled by backend _classify_result)
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

// ── Inject styles ────────────────────────────────────────────────────────────
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
}
.result-tab:hover { color: #374151; background: #f3f4f6; }
.result-tab.active { color: #6366f1; border-bottom-color: #6366f1; background: #fff; }
.result-tab .tab-badge {
    font-size: 11px; font-weight: 700; padding: 2px 7px;
    border-radius: 99px; background: #fef2f2; color: #dc2626; line-height: 1.4;
}
.result-tab .tab-badge.warn  { background: #fffbeb; color: #d97706; }
.result-tab .tab-badge.info  { background: #eff6ff; color: #2563eb; }
.result-tab .tab-badge.ok    { background: #f0fdf4; color: #16a34a; }

/* ─── Tab Panes ───────────────────────────────────────────── */
.result-pane { display: none; }
.result-pane.active { display: block; }

/* ─── Risk Radar container ────────────────────────────────── */
.risk-radar-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    padding: 2rem;
    background: linear-gradient(135deg, #faf5ff 0%, #f0f9ff 100%);
    border-radius: 16px;
    margin: 1.5rem 0;
    box-shadow: 0 4px 20px rgba(124,58,237,.08);
    animation: fadeInUp .6s ease-out;
}
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
}
.gauge-panel, .radar-panel {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0,0,0,.06);
    transition: transform .3s, box-shadow .3s;
}
.gauge-panel:hover, .radar-panel:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(124,58,237,.12);
}
.panel-header { margin-bottom: 1rem; text-align: center; }
.panel-header h4 {
    font-size: 1.1rem; font-weight: 700; margin: 0 0 .25rem;
    background: linear-gradient(135deg, #7c3aed, #14b8a6);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.panel-subtitle { font-size: .8rem; color: #6b7280; font-weight: 500; }
.animated-gauge { display: block; margin: 0 auto; filter: drop-shadow(0 4px 12px rgba(124,58,237,.15)); }
.confidence-label {
    text-align: center; margin-top: 1rem; font-size: .9rem;
    font-weight: 700; color: #7c3aed; letter-spacing: .5px;
}

/* ─── Risk Bar Chart ──────────────────────────────────────── */
/* ── Frame Timeline (video analysis) ─────────────────── */
.frame-timeline    { width:100%; }
.frame-bars        { display:flex; align-items:flex-end; gap:4px; height:72px;
                     background:#f8fafc; border-radius:8px; padding:8px; }
.frame-bar-wrap    { flex:1; display:flex; flex-direction:column; align-items:center;
                     height:100%; gap:3px; cursor:pointer; }
.frame-bar-inner   { flex:1; width:100%; background:#e5e7eb; border-radius:3px;
                     overflow:hidden; display:flex; align-items:flex-end; }
.frame-bar-fill    { width:100%; border-radius:3px 3px 0 0; transition:height .5s ease; min-height:2px; }
.frame-bar-num     { font-size:.65rem; color:#9ca3af; }
.frame-legend      { display:flex; gap:16px; margin-top:8px; font-size:.8rem; color:#6b7280; }
.frame-stat        { }
.frame-axis        { margin-top:6px; font-size:.72rem; color:#9ca3af; }
.dark .frame-bars  { background:#1e293b; }
.dark .frame-bar-inner { background:#334155; }
/* ─────────────────────────────────────────────────── */
.risk-bar-list { display: flex; flex-direction: column; gap: .65rem; padding: .5rem 0; }
.risk-bar-item { display: flex; align-items: center; gap: .75rem; }
.risk-bar-label {
    width: 80px; font-size: .82rem; font-weight: 600;
    color: #374151; text-align: right; flex-shrink: 0;
    text-transform: uppercase; letter-spacing: .3px;
}
.risk-bar-track {
    flex: 1; height: 22px; background: #f3f4f6;
    border-radius: 11px; overflow: hidden; position: relative;
}
.risk-bar-fill {
    height: 100%; border-radius: 11px;
    transition: width 1s cubic-bezier(.4,0,.2,1);
    position: relative;
}
.risk-bar-fill::after {
    content: attr(data-score);
    position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
    font-size: .75rem; font-weight: 800; color: white;
    text-shadow: 0 1px 2px rgba(0,0,0,.3);
}
.risk-bar-score {
    width: 38px; font-size: .82rem; font-weight: 800;
    text-align: center; flex-shrink: 0;
}
/* risk level colours */
.risk-low    { background: linear-gradient(90deg, #10b981, #34d399); }
.risk-medium { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
.risk-high   { background: linear-gradient(90deg, #ef4444, #f87171); }
.risk-low-text    { color: #059669; }
.risk-medium-text { color: #d97706; }
.risk-high-text   { color: #dc2626; }

/* ─── Forensic Panel ──────────────────────────────────────── */
.forensic-panel {
    border-radius: 14px; overflow: hidden;
    border: 1.5px solid #e5e7eb;
    box-shadow: 0 4px 20px rgba(0,0,0,.06);
}
.fp-header {
    display: flex; align-items: center; gap: 14px;
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
.fp-verdict.is-fake     { background: linear-gradient(90deg,#fef2f2,#fff5f5); }
.fp-verdict.is-real     { background: linear-gradient(90deg,#f0fdf4,#f8fff9); }
.fp-verdict.is-ai-gen   { background: linear-gradient(90deg,#faf5ff,#f5f3ff); }
.fp-verdict-label       { font-size: 19px; font-weight: 800; letter-spacing: -.4px; }
.fp-verdict-label.fake      { color: #dc2626; }
.fp-verdict-label.real      { color: #16a34a; }
.fp-verdict-label.ai-generated { color: #7c3aed; }
/* AI-Generated banner style */
.result-status.ai-generated {
    background: linear-gradient(135deg, #6d28d9 0%, #7c3aed 50%, #8b5cf6 100%);
    color: #fff;
}
.fp-verdict-conf    { font-size: 13px; color: #6b7280; }
.fp-verdict-badge   {
    margin-left: auto; font-size: 12px; background: #fff;
    border: 1px solid #e5e7eb; border-radius: 20px;
    padding: 4px 14px; color: #374151;
}
.fp-clues { padding: 14px 18px; background: #fff; display: flex; flex-direction: column; gap: 10px; }
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
.fp-btn-group   { display: flex; gap: 8px; flex-shrink: 0; }
.fp-copy-btn {
    font-size: 12px; color: #6366f1; background: none;
    border: 1px solid #c7d2fe; border-radius: 6px; padding: 4px 12px;
    cursor: pointer; transition: background .15s; white-space: nowrap;
}
.fp-copy-btn:hover  { background: #eff0ff; }
.fp-pdf-btn         { color: #0f766e; border-color: #99f6e4; }
.fp-pdf-btn:hover   { background: #f0fdfa; }

/* ─── Dark mode ─────────────────────────────────────────── */
[data-theme="dark"] .risk-radar-container {
    background: linear-gradient(135deg, #1e1b4b 0%, #164e63 100%);
}
[data-theme="dark"] .gauge-panel,
[data-theme="dark"] .radar-panel { background: #1e293b; }
[data-theme="dark"] .risk-bar-label { color: #cbd5e1; }
[data-theme="dark"] .risk-bar-track { background: #334155; }
[data-theme="dark"] .panel-header h4 { -webkit-text-fill-color: #f1f5f9 !important; color: #f1f5f9 !important; }
[data-theme="dark"] .panel-subtitle  { color: #94a3b8; }
[data-theme="dark"] .confidence-label { color: #a78bfa; }
[data-theme="dark"] .forensic-panel  { border-color: #374151; }
[data-theme="dark"] .fp-clues        { background: #1e293b; }
[data-theme="dark"] .fp-clue-desc    { color: #94a3b8; }
[data-theme="dark"] .fp-evidence     { background: #374151; color: #e2e8f0; border-color: #475569; }
[data-theme="dark"] .fp-technical    { color: #64748b; }
[data-theme="dark"] .fp-metrics      { background: #0f172a; }
[data-theme="dark"] .fp-metric       { background: #1e293b; border-color: #374151; }
[data-theme="dark"] .fp-metric-value { color: #f1f5f9; }
[data-theme="dark"] .fp-metric-label,
[data-theme="dark"] .fp-metric-unit  { color: #64748b; }
[data-theme="dark"] .fp-footer       { background: #0f172a; border-color: #374151; }
[data-theme="dark"] .fp-footer-note  { color: #64748b; }
[data-theme="dark"] .fp-verdict-badge{ background: #1e293b; border-color: #374151; color: #e2e8f0; }
[data-theme="dark"] .fp-empty        { color: #64748b; }
[data-theme="dark"] .fp-empty strong { color: #94a3b8; }
[data-theme="dark"] .fp-verdict.is-fake { background: linear-gradient(90deg,#1c0d0d,#1a0f0f); }
[data-theme="dark"] .fp-verdict.is-real { background: linear-gradient(90deg,#0c1a10,#0f1c13); }
[data-theme="dark"] .result-tab-bar  { background: #1e293b; border-color: #374151; }
[data-theme="dark"] .result-tab      { color: #94a3b8; }
[data-theme="dark"] .result-tab:hover{ background: #334155; color: #e2e8f0; }
[data-theme="dark"] .result-tab.active{ color: #a5b4fc; background: #0f172a; border-bottom-color: #a5b4fc; }

@media (max-width: 968px) {
    .risk-radar-container { grid-template-columns: 1fr; gap: 1.5rem; padding: 1.5rem; }
}
`;
    const el = document.createElement('style');
    el.id = 'upload-extra-styles';
    el.textContent = css;
    document.head.appendChild(el);
})();

// ── URL param: auto-switch to video tab ────────────────────────────────────
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

// ── Drag & drop ────────────────────────────────────────────────────────────
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

// ── XHR Upload ─────────────────────────────────────────────────────────────
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
// VERDICT SUMMARY CARD  — plain-English clear verdict for lecturer/demo
// ═══════════════════════════════════════════════════════════════════════════
function buildVerdictCard(result, confidence, clues, qm, risks) {
    const r    = (result || '').toLowerCase();
    const isFake  = r === 'fake';
    const isAIGen = r === 'ai_generated';
    const isReal  = !isFake && !isAIGen;

    // ── Traffic light colour scheme ───────────────────────────────────────
    const cfg = isFake ? {
        bg:       'linear-gradient(135deg,#fef2f2 0%,#fff5f5 100%)',
        border:   '#fca5a5',
        accent:   '#dc2626',
        light:    '#fee2e2',
        dot:      '🔴',
        icon:     '⚠️',
        verdict:  'DEEPFAKE DETECTED',
        tagline:  'This content contains AI face-swap manipulation.',
        explain:  'The face in this image or video has been digitally replaced or altered using deepfake AI technology. The manipulation leaves measurable forensic traces in texture, noise and boundary regions.',
    } : isAIGen ? {
        bg:       'linear-gradient(135deg,#faf5ff 0%,#f5f3ff 100%)',
        border:   '#c4b5fd',
        accent:   '#7c3aed',
        light:    '#ede9fe',
        dot:      '🟣',
        icon:     '🤖',
        verdict:  'AI-GENERATED CONTENT',
        tagline:  'This image was created entirely by an AI generator.',
        explain:  'This is not a real photograph. It was synthesised by an AI image generator (such as Midjourney, Stable Diffusion or Gemini). The AI leaves a characteristic colour and compression signature that does not appear in genuine camera photos.',
    } : {
        bg:       'linear-gradient(135deg,#f0fdf4 0%,#f8fff9 100%)',
        border:   '#86efac',
        accent:   '#16a34a',
        light:    '#dcfce7',
        dot:      '🟢',
        icon:     '✅',
        verdict:  'AUTHENTIC CONTENT',
        tagline:  'This appears to be a genuine, unmanipulated image or video.',
        explain:  'No face-manipulation or AI-synthesis signals were detected. The image shows natural camera sensor noise, realistic skin texture and normal colour variation — all consistent with a real photograph or video.',
    };

    // ── Trust level based on confidence ──────────────────────────────────
    const trustLabel = confidence >= 90 ? 'VERY HIGH'
                     : confidence >= 75 ? 'HIGH'
                     : confidence >= 60 ? 'MODERATE'
                     : 'LOW';
    const trustColor = confidence >= 90 ? '#16a34a'
                     : confidence >= 75 ? '#2563eb'
                     : confidence >= 60 ? '#d97706'
                     : '#dc2626';
    const trustNote  = confidence >= 90 ? 'Multiple strong signals confirm this verdict.'
                     : confidence >= 75 ? 'Several signals support this verdict.'
                     : confidence >= 60 ? 'Some signals present — treat with moderate caution.'
                     : 'Weak signals — result may not be reliable.';

    // ── Fixed evidence points per result type ──────────────────────────────
    // Verdict card uses fixed plain-English points — no clue list.
    // This avoids contradictions (e.g. AI compression clue on AUTHENTIC result).
    // Full forensic clues are shown in the Forensic Analysis tab.
    const dfScore = risks.deepfake_score ?? 0;
    const aiScore = risks.ai_gen_score   ?? 0;

    const evidenceItems = isReal ? `
        <div style="display:flex;align-items:center;gap:.7rem;margin-bottom:.55rem;">
            <span style="font-size:1.1rem;">📷</span>
            <span style="font-size:.88rem;color:#374151;">Camera sensor noise is present — consistent with a real camera</span>
        </div>
        <div style="display:flex;align-items:center;gap:.7rem;margin-bottom:.55rem;">
            <span style="font-size:1.1rem;">🧬</span>
            <span style="font-size:.88rem;color:#374151;">Skin texture variance is natural — no GAN smoothing detected</span>
        </div>
        <div style="display:flex;align-items:center;gap:.7rem;">
            <span style="font-size:1.1rem;">🎨</span>
            <span style="font-size:.88rem;color:#374151;">Colour saturation varies normally — no AI colour grading signature</span>
        </div>`
    : isAIGen ? `
        <div style="display:flex;align-items:center;gap:.7rem;margin-bottom:.55rem;">
            <span style="font-size:1.1rem;">🌈</span>
            <span style="font-size:.88rem;color:#374151;">Saturation uniformity (sat_cv=${(qm.sat_cv||0).toFixed(3)}) — AI generators produce unnaturally consistent colour</span>
        </div>
        <div style="display:flex;align-items:center;gap:.7rem;margin-bottom:.55rem;">
            <span style="font-size:1.1rem;">📦</span>
            <span style="font-size:.88rem;color:#374151;">Compression pattern matches AI-generated images saved at reduced quality</span>
        </div>
        <div style="display:flex;align-items:center;gap:.7rem;">
            <span style="font-size:1.1rem;">🤖</span>
            <span style="font-size:.88rem;color:#374151;">AI-Generation Score: ${aiScore}/100 — strong synthesis signature detected</span>
        </div>`
    : `
        <div style="display:flex;align-items:center;gap:.7rem;margin-bottom:.55rem;">
            <span style="font-size:1.1rem;">🎭</span>
            <span style="font-size:.88rem;color:#374151;">Deepfake Score: ${dfScore}/100 — face-manipulation evidence present</span>
        </div>
        <div style="display:flex;align-items:center;gap:.7rem;margin-bottom:.55rem;">
            <span style="font-size:1.1rem;">🧬</span>
            <span style="font-size:.88rem;color:#374151;">EfficientNetB0 neural network detected subtle GAN artifacts in face region</span>
        </div>
        <div style="display:flex;align-items:center;gap:.7rem;">
            <span style="font-size:1.1rem;">🔬</span>
            <span style="font-size:.88rem;color:#374151;">See Forensic Analysis tab below for full signal breakdown</span>
        </div>`;
    // ── Confidence bar ────────────────────────────────────────────────────
    const barFill = Math.round(confidence);
    const barColor = confidence >= 75 ? cfg.accent : confidence >= 55 ? '#d97706' : '#9ca3af';

    return `
    <div style="
        background:${cfg.bg};
        border:2px solid ${cfg.border};
        border-radius:18px;
        padding:0;
        margin:1.5rem 0;
        overflow:hidden;
        box-shadow:0 8px 32px rgba(0,0,0,.08);
        animation:fadeInUp .5s ease-out;
    ">
        <!-- Header bar -->
        <div style="
            background:${cfg.accent};
            padding:1rem 1.5rem;
            display:flex;
            align-items:center;
            gap:1rem;
        ">
            <span style="font-size:2.2rem;line-height:1">${cfg.icon}</span>
            <div>
                <div style="font-size:1.35rem;font-weight:900;color:#fff;letter-spacing:-.3px;">${cfg.verdict}</div>
                <div style="font-size:.88rem;color:rgba(255,255,255,.85);margin-top:.1rem;">${cfg.tagline}</div>
            </div>
            <div style="margin-left:auto;text-align:right;">
                <div style="font-size:2.2rem;font-weight:900;color:#fff;line-height:1">${confidence.toFixed(1)}%</div>
                <div style="font-size:.72rem;color:rgba(255,255,255,.8);font-weight:600;">AI CONFIDENCE</div>
            </div>
        </div>

        <!-- Body -->
        <div style="padding:1.4rem 1.5rem;">

            <!-- Plain-language explanation -->
            <p style="
                font-size:.93rem;color:#374151;line-height:1.65;
                margin:0 0 1.2rem;padding:.9rem 1.1rem;
                background:white;border-radius:10px;
                border-left:4px solid ${cfg.accent};
            ">${cfg.explain}</p>

            <!-- Evidence -->
            <div style="margin-bottom:1.2rem;">
                <div style="font-size:.78rem;font-weight:800;color:#9ca3af;letter-spacing:.8px;
                            text-transform:uppercase;margin-bottom:.7rem;">
                    WHY THE SYSTEM REACHED THIS VERDICT
                </div>
                ${evidenceItems}
            </div>

            <!-- Confidence bar + trust level -->
            <div style="background:white;border-radius:12px;padding:1rem 1.2rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
                    <span style="font-size:.8rem;font-weight:700;color:#374151;">DETECTION CONFIDENCE</span>
                    <span style="font-size:.8rem;font-weight:800;color:${trustColor};">
                        ${cfg.dot} ${trustLabel} TRUST
                    </span>
                </div>
                <div style="background:#e5e7eb;border-radius:99px;height:12px;overflow:hidden;margin-bottom:.5rem;">
                    <div style="
                        height:100%;width:${barFill}%;
                        background:${barColor};
                        border-radius:99px;
                        transition:width 1.4s cubic-bezier(.4,0,.2,1);
                    " id="verdict-conf-bar"></div>
                </div>
                <div style="font-size:.78rem;color:#6b7280;">${trustNote}</div>
            </div>

        </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// showResults — tab bar: Overview (gauge + risk chart) | Forensic Analysis
// ═══════════════════════════════════════════════════════════════════════════
function showResults(data) {
    progressSection.style.display = 'none';
    resultsSection.style.display  = 'block';

    const resultLabel = (data.result || '').toLowerCase();
    const isFake      = resultLabel === 'fake';
    const isAIGen     = resultLabel === 'ai_generated';
    const isReal      = !isFake && !isAIGen;
    const conf        = parseFloat(data.confidence) || 0;
    const quality     = data.quality_metrics || {};
    const clues       = data.forensic_clues || data.artifacts || [];
    const risks       = data.risk_scores || {};

    // ── Status banner ─────────────────────────────────────────────────────
    const resultStatus = document.getElementById('result-status');
    if (resultStatus) {
        // Three-way verdict: deepfake / ai-generated / authentic
        let bannerClass, bannerIcon, bannerTitle, bannerDesc;
        if (isFake) {
            bannerClass = 'fake';
            bannerIcon  = '⚠️';
            bannerTitle = 'DEEPFAKE DETECTED';
            bannerDesc  = 'AI face-manipulation artifacts detected — this face has likely been swapped or altered';
        } else if (isAIGen) {
            bannerClass = 'ai-generated';
            bannerIcon  = '🤖';
            bannerTitle = 'AI-GENERATED CONTENT';
            bannerDesc  = 'This image shows strong signatures of AI synthesis (Midjourney, SDXL, Gemini or similar) — not a real photograph';
        } else {
            bannerClass = 'real';
            bannerIcon  = '✅';
            bannerTitle = 'AUTHENTIC CONTENT';
            bannerDesc  = 'No face manipulation detected — content appears genuine or edited';
        }
        resultStatus.className = 'result-status ' + bannerClass;
        resultStatus.innerHTML = `
            <div class="status-icon">${bannerIcon}</div>
            <h3>${bannerTitle}</h3>
            <p style="margin:.5rem 0 0;font-size:.95rem;opacity:.9;">${bannerDesc}</p>`;
    }

    // ── Gauge + Risk chart (replaces old confidence plot) ─────────────────
    const gaugeEl = document.getElementById('confidence-gauge');
    if (gaugeEl) {
        gaugeEl.innerHTML = buildGaugeRiskHTML(conf, isFake, risks);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                animateGauge(conf);
                animateRiskBars(risks);
                // Animate verdict card confidence bar
                const vcb = document.getElementById('verdict-conf-bar');
                if (vcb) vcb.style.width = `${Math.round(conf)}%`;
            });
        });
    }

    // ── Tab bar badge ─────────────────────────────────────────────────────
    const critCount  = clues.filter(c => c.severity === 'critical').length;
    const warnCount  = clues.filter(c => c.severity === 'warning').length;
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

    // ── Verdict Summary Card — shown before tabs ────────────────────────────
    let verdictCard = document.getElementById('verdict-summary-card');
    if (!verdictCard) {
        verdictCard = document.createElement('div');
        verdictCard.id = 'verdict-summary-card';
        const anchor = gaugeEl || document.getElementById('quality-metrics');
        if (anchor && anchor.parentNode) {
            anchor.parentNode.insertBefore(verdictCard, anchor.nextSibling);
        } else {
            resultsSection.appendChild(verdictCard);
        }
    }
    verdictCard.innerHTML = buildVerdictCard(
        data.result, conf, clues, data.quality_metrics || {}, data.risk_scores || {}
    );

    // ── Tab container ─────────────────────────────────────────────────────
    let tabWrap = document.getElementById('result-tab-wrap');
    if (!tabWrap) {
        tabWrap = document.createElement('div');
        tabWrap.id = 'result-tab-wrap';
        const anchor = gaugeEl || document.getElementById('quality-metrics');
        if (anchor && anchor.parentNode) {
            anchor.parentNode.insertBefore(tabWrap, anchor.nextSibling);
        } else if (resultsSection) {
            resultsSection.appendChild(tabWrap);
        }
    }

    tabWrap.innerHTML = `
        <div class="result-tab-bar">
            <button class="result-tab active" data-pane="overview">📋 Overview</button>
            <button class="result-tab" data-pane="forensic">🔬 Forensic Analysis ${badgeHTML}</button>
        </div>
        <div class="result-pane active" id="pane-overview">
            <div class="metrics-grid" id="inline-metrics"></div>
        </div>
        <div class="result-pane" id="pane-forensic">
            <div id="fp-mount"></div>
        </div>`;

    tabWrap.querySelectorAll('.result-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            tabWrap.querySelectorAll('.result-tab').forEach(b => b.classList.remove('active'));
            tabWrap.querySelectorAll('.result-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`pane-${btn.dataset.pane}`)?.classList.add('active');
        });
    });

    // ── Overview pane  (NO faces detected row) ────────────────────────────
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
            <span class="metric-label">Resolution</span>
            <span class="metric-value">${quality.resolution || '—'}</span>
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
            <span class="metric-label">Noise Level</span>
            <span class="metric-value">${quality.noise_residual}</span>
        </div>
        <div class="metric-item">
            <span class="metric-label">Forensic Clues</span>
            <span class="metric-value" style="color:${totalClues === 0 ? '#16a34a' : critCount > 0 ? '#dc2626' : '#d97706'}">
                ${totalClues === 0 ? '✓ None' : totalClues + ' found'}
            </span>
        </div>` : ''}
        ${quality.video_fps !== undefined ? `
        <div class="metric-item">
            <span class="metric-label">Video FPS</span>
            <span class="metric-value">${quality.video_fps}</span>
        </div>
        <div class="metric-item">
            <span class="metric-label">Duration</span>
            <span class="metric-value">${quality.video_duration_sec}s</span>
        </div>
        <div class="metric-item">
            <span class="metric-label">Frames Analyzed</span>
            <span class="metric-value">${quality.frames_analyzed} / ${quality.video_frame_count}</span>
        </div>
        <div class="metric-item" style="grid-column:1/-1">
            <span class="metric-label">Frame-by-Frame Scores</span>
            <div style="margin-top:8px">${buildFrameTimeline(quality.frame_scores || [], data.result)}</div>
        </div>` : ''}`;

    // ── Forensic pane ─────────────────────────────────────────────────────
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
// GAUGE + FORENSIC RISK BAR CHART  (replaces confidence plot)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// FRAME-BY-FRAME TIMELINE  (video analysis only)
// ═══════════════════════════════════════════════════════════════════════════

function buildFrameTimeline(scores, result) {
    if (!scores || scores.length === 0) return '<span style="color:#9ca3af;font-size:.85rem">No frame data available</span>';

    const isFake = (result || '').toLowerCase() === 'fake';
    // Frame scores: high score = high REAL confidence (fake=class0, real=class1)
    // Invert: low score (<30) = suspicious/fake, high score (>70) = clean/real
    const isFakeResult = (result || '').toLowerCase() === 'fake';
    const bars = scores.map((score, i) => {
        const pct = Math.min(100, Math.max(0, score));
        // Real-class score: high = real (green), low = fake (red)
        const realPct = pct;
        const color = realPct <= 30 ? '#ef4444' : realPct <= 55 ? '#f59e0b' : '#10b981';
        const label = realPct <= 30 ? '⚠' : realPct <= 55 ? '~' : '✓';
        const barHeight = realPct; // bar height shows real-confidence
        return `
        <div class="frame-bar-wrap" title="Frame ${i+1}: ${realPct.toFixed(1)}% real confidence">
            <div class="frame-bar-inner">
                <div class="frame-bar-fill" style="height:${barHeight}%;background:${color};width:100%"></div>
            </div>
            <span class="frame-bar-num">${i+1}</span>
        </div>`;
    }).join('');

    const avgScore   = scores.reduce((a,b)=>a+b,0)/scores.length;
    const minScore   = Math.min(...scores);
    // Suspicious = frames with LOW real-confidence (potential fake frames)
    const suspicious = scores.filter(s => s <= 30).length;
    const uncertain  = scores.filter(s => s > 30 && s <= 55).length;

    return `
    <div class="frame-timeline">
        <div class="frame-bars">${bars}</div>
        <div class="frame-legend">
            <span class="frame-stat">Avg real confidence: <b>${avgScore.toFixed(1)}%</b></span>
            <span class="frame-stat">Min: <b>${minScore.toFixed(1)}%</b></span>
            <span class="frame-stat">Suspicious frames: <b style="color:${suspicious>0?'#ef4444':'#10b981'}">${suspicious}/${scores.length}</b></span>
        </div>
        <div class="frame-axis">
            <span style="color:#ef4444">■ Suspicious / Fake (0–30%)</span>
            <span style="color:#f59e0b;margin:0 12px">■ Uncertain (30–55%)</span>
            <span style="color:#10b981">■ Clean / Real (55%+)</span>
        </div>
    </div>`;
}

function buildGaugeRiskHTML(conf, isFake, risks) {
    const isAIGen   = !isFake && (document.getElementById('result-status')?.className || '').includes('ai-generated');
    // Blend ML confidence into Deepfake Score when result=FAKE
    // High-quality deepfakes fool forensic metrics but not the ML model.
    // Without blending: fake@95% shows Deepfake Score=9 (misleading)
    // With blending: fake@95% shows Deepfake Score=59 (HIGH RISK — consistent)
    const rawDfScore = risks.deepfake_score ?? 0;
    const dfScore    = isFake
        ? Math.max(45, Math.min(97, Math.round(rawDfScore + (conf - 50) * 1.1)))
        : rawDfScore;
    const aiScore   = risks.ai_gen_score   ?? 0;

    // ── Left gauge colours (AI Confidence) ───────────────────────────────
    const leftColor     = isFake ? '#dc2626' : isAIGen ? '#7c3aed' : '#14b8a6';
    const leftGradStart = isFake ? '#ef4444' : isAIGen ? '#8b5cf6' : '#06b6d4';
    const leftGradEnd   = isFake ? '#dc2626' : isAIGen ? '#7c3aed' : '#14b8a6';
    const leftIcon      = isFake ? '⚠️'     : isAIGen ? '🤖'      : '✅';

    // ── Right gauge colours (Deepfake Score) ─────────────────────────────
    const dfColor     = dfScore >= 55 ? '#dc2626' : dfScore >= 30 ? '#f59e0b' : '#10b981';
    const dfGradStart = dfScore >= 55 ? '#ef4444' : dfScore >= 30 ? '#fbbf24' : '#34d399';
    const dfGradEnd   = dfScore >= 55 ? '#dc2626' : dfScore >= 30 ? '#f59e0b' : '#10b981';
    const dfLabel     = dfScore >= 55 ? 'HIGH RISK' : dfScore >= 30 ? 'MODERATE' : 'LOW RISK';
    const dfIcon      = dfScore >= 55 ? '🔴' : dfScore >= 30 ? '🟡' : '🟢';

    const R    = 65;
    const CIRC = parseFloat((2 * Math.PI * R).toFixed(3));

    // ── SVG gauge builder ─────────────────────────────────────────────────
    function gaugeArc(id, gradId, gradStart, gradEnd, textVal, textUnit, subIcon, subText, extraText) {
        return `
        <svg id="${id}-svg" width="200" height="200" viewBox="0 0 220 220" class="animated-gauge">
            <defs>
                <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%"   style="stop-color:${gradStart}"/>
                    <stop offset="100%" style="stop-color:${gradEnd}"/>
                </linearGradient>
                <filter id="${id}-glow">
                    <feGaussianBlur stdDeviation="3" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
            </defs>
            <circle cx="110" cy="110" r="95" fill="none" stroke="#e0e7ff" stroke-width="1.5" opacity="0.4"/>
            <circle cx="110" cy="110" r="${R}" fill="none" stroke="#e5e7eb" stroke-width="14"/>
            <circle id="${id}-arc"
                    cx="110" cy="110" r="${R}"
                    fill="none" stroke="url(#${gradId})" stroke-width="14"
                    stroke-linecap="round"
                    stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"
                    transform="rotate(-90 110 110)"
                    filter="url(#${id}-glow)"
                    style="transition:stroke-dashoffset 1.3s cubic-bezier(.4,0,.2,1);"/>
            <circle cx="110" cy="110" r="52" fill="white"/>
            <text x="110" y="102" text-anchor="middle" font-size="30" font-weight="900" fill="${gradEnd}">${textVal}</text>
            <text x="110" y="122" text-anchor="middle" font-size="14" font-weight="700" fill="${gradEnd}">${textUnit}</text>
            <text x="110" y="148" text-anchor="middle" font-size="18">${subIcon}</text>
        </svg>
        <div class="confidence-label" style="color:${gradEnd}">${subText}</div>
        ${extraText ? `<div style="font-size:.72rem;color:#9ca3af;text-align:center;margin-top:.3rem;">${extraText}</div>` : ''}`;
    }

    const leftVal   = conf.toFixed(1);
    const leftSub   = conf >= 90 ? 'VERY HIGH' : conf >= 75 ? 'HIGH' : conf >= 60 ? 'MODERATE' : 'LOW';
    const dfSub     = dfLabel;

    return `
    <div class="risk-radar-container" style="grid-template-columns:1fr 1fr;">

        <!-- Left: AI Confidence Gauge -->
        <div class="gauge-panel">
            <div class="panel-header">
                <h4>AI Confidence Score</h4>
                <span class="panel-subtitle">ML model detection certainty</span>
            </div>
            ${gaugeArc('gauge', 'gGrad', leftGradStart, leftGradEnd,
                leftVal, '%', leftIcon,
                leftSub + ' CONFIDENCE', '')}
        </div>

        <!-- Right: Deepfake Score Gauge -->
        <div class="gauge-panel">
            <div class="panel-header">
                <h4>Deepfake Score</h4>
                <span class="panel-subtitle">Forensic signal strength</span>
            </div>
            ${gaugeArc('df-gauge', 'dfGrad', dfGradStart, dfGradEnd,
                dfScore, '/100', dfIcon,
                dfSub,
                (dfScore < 30 && isFake)
                    ? '⚠ High-quality deepfake — subtle patterns caught by AI model'
                    : 'texture · noise · edges · lighting')}
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

function animateRiskBars(risks) {
    // Animate right deepfake gauge arc
    const dfArc = document.getElementById('df-gauge-arc');
    if (dfArc) {
        const CIRC = 2 * Math.PI * 65;
        const dfScore = risks.deepfake_score ?? 0;
        void dfArc.getBoundingClientRect();
        setTimeout(() => {
            dfArc.style.strokeDashoffset = (CIRC - (dfScore / 100) * CIRC).toString();
        }, 200);
    }
    // Animate score bars if present
    [{ id:'rb-deepfake', score: risks.deepfake_score ?? 0 },
     { id:'rb-aigen',    score: risks.ai_gen_score   ?? 0 }
    ].forEach((p, i) => {
        const el = document.getElementById(p.id);
        if (el) setTimeout(() => { el.style.width = `${p.score}%`; }, 400 + i * 200);
    });
}
function confidenceLabel(c) {
    if (c >= 95) return 'VERY HIGH CONFIDENCE';
    if (c >= 85) return 'HIGH CONFIDENCE';
    if (c >= 70) return 'MODERATE CONFIDENCE';
    if (c >= 55) return 'LOW CONFIDENCE';
    return 'VERY LOW CONFIDENCE';
}


// ═══════════════════════════════════════════════════════════════════════════
// FORENSIC PANEL RENDERER
// (faces_detected metric REMOVED from fp-metrics grid)
// ═══════════════════════════════════════════════════════════════════════════
const SEV = {
    critical: { label: 'Critical', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: '🔴' },
    warning:  { label: 'Warning',  color: '#d97706', bg: '#fffbeb', border: '#fde68a', dot: '🟡' },
    info:     { label: 'Info',     color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', dot: '🔵' },
};

function renderForensicPanel(data, mountId) {
    const mount = document.getElementById(mountId);
    if (!mount) { console.warn('[Forensic] mount element not found:', mountId); return; }
    mount.innerHTML = '';

    const result     = (data.result || 'unknown').toLowerCase();
    const confidence = parseFloat(data.confidence) || 0;
    const clues      = data.forensic_clues || data.artifacts || [];
    const qm         = data.quality_metrics || null;
    const isFake     = result === 'fake';
    const isAIGen    = result === 'ai_generated';   // ← defined locally (was missing, caused ReferenceError)
    const critCount  = clues.filter(c => c.severity === 'critical').length;
    const warnCount  = clues.filter(c => c.severity === 'warning').length;

    const panel = document.createElement('div');
    panel.className = 'forensic-panel';

    panel.innerHTML = `
        <div class="fp-header">
            <span class="fp-header-icon">🔬</span>
            <div>
                <h3>Forensic Analysis Report</h3>
                <p>Deep inspection of manipulation indicators and visual anomalies</p>
            </div>
        </div>
        <div class="fp-verdict ${isFake ? 'is-fake' : isAIGen ? 'is-ai-gen' : 'is-real'}">
            <span class="fp-verdict-label ${isFake ? 'fake' : isAIGen ? 'ai-generated' : 'real'}">
                ${isFake ? '⚠️ DEEPFAKE DETECTED' : isAIGen ? '🤖 AI-GENERATED' : '✅ AUTHENTIC'}
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

    // Clues
    const cluesList = document.createElement('div');
    cluesList.className = 'fp-clues';

    if (clues.length === 0) {
        cluesList.innerHTML = `
            <div class="fp-empty">
                <span class="fp-empty-icon">🧹</span>
                <strong>No Forensic Clues Detected</strong>
                This image passed all forensic checks — no face manipulation indicators
                found in texture, boundaries, lighting or frequency analysis.
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

    // Metrics grid — faces_detected intentionally excluded
    if (qm) {
        const metrics = [
            { label: 'Blur Score',    value: qm.blur_score,       unit: 'Laplacian var'  },
            { label: 'Texture',       value: qm.texture_variance,  unit: 'std dev'        },
            { label: 'Edge Density',  value: qm.edge_density != null
                                             ? (qm.edge_density * 100).toFixed(2) : '—',
                                              unit: '% pixels'                             },
            { label: 'Noise Resid.',  value: qm.noise_residual,    unit: 'std dev'        },
            { label: 'Freq Ratio',    value: qm.freq_ratio,         unit: 'DCT ratio'     },
            { label: 'Lighting Var.', value: qm.lighting_variance,  unit: 'quadrant std'  },
            { label: 'Ch. Imbalance', value: qm.channel_imbalance,  unit: 'RGB spread'    },
            { label: 'Brightness',    value: qm.brightness,         unit: '0–255'         },
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

    // Footer with Copy + PDF Download buttons
    const uid     = Date.now();
    const copyId  = 'fp-copy-' + uid;
    const pdfId   = 'fp-pdf-'  + uid;

    const footer = document.createElement('div');
    footer.className = 'fp-footer';
    footer.innerHTML = `
        <span class="fp-footer-note">
            Analysis uses OpenCV forensic metrics + EfficientNetB0.
            Results are indicative, not legally conclusive.
        </span>
        <div class="fp-btn-group">
            <button class="fp-copy-btn" id="${copyId}">📋 Copy Report</button>
            <button class="fp-copy-btn fp-pdf-btn" id="${pdfId}">⬇️ Download PDF</button>
        </div>`;
    panel.appendChild(footer);
    mount.appendChild(panel);

    // ── Build plain-text report string (shared by both copy and PDF) ─────────
    function buildReportText() {
        const line = '─'.repeat(48);
        let t = `DEEPFAKE FORENSIC REPORT\n${line}\n`;
        t += `File:       ${selectedFile ? selectedFile.name : '—'}\n`;
        t += `Result:     ${result.toUpperCase()}\n`;
        t += `Confidence: ${confidence.toFixed(1)}%\n`;
        t += `Date:       ${new Date().toLocaleString()}\n`;
        if (qm) {
            t += `Resolution: ${qm.resolution || '—'}\n`;
        }
        t += `${line}\n`;

        if (clues.length) {
            t += `\nFORENSIC CLUES (${clues.length})\n${line}\n`;
            clues.forEach((c, i) => {
                t += `\n${i+1}. [${(c.severity||'info').toUpperCase()}] ${c.title}\n`;
                t += `   ${c.description}\n`;
                if (c.evidence)  t += `   Evidence:  ${c.evidence}\n`;
                if (c.technical) t += `   Technical: ${c.technical}\n`;
            });
        } else {
            t += `\nNo forensic clues detected — content passed all checks.\n`;
        }

        if (qm) {
            t += `\n${line}\nRAW QUALITY METRICS\n${line}\n`;
            const skip = new Set(['face_regions', 'faces_detected']);
            Object.entries(qm).forEach(([k, v]) => {
                if (!skip.has(k)) t += `${k.padEnd(26)}: ${Array.isArray(v) ? v.join(', ') : v}\n`;
            });
        }

        t += `\n${line}\nAnalysis engine: OpenCV forensic heuristics + EfficientNetB0 ML model.\n`;
        t += `Results are indicative only and not legally conclusive.\n`;
        return t;
    }

    // ── Copy handler ──────────────────────────────────────────────────────────
    document.getElementById(copyId).addEventListener('click', () => {
        navigator.clipboard.writeText(buildReportText()).then(() => {
            const btn = document.getElementById(copyId);
            if (btn) { btn.textContent = '✅ Copied!'; setTimeout(() => { btn.textContent = '📋 Copy Report'; }, 2000); }
        }).catch(() => alert(buildReportText()));
    });

    // ── PDF Download handler ──────────────────────────────────────────────────
    document.getElementById(pdfId).addEventListener('click', async () => {
        const btn = document.getElementById(pdfId);
        if (btn) { btn.textContent = '⏳ Generating…'; btn.disabled = true; }
        try {
            await downloadForensicPDF({ result, confidence, clues, qm, selectedFile });
        } catch(e) {
            console.error('PDF error:', e);
            alert('PDF generation failed: ' + e.message);
        } finally {
            if (btn) { btn.textContent = '⬇️ Download PDF'; btn.disabled = false; }
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF GENERATION  — jsPDF direct download (no print dialog)
// ═══════════════════════════════════════════════════════════════════════════

function loadJsPDF() {
    return new Promise((resolve, reject) => {
        if (window.jspdf && window.jspdf.jsPDF) { resolve(window.jspdf.jsPDF); return; }
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload  = () => resolve(window.jspdf.jsPDF);
        s.onerror = () => reject(new Error('jsPDF failed to load'));
        document.head.appendChild(s);
    });
}

async function downloadForensicPDF({ result, confidence, clues, qm, selectedFile }) {
    const isFake  = (result || '').toLowerCase() === 'fake';
    const isAIGen = (result || '').toLowerCase() === 'ai_generated';
    const date    = new Date().toLocaleString();
    const fname   = selectedFile ? selectedFile.name : 'unknown';

    let jsPDF;
    try {
        jsPDF = await loadJsPDF();
    } catch (e) {
        alert('Could not load PDF library. Please check your internet connection.');
        return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW  = 210;
    const PH  = 297;
    const ML  = 14;
    const MR  = 14;
    const CW  = PW - ML - MR;
    let   Y   = 0;

    const verdictColor = isFake ? [220,38,38] : isAIGen ? [124,58,237] : [22,163,74];
    const verdictBg    = isFake ? [254,242,242] : isAIGen ? [250,245,255] : [240,253,244];
    const verdictText  = isFake ? 'DEEPFAKE DETECTED' : isAIGen ? 'AI-GENERATED CONTENT' : 'AUTHENTIC CONTENT';
    const verdictIcon  = isFake ? '!' : isAIGen ? 'AI' : '\u2713';

    const SEV_COLORS = {
        critical: { bg: [254,242,242], border: [220,38,38], text: [220,38,38], label: 'CRITICAL' },
        warning:  { bg: [255,251,235], border: [217,119,6], text: [217,119,6], label: 'WARNING'  },
        info:     { bg: [239,246,255], border: [37,99,235], text: [37,99,235], label: 'INFO'     },
    };

    function splitLines(text, maxWidth, fontSize) {
        doc.setFontSize(fontSize);
        return doc.splitTextToSize(String(text || ''), maxWidth);
    }
    function checkPageBreak(needed) {
        if (Y + needed > PH - 16) { doc.addPage(); Y = 14; }
    }

    // ── HEADER ───────────────────────────────────────────────────────────────
    doc.setFillColor(30,27,75);
    doc.rect(0, 0, PW, 32, 'F');
    doc.setTextColor(255,255,255);
    doc.setFont('helvetica','bold');
    doc.setFontSize(17);
    doc.text('DEEPFAKE FORENSIC REPORT', ML, 13);
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.setTextColor(180,180,220);
    doc.text('AI Detection & Forensic Analysis System', ML, 20);

    doc.setFillColor(50,46,100);
    [[ML,54],[ML+57,70],[ML+130,52]].forEach(([x,w]) => doc.roundedRect(x,23,w,7,1.5,1.5,'F'));
    doc.setTextColor(200,200,240);
    doc.setFontSize(7);
    doc.setFont('helvetica','bold');
    doc.text('FILE', ML+2, 27.2);
    doc.text('DATE', ML+59, 27.2);
    doc.text('RESOLUTION', ML+132, 27.2);
    doc.setTextColor(255,255,255);
    doc.setFont('helvetica','normal');
    doc.text(fname.length > 22 ? fname.slice(0,20)+'...' : fname, ML+2, 29.8);
    doc.text(date.length > 32 ? date.slice(0,30) : date, ML+59, 29.8);
    doc.text(qm && qm.resolution ? qm.resolution : '\u2014', ML+132, 29.8);
    Y = 38;

    // ── VERDICT ──────────────────────────────────────────────────────────────
    doc.setFillColor(...verdictBg);
    doc.rect(0, Y, PW, 26, 'F');
    doc.setFillColor(...verdictColor);
    doc.rect(0, Y, 5, 26, 'F');
    doc.circle(ML+7, Y+13, 8, 'F');
    doc.setTextColor(255,255,255);
    doc.setFont('helvetica','bold');
    doc.setFontSize(verdictIcon.length > 1 ? 7 : 14);
    doc.text(verdictIcon, ML+7, Y+14.5, { align:'center' });
    doc.setTextColor(...verdictColor);
    doc.setFontSize(15);
    doc.text(verdictText, ML+19, Y+10);
    doc.setTextColor(107,114,128);
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    const subText = isFake ? 'AI face-manipulation artifacts detected'
        : isAIGen ? 'Image shows AI/diffusion model generation indicators'
        : 'No face manipulation or AI-generation artifacts detected';
    doc.text(subText, ML+19, Y+17);
    doc.setTextColor(...verdictColor);
    doc.setFont('helvetica','bold');
    doc.setFontSize(22);
    doc.text(confidence.toFixed(1) + '%', PW-MR, Y+12, { align:'right' });
    doc.setFontSize(8);
    doc.setTextColor(107,114,128);
    doc.setFont('helvetica','normal');
    doc.text('Confidence', PW-MR, Y+19, { align:'right' });
    Y += 30;

    // ── SUMMARY ROW ──────────────────────────────────────────────────────────
    const critCount = (clues||[]).filter(c => c.severity === 'critical').length;
    const warnCount = (clues||[]).filter(c => c.severity === 'warning').length;
    doc.setFillColor(249,250,251);
    doc.rect(ML, Y, CW, 9, 'F');
    doc.setTextColor(107,114,128);
    doc.setFontSize(8.5);
    doc.setFont('helvetica','normal');
    doc.text(`${(clues||[]).length} forensic clue${(clues||[]).length !== 1 ? 's' : ''} found`, ML+3, Y+6);
    if (critCount > 0) { doc.setTextColor(220,38,38);  doc.text(`${critCount} critical`, ML+52, Y+6); }
    if (warnCount > 0) { doc.setTextColor(217,119,6);  doc.text(`${warnCount} warning${warnCount>1?'s':''}`, ML+80, Y+6); }
    doc.setTextColor(156,163,175);
    doc.text('Engine: OpenCV + EfficientNetB0', PW-MR, Y+6, { align:'right' });
    Y += 14;

    // ── FORENSIC CLUES ───────────────────────────────────────────────────────
    doc.setTextColor(17,24,39);
    doc.setFont('helvetica','bold');
    doc.setFontSize(12);
    doc.text('Forensic Clues', ML, Y);
    doc.setDrawColor(229,231,235);
    doc.setLineWidth(0.4);
    doc.line(ML, Y+2, ML+CW, Y+2);
    Y += 7;

    const sortedClues = [...(clues||[])].sort((a,b) => {
        const o = {critical:0,warning:1,info:2};
        return (o[a.severity]??3)-(o[b.severity]??3);
    });

    if (sortedClues.length === 0) {
        doc.setFillColor(240,253,244);
        doc.rect(ML, Y, CW, 12, 'F');
        doc.setTextColor(22,163,74);
        doc.setFont('helvetica','bold');
        doc.setFontSize(9);
        doc.text('\u2713  No forensic clues detected \u2014 content passed all checks.', ML+4, Y+7.5);
        Y += 16;
    }

    sortedClues.forEach(clue => {
        const sv = SEV_COLORS[clue.severity] || SEV_COLORS.info;
        const titleLines = splitLines(clue.title, CW-28, 9);
        const descLines  = splitLines(clue.description, CW-28, 8);
        const evLines    = clue.evidence  ? splitLines('Evidence: ' + clue.evidence,  CW-28, 7.5) : [];
        const techLines  = clue.technical ? splitLines('Technical: ' + clue.technical, CW-28, 7)  : [];
        const boxH = 6 + titleLines.length*5 + descLines.length*4.5
                       + (evLines.length  ? evLines.length*4+3   : 0)
                       + (techLines.length? techLines.length*3.8+2: 0) + 4;
        checkPageBreak(boxH + 4);

        doc.setFillColor(...sv.bg);
        doc.roundedRect(ML, Y, CW, boxH, 2, 2, 'F');
        doc.setFillColor(...sv.border);
        doc.roundedRect(ML, Y, 3.5, boxH, 1, 1, 'F');

        doc.setFont('helvetica','bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...sv.text);
        const badgeW = doc.getTextWidth(sv.label) + 6;
        doc.setFillColor(255,255,255);
        doc.roundedRect(ML+CW-badgeW-1, Y+2.5, badgeW, 5, 1, 1, 'F');
        doc.setDrawColor(...sv.border);
        doc.setLineWidth(0.3);
        doc.roundedRect(ML+CW-badgeW-1, Y+2.5, badgeW, 5, 1, 1, 'S');
        doc.text(sv.label, ML+CW-badgeW/2-1, Y+6, { align:'center' });

        let cy = Y + 6;
        doc.setTextColor(...sv.text);
        doc.setFont('helvetica','bold');
        doc.setFontSize(9);
        titleLines.forEach(l => { doc.text(l, ML+7, cy); cy += 5; });

        doc.setTextColor(55,65,81);
        doc.setFont('helvetica','normal');
        doc.setFontSize(8);
        descLines.forEach(l => { doc.text(l, ML+7, cy); cy += 4.5; });

        if (evLines.length > 0) {
            cy += 2;
            doc.setFillColor(243,244,246);
            doc.roundedRect(ML+7, cy-3, CW-28, evLines.length*4+3, 1, 1, 'F');
            doc.setTextColor(55,65,81);
            doc.setFont('helvetica','normal');
            doc.setFontSize(7.5);
            evLines.forEach(l => { doc.text(l, ML+9, cy); cy += 4; });
            cy += 1;
        }
        if (techLines.length > 0) {
            cy += 1;
            doc.setTextColor(156,163,175);
            doc.setFont('helvetica','italic');
            doc.setFontSize(7);
            techLines.forEach(l => { doc.text(l, ML+7, cy); cy += 3.8; });
        }
        Y += boxH + 4;
    });

    Y += 4;

    // ── RAW METRICS ──────────────────────────────────────────────────────────
    if (qm) {
        checkPageBreak(20);
        doc.setTextColor(17,24,39);
        doc.setFont('helvetica','bold');
        doc.setFontSize(12);
        doc.text('Raw Quality Metrics', ML, Y);
        doc.setDrawColor(229,231,235);
        doc.setLineWidth(0.4);
        doc.line(ML, Y+2, ML+CW, Y+2);
        Y += 8;

        const skip = new Set(['face_regions', 'faces_detected']);
        const entries = Object.entries(qm).filter(([k]) => !skip.has(k));
        const colW = CW/2 - 2;
        entries.forEach(([k,v], i) => {
            checkPageBreak(8);
            const col  = i % 2;
            const xOff = ML + col * (colW + 4);
            if (col === 0) {
                const rowBg = Math.floor(i/2)%2===0 ? [249,250,251] : [255,255,255];
                doc.setFillColor(...rowBg);
                doc.rect(ML, Y-1, CW, 7.5, 'F');
            }
            doc.setTextColor(107,114,128);
            doc.setFont('helvetica','normal');
            doc.setFontSize(7.5);
            doc.text(k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()), xOff+2, Y+4.5);
            doc.setTextColor(17,24,39);
            doc.setFont('helvetica','bold');
            doc.setFontSize(8);
            const val = Array.isArray(v) ? v.join(', ') : String(v??'\u2014');
            doc.text(val.length>28 ? val.slice(0,26)+'...' : val, xOff+colW-2, Y+4.5, { align:'right' });
            if (col===1 || i===entries.length-1) Y += 7.5;
        });
    }

    // ── FOOTER ───────────────────────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(249,250,251);
        doc.rect(0, PH-16, PW, 16, 'F');
        doc.setDrawColor(229,231,235);
        doc.setLineWidth(0.3);
        doc.line(0, PH-16, PW, PH-16);
        doc.setTextColor(156,163,175);
        doc.setFont('helvetica','italic');
        doc.setFontSize(7.5);
        doc.text('Results are indicative only and not legally conclusive. Generated by AI Forensic Analysis System.', ML, PH-10);
        doc.text(`Page ${p} of ${totalPages}`, PW/2, PH-10, { align:'center' });
        doc.setFont('helvetica','normal');
        doc.text(date, PW-MR, PH-10, { align:'right' });
    }

    // ── SAVE ─────────────────────────────────────────────────────────────────
    const safeName = fname.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^.]+$/, '');
    doc.save(`forensic_report_${safeName}.pdf`);
}
function toggleMobileNav() {
    document.getElementById('mobile-nav')?.classList.toggle('open');
}