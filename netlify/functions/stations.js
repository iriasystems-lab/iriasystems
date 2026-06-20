// Gasolineras proxy — MITECO + Nominatim server-side → 1-hour CDN cache
const BASE = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes'

const PROVINCE_IDS = {
  'alava':'01','albacete':'02','alicante':'03','almeria':'04','avila':'05','badajoz':'06',
  'baleares':'07','islas baleares':'07','barcelona':'08','burgos':'09','caceres':'10',
  'cadiz':'11','castellon':'12','ciudad real':'13','cordoba':'14','a coruna':'15',
  'coruña':'15','la coruña':'15','cuenca':'16','girona':'17','granada':'18',
  'guadalajara':'19','guipuzcoa':'20','huelva':'21','huesca':'22','jaen':'23',
  'leon':'24','lerida':'25','lleida':'25','la rioja':'26','lugo':'27','madrid':'28',
  'malaga':'29','murcia':'30','navarra':'31','ourense':'32','orense':'32',
  'asturias':'33','palencia':'34','las palmas':'35','pontevedra':'36','salamanca':'37',
  'santa cruz de tenerife':'38','tenerife':'38','cantabria':'39','segovia':'40',
  'sevilla':'41','soria':'42','tarragona':'43','teruel':'44','toledo':'45',
  'valencia':'46','valladolid':'47','vizcaya':'48','bizkaia':'48','zamora':'49',
  'zaragoza':'50','ceuta':'51','melilla':'52',
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R    = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function normalizeProv(name) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/provincia de |province of /gi, '').trim()
}

async function getProvinceId(lat, lon) {
  const res  = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es`,
    { headers: { 'User-Agent': 'KITT-OBD-Agent/1.0' } }
  )
  const data = await res.json()
  const prov = data.address?.province || data.address?.state || null
  if (!prov) return null
  return PROVINCE_IDS[normalizeProv(prov)] || null
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' }

  const params = event.queryStringParameters || {}
  const lat    = parseFloat(params.lat)
  const lon    = parseFloat(params.lon)
  if (isNaN(lat) || isNaN(lon)) return {
    statusCode: 400,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Missing lat/lon' }),
  }

  try {
    const provId = await getProvinceId(lat, lon)
    if (!provId) return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Province not found' }),
    }

    const res  = await fetch(`${BASE}/EstacionesTerrestres/FiltroProvincia/${provId}`)
    const data = await res.json()
    const list = data?.ListaEESSPrecio ?? []

    const filtered = list
      .map(s => {
        try {
          const sLat  = parseFloat(s['Latitud'].replace(',', '.'))
          const sLon  = parseFloat(s['Longitud (WGS84)'].replace(',', '.'))
          const price = parseFloat((s['Precio Gasolina 95 E5'] || '').replace(',', '.'))
          if (!price || !sLat || !sLon) return null
          const dist = haversineKm(lat, lon, sLat, sLon)
          if (dist > 15) return null
          return {
            nombre:    s['Rótulo'] || 'Sin nombre',
            municipio: s['Localidad'] || '',
            precio95:  price,
            distKm:    parseFloat(dist.toFixed(1)),
          }
        } catch { return null }
      })
      .filter(Boolean)
      .sort((a, b) => a.precio95 !== b.precio95 ? a.precio95 - b.precio95 : a.distKm - b.distKm)
      .slice(0, 5)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
      body: JSON.stringify(filtered),
    }
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
