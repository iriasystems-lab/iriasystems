// Maps proxy — Nominatim/OSM for place search (free) + Google Maps Directions for traffic (optional)
// Set GOOGLE_MAPS_KEY env var in Netlify to enable traffic-aware directions
const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY

async function nominatimSearch(query, lat, lon) {
  // Soft geographic bias toward current position without hard-limiting results
  const viewbox  = lat && lon
    ? `&viewbox=${(lon - 1.5).toFixed(4)},${(lat + 1.5).toFixed(4)},${(lon + 1.5).toFixed(4)},${(lat - 1.5).toFixed(4)}&bounded=0`
    : ''
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=es&addressdetails=0${viewbox}`
  const res = await fetch(url, { headers: { 'User-Agent': 'KITT-OBD-Agent/1.0' } })
  const data = await res.json()
  return data.map(r => ({
    name:    r.display_name.split(',').slice(0, 2).join(',').trim(),
    address: r.display_name,
    lat:     parseFloat(r.lat),
    lon:     parseFloat(r.lon),
    type:    r.type,
  }))
}

async function googleDirections(fromLat, fromLon, destination) {
  const url = [
    'https://maps.googleapis.com/maps/api/directions/json',
    `?origin=${fromLat},${fromLon}`,
    `&destination=${encodeURIComponent(destination)}`,
    `&language=es&region=es`,
    `&traffic_model=best_guess&departure_time=now`,
    `&key=${GOOGLE_KEY}`,
  ].join('')
  const res  = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK' || !data.routes.length) return null
  const leg = data.routes[0].legs[0]
  return {
    summary:           data.routes[0].summary,
    distance:          leg.distance.text,
    duration:          leg.duration.text,
    duration_traffic:  leg.duration_in_traffic?.text || null,
    end_address:       leg.end_address,
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' }

  const { type, query, lat, lon } = event.queryStringParameters || {}
  if (!query) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing query' }) }
  }

  const numLat = lat ? parseFloat(lat) : null
  const numLon = lon ? parseFloat(lon) : null

  try {
    let result

    if (type === 'directions') {
      if (!numLat || !numLon) {
        return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'GPS requerido para directions' }) }
      }
      if (GOOGLE_KEY) {
        result = await googleDirections(numLat, numLon, query)
        if (!result) return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Ruta no encontrada en Google Maps' }) }
      } else {
        // Fallback: Nominatim geocode + manual note (no traffic data without key)
        const places = await nominatimSearch(query, numLat, numLon)
        result = places.length
          ? [{ name: places[0].name, address: places[0].address, note: 'Sin clave Google Maps — tráfico no disponible' }]
          : []
      }
    } else {
      // Default: Nominatim text/nearby search
      result = await nominatimSearch(query, numLat, numLon)
    }

    const isEmpty = Array.isArray(result) && result.length === 0
    return {
      statusCode: isEmpty ? 404 : 200,
      headers: {
        'Content-Type':  'application/json',
        'Cache-Control': 'public, max-age=120, s-maxage=120',
      },
      body: JSON.stringify(isEmpty ? { error: 'No se encontraron resultados' } : result),
    }
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
