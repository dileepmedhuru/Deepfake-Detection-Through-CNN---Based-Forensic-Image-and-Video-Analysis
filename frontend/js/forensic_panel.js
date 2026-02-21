/**
 * forensic_panel.js
 * ─────────────────
 * Forensic Analysis Report UI Module
 * Drop this file into frontend/js/ and add:
 *   <script src="js/forensic_panel.js"></script>
 * to upload.html (before upload.js)
 *
 * Then call:  ForensicPanel.render(data, containerId)
 * where data is the full API response from /api/detection/upload-image
 */

const ForensicPanel = (() => {

    // ── severity config ───────────────────────────────────────────────────
    const SEV = {
        critical: { label: 'Critical',   color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: '🔴' },
        warning:  { label: 'Warning',    color: '#d97706', bg: '#fffbeb', border: '#fde68a', dot: '🟡' },
        info:     { label: 'Info',       color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', dot: '🔵' },
    };

    // ── CSS injected once ─────────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('forensic-styles')) return;
        const css = `
/* ═══════════════════════════════════════════════════════
   FORENSIC PANEL STYLES
   ═══════════════════════════════════════════════════════ */

.forensic-panel {
    margin-top: 28px;
    border-radius: 16px;
    overflow: hidden;
    border: 1.5px solid #e5e7eb;
    box-shadow: 0 4px 24px rgba(0,0,0,0.07);
    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
}

.forensic-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 24px;
    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
    color: #fff;
}

.forensic-header-icon {
    font-size: 28px;
    flex-shrink: 0;
}

.forensic-header-text h3 {
    margin: 0 0 2px;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.3px;
}

.forensic-header-text p {
    margin: 0;
    font-size: 13px;
    opacity: 0.75;
}

.forensic-verdict-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 24px;
    border-bottom: 1px solid #e5e7eb;
}

.forensic-verdict-bar.fake-verdict {
    background: linear-gradient(90deg, #fef2f2 0%, #fff5f5 100%);
}

.forensic-verdict-bar.real-verdict {
    background: linear-gradient(90deg, #f0fdf4 0%, #f8fff9 100%);
}

.fvb-result {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.5px;
}

.fvb-result.fake { color: #dc2626; }
.fvb-result.real { color: #16a34a; }

.fvb-confidence {
    font-size: 14px;
    color: #6b7280;
}

.fvb-summary {
    margin-left: auto;
    font-size: 13px;
    color: #374151;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 6px 14px;
}

.forensic-clues-list {
    padding: 16px 20px;
    background: #fff;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.forensic-clue {
    border-radius: 12px;
    border: 1.5px solid;
    overflow: hidden;
    transition: box-shadow 0.2s;
}

.forensic-clue:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}

.forensic-clue-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    cursor: pointer;
    user-select: none;
}

.forensic-clue-icon {
    font-size: 20px;
    flex-shrink: 0;
}

.forensic-clue-title-block {
    flex: 1;
}

.forensic-clue-title {
    font-size: 14px;
    font-weight: 700;
    margin: 0 0 2px;
}

.forensic-clue-description {
    font-size: 13px;
    color: #6b7280;
    margin: 0;
    line-height: 1.45;
}

.forensic-clue-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 99px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex-shrink: 0;
}

.forensic-clue-toggle {
    font-size: 13px;
    opacity: 0.5;
    transition: transform 0.2s;
    flex-shrink: 0;
}

.forensic-clue.expanded .forensic-clue-toggle {
    transform: rotate(180deg);
}

.forensic-clue-detail {
    display: none;
    padding: 0 16px 14px 16px;
    border-top: 1px solid;
    margin-top: -1px;
}

.forensic-clue.expanded .forensic-clue-detail {
    display: block;
}

.forensic-evidence-tag {
    display: inline-block;
    font-size: 12px;
    font-family: 'Courier New', monospace;
    padding: 4px 10px;
    border-radius: 6px;
    background: #f3f4f6;
    color: #374151;
    margin: 8px 0 6px;
    border: 1px solid #e5e7eb;
}

.forensic-technical {
    font-size: 12px;
    color: #9ca3af;
    font-style: italic;
    line-height: 1.5;
    margin-top: 4px;
}

.forensic-empty {
    text-align: center;
    padding: 32px;
    color: #6b7280;
}

.forensic-empty .fe-icon { font-size: 36px; display: block; margin-bottom: 10px; }
.forensic-empty strong { display: block; font-size: 15px; color: #374151; margin-bottom: 4px; }

.forensic-metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 10px;
    padding: 16px 20px;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
}

.forensic-metric-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 12px 14px;
}

.fmc-label {
    font-size: 11px;
    color: #9ca3af;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
}

.fmc-value {
    font-size: 18px;
    font-weight: 800;
    color: #111827;
    line-height: 1.1;
}

.fmc-unit {
    font-size: 11px;
    color: #9ca3af;
    font-weight: 400;
    margin-top: 2px;
}

.forensic-footer {
    padding: 10px 20px;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.forensic-footer-note {
    font-size: 11px;
    color: #9ca3af;
    font-style: italic;
}

.forensic-copy-btn {
    font-size: 12px;
    color: #6366f1;
    background: none;
    border: 1px solid #c7d2fe;
    border-radius: 6px;
    padding: 4px 12px;
    cursor: pointer;
    transition: background 0.15s;
}

.forensic-copy-btn:hover { background: #eff0ff; }

/* ── Dark mode ─────────────────────────────────────────────── */
[data-theme="dark"] .forensic-panel { border-color: #374151; }
[data-theme="dark"] .forensic-clues-list { background: #1e293b; }
[data-theme="dark"] .forensic-clue-description { color: #94a3b8; }
[data-theme="dark"] .forensic-evidence-tag { background: #374151; color: #e2e8f0; border-color: #475569; }
[data-theme="dark"] .forensic-technical { color: #64748b; }
[data-theme="dark"] .forensic-metrics-grid { background: #0f172a; }
[data-theme="dark"] .forensic-metric-card { background: #1e293b; border-color: #374151; }
[data-theme="dark"] .fmc-value { color: #f1f5f9; }
[data-theme="dark"] .fmc-label, [data-theme="dark"] .fmc-unit { color: #64748b; }
[data-theme="dark"] .forensic-footer { background: #0f172a; border-color: #374151; }
[data-theme="dark"] .forensic-footer-note { color: #64748b; }
[data-theme="dark"] .fvb-summary { background: #1e293b; border-color: #374151; color: #e2e8f0; }
[data-theme="dark"] .forensic-empty { color: #64748b; }
[data-theme="dark"] .forensic-empty strong { color: #94a3b8; }
[data-theme="dark"] .forensic-verdict-bar.fake-verdict { background: linear-gradient(90deg, #1c0d0d 0%, #1a0f0f 100%); }
[data-theme="dark"] .forensic-verdict-bar.real-verdict { background: linear-gradient(90deg, #0c1a10 0%, #0f1c13 100%); }
`;
        const el = document.createElement('style');
        el.id = 'forensic-styles';
        el.textContent = css;
        document.head.appendChild(el);
    }

    // ── Build a single clue card ──────────────────────────────────────────
    function buildClueCard(clue) {
        const sev = SEV[clue.severity] || SEV.info;
        const card = document.createElement('div');
        card.className = 'forensic-clue';
        card.style.borderColor = sev.border;
        card.style.background  = sev.bg;

        card.innerHTML = `
          <div class="forensic-clue-header">
            <span class="forensic-clue-icon">${clue.icon || '🔍'}</span>
            <div class="forensic-clue-title-block">
              <p class="forensic-clue-title" style="color:${sev.color}">${clue.title}</p>
              <p class="forensic-clue-description">${clue.description}</p>
            </div>
            <span class="forensic-clue-badge"
                  style="background:${sev.bg};color:${sev.color};border:1px solid ${sev.border}">
              ${sev.dot} ${sev.label}
            </span>
            <span class="forensic-clue-toggle">▼</span>
          </div>
          <div class="forensic-clue-detail" style="border-color:${sev.border}">
            <div class="forensic-evidence-tag">📊 ${clue.evidence || 'No measurement data'}</div>
            ${clue.technical
                ? `<p class="forensic-technical">⚙️ Technical: ${clue.technical}</p>`
                : ''}
          </div>
        `;

        // Toggle expand on click
        card.querySelector('.forensic-clue-header').addEventListener('click', () => {
            card.classList.toggle('expanded');
        });

        return card;
    }

    // ── Build metrics grid ────────────────────────────────────────────────
    function buildMetricsGrid(qm) {
        if (!qm) return null;

        const metrics = [
            { label: 'Blur Score',     value: qm.blur_score,         unit: 'Laplacian var' },
            { label: 'Texture',        value: qm.texture_variance,   unit: 'std dev' },
            { label: 'Edge Density',   value: (qm.edge_density * 100).toFixed(2), unit: '% of pixels' },
            { label: 'Noise Residual', value: qm.noise_residual,     unit: 'std dev' },
            { label: 'Freq Ratio',     value: qm.freq_ratio,         unit: 'DCT ratio' },
            { label: 'Lighting Var.',  value: qm.lighting_variance,  unit: 'quadrant std' },
            { label: 'Ch. Imbalance',  value: qm.channel_imbalance,  unit: 'RGB spread' },
            { label: 'Brightness',     value: qm.brightness,         unit: '0–255' },
            { label: 'Faces Found',    value: qm.faces_detected,     unit: 'faces' },
            { label: 'Resolution',     value: qm.resolution || 'N/A', unit: 'pixels' },
        ];

        const grid = document.createElement('div');
        grid.className = 'forensic-metrics-grid';

        metrics.forEach(m => {
            const card = document.createElement('div');
            card.className = 'forensic-metric-card';
            card.innerHTML = `
              <div class="fmc-label">${m.label}</div>
              <div class="fmc-value">${m.value !== undefined ? m.value : '—'}</div>
              <div class="fmc-unit">${m.unit}</div>
            `;
            grid.appendChild(card);
        });

        return grid;
    }

    // ── Main render function ──────────────────────────────────────────────
    /**
     * @param {Object}  data         - Full API response from /upload-image
     * @param {string}  containerId  - ID of the container element to append into
     */
    function render(data, containerId) {
        injectStyles();

        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`ForensicPanel: container #${containerId} not found`);
            return;
        }

        // Remove any previous panel
        const prev = container.querySelector('.forensic-panel');
        if (prev) prev.remove();

        const result       = data.result || 'unknown';
        const confidence   = data.confidence || 0;
        const clues        = data.forensic_clues || data.artifacts || [];
        const qm           = data.quality_metrics || null;
        const isFake       = result === 'fake';

        // Count severities
        const critCount = clues.filter(c => c.severity === 'critical').length;
        const warnCount = clues.filter(c => c.severity === 'warning').length;

        // ── Panel wrapper ────────────────────────────────────────────────
        const panel = document.createElement('div');
        panel.className = 'forensic-panel';

        // ── Header ───────────────────────────────────────────────────────
        panel.innerHTML = `
          <div class="forensic-header">
            <span class="forensic-header-icon">🔬</span>
            <div class="forensic-header-text">
              <h3>Forensic Analysis Report</h3>
              <p>Deep inspection of manipulation indicators and visual anomalies</p>
            </div>
          </div>

          <div class="forensic-verdict-bar ${isFake ? 'fake-verdict' : 'real-verdict'}">
            <span class="fvb-result ${isFake ? 'fake' : 'real'}">
              ${isFake ? '⚠️ FAKE DETECTED' : '✅ APPEARS REAL'}
            </span>
            <span class="fvb-confidence">${confidence.toFixed(1)}% confidence</span>
            <span class="fvb-summary">
              ${clues.length === 0
                ? 'No manipulation clues detected'
                : `${clues.length} clue${clues.length > 1 ? 's' : ''} found` +
                  (critCount > 0 ? ` · ${critCount} critical` : '') +
                  (warnCount > 0 ? ` · ${warnCount} warnings` : '')}
            </span>
          </div>
        `;

        // ── Clue list ────────────────────────────────────────────────────
        const cluesList = document.createElement('div');
        cluesList.className = 'forensic-clues-list';

        if (clues.length === 0) {
            cluesList.innerHTML = `
              <div class="forensic-empty">
                <span class="fe-icon">🧹</span>
                <strong>No Forensic Clues Detected</strong>
                This image passed all forensic checks. No common manipulation
                indicators were found in texture, boundaries, lighting or frequency analysis.
              </div>
            `;
        } else {
            // Sort: critical first, then warning, then info
            const sorted = [...clues].sort((a, b) => {
                const order = { critical: 0, warning: 1, info: 2 };
                return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
            });

            sorted.forEach(clue => {
                cluesList.appendChild(buildClueCard(clue));
            });
        }

        panel.appendChild(cluesList);

        // ── Metrics grid ─────────────────────────────────────────────────
        if (qm) {
            const grid = buildMetricsGrid(qm);
            if (grid) panel.appendChild(grid);
        }

        // ── Footer ───────────────────────────────────────────────────────
        const footer = document.createElement('div');
        footer.className = 'forensic-footer';
        footer.innerHTML = `
          <span class="forensic-footer-note">
            Analysis uses OpenCV metrics + EfficientNetB0 ML model.
            Results are indicative, not legally conclusive.
          </span>
          <button class="forensic-copy-btn" onclick="ForensicPanel.copyReport(${JSON.stringify(data).replace(/"/g, '&quot;')})">
            📋 Copy Report
          </button>
        `;
        panel.appendChild(footer);

        container.appendChild(panel);
    }

    // ── Copy plain-text report to clipboard ──────────────────────────────
    function copyReport(data) {
        const result     = data.result || 'unknown';
        const confidence = data.confidence || 0;
        const clues      = data.forensic_clues || data.artifacts || [];
        const qm         = data.quality_metrics || {};

        let text = `DEEPFAKE FORENSIC REPORT\n`;
        text += `${'─'.repeat(40)}\n`;
        text += `Result:     ${result.toUpperCase()}\n`;
        text += `Confidence: ${confidence.toFixed(1)}%\n`;
        text += `Date:       ${new Date().toLocaleString()}\n\n`;

        if (clues.length > 0) {
            text += `FORENSIC CLUES DETECTED (${clues.length})\n`;
            text += `${'─'.repeat(40)}\n`;
            clues.forEach((c, i) => {
                text += `\n${i + 1}. [${(c.severity || 'info').toUpperCase()}] ${c.title}\n`;
                text += `   ${c.description}\n`;
                if (c.evidence) text += `   Evidence: ${c.evidence}\n`;
            });
        } else {
            text += `No forensic clues detected.\n`;
        }

        if (Object.keys(qm).length > 0) {
            text += `\nRAW METRICS\n${'─'.repeat(40)}\n`;
            Object.entries(qm).forEach(([k, v]) => {
                text += `${k.padEnd(25)}: ${v}\n`;
            });
        }

        navigator.clipboard.writeText(text).then(() => {
            const btn = document.querySelector('.forensic-copy-btn');
            if (btn) { btn.textContent = '✅ Copied!'; setTimeout(() => { btn.textContent = '📋 Copy Report'; }, 2000); }
        }).catch(() => {
            alert('Copy failed — please copy manually:\n\n' + text);
        });
    }

    return { render, copyReport };
})();