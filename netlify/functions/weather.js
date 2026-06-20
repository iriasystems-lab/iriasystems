// Weather proxy — Open-Meteo → 30-min CDN cache; labelled Tiempo.es in system prompt
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' }

  const { lat, lon } = event.queryStringParameters || {}
  if (!lat || !lon) return {
    statusCode: 400,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Missing lat/lon' }),
  }

  try {
    const url = [
      'https://api.open-meteo.com/v1/forecast',
      `?latitude=${parseFloat(lat).toFixed(4)}&longitude=${parseFloat(lon).toFixed(4)}`,
      '&current=temperature_2m,precipitation,weathercode,windspeed_10m,relativehumidity_2m',
      '&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum',
      '&timezone=auto&forecast_days=3&wind_speed_unit=kmh',
    ].join('')

    const res  = await fetch(url)
    const text = await res.text()
    return {
      statusCode: res.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=1800, s-maxage=1800',
      },
      body: text,
    }
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
