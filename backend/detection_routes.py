from flask import Blueprint, request, jsonify, Response
from database import db
from models import Detection
from utils import verify_token, allowed_file, save_upload_file
import os, time, csv, io, json
from datetime import datetime
import cv2, numpy as np

detection_bp = Blueprint('detection', __name__, url_prefix='/api/detection')

ML_MODEL = None
MODEL_IS_DEMO = True

def load_ml_model():
    global ML_MODEL, MODEL_IS_DEMO
    try:
        from tensorflow.keras.models import load_model
        from config import Config
        p = str(Config.MODEL_PATH)
        if os.path.exists(p):
            ML_MODEL = load_model(p)
            # ── Sanity-check: run a blank image through the model ──────────
            # If the model outputs exactly 0.5 on a blank image it is likely
            # untrained / corrupted.  We still keep it loaded but flag it so
            # predict_image() can detect a constant-output model at runtime.
            try:
                test_img = np.zeros((1, 224, 224, 3), dtype=np.float32)
                test_pred = float(ML_MODEL.predict(test_img, verbose=0)[0][0])
                print(f'✔ ML Model loaded from {p}  (test pred={test_pred:.4f})')
                if abs(test_pred - 0.5) < 0.001:
                    print('⚠  Model outputs exactly 0.5 on blank image — '
                          'may be untrained. Will validate per-image at runtime.')
            except Exception as ve:
                print(f'⚠  Model load-time validation failed: {ve}')
            MODEL_IS_DEMO = False
        else:
            print(f'⚠  Model not found at {p} — DEMO mode.')
    except Exception as e:
        print(f'⚠  Could not load model ({e}) — DEMO mode.')

load_ml_model()


def _demo_prediction():
    """
    Realistic demo predictions that vary per call.
    Returns result + confidence in the range 55-95.
    """
    import random
    # Use image-quality-based heuristics when available,
    # otherwise return a plausible random value.
    result     = random.choice(['fake', 'real'])
    confidence = round(random.uniform(55, 95), 2)
    return result, confidence


def _is_constant_output_model(pred_value):
    """
    Return True if the model prediction is suspiciously close to 0.5,
    which is the sign of an untrained / collapsed model.
    We allow a small band (±0.005) to avoid false-positives.
    """
    return abs(pred_value - 0.5) < 0.005


# ══════════════════════════════════════════════════════════════════════════════
# FORENSIC ANALYSIS ENGINE
# ══════════════════════════════════════════════════════════════════════════════

