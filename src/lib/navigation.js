// ─── BMW 218i fuel constants ────────────────────────────────────────────────
const BMW_CONS = { ciudad: 8.8, urbano: 7.2, carretera: 6.0, autopista: 5.5 }
const FUEL_PRICE = 1.55  // €/L Gasolina 95 — actualizar si cambia

// ─── Geocoding ──────────────────────────────────────────────────────────────
export async function geocodeAddress(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=es`
  const res  = await fetch(url, { headers: { 'User-Agent': 'KITT-OBD-Agent/1.0' } })
  const data = await res.json()
  if (!data.length) return null
  return {
    lat:  parseFloat(data[0].lat),
    lon:  parseFloat(data[0].lon),
    name: data[0].display_name.split(',').slice(0, 2).join(',').trim(),
  }
}

// ─── Map URLs ────────────────────────────────────────────────────────────────
export function getMapsUrls(destination) {
  const enc = encodeURIComponent(destination)
  return {
    ios: `maps://?daddr=${enc}&dirflg=d`,
    web: `https://maps.google.com/?daddr=${enc}&travelmode=driving`,
  }
}

// ─── Route alternatives via OSRM ─────────────────────────────────────────────
export async function getRoutes(fromLat, fromLon, toLat, toLon) {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?alternatives=2&overview=full&geometries=geojson&steps=false`
  const res  = await fetch(url)
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) return []
  return data.routes.map((r, i) => {
    const distKm      = parseFloat((r.distance / 1000).toFixed(1))
    const durationMin = Math.round(r.duration / 60)
    const avgSpeed    = Math.round(distKm / (r.duration / 3600))
    const fuel        = estimateRouteFuel(distKm, avgSpeed)
    return { index: i, distKm, durationMin, avgSpeed, fuel, geometry: r.geometry.coordinates }
  })
}

// ─── Fuel & cost estimate for a route ────────────────────────────────────────
export function estimateRouteFuel(distKm, avgSpeedKmh) {
  const type =
    avgSpeedKmh > 100 ? 'autopista' :
    avgSpeedKmh > 70  ? 'carretera' :
    avgSpeedKmh > 40  ? 'urbano'    : 'ciudad'
  const cons   = BMW_CONS[type]
  const liters = parseFloat((distKm * cons / 100).toFixed(1))
  const euros  = parseFloat((liters * FUEL_PRICE).toFixed(2))
  return { liters, euros, cons, type }
}

// ─── Elevation profile via OpenTopoData (free, no key) ───────────────────────
export async function getElevationGain(coordinates) {
  if (!coordinates?.length) return null
  const N    = Math.min(30, coordinates.length)
  const step = Math.max(1, Math.floor(coordinates.length / N))
  const pts  = []
  for (let i = 0; i < coordinates.length; i += step) pts.push(coordinates[i])
  const locStr = pts.map(([lon, lat]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join('|')
  try {
    const res  = await fetch(
      `https://api.opentopodata.org/v1/srtm90m?locations=${locStr}`,
      { signal: AbortSignal.timeout(7000) }
    )
    const data = await res.json()
    if (data.status !== 'OK') return null
    const elevs = data.results.map(r => r.elevation ?? 0)
    let gain = 0, loss = 0
    for (let i = 1; i < elevs.length; i++) {
      const d = elevs[i] - elevs[i - 1]
      if (d > 0) gain += d; else loss -= d
    }
    return { gainM: Math.round(gain), lossM: Math.round(loss) }
  } catch { return null }
}

// ─── Format duration for voice and UI ─────────────────────────────────────────
export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} minutos`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} hora${h > 1 ? 's' : ''}` : `${h}h ${m}min`
}

