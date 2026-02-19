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

let selectedFile   = null;
let currentType    = 'image';

// Check URL parameters
const urlParams = new URLSearchParams(window.location.search);
const typeParam = urlParams.get('type');
if (typeParam === 'video') {
    document.querySelector('.tab-btn[data-type="video"]')?.click();
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentType = btn.dataset.type;
        
        if (currentType === 'image') {
            fileInput.accept = 'image/*';
            document.getElementById('file-types').textContent = 'Supported: JPG, PNG, GIF, BMP';
        } else {
            fileInput.accept = 'video/*';
            document.getElementById('file-types').textContent = 'Supported: MP4, AVI, MOV, MKV';
        }
        resetUpload();
    });
});

// Drag and drop
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
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (currentType === 'image' && !isImage) {
        Toast.error('Please select an image file');
        return;
    }
    if (currentType === 'video' && !isVideo) {
        Toast.error('Please select a video file');
        return;
    }
    if (file.size > 100 * 1024 * 1024) {
        Toast.error('File size must be under 100 MB');
        return;
    }

    selectedFile = file;
    showFilePreview(file);
}

function showFilePreview(file) {
    uploadArea.style.display  = 'none';
    filePreview.style.display = 'block';

    const reader = new FileReader();
    reader.onload = e => {
        if (file.type.startsWith('image/')) {
            imagePreview.src          = e.target.result;
            imagePreview.style.display = 'block';
            videoPreview.style.display = 'none';
        } else {
            videoPreview.src          = e.target.result;
            videoPreview.style.display = 'block';
            imagePreview.style.display = 'none';
        }
    };
    reader.readAsDataURL(file);

    const mb = (file.size / 1024 / 1024).toFixed(2);
    fileInfo.innerHTML = `
        <p><strong>File:</strong> ${file.name}</p>
        <p><strong>Size:</strong> ${mb} MB</p>
        <p><strong>Type:</strong> ${file.type || 'unknown'}</p>
    `;
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

async function analyzeFile() {
    if (!selectedFile) {
        Toast.error('Please select a file first');
        return;
    }

    filePreview.style.display     = 'none';
    progressSection.style.display = 'block';

    try {
        const endpoint = currentType === 'image'
            ? API_CONFIG.ENDPOINTS.UPLOAD_IMAGE
            : API_CONFIG.ENDPOINTS.UPLOAD_VIDEO;

        const url = `${API_CONFIG.BASE_URL}${endpoint}`;
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', selectedFile);

        xhr.upload.addEventListener('progress', e => {
            if (e.lengthComputable) {
                const pct = (e.loaded / e.total) * 80;
                setProgress(pct, 'Uploading…');
            }
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
            } catch(err) {
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

    } catch (err) {
        progressSection.style.display = 'none';
        filePreview.style.display     = 'block';
        Toast.error(err.message || 'Analysis failed');
    }
}

function setProgress(pct, msg) {
    document.getElementById('progress-fill').style.width = `${Math.round(pct)}%`;
    document.getElementById('progress-text').textContent = `${msg} ${Math.round(pct)}%`;
}

// ═══════════════════════════════════════════════════════════════════════
// RESULTS DISPLAY WITH PROFESSIONAL GAUGES
// ═══════════════════════════════════════════════════════════════════════

function showResults(data) {
    progressSection.style.display = 'none';
    resultsSection.style.display  = 'block';

    const isFake = data.result.toLowerCase() === 'fake';
    const conf   = parseFloat(data.confidence);
    const quality = data.quality_metrics || {};
    const artifacts = data.artifacts || [];

    // Status header
    const resultStatus = document.getElementById('result-status');
    resultStatus.className = 'result-status ' + (isFake ? 'fake' : 'real');
    resultStatus.innerHTML = `
        <div class="status-icon">${isFake ? '⚠️' : '✅'}</div>
        <h3>${isFake ? 'DEEPFAKE DETECTED' : 'AUTHENTIC CONTENT'}</h3>
    `;

    // ★ CHOOSE YOUR GAUGE STYLE HERE ★
    // Uncomment ONE of these lines:
    
    const gaugeHtml = createGaugeStyle1(conf, isFake);  // Simple modern
    // const gaugeHtml = createGaugeStyle2(conf, isFake);  // Semi-circle speedometer
    // const gaugeHtml = createGaugeStyle3(conf, isFake);  // Multi-ring with glow
    // const gaugeHtml = createGaugeStyle4(conf, isFake);  // Temperature gauge style

    document.getElementById('confidence-gauge').innerHTML = gaugeHtml;

    // Quality metrics
    const metricsHtml = quality.blur_score ? `
        <div class="metrics-grid">
            <div class="metric-item">
                <span class="metric-label">File Name</span>
                <span class="metric-value">${selectedFile.name}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">File Size</span>
                <span class="metric-value">${quality.file_size_mb} MB</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">Faces Detected</span>
                <span class="metric-value">${quality.faces_detected}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">Processing Time</span>
                <span class="metric-value">${data.processing_time}s</span>
            </div>
        </div>
        
        <div class="quality-section">
            <h4>📊 Quality Metrics</h4>
            <div class="quality-bar-item">
                <div class="quality-bar-header">
                    <span>Blur Score: ${quality.blur_score}</span>
                    ${quality.blur_score < 100 ? '<span class="warning-icon">▲</span>' : ''}
                </div>
                ${quality.blur_score < 100 ? '<p class="quality-warning">⚠️ Image appears blurry, may affect accuracy</p>' : ''}
            </div>
            <div class="quality-bar-item">
                <div class="quality-bar-header">
                    <span>Brightness: ${quality.brightness}</span>
                    ${quality.brightness > 200 || quality.brightness < 50 ? '<span class="warning-icon">▲</span>' : ''}
                </div>
            </div>
        </div>
    ` : '';

    document.getElementById('quality-metrics').innerHTML = metricsHtml;

    // Artifacts detected
    const artifactsHtml = artifacts.length > 0 ? `
        <div class="artifacts-section">
            <h4>🔍 Detected Issues</h4>
            <div class="artifacts-list">
                ${artifacts.map(a => `
                    <div class="artifact-item ${a.severity}">
                        <div class="artifact-header">
                            <span class="artifact-icon">${getSeverityIcon(a.severity)}</span>
                            <strong>${a.title}</strong>
                        </div>
                        <p>${a.description}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';

    document.getElementById('artifacts-container').innerHTML = artifactsHtml;

    // Demo banner
    const demoBanner = document.getElementById('demo-banner');
    if (demoBanner) {
        demoBanner.style.display = data.is_demo ? 'block' : 'none';
    }

    const detailLink = document.getElementById('detail-link');
    if (detailLink && data.detection_id) {
        detailLink.href = `results.html?id=${data.detection_id}`;
        detailLink.style.display = 'inline-block';
    }

    if (data.is_demo) {
        Toast.warning('Running in demo mode - results are random');
    } else {
        Toast.success('Analysis complete!');
    }
}

// ═══════════════════════════════════════════════════════════════════════
// GAUGE STYLE 1: Modern Circular (Simple & Clean)
// ═══════════════════════════════════════════════════════════════════════

function createGaugeStyle1(confidence, isFake) {
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (confidence / 100) * circumference;
    const color = isFake ? '#f43f5e' : '#10b981';

    return `
        <div class="gauge-container" style="padding: 2rem; text-align: center;">
            <svg width="200" height="200" viewBox="0 0 200 200" style="filter: drop-shadow(0 4px 12px rgba(0,0,0,.12));">
                <!-- Background circle -->
                <circle cx="100" cy="100" r="${radius}" 
                        fill="none" stroke="#e5e7eb" stroke-width="14"/>
                        
                <!-- Progress circle -->
                <circle cx="100" cy="100" r="${radius}" 
                        fill="none" stroke="${color}" stroke-width="14"
                        stroke-dasharray="${circumference}" 
                        stroke-dashoffset="${offset}"
                        stroke-linecap="round" 
                        transform="rotate(-90 100 100)"
                        style="transition: stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)"/>
                        
                <!-- Inner glow -->
                <circle cx="100" cy="100" r="58" fill="${color}" opacity="0.08"/>
                
                <!-- Center text -->
                <text x="100" y="95" text-anchor="middle" 
                      font-size="40" font-weight="800" fill="${color}">
                    ${Math.round(confidence)}
                </text>
                <text x="122" y="85" text-anchor="middle" 
                      font-size="18" font-weight="600" fill="${color}">%</text>
                <text x="100" y="118" text-anchor="middle" 
                      font-size="13" font-weight="600" fill="#6b7280" letter-spacing="1">
                    CONFIDENCE
                </text>
            </svg>
            <div style="margin-top: 1rem; font-size: 0.95rem; font-weight: 600; color: ${color};">
                ${getConfidenceLabel(confidence)}
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════════════
// GAUGE STYLE 2: Semi-Circle Speedometer
// ═══════════════════════════════════════════════════════════════════════

function createGaugeStyle2(confidence, isFake) {
    const radius = 80;
    const circumference = Math.PI * radius;
    const offset = circumference - (confidence / 100) * circumference;
    
    // Gradient color based on confidence
    let color, colorName;
    if (confidence < 50) { color = '#10b981'; colorName = 'LOW RISK'; }
    else if (confidence < 75) { color = '#f59e0b'; colorName = 'MODERATE'; }
    else { color = '#f43f5e'; colorName = 'HIGH RISK'; }

    const angle = -90 + (confidence / 100) * 180;

    return `
        <div class="gauge-container" style="padding: 2rem; text-align: center;">
            <svg width="240" height="150" viewBox="0 0 240 150">
                <defs>
                    <linearGradient id="speedoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style="stop-color:#10b981"/>
                        <stop offset="50%" style="stop-color:#f59e0b"/>
                        <stop offset="100%" style="stop-color:#f43f5e"/>
                    </linearGradient>
                </defs>
                
                <!-- Background arc -->
                <path d="M 40 120 A 80 80 0 0 1 200 120" 
                      fill="none" stroke="#e5e7eb" stroke-width="18" stroke-linecap="round"/>
                
                <!-- Colored sections -->
                <path d="M 40 120 A 80 80 0 0 1 200 120" 
                      fill="none" stroke="url(#speedoGrad)" stroke-width="18" 
                      stroke-linecap="round" opacity="0.5"/>
                      
                <!-- Progress arc -->
                <path d="M 40 120 A 80 80 0 0 1 200 120" 
                      fill="none" stroke="${color}" stroke-width="18" 
                      stroke-linecap="round"
                      stroke-dasharray="${circumference}" 
                      stroke-dashoffset="${offset}"
                      style="transition: stroke-dashoffset 1.2s ease-out"/>
                      
                <!-- Needle -->
                <line x1="120" y1="120" x2="120" y2="50" 
                      stroke="${color}" stroke-width="4" stroke-linecap="round"
                      transform="rotate(${angle} 120 120)"
                      style="transition: transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)"/>
                      
                <!-- Center hub -->
                <circle cx="120" cy="120" r="10" fill="${color}"/>
                <circle cx="120" cy="120" r="6" fill="white"/>
                
                <!-- Labels -->
                <text x="40" y="140" font-size="11" fill="#9ca3af" font-weight="600">0%</text>
                <text x="115" y="42" text-anchor="middle" font-size="11" fill="#9ca3af" font-weight="600">50%</text>
                <text x="190" y="140" font-size="11" fill="#9ca3af" font-weight="600">100%</text>
                
                <!-- Center value -->
                <text x="120" y="108" text-anchor="middle" 
                      font-size="32" font-weight="800" fill="${color}">
                    ${Math.round(confidence)}%
                </text>
            </svg>
            <div style="margin-top: 0.5rem; font-size: 0.9rem; font-weight: 700; color: ${color}; letter-spacing: 0.5px;">
                ${colorName}
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════════════
// GAUGE STYLE 3: Multi-Ring with Glow Effect
// ═══════════════════════════════════════════════════════════════════════

function createGaugeStyle3(confidence, isFake) {
    const color = isFake ? '#f43f5e' : '#10b981';
    const circumference = 2 * Math.PI * 65;
    const offset = circumference - (confidence / 100) * circumference;

    return `
        <div class="gauge-container" style="padding: 2rem; text-align: center;">
            <svg width="220" height="220" viewBox="0 0 220 220">
                <defs>
                    <filter id="glow-effect">
                        <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:${color};stop-opacity:1"/>
                        <stop offset="100%" style="stop-color:${color};stop-opacity:0.6"/>
                    </linearGradient>
                </defs>
                
                <!-- Outer decorative rings -->
                <circle cx="110" cy="110" r="100" fill="none" stroke="#f3f4f6" stroke-width="1.5"/>
                <circle cx="110" cy="110" r="94" fill="none" stroke="#f3f4f6" stroke-width="1"/>
                
                <!-- Main background -->
                <circle cx="110" cy="110" r="65" fill="none" stroke="#e5e7eb" stroke-width="16"/>
                
                <!-- Progress ring with gradient and glow -->
                <circle cx="110" cy="110" r="65" 
                        fill="none" stroke="url(#ringGrad)" stroke-width="16"
                        stroke-dasharray="${circumference}" 
                        stroke-dashoffset="${offset}"
                        stroke-linecap="round" 
                        transform="rotate(-90 110 110)"
                        filter="url(#glow-effect)"
                        style="transition: stroke-dashoffset 1.3s cubic-bezier(0.34, 1.56, 0.64, 1)"/>
                
                <!-- Inner decorative circle -->
                <circle cx="110" cy="110" r="50" fill="#fafafa"/>
                <circle cx="110" cy="110" r="46" fill="white" stroke="#f3f4f6" stroke-width="1"/>
                
                <!-- Percentage -->
                <text x="110" y="108" text-anchor="middle" 
                      font-size="38" font-weight="900" fill="${color}">
                    ${Math.round(confidence)}
                </text>
                <text x="134" y="98" font-size="16" font-weight="700" fill="${color}">%</text>
                
                <!-- Icon -->
                <text x="110" y="135" text-anchor="middle" font-size="22">
                    ${isFake ? '⚠️' : '✅'}
                </text>
            </svg>
            <div style="margin-top: 1rem;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #9ca3af; letter-spacing: 1.5px;">
                    DETECTION CONFIDENCE
                </div>
                <div style="margin-top: 0.3rem; font-size: 0.95rem; font-weight: 700; color: ${color};">
                    ${getConfidenceLabel(confidence)}
                </div>
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════════════
// GAUGE STYLE 4: Temperature/Thermometer Style
// ═══════════════════════════════════════════════════════════════════════

function createGaugeStyle4(confidence, isFake) {
    const colors = [
        { threshold: 0,  color: '#10b981', label: 'SAFE' },
        { threshold: 40, color: '#84cc16', label: 'LOW' },
        { threshold: 60, color: '#f59e0b', label: 'MODERATE' },
        { threshold: 80, color: '#f97316', label: 'HIGH' },
        { threshold: 90, color: '#f43f5e', label: 'CRITICAL' }
    ];
    
    const currentLevel = colors.reverse().find(c => confidence >= c.threshold);
    const color = currentLevel.color;
    const height = (confidence / 100) * 140;

    return `
        <div class="gauge-container" style="padding: 2rem; text-align: center;">
            <div style="display: flex; justify-content: center; gap: 2rem; align-items: center;">
                <!-- Thermometer -->
                <svg width="60" height="180" viewBox="0 0 60 180">
                    <!-- Background bar -->
                    <rect x="18" y="10" width="24" height="145" rx="12" 
                          fill="#e5e7eb" stroke="#d1d5db" stroke-width="1"/>
                    
                    <!-- Filled portion (animated) -->
                    <rect x="18" y="${155 - height}" width="24" height="${height}" rx="12"
                          fill="${color}"
                          style="transition: height 1.2s ease-out, y 1.2s ease-out"/>
                    
                    <!-- Bulb at bottom -->
                    <circle cx="30" cy="165" r="15" fill="${color}"/>
                    <circle cx="30" cy="165" r="12" fill="${color}" opacity="0.8"/>
                    
                    <!-- Tick marks -->
                    ${[0, 25, 50, 75, 100].map(val => {
                        const y = 155 - (val / 100) * 140;
                        return `
                            <line x1="42" y1="${y}" x2="48" y2="${y}" 
                                  stroke="#9ca3af" stroke-width="2"/>
                            <text x="52" y="${y + 4}" font-size="10" fill="#6b7280">${val}</text>
                        `;
                    }).join('')}
                </svg>
                
                <!-- Info panel -->
                <div style="text-align: left;">
                    <div style="font-size: 0.75rem; font-weight: 600; color: #9ca3af; letter-spacing: 1px;">
                        THREAT LEVEL
                    </div>
                    <div style="font-size: 3rem; font-weight: 900; color: ${color}; line-height: 1; margin: 0.5rem 0;">
                        ${Math.round(confidence)}%
                    </div>
                    <div style="display: inline-block; padding: 0.4rem 1rem; background: ${color}; color: white; 
                                border-radius: 6px; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.5px;">
                        ${currentLevel.label}
                    </div>
                    <div style="margin-top: 1rem; font-size: 0.85rem; color: #6b7280; max-width: 180px;">
                        ${isFake ? 
                            'High probability of manipulation detected' : 
                            'Content appears authentic with no significant artifacts'}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

function getConfidenceLabel(confidence) {
    if (confidence >= 95) return 'VERY HIGH CONFIDENCE';
    if (confidence >= 85) return 'HIGH CONFIDENCE';
    if (confidence >= 70) return 'MODERATE CONFIDENCE';
    if (confidence >= 55) return 'LOW CONFIDENCE';
    return 'VERY LOW CONFIDENCE';
}

function getSeverityIcon(severity) {
    const icons = {
        'critical': '🔴',
        'warning': '🟠',
        'info': '🔵'
    };
    return icons[severity] || '⚪';
}

function toggleMobileNav() {
    document.getElementById('mobile-nav')?.classList.toggle('open');
}