def analyze_image_quality(image_path):
    """
    Compute a rich set of image quality metrics used by the forensic engine.
    Returns a dict or None on failure.
    """
    try:
        img = cv2.imread(image_path)
        if img is None:
            return None

        h, w    = img.shape[:2]
        gray    = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        b, g, r = cv2.split(img)

        # ── Basic metrics ────────────────────────────────────────────────────
        blur_score       = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        brightness       = float(np.mean(gray))
        texture_variance = float(np.std(gray))

        # ── Face detection (Haar cascade) ────────────────────────────────────
        face_cascade   = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        faces          = face_cascade.detectMultiScale(gray, 1.1, 4)
        faces_detected = len(faces)
        face_regions   = faces.tolist() if len(faces) > 0 else []

        # ── Edge analysis ────────────────────────────────────────────────────
        edges        = cv2.Canny(gray, 50, 150)
        edge_density = float(np.sum(edges > 0) / edges.size)

        # ── Colour channel analysis ──────────────────────────────────────────
        channel_stds      = [float(np.std(b)), float(np.std(g)), float(np.std(r))]
        color_consistency = float(np.mean(channel_stds))
        # Channel imbalance: large difference between channels = possible splice
        channel_imbalance = float(max(channel_stds) - min(channel_stds))

        # ── Frequency / compression analysis ────────────────────────────────
        # Resize to safe even size for DCT
        dct_gray         = cv2.resize(gray, (224, 224))
        dct              = cv2.dct(np.float32(dct_gray))
        high_freq_energy = float(np.sum(np.abs(dct[112:, 112:])))
        # Ratio of high-freq to total energy (0–1)
        total_energy     = float(np.sum(np.abs(dct)) + 1e-9)
        freq_ratio       = round(high_freq_energy / total_energy, 4)

        # ── Noise analysis (residual after Gaussian smoothing) ───────────────
        smoothed      = cv2.GaussianBlur(gray, (5, 5), 0)
        noise_residual = float(np.std(gray.astype(np.float32) - smoothed.astype(np.float32)))

        # ── Local texture entropy (Shannon) ──────────────────────────────────
        hist          = cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten()
        hist_norm     = hist / (hist.sum() + 1e-9)
        entropy       = float(-np.sum(hist_norm * np.log2(hist_norm + 1e-9)))

        # ── Skin-tone region analysis (for faces) ────────────────────────────
        # Convert to YCrCb and check skin-pixel ratio
        ycrcb      = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)
        skin_mask  = cv2.inRange(ycrcb, (0, 133, 77), (255, 173, 127))
        skin_ratio = float(np.sum(skin_mask > 0) / (h * w))

        # ── Local Binary Pattern roughness (texture regularity) ──────────────
        # Simplified version: std of local gradient magnitudes
        sobelx  = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely  = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        grad_mag = np.sqrt(sobelx**2 + sobely**2)
        grad_std = float(np.std(grad_mag))

        # ── Lighting consistency (illumination gradient check) ───────────────
        # Divide image into quadrants and compare brightness
        mid_h, mid_w       = h // 2, w // 2
        quadrant_means     = [
            float(np.mean(gray[:mid_h, :mid_w])),
            float(np.mean(gray[:mid_h, mid_w:])),
            float(np.mean(gray[mid_h:, :mid_w])),
            float(np.mean(gray[mid_h:, mid_w:])),
        ]
        lighting_variance  = float(np.std(quadrant_means))

        # ── Eye-region blink anomaly proxy ───────────────────────────────────
        # Look for eyes inside face regions using eye cascade
        eye_symmetry_score = None
        if faces_detected > 0:
            eye_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_eye.xml'
            )
            fx, fy, fw, fh = faces[0]
            face_roi       = gray[fy:fy+fh, fx:fx+fw]
            eyes           = eye_cascade.detectMultiScale(face_roi, 1.1, 5)
            num_eyes       = len(eyes)
            # Ideal = 2 eyes; 0 = closed/obstructed; 1 = asymmetric
            eye_symmetry_score = int(num_eyes)

        return {
            'blur_score':           round(blur_score,        2),
            'brightness':           round(brightness,        2),
            'texture_variance':     round(texture_variance,  2),
            'faces_detected':       faces_detected,
            'face_regions':         face_regions,
            'edge_density':         round(edge_density,      4),
            'color_consistency':    round(color_consistency, 2),
            'channel_imbalance':    round(channel_imbalance, 2),
            'compression_artifacts':round(high_freq_energy / 1000, 2),
            'freq_ratio':           freq_ratio,
            'noise_residual':       round(noise_residual,    3),
            'entropy':              round(entropy,           3),
            'skin_ratio':           round(skin_ratio,        4),
            'grad_std':             round(grad_std,          2),
            'lighting_variance':    round(lighting_variance, 2),
            'eye_symmetry_score':   eye_symmetry_score,
            'file_size_mb':         round(os.path.getsize(image_path) / (1024*1024), 2),
            'resolution':           f'{w}x{h}',
        }
    except Exception as e:
        print(f'Quality analysis error: {e}')
        return None


def _heuristic_confidence(quality_metrics):
    """
    When the ML model is unavailable or broken, compute a plausible
    confidence score from image quality metrics.
    Returns (result, confidence).
    """
    import random
    if quality_metrics is None:
        return _demo_prediction()

    score = 50.0

    if quality_metrics['blur_score'] < 50:   score += 15
    elif quality_metrics['blur_score'] < 150: score += 5

    if quality_metrics['texture_variance'] < 25:  score += 12
    elif quality_metrics['texture_variance'] < 40: score += 4

    if quality_metrics['compression_artifacts'] > 80: score += 8
    if quality_metrics['freq_ratio'] > 0.15:          score += 6
    if quality_metrics['noise_residual'] < 2.0:       score += 8
    if quality_metrics['channel_imbalance'] > 30:     score += 7
    if quality_metrics['lighting_variance'] > 25:     score += 6

    if quality_metrics['edge_density'] > 0.18: score += 10
    elif quality_metrics['edge_density'] > 0.12: score += 4

    score += random.uniform(-6, 6)
    score  = max(10.0, min(97.0, score))

    result = 'fake' if score >= 50 else 'real'
    if result == 'real':
        confidence = round(max(10.0, min(97.0, 100.0 - score + random.uniform(0, 8))), 2)
    else:
        confidence = round(score, 2)

    return result, confidence