// ─── BMW 218i driving tips ─────────────────────────────────────────────────────
export function getDrivingTips(route, fuelPct = 50) {
  const tips = []
  const { avgSpeed, fuel, distKm, elev } = route

  if (fuel.type === 'autopista') {
    tips.push('En autopista, 110 km/h en lugar de 130 reduce el consumo un 15%. Activa el control de crucero.')
    tips.push('Mantén al menos 100 metros de distancia. Evita aceleraciones bruscas que disparan el consumo.')
  } else if (fuel.type === 'carretera') {
    tips.push('Sube a 5ª marcha antes de los 90 km/h. El B38 es más eficiente entre 1500 y 2000 RPM.')
    tips.push('Anticipa curvas y bajadas: suelta el acelerador antes, deja que el coche ruede.')
  } else if (fuel.type === 'urbano' || fuel.type === 'ciudad') {
    tips.push('En ciudad, anticipa semáforos en verde: levanta el pie del acelerador 3 segundos antes.')
    tips.push('Si paras más de 45 segundos, apaga el motor manualmente para ahorrar combustible.')
  }

  if (elev?.gainM > 300) {
    tips.push(`${elev.gainM}m de desnivel acumulado. En subidas largas mantén marcha alta y velocidad constante.`)
  }
  if (elev?.lossM > 300) {
    tips.push(`${elev.lossM}m de bajadas. Usa el freno motor (quita pie acelerador, mantén marcha) en lugar del freno.`)
  }
  if (fuelPct < 20) {
    const litros = parseFloat((fuelPct * 0.34).toFixed(1))
    tips.push(`Combustible al ${Math.round(fuelPct)}% (${litros}L). Esta ruta consume ${fuel.liters}L. Reposta antes.`)
  }

  return tips
}

// ─── Extract destination from natural language ───────────────────────────────
export function extractDestination(input) {
  const q = input.toLowerCase()
  const triggers = [
    'llévame a ', 'llevame a ', 'lleva a ', 'llévame hasta ', 'llevame hasta ', 'llévame hacia ', 'llevame hacia ',
    'cómo llego a ', 'como llego a ', 'cómo voy a ', 'como voy a ', 'cómo llegar a ', 'como llegar a ',
    'ruta a ', 'ruta hacia ', 'ruta hasta ', 'ruta para ',
    'ruta más rápida a ', 'ruta mas rapida a ', 'ruta más corta a ', 'ruta mas corta a ',
    'ruta más económica a ', 'ruta mas economica a ', 'ruta directa a ',
    'enséñame la ruta a ', 'ensename la ruta a ',
    'enséñame la ruta más rápida a ', 'ensename la ruta mas rapida a ',
    'muéstrame la ruta a ', 'muestrame la ruta a ',
    'busca ruta a ', 'busca una ruta a ', 'busca la ruta a ', 'calcula ruta a ', 'calcula la ruta a ',
    'navega a ', 'navega hacia ', 'navega hasta ',
    'vamos a ', 'vamos hacia ',
    'dirígeme a ', 'dirigeme a ', 'dirígeme hacia ', 'dirigeme hacia ',
    'quiero ir a ', 'quiero llegar a ', 'quiero ir hacia ',
    'ir a ',
  ]
  for (const t of triggers) {
    const idx = q.indexOf(t)
    if (idx !== -1) return input.slice(idx + t.length).trim()
  }
  // Regex fallback: "enséñame/muéstrame/busca [la] ruta [más rápida] a DESTINO"
  // q has same length/indices as input (only lowercased), so index maps directly
  const m = q.match(/(?:ense[ñn]ame?|mu[eé]strame?|busca(?:me)?|calcula(?:me)?|indica(?:me)?)\s+(?:la\s+)?ruta\s+(?:(?:m[aá]s\s+)?(?:r[aá]pida|corta|econ[oó]mica|directa)\s+)?(?:a|hacia|hasta|para)\s+/)
  if (m) return input.slice(m.index + m[0].length).trim()
  return null
}

// ─── Extract route choice from voice ─────────────────────────────────────────
export function extractRouteChoice(input) {
  const q = input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/primer|ruta 1|ruta uno|la uno|primera/.test(q))             return 0
  if (/segund|ruta 2|ruta dos|la dos/.test(q))                     return 1
  if (/tercer|ruta 3|ruta tres|la tres/.test(q))                   return 2
  if (/mas rapida|la rapida|menos tiempo|mas corta en tiempo/.test(q)) return 'fastest'
  if (/mas economica|economica|menos gasolina|barata|mas barata|ahorra/.test(q)) return 'cheapest'
  if (/mas corta|menos kilometros|menos km/.test(q))               return 'shortest'
  if (/esa|confirmar|abrir|navegar|abre|si/.test(q))               return 'confirm'
  return null
}

// ─── Legacy single-route (kept for fallback) ─────────────────────────────────
export async function getRoute(fromLat, fromLon, toLat, toLon) {
  const routes = await getRoutes(fromLat, fromLon, toLat, toLon)
  if (!routes.length) return null
  return { distanceKm: routes[0].distKm, durationMin: routes[0].durationMin }
}
