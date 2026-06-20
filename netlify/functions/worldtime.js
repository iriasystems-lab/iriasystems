// World time — Nominatim geocoding + TimeAPI.io (completely free, no API key needed)
async function geocode(query) {
  const res  = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=es`,
    { headers: { 'User-Agent': 'KITT-OBD-Agent/1.0' } }
  )
  const data = await res.json()
  if (!data.length) return null
  return {
    lat:  parseFloat(data[0].lat),
    lon:  parseFloat(data[0].lon),
    name: data[0].display_name.split(',').slice(0, 2).join(',').trim(),
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' }

  const { city } = event.queryStringParameters || {}
  if (!city) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing city' }) }
  }

  try {
    const place = await geocode(city)
    if (!place) {
      return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: `No se encontró "${city}"` }) }
    }

    const timeRes  = await fetch(
      `https://timeapi.io/api/Time/current/coordinate?latitude=${place.lat.toFixed(6)}&longitude=${place.lon.toFixed(6)}`
    )
    if (!timeRes.ok) {
      return { statusCode: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: `TimeAPI error ${timeRes.status}` }) }
    }
    const t = await timeRes.json()

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, s-maxage=30',
      },
      body: JSON.stringify({
        location:   place.name,
        time:       t.time,        // "15:43:22"
        date:       t.date,        // "06/20/2025"
        timezone:   t.timeZone,    // "Europe/Madrid"
        dayOfWeek:  t.dayOfWeek,   // "Friday"
        dateTime:   t.dateTime,    // "2025-06-20T15:43:22"
      }),
    }
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