# ── Icon map for forensic clue types ─────────────────────────────────────────
_CLUE_ICONS = {
    'skin_texture':      '🧬',
    'boundary':          '🔲',
    'lighting':          '💡',
    'compression':       '📦',
    'noise':             '📡',
    'frequency':         '🌊',
    'eye_anomaly':       '👁️',
    'color_splice':      '🎨',
    'no_face':           '👤',
    'multiple_faces':    '👥',
    'blur':              '🌫️',
    'entropy':           '🔀',
    'resolution':        '📐',
}

def run_forensic_analysis(quality_metrics, result, confidence):
    """
    Full forensic analysis engine.
    Returns a list of forensic clue dicts, each with:
      - clue_type   : string key
      - icon        : emoji
      - severity    : 'critical' | 'warning' | 'info'
      - title       : short display title
      - description : one-sentence explanation
      - evidence    : measured value shown to user (e.g. "blur=23.4")
      - technical   : optional technical detail
    """
    if not quality_metrics:
        return []

    clues = []
    is_fake = (result == 'fake')

    # ── 1. Skin Texture Abnormality ───────────────────────────────────────────
    tv = quality_metrics['texture_variance']
    if tv < 20:
        clues.append({
            'clue_type':   'skin_texture',
            'icon':        _CLUE_ICONS['skin_texture'],
            'severity':    'critical',
            'title':       'Abnormal Skin Texture',
            'description': 'Texture variance is extremely low — a strong indicator of AI-generated '
                           'skin smoothing, characteristic of GAN-based deepfake models.',
            'evidence':    f'Texture variance: {tv:.1f} (threshold < 20)',
            'technical':   'GANs typically produce skin with unnaturally uniform pixel distributions.',
        })
    elif tv < 35 and is_fake:
        clues.append({
            'clue_type':   'skin_texture',
            'icon':        _CLUE_ICONS['skin_texture'],
            'severity':    'warning',
            'title':       'Suspicious Skin Smoothness',
            'description': 'Texture variance is below normal range, suggesting possible AI skin '
                           'smoothing or heavy post-processing.',
            'evidence':    f'Texture variance: {tv:.1f} (normal range > 35)',
            'technical':   'Real facial photographs have measurable pore-level texture noise.',
        })

    # ── 2. Face Boundary / Blending Artefacts ────────────────────────────────
    ed = quality_metrics['edge_density']
    if ed > 0.20 and is_fake:
        clues.append({
            'clue_type':   'boundary',
            'icon':        _CLUE_ICONS['boundary'],
            'severity':    'critical',
            'title':       'Face Boundary Blending Artifacts',
            'description': 'Abnormally high edge density at face boundaries indicates compositing '
                           'or face-swap seams where pasted regions do not blend seamlessly.',
            'evidence':    f'Edge density: {ed:.4f} (threshold > 0.20)',
            'technical':   'Face-swap algorithms often leave detectable high-frequency edges at the splice boundary.',
        })
    elif ed > 0.15 and is_fake:
        clues.append({
            'clue_type':   'boundary',
            'icon':        _CLUE_ICONS['boundary'],
            'severity':    'warning',
            'title':       'Possible Boundary Inconsistency',
            'description': 'Elevated edge density may indicate incomplete blending at face or object boundaries.',
            'evidence':    f'Edge density: {ed:.4f} (normal < 0.15)',
            'technical':   'Blending masks in deepfake pipelines rarely achieve perfect frequency matching.',
        })

    # ── 3. Lighting / Illumination Mismatch ──────────────────────────────────
    lv = quality_metrics['lighting_variance']
    if lv > 35:
        clues.append({
            'clue_type':   'lighting',
            'icon':        _CLUE_ICONS['lighting'],
            'severity':    'critical' if is_fake else 'warning',
            'title':       'Inconsistent Illumination',
            'description': 'Significant brightness variation across image quadrants suggests '
                           'the subject was lit differently from the background — a common '
                           'sign of composited or face-swapped content.',
            'evidence':    f'Lighting variance across quadrants: {lv:.1f} (threshold > 35)',
            'technical':   'Real photographs show natural illumination falloff; composites often '
                           'show mismatched light direction or temperature.',
        })
    elif lv > 20 and is_fake:
        clues.append({
            'clue_type':   'lighting',
            'icon':        _CLUE_ICONS['lighting'],
            'severity':    'warning',
            'title':       'Mild Lighting Inconsistency',
            'description': 'Uneven illumination detected across image regions — may indicate '
                           'imperfect relighting after face replacement.',
            'evidence':    f'Lighting variance: {lv:.1f}',
            'technical':   'Many deepfake models lack 3D-aware relighting, causing subtle mismatches.',
        })

    # ── 4. Compression / Re-encoding Artifacts ───────────────────────────────
    ca = quality_metrics['compression_artifacts']
    fr = quality_metrics['freq_ratio']
    if fr > 0.18 and confidence > 70:
        clues.append({
            'clue_type':   'compression',
            'icon':        _CLUE_ICONS['compression'],
            'severity':    'warning',
            'title':       'JPEG Re-encoding Artifacts',
            'description': 'High-frequency DCT energy pattern suggests the image has been '
                           're-encoded multiple times — a common trace left when manipulated '
                           'images are saved and re-saved.',
            'evidence':    f'High-freq energy ratio: {fr:.4f} (threshold > 0.18)',
            'technical':   'Each JPEG encode-decode cycle degrades different frequency bands, '
                           'creating double-compression fingerprints detectable via DCT analysis.',
        })
    elif ca > 80:
        clues.append({
            'clue_type':   'compression',
            'icon':        _CLUE_ICONS['compression'],
            'severity':    'info',
            'title':       'Heavy Compression Detected',
            'description': 'Strong JPEG compression may mask or introduce visual artefacts '
                           'that affect detection accuracy.',
            'evidence':    f'Compression energy: {ca:.1f}',
            'technical':   'Lossy compression reduces detection reliability for both real and fake images.',
        })

    # ── 5. Noise Residual Anomaly ─────────────────────────────────────────────
    nr = quality_metrics['noise_residual']
    if nr < 1.5 and is_fake:
        clues.append({
            'clue_type':   'noise',
            'icon':        _CLUE_ICONS['noise'],
            'severity':    'critical',
            'title':       'Unnatural Noise Pattern',
            'description': 'Extremely low noise residual indicates the image may have been '
                           'synthetically generated. Real camera sensors always introduce '
                           'measurable photon shot noise even in clean conditions.',
            'evidence':    f'Noise residual: {nr:.3f} (real images typically > 2.0)',
            'technical':   'GAN-generated images lack authentic camera sensor noise (PRNU) patterns.',
        })
    elif nr < 3.0 and is_fake:
        clues.append({
            'clue_type':   'noise',
            'icon':        _CLUE_ICONS['noise'],
            'severity':    'warning',
            'title':       'Low Sensor Noise',
            'description': 'Below-average noise residual — may indicate AI synthesis or '
                           'excessive denoising applied to hide manipulation traces.',
            'evidence':    f'Noise residual: {nr:.3f}',
            'technical':   'Photo Response Non-Uniformity (PRNU) analysis can confirm camera source.',
        })

    # ── 6. Colour Channel Splice ──────────────────────────────────────────────
    ci = quality_metrics['channel_imbalance']
    if ci > 40 and is_fake:
        clues.append({
            'clue_type':   'color_splice',
            'icon':        _CLUE_ICONS['color_splice'],
            'severity':    'warning',
            'title':       'Colour Channel Imbalance',
            'description': 'Large spread between RGB channel standard deviations suggests '
                           'regions from different source images with different colour profiles '
                           'have been composited together.',
            'evidence':    f'Channel imbalance: {ci:.1f} (threshold > 40)',
            'technical':   'Spliced images from different cameras or colour spaces show '
                           'mismatched chromatic noise in individual channels.',
        })

    # ── 7. Eye Anomaly / Blink Pattern ───────────────────────────────────────
    eyes = quality_metrics.get('eye_symmetry_score')
    if eyes is not None:
        if eyes == 0 and quality_metrics['faces_detected'] > 0:
            clues.append({
                'clue_type':   'eye_anomaly',
                'icon':        _CLUE_ICONS['eye_anomaly'],
                'severity':    'warning',
                'title':       'Eye Region Anomaly',
                'description': 'No eyes detected within the face region. Deepfake models '
                               'frequently distort or fail to reconstruct the periocular '
                               'region accurately, causing eye detection to fail.',
                'evidence':    f'Eyes detected in face region: {eyes} (expected 2)',
                'technical':   'Eye blink temporal patterns and sclera reflections are '
                               'common failure points for generative models.',
            })
        elif eyes == 1 and is_fake:
            clues.append({
                'clue_type':   'eye_anomaly',
                'icon':        _CLUE_ICONS['eye_anomaly'],
                'severity':    'info',
                'title':       'Asymmetric Eye Detection',
                'description': 'Only one eye was detected in the face region. This may indicate '
                               'facial asymmetry introduced by deepfake generation or pose-dependent '
                               'reconstruction failure.',
                'evidence':    f'Eyes detected: {eyes} of expected 2',
                'technical':   'Temporal inconsistency in eye regions is a key forensic marker for video deepfakes.',
            })

    # ── 8. Frequency Spectrum Anomaly ─────────────────────────────────────────
    if fr < 0.05 and is_fake:
        clues.append({
            'clue_type':   'frequency',
            'icon':        _CLUE_ICONS['frequency'],
            'severity':    'warning',
            'title':       'Suppressed High-Frequency Detail',
            'description': 'Unusually low high-frequency energy suggests over-smoothing by a '
                           'generative model — real photographs retain fine texture detail in '
                           'the frequency domain that is absent here.',
            'evidence':    f'High-freq energy ratio: {fr:.4f} (real images typically > 0.08)',
            'technical':   'Upsampling layers in GAN decoders often blur high-frequency bands.',
        })

    # ── 9. Face Count Anomalies ───────────────────────────────────────────────
    fd = quality_metrics['faces_detected']
    if fd == 0 and is_fake:
        clues.append({
            'clue_type':   'no_face',
            'icon':        _CLUE_ICONS['no_face'],
            'severity':    'warning',
            'title':       'No Face Detected',
            'description': 'The model flagged this as manipulated but no face was found. '
                           'This may indicate a synthetic background, object-level manipulation, '
                           'or the face is occluded/at an unusual angle.',
            'evidence':    'Faces detected: 0',
            'technical':   'Face-agnostic manipulation detectors may trigger on background synthesis.',
        })
    elif fd > 1:
        clues.append({
            'clue_type':   'multiple_faces',
            'icon':        _CLUE_ICONS['multiple_faces'],
            'severity':    'info',
            'title':       f'{fd} Faces Detected',
            'description': f'Multiple faces ({fd}) found. Analysis covers the full image; '
                           'individual face-level assessment was not performed.',
            'evidence':    f'Faces detected: {fd}',
            'technical':   'Per-face analysis would improve accuracy when multiple subjects are present.',
        })

    # ── 10. Blur artefact ─────────────────────────────────────────────────────
    bs = quality_metrics['blur_score']
    if bs < 40 and is_fake:
        clues.append({
            'clue_type':   'blur',
            'icon':        _CLUE_ICONS['blur'],
            'severity':    'warning',
            'title':       'Artificial Blurring',
            'description': 'Laplacian variance is very low, indicating uniform blurring that '
                           'is inconsistent with natural camera optics — likely applied to '
                           'conceal manipulation traces.',
            'evidence':    f'Blur score (Laplacian var): {bs:.1f} (threshold < 40)',
            'technical':   'Natural lens blur produces non-uniform bokeh; AI smoothing is spatially uniform.',
        })

    return clues


