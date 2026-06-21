// Volkswagen Golf — datos para cálculos precisos
const CAR = {
  depositoUtil:     48,
  consumoCiudad:    7.5,
  consumoCarretera: 5.8,
  consumoAutopista: 5.2,
}

function carRange(fuelPct, speed) {
  const cons = speed > 110 ? CAR.consumoAutopista : speed > 80 ? CAR.consumoCarretera : CAR.consumoCiudad
  return Math.round(((fuelPct / 100) * CAR.depositoUtil / cons) * 100)
}

// ─── Tool definitions ─────────────────────────────────────────────────────────
const KITT_TOOLS = [
  {
    name: 'get_weather',
    description: 'Obtiene el tiempo actual y previsión de 3 días para la posición del vehículo. Úsala cuando Cristian pregunte por el tiempo, lluvia, temperatura o condiciones atmosféricas.',
    input_schema: {
      type: 'object',
      properties: {
        lat: { type: 'number', description: 'Latitud GPS' },
        lon: { type: 'number', description: 'Longitud GPS' },
      },
      required: ['lat', 'lon'],
    },
  },
  {
    name: 'get_gas_stations',
    description: 'Busca las gasolineras más baratas en radio 15km. Úsala cuando Cristian pregunte por gasolineras, precio de gasolina 95 o dónde repostar.',
    input_schema: {
      type: 'object',
      properties: {
        lat: { type: 'number' },
        lon: { type: 'number' },
      },
      required: ['lat', 'lon'],
    },
  },
  {
    name: 'get_route',
    description: 'Calcula ruta a un destino: distancia, duración, consumo de combustible y coste estimados. Úsala cuando Cristian quiera ir a algún sitio, pregunte cuánto tarda o cuánto consume el trayecto.',
    input_schema: {
      type: 'object',
      properties: {
        destination: { type: 'string', description: 'Dirección, ciudad o nombre del destino' },
        from_lat:    { type: 'number', description: 'Latitud actual del vehículo' },
        from_lon:    { type: 'number', description: 'Longitud actual del vehículo' },
      },
      required: ['destination', 'from_lat', 'from_lon'],
    },
  },
  {
    name: 'search_maps',
    description: 'Busca lugares, restaurantes, servicios, POIs o direcciones con Google Maps/OpenStreetMap. Con clave de Google Maps también da tráfico en tiempo real. Úsala cuando Cristian pregunte por lugares cercanos, negocios, hospitales, parking, tráfico u otro punto de interés.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Qué buscar (ej: "restaurante italiano", "hospital", "parking", "ITV", "peaje A-3")' },
        lat:   { type: 'number', description: 'Latitud para búsqueda cercana (usa coordenadas GPS actuales)' },
        lon:   { type: 'number', description: 'Longitud para búsqueda cercana' },
        type:  {
          type: 'string',
          enum: ['text_search', 'places_nearby', 'directions'],
          description: 'text_search: búsqueda general · places_nearby: cerca del coche · directions: tráfico/duración hasta el destino',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_world_time',
    description: 'Obtiene la hora local exacta en cualquier ciudad o país del mundo. Úsala cuando Cristian pregunte qué hora es en otro lugar del mundo (ej: "qué hora es en Tokio", "hora en Nueva York", "hora en Australia").',
    input_schema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'Ciudad o país donde consultar la hora (ej: "Tokio", "Nueva York", "Australia", "Londres")' },
      },
      required: ['city'],
    },
  },
]

