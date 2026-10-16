# GymPlan

App de gimnasio para Android (React + Capacitor) que arma planes de
entrenamiento con Gemini.

## Qué hace

- **Pantalla inicial**: pide edad, sexo, peso, altura, nivel de actividad,
  experiencia con pesas, otros deportes, equipamiento disponible, lesiones,
  ejercicios a evitar, objetivo, días por semana y minutos por sesión.
- **Planes con Gemini**: genera un plan según días por semana y minutos por
  sesión. Gemini solo puede elegir ejercicios de la base local, así todos
  tienen imagen. Se pueden guardar varios planes.
- **Buscador**: buscás en español ("press banca inclinado", "jalón al pecho")
  y muestra el ejercicio animado (alterna las fotos de posición inicial y
  final), músculos, equipamiento e instrucciones. Si no encuentra nada,
  "Buscar con IA" le pide a Gemini que interprete la búsqueda. Incluye botones
  para traducir las instrucciones y para abrir videos en YouTube.
- **Cambiar un ejercicio** (por ejemplo, si falta la máquina): alternativas
  del mismo músculo ordenadas por parecido, sugerencias de Gemini con el
  motivo, o búsqueda libre. Se mantienen series, repeticiones y descanso.
  También se puede editar, quitar y agregar ejercicios.

- **Galería**: la primera vez que abrís un ejercicio, la app arma un GIF
  animado con sus fotos y lo guarda en el teléfono (IndexedDB). Desde ese
  momento se muestra el GIF guardado, también sin internet, y la pestaña
  "Galería" junta todos los guardados (con filtro y opción de quitar).
- **Respuestas de Gemini guardadas**: búsquedas con IA, traducciones y
  alternativas sugeridas se guardan; repetir la misma consulta no vuelve a
  llamar a Gemini.

- **Registro de entrenamientos**: desde un día del plan, "▶ Empezar
  entrenamiento" abre la sesión: peso y repeticiones por serie (precargados
  con lo de la última vez), temporizador de descanso que arranca al marcar
  cada serie, agregar/quitar series y cambiar un ejercicio en el momento
  (opcionalmente también en el plan). La sesión en curso sobrevive a cerrar
  la app.
- **Progreso**: entrenamientos de la semana contra los días del plan,
  historial de sesiones (duración, series, volumen) y evolución por
  ejercicio (peso máximo y 1RM estimado con Epley, gráfico y tabla).

Todo (perfil, planes, historial, galería, API key) se guarda solo en el teléfono.

## API key de Gemini

Se crea gratis en <https://aistudio.google.com/apikey> y se carga en la app
(paso final de la pantalla inicial o en Ajustes). El botón "Probar key y
cargar modelos" lista los modelos habilitados para esa key. Por defecto el
modelo está en "Automático": la app usa el Flash estable más nuevo que tenga
la key y, si Google retira un modelo (pasó con `gemini-2.5-flash` para
usuarios nuevos), elige otro y reintenta sola. También se puede fijar uno a
mano.

## Obtener el APK

Cada push que toca `gym-app/` dispara el workflow
`.github/workflows/gym-app-apk.yml` (también se puede correr a mano desde la
pestaña Actions → "GymPlan APK" → "Run workflow"). Al terminar, descargá el
artifact **GymPlan-apk** (viene en un .zip), copiá `GymPlan.apk` al teléfono e
instalalo habilitando "Instalar apps de origen desconocido".

Es un APK *debug* (firmado con la clave de depuración): sirve para uso
personal, no para publicar en Play Store.

## Versión web (iPhone)

La versión web para compartir (instalable en iPhone desde Safari) se publica
desde un repositorio aparte, `Turuleca82/turuleca82.github.io`, en
<https://turuleca82.github.io/>. Los cambios en la app hay que llevarlos
también a ese repositorio.

## Desarrollo

```bash
npm install
npm run dev               # abre la app en el navegador
npm run build             # genera dist/
npm run fetch-exercises   # actualiza public/exercises.json
```

Compilar el APK localmente (requiere Android Studio / Android SDK y JDK 21):

```bash
npm run build
npx cap add android       # solo la primera vez
npx cap sync android
cd android && ./gradlew assembleDebug
```

## Datos de ejercicios

[free-exercise-db](https://github.com/yuhonas/free-exercise-db) (dominio
público, Unlicense): ~870 ejercicios con 2 fotos cada uno. Las imágenes se
descargan de GitHub la primera vez que se ven, así que hace falta conexión.
