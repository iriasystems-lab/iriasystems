// Open-Meteo — free, no API key, uses AEMET/national weather service data
const WMO_ES = {
  0: 'cielo despejado', 1: 'principalmente despejado', 2: 'parcialmente nublado', 3: 'cielo cubierto',
  45: 'niebla', 48: 'niebla con escarcha',
  51: 'llovizna ligera', 53: 'llovizna moderada', 55: 'llovizna densa',
  61: 'lluvia ligera', 63: 'lluvia moderada', 65: 'lluvia intensa',
  71: 'nieve ligera', 73: 'nieve moderada', 75: 'nieve intensa',
  77: 'granizo',
  80: 'chubascos ligeros', 81: 'chubascos moderados', 82: 'chubascos violentos',
  85: 'nevadas ligeras', 86: 'nevadas intensas',
  95: 'tormenta eléctrica', 96: 'tormenta con granizo', 99: 'tormenta fuerte con granizo',
}

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export async function getWeatherByCoords(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,weather_code` +
    `&wind_speed_unit=kmh&timezone=auto`
  const res  = await fetch(url, { signal: AbortSignal.timeout(6000) })
  const data = await res.json()
  const c    = data.current
  return {
    temp:      Math.round(c.temperature_2m),
    sensacion: Math.round(c.apparent_temperature),
    humedad:   Math.round(c.relative_humidity_2m),
    viento:    Math.round(c.wind_speed_10m),
    lluvia:    c.precipitation,
    desc:      WMO_ES[c.weather_code] ?? 'variable',
  }
}

export async function getWeatherForecast(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,wind_speed_10m_max` +
    `&timezone=auto&forecast_days=7`
  const res  = await fetch(url, { signal: AbortSignal.timeout(6000) })
  const data = await res.json()
  return data.daily
}

export function weatherToSpeech(w, lugar) {
  const loc       = lugar ? `En ${lugar}` : 'Ahora mismo aquí'
  const sensacion = Math.abs(w.sensacion - w.temp) > 2 ? `, sensación térmica de ${w.sensacion}°C` : ''
  const lluvia    = w.lluvia > 0 ? `, con ${w.lluvia} mm de precipitación` : ''
  const viento    = w.viento > 30 ? `, viento a ${w.viento} km/h` : ''
  return `${loc}: ${w.desc}, ${w.temp}°C${sensacion}${lluvia}${viento}.`
}

export function forecastToSpeech(daily, lugar, days = 3) {
  if (!daily?.time?.length) return 'No tengo datos de previsión disponibles.'
  const loc  = lugar ? `en ${lugar}` : 'aquí'
  const capped = Math.min(days, daily.time.length - 1, 7)
  let msg = `Previsión ${loc}: `
  for (let i = 1; i <= capped; i++) {
    const d      = new Date(daily.time[i] + 'T12:00:00')
    const name   = i === 1 ? 'mañana' : DAY_NAMES[d.getDay()]
    const max    = Math.round(daily.temperature_2m_max[i])
    const min    = Math.round(daily.temperature_2m_min[i])
    const desc   = WMO_ES[daily.weather_code[i]] ?? 'variable'
    const rain   = daily.precipitation_probability_max[i]
    const rainTx = rain > 50 ? `, lluvia ${rain}%` : rain > 30 ? `, posibilidad de lluvia ${rain}%` : ''
    msg += `${name} entre ${min} y ${max} grados, ${desc}${rainTx}. `
  }
  return msg.trim()
}

export function extractWeatherIntent(input) {
  const q = input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (!/tiempo|lluvia|llueve|temperatura|nieve|nieva|tormenta|calor|frio|clima|grados|cielo|meteorologia|viento|prevision|manana|semana|proximos/.test(q)) return null

  const isForecast = /manana|semana|proximos dias|esta semana|prevision|pronostico|va a (llover|nevar|hacer)|tiempo para|tiempo que hara|hara manana|fin de semana/.test(q)
  const isMañana   = /\bmanana\b/.test(q)
  const days       = /semana|7 dias|siete dias|toda la semana|proximos 7/.test(q) ? 7
    : /proximos (3|tres)|3 dias/.test(q) ? 3
    : isMañana ? 1
    : isForecast ? 3
    : 1

  // Strip trailing temporal phrases to clean up extracted location
  const cleanLoc = (raw) => raw
    .replace(/\s+(los\s+)?(proximos?\s+(dias?|\d+\s*dias?)|esta\s+semana|el\s+fin\s+de\s+semana|manana|hoy|esta\s+tarde|semana\s+que\s+viene|semana|7\s+dias).*$/i, '')
    .trim()

  const triggers = [
    'tiempo en ', 'tiempo que hace en ', 'que tiempo hace en ', 'temperatura en ',
    'clima en ', 'como esta el tiempo en ', 'esta lloviendo en ', 'llueve en ',
    'hace calor en ', 'hace frio en ', 'el tiempo en ', 'prevision en ',
    'tiempo manana en ', 'que tiempo hara en ', 'va a llover en ',
    'tiempo que va a hacer en ', 'como va a estar el tiempo en ',
    'que tiempo hara en ', 'pronostico en ', 'pronostico para ',
    'tiempo para ', 'prevision para ', 'dias en ', 'proximos dias en ',
    'tiempo esta semana en ', 'fin de semana en ',
  ]
  for (const t of triggers) {
    const idx = q.indexOf(t)
    if (idx !== -1) {
      const raw = input.slice(idx + t.length).trim()
      return { location: cleanLoc(raw) || null, forecast: isForecast, days }
    }
  }

  // Generic fallback: detect "en [City]" anywhere in the query
  const enMatch = q.match(/\ben\s+([a-zà-ɏ][a-zà-ɏ\s]{1,40}?)(?:\s+(?:los\s+proximos?|esta\s+semana|el\s+fin|manana|hoy|el\s+lunes|el\s+martes|el\s+miercoles|el\s+jueves|el\s+viernes)|$)/)
  if (enMatch) {
    const loc = cleanLoc(enMatch[1]).trim()
    if (loc.length > 1) return { location: loc, forecast: isForecast, days }
  }

  return { location: null, forecast: isForecast, days }
}
