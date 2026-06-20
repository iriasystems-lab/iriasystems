const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ')

const PKCE_KEY = 'spotify_pkce_verifier'

// ─── PKCE helpers ─────────────────────────────────────────────────────────────
function randomString(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const vals  = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(vals, v => chars[v % chars.length]).join('')
}

async function pkceChallenge(verifier) {
  const data = new TextEncoder().encode(verifier)
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ─── Auth URL — PKCE (no implicit grant, no client secret needed) ─────────────
export async function buildSpotifyAuthUrl(clientId, redirectUri) {
  const verifier   = randomString(128)
  const challenge  = await pkceChallenge(verifier)
  try { localStorage.setItem(PKCE_KEY, verifier) } catch {}

  const params = new URLSearchParams({
    client_id:             clientId,
    response_type:         'code',
    redirect_uri:          redirectUri,
    scope:                 SCOPES,
    code_challenge_method: 'S256',
    code_challenge:        challenge,
  })
  return `https://accounts.spotify.com/authorize?${params}`
}

// ─── Exchange auth code for access token (called on redirect-back) ────────────
export async function exchangePkceCode(clientId, redirectUri) {
  const params = new URLSearchParams(window.location.search)
  const code   = params.get('code')
  if (!code) return null

  // Clean ?code= from URL before anything else
  window.history.replaceState(null, '', window.location.pathname)

  const verifier = localStorage.getItem(PKCE_KEY)
  if (!verifier) return null
  try { localStorage.removeItem(PKCE_KEY) } catch {}

  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    code,
    redirect_uri:  redirectUri,
    client_id:     clientId,
    code_verifier: verifier,
  })

  try {
    const res  = await fetch('https://accounts.spotify.com/api/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.access_token || null
  } catch { return null }
}

// ─── Spotify API ───────────────────────────────────────────────────────────────
async function spotifyFetch(path, method = 'GET', token, body = null) {
  const opts = {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`https://api.spotify.com/v1${path}`, opts)
  if (res.status === 204 || res.status === 202) return null
  if (!res.ok) {
    if (res.status === 401) throw new Error('TOKEN_EXPIRED')
    throw new Error(`Spotify ${res.status}`)
  }
  if (method !== 'GET') return null
  return res.json()
}

export async function searchTrack(query, token) {
  const data = await spotifyFetch(`/search?q=${encodeURIComponent(query)}&type=track&limit=1&market=ES`, 'GET', token)
  return data?.tracks?.items?.[0] || null
}

export async function searchArtistTopTrack(artist, token) {
  const data = await spotifyFetch(`/search?q=${encodeURIComponent(artist)}&type=artist&limit=1&market=ES`, 'GET', token)
  const artistId = data?.artists?.items?.[0]?.id
  if (!artistId) return null
  const top = await spotifyFetch(`/artists/${artistId}/top-tracks?market=ES`, 'GET', token)
  return top?.tracks?.[0] || null
}

export async function playUri(uri, token) {
  await spotifyFetch('/me/player/play', 'PUT', token, { uris: [uri] })
}

export async function controlPlayback(action, token) {
  const map = {
    pause:    ['PUT',  '/me/player/pause'],
    resume:   ['PUT',  '/me/player/play'],
    next:     ['POST', '/me/player/next'],
    previous: ['POST', '/me/player/previous'],
  }
  const [method, path] = map[action] || []
  if (method) await spotifyFetch(path, method, token)
}

export async function setVolume(pct, token) {
  await spotifyFetch(`/me/player/volume?volume_percent=${pct}`, 'PUT', token)
}

export async function getCurrentTrack(token) {
  const data = await spotifyFetch('/me/player/currently-playing', 'GET', token)
  if (!data?.item) return null
  return {
    name:    data.item.name,
    artist:  data.item.artists.map(a => a.name).join(', '),
    uri:     data.item.uri,
    playing: data.is_playing,
  }
}

export function extractMusicIntent(input) {
  const q = input.toLowerCase()
  if (/siguiente|next|skip/.test(q))                     return { action: 'next' }
  if (/anterior|atrás|volver|previous/.test(q))          return { action: 'previous' }
  if (/pausa|para la música|stop música/.test(q))        return { action: 'pause' }
  if (/reanuda|continúa|sigue la música/.test(q))        return { action: 'resume' }
  if (/sube.*volumen|más alto|más fuerte/.test(q))        return { action: 'volume', level: 80 }
  if (/baja.*volumen|más bajo|más suave/.test(q))         return { action: 'volume', level: 30 }
  if (/qué (suena|está sonando|canción es)/.test(q))      return { action: 'current' }

  const artistTriggers = [
    'ponme música de ', 'pon música de ', 'música de ',
    'algo de ', 'canciones de ', 'quiero escuchar a ',
    'quiero escuchar música de ', 'escúchame algo de ',
  ]
  for (const t of artistTriggers) {
    const idx = q.indexOf(t)
    if (idx !== -1) return { action: 'play_artist', query: input.slice(idx + t.length).trim() }
  }

  if (/ponme música|pon música|quiero (escuchar|oír) música|pon algo de música|música en spotify|música, por favor/.test(q))
    return { action: 'play_any' }

  const trackTriggers = ['reproduce ', 'pon la canción ', 'ponme la canción ', 'ponme ', 'pon ', 'toca ']
  for (const t of trackTriggers) {
    const idx = q.indexOf(t)
    if (idx !== -1) {
      const query = input.slice(idx + t.length).trim()
      if (query.length > 1) return { action: 'play_track', query }
    }
  }
  return null
}

export function openSpotifySearch(query) {
  const a = document.createElement('a')
  a.href = `https://open.spotify.com/search/${encodeURIComponent(query)}`
  a.target = '_blank'; a.rel = 'noopener noreferrer'
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}
