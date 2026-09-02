"""Genera dashboard.html a partir de los datos ya descargados en ./data.

Se puede correr solo (python generate_dashboard.py) o se llama
automaticamente al final de cada sync_garmin.py, asi el dashboard
siempre refleja los datos mas recientes.
"""

import csv
import json
from datetime import datetime
from pathlib import Path

PROJECT_DIR = Path(__file__).parent
DATA_DIR = PROJECT_DIR / "data"
OUT_FILE = PROJECT_DIR / "dashboard.html"


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
            "calories": stats.get("totalKilocalories"),
            "restingHR": stats.get("restingHeartRate"),
            "avgStress": stats.get("averageStressLevel"),
            "bbHigh": stats.get("bodyBatteryHighestValue"),
            "bbLow": stats.get("bodyBatteryLowestValue"),
            "sleepHours": round(sleep_dto.get("sleepTimeSeconds", 0) / 3600, 2)
                if sleep_dto.get("sleepTimeSeconds") else None,
            "sleepScore": (sleep_scores.get("overall") or {}).get("value"),
        })
    return rows


def load_activities() -> list[dict]:
    csv_path = DATA_DIR / "activities" / "all_activities.csv"
    if not csv_path.exists():
        return []
    with open(csv_path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main() -> None:
    daily = build_daily_series()
    activities = load_activities()
    recent_activities = activities[:15]

    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    last = daily[-1] if daily else {}

    week_ago = None
    if daily:
        from datetime import date, timedelta
        week_ago = (date.today() - timedelta(days=7)).isoformat()
    week_activities = [a for a in activities if week_ago and a["startTimeLocal"][:10] >= week_ago]
    week_distance = sum(float(a["distanceKm"] or 0) for a in week_activities)
    week_calories = sum(float(a["calories"] or 0) for a in week_activities if a["calories"])

    data_json = json.dumps(daily, ensure_ascii=False)
    activities_json = json.dumps(recent_activities, ensure_ascii=False)

    html = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Dashboard Garmin</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
  :root {{
    --bg: #0f1420; --card: #161c2c; --text: #e8ecf4; --muted: #8b93a7;
    --accent: #4fd1c5; --accent2: #f6ad55; --border: #232b3f;
  }}
  @media (prefers-color-scheme: light) {{
    :root {{ --bg: #f5f6fa; --card: #ffffff; --text: #1a1f2e; --muted: #6b7280; --border: #e5e7eb; }}
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; padding: 24px; background: var(--bg); color: var(--text);
    font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  }}
  h1 {{ font-size: 20px; margin: 0 0 4px; }}
  .subtitle {{ color: var(--muted); font-size: 13px; margin-bottom: 24px; }}
  .kpis {{
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px; margin-bottom: 24px;
  }}
  .kpi {{
    background: var(--card); border: 1px solid var(--border); border-radius: 12px;
    padding: 14px 16px;
  }}
  .kpi .label {{ font-size: 12px; color: var(--muted); margin-bottom: 6px; }}
  .kpi .value {{ font-size: 22px; font-weight: 600; }}
  .charts {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; }}
  .chart-card {{
    background: var(--card); border: 1px solid var(--border); border-radius: 12px;
    padding: 16px;
  }}
  .chart-card h3 {{ margin: 0 0 10px; font-size: 14px; color: var(--muted); font-weight: 500; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
  th, td {{ text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }}
  th {{ color: var(--muted); font-weight: 500; }}
  .section {{ margin-top: 28px; }}
  .section h2 {{ font-size: 15px; margin-bottom: 12px; }}
  .table-wrap {{ background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 8px 16px; overflow-x: auto; }}
</style>
</head>
<body>
  <h1>Dashboard de actividad Garmin</h1>
  <div class="subtitle">Actualizado {now} &middot; datos locales en ./data</div>

  <div class="kpis">
    <div class="kpi"><div class="label">Pasos (ultimo dia)</div><div class="value">{last.get('steps', '—') or '—'}</div></div>
    <div class="kpi"><div class="label">FC en reposo</div><div class="value">{last.get('restingHR', '—') or '—'}</div></div>
    <div class="kpi"><div class="label">Sueno (score)</div><div class="value">{last.get('sleepScore', '—') or '—'}</div></div>
    <div class="kpi"><div class="label">Horas dormidas</div><div class="value">{last.get('sleepHours', '—') or '—'}</div></div>
    <div class="kpi"><div class="label">Estres promedio</div><div class="value">{last.get('avgStress', '—') or '—'}</div></div>
    <div class="kpi"><div class="label">Distancia (7 dias)</div><div class="value">{round(week_distance, 1)} km</div></div>
    <div class="kpi"><div class="label">Calorias act. (7 dias)</div><div class="value">{int(week_calories)}</div></div>
  </div>

  <div class="charts">
    <div class="chart-card"><h3>Pasos por dia</h3><canvas id="chartSteps"></canvas></div>
    <div class="chart-card"><h3>FC en reposo</h3><canvas id="chartRHR"></canvas></div>
    <div class="chart-card"><h3>Sueno (horas y score)</h3><canvas id="chartSleep"></canvas></div>
    <div class="chart-card"><h3>Estres promedio</h3><canvas id="chartStress"></canvas></div>
    <div class="chart-card"><h3>Body Battery (max / min)</h3><canvas id="chartBB"></canvas></div>
  </div>

  <div class="section">
    <h2>Actividades recientes</h2>
    <div class="table-wrap">
    <table>
      <thead><tr><th>Fecha</th><th>Nombre</th><th>Tipo</th><th>Km</th><th>Min</th><th>Cal</th><th>FC prom</th></tr></thead>
      <tbody id="activitiesBody"></tbody>
    </table>
    </div>
  </div>

<script>
const daily = {data_json};
const activities = {activities_json};

const labels = daily.map(d => d.date.slice(5));
const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const gridColor = isDark ? '#232b3f' : '#e5e7eb';
const textColor = isDark ? '#8b93a7' : '#6b7280';

Chart.defaults.color = textColor;
Chart.defaults.borderColor = gridColor;
Chart.defaults.font.size = 11;

function mkChart(id, config) {{
  new Chart(document.getElementById(id), config);
}}

mkChart('chartSteps', {{
  type: 'bar',
  data: {{ labels, datasets: [{{ label: 'Pasos', data: daily.map(d => d.steps), backgroundColor: '#4fd1c5' }}] }},
  options: {{ plugins: {{ legend: {{ display: false }} }}, scales: {{ y: {{ beginAtZero: true }} }} }}
}});

mkChart('chartRHR', {{
  type: 'line',
  data: {{ labels, datasets: [{{ label: 'FC reposo', data: daily.map(d => d.restingHR), borderColor: '#f6ad55', tension: 0.3 }}] }},
  options: {{ plugins: {{ legend: {{ display: false }} }} }}
}});

mkChart('chartSleep', {{
  type: 'bar',
  data: {{
    labels,
    datasets: [
      {{ type: 'bar', label: 'Horas', data: daily.map(d => d.sleepHours), backgroundColor: '#4fd1c5', yAxisID: 'y' }},
      {{ type: 'line', label: 'Score', data: daily.map(d => d.sleepScore), borderColor: '#f6ad55', yAxisID: 'y1', tension: 0.3 }}
    ]
  }},
  options: {{
    scales: {{
      y: {{ position: 'left', title: {{ display: true, text: 'Horas' }} }},
      y1: {{ position: 'right', min: 0, max: 100, grid: {{ display: false }}, title: {{ display: true, text: 'Score' }} }}
    }}
  }}
}});

mkChart('chartStress', {{
  type: 'line',
  data: {{ labels, datasets: [{{ label: 'Estres', data: daily.map(d => d.avgStress), borderColor: '#e07a5f', tension: 0.3, fill: false }}] }},
  options: {{ plugins: {{ legend: {{ display: false }} }} }}
}});

mkChart('chartBB', {{
  type: 'line',
  data: {{
    labels,
    datasets: [
      {{ label: 'Maxima', data: daily.map(d => d.bbHigh), borderColor: '#4fd1c5', tension: 0.3 }},
      {{ label: 'Minima', data: daily.map(d => d.bbLow), borderColor: '#8b93a7', tension: 0.3 }}
    ]
  }},
  options: {{ scales: {{ y: {{ min: 0, max: 100 }} }} }}
}});

const tbody = document.getElementById('activitiesBody');
tbody.innerHTML = activities.map(a => `
  <tr>
    <td>${{a.startTimeLocal}}</td>
    <td>${{a.activityName}}</td>
    <td>${{a.activityType}}</td>
    <td>${{a.distanceKm}}</td>
    <td>${{a.durationMin}}</td>
    <td>${{a.calories}}</td>
    <td>${{a.avgHR || ''}}</td>
  </tr>
`).join('');
</script>
</body>
</html>
"""

    OUT_FILE.write_text(html, encoding="utf-8")
    print(f"Dashboard generado en: {OUT_FILE}")


if __name__ == "__main__":
    main()
