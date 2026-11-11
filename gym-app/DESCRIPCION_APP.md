# GymPlan: descripción de la aplicación

GymPlan es una aplicación para el gimnasio que arma un plan de entrenamiento personalizado con inteligencia artificial, muestra cómo se hace cada ejercicio y lleva el registro de lo que entrenás. Se usa desde el celular: como app de Android o como página web que se instala en la pantalla de inicio, que es la opción para iPhone.

Este documento la explica para alguien que no programa. Describe la app tal como está hoy.


## Qué problema resuelve y para quién

La mayoría de la gente que va al gimnasio entrena con una rutina genérica, impresa o pasada por WhatsApp, que no tiene en cuenta su edad, su experiencia, sus lesiones ni el tiempo que tiene. Pedirle a un profesor una rutina a medida lleva días, y casi nunca se renueva. Además, cuando una máquina está ocupada, no se sabe con qué reemplazar el ejercicio, y como nadie anota los pesos, no hay forma de ver si uno progresa.

GymPlan resuelve eso. Con un cuestionario arma en uno o dos minutos un plan a medida, explica cada ejercicio en español con una animación, propone reemplazos para el mismo músculo y guarda el historial de cada entrenamiento.

Hoy la usan personas que entrenan por su cuenta: el autor y un grupo de amigos, con Android y con iPhone. En el trabajo final de la diplomatura en IA para el management se presenta como una solución para un gimnasio de barrio. Ahí el objetivo es dar un plan personalizado a cada socio sin sumar profesores, para reducir las bajas de los primeros meses.


## Funcionalidades, pantalla por pantalla

### Bienvenida y cuestionario inicial

La primera vez que se abre, la app pide los datos en cinco pasos:

1. Tus datos: nombre (opcional), edad, peso, altura y sexo.
2. Actividad y experiencia: cuánta actividad física hacés hoy, cuánto tiempo hace que entrenás con pesas y si practicás otros deportes.
3. Gimnasio y limitaciones: qué equipamiento tenés disponible, con atajos como "Gimnasio completo", "Gimnasio básico", "En casa (mancuernas)" o "Solo peso corporal"; lesiones o molestias, y ejercicios que no querés hacer.
4. Objetivo y disponibilidad: ganar masa muscular, ganar fuerza, perder grasa, salud general, resistencia o complementar otro deporte; cuántos días por semana y cuántos minutos por sesión.
5. Conectar con Gemini: se pega la clave de la inteligencia artificial. Se puede saltear y cargar después.

Con esos datos la app queda lista para armar el primer plan.

### Plan

Es la pantalla principal.

- Crear un plan nuevo: se eligen días por semana, minutos por sesión, objetivo y cantidad de ejercicios por día. La cantidad puede quedar en "Auto", que la calcula según el tiempo y el objetivo; por ejemplo, 8 a 9 ejercicios para 75 minutos de hipertrofia. Hay un campo de comentarios libres donde se escribe todo lo que personaliza el plan: zonas a priorizar, días con menos tiempo, máquinas que preferís, molestias, otros deportes.
- Ver el plan: pestañas por día, con el enfoque y la duración estimada, el calentamiento, la lista de ejercicios y la vuelta a la calma. Cada ejercicio muestra series, repeticiones, descanso, una nota de técnica y lo que hiciste la última vez (por ejemplo, "Última vez: 60×10, 60×8").
- Editar a mano: cambiar series, repeticiones o descanso, quitar un ejercicio o agregar uno buscándolo en el catálogo.
- Cambiar un ejercicio (por ejemplo, si la máquina está ocupada), con tres opciones: alternativas del mismo músculo ordenadas por parecido (con un filtro para ver solo las de tu equipamiento), una sugerencia de la IA con el motivo, o una búsqueda libre. Se mantienen las series, repeticiones y descanso.
- Recomendaciones: un botón abre el resumen del plan, cómo progresar semana a semana y las precauciones según el perfil.
- Actualizar plan: arma el plan del mes siguiente con los mismos días, músculos y cantidad de ejercicios, pero con ejercicios nuevos. Por defecto mantiene los básicos (sentadilla, press, remo y similares) para seguir progresando en peso; también se puede pedir que cambie todos. El plan anterior queda guardado.
- Aviso a las 4 semanas: cuando un plan cumple 28 días, la app sugiere actualizarlo. El aviso se puede descartar.
- Varios planes: se pueden guardar varios, elegir cuál está activo y borrar los que no se usan.
- Empezar entrenamiento: abre la pantalla de entrenamiento con el día elegido.

### Entrenamiento en curso

- Una fila por serie con peso y repeticiones, que se completa sola con lo que hiciste la última vez en ese ejercicio.
- Al marcar una serie como hecha arranca el temporizador de descanso. Se le pueden sumar o restar 15 segundos, o saltarlo, y al terminar suena un aviso (y vibra en Android).
- Se pueden agregar o quitar series y cambiar un ejercicio en el momento, con la opción de cambiarlo también en el plan.
- Si se sale de la app, el entrenamiento queda guardado y un aviso arriba permite retomarlo.
- Al terminar, la sesión pasa al historial. Si no se marcó ninguna serie, la app pregunta si se descarta.

