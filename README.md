# garmin-sync

Descarga datos de Garmin Connect (actividad diaria, entrenamientos, rutas GPS,
predisposicion para entrenar, estado de entreno, prediccion de carrera, edad
de fitness) usando [python-garminconnect](https://github.com/cyberjunky/python-garminconnect),
y genera un dashboard interactivo a partir de esos datos.

## Setup en un entorno nuevo (incluido un entorno cloud)

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt   # Linux/Mac
# .venv\Scripts\pip install -r requirements.txt   # Windows
```

Autenticacion (una sola vez, interactivo -- pide email/contrasena/MFA por
Terminal, nunca los hardcodees ni los pegues en un chat):

```bash
.venv/bin/python setup_garmin.py
```

Esto guarda una sesion en `.garmin_tokens/` (excluido de git). Mientras ese
archivo exista y sea valido, `sync_garmin.py` no vuelve a pedir contrasena.

## Uso diario

```bash
.venv/bin/python sync_garmin.py
```

Descarga los datos a `./data` (excluido de git -- son datos personales) y
regenera `dashboard.html`.

## Archivos

- `setup_garmin.py` -- autenticacion inicial interactiva.
- `sync_garmin.py` -- sincronizacion diaria (datos + actividades + detalle de
  rutas + dashboard local).
- `fetch_activity_details.py` -- descarga y cachea ruta GPS, splits y series
  de ritmo/FC/elevacion por actividad.
- `generate_dashboard.py` -- dashboard HTML local (usa Chart.js por CDN).
- `generate_share_dashboard.py` -- genera una instantanea autocontenida (sin
  dependencias externas) pensada para publicarse como pagina compartible.
- `run_sync.ps1` -- wrapper para el Programador de tareas de Windows.

## Notas de seguridad

- `.garmin_tokens/` da acceso a la cuenta de Garmin -- nunca se commitea.
- `data/` contiene datos personales de salud/actividad -- nunca se commitea.
- Este repo deberia mantenerse **privado**.
