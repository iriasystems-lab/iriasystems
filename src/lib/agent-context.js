// Agent context — proactive preloading of weather + gas stations for Claude system prompt
// Fetches via Netlify proxies (/api/weather, /api/stations) with CDN caching

const WMO = {
  0:'despejado',1:'poco nuboso',2:'parcialmente nuboso',3:'nublado',
  45:'niebla',48:'niebla escarchada',
  51:'llovizna ligera',53:'llovizna',55:'llovizna intensa',
  61:'lluvia ligera',63:'lluvia',65:'lluvia fuerte',
  71:'nieve ligera',73:'nieve',75:'nevada',
  80:'chubascos',81:'chubascos fuertes',82:'chubascos muy fuertes',
  95:'tormenta',96:'tormenta con granizo',99:'tormenta severa',
}

async function fetchWeatherCtx(lat, lon) {
  try {
    const res = await fetch(`/api/weather?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`)
    if (!res.ok) return null
    const d   = await res.json()
    const cur = d.current
    const desc = WMO[cur.weathercode] || 'variable'
    const daily = d.daily
    const DIAS = ['Hoy','Mañana','Pasado']
    const fc = (daily?.temperature_2m_max || []).slice(0, 3).map((max, i) =>
      `${DIAS[i]} ${Math.round(daily.temperature_2m_min[i])}-${Math.round(max)}°C ${WMO[daily.weathercode[i]] || ''}`
    ).join(' | ')
    return `TIEMPO (Tiempo.es): ${Math.round(cur.temperature_2m)}°C ${desc}, viento ${Math.round(cur.windspeed_10m)} km/h.${fc ? ` Previsión: ${fc}.` : ''}`
  } catch { return null }
}

async function fetchStationsCtx(lat, lon) {
  try {
    const res = await fetch(`/api/stations?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`)
    if (!res.ok) return null
    const stations = await res.json()
    if (!Array.isArray(stations) || !stations.length) return null
    const lines = stations.slice(0, 3).map((s, i) =>
      `${i + 1}) ${s.nombre} ${s.distKm}km ${s.precio95.toFixed(3)}€/L`
    ).join(' · ')
    return `GASOLINERAS BARATAS (FACUA, radio 15km): ${lines}.`
  } catch { return null }
}

export async function buildLiveContext(lat, lon) {
  const [w, s] = await Promise.allSettled([
    fetchWeatherCtx(lat, lon),
    fetchStationsCtx(lat, lon),
  ])
  const parts = [
    w.status === 'fulfilled' && w.value,
    s.status === 'fulfilled' && s.value,
  ].filter(Boolean)
  return parts.length ? parts.join('\n') : null
}
