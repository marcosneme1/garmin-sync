"""Descarga y cachea el detalle de actividades: ruta GPS, series (ritmo,
frecuencia cardiaca, elevacion por distancia) y splits por km.

Se cachea por activityId en data/activities/details/{id}.json -- una
actividad vieja nunca cambia, asi que solo se descargan las que todavia
no tienen cache (y las mas recientes, por si Garmin sigue proceando datos).
"""

import json
from pathlib import Path
from typing import Any

PROJECT_DIR = Path(__file__).parent
DETAILS_DIR = PROJECT_DIR / "data" / "activities" / "details"

MAX_ACTIVITIES_WITH_DETAILS = 20
MAX_POLYLINE_POINTS = 220
MAX_SERIES_POINTS = 140
REFRESH_MOST_RECENT = 2  # re-descargar las N mas recientes por si faltaba data


def _downsample(seq: list, max_points: int) -> list:
    n = len(seq)
    if n <= max_points or n == 0:
        return seq
    step = n / max_points
    out = [seq[int(i * step)] for i in range(max_points)]
    out[-1] = seq[-1]
    return out


def _extract_polyline(details: dict) -> list[list[float]]:
    poly = (details.get("geoPolylineDTO") or {}).get("polyline") or []
    pts = [
        [round(p["lat"], 6), round(p["lon"], 6)]
        for p in poly
        if p.get("lat") is not None and p.get("lon") is not None
    ]
    return _downsample(pts, MAX_POLYLINE_POINTS)


def _extract_series(details: dict) -> list[dict]:
    descriptors = {m["key"]: m["metricsIndex"] for m in details.get("metricDescriptors", [])}
    rows = details.get("activityDetailMetrics", [])
    if not rows or "sumDistance" not in descriptors:
        return []

    idx_dist = descriptors.get("sumDistance")
    idx_hr = descriptors.get("directHeartRate")
    idx_speed = descriptors.get("directSpeed")
    idx_elev = descriptors.get("directElevation")

    series = []
    for row in rows:
        m = row.get("metrics") or []
        if idx_dist is None or idx_dist >= len(m) or m[idx_dist] is None:
            continue
        dist = m[idx_dist]
        hr = m[idx_hr] if idx_hr is not None and idx_hr < len(m) else None
        speed = m[idx_speed] if idx_speed is not None and idx_speed < len(m) else None
        elev = m[idx_elev] if idx_elev is not None and idx_elev < len(m) else None
        pace = round(1000 / speed / 60, 2) if speed and speed > 0.3 else None
        series.append({
            "d": round(dist / 1000, 3),
            "hr": round(hr) if hr else None,
            "pace": pace,
            "elev": round(elev, 1) if elev is not None else None,
        })
    return _downsample(series, MAX_SERIES_POINTS)


def _extract_splits(splits_data: dict | None) -> list[dict]:
    laps = (splits_data or {}).get("lapDTOs", [])
    out = []
    for i, lap in enumerate(laps, start=1):
        speed = lap.get("averageSpeed")
        pace = round(1000 / speed / 60, 2) if speed and speed > 0.3 else None
        out.append({
            "n": i,
            "km": round((lap.get("distance") or 0) / 1000, 2),
            "durationS": round(lap.get("duration") or 0),
            "pace": pace,
            "hr": round(lap["averageHR"]) if lap.get("averageHR") else None,
            "gain": round(lap.get("elevationGain") or 0),
        })
    return out


def fetch_details_for_activities(client: Any, activities: list[dict], log=print) -> None:
    """Descarga y cachea detalle para las actividades con GPS mas recientes."""
    DETAILS_DIR.mkdir(parents=True, exist_ok=True)

    with_gps = [a for a in activities if a.get("hasPolyline")][:MAX_ACTIVITIES_WITH_DETAILS]

    fetched = 0
    for i, act in enumerate(with_gps):
        activity_id = str(act["activityId"])
        cache_path = DETAILS_DIR / f"{activity_id}.json"
        if cache_path.exists() and i >= REFRESH_MOST_RECENT:
            continue
        try:
            details = client.get_activity_details(activity_id, maxchart=2000, maxpoly=4000)
            splits = client.get_activity_splits(activity_id) if act.get("hasSplits") else None
            payload = {
                "activityId": activity_id,
                "polyline": _extract_polyline(details),
                "series": _extract_series(details),
                "splits": _extract_splits(splits),
            }
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False)
            fetched += 1
        except Exception as e:
            log(f"  detalle de actividad {activity_id}: omitido ({e})")

    log(f"  detalle de actividades: {fetched} descargadas/actualizadas ({len(with_gps)} candidatas con GPS)")


def load_cached_details(activity_id: str) -> dict | None:
    path = DETAILS_DIR / f"{activity_id}.json"
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)