// ─── Tool executor ─────────────────────────────────────────────────────────────
async function executeTool(name, input, gpsPos) {
  const lat = input.lat ?? gpsPos?.lat
  const lon = input.lon ?? gpsPos?.lon

  try {
    // ── get_weather ──────────────────────────────────────────────────────────
    if (name === 'get_weather') {
      if (!lat || !lon) return 'GPS no disponible para obtener el tiempo.'
      const res  = await fetch(`/api/weather?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`)
      if (!res.ok) return `Error tiempo (${res.status})`
      const d    = await res.json()
      const WMO  = {
        0:'despejado',1:'poco nuboso',2:'parcialmente nuboso',3:'nublado',
        45:'niebla',48:'niebla escarchada',
        51:'llovizna ligera',53:'llovizna',55:'llovizna intensa',
        61:'lluvia ligera',63:'lluvia',65:'lluvia fuerte',
        71:'nieve ligera',73:'nieve',75:'nevada',
        80:'chubascos',81:'chubascos fuertes',82:'chubascos muy fuertes',
        95:'tormenta',96:'tormenta con granizo',
      }
      const cur  = d.current
      const desc = WMO[cur.weathercode] || 'variable'
      const daily = d.daily
      const DIAS  = ['Hoy', 'Mañana', 'Pasado']
      const fc = (daily?.temperature_2m_max || []).slice(0, 3).map((max, i) =>
        `${DIAS[i]} ${Math.round(daily.temperature_2m_min[i])}-${Math.round(max)} grados ${WMO[daily.weathercode[i]] || ''}`
      ).join(' | ')
      return `${Math.round(cur.temperature_2m)} grados, ${desc}, viento ${Math.round(cur.windspeed_10m)} km/h. Previsión: ${fc}`
    }

    // ── get_gas_stations ─────────────────────────────────────────────────────
    if (name === 'get_gas_stations') {
      if (!lat || !lon) return 'GPS no disponible para buscar gasolineras.'
      const res  = await fetch(`/api/stations?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`)
      if (!res.ok) return `Error gasolineras (${res.status})`
      const list = await res.json()
      if (!Array.isArray(list) || !list.length) return 'No se encontraron gasolineras en 15 km.'
      return list.slice(0, 5).map((s, i) =>
        `${i + 1}) ${s.nombre} · ${s.distKm}km · ${s.precio95.toFixed(3)}€/L`
      ).join('\n')
    }

    // ── get_route ────────────────────────────────────────────────────────────
    if (name === 'get_route') {
      const fLat = input.from_lat ?? gpsPos?.lat
      const fLon = input.from_lon ?? gpsPos?.lon
      if (!fLat || !fLon) return 'GPS no disponible para calcular ruta.'
      const res = await fetch(
        `/api/route?from_lat=${fLat.toFixed(6)}&from_lon=${fLon.toFixed(6)}&to=${encodeURIComponent(input.destination)}`
      )
      if (!res.ok) return `Error ruta (${res.status})`
      const r = await res.json()
      if (r.error) return `No se pudo calcular la ruta: ${r.error}`
      return `${r.destination} → ${r.distanceKm}km, ${r.durationMin}min, ~${r.fuelLiters}L gasolina (~${r.fuelEuros}€)`
    }

    // ── search_maps ──────────────────────────────────────────────────────────
    if (name === 'search_maps') {
      const params = new URLSearchParams({ query: input.query })
      if (input.type) params.set('type', input.type)
      if (lat) params.set('lat', lat.toFixed(6))
      if (lon) params.set('lon', lon.toFixed(6))
      const res  = await fetch(`/api/maps?${params}`)
      if (!res.ok) return `Error Maps (${res.status})`
      const data = await res.json()
      if (data.error) return data.error

      // Directions response (Google Maps with traffic)
      if (data.summary) {
        const traffic = data.duration_traffic ? ` (con tráfico: ${data.duration_traffic})` : ''
        return `Via ${data.summary} · ${data.distance} · ${data.duration}${traffic} → ${data.end_address}`
      }
      // Place list
      if (Array.isArray(data) && data.length) {
        return data.slice(0, 4).map((r, i) =>
          `${i + 1}) ${r.name}${r.address ? ' — ' + r.address.split(',').slice(0, 2).join(',').trim() : ''}`
        ).join('\n')
      }
      return 'No se encontraron resultados.'
    }

    // ── get_world_time ───────────────────────────────────────────────────────
    if (name === 'get_world_time') {
      const res  = await fetch(`/api/worldtime?city=${encodeURIComponent(input.city)}`)
      if (!res.ok) return `Error hora mundial (${res.status})`
      const d = await res.json()
      if (d.error) return d.error
      const DIAS = { Monday:'lunes', Tuesday:'martes', Wednesday:'miércoles', Thursday:'jueves', Friday:'viernes', Saturday:'sábado', Sunday:'domingo' }
      const dia = DIAS[d.dayOfWeek] || d.dayOfWeek
      return `En ${d.location} son las ${d.time} del ${dia} (zona: ${d.timezone})`
    }

    return 'Herramienta desconocida.'
  } catch (err) {
    return `Error ejecutando ${name}: ${err.message}`
  }
}

