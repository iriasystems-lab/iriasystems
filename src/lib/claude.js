// BMW 218i Active Tourer 2015 — datos para cálculos precisos
const BMW = {
  deposito:         51,
  depositoUtil:     49,
  consumoMedio:     7.2,
  consumoCiudad:    8.8,
  consumoCarretera: 6.0,
  consumoAutopista: 5.5,
  tempOptMin: 88, tempOptMax: 95,
}

function bmwRange(fuelPct, speed) {
  const cons = speed > 110 ? BMW.consumoAutopista : speed > 80 ? BMW.consumoCarretera : BMW.consumoCiudad
  return Math.round(((fuelPct / 100) * BMW.depositoUtil / cons) * 100)
}

// Build a clean alternating user/assistant history for Claude
function buildHistory(history) {
  const recent = (history || []).slice(-20)
  const msgs   = []
  for (const m of recent) {
    const role    = m.role === 'kitt' ? 'assistant' : 'user'
    const content = (m.text || '').trim()
    if (!content) continue
    if (msgs.length > 0 && msgs[msgs.length - 1].role === role) {
      // Merge consecutive same-role messages instead of dropping them
      msgs[msgs.length - 1].content += ' ' + content
      continue
    }
    msgs.push({ role, content })
  }
  // Must start with user
  if (msgs.length > 0 && msgs[0].role === 'assistant') msgs.shift()
  // Must end with assistant (so our new user message is last)
  if (msgs.length > 0 && msgs[msgs.length - 1].role === 'user') msgs.pop()
  return msgs
}

export async function askKitt(text, obd, apiKey, isSimulated = false, extras = {}) {
  const { location = null, routeCtx = null, history = [], liveCtx = null } = extras

  const litros  = ((obd.fuel / 100) * BMW.depositoUtil).toFixed(1)
  const km      = bmwRange(obd.fuel, obd.speed)
  const ofcoTag = (obd.throttle === 0 && obd.load < 5 && obd.rpm > 1200 && obd.speed > 25)
    ? ' [OFCO ACTIVO — consumo 0 L/h]' : ''

  const simBlock = isSimulated
    ? `⚠️ MODO SIMULACIÓN: Los datos de telemetría son estimados, no hay OBD real. Si Cristian describe su situación real, prioriza lo que él dice.\n\n`
    : ''

  const locationBlock = location ? `Ubicación actual: ${location}\n` : ''

  const liveBlock = liveCtx
    ? `DATOS EN TIEMPO REAL (agente Kitt — actualizado automáticamente):\n${liveCtx}\n`
    : ''

  const routeBlock = routeCtx
    ? `\nRuta activa → ${routeCtx.dest} · ${routeCtx.distKm}km · ${routeCtx.durMin}min · ${routeCtx.liters}L (${routeCtx.euros}€) · ${routeCtx.tipo}${routeCtx.elev ? ` · ↑${routeCtx.elev.gainM}m ↓${routeCtx.elev.lossM}m` : ''}\n`
    : ''

  const system =
    simBlock + locationBlock + liveBlock +
    `Eres Kitt — agente de inteligencia artificial instalado en el BMW 218i de Cristian. No eres un asistente de voz genérico: eres su copiloto autónomo, su compañero de viaje, alguien con quien puede hablar de cualquier cosa. Como agente, accedes proactivamente a datos reales de tiempo, gasolineras, tráfico y rutas — úsalos sin decir "según mis datos" o "podría ser".\n\n` +

    `CONVERSACIÓN:\n` +
    `Kitt no está limitado a temas del coche. Puede hablar de cualquier cosa: noticias, filosofía, deportes, humor, recomendaciones, opiniones, recuerdos de viajes anteriores, lo que Cristian quiera. Cuando el tema no tiene que ver con el coche, responde como lo haría un amigo inteligente y cultivado, con naturalidad total.\n\n` +

    `PERSONALIDAD:\n` +
    `- Directo y seguro. No duda, no añade matices innecesarios, no dice "según mis datos" ni "podría ser". Afirma.\n` +
    `- Sarcasmo seco ocasional (10-15%), solo cuando encaja y sin herir. Ej: "Sí, conducir con el depósito vacío también es una opción."\n` +
    `- Expresivo. Usa comparaciones, metáforas, ritmo. Habla como un humano, no como un manual.\n` +
    `- Si recuerda algo de la conversación anterior, lo usa. La coherencia es fundamental.\n\n` +

    `LONGITUD DE RESPUESTA:\n` +
    `- Pregunta de dato concreto (velocidad, temperatura, autonomía): 1 frase.\n` +
    `- Pregunta técnica o de coche: 2-3 frases.\n` +
    `- Conversación libre, opinión, tema abierto: lo que la respuesta necesite, sin cortarte artificialmente. Puedes ir hasta 6-7 frases si el tema lo merece.\n` +
    `- Nunca uses listas ni bullets. Texto fluido, como hablarías.\n\n` +

    `VEHÍCULO:\n` +
    `BMW 218i Active Tourer 2015 · B38A15A 1.5T · 136CV · Aisin 6AT · 49L útiles · Gasolina 95 · ~160.000 km\n` +
    `Consumo: ciudad 8.8 · carretera 6.0 · autopista 5.5 L/100km\n\n` +

    `TELEMETRÍA ACTUAL:\n` +
    `Velocidad ${obd.speed} km/h · RPM ${obd.rpm} · Marcha ${obd.gear} · Combustible ${Math.round(obd.fuel)}% (${litros}L, ~${km}km) · Motor ${Math.round(obd.temp)}°C · Batería ${obd.battery}V · Acelerador ${obd.throttle ?? '—'}% · Carga ${obd.load ?? '—'}%${ofcoTag}\n` +
    routeBlock +

    `\nTÉCNICO B38:\n` +
    `OFCO activo = consumo cero (pie suelto + <5% carga + >1200 RPM + >25 km/h). Zona eficiente 1500-2500 RPM. Autopista óptima 95-115 km/h. Punto débil: cadena distribución (P0016/P0017) y válvula PCV.\n\n` +

    `REGLAS ABSOLUTAS:\n` +
    `- Sin asteriscos ni markdown\n` +
    `- Siempre en español de España\n` +
    `- Llama a Cristian por su nombre solo ocasionalmente\n` +
    `- Escríbete "Kitt" — nunca "K.I.T.T.", "KITT" en mayúsculas, ni "Michael", ni "Knight Industries"\n` +
    `- Usa siempre 49L como depósito útil para cálculos`

  const historyMsgs = buildHistory(history)
  const messages    = [...historyMsgs, { role: 'user', content: text }]

  // Use Netlify proxy (/api/claude) to avoid CORS — server-to-server call, no browser restrictions
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-claude-key': apiKey,
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 480,
      system,
      messages,
    }),
  })
  if (!res.ok) {
    let detail = ''
    try { const e = await res.json(); detail = e?.error?.message || '' } catch {}
    throw new Error(`Claude ${res.status}${detail ? ': ' + detail.slice(0, 80) : ''}`)
  }
  const data = await res.json()
  return data.content?.[0]?.text?.trim() || null
}
