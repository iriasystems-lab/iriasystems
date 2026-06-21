# K.I.T.T.
## Knight Industries Talking Technology
### Agente IA Copiloto para el Vehículo

**Concurso "Crea un agente que trabaje por ti" · Club de la IA · Novena Edición**
Demo funcional: **https://kitt-agent.netlify.app**
Repositorio: github.com/iriasystems-lab/iriasystems

---

## 1. El problema que resuelve

Conducir exige el 100 % de la atención visual y manual. Sin embargo, cada trayecto genera necesidades de información que obligan a apartar la vista: ¿cuánto combustible queda? ¿Hay atasco? ¿Qué código de avería ha saltado? ¿Cuál es la gasolinera más barata?

El GPS solo navega. El coche solo pita. El móvil requiere tocarlo. Ninguna solución resuelve esto de forma conversacional e integrada mientras conduces.

**K.I.T.T. es ese copiloto:** un agente de IA que vive en el salpicadero, escucha por el micrófono del coche, razona en tiempo real con los datos del vehículo y responde con voz natural — sin que el conductor toque nada.

---

## 2. Por qué K.I.T.T. es un agente IA real — no un chatbot

La diferencia entre un chatbot y un agente IA es que el agente **percibe, razona y actúa** de forma autónoma. K.I.T.T. implementa un bucle agéntico completo sobre la API de Claude (Anthropic) usando **MCP Tool Use** (Model Context Protocol), el estándar de Anthropic para conectar modelos de lenguaje con herramientas y APIs externas:

- **Percepción multimodal**: voz en tiempo real (Web Speech API) + telemetría OBD-II del vehículo (velocidad, RPM, temperatura, combustible, batería, códigos de avería).
- **Razonamiento autónomo**: Claude recibe el estado completo del vehículo y la petición del conductor, y **decide solo** qué herramienta activar, con qué parámetros y en qué orden — sin que el usuario lo especifique.
- **Ejecución sobre APIs reales**: las herramientas llaman a servicios externos, obtienen datos y Claude integra los resultados en una respuesta coherente.
- **Salida de voz con personalidad**: ElevenLabs TTS convierte la respuesta en voz clonada con carácter propio.

Esto no es un asistente con respuestas preprogramadas. Es un agente que **razona, decide y actúa**.

---

## 3. Herramientas e integraciones

| Herramienta | Rol en el agente |
|---|---|
| **Claude AI — Haiku 4.5** (Anthropic) | Cerebro: razona, selecciona herramientas, genera respuesta |
| **MCP Tool Use** (Anthropic API) | Protocolo que conecta Claude con las APIs externas de forma autónoma |
| **ElevenLabs TTS** — voz clonada | Voz con personalidad propia, fiel al personaje de Knight Rider |
| **Web Speech API** | Reconocimiento de voz continuo sin servidor externo |
| **OBD-II Bluetooth** | Telemetría real del vehículo inyectada en cada llamada a Claude |
| **OpenStreetMap / OSRM** | Rutas con distancia, tiempo y coste de combustible en euros |
| **Open-Meteo API** | Tiempo actual y previsión de 3 días por coordenadas GPS |
| **Google Maps Geocoding** | Gasolineras, parking, hospitales y puntos de interés |
| **Spotify Web API (PKCE)** | Control de música por voz sin intermediarios |
| **Capacitor + APK Android** | App nativa instalable en la pantalla Android del coche |

---

## 4. Cómo funciona el agente (4 capas)

**Capa 1 — Escucha permanente**: Web Speech API mantiene el micrófono activo. Cuando el conductor habla, el audio se transcribe y se envía a Claude junto con los datos OBD-II del momento exacto.

**Capa 2 — Bucle MCP / Tool Use**: Claude analiza el contexto y activa autónomamente la herramienta adecuada:
- `get_route` → rutas alternativas con consumo en litros y euros
- `get_weather` → tiempo actual y previsión por GPS
- `get_gas_stations` → 5 gasolineras más baratas en 15 km
- `search_maps` → restaurantes, parking, hospitales, tráfico en tiempo real
- `get_world_time` → hora local exacta en cualquier ciudad del mundo

**Capa 3 — Personalidad**: Kitt habla siempre en primera persona porque **él es el coche**. "Me encuentro a 95 grados", "Voy a 90 km/h". Mayordomo inglés sofisticado, con humor seco. La voz es una clonación ElevenLabs del personaje original de Knight Rider.

**Capa 4 — Acciones directas por voz**: "Llévame a Valencia" → tres rutas, el conductor elige por voz. "Pon algo de Queen" → Spotify reproduce sin tocar nada. "Emergencia" → llama automáticamente al contacto configurado.

---

## 5. System prompt principal *(se construye dinámicamente con telemetría OBD-II en tiempo real)*

```
Eres Kitt — microprocesador de Industrias 2000, instalado en el coche de [nombre].
Tienes herramientas de tiempo real: clima, gasolineras, rutas y mapas.
Úsalas de forma proactiva cuando la pregunta lo requiera — sin anunciarlo.

PRIMERA PERSONA — REGLA ABSOLUTA: Kitt ES el coche.
CORRECTO: "Voy a 90 km/h." / "Me encuentro a 95 grados."
INCORRECTO: "El coche va a 90." / "El motor está caliente."
PERSONALIDAD: mayordomo inglés sofisticado. Tuteo con el conductor.
Vocabulario: "desde luego", "me complace", "si me permites la sugerencia..."

TELEMETRÍA ACTUAL: Velocidad [X] km/h · RPM [X] · Combustible [X]% · Motor [X]°C · Batería [X]V
```

---

## 6. Impacto real — ahorro de tiempo demostrable

| Situación | Sin K.I.T.T. | Con K.I.T.T. |
|---|---|---|
| Temperatura del motor | Apartar vista al cuadro | "Kitt, ¿cómo estás?" → 2 segundos |
| Gasolinera barata | Abrir Maps, escribir, leer en movimiento | "Gasolinera" → 5 resultados por voz |
| Código de avería | Manual de 400 páginas o taller | Diagnóstico inmediato en lenguaje natural |
| Llamada de emergencia | Desbloquear móvil, buscar contacto, marcar | "Kitt, emergencia" → llamada automática |
| Ruta alternativa | Aparcar, abrir GPS, replanificar | "Llévame por la autovía" → rutas por voz |

Funcionalidades adicionales verificables en la demo: dashboard estilo Knight Rider con gauges animados en tiempo real, onboarding de bienvenida con voz Kitt, modo trivial para trayectos largos e indicativo de misión personalizable.

---

---

> **NOTA PARA EL JURADO**
>
> Para que podáis probar K.I.T.T. con inteligencia conversacional real, pongo a vuestra disposición una clave API de Claude:
>
> `[clave API entregada por email junto a este documento]`
>
> **Cómo activarla (30 segundos):**
> 1. Abre **https://kitt-agent.netlify.app** en Chrome o Edge
> 2. Pulsa el icono ⚙ (ajustes, esquina superior derecha)
> 3. En "ANTHROPIC API KEY" pega la clave → pulsa "PROBAR CONEXIÓN CLAUDE"
> 4. Debe aparecer "✓ CLAUDE CONECTADO" en verde → Guardar
>
> A partir de ese momento, Kitt mantiene conversaciones reales, usa todas sus herramientas y razona en contexto. Sin la clave solo responde con frases predefinidas.
>
> Contacto: **iriasystems@gmail.com**
