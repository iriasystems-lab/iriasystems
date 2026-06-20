// Route calculation — Nominatim geocoding + OSRM routing (free, no API key needed)
// BMW 218i fuel consumption: autopista 5.5 · carretera 6.0 · ciudad 8.8 L/100km
const PRICE_PER_LITER = 1.55

async function geocode(address) {
  const res  = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&accept-language=es`,
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

  const { from_lat, from_lon, to } = event.queryStringParameters || {}
  if (!from_lat || !from_lon || !to) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing from_lat, from_lon or to' }) }
  }

  const fLat = parseFloat(from_lat)
  const fLon = parseFloat(from_lon)

  try {
    const dest = await geocode(to)
    if (!dest) {
      return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: `Destino "${to}" no encontrado` }) }
    }

    const routeRes  = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${fLon},${fLat};${dest.lon},${dest.lat}?overview=false`
    )
    const routeData = await routeRes.json()
    if (routeData.code !== 'Ok' || !routeData.routes.length) {
      return { statusCode: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'No route found' }) }
    }

    const route   = routeData.routes[0]
    const distKm  = Math.round(route.distance / 100) / 10
    const durMin  = Math.round(route.duration / 60)

    // Fuel estimate based on distance type
    const cons    = distKm > 100 ? 5.5 : distKm > 30 ? 6.0 : 8.8
    const fuelL   = parseFloat(((distKm / 100) * cons).toFixed(1))
    const fuelEuros = parseFloat((fuelL * PRICE_PER_LITER).toFixed(2))

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
      body: JSON.stringify({
        destination: dest.name,
        distanceKm:  distKm,
        durationMin: durMin,
        fuelLiters:  fuelL,
        fuelEuros,
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