### Progreso

- Resumen: entrenamientos de esta semana frente a los días planificados, y total de sesiones.
- Historial de entrenamientos por fecha, con la opción de borrar uno.
- Evolución por ejercicio: un gráfico del peso máximo o del 1RM estimado (el peso que podrías levantar una sola vez), con la mejor serie de cada sesión. Los ejercicios con peso corporal no tienen gráfico de peso.

### Buscar

- Buscador en español: por ejemplo "press banca inclinado", "sentadilla" o "jalón al pecho". Busca en los 876 ejercicios del catálogo por nombre, músculo y equipamiento.
- "Buscar con IA": si la búsqueda no encuentra lo que querés, Gemini interpreta lo que escribiste y propone ejercicios del catálogo.
- Al tocar un ejercicio se abre su ficha, igual que desde el plan.

### Ficha de ejercicio (desde el plan, el buscador o la galería)

- Animación del movimiento, armada con las fotos de la posición inicial y final.
- Dibujo del cuerpo de frente y de espalda, con el músculo principal pintado fuerte y los secundarios más suave. Si el perfil dice "Femenino", se dibuja un cuerpo de mujer.
- Nombre en español, con el original en inglés debajo; músculos, equipamiento, nivel y tipo de ejercicio.
- Pasos de cómo se hace, en español. Hay un botón para ver el texto original en inglés y otro, "Traducir con IA", por si se quiere otra traducción hecha por Gemini.
- Botón para buscar videos del ejercicio en YouTube.

### Galería

La primera vez que se abre un ejercicio, la app arma un GIF animado con sus fotos y lo guarda en el teléfono. La galería muestra todos los guardados, con un filtro por nombre, músculo o equipamiento, y permite quitarlos. Esos GIFs se ven aunque no haya internet.

### Ajustes

- Mi perfil: volver a editar los datos del cuestionario.
- Gemini: cargar o cambiar la clave, elegir el modelo ("Automático", recomendado, o uno fijo) y el botón "Probar key y cargar modelos" para verificar que la clave funciona.
- App para Android: solo aparece al usar la versión web desde un Android, con el botón para descargar la app.
- Datos: borrar todo lo guardado en el teléfono (perfil, planes, historial, galería y clave).

### Avisos de instalación

En la versión web, la app muestra arriba un aviso según el teléfono. En iPhone explica cómo agregarla a la pantalla de inicio desde Safari; en Android ofrece descargar la app. El aviso se puede cerrar.


## Qué inteligencia artificial usa y para qué

La app usa Gemini, el modelo de inteligencia artificial generativa de Google, a través de su API (el servicio que Google ofrece para que otras aplicaciones usen el modelo). Cada persona carga una clave propia, que se saca gratis en Google AI Studio (aistudio.google.com). El uso gratuito tiene límites que fija Google.

El modelo se elige solo. En "Automático", la app consulta qué modelos de Gemini tiene disponibles la clave y usa la versión estable más nueva de la línea Flash, la más rápida y económica. Si Google retira un modelo, la app elige otro y reintenta. Si el modelo está saturado, espera, reintenta y prueba hasta con cinco modelos alternativos antes de mostrar un aviso. La respuesta se pide "en partes" (streaming), para que la conexión no se corte mientras Gemini arma un plan largo.

Las tareas que hace con IA son cinco:

1. Armar el plan: recibe el perfil, el pedido (días, minutos, objetivo, cantidad de ejercicios, comentarios) y el catálogo de ejercicios disponibles según el equipamiento, y devuelve el plan completo con días, ejercicios, series, repeticiones, descansos, notas, calentamiento, progresión y precauciones.
2. Actualizar el plan: recibe el plan actual y arma el del mes siguiente con la misma estructura y ejercicios nuevos.
3. Sugerir reemplazos: propone ejercicios alternativos para el mismo músculo, con el motivo de cada uno.
4. Buscar con IA: interpreta una búsqueda escrita con palabras propias y devuelve ejercicios del catálogo.
5. Traducir con IA: traduce el nombre y los pasos de un ejercicio, a pedido, desde la ficha.

Gemini solo puede elegir ejercicios del catálogo de la app. Así no inventa movimientos, y todos tienen animación e instrucciones. La app controla cada respuesta. Si un ejercicio no existe en el catálogo, busca el más parecido. Si falta cantidad de ejercicios o se repiten demasiados del plan anterior, le pide a Gemini que lo corrija una vez.

Hay partes que no usan IA: el cálculo de cuántos ejercicios entran según el tiempo, la búsqueda normal, las alternativas del mismo músculo, el registro de entrenamientos y los gráficos. Los nombres y pasos de los 876 ejercicios se tradujeron al español una sola vez y vienen incluidos en la app, así que leerlos no consume IA ni requiere internet. Esa traducción es automática y puede tener términos para corregir.

