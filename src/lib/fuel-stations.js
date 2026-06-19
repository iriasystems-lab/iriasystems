// ─── Gasolineras baratas — API MITECO (Ministerio Transición Ecológica) ──────
// Datos en tiempo real, sin API key, actualización cada hora.
// URL base: https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/

const BASE = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes'

// Mapping: nombre de provincia (normalizado) → ID MITECO
const PROVINCE_IDS = {
  'alava':              '01', 'albacete':           '02', 'alicante':           '03',
  'almeria':            '04', 'avila':              '05', 'badajoz':            '06',
  'baleares':           '07', 'islas baleares':     '07', 'barcelona':          '08',
  'burgos':             '09', 'caceres':            '10', 'cadiz':              '11',
  'castellon':          '12', 'ciudad real':        '13', 'cordoba':            '14',
  'a coruna':           '15', 'coruña':             '15', 'la coruña':          '15',
  'cuenca':             '16', 'girona':             '17', 'granada':            '18',
  'guadalajara':        '19', 'guipuzcoa':          '20', 'huelva':             '21',
  'huesca':             '22', 'jaen':               '23', 'leon':               '24',
  'lerida':             '25', 'lleida':             '25', 'la rioja':           '26',
  'lugo':               '27', 'madrid':             '28', 'malaga':             '29',
  'murcia':             '30', 'navarra':            '31', 'ourense':            '32',
  'orense':             '32', 'asturias':           '33', 'palencia':           '34',
  'las palmas':         '35', 'pontevedra':         '36', 'salamanca':          '37',
  'santa cruz de tenerife': '38', 'tenerife':       '38', 'cantabria':          '39',
  'segovia':            '40', 'sevilla':            '41', 'soria':              '42',
  'tarragona':          '43', 'teruel':             '44', 'toledo':             '45',
  'valencia':           '46', 'valladolid':         '47', 'vizcaya':            '48',
  'bizkaia':            '48', 'zamora':             '49', 'zaragoza':           '50',
  'ceuta':              '51', 'melilla':            '52',
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R   = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function normalizeProv(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/provincia de |province of /gi, '')
    .trim()
}

// Reverse geocode to get province from Nominatim
async function getProvince(lat, lon) {
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es`,
      { headers: { 'User-Agent': 'KITT-OBD-Agent/1.0' } }
    )
    const data = await res.json()
    return data.address?.province || data.address?.state || null
  } catch { return null }
}

// Fetch stations for a province ID and filter by radius
async function fetchStationsByProvince(provId, lat, lon, radioKm, maxResults) {
  const res  = await fetch(`${BASE}/EstacionesTerrestres/FiltroProvincia/${provId}`)
  const data = await res.json()
  const list = data?.ListaEESSPrecio ?? []

  return list
    .map(s => {
      try {
        const sLat  = parseFloat(s['Latitud'].replace(',', '.'))
        const sLon  = parseFloat(s['Longitud (WGS84)'].replace(',', '.'))
        const price = parseFloat((s['Precio Gasolina 95 E5'] || '').replace(',', '.'))
        if (!price || !sLat || !sLon) return null
        const dist = haversineKm(lat, lon, sLat, sLon)
        if (dist > radioKm) return null
        return {
          nombre:   s['Rótulo'] || 'Sin nombre',
          direccion: s['Dirección'] || '',
          municipio: s['Localidad'] || '',
          precio95: price,
          distKm:   parseFloat(dist.toFixed(1)),
          lat: sLat,
          lon: sLon,
        }
      } catch { return null }
    })
    .filter(Boolean)
    .sort((a, b) => a.precio95 !== b.precio95 ? a.precio95 - b.precio95 : a.distKm - b.distKm)
    .slice(0, maxResults)
}

// Main export — find the N cheapest stations within radioKm of a GPS point
export async function findCheapStations(lat, lon, { radioKm = 15, maxResults = 5 } = {}) {
  const provinceName = await getProvince(lat, lon)
  if (!provinceName) throw new Error('No se pudo determinar la provincia')

  const provKey = normalizeProv(provinceName)
  const provId  = PROVINCE_IDS[provKey]
  if (!provId) throw new Error(`Provincia no reconocida: ${provinceName}`)

  return fetchStationsByProvince(provId, lat, lon, radioKm, maxResults)
}

// Format stations for voice
export function stationsToSpeech(stations) {
  if (!stations.length) return 'No encontré gasolineras de gasolina 95 en un radio de 15 kilómetros.'
  const lines = stations.slice(0, 3).map((s, i) =>
    `${i + 1}: ${s.nombre} en ${s.municipio}, a ${s.distKm} km, gasolina 95 a ${s.precio95.toFixed(3).replace('.', ',')} euros.`
  )
  return `Las gasolineras más baratas cerca: ${lines.join(' ')}`
}

// Detect fuel station intent in voice input
export function extractFuelStationIntent(input) {
  const q = input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return /gasolinera|repostar|combustible barato|gasolina barata|donde reposto|carburante|más barata|más barato/.test(q)
}