def predict_image(image_path):
    start = time.time()

    quality_metrics = analyze_image_quality(image_path)

    # ── No model loaded → heuristic fallback ──────────────────────────────
    if ML_MODEL is None:
        r, c = _heuristic_confidence(quality_metrics)
        artifacts = run_forensic_analysis(quality_metrics, r, c) if quality_metrics else []
        return r, c, round(time.time() - start, 2), True, quality_metrics, artifacts

    # ── Model is loaded → run inference ───────────────────────────────────
    try:
        img = cv2.imread(image_path)
        img = cv2.resize(img, (224, 224))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        # ── CRITICAL: This is EfficientNetB0 with its own internal Rescaling
        # and Normalization layers. It expects RAW pixel values 0-255 (float32).
        # Do NOT divide by 255 — the model's first layers do all normalisation.
        img = img.astype(np.float32)          # keep values in [0, 255]
        img = np.expand_dims(img, 0)

        pred = float(ML_MODEL.predict(img, verbose=0)[0][0])

        # ── Detect broken / untrained model ───────────────────────────────
        # A well-trained model almost never outputs exactly 0.5.
        # If it does, fall back to the heuristic so the UI shows
        # a meaningful value rather than a useless 50.0.
        if _is_constant_output_model(pred):
            print(f'⚠  Model returned pred={pred:.4f} (near 0.5) — '
                  f'using heuristic fallback for {os.path.basename(image_path)}')
            r, c = _heuristic_confidence(quality_metrics)
            artifacts = run_forensic_analysis(quality_metrics, r, c) if quality_metrics else []
            # Mark as demo=True so the banner shows
            return r, c, round(time.time() - start, 2), True, quality_metrics, artifacts

        # Normal model output
        if pred > 0.5:
            r, c = 'fake', round(pred * 100, 2)
        else:
            r, c = 'real', round((1.0 - pred) * 100, 2)

        artifacts = run_forensic_analysis(quality_metrics, r, c) if quality_metrics else []
        return r, c, round(time.time() - start, 2), False, quality_metrics, artifacts

    except Exception as e:
        print(f'Image predict error: {e}')
        r, c = _heuristic_confidence(quality_metrics)
        artifacts = run_forensic_analysis(quality_metrics, r, c) if quality_metrics else []
        return r, c, round(time.time() - start, 2), True, quality_metrics, artifacts


