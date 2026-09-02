"""Genera una instantanea interactiva y autocontenida del dashboard (Artifact),
al estilo Strava: tarjetas de actividad con mapa de ruta, un panel de analisis
por actividad (ritmo / elevacion / FC contra distancia, con crosshair) y
graficos diarios en los que se puede tocar/click un punto para profundizar.

No depende de ningun recurso externo (todo el mapa y los graficos son SVG
dibujado a mano + JS plano), para que funcione dentro del sandbox de un
Artifact publicado. No se actualiza solo -- hay que volver a correrlo y
re-publicarlo para refrescar el snapshot compartido.
"""

import csv
import json
from datetime import date, timedelta
from pathlib import Path

import fetch_activity_details

PROJECT_DIR = Path(__file__).parent
DATA_DIR = PROJECT_DIR / "data"
OUT_FILE = Path(
    r"C:\Users\marco\AppData\Local\Temp\claude\F--ClaudeCode\0ab04478-c32b-47d6-b6e0-f0cc2bfc269e"
    r"\scratchpad\garmin_share_dashboard.html"
)

BLUE = "#2a78d6"
AQUA = "#1baf7a"
ORANGE = "#eb6834"
BLUE_DARK = "#3987e5"
AQUA_DARK = "#199e70"
ORANGE_DARK = "#d95926"


def load_json(path: Path):
    if not path.exists():
        return None
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def build_daily_series() -> list[dict]:
    daily_dir = DATA_DIR / "daily"
    if not daily_dir.exists():
        return []
    rows = []
    for day_dir in sorted(daily_dir.iterdir()):
        if not day_dir.is_dir():
            continue
        date_str = day_dir.name
        stats = load_json(day_dir / "stats.json") or {}
        sleep = load_json(day_dir / "sleep.json") or {}
        sleep_dto = sleep.get("dailySleepDTO") or {}
        sleep_scores = sleep_dto.get("sleepScores") or {}
        rows.append({
            "date": date_str,
            "steps": stats.get("totalSteps"),
            "restingHR": stats.get("restingHeartRate"),
            "avgStress": stats.get("averageStressLevel"),
            "bbHigh": stats.get("bodyBatteryHighestValue"),
            "bbLow": stats.get("bodyBatteryLowestValue"),
            "sleepHours": round(sleep_dto.get("sleepTimeSeconds", 0) / 3600, 2)
                if sleep_dto.get("sleepTimeSeconds") else None,
            "sleepScore": (sleep_scores.get("overall") or {}).get("value"),
        })
    return rows


