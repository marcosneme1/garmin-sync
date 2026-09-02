"""Descarga los datos de Garmin Connect a la carpeta local ./data.

Pensado para ejecutarse solo (via la tarea programada de Windows), usando
la sesion guardada por setup_garmin.py. Si no hay sesion valida, termina
con un error pidiendo que se ejecute setup_garmin.py de nuevo -- nunca
pide contrasena por si solo.
"""

import csv
import json
import sys
from datetime import date, timedelta
from pathlib import Path

from garminconnect import Garmin, GarminConnectAuthenticationError

import fetch_activity_details
import generate_dashboard

PROJECT_DIR = Path(__file__).parent
TOKENSTORE = str(PROJECT_DIR / ".garmin_tokens")
DATA_DIR = PROJECT_DIR / "data"

# Cuantos dias hacia atras re-descargar en cada corrida, para cubrir datos
# que el reloj todavia no habia sincronizado el dia anterior.
DAYS_BACK = 3

# Cuantas actividades recientes revisar en cada corrida.
ACTIVITIES_LIMIT = 50


def log(msg: str) -> None:
    print(f"[{date.today().isoformat()}] {msg}", flush=True)


def get_client() -> Garmin:
    client = Garmin()
    try:
        client.login(TOKENSTORE)
    except GarminConnectAuthenticationError:
        log("ERROR: no hay una sesion valida guardada.")
        log("Ejecuta manualmente en tu Terminal: .venv\\Scripts\\python.exe setup_garmin.py")
        sys.exit(1)
    return client


def save_json(obj, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2, default=str)


def fetch_day(client: Garmin, day_str: str) -> None:
    out_dir = DATA_DIR / "daily" / day_str
    fetchers = {
        "stats.json": lambda: client.get_stats(day_str),
        "steps.json": lambda: client.get_steps_data(day_str),
        "heart_rate.json": lambda: client.get_heart_rates(day_str),
        "sleep.json": lambda: client.get_sleep_data(day_str),
        "stress.json": lambda: client.get_stress_data(day_str),
        "body_battery.json": lambda: client.get_body_battery(day_str, day_str),
        "spo2.json": lambda: client.get_spo2_data(day_str),
        "respiration.json": lambda: client.get_respiration_data(day_str),
        "hrv.json": lambda: client.get_hrv_data(day_str),
        "resting_heart_rate.json": lambda: client.get_rhr_day(day_str),
        "training_status.json": lambda: client.get_training_status(day_str),
        "body_composition.json": lambda: client.get_body_composition(day_str),
        "readiness.json": lambda: client.get_training_readiness(day_str),
    }
    for filename, fetch in fetchers.items():
        try:
            save_json(fetch(), out_dir / filename)
        except Exception as e:
            log(f"  {day_str}/{filename}: omitido ({e})")


def fetch_activities(client: Garmin) -> list[dict]:
    try:
        activities = client.get_activities(0, ACTIVITIES_LIMIT)
    except Exception as e:
        log(f"  actividades: omitido ({e})")
        return []

    if not isinstance(activities, list):
        return []

    index_path = DATA_DIR / "activities" / "all_activities.json"
    index_path.parent.mkdir(parents=True, exist_ok=True)

    existing: dict[str, dict] = {}
    if index_path.exists():
        with open(index_path, encoding="utf-8") as f:
            existing = {str(a["activityId"]): a for a in json.load(f)}

    for act in activities:
        existing[str(act["activityId"])] = act

    merged = sorted(
        existing.values(),
        key=lambda a: a.get("startTimeLocal", ""),
        reverse=True,
    )
    save_json(merged, index_path)

    csv_path = DATA_DIR / "activities" / "all_activities.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            ["activityId", "startTimeLocal", "activityName", "activityType",
             "distanceKm", "durationMin", "calories", "avgHR", "maxHR"]
        )
        for a in merged:
            distance_m = a.get("distance") or 0
            duration_s = a.get("duration") or 0
            writer.writerow([
                a.get("activityId"),
                a.get("startTimeLocal"),
                a.get("activityName"),
                (a.get("activityType") or {}).get("typeKey"),
                round(distance_m / 1000, 3),
                round(duration_s / 60, 1),
                a.get("calories"),
                a.get("averageHR"),
                a.get("maxHR"),
            ])

    log(f"  actividades: {len(merged)} en total ({len(activities)} revisadas esta vez)")
    return merged


def fetch_snapshot_metrics(client: Garmin) -> None:
    """Metricas 'de hoy' que no tienen sentido pedir por cada dia historico."""
    today_str = date.today().isoformat()
    misc_dir = DATA_DIR / "misc"
    snapshots = {
        "race_predictions.json": lambda: client.get_race_predictions(),
        "fitness_age.json": lambda: client.get_fitnessage_data(today_str),
    }
    for filename, fetch in snapshots.items():
        try:
            save_json(fetch(), misc_dir / filename)
        except Exception as e:
            log(f"  {filename}: omitido ({e})")


def main() -> None:
    log("Iniciando sincronizacion con Garmin Connect...")
    client = get_client()
    log(f"Sesion activa: {client.display_name}")

    today = date.today()
    for offset in range(DAYS_BACK):
        day_str = (today - timedelta(days=offset)).isoformat()
        log(f"Descargando datos diarios de {day_str}...")
        fetch_day(client, day_str)

    log("Descargando actividades recientes...")
    merged_activities = fetch_activities(client)

    log("Descargando detalle de rutas (GPS, ritmo, FC, splits)...")
    fetch_activity_details.fetch_details_for_activities(client, merged_activities, log=log)

    log("Descargando predisposicion, prediccion de carrera y edad fitness...")
    fetch_snapshot_metrics(client)

    log("Regenerando dashboard...")
    generate_dashboard.main()

    log(f"Sincronizacion completa. Datos en: {DATA_DIR}")


if __name__ == "__main__":
    main()