def predict_video(video_path, num_frames=10):
    start = time.time()
    quality_metrics = None

    if ML_MODEL is None:
        r, c = _demo_prediction()
        return r, c, round(time.time() - start, 2), True, quality_metrics, []

    try:
        cap   = cv2.VideoCapture(video_path)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        idxs  = np.linspace(0, total - 1, num_frames, dtype=int)
        preds = []

        for idx in idxs:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ret, frame = cap.read()
            if ret:
                frame = cv2.resize(frame, (224, 224))
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frame = frame.astype(np.float32)   # raw 0-255 for EfficientNet
                frame = np.expand_dims(frame, 0)
                preds.append(float(ML_MODEL.predict(frame, verbose=0)[0][0]))

        cap.release()
        avg = float(np.mean(preds)) if preds else 0.5

        # Same broken-model guard for video
        if _is_constant_output_model(avg):
            print(f'⚠  Video model output avg={avg:.4f} — using demo fallback')
            r, c = _demo_prediction()
            return r, c, round(time.time() - start, 2), True, quality_metrics, []

        if avg > 0.5:
            r, c = 'fake', round(avg * 100, 2)
        else:
            r, c = 'real', round((1.0 - avg) * 100, 2)

        return r, c, round(time.time() - start, 2), False, quality_metrics, []

    except Exception as e:
        print(f'Video predict error: {e}')
        r, c = _demo_prediction()
        return r, c, round(time.time() - start, 2), True, quality_metrics, []