def load_activities(limit: int) -> list[dict]:
    csv_path = DATA_DIR / "activities" / "all_activities.csv"
    if not csv_path.exists():
        return []
    with open(csv_path, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return rows[:limit]


READINESS_LEVEL_MAP = {
    "POOR": ("Deficiente", "critical"),
    "LOW": ("Baja", "serious"),
    "MODERATE": ("Moderada", "warning"),
    "GOOD": ("Buena", "good"),
    "HIGH": ("Alta", "good"),
}
FACTOR_FEEDBACK_MAP = {
    "GOOD": ("Bueno", "good"),
    "FAIR": ("Aceptable", "warning"),
    "POOR": ("Deficiente", "critical"),
    "NONE": ("Sin datos", "muted"),
}
TRAINING_STATUS_MAP = {
    "PRODUCTIVE": ("Productivo", "good"),
    "MAINTAINING": ("Manteniendo", "good"),
    "RECOVERY": ("Recuperacion", "good"),
    "PEAKING": ("Pico", "good"),
    "OVERREACHING": ("Sobrepasado", "warning"),
    "STRAINED": ("Tensionado", "serious"),
    "DETRAINING": ("Desentrenando", "warning"),
    "UNPRODUCTIVE": ("Improductivo", "serious"),
    "NOSTATUS": ("Sin estado", "muted"),
}
ACWR_STATUS_MAP = {
    "OPTIMAL": ("Optima", "good"),
    "LOW": ("Baja", "warning"),
    "HIGH": ("Alta", "serious"),
    "DETRAINING": ("Desentrenando", "warning"),
}
LOAD_BALANCE_FEEDBACK_MAP = {
    "ANAEROBIC_SHORTAGE": "Te falta trabajo anaerobico en las ultimas semanas.",
    "AEROBIC_SHORTAGE": "Te falta trabajo aerobico en las ultimas semanas.",
    "BALANCED": "Tu carga de entrenamiento esta equilibrada.",
    "AEROBIC_LOW_SHORTAGE": "Te falta trabajo aerobico de baja intensidad.",
    "AEROBIC_HIGH_SHORTAGE": "Te falta trabajo aerobico de alta intensidad.",
}


def map_code(code, mapping, default=("Sin datos", "muted")):
    if not code:
        return default
    return mapping.get(code, default)


def find_latest_valid_day(filename: str, is_valid) -> tuple[str | None, dict | list | None]:
    daily_dir = DATA_DIR / "daily"
    if not daily_dir.exists():
        return None, None
    for day_dir in sorted(daily_dir.iterdir(), reverse=True):
        data = load_json(day_dir / filename)
        if data is not None and is_valid(data):
            return day_dir.name, data
    return None, None


def build_readiness_payload() -> dict | None:
    day, entries = find_latest_valid_day("readiness.json", lambda d: isinstance(d, list) and len(d) > 0)
    if not entries:
        return None
    entry = max(entries, key=lambda e: e.get("timestamp", ""))
    level_label, level_color = map_code(entry.get("level"), READINESS_LEVEL_MAP)

    factor_defs = [
        ("sleepHistory", "Sueno reciente", "sleepHistoryFactorFeedback"),
        ("hrv", "Estado de VFC", "hrvFactorFeedback"),
        ("recoveryTime", "Recuperacion", "recoveryTimeFactorFeedback"),
        ("acwr", "Carga aguda", "acwrFactorFeedback"),
        ("stressHistory", "Estres reciente", "stressHistoryFactorFeedback"),
    ]
    factors = []
    for key, label, feedback_field in factor_defs:
        fb_label, fb_color = map_code(entry.get(feedback_field), FACTOR_FEEDBACK_MAP)
        factors.append({"key": key, "label": label, "feedback": fb_label, "color": fb_color})

    return {
        "date": day,
        "score": entry.get("score"),
        "level": level_label,
        "levelColor": level_color,
        "recoveryHours": round(entry["recoveryTime"] / 60, 1) if entry.get("recoveryTime") else None,
        "factors": factors,
    }


def build_training_status_payload() -> dict | None:
    day, data = find_latest_valid_day(
        "training_status.json", lambda d: isinstance(d, dict) and d.get("mostRecentTrainingStatus")
    )
    if not data:
        return None

    status_map = (data.get("mostRecentTrainingStatus") or {}).get("latestTrainingStatusData") or {}
    if not status_map:
        return None
    status_entry = next(iter(status_map.values()))
    phrase = status_entry.get("trainingStatusFeedbackPhrase") or ""
    status_key = phrase.split("_")[0] if phrase else None
    status_label, status_color = map_code(status_key, TRAINING_STATUS_MAP)

    vo2_generic = ((data.get("mostRecentVO2Max") or {}).get("generic")) or {}

    acute = status_entry.get("acuteTrainingLoadDTO") or {}
    acwr_label, acwr_color = map_code(acute.get("acwrStatus"), ACWR_STATUS_MAP)

    lb_map = (data.get("mostRecentTrainingLoadBalance") or {}).get("metricsTrainingLoadBalanceDTOMap") or {}
    load_balance = None
    if lb_map:
        lb = next(iter(lb_map.values()))
        load_balance = {
            "feedback": LOAD_BALANCE_FEEDBACK_MAP.get(
                lb.get("trainingBalanceFeedbackPhrase"), "Balance de carga de las ultimas semanas."
            ),
            "bars": [
                {
                    "label": "Aerobico bajo",
                    "value": lb.get("monthlyLoadAerobicLow") or 0,
                    "min": lb.get("monthlyLoadAerobicLowTargetMin") or 0,
                    "max": lb.get("monthlyLoadAerobicLowTargetMax") or 0,
                },
                {
                    "label": "Aerobico alto",
                    "value": lb.get("monthlyLoadAerobicHigh") or 0,
                    "min": lb.get("monthlyLoadAerobicHighTargetMin") or 0,
                    "max": lb.get("monthlyLoadAerobicHighTargetMax") or 0,
                },
                {
                    "label": "Anaerobico",
                    "value": lb.get("monthlyLoadAnaerobic") or 0,
                    "min": lb.get("monthlyLoadAnaerobicTargetMin") or 0,
                    "max": lb.get("monthlyLoadAnaerobicTargetMax") or 0,
                },
            ],
        }

    return {
        "date": day,
        "status": status_label,
        "statusColor": status_color,
        "vo2max": vo2_generic.get("vo2MaxValue"),
        "acwr": {
            "label": acwr_label,
            "color": acwr_color,
            "ratio": acute.get("dailyAcuteChronicWorkloadRatio"),
            "acute": acute.get("dailyTrainingLoadAcute"),
        },
        "loadBalance": load_balance,
    }


def build_race_predictions_payload() -> dict | None:
    data = load_json(DATA_DIR / "misc" / "race_predictions.json")
    if not data:
        return None
    return {
        "date": data.get("calendarDate"),
        "t5k": data.get("time5K"),
        "t10k": data.get("time10K"),
        "tHalf": data.get("timeHalfMarathon"),
        "tFull": data.get("timeMarathon"),
    }


def build_fitness_age_payload() -> dict | None:
    data = load_json(DATA_DIR / "misc" / "fitness_age.json")
    if not data or data.get("fitnessAge") is None:
        return None
    comps = data.get("components") or {}
    return {
        "chronologicalAge": data.get("chronologicalAge"),
        "fitnessAge": round(data.get("fitnessAge"), 1) if data.get("fitnessAge") is not None else None,
        "achievableAge": round(data.get("achievableFitnessAge"), 1) if data.get("achievableFitnessAge") is not None else None,
        "rhr": (comps.get("rhr") or {}).get("value"),
        "vigorousMinutesAvg": (comps.get("vigorousMinutesAvg") or {}).get("value"),
        "bmi": (comps.get("bmi") or {}).get("value"),
    }


def build_week_activities_payload(activities_csv: list[dict]) -> list[dict]:
    """Todas las actividades con fecha+distancia+duracion, para armar el
    resumen semanal navegable en el cliente (JS agrupa por semana)."""
    out = []
    for a in activities_csv:
        out.append({
            "date": a["startTimeLocal"][:10],
            "distanceKm": float(a["distanceKm"] or 0),
            "durationMin": float(a["durationMin"] or 0),
        })
    return out


def build_activities_payload(limit: int = 20) -> list[dict]:
    rows = load_activities(limit)
    out = []
    for a in rows:
        activity_id = a["activityId"]
        detail = fetch_activity_details.load_cached_details(activity_id)
        out.append({
            "id": activity_id,
            "date": a["startTimeLocal"],
            "name": a["activityName"],
            "type": a["activityType"],
            "distanceKm": float(a["distanceKm"] or 0),
            "durationMin": float(a["durationMin"] or 0),
            "calories": float(a["calories"]) if a["calories"] else None,
            "avgHR": float(a["avgHR"]) if a["avgHR"] else None,
            "maxHR": float(a["maxHR"]) if a["maxHR"] else None,
            "polyline": (detail or {}).get("polyline") or None,
            "series": (detail or {}).get("series") or None,
            "splits": (detail or {}).get("splits") or None,
        })
    return out


# --- graficos diarios: SVG server-side con onclick para "profundizar" -----

def _clean(vals):
    return [v for v in vals if v is not None]


def bar_chart(dates, values, color, width=560, height=170, unit="") -> str:
    vals = _clean(values)
    if not vals:
        return '<p class="empty">Sin datos todavia.</p>'
    pad_l, pad_r, pad_t, pad_b = 8, 8, 16, 24
    plot_w = width - pad_l - pad_r
    plot_h = height - pad_t - pad_b
    vmax = max(vals) * 1.15 if max(vals) > 0 else 1
    n = len(values)
    slot = plot_w / n
    bar_w = min(24, slot * 0.55)
    baseline = height - pad_b

    grid = f'<line x1="{pad_l}" y1="{baseline}" x2="{width - pad_r}" y2="{baseline}" class="axis" />'
    bars, labels = [], []
    for i, (d, v) in enumerate(zip(dates, values)):
        cx = pad_l + slot * i + slot / 2
        if v is None:
            continue
        h = (v / vmax) * plot_h if vmax else 0
        y = baseline - h
        bars.append(
            f'<rect x="{cx - bar_w/2:.1f}" y="{y:.1f}" width="{bar_w:.1f}" '
            f'height="{max(h, 1):.1f}" rx="4" ry="4" fill="{color}" class="mark" '
            f'tabindex="0" role="button" aria-label="{d}: {v:g}{unit}" '
            f'onclick="selectDay(\'{d}\')" onkeypress="if(event.key==\'Enter\')selectDay(\'{d}\')" />'
        )
        if i == n - 1 or v == max(vals):
            labels.append(
                f'<text x="{cx:.1f}" y="{y - 6:.1f}" class="value-label" text-anchor="middle">{v:g}{unit}</text>'
            )
        labels.append(
            f'<text x="{cx:.1f}" y="{height - 6}" class="tick" text-anchor="middle">{d[5:]}</text>'
        )

    return (
        f'<svg viewBox="0 0 {width} {height}" class="chart-svg" role="img" '
        f'aria-label="Grafico de barras">{grid}{"".join(bars)}{"".join(labels)}</svg>'
    )


def line_chart(dates, series: list[tuple], width=560, height=170, unit="") -> str:
    all_vals = _clean([v for _, _, vals in series for v in vals])
    if not all_vals:
        return '<p class="empty">Sin datos todavia.</p>'
    pad_l, pad_r, pad_t, pad_b = 8, 8, 16, 24
    plot_w = width - pad_l - pad_r
    plot_h = height - pad_t - pad_b
    vmin, vmax = min(all_vals), max(all_vals)
    if vmin == vmax:
        vmin -= 1
        vmax += 1
    span = (vmax - vmin) * 1.1
    vmin -= (vmax - vmin) * 0.05
    n = len(dates)
    slot = plot_w / max(n - 1, 1)

    def xy(i, v):
        x = pad_l + slot * i
        y = pad_t + plot_h - ((v - vmin) / span) * plot_h
        return x, y

    parts, legend = [], []
    for label, color, values in series:
        pts = [(i, v) for i, v in enumerate(values) if v is not None]
        if not pts:
            continue
        path_d = " ".join(
            f'{"M" if k == 0 else "L"}{xy(i, v)[0]:.1f},{xy(i, v)[1]:.1f}'
            for k, (i, v) in enumerate(pts)
        )
        parts.append(f'<path d="{path_d}" fill="none" stroke="{color}" stroke-width="2" '
                      f'stroke-linejoin="round" stroke-linecap="round" />')
        for i, v in pts:
            x, y = xy(i, v)
            d = dates[i]
            parts.append(
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="6" fill="{color}" stroke="var(--surface-1)" '
                f'stroke-width="2" class="mark" tabindex="0" role="button" '
                f'aria-label="{d} {label}: {v:g}{unit}" onclick="selectDay(\'{d}\')" '
                f'onkeypress="if(event.key==\'Enter\')selectDay(\'{d}\')" />'
            )
        last_i, last_v = pts[-1]
        lx, ly = xy(last_i, last_v)
        parts.append(f'<text x="{lx + 8:.1f}" y="{ly + 4:.1f}" class="value-label">{last_v:g}{unit}</text>')
        if len(series) > 1:
            legend.append((label, color))

    ticks = "".join(
        f'<text x="{xy(i, 0)[0]:.1f}" y="{height - 6}" class="tick" text-anchor="middle">{d[5:]}</text>'
        for i, d in enumerate(dates)
    )
    grid_y = pad_t + plot_h
    grid = f'<line x1="{pad_l}" y1="{grid_y}" x2="{width - pad_r}" y2="{grid_y}" class="axis" />'

    legend_html = ""
    if legend:
        items = "".join(f'<span class="legend-item"><i style="background:{c}"></i>{l}</span>' for l, c in legend)
        legend_html = f'<div class="legend">{items}</div>'

    svg = (
        f'<svg viewBox="0 0 {width} {height}" class="chart-svg" role="img" '
        f'aria-label="Grafico de linea">{grid}{"".join(parts)}{ticks}</svg>'
    )
    return legend_html + svg


def sparkline(values, width=96, height=28) -> str:
    vals = _clean(values)
    if len(vals) < 2:
        return ""
    vmin, vmax = min(vals), max(vals)
    span = (vmax - vmin) or 1
    n = len(values)
    slot = width / max(n - 1, 1)
    pts = [(i, v) for i, v in enumerate(values) if v is not None]
    path_d = " ".join(
        f'{"M" if k == 0 else "L"}{i*slot:.1f},{height - 4 - ((v - vmin)/span)*(height-8):.1f}'
        for k, (i, v) in enumerate(pts)
    )
    last_i, last_v = pts[-1]
    lx = last_i * slot
    ly = height - 4 - ((last_v - vmin) / span) * (height - 8)
    return (
        f'<svg viewBox="0 0 {width} {height}" class="spark" aria-hidden="true">'
        f'<path d="{path_d}" fill="none" stroke="var(--muted)" stroke-width="1.5" />'
        f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="3" fill="{BLUE}" /></svg>'
    )


def fmt(v, suffix=""):
    return f"{v}{suffix}" if v is not None else "—"


TEMPLATE = r"""<meta charset="utf-8">
<title>Bitácora de Marcos</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet">
<style>
  .viz-root {
    color-scheme: light;
    --surface-1: #ffffff; --surface-2: #f1efe9; --surface-3: #e9e6dd; --page: #f6f4ee;
    --text-primary: #14120f; --text-secondary: #57534a; --muted: #8c887e;
    --grid: #e4e0d6; --border: rgba(20,18,15,0.09);
    --overlay: rgba(20,17,12,0.6);
    --blue: __BLUE__; --aqua: __AQUA__; --orange: __ORANGE__;
    --accent: __BLUE__; --accent-wash: rgba(42,120,214,0.08); --accent-wash-strong: rgba(42,120,214,0.14);
    --shadow-card: 0 1px 2px rgba(20,18,15,0.04), 0 6px 16px -4px rgba(20,18,15,0.08);
    --shadow-card-hover: 0 2px 4px rgba(20,18,15,0.06), 0 12px 28px -6px rgba(20,18,15,0.14);
    --shadow-modal: 0 12px 32px -6px rgba(20,18,15,0.22), 0 4px 10px rgba(20,18,15,0.10);
    --status-good: #0ca30c; --status-warning: #fab219; --status-serious: #ec835a; --status-critical: #d03b3b;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) .viz-root {
      color-scheme: dark;
      --surface-1: #1c1b18; --surface-2: #242320; --surface-3: #2d2b27; --page: #100f0d;
      --text-primary: #f7f5f0; --text-secondary: #c7c2b6; --muted: #8c887e;
      --grid: #322f2a; --border: rgba(255,255,255,0.09);
      --overlay: rgba(0,0,0,0.7);
      --blue: __BLUE_DARK__; --aqua: __AQUA_DARK__; --orange: __ORANGE_DARK__;
      --accent: __BLUE_DARK__; --accent-wash: rgba(57,135,229,0.12); --accent-wash-strong: rgba(57,135,229,0.20);
      --shadow-card: 0 1px 2px rgba(0,0,0,0.3), 0 6px 18px -4px rgba(0,0,0,0.35);
      --shadow-card-hover: 0 2px 4px rgba(0,0,0,0.35), 0 14px 30px -6px rgba(0,0,0,0.45);
      --shadow-modal: 0 20px 44px -8px rgba(0,0,0,0.55), 0 6px 14px rgba(0,0,0,0.4);
    }
  }
  :root[data-theme="dark"] .viz-root {
    color-scheme: dark;
    --surface-1: #1c1b18; --surface-2: #242320; --surface-3: #2d2b27; --page: #100f0d;
    --text-primary: #f7f5f0; --text-secondary: #c7c2b6; --muted: #8c887e;
    --grid: #322f2a; --border: rgba(255,255,255,0.09);
    --overlay: rgba(0,0,0,0.7);
    --blue: __BLUE_DARK__; --aqua: __AQUA_DARK__; --orange: __ORANGE_DARK__;
    --accent: __BLUE_DARK__; --accent-wash: rgba(57,135,229,0.12); --accent-wash-strong: rgba(57,135,229,0.20);
    --shadow-card: 0 1px 2px rgba(0,0,0,0.3), 0 6px 18px -4px rgba(0,0,0,0.35);
    --shadow-card-hover: 0 2px 4px rgba(0,0,0,0.35), 0 14px 30px -6px rgba(0,0,0,0.45);
    --shadow-modal: 0 20px 44px -8px rgba(0,0,0,0.55), 0 6px 14px rgba(0,0,0,0.4);
  }

  .viz-root {
    background: var(--page); color: var(--text-primary);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    padding: 40px 20px 64px; min-height: 100%;
  }
  .viz-root * { box-sizing: border-box; }
  .viz-root :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .wrap { max-width: 960px; margin: 0 auto; display: flex; flex-direction: column; gap: 38px; }

  .eyebrow {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.11em;
    color: var(--accent); margin: 0 0 6px;
  }
  header h1 {
    font-family: "Bebas Neue", system-ui, sans-serif; font-weight: 400;
    font-size: 44px; line-height: 0.95; letter-spacing: 0.01em; margin: 0 0 8px; text-wrap: balance;
  }
  header p { margin: 0; color: var(--text-secondary); font-size: 13.5px; }
  header {
    padding-bottom: 22px; border-bottom: 1px solid var(--border);
    display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  }
  .theme-toggle {
    flex-shrink: 0; width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--border);
    background: var(--surface-1); box-shadow: var(--shadow-card); cursor: pointer;
    display: flex; align-items: center; justify-content: center; color: var(--text-secondary);
  }
  .theme-toggle:hover { color: var(--accent); }
  .theme-toggle svg { width: 18px; height: 18px; }
  .theme-toggle .icon-moon { display: none; }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) .theme-toggle .icon-sun { display: none; }
    :root:not([data-theme="light"]) .theme-toggle .icon-moon { display: block; }
  }
  :root[data-theme="dark"] .theme-toggle .icon-sun { display: none; }
  :root[data-theme="dark"] .theme-toggle .icon-moon { display: block; }
  :root[data-theme="light"] .theme-toggle .icon-sun { display: block; }
  :root[data-theme="light"] .theme-toggle .icon-moon { display: none; }

  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .tile {
    background: var(--surface-1); border: 1px solid var(--border); border-radius: 12px;
    padding: 15px 16px; display: flex; flex-direction: column; gap: 9px;
    box-shadow: var(--shadow-card);
  }
  .tile .label { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
  .tile .row { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; }
  .tile .value { font-size: 27px; font-weight: 700; line-height: 1; letter-spacing: -0.01em; white-space: nowrap; }
  .spark { width: 56px; height: 22px; flex-shrink: 0; }

  section > .eyebrow { margin-bottom: 2px; }
  section h2 { font-size: 19px; font-weight: 700; margin: 0 0 4px; letter-spacing: -0.01em; }
  section .hint { font-size: 12.5px; color: var(--muted); margin: 0 0 16px; }

  .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px; }
  .card {
    background: var(--surface-1); border: 1px solid var(--border); border-radius: 12px;
    padding: 16px 16px 12px; box-shadow: var(--shadow-card);
  }
  .card h3 { margin: 0 0 12px; font-size: 12.5px; font-weight: 650; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.03em; }
  .chart-svg { width: 100%; height: auto; overflow: visible; }
  .axis { stroke: var(--grid); stroke-width: 1; }
  .tick { font-size: 9px; fill: var(--muted); }
  .value-label { font-size: 10px; fill: var(--text-secondary); font-weight: 700; }
  .empty { color: var(--muted); font-size: 12px; margin: 20px 0; }
  .legend { display: flex; gap: 14px; font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; }
  .legend-item { display: flex; align-items: center; gap: 5px; }
  .legend-item i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .mark { cursor: pointer; transition: opacity 0.12s; }
  .mark:hover, .mark:focus-visible { opacity: 0.6; }

  /* --- panel de detalle del dia --- */
  .day-detail {
    background: var(--accent-wash); border: 1px solid var(--border); border-radius: 12px;
    padding: 16px 18px; display: flex; flex-wrap: wrap; gap: 20px; align-items: center;
  }
  .day-detail .dd-date {
    font-family: "Bebas Neue", system-ui, sans-serif; font-weight: 400; letter-spacing: 0.02em;
    font-size: 22px; min-width: 110px; color: var(--accent);
  }
  .day-detail .dd-metrics { display: flex; flex-wrap: wrap; gap: 20px; flex: 1; }
  .dd-metric { display: flex; flex-direction: column; gap: 3px; }
  .dd-metric .k { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .dd-metric .v { font-size: 15.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .dd-link {
    font-size: 12.5px; color: var(--surface-1); background: var(--accent); text-decoration: none; font-weight: 650;
    border-radius: 999px; padding: 8px 16px; white-space: nowrap; transition: opacity 0.12s;
  }
  .dd-link:hover { opacity: 0.85; }

  /* --- tarjetas de actividad (estilo Strava) --- */
  .act-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
  .act-card {
    background: var(--surface-1); border: 1px solid var(--border); border-radius: 14px;
    overflow: hidden; cursor: pointer; text-align: left; padding: 0; font: inherit; color: inherit;
    display: flex; flex-direction: column; box-shadow: var(--shadow-card);
    transition: box-shadow 0.15s, transform 0.15s;
  }
  .act-card:hover, .act-card:focus-visible { box-shadow: var(--shadow-card-hover); transform: translateY(-2px); }
  .act-thumb { width: 100%; height: 128px; background: var(--surface-2); display: block; }
  .act-body { padding: 13px 15px 15px; display: flex; flex-direction: column; gap: 9px; }
  .act-name { font-size: 14px; font-weight: 700; }
  .act-date { font-size: 11.5px; color: var(--muted); }
  .act-stats { display: flex; gap: 14px; margin-top: 3px; padding-top: 10px; border-top: 1px solid var(--grid); }
  .act-stat { display: flex; flex-direction: column; gap: 2px; }
  .act-stat .k { font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); }
  .act-stat .v { font-size: 13.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .no-gps-badge { font-size: 10px; color: var(--muted); }

  /* --- modal de actividad --- */
  .modal-backdrop {
    position: fixed; inset: 0; background: var(--overlay); display: none;
    align-items: flex-start; justify-content: center; padding: 40px 16px; overflow-y: auto; z-index: 1000;
    backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
  }
  .modal-backdrop.open { display: flex; }
  .modal {
    background: var(--surface-1); border-radius: 18px; max-width: 660px; width: 100%;
    padding: 22px 22px 26px; position: relative; box-shadow: var(--shadow-modal);
  }
  .modal-close {
    position: absolute; top: 16px; right: 16px; background: var(--surface-2); border: none;
    border-radius: 50%; width: 32px; height: 32px; font-size: 17px; cursor: pointer; color: var(--text-primary);
    transition: background 0.12s; z-index: 2;
  }
  .modal-close:hover { background: var(--surface-3); }
  .modal h2 { font-size: 19px; font-weight: 700; margin: 0 4px 2px; padding-right: 34px; letter-spacing: -0.01em; }
  .modal .modal-date { font-size: 12.5px; color: var(--muted); margin: 0 4px 16px; }
  .modal-stats {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 10px; margin: 0 0 18px;
  }
  .stat-chip {
    background: var(--surface-2); border-radius: 10px; padding: 10px 12px;
    display: flex; flex-direction: column; gap: 3px;
  }
  .stat-chip .k { font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .stat-chip .v { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .modal-map { width: 100%; height: 270px; border-radius: 12px; background: var(--surface-2); display: block; }
  .analysis-svg { width: 100%; height: auto; display: block; touch-action: none; }
  .analysis-wrap {
    position: relative; margin-top: 18px; background: var(--surface-2); border-radius: 12px; padding: 14px 12px 6px;
  }
  .analysis-tooltip {
    position: absolute; pointer-events: none; background: var(--text-primary); color: var(--surface-1);
    font-size: 11px; padding: 7px 10px; border-radius: 7px; white-space: nowrap; opacity: 0; transform: translate(-50%, -112%);
    transition: opacity 0.08s; z-index: 5; line-height: 1.55; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  }
  .band-label { font-size: 10.5px; fill: var(--text-secondary); font-weight: 700; }
  .band-minmax { font-size: 9px; fill: var(--muted); }
  .crosshair { stroke: var(--text-secondary); stroke-width: 1; opacity: 0; pointer-events: none; }
  .splits-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 18px; }
  .splits-table th, .splits-table td { text-align: right; padding: 7px 9px; font-variant-numeric: tabular-nums; }
  .splits-table th:first-child, .splits-table td:first-child { text-align: left; }
  .splits-table th { color: var(--muted); font-weight: 600; font-size: 10.5px; text-transform: uppercase; border-bottom: 1px solid var(--grid); }
  .splits-table tbody tr:nth-child(even) { background: var(--surface-2); }
  .splits-table td:first-child, .splits-table th:first-child { border-radius: 6px 0 0 6px; }
  .splits-table td:last-child, .splits-table th:last-child { border-radius: 0 6px 6px 0; }

  .table-wrap { overflow-x: auto; background: var(--surface-1); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-card); }
  table.plain { width: 100%; border-collapse: collapse; font-size: 12.5px; min-width: 480px; }
  table.plain th, table.plain td { text-align: left; padding: 9px 14px; border-bottom: 1px solid var(--grid); white-space: nowrap; }
  table.plain th { color: var(--muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
  table.plain td.num, table.plain th.num { font-variant-numeric: tabular-nums; text-align: right; }
  table.plain tbody tr:last-child td { border-bottom: none; }

  details { font-size: 12.5px; color: var(--text-secondary); }
  summary { cursor: pointer; color: var(--accent); font-weight: 600; }
  footer { color: var(--muted); font-size: 11.5px; text-align: center; margin-top: 4px; }

  /* --- status chip (color reservado + icono/etiqueta, nunca solo color) --- */
  .status-pill {
    display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700;
    padding: 4px 11px; border-radius: 999px;
  }
  .status-pill.good { color: var(--status-good); background: rgba(12,163,12,0.14); background: color-mix(in srgb, var(--status-good) 14%, transparent); }
  .status-pill.warning { color: #9a6b00; background: rgba(250,178,25,0.22); background: color-mix(in srgb, var(--status-warning) 22%, transparent); }
  :root:not([data-theme="light"]) .status-pill.warning, :root[data-theme="dark"] .status-pill.warning { color: var(--status-warning); }
  .status-pill.serious { color: var(--status-serious); background: rgba(236,131,90,0.16); background: color-mix(in srgb, var(--status-serious) 16%, transparent); }
  .status-pill.critical { color: var(--status-critical); background: rgba(208,59,59,0.14); background: color-mix(in srgb, var(--status-critical) 14%, transparent); }
  .status-pill.muted { color: var(--muted); background: var(--surface-2); }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex-shrink: 0; }

  /* --- panel Destacado --- */
  .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 16px; }
  .feature-card {
    background: var(--surface-1); border: 1px solid var(--border); border-radius: 14px;
    padding: 18px 20px; box-shadow: var(--shadow-card); cursor: pointer; text-align: left;
    font: inherit; color: inherit; width: 100%; transition: box-shadow 0.15s, transform 0.15s;
    display: flex; flex-direction: column; gap: 14px;
  }
  .feature-card.static { cursor: default; }
  .feature-card:not(.static):hover, .feature-card:not(.static):focus-visible {
    box-shadow: var(--shadow-card-hover); transform: translateY(-2px);
  }
  .feature-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .feature-title { display: flex; align-items: center; gap: 9px; font-size: 13px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.03em; }
  .feature-icon {
    width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: var(--accent-wash); flex-shrink: 0;
  }
  .feature-icon svg { width: 15px; height: 15px; }
  .feature-enter { color: var(--muted); font-size: 16px; line-height: 1; }

  .gauge-row { display: flex; align-items: center; gap: 18px; }
  .gauge-wrap { position: relative; width: 88px; height: 88px; flex-shrink: 0; }
  .gauge-wrap svg { width: 100%; height: 100%; }
  .gauge-center {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums;
  }
  .gauge-info .big-label { font-size: 19px; font-weight: 700; margin-bottom: 3px; }
  .gauge-info .sub-label { font-size: 12.5px; color: var(--muted); }

  .factor-list { display: grid; grid-template-columns: 1fr 1fr; gap: 9px 16px; }
  .factor-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12.5px; }
  .factor-item .fk { color: var(--muted); }
  .factor-item .fv { font-weight: 700; white-space: nowrap; }

  .bullet { display: flex; flex-direction: column; gap: 4px; }
  .bullet .bullet-label { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--muted); }
  .bullet .bullet-track { position: relative; height: 7px; background: var(--surface-2); border-radius: 4px; }
  .bullet .bullet-target { position: absolute; top: -3px; bottom: -3px; background: var(--accent-wash-strong); border-radius: 3px; }
  .bullet .bullet-value { position: absolute; top: -2px; bottom: -2px; width: 3px; border-radius: 2px; background: var(--text-primary); }

  .stat-row { display: flex; flex-wrap: wrap; gap: 10px; }
  .stat-row .stat-chip { flex: 1; min-width: 90px; }

  .age-compare { display: flex; align-items: center; gap: 22px; }
  .age-box { display: flex; flex-direction: column; gap: 2px; }
  .age-box .age-num { font-family: "Bebas Neue", system-ui, sans-serif; font-size: 38px; line-height: 1; }
  .age-box .age-cap { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .age-arrow { font-size: 20px; color: var(--status-good); }

  .week-card .week-total { display: flex; gap: 26px; margin-bottom: 4px; }
  .week-card .week-total .n { font-size: 24px; font-weight: 700; }
  .week-card .week-total .k { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }
  .week-bars { display: flex; align-items: flex-end; justify-content: space-between; height: 90px; gap: 6px; }
  .week-bar-col { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; height: 100%; justify-content: flex-end; }
  .week-bar { width: 60%; max-width: 22px; border-radius: 4px 4px 2px 2px; background: var(--accent); min-height: 3px; }
  .week-bar.empty { background: var(--surface-2); }
  .week-bar-col .wd { font-size: 10.5px; color: var(--muted); }
  .week-nav { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 4px; }
  .week-nav button {
    background: none; border: none; color: var(--muted); font-size: 15px; cursor: pointer; padding: 4px 8px; border-radius: 6px;
  }
  .week-nav button:hover:not(:disabled) { background: var(--surface-2); color: var(--text-primary); }
  .week-nav button:disabled { opacity: 0.3; cursor: default; }
  .week-nav .dots { display: flex; gap: 5px; }
  .week-nav .dot { width: 5px; height: 5px; border-radius: 50%; background: var(--grid); }
  .week-nav .dot.active { background: var(--accent); }

  .recent-act-body { display: flex; gap: 16px; align-items: center; }
  .recent-act-info { flex: 1; min-width: 0; }
  .recent-act-info .name { font-size: 14.5px; font-weight: 700; margin-bottom: 6px; }
  .recent-act-thumb { width: 120px; height: 72px; flex-shrink: 0; border-radius: 10px; background: var(--surface-2); overflow: hidden; }

  .modal-section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); margin: 18px 0 10px; }
  .modal-note { font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; margin: 10px 0 0; }
  .bullet-modal { display: flex; flex-direction: column; gap: 14px; margin-top: 4px; }
</style>

<div class="viz-root">
  <div class="wrap">
    <header>
      <div>
        <p class="eyebrow">Registro de entrenamiento</p>
        <h1>Bitácora de Marcos</h1>
        <p>Datos de su reloj Garmin &middot; instantanea del __GENERATED__</p>
      </div>
      <button class="theme-toggle" id="themeToggle" onclick="toggleTheme()" aria-label="Cambiar a modo oscuro/claro" title="Cambiar tema">
        <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8l1.8-1.8M18 6l1.8-1.8"/>
        </svg>
        <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 14.5A8.5 8.5 0 0110 3.2 8.5 8.5 0 1020 14.5z"/>
        </svg>
      </button>
    </header>

    <div class="tiles">
      <div class="tile">
        <span class="label">Pasos (ultimo dia)</span>
        <div class="row"><span class="value">__STEPS_LAST__</span>__STEPS_SPARK__</div>
      </div>
      <div class="tile">
        <span class="label">FC en reposo</span>
        <div class="row"><span class="value">__RHR_LAST__</span>__RHR_SPARK__</div>
      </div>
      <div class="tile">
        <span class="label">Ultimo sueno</span>
        <div class="row"><span class="value">__SLEEP_LAST__</span></div>
      </div>
      <div class="tile">
        <span class="label">Distancia (7 dias)</span>
        <div class="row"><span class="value">__WEEK_KM__ km</span></div>
      </div>
      <div class="tile">
        <span class="label">Calorias act. (7 dias)</span>
        <div class="row"><span class="value">__WEEK_CAL__</span></div>
      </div>
    </div>

    <section>
      <p class="eyebrow">Resumen</p>
      <h2>Destacado</h2>
      <p class="hint">Toca cualquier tarjeta para ver el detalle completo.</p>
      <div class="feature-grid" id="featureGrid"></div>
    </section>

    <section>
      <p class="eyebrow">Monitoreo diario</p>
      <h2>Actividad diaria</h2>
      <p class="hint">Toca un punto o una barra para ver el detalle completo de ese dia.</p>
      <div class="grid-2">
        <div class="card"><h3>Pasos por dia</h3>__STEPS_CHART__</div>
        <div class="card"><h3>Frecuencia cardiaca en reposo</h3>__RHR_CHART__</div>
        <div class="card"><h3>Horas dormidas</h3>__SLEEP_HOURS_CHART__</div>
        <div class="card"><h3>Score de sueno</h3>__SLEEP_SCORE_CHART__</div>
        <div class="card"><h3>Estres promedio</h3>__STRESS_CHART__</div>
        <div class="card"><h3>Body Battery (max / min)</h3>__BB_CHART__</div>
      </div>

      <div class="day-detail" id="dayDetail" style="margin-top: 14px;"></div>

      <details style="margin-top: 10px;">
        <summary>Ver tabla de datos diarios</summary>
        <div class="table-wrap" style="margin-top: 8px;">
          <table class="plain">
            <thead><tr><th>Fecha</th><th>Pasos</th><th>FC reposo</th><th>Sueno</th><th>Score</th><th>Estres</th><th>Body Battery</th></tr></thead>
            <tbody>__DAILY_TABLE_ROWS__</tbody>
          </table>
        </div>
      </details>
    </section>

    <section>
      <p class="eyebrow">Carreras</p>
      <h2>Entrenamientos</h2>
      <p class="hint">Toca una tarjeta para ver el mapa de la ruta, ritmo, elevacion y FC por kilometro.</p>
      <div class="act-grid" id="actGrid"></div>
    </section>

    <footer>Instantanea generada el __GENERATED__. Los datos no se actualizan solos en esta pagina.</footer>
  </div>

  <div class="modal-backdrop" id="modalBackdrop">
    <div class="modal" id="modalContent" role="dialog" aria-modal="true"></div>
  </div>
</div>

<script>
function toggleTheme() {
  const root = document.documentElement;
  const current = root.getAttribute("data-theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  try { localStorage.setItem("garmin-dashboard-theme", next); } catch (e) {}
}
(function initTheme() {
  try {
    const saved = localStorage.getItem("garmin-dashboard-theme");
    if (saved === "dark" || saved === "light") document.documentElement.setAttribute("data-theme", saved);
  } catch (e) {}
})();

const DAILY = __DAILY_JSON__;
const ACTIVITIES = __ACTIVITIES_JSON__;
const WEEK_ACTIVITIES = __WEEK_ACTIVITIES_JSON__;
const READINESS = __READINESS_JSON__;
const TRAINING_STATUS = __TRAINING_STATUS_JSON__;
const RACE_PREDICTIONS = __RACE_JSON__;
const FITNESS_AGE = __FITNESS_AGE_JSON__;
const COLORS = { blue: "__BLUE__", aqua: "__AQUA__", orange: "__ORANGE__" };

const DAILY_BY_DATE = Object.fromEntries(DAILY.map(d => [d.date, d]));
const ACTIVITIES_BY_DATE = {};
ACTIVITIES.forEach(a => {
  const key = a.date.slice(0, 10);
  (ACTIVITIES_BY_DATE[key] = ACTIVITIES_BY_DATE[key] || []).push(a);
});

function fmtVal(v, suffix) {
  suffix = suffix || "";
  return (v === null || v === undefined) ? "—" : (v + suffix);
}

function formatPace(p) {
  if (p === null || p === undefined) return "—";
  const min = Math.floor(p);
  const sec = Math.round((p - min) * 60);
  return min + ":" + String(sec).padStart(2, "0") + "/km";
}

function formatClock(totalSeconds) {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return h + ":" + String(m).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
  return m + ":" + String(ss).padStart(2, "0");
}

// --- panel de detalle diario -----------------------------------------

function selectDay(dateStr) {
  const d = DAILY_BY_DATE[dateStr];
  const el = document.getElementById("dayDetail");
  if (!d) { el.innerHTML = ""; return; }

  const acts = ACTIVITIES_BY_DATE[dateStr] || [];
  let linkHtml = "";
  if (acts.length) {
    linkHtml = '<a class="dd-link" href="javascript:void(0)" onclick="openActivityModal(\'' + acts[0].id + '\')">Ver entrenamiento &rarr;</a>';
  }

  el.innerHTML = `
    <div class="dd-date">${dateStr}</div>
    <div class="dd-metrics">
      <div class="dd-metric"><span class="k">Pasos</span><span class="v">${fmtVal(d.steps)}</span></div>
      <div class="dd-metric"><span class="k">FC reposo</span><span class="v">${fmtVal(d.restingHR, ' lpm')}</span></div>
      <div class="dd-metric"><span class="k">Sueno</span><span class="v">${fmtVal(d.sleepHours, 'h')}</span></div>
      <div class="dd-metric"><span class="k">Score sueno</span><span class="v">${fmtVal(d.sleepScore)}</span></div>
      <div class="dd-metric"><span class="k">Estres</span><span class="v">${fmtVal(d.avgStress)}</span></div>
      <div class="dd-metric"><span class="k">Body Battery</span><span class="v">${fmtVal(d.bbHigh)}/${fmtVal(d.bbLow)}</span></div>
    </div>
    ${linkHtml}
  `;
}

// --- proyeccion de rutas GPS a SVG -------------------------------------

function projectPolyline(polyline, w, h, pad) {
  const lat0 = polyline.reduce((s, p) => s + p[0], 0) / polyline.length;
  const cosLat = Math.cos(lat0 * Math.PI / 180);
  const xs = polyline.map(p => p[1] * cosLat);
  const ys = polyline.map(p => -p[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const scale = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY);
  const offX = pad + ((w - 2 * pad) - spanX * scale) / 2;
  const offY = pad + ((h - 2 * pad) - spanY * scale) / 2;
  return xs.map((x, i) => [offX + (x - minX) * scale, offY + (ys[i] - minY) * scale]);
}

function routeSvg(polyline, opts) {
  opts = opts || {};
  const w = opts.width || 260, h = opts.height || 120;
  if (!polyline || polyline.length < 2) {
    return `<svg viewBox="0 0 ${w} ${h}" class="${opts.cls||''}" role="img" aria-label="Sin ruta GPS"></svg>`;
  }
  const pts = projectPolyline(polyline, w, h, opts.pad || 10);
  const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  let markers = "";
  if (opts.markers) {
    const [sx, sy] = pts[0], [ex, ey] = pts[pts.length - 1];
    markers = `
      <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="5" fill="${COLORS.aqua}" stroke="var(--surface-1)" stroke-width="2" />
      <rect x="${(ex-4).toFixed(1)}" y="${(ey-4).toFixed(1)}" width="8" height="8" rx="2" fill="${COLORS.orange}" stroke="var(--surface-1)" stroke-width="2" />
    `;
  }
  return `<svg viewBox="0 0 ${w} ${h}" class="${opts.cls||''}" role="img" aria-label="Mapa de la ruta">
    <path d="${d}" fill="none" stroke="${COLORS.blue}" stroke-width="${opts.strokeWidth||3}" stroke-linecap="round" stroke-linejoin="round" />
    ${markers}
  </svg>`;
}

// --- tarjetas de actividad ----------------------------------------------

function activityCardHtml(a) {
  const thumb = a.polyline
    ? routeSvg(a.polyline, { width: 260, height: 120, cls: "act-thumb" })
    : `<div class="act-thumb" style="display:flex;align-items:center;justify-content:center;">
         <span class="no-gps-badge">Sin GPS</span>
       </div>`;
  const pace = a.distanceKm > 0 ? a.durationMin / a.distanceKm : null;
  return `
    <button class="act-card" onclick="openActivityModal('${a.id}')">
      ${thumb}
      <div class="act-body">
        <div class="act-name">${a.name}</div>
        <div class="act-date">${a.date}</div>
        <div class="act-stats">
          <div class="act-stat"><span class="k">Km</span><span class="v">${a.distanceKm.toFixed(2)}</span></div>
          <div class="act-stat"><span class="k">Ritmo</span><span class="v">${formatPace(pace)}</span></div>
          <div class="act-stat"><span class="k">FC</span><span class="v">${fmtVal(a.avgHR ? Math.round(a.avgHR) : null)}</span></div>
          <div class="act-stat"><span class="k">Cal</span><span class="v">${fmtVal(a.calories ? Math.round(a.calories) : null)}</span></div>
        </div>
      </div>
    </button>
  `;
}

document.getElementById("actGrid").innerHTML = ACTIVITIES.map(activityCardHtml).join("");

// --- panel de analisis (ritmo / elevacion / FC vs distancia) ------------

function buildAnalysisChart(series) {
  const W = 600, bandH = 84, gap = 8, padTop = 16, padBottom = 20, labelW = 0;
  const bands = [
    { key: "pace", label: "Ritmo (min/km)", color: COLORS.blue, invert: true, fmt: v => formatPace(v) },
    { key: "elev", label: "Elevacion (m)", color: COLORS.aqua, invert: false, area: true, fmt: v => Math.round(v) + " m" },
    { key: "hr", label: "FC (lpm)", color: COLORS.orange, invert: false, fmt: v => Math.round(v) + " lpm" },
  ];
  const H = bands.length * (bandH + gap) + padTop + padBottom;
  const maxD = Math.max(...series.map(p => p.d));

  function xOf(d) { return (d / maxD) * (W - 16) + 8; }

  let svgParts = [];
  const bandMeta = [];
  bands.forEach((band, bi) => {
    const yTop = padTop + bi * (bandH + gap);
    const vals = series.map(p => p[band.key]).filter(v => v !== null && v !== undefined);
    if (!vals.length) { bandMeta.push(null); return; }
    let vmin = Math.min(...vals), vmax = Math.max(...vals);
    if (vmin === vmax) { vmin -= 1; vmax += 1; }
    const pad = (vmax - vmin) * 0.12;
    vmin -= pad; vmax += pad;
    function yOf(v) {
      const t = (v - vmin) / (vmax - vmin);
      return band.invert ? yTop + t * bandH : yTop + bandH - t * bandH;
    }
    bandMeta.push({ yTop, yOf, vmin, vmax, band });

    const pts = series.map(p => [p.d, p[band.key]]).filter(p => p[1] !== null && p[1] !== undefined);
    const d = pts.map((p, i) => (i === 0 ? "M" : "L") + xOf(p[0]).toFixed(1) + "," + yOf(p[1]).toFixed(1)).join(" ");

    let area = "";
    if (band.area) {
      const first = pts[0], last = pts[pts.length - 1];
      area = `<path d="${d} L${xOf(last[0]).toFixed(1)},${(yTop+bandH).toFixed(1)} L${xOf(first[0]).toFixed(1)},${(yTop+bandH).toFixed(1)} Z" fill="${band.color}" opacity="0.1" />`;
    }

    svgParts.push(`
      <text x="8" y="${yTop - 4}" class="band-label">${band.label}</text>
      <text x="${W-8}" y="${yTop - 4}" class="band-minmax" text-anchor="end">${band.fmt(vmax)} / ${band.fmt(vmin)}</text>
      <line x1="8" y1="${yTop+bandH}" x2="${W-8}" y2="${yTop+bandH}" class="axis" />
      ${area}
      <path d="${d}" fill="none" stroke="${band.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    `);
  });

  const xTicks = [0, maxD/2, maxD].map(d =>
    `<text x="${xOf(d).toFixed(1)}" y="${H-4}" class="tick" text-anchor="middle">${d.toFixed(1)} km</text>`
  ).join("");

  const crosshairH = padTop + bands.length * (bandH + gap) - gap;
  svgParts.push(`<line id="crosshair" class="crosshair" x1="0" y1="${padTop}" x2="0" y2="${crosshairH}" />`);

  const svg = `<svg viewBox="0 0 ${W} ${H}" class="analysis-svg" id="analysisSvg">${svgParts.join("")}${xTicks}</svg>`;
  return { svg, W, H, xOf, bandMeta, maxD };
}

function attachAnalysisInteraction(container, chart, series) {
  const svgEl = container.querySelector("#analysisSvg");
  const crosshair = container.querySelector("#crosshair");
  const tooltip = container.querySelector(".analysis-tooltip");

  function nearestIndex(distanceKm) {
    let best = 0, bestDiff = Infinity;
    series.forEach((p, i) => {
      const diff = Math.abs(p.d - distanceKm);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    });
    return best;
  }

  function handleMove(clientX, clientY) {
    const rect = svgEl.getBoundingClientRect();
    const scaleX = chart.W / rect.width;
    const xSvg = (clientX - rect.left) * scaleX;
    const d = ((xSvg - 8) / (chart.W - 16)) * chart.maxD;
    if (d < 0 || d > chart.maxD) { crosshair.style.opacity = 0; tooltip.style.opacity = 0; return; }
    const idx = nearestIndex(d);
    const p = series[idx];
    const x = chart.xOf(p.d);
    crosshair.setAttribute("x1", x.toFixed(1));
    crosshair.setAttribute("x2", x.toFixed(1));
    crosshair.style.opacity = 1;

    tooltip.style.opacity = 1;
    const contRect = container.getBoundingClientRect();
    const scaleShown = rect.width / chart.W;
    tooltip.style.left = (rect.left - contRect.left + x * scaleShown) + "px";
    tooltip.style.top = (rect.top - contRect.top) + "px";
    tooltip.innerHTML = `${p.d.toFixed(2)} km<br>${formatPace(p.pace)}` +
      (p.elev !== null ? `<br>${Math.round(p.elev)} m` : "") +
      (p.hr !== null ? `<br>${Math.round(p.hr)} lpm` : "");
  }

  svgEl.addEventListener("mousemove", e => handleMove(e.clientX, e.clientY));
  svgEl.addEventListener("mouseleave", () => { crosshair.style.opacity = 0; tooltip.style.opacity = 0; });
  svgEl.addEventListener("touchstart", e => { handleMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  svgEl.addEventListener("touchmove", e => { handleMove(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); }, { passive: false });
}

function splitsTableHtml(splits) {
  if (!splits || !splits.length) return "";
  const rows = splits.map(s => `
    <tr>
      <td>${s.n}</td>
      <td>${s.km.toFixed(2)}</td>
      <td>${formatClock(s.durationS)}</td>
      <td>${formatPace(s.pace)}</td>
      <td>${fmtVal(s.hr)}</td>
      <td>${s.gain >= 0 ? "+" : ""}${s.gain} m</td>
    </tr>
  `).join("");
  return `
    <table class="splits-table">
      <thead><tr><th>#</th><th>Km</th><th>Tiempo</th><th>Ritmo</th><th>FC</th><th>Desnivel</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// --- Destacado: gauges, barras de rango, tarjetas e iconos --------------

const ICON_PATHS = {
  pulse: '<path d="M3 12h3l2.5 8L13 4l2.5 8H21"/>',
  trend: '<path d="M4 16l5-5 4 4 7-8"/><path d="M15 7h5v5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  flag: '<path d="M5 3v18"/><path d="M5 4h13l-3 4 3 4H5"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 6 5 6 5 9s-5 3-5 9M17 3c0 6-5 6-5 9s5 3 5 9"/>',
  pin: '<path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.3"/>',
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] || ""}</svg>`;
}
function statusVar(colorKey) {
  return colorKey === "good" ? "var(--status-good)"
    : colorKey === "warning" ? "var(--status-warning)"
    : colorKey === "serious" ? "var(--status-serious)"
    : colorKey === "critical" ? "var(--status-critical)"
    : "var(--muted)";
}
function statusPillHtml(label, colorKey) {
  return `<span class="status-pill ${colorKey}"><span class="status-dot"></span>${label}</span>`;
}

function gaugeSvg(score, color) {
  const pct = Math.max(0, Math.min(100, score || 0)) / 100;
  const r = 40, c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return `<svg viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="9" />
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" transform="rotate(-90 50 50)" />
  </svg>`;
}
function gaugeWrapHtml(score, color) {
  return `<div class="gauge-wrap">${gaugeSvg(score, color)}<div class="gauge-center" style="color:${color}">${score === null || score === undefined ? "--" : score}</div></div>`;
}

function bulletBarHtml(label, value, min, max) {
  const scaleMax = Math.max(value, max, 1) * 1.15;
  const pctStart = (min / scaleMax) * 100;
  const pctWidth = ((max - min) / scaleMax) * 100;
  const pctValue = Math.min(100, (value / scaleMax) * 100);
  return `
    <div class="bullet">
      <div class="bullet-label"><span>${label}</span><span>${Math.round(value)}</span></div>
      <div class="bullet-track">
        <div class="bullet-target" style="left:${pctStart}%; width:${Math.max(pctWidth,0)}%;"></div>
        <div class="bullet-value" style="left:${pctValue}%;"></div>
      </div>
    </div>`;
}

// --- tarjeta: predisposicion para entrenar -------------------------------

function readinessCardHtml() {
  if (!READINESS) {
    return `<div class="feature-card static"><div class="feature-title">${icon("pulse")} Predisposicion para entrenar</div><p class="sub-label">Todavia no hay datos suficientes.</p></div>`;
  }
  const color = statusVar(READINESS.levelColor);
  const factorsHtml = READINESS.factors.map(f => `
    <div class="factor-item"><span class="fk">${f.label}</span><span class="fv" style="color:${statusVar(f.color)}">${f.feedback}</span></div>
  `).join("");
  return `
    <button class="feature-card" onclick="openReadinessModal()">
      <div class="feature-head">
        <div class="feature-title"><span class="feature-icon" style="color:${color}">${icon("pulse")}</span>Predisposicion para entrenar</div>
        <span class="feature-enter">&rsaquo;</span>
      </div>
      <div class="gauge-row">
        ${gaugeWrapHtml(READINESS.score, color)}
        <div class="gauge-info">
          <div class="big-label" style="color:${color}">${READINESS.level}</div>
          <div class="sub-label">${READINESS.score ? "Puntaje " + READINESS.score + "/100" : "Deja que tu cuerpo se recupere"}</div>
        </div>
      </div>
      <div class="factor-list">${factorsHtml}</div>
    </button>`;
}

function openReadinessModal() {
  if (!READINESS) return;
  const color = statusVar(READINESS.levelColor);
  const factorsHtml = READINESS.factors.map(f => `
    <div class="factor-item"><span class="fk">${f.label}</span><span class="fv" style="color:${statusVar(f.color)}">${f.feedback}</span></div>
  `).join("");
  document.getElementById("modalContent").innerHTML = `
    <button class="modal-close" onclick="closeModal()" aria-label="Cerrar">&times;</button>
    <h2>Predisposicion para entrenar</h2>
    <p class="modal-date">${READINESS.date}</p>
    <div class="gauge-row" style="margin: 4px 0 6px;">
      ${gaugeWrapHtml(READINESS.score, color)}
      <div class="gauge-info">
        <div class="big-label" style="color:${color}">${READINESS.level}</div>
        <div class="sub-label">${READINESS.recoveryHours ? "Tiempo de recuperacion: " + READINESS.recoveryHours + " h" : ""}</div>
      </div>
    </div>
    <p class="modal-section-title">Factores</p>
    <div class="factor-list">${factorsHtml}</div>
    <p class="modal-note">Este puntaje combina tu sueno, el estado de tu variabilidad de frecuencia cardiaca (VFC), el tiempo de recuperacion estimado, la carga aguda de entrenamiento y tu historial de estres reciente.</p>
  `;
  document.getElementById("modalBackdrop").classList.add("open");
}

// --- tarjeta: estado de entreno -------------------------------------------

function trainingStatusCardHtml() {
  if (!TRAINING_STATUS) {
    return `<div class="feature-card static"><div class="feature-title">${icon("trend")} Estado de entreno</div><p class="sub-label">Todavia no hay datos suficientes.</p></div>`;
  }
  const color = statusVar(TRAINING_STATUS.statusColor);
  const bars = TRAINING_STATUS.loadBalance
    ? TRAINING_STATUS.loadBalance.bars.map(b => bulletBarHtml(b.label, b.value, b.min, b.max)).join("")
    : "";
  return `
    <button class="feature-card" onclick="openTrainingStatusModal()">
      <div class="feature-head">
        <div class="feature-title"><span class="feature-icon" style="color:${color}">${icon("trend")}</span>Estado de entreno</div>
        <span class="feature-enter">&rsaquo;</span>
      </div>
      <div class="gauge-info">
        <div class="big-label" style="color:${color}">${TRAINING_STATUS.status}</div>
        <div class="sub-label">VO2 max ${fmtVal(TRAINING_STATUS.vo2max)} &middot; Carga aguda: ${statusPillHtml(TRAINING_STATUS.acwr.label, TRAINING_STATUS.acwr.color)}</div>
      </div>
      ${bars}
    </button>`;
}

function openTrainingStatusModal() {
  if (!TRAINING_STATUS) return;
  const color = statusVar(TRAINING_STATUS.statusColor);
  const bars = TRAINING_STATUS.loadBalance
    ? TRAINING_STATUS.loadBalance.bars.map(b => bulletBarHtml(b.label, b.value, b.min, b.max)).join("")
    : "<p class=\"modal-note\">Sin datos de balance de carga todavia.</p>";
  const feedback = TRAINING_STATUS.loadBalance ? TRAINING_STATUS.loadBalance.feedback : "";
  document.getElementById("modalContent").innerHTML = `
    <button class="modal-close" onclick="closeModal()" aria-label="Cerrar">&times;</button>
    <h2>Estado de entreno</h2>
    <p class="modal-date">${TRAINING_STATUS.date}</p>
    <div class="stat-row">
      <div class="stat-chip"><span class="k">Estado</span><span class="v" style="color:${color}">${TRAINING_STATUS.status}</span></div>
      <div class="stat-chip"><span class="k">VO2 max</span><span class="v">${fmtVal(TRAINING_STATUS.vo2max)}</span></div>
      <div class="stat-chip"><span class="k">Carga aguda</span><span class="v">${fmtVal(TRAINING_STATUS.acwr.acute ? Math.round(TRAINING_STATUS.acwr.acute) : null)}</span></div>
      <div class="stat-chip"><span class="k">Ratio agudo/cronico</span><span class="v">${fmtVal(TRAINING_STATUS.acwr.ratio)}</span></div>
    </div>
    <p class="modal-section-title">Balance de carga (ultimas semanas)</p>
    <div class="bullet-modal">${bars}</div>
    <p class="modal-note">${feedback}</p>
  `;
  document.getElementById("modalBackdrop").classList.add("open");
}

// --- tarjeta: actividad semanal --------------------------------------------

const WEEKDAY_LABELS = ["D", "L", "M", "X", "J", "V", "S"];
let currentWeekOffset = 0;
const MAX_WEEK_OFFSET = 7;

function dateStrLocal(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function computeWeek(offset) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() - offset * 7);
  start.setHours(0, 0, 0, 0);
  const days = [];
  let totalKm = 0, totalMin = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = dateStrLocal(d);
    const dayActs = WEEK_ACTIVITIES.filter(a => a.date === key);
    const km = dayActs.reduce((s, a) => s + a.distanceKm, 0);
    const min = dayActs.reduce((s, a) => s + a.durationMin, 0);
    totalKm += km; totalMin += min;
    days.push({ date: key, km, min, label: WEEKDAY_LABELS[i] });
  }
  return { days, totalKm, totalMin, start };
}

function weekCardHtml() {
  return `
    <div class="feature-card static week-card">
      <div class="feature-head">
        <div class="feature-title"><span class="feature-icon" style="color:var(--accent)">${icon("calendar")}</span>Actividad semanal</div>
      </div>
      <div id="weekCardBody"></div>
    </div>`;
}

function renderWeekCard() {
  const w = computeWeek(currentWeekOffset);
  const maxKm = Math.max(...w.days.map(d => d.km), 1);
  const bars = w.days.map(d => `
    <div class="week-bar-col" onclick="jumpToDay('${d.date}')" title="${d.date}: ${d.km.toFixed(1)} km" role="button" tabindex="0">
      <div class="week-bar ${d.km === 0 ? "empty" : ""}" style="height:${d.km === 0 ? 3 : Math.max((d.km / maxKm) * 84, 4)}px"></div>
      <span class="wd">${d.label}</span>
    </div>
  `).join("");

  const dots = Array.from({ length: MAX_WEEK_OFFSET + 1 }, (_, i) => MAX_WEEK_OFFSET - i).map(off => `
    <span class="dot ${off === currentWeekOffset ? "active" : ""}" onclick="setWeekOffset(${off})"></span>
  `).join("");

  const rangeLabel = w.start.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) +
    " - " + new Date(w.start.getTime() + 6 * 86400000).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });

  document.getElementById("weekCardBody").innerHTML = `
    <div class="week-total">
      <div><div class="n">${w.totalKm.toFixed(2)} km</div><div class="k">${rangeLabel}</div></div>
      <div><div class="n">${formatClock(w.totalMin * 60)}</div><div class="k">Tiempo total</div></div>
    </div>
    <div class="week-bars">${bars}</div>
    <div class="week-nav">
      <button onclick="setWeekOffset(${currentWeekOffset + 1})" ${currentWeekOffset >= MAX_WEEK_OFFSET ? "disabled" : ""} aria-label="Semana anterior">&lsaquo;</button>
      <span class="dots">${dots}</span>
      <button onclick="setWeekOffset(${currentWeekOffset - 1})" ${currentWeekOffset <= 0 ? "disabled" : ""} aria-label="Semana siguiente">&rsaquo;</button>
    </div>
  `;
}
function setWeekOffset(off) {
  currentWeekOffset = Math.max(0, Math.min(MAX_WEEK_OFFSET, off));
  renderWeekCard();
}
function jumpToDay(dateStr) {
  selectDay(dateStr);
  document.getElementById("dayDetail").scrollIntoView({ behavior: "smooth", block: "center" });
}

// --- tarjeta: actividad reciente -------------------------------------------

function recentActivityCardHtml() {
  if (!ACTIVITIES.length) return "";
  const a = ACTIVITIES[0];
  const pace = a.distanceKm > 0 ? a.durationMin / a.distanceKm : null;
  const thumb = a.polyline
    ? routeSvg(a.polyline, { width: 120, height: 72, cls: "" })
    : "";
  return `
    <button class="feature-card" onclick="openActivityModal('${a.id}')">
      <div class="feature-head">
        <div class="feature-title"><span class="feature-icon" style="color:var(--accent)">${icon("pin")}</span>Actividad reciente</div>
        <span class="feature-enter">&rsaquo;</span>
      </div>
      <div class="recent-act-body">
        <div class="recent-act-info">
          <div class="name">${a.name}</div>
          <div class="act-date" style="margin-bottom:8px;">${a.date}</div>
          <div class="act-stats" style="border-top:none; padding-top:0;">
            <div class="act-stat"><span class="k">Km</span><span class="v">${a.distanceKm.toFixed(2)}</span></div>
            <div class="act-stat"><span class="k">Ritmo</span><span class="v">${formatPace(pace)}</span></div>
            <div class="act-stat"><span class="k">FC</span><span class="v">${fmtVal(a.avgHR ? Math.round(a.avgHR) : null)}</span></div>
          </div>
        </div>
        <div class="recent-act-thumb">${thumb}</div>
      </div>
    </button>`;
}

// --- tarjeta: prediccion de carrera ------------------------------------

function raceCardHtml() {
  if (!RACE_PREDICTIONS) return "";
  const r = RACE_PREDICTIONS;
  return `
    <button class="feature-card" onclick="openRaceModal()">
      <div class="feature-head">
        <div class="feature-title"><span class="feature-icon" style="color:var(--accent)">${icon("flag")}</span>Prediccion de carrera</div>
        <span class="feature-enter">&rsaquo;</span>
      </div>
      <div class="stat-row">
        <div class="stat-chip"><span class="k">5 km</span><span class="v">${formatClock(r.t5k)}</span></div>
        <div class="stat-chip"><span class="k">10 km</span><span class="v">${formatClock(r.t10k)}</span></div>
        <div class="stat-chip"><span class="k">21 km</span><span class="v">${formatClock(r.tHalf)}</span></div>
        <div class="stat-chip"><span class="k">42 km</span><span class="v">${formatClock(r.tFull)}</span></div>
      </div>
    </button>`;
}
function openRaceModal() {
  if (!RACE_PREDICTIONS) return;
  const r = RACE_PREDICTIONS;
  document.getElementById("modalContent").innerHTML = `
    <button class="modal-close" onclick="closeModal()" aria-label="Cerrar">&times;</button>
    <h2>Prediccion de carrera</h2>
    <p class="modal-date">Estimado el ${r.date}</p>
    <div class="stat-row">
      <div class="stat-chip"><span class="k">5 km</span><span class="v">${formatClock(r.t5k)}</span></div>
      <div class="stat-chip"><span class="k">10 km</span><span class="v">${formatClock(r.t10k)}</span></div>
      <div class="stat-chip"><span class="k">21.1 km</span><span class="v">${formatClock(r.tHalf)}</span></div>
      <div class="stat-chip"><span class="k">42.2 km</span><span class="v">${formatClock(r.tFull)}</span></div>
    </div>
    <p class="modal-note">Estimacion de Garmin basada en tu VO2 max actual y tu historial reciente de entrenamiento. Cuanto mas entrenes, mas se ajusta.</p>
  `;
  document.getElementById("modalBackdrop").classList.add("open");
}

// --- tarjeta: edad de fitness --------------------------------------------

function fitnessAgeCardHtml() {
  if (!FITNESS_AGE) return "";
  const f = FITNESS_AGE;
  const diff = (f.chronologicalAge - f.fitnessAge).toFixed(1);
  const better = diff > 0;
  return `
    <button class="feature-card" onclick="openFitnessAgeModal()">
      <div class="feature-head">
        <div class="feature-title"><span class="feature-icon" style="color:var(--accent)">${icon("hourglass")}</span>Edad de fitness</div>
        <span class="feature-enter">&rsaquo;</span>
      </div>
      <div class="age-compare">
        <div class="age-box"><span class="age-num">${f.chronologicalAge}</span><span class="age-cap">Edad real</span></div>
        <span class="age-arrow">&rarr;</span>
        <div class="age-box"><span class="age-num" style="color:var(--status-good)">${f.fitnessAge}</span><span class="age-cap">Edad de fitness</span></div>
        ${better ? `<span class="status-pill good">${diff} anos menos</span>` : ""}
      </div>
    </button>`;
}
function openFitnessAgeModal() {
  if (!FITNESS_AGE) return;
  const f = FITNESS_AGE;
  document.getElementById("modalContent").innerHTML = `
    <button class="modal-close" onclick="closeModal()" aria-label="Cerrar">&times;</button>
    <h2>Edad de fitness</h2>
    <div class="age-compare" style="margin: 6px 0 4px;">
      <div class="age-box"><span class="age-num">${f.chronologicalAge}</span><span class="age-cap">Edad real</span></div>
      <span class="age-arrow">&rarr;</span>
      <div class="age-box"><span class="age-num" style="color:var(--status-good)">${f.fitnessAge}</span><span class="age-cap">Edad de fitness</span></div>
    </div>
    <p class="modal-section-title">Factores</p>
    <div class="stat-row">
      <div class="stat-chip"><span class="k">FC en reposo</span><span class="v">${fmtVal(f.rhr, " lpm")}</span></div>
      <div class="stat-chip"><span class="k">Min. vigorosos/sem</span><span class="v">${fmtVal(f.vigorousMinutesAvg)}</span></div>
      <div class="stat-chip"><span class="k">IMC</span><span class="v">${fmtVal(f.bmi)}</span></div>
      <div class="stat-chip"><span class="k">Edad alcanzable</span><span class="v">${fmtVal(f.achievableAge)}</span></div>
    </div>
    <p class="modal-note">Garmin estima esta edad a partir de tu FC en reposo, tu VO2 max, tus minutos de actividad vigorosa semanales y tu composicion corporal.</p>
  `;
  document.getElementById("modalBackdrop").classList.add("open");
}

// --- render inicial del panel Destacado -----------------------------------

function renderFeatureGrid() {
  document.getElementById("featureGrid").innerHTML =
    readinessCardHtml() + trainingStatusCardHtml() + weekCardHtml() + recentActivityCardHtml() + raceCardHtml() + fitnessAgeCardHtml();
  renderWeekCard();
}

function openActivityModal(id) {
  const a = ACTIVITIES.find(x => String(x.id) === String(id));
  if (!a) return;
  const pace = a.distanceKm > 0 ? a.durationMin / a.distanceKm : null;
  const backdrop = document.getElementById("modalBackdrop");
  const content = document.getElementById("modalContent");

  const mapHtml = a.polyline
    ? routeSvg(a.polyline, { width: 600, height: 260, cls: "modal-map", markers: true, strokeWidth: 3.5 })
    : `<div class="modal-map" style="display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;">Esta actividad no tiene datos GPS</div>`;

  let analysisHtml = "";
  content.innerHTML = `
    <button class="modal-close" onclick="closeModal()" aria-label="Cerrar">&times;</button>
    <h2>${a.name}</h2>
    <p class="modal-date">${a.date}</p>
    ${mapHtml}
    <div class="modal-stats">
      <div class="stat-chip"><span class="k">Distancia</span><span class="v">${a.distanceKm.toFixed(2)} km</span></div>
      <div class="stat-chip"><span class="k">Tiempo</span><span class="v">${formatClock(a.durationMin*60)}</span></div>
      <div class="stat-chip"><span class="k">Ritmo prom.</span><span class="v">${formatPace(pace)}</span></div>
      <div class="stat-chip"><span class="k">FC prom.</span><span class="v">${fmtVal(a.avgHR ? Math.round(a.avgHR) : null)}</span></div>
      <div class="stat-chip"><span class="k">Calorias</span><span class="v">${fmtVal(a.calories ? Math.round(a.calories) : null)}</span></div>
    </div>
    <div id="analysisContainer" class="analysis-wrap"></div>
    ${splitsTableHtml(a.splits)}
  `;

  if (a.series && a.series.length > 1) {
    const chart = buildAnalysisChart(a.series);
    const cont = document.getElementById("analysisContainer");
    cont.innerHTML = chart.svg + '<div class="analysis-tooltip"></div>';
    attachAnalysisInteraction(cont, chart, a.series);
  }

  backdrop.classList.add("open");
}

function closeModal() {
  document.getElementById("modalBackdrop").classList.remove("open");
}

document.getElementById("modalBackdrop").addEventListener("click", e => {
  if (e.target.id === "modalBackdrop") closeModal();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

renderFeatureGrid();
if (DAILY.length) selectDay(DAILY[DAILY.length - 1].date);
</script>
"""


def main() -> None:
    daily = build_daily_series()
    activities = build_activities_payload(limit=20)

    last = daily[-1] if daily else {}
    prev_with_sleep = next((d for d in reversed(daily) if d.get("sleepHours")), {})

    week_ago = (date.today() - timedelta(days=7)).isoformat()
    all_activities_csv = load_activities(limit=10_000)
    week_activities = [a for a in all_activities_csv if a["startTimeLocal"][:10] >= week_ago]
    week_distance = sum(float(a["distanceKm"] or 0) for a in week_activities)
    week_calories = sum(float(a["calories"] or 0) for a in week_activities if a["calories"])

    readiness = build_readiness_payload()
    training_status = build_training_status_payload()
    race_predictions = build_race_predictions_payload()
    fitness_age = build_fitness_age_payload()
    week_activities_payload = build_week_activities_payload(all_activities_csv)

    dates = [d["date"] for d in daily]

    table_rows = "".join(
        f"<tr><td>{d['date']}</td><td>{fmt(d['steps'])}</td><td>{fmt(d['restingHR'])}</td>"
        f"<td>{fmt(d['sleepHours'],'h')}</td><td>{fmt(d['sleepScore'])}</td>"
        f"<td>{fmt(d['avgStress'])}</td><td>{fmt(d['bbHigh'])}/{fmt(d['bbLow'])}</td></tr>"
        for d in daily
    )

    html = TEMPLATE
    replacements = {
        "__BLUE__": BLUE,
        "__AQUA__": AQUA,
        "__ORANGE__": ORANGE,
        "__BLUE_DARK__": BLUE_DARK,
        "__AQUA_DARK__": AQUA_DARK,
        "__ORANGE_DARK__": ORANGE_DARK,
        "__GENERATED__": date.today().isoformat(),
        "__STEPS_LAST__": str(fmt(last.get("steps"))),
        "__STEPS_SPARK__": sparkline([d["steps"] for d in daily]),
        "__RHR_LAST__": str(fmt(last.get("restingHR"), " lpm")),
        "__RHR_SPARK__": sparkline([d["restingHR"] for d in daily]),
        "__SLEEP_LAST__": str(fmt(prev_with_sleep.get("sleepHours"), "h")),
        "__WEEK_KM__": str(round(week_distance, 1)),
        "__WEEK_CAL__": str(int(week_calories)),
        "__STEPS_CHART__": bar_chart(dates, [d["steps"] for d in daily], BLUE),
        "__RHR_CHART__": line_chart(dates, [("FC reposo", BLUE, [d["restingHR"] for d in daily])], unit=" lpm"),
        "__SLEEP_HOURS_CHART__": bar_chart(dates, [d["sleepHours"] for d in daily], BLUE, unit="h"),
        "__SLEEP_SCORE_CHART__": line_chart(dates, [("Score", BLUE, [d["sleepScore"] for d in daily])]),
        "__STRESS_CHART__": line_chart(dates, [("Estres", ORANGE, [d["avgStress"] for d in daily])]),
        "__BB_CHART__": line_chart(dates, [
            ("Maxima", BLUE, [d["bbHigh"] for d in daily]),
            ("Minima", AQUA, [d["bbLow"] for d in daily]),
        ]),
        "__DAILY_TABLE_ROWS__": table_rows,
        "__DAILY_JSON__": json.dumps(daily, ensure_ascii=False),
        "__ACTIVITIES_JSON__": json.dumps(activities, ensure_ascii=False),
        "__WEEK_ACTIVITIES_JSON__": json.dumps(week_activities_payload, ensure_ascii=False),
        "__READINESS_JSON__": json.dumps(readiness, ensure_ascii=False),
        "__TRAINING_STATUS_JSON__": json.dumps(training_status, ensure_ascii=False),
        "__RACE_JSON__": json.dumps(race_predictions, ensure_ascii=False),
        "__FITNESS_AGE_JSON__": json.dumps(fitness_age, ensure_ascii=False),
    }
    for token, value in replacements.items():
        html = html.replace(token, value)

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(html, encoding="utf-8")
    print(f"Snapshot para compartir generado en: {OUT_FILE}")


if __name__ == "__main__":
    main()