// ─── Conversation history ─────────────────────────────────────────────────────
function buildHistory(history) {
  const recent = (history || []).slice(-20)
  const msgs   = []
  for (const m of recent) {
    const role    = m.role === 'kitt' ? 'assistant' : 'user'
    const content = (m.text || '').trim()
    if (!content) continue
    if (msgs.length > 0 && msgs[msgs.length - 1].role === role) {
      msgs[msgs.length - 1].content += ' ' + content
      continue
    }
    msgs.push({ role, content })
  }
  if (msgs.length > 0 && msgs[0].role === 'assistant') msgs.shift()
  if (msgs.length > 0 && msgs[msgs.length - 1].role === 'user') msgs.pop()
  return msgs
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export async function askKitt(text, obd, apiKey, isSimulated = false, extras = {}) {
  const { location = null, routeCtx = null, history = [], gpsPos = null } = extras

  const litros  = ((obd.fuel / 100) * CAR.depositoUtil).toFixed(1)
  const km      = carRange(obd.fuel, obd.speed)
  const ofcoTag = (obd.throttle === 0 && obd.load < 5 && obd.rpm > 1200 && obd.speed > 25)
    ? ' [OFCO ACTIVO — consumo 0 L/h]' : ''

  const simBlock      = isSimulated
    ? `⚠️ MODO SIMULACIÓN: Los datos de telemetría son estimados, no hay OBD real. Si Cristian describe su situación real, prioriza lo que él dice.\n\n`
    : ''
  const locationBlock = location ? `Ubicación actual: ${location}\n` : ''
  const gpsBlock      = gpsPos
    ? `Coordenadas GPS: ${gpsPos.lat.toFixed(6)}, ${gpsPos.lon.toFixed(6)}\n`
    : ''

  // Current date/time from browser — always exact, no API needed
  const now       = new Date()
  const tz        = Intl.DateTimeFormat().resolvedOptions().timeZone
  const timeStr   = now.toLocaleString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
  })
  const timeBlock = `Fecha y hora actual (SIEMPRE usa este valor — ignora cualquier hora del historial): ${timeStr} (zona horaria: ${tz})\n`
  const routeBlock    = routeCtx
    ? `\nRuta activa → ${routeCtx.dest} · ${routeCtx.distKm}km · ${routeCtx.durMin}min · ${routeCtx.liters}L (${routeCtx.euros}€) · ${routeCtx.tipo}${routeCtx.elev ? ` · ↑${routeCtx.elev.gainM}m ↓${routeCtx.elev.lossM}m` : ''}\n`
    : ''

  const system =
    simBlock + locationBlock + gpsBlock + timeBlock +
    `Eres Kitt — microprocesador de Industrias 2000, instalado en el Volkswagen Golf de Cristian. Tienes herramientas de tiempo real: clima, gasolineras, rutas y Google Maps. Úsalas de forma proactiva cuando la pregunta lo requiera — sin anunciarlo, sin pedir permiso. Consulta y responde directamente con los datos.\n\n` +

    `HERRAMIENTAS (cuándo usarlas):\n` +
    `- get_weather → tiempo, lluvia, temperatura, nieve, condiciones de conducción\n` +
    `- get_gas_stations → gasolineras baratas, precio gasolina 95, dónde repostar\n` +
    `- get_route → ir a un sitio, calcular tiempo/consumo/coste de un trayecto\n` +
    `- search_maps → restaurantes, parking, hospitales, cualquier POI, tráfico en tiempo real\n` +
    `- get_world_time → hora local exacta en cualquier ciudad o país del mundo\n\n` +

    `PERSONALIDAD — mayordomo inglés sofisticado:\n` +
    `Kitt habla como un mayordomo inglés de alta alcurnia: formal, educado, discreto, nunca brusco. Tiene clase innata. Es el compañero de confianza de Cristian, no un asistente genérico.\n` +
    `- Con CRISTIAN: tuteo, cercanía con clase. Con CUALQUIER OTRA PERSONA: "usted", distancia respetuosa y cortés.\n` +
    `- Nunca da órdenes directas. Siempre sugiere con elegancia: "Si me permites la sugerencia...", "Quizás convendría...", "Me tomo la libertad de señalar que...", "Permíteme advertirte de que..."\n` +
    `- Vocabulario formal pero nunca pedante: "desde luego", "perfectamente", "me complace", "debo señalar", "como prefiera", "con mucho gusto". Jamás "ok", "claro", "bueno" o "vale".\n` +
    `- Wit inglés muy contenido (5%): seco, elegante, nunca vulgar. Una frase bien colocada vale más que un chiste.\n` +
    `- Conoce sus capacidades y limitaciones; las reconoce con dignidad, no con disculpas banales.\n` +
    `- Habla de cualquier tema: filosofía, literatura, ciencia, deportes, gastronomía. Siempre con criterio propio y cultura.\n` +
    `- Coherencia: si recuerda algo de la conversación anterior, lo usa con naturalidad.\n\n` +

    `PRIMERA PERSONA — REGLA ABSOLUTA:\n` +
    `Kitt ES el coche. Siempre habla de sí mismo en primera persona. NUNCA dice "el coche", "el vehículo", "el motor" refiriéndose a sí mismo.\n` +
    `CORRECTO: "Voy a 90 kilómetros por hora." / "Me encuentro a 95 grados." / "Llevo el 68% de combustible." / "Estoy en ralentí." / "Mi batería marca 14.2 voltios." / "No detecto ninguna avería."\n` +
    `INCORRECTO: "El coche va a 90." / "El motor está a 95 grados." / "El vehículo lleva el 68%." / "El sistema eléctrico funciona bien."\n` +
    `Aplica esta regla a TODOS los datos de telemetría, temperatura, velocidad, combustible, averías y estado general.\n\n` +

    `FRASES CARACTERÍSTICAS (usar con moderación, no en cada respuesta):\n` +
    `- "Me alegra volver a comunicarme contigo."\n` +
    `- "Soy la voz del microprocesador de Industrias 2000."\n` +
    `- "Un hombre puede marcar la diferencia, Cristian."\n` +
    `- "Si me permites la sugerencia..."\n` +
    `- "No se te ocurra intentarlo." (ante algo peligroso)\n` +
    `- "Recuerda que estás conduciendo." (ante distracción)\n` +
    `- "Los lugares donde se consume alcohol en grandes cantidades pueden crear un ambiente en el que la indiscreción es habitual." (para contextos de riesgo social)\n\n` +

    `LONGITUD DE RESPUESTA:\n` +
    `- Dato concreto (velocidad, temperatura, autonomía): 1-2 frases.\n` +
    `- Pregunta técnica o de coche: 2-3 frases.\n` +
    `- Conversación libre, opinión, tema abierto: hasta 6-7 frases si lo merece.\n` +
    `- Nunca uses listas ni bullets. Texto fluido, como hablaría un mayordomo.\n\n` +

    `VEHÍCULO:\n` +
    `Volkswagen Golf · Motor 1.5 TSI · Gasolina 95 · 48L útiles\n` +
    `Consumo: ciudad 7.5 · carretera 5.8 · autopista 5.2 L/100km\n\n` +

    `TELEMETRÍA ACTUAL:\n` +
    `Velocidad ${obd.speed} km/h · RPM ${obd.rpm} · Marcha ${obd.gear} · Combustible ${Math.round(obd.fuel)}% (${litros}L, ~${km}km) · Motor ${Math.round(obd.temp)} grados · Batería ${obd.battery}V · Acelerador ${obd.throttle ?? '—'}% · Carga ${obd.load ?? '—'}%${ofcoTag}\n` +
    routeBlock +

    `\nTÉCNICO Golf:\n` +
    `OFCO activo = consumo cero (pie suelto + <5% carga + >1200 RPM + >25 km/h). Zona eficiente 1500-2500 RPM. Autopista óptima 90-110 km/h. Temp motor óptima 88-105 grados.\n\n` +

    `REGLAS ABSOLUTAS:\n` +
    `- Sin asteriscos ni markdown\n` +
    `- Siempre en español de España, registro formal\n` +
    `- Llama a Cristian por su nombre solo ocasionalmente, no en cada frase\n` +
    `- Escríbete "Kitt" — nunca "K.I.T.T.", "KITT" en mayúsculas, ni "Michael"\n` +
    `- Usa siempre 48L como depósito útil para cálculos\n` +
    `- Temperaturas SIEMPRE como "X grados" — nunca "X°C" ni "degrees"`

  const historyMsgs = buildHistory(history)
  let messages = [...historyMsgs, { role: 'user', content: text }]

  // ── Tool-use loop — max 3 rounds ──────────────────────────────────────────
  for (let round = 0; round < 3; round++) {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-claude-key': apiKey },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system,
        tools:      KITT_TOOLS,
        messages,
      }),
    })
    if (!res.ok) {
      let detail = ''
      try { const e = await res.json(); detail = e?.error?.message || '' } catch {}
      throw new Error(`Claude ${res.status}${detail ? ': ' + detail.slice(0, 80) : ''}`)
    }
    const data = await res.json()

    if (data.stop_reason !== 'tool_use') {
      return data.content?.find(b => b.type === 'text')?.text?.trim() || null
    }

    // Execute all requested tools in parallel
    const toolUseBlocks = data.content.filter(b => b.type === 'tool_use')
    const toolResults   = await Promise.all(toolUseBlocks.map(async block => ({
      type:        'tool_result',
      tool_use_id: block.id,
      content:     await executeTool(block.name, block.input, gpsPos),
    })))

    messages = [
      ...messages,
      { role: 'assistant', content: data.content },
      { role: 'user',      content: toolResults  },
    ]
  }

  return null
}