Para no gastar cuota de más, las respuestas de las búsquedas con IA, las sugerencias de reemplazo y las traducciones quedan guardadas: repetir la misma consulta no vuelve a llamar a Gemini.


## Qué datos guarda y dónde

Todos los datos quedan guardados solamente en el teléfono de cada persona, dentro de la app o del navegador. No hay un servidor propio ni cuentas de usuario, y nadie más puede ver los datos.

Lo que se guarda es:

- el perfil del cuestionario;
- los planes y cuál está activo;
- el historial de entrenamientos y el entrenamiento en curso;
- los ajustes, incluida la clave de Gemini y el modelo elegido;
- las respuestas de IA guardadas para no repetir consultas;
- los GIFs de la galería.

Lo único que sale del teléfono es lo que se le manda a Google para que Gemini responda: el perfil, el pedido y los comentarios del plan, o la búsqueda que se escribe. Eso se procesa según las condiciones de uso de Google para la API de Gemini. Las fotos de los ejercicios se descargan de internet la primera vez y después quedan en la galería.

Esto tiene consecuencias prácticas:

- Los datos no pasan de un teléfono a otro, ni de la versión web a la app de Android.
- Si se desinstala la app o se borran los datos del navegador, se pierde todo, porque no hay copia en la nube.
- En iPhone, si la web se usa desde Safari sin agregarla a la pantalla de inicio, el sistema puede borrar los datos después de varios días sin uso.


## Con qué tecnologías está hecha

- La interfaz está hecha con React, una biblioteca para construir pantallas web, y empaquetada con Vite.
- La app de Android se genera a partir de esa misma web con Capacitor, una herramienta que la convierte en una app instalable.
- La versión web funciona como app instalable y sin conexión (lo que se llama PWA), gracias a un archivo de configuración y un "service worker" que guarda la app en el teléfono.
- El catálogo de ejercicios viene de free-exercise-db, una base libre de uso, con 876 ejercicios, fotos e instrucciones.
- Los GIFs se arman en el teléfono con gifenc, y el dibujo del cuerpo usa react-muscle-highlighter. Las dos son bibliotecas gratuitas de código abierto.
- El código está guardado en GitHub, y cada cambio se compila y publica solo con GitHub Actions: la página web y el archivo de Android se generan de nuevo en unos minutos.
- La app de Android se firma siempre con la misma clave. Así, cada versión nueva se instala encima de la anterior sin borrar los datos.


## Dónde está publicada

- Versión web, para iPhone, PC o cualquier celular: https://turuleca82.github.io/
- App de Android (archivo para descargar e instalar): https://turuleca82.github.io/GymPlan.apk. También está en https://github.com/Turuleca82/turuleca82.github.io/releases/download/apk/GymPlan.apk

Las dos se publican desde la cuenta Turuleca82 de GitHub, en GitHub Pages, que es gratis. No está publicada en Google Play ni en el App Store. Por eso, al instalar el archivo en Android hay que permitir la instalación desde el navegador, y Play Protect puede mostrar un aviso.

El código original se desarrolló en el repositorio marcosneme1/garmin-sync, carpeta gym-app. Desde ahí se genera una primera versión de la app de Android, que se instala como una app distinta de la publicada en Turuleca82. La que se usa y comparte hoy es la de Turuleca82.


## Funcionalidades pendientes o en idea

Quedaron conversadas pero no están hechas:

- Exportar e importar datos: un botón en Ajustes para guardar en un archivo el perfil, los planes y el historial, y recuperarlos al cambiar de teléfono o reinstalar. Hoy no hay forma de respaldar los datos.
- Dibujo de músculos en las listas: mostrarlo en chico en el plan y en los resultados de búsqueda, además de en la ficha del ejercicio.
- Plazo del aviso de actualización configurable: hoy son 4 semanas fijas.
- Respetar los comentarios sin reintentar: cuando los comentarios piden menos ejercicios en un día (por ejemplo, "los martes tengo 40 minutos"), hoy la app igual le vuelve a pedir a Gemini la cantidad completa.
- Respuestas más rápidas de Gemini: si los cortes de conexión en planes largos siguen, achicar lo que se le manda y pedirle que "piense" menos. Está pendiente de confirmar la causa con el detalle que ahora muestra el mensaje de error.
- Publicación en Google Play: se habló como posibilidad de comercializarla; no se avanzó.
- Revisión de la traducción del catálogo por una persona.

Surgieron del trabajo final de la diplomatura y no están implementadas:

- Clave de Gemini centralizada a cargo del gimnasio, con un servicio intermedio en la nube para no exponerla, en lugar de que cada socio cargue la suya.
- Modelo predictivo que use el registro de entrenamientos para anticipar qué socios están en riesgo de abandonar.
- Uso por parte de los profesores: ver los planes y el progreso de cada socio. Hoy no es posible, porque los datos quedan solo en el teléfono de cada uno.

Quedan fuera de alcance por ahora: cobro de cuotas, reserva de turnos, cuentas de usuario y sincronización entre dispositivos.