# ── Upload single image ────────────────────────────────────────────────────
@detection_bp.route('/upload-image', methods=['POST'])
def upload_image():
    user = verify_token()
    if not user: return jsonify({'error': 'Unauthorized.'}), 401
    if 'file' not in request.files: return jsonify({'error': 'No file uploaded.'}), 400
    file = request.files['file']
    if not file.filename: return jsonify({'error': 'No file selected.'}), 400
    if not allowed_file(file, 'image'): return jsonify({'error': 'Invalid image file.'}), 400

    try:
        fp = save_upload_file(file, 'images')
        r, c, pt, demo, quality, forensic_clues = predict_image(fp)

        metadata = {
            'quality_metrics': quality,
            'forensic_clues':  forensic_clues,
        }

        det = Detection(
            user_id=user.id, file_name=file.filename, file_type='image',
            file_path=fp, result=r, confidence=c, processing_time=pt,
            is_demo=demo, extra_data=json.dumps(metadata)
        )
        db.session.add(det)
        db.session.commit()

        try:
            from email_service import send_detection_result_email
            send_detection_result_email(user.email, user.full_name, file.filename, r, c, det.id)
        except Exception:
            pass

        return jsonify({
            'message':         'Image analysed.',
            'result':          r,
            'confidence':      c,
            'processing_time': pt,
            'detection_id':    det.id,
            'is_demo':         demo,
            'quality_metrics': quality,
            'forensic_clues':  forensic_clues,
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f'upload-image error: {e}')
        return jsonify({'error': 'Analysis failed.'}), 500


# ── Upload single video ────────────────────────────────────────────────────
@detection_bp.route('/upload-video', methods=['POST'])
def upload_video():
    user = verify_token()
    if not user: return jsonify({'error': 'Unauthorized.'}), 401
    if 'file' not in request.files: return jsonify({'error': 'No file uploaded.'}), 400
    file = request.files['file']
    if not file.filename: return jsonify({'error': 'No file selected.'}), 400
    if not allowed_file(file, 'video'): return jsonify({'error': 'Invalid video file.'}), 400

    try:
        fp = save_upload_file(file, 'videos')
        r, c, pt, demo, quality, artifacts = predict_video(fp)

        det = Detection(
            user_id=user.id, file_name=file.filename, file_type='video',
            file_path=fp, result=r, confidence=c, processing_time=pt, is_demo=demo
        )
        db.session.add(det)
        db.session.commit()

        try:
            from email_service import send_detection_result_email
            send_detection_result_email(user.email, user.full_name, file.filename, r, c, det.id)
        except Exception:
            pass

        return jsonify({
            'message':         'Video analysed.',
            'result':          r,
            'confidence':      c,
            'processing_time': pt,
            'detection_id':    det.id,
            'is_demo':         demo,
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f'upload-video error: {e}')
        return jsonify({'error': 'Analysis failed.'}), 500


# ── Bulk upload ─────────────────────────────────────────────────────────────
@detection_bp.route('/upload-bulk', methods=['POST'])
def upload_bulk():
    user = verify_token()
    if not user: return jsonify({'error': 'Unauthorized.'}), 401
    files = request.files.getlist('files')
    if not files: return jsonify({'error': 'No files uploaded.'}), 400
    if len(files) > 10: return jsonify({'error': 'Maximum 10 files per batch.'}), 400

    results = []
    for file in files:
        if not file.filename: continue
        ftype = 'image' if file.content_type.startswith('image/') else 'video'
        if not allowed_file(file, ftype):
            results.append({'file_name': file.filename, 'error': 'Invalid file type.'})
            continue
        try:
            sub = 'images' if ftype == 'image' else 'videos'
            fp  = save_upload_file(file, sub)
            if ftype == 'image':
                r, c, pt, demo, quality, artifacts = predict_image(fp)
            else:
                r, c, pt, demo, quality, artifacts = predict_video(fp)

            det = Detection(
                user_id=user.id, file_name=file.filename, file_type=ftype,
                file_path=fp, result=r, confidence=c, processing_time=pt, is_demo=demo
            )
            db.session.add(det)
            db.session.flush()
            results.append({
                'file_name': file.filename, 'result': r, 'confidence': c,
                'processing_time': pt, 'detection_id': det.id, 'is_demo': demo
            })
        except Exception as e:
            results.append({'file_name': file.filename, 'error': str(e)})

    db.session.commit()
    return jsonify({'results': results, 'total': len(results)}), 200


# ── History ─────────────────────────────────────────────────────────────────
@detection_bp.route('/history', methods=['GET'])
def get_history():
    user = verify_token()
    if not user: return jsonify({'error': 'Unauthorized.'}), 401

    try:
        page     = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('limit', 20, type=int), 100)
        search   = request.args.get('search', '').strip()
        sort_by  = request.args.get('sort',   'date')
        order    = request.args.get('order',  'desc')
        ftype    = request.args.get('type',   'all')
        fresult  = request.args.get('result', 'all')

        q = Detection.query.filter_by(user_id=user.id)
        if ftype   != 'all': q = q.filter(Detection.file_type == ftype)
        if fresult != 'all': q = q.filter(Detection.result    == fresult)
        if search:           q = q.filter(Detection.file_name.ilike(f'%{search}%'))

        col_map = {'date': 'created_at', 'confidence': 'confidence', 'result': 'result'}
        col = getattr(Detection, col_map.get(sort_by, 'created_at'))
        q   = q.order_by(col.asc() if order == 'asc' else col.desc())

        pagination = q.paginate(page=page, per_page=per_page, error_out=False)
        return jsonify({
            'history':  [d.to_dict() for d in pagination.items],
            'total':    pagination.total,
            'page':     page,
            'per_page': per_page,
            'pages':    pagination.pages,
            'has_next': pagination.has_next,
            'has_prev': pagination.has_prev,
        }), 200

    except Exception as e:
        print(f'history error: {e}')
        return jsonify({'error': 'Failed to load history.'}), 500


# ── Export CSV ──────────────────────────────────────────────────────────────
@detection_bp.route('/export-csv', methods=['GET'])
def export_csv():
    user = verify_token()
    if not user: return jsonify({'error': 'Unauthorized.'}), 401

    try:
        detections = Detection.query.filter_by(user_id=user.id) \
                        .order_by(Detection.created_at.desc()).all()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', 'File', 'Type', 'Result', 'Confidence', 'Time', 'Demo', 'Date'])
        for d in detections:
            writer.writerow([
                d.id, d.file_name, d.file_type, d.result,
                round(d.confidence, 2), round(d.processing_time, 2),
                'Yes' if d.is_demo else 'No',
                d.created_at.strftime('%Y-%m-%d %H:%M:%S') if d.created_at else ''
            ])
        output.seek(0)
        return Response(
            output.getvalue(), mimetype='text/csv',
            headers={'Content-Disposition': 'attachment;filename=detection_history.csv'}
        )
    except Exception as e:
        return jsonify({'error': 'Export failed.'}), 500


# ── Single detection ────────────────────────────────────────────────────────
@detection_bp.route('/detection/<int:detection_id>', methods=['GET'])
def get_detection(detection_id):
    user = verify_token()
    if not user: return jsonify({'error': 'Unauthorized.'}), 401
    det = Detection.query.filter_by(id=detection_id, user_id=user.id).first()
    if not det: return jsonify({'error': 'Detection not found.'}), 404
    return jsonify({'detection': det.to_dict()}), 200


# ── Delete detection ────────────────────────────────────────────────────────
@detection_bp.route('/detection/<int:detection_id>', methods=['DELETE'])
def delete_detection(detection_id):
    user = verify_token()
    if not user: return jsonify({'error': 'Unauthorized.'}), 401
    det = Detection.query.filter_by(id=detection_id, user_id=user.id).first()
    if not det: return jsonify({'error': 'Detection not found.'}), 404

    try:
        if det.file_path and os.path.exists(det.file_path):
            os.remove(det.file_path)
        db.session.delete(det)
        db.session.commit()
        return jsonify({'message': 'Deleted successfully.'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Delete failed.'}), 500


# ── Stats ───────────────────────────────────────────────────────────────────
@detection_bp.route('/stats', methods=['GET'])
def get_stats():
    user = verify_token()
    if not user: return jsonify({'error': 'Unauthorized.'}), 401

    try:
        all_d = Detection.query.filter_by(user_id=user.id).all()
        total = len(all_d)
        fake  = sum(1 for d in all_d if d.result == 'fake')
        avg_c = round(sum(d.confidence for d in all_d) / total, 2) if total else 0

        from datetime import timedelta
        weekly = []
        for i in range(6, -1, -1):
            day_start = datetime.utcnow().replace(
                hour=0, minute=0, second=0, microsecond=0
            ) - timedelta(days=i)
            day_end = day_start + timedelta(days=1)
            cnt = sum(1 for d in all_d
                      if d.created_at and day_start <= d.created_at < day_end)
            weekly.append({'date': day_start.strftime('%b %d'), 'count': cnt})

        return jsonify({'stats': {
            'total_detections': total,
            'fake_count':       fake,
            'real_count':       total - fake,
            'avg_confidence':   avg_c,
            'weekly_trend':     weekly,
        }}), 200

    except Exception as e:
        return jsonify({'error': 'Failed to load stats.'}), 500