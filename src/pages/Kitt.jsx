import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import '../kitt-dashboard.css'
import { geocodeAddress, getRoutes, getMapsUrls, extractDestination, estimateRouteFuel, getElevationGain, formatDuration, getDrivingTips, extractRouteChoice } from '../lib/navigation'
import {
  buildSpotifyAuthUrl, exchangePkceCode, searchTrack, searchArtistTopTrack,
  playUri, controlPlayback as spotifyControl, setVolume, getCurrentTrack,
  extractMusicIntent, openSpotifySearch,
} from '../lib/spotify'
import { askKitt } from '../lib/claude'
import { getWeatherByCoords, getWeatherForecast, weatherToSpeech, forecastToSpeech, extractWeatherIntent } from '../lib/weather'
import { OBDWifi } from '../lib/obd-wifi'
import { evaluateRules, getRulePhrase, isOfcoActive, DTC_CODES } from '../lib/obd-advisor'
import { findCheapStations, stationsToSpeech, extractFuelStationIntent } from '../lib/fuel-stations'

// ─── ElevenLabs TTS ───────────────────────────────────────────────────────────
async function elevenLabsSpeak(text, apiKey, voiceId, onStart, onEnd, onError, onAudioReady) {
  try {
    onStart()
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'Accept': 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.45, similarity_boost: 0.88, style: 0.22, use_speaker_boost: true },
      }),
    })
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}`)
    const blob  = await res.blob()
    const url   = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.onended = () => { URL.revokeObjectURL(url); onEnd() }
    audio.onerror = () => { URL.revokeObjectURL(url); onError() }
    const cancelled = onAudioReady?.(audio, url)  // returns true if superseded — don't play
    if (cancelled) return
    await audio.play()
  } catch (err) {
    console.warn('ElevenLabs fallback:', err)
    onError()
  }
}

// ─── Conversation History ─────────────────────────────────────────────────────
const HISTORY_KEY = 'kitt_history'
const HISTORY_TTL = 7 * 24 * 60 * 60 * 1000 // 1 week

function loadHistory() {
  try {
    const raw    = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    const cutoff = Date.now() - HISTORY_TTL
    return raw.filter(m => (m.ts || 0) > cutoff)
  } catch { return [] }
}

// ─── Settings ─────────────────────────────────────────────────────────────────
const STORAGE_KEY       = 'kitt_settings'
const KITT_VOICE_ID     = 's7HQEUgS7KLTKTlXytef'
const ELEVENLABS_KEY    = 'sk_3d922a083955473b539cbf7dcd4a5f21e5e17c078a54ff3f'
const SPOTIFY_CLIENT_ID = 'f933e05e45a540fead4d07bf3310d796'

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    s.voiceId   = KITT_VOICE_ID
    s.apiKey    = ELEVENLABS_KEY
    if (!s.spotifyId)                  s.spotifyId        = SPOTIFY_CLIENT_ID
    if (!s.userName)                   s.userName         = 'Cristian'
    if (s.speedAlertKmh === undefined) s.speedAlertKmh    = 130
    if (s.silentMode === undefined)    s.silentMode       = false
    if (!s.missionCode)                s.missionCode      = ''
    if (!s.emergencyName)              s.emergencyName    = ''
    if (!s.emergencyPhone)             s.emergencyPhone   = ''
    return s
  } catch { return { voiceId: KITT_VOICE_ID, apiKey: ELEVENLABS_KEY, spotifyId: SPOTIFY_CLIENT_ID, userName: 'Cristian', speedAlertKmh: 130, silentMode: false, missionCode: '', emergencyName: '', emergencyPhone: '' } }
}
function saveSettings(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
}
function getSpotifyToken() {
  try { return localStorage.getItem('kitt_sp_token') || null } catch { return null }
}

// ─── First-run onboarding ─────────────────────────────────────────────────────
const SETUP_KEY = 'kitt_agent_setup'
const isFirstRun = () => { try { return !localStorage.getItem(SETUP_KEY) } catch { return false } }
const markSetupDone = () => { try { localStorage.setItem(SETUP_KEY, '1') } catch {} }

// ─── Boot Systems ─────────────────────────────────────────────────────────────
const getBootSystems = () => {
  const name = loadSettings().userName.toUpperCase()
  const pad = Math.max(0, 25 - 10 - name.length)
  return [
    { label: 'PROCESADOR NEURAL.........', dep: 'always' },
    { label: 'SENSORES OBD-II...........', dep: 'obd'    },
    { label: 'MÓDULO DE VOZ.............', dep: 'always' },
    { label: 'SISTEMA DE NAVEGACIÓN.....', dep: 'always' },
    { label: 'DIAGNÓSTICO MOTOR.........', dep: 'obd'    },
    { label: `INTERFAZ ${name}${'.'.repeat(pad)}`, dep: 'always' },
  ]
}

// ─── OBD Scenarios ────────────────────────────────────────────────────────────
const OBD_SCENARIOS = [
  { id: 'parked',  label: 'PARADO',    base: { speed: 0,   rpm: 0,    fuel: 68, temp: 22, battery: 12.4, gear: 'P', throttle: 0,  load: 0  } },
  { id: 'idle',    label: 'RALENTÍ',   base: { speed: 0,   rpm: 750,  fuel: 68, temp: 88, battery: 13.9, gear: 'N', throttle: 0,  load: 12 } },
  { id: 'city',    label: 'CIUDAD',    base: { speed: 40,  rpm: 1800, fuel: 65, temp: 92, battery: 14.1, gear: '2', throttle: 18, load: 35 } },
  { id: 'road',    label: 'CARRETERA', base: { speed: 90,  rpm: 2400, fuel: 61, temp: 94, battery: 14.2, gear: '4', throttle: 20, load: 40 } },
  { id: 'highway', label: 'AUTOPISTA', base: { speed: 120, rpm: 2800, fuel: 57, temp: 95, battery: 14.2, gear: '5', throttle: 22, load: 44 } },
]

function useOBDData(scenarioId) {
  const getBase = (id) => (OBD_SCENARIOS.find(s => s.id === id) || OBD_SCENARIOS[0]).base
  const [obd, setObd] = useState({ ...getBase(scenarioId), dtc: [] })

  useEffect(() => {
    const base = getBase(scenarioId)
    setObd({ ...base, dtc: [] })
    const id = setInterval(() => setObd(p => {
      const range = Math.max(base.speed * 0.22, 6)
      const s = base.speed === 0 ? 0
        : Math.max(Math.max(0, base.speed - range), Math.min(base.speed + range, p.speed + (Math.random() - 0.5) * range * 0.5))
      const r = s < 3
        ? (base.rpm < 100 ? 0 : base.rpm + (Math.random() - 0.5) * 80)
        : Math.max(800, Math.min(7000, base.rpm + (s - base.speed) * 22 + (Math.random() - 0.5) * 180))
      const g = s < 3 ? base.gear : s < 25 ? '1' : s < 50 ? '2' : s < 80 ? '3' : s < 110 ? '4' : '5'
      const th = base.throttle === 0 ? 0
        : parseFloat(Math.max(0, Math.min(100, base.throttle + (Math.random() - 0.5) * 10)).toFixed(1))
      const ld = base.load === 0 ? 0
        : parseFloat(Math.max(0, Math.min(100, base.load + (Math.random() - 0.5) * 12)).toFixed(1))
      return {
        speed:    Math.round(s),
        rpm:      Math.round(r),
        fuel:     Math.max(0, p.fuel - 0.0003),
        temp:     parseFloat(Math.min(97, p.temp + (p.temp < base.temp ? 0.12 : (Math.random() - 0.62) * 0.5)).toFixed(1)),
        battery:  parseFloat((base.battery + (Math.random() - 0.5) * 0.3).toFixed(1)),
        gear:     g,
        throttle: th,
        load:     ld,
        dtc:      p.dtc,
      }
    }), 900)
    return () => clearInterval(id)
  }, [scenarioId]) // eslint-disable-line
  return obd
}

// ─── TypewriterText ───────────────────────────────────────────────────────────
function TypewriterText({ text, speed = 22, onDone }) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    setDisplayed('')
    let i = 0
    const id = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) { clearInterval(id); onDone?.() }
    }, speed)
    return () => clearInterval(id)
  }, [text]) // eslint-disable-line
  return (
    <span style={{ whiteSpace: 'pre-line' }}>
      {displayed}
      <span style={{ opacity: displayed.length < text.length ? 1 : 0, animation: 'blink 1s step-end infinite' }}>█</span>
    </span>
  )
}

// ─── Onboarding Screen ────────────────────────────────────────────────────────
const INTRO_TEXT = `ENLACE CON K.I.T.T. ESTABLECIDO.\n\nSoy la voz del microprocesador de Industrias 2000.\n\nHas sido seleccionado para el programa. A partir de este momento no conduces solo: soy tu copiloto, tu sistema de navegación y tu inteligencia de misión.\n\nAntes de iniciar la primera patrulla, necesito identificarte.`

function OnboardingScreen({ onComplete }) {
  const [phase, setPhase]         = useState(0)
  const [introDone, setIntroDone] = useState(false)
  const [userName, setUserName]   = useState('')
  const [claudeKey, setClaudeKey] = useState(loadSettings().claudeKey || '')
  const [claudeTest, setClaudeTest] = useState('idle')

  const handleFinish = () => {
    if (!userName.trim()) return
    saveSettings({ ...loadSettings(), userName: userName.trim(), claudeKey: claudeKey.trim() })
    markSetupDone()
    onComplete(userName.trim())
  }

  const baseStyle = { position: 'fixed', inset: 0, zIndex: 500, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 28px', fontFamily: "'Eurostile',monospace" }
  const titleStyle = { fontSize: 10, letterSpacing: '0.4em', color: '#f97316', marginBottom: 36, textAlign: 'center', textShadow: '0 0 16px rgba(255,120,0,0.7)' }
  const textStyle  = { fontSize: 12, lineHeight: 1.9, color: '#c2410c', maxWidth: 520, textAlign: 'center', marginBottom: 40 }
  const labelStyle = { display: 'block', fontSize: 9, letterSpacing: '0.3em', color: '#b45309', marginBottom: 6 }
  const inputStyle = { width: '100%', background: '#080808', border: '1px solid #7c2d12', borderRadius: 6, padding: '12px 14px', color: '#fed7aa', fontSize: 13, fontFamily: 'monospace', outline: 'none', marginBottom: 4, boxSizing: 'border-box' }
  const hintStyle  = { fontSize: 9, color: '#78350f', marginBottom: 20 }
  const btnStyle   = { fontFamily: "'Eurostile',monospace", fontWeight: 700, letterSpacing: '0.2em', fontSize: 13, color: '#f97316', border: '1px solid #9a3412', padding: '14px 44px', borderRadius: 8, background: 'transparent', cursor: 'pointer', boxShadow: '0 0 20px rgba(255,80,0,0.25)', marginTop: 16, display: 'block', marginLeft: 'auto', marginRight: 'auto' }

  return (
    <div style={baseStyle}>
      {/* Scanlines */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'repeating-linear-gradient(0deg,transparent 0,transparent 2px,rgba(0,0,0,.13) 3px,transparent 4px)', zIndex: 1 }} />
      {/* Red scanner glow */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,#ff2600,transparent)', opacity: 0.6, zIndex: 1, animation: 'scanLine 3s ease-in-out infinite' }} />

      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 540 }}>
        {phase === 0 && (
          <>
            <p style={titleStyle}>K · I · T · T — PROTOCOLO DE ACTIVACIÓN</p>
            <p style={textStyle}>
              <TypewriterText text={INTRO_TEXT} speed={22} onDone={() => setIntroDone(true)} />
            </p>
            {introDone && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                style={btnStyle}
                onClick={() => setPhase(1)}>
                IDENTIFICARME
              </motion.button>
            )}
          </>
        )}

        {phase === 1 && (
          <>
            <p style={titleStyle}>CALIBRACIÓN DE IDENTIDAD — AGENTE</p>
            <div style={{ width: '100%' }}>
              <label style={labelStyle}>NOMBRE DEL AGENTE *</label>
              <input
                style={inputStyle}
                placeholder="Tu nombre"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleFinish()}
              />
              <p style={hintStyle}>Kitt se dirigirá a ti siempre por este nombre.</p>

              <label style={labelStyle}>CLAVE ANTHROPIC — INTELIGENCIA CLAUDE (opcional)</label>
              <input
                style={inputStyle}
                type="password"
                placeholder="sk-ant-api03-..."
                value={claudeKey}
                onChange={e => { setClaudeKey(e.target.value); setClaudeTest('idle') }}
              />
              <p style={hintStyle}>Sin clave, Kitt funciona con respuestas por palabras clave. Puedes añadirla después en Ajustes.</p>

              {claudeKey.trim().length > 10 && (
                <button
                  onClick={() => { setClaudeTest('testing'); testClaude(claudeKey.trim(), setClaudeTest) }}
                  disabled={claudeTest === 'testing'}
                  style={{ ...btnStyle, fontSize: 10, padding: '8px 24px', marginBottom: 8,
                    color: claudeTest === 'ok' ? '#4ade80' : claudeTest === 'invalid' ? '#f87171' : '#60a5fa',
                    borderColor: claudeTest === 'ok' ? '#166534' : claudeTest === 'invalid' ? '#7f1d1d' : '#1e3a5f' }}>
                  {claudeTest === 'testing' ? 'VERIFICANDO...' : claudeTest === 'ok' ? '✓ CLAUDE CONECTADO' : claudeTest === 'invalid' ? '✕ CLAVE INVÁLIDA' : '▶ VERIFICAR CLAVE'}
                </button>
              )}
            </div>
            <button
              style={{ ...btnStyle, opacity: userName.trim() ? 1 : 0.35, cursor: userName.trim() ? 'pointer' : 'default' }}
              onClick={handleFinish}
              disabled={!userName.trim()}>
              SINCRONIZAR SISTEMAS
            </button>
            <p style={{ ...hintStyle, textAlign: 'center', marginTop: 16 }}>* Campo obligatorio</p>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Boot Screen ──────────────────────────────────────────────────────────────
function BootScreen({ onComplete, obdConnected }) {
  const [lines, setLines] = useState([])
  const [done,  setDone]  = useState(false)
  useEffect(() => {
    const BOOT_SYSTEMS = getBootSystems()
    let i = 0
    const tick = () => {
      if (i < BOOT_SYSTEMS.length) { setLines(p => [...p, BOOT_SYSTEMS[i++]]); setTimeout(tick, 320) }
      else { setTimeout(() => setDone(true), 400); setTimeout(onComplete, 900) }
    }
    setTimeout(tick, 300)
  }, [onComplete])
  return (
    <motion.div className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-8"
      style={{ background: '#000' }} animate={{ opacity: done ? 0 : 1 }} transition={{ duration: 0.5 }}>
      <h1 className="text-4xl font-bold tracking-[0.4em] text-orange-500 mb-8"
        style={{ textShadow: '0 0 24px rgba(255,120,0,0.9)' }}>K·I·T·T</h1>
      <div className="w-full space-y-2 font-mono text-sm">
        {lines.map((item, i) => {
          const isOk = item.dep === 'always' || obdConnected
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className="flex justify-between text-orange-700">
              <span>{item.label}</span>
              <span className={isOk ? 'text-green-500' : 'text-gray-600'}>{isOk ? 'OK' : 'OFF'}</span>
            </motion.div>
          )
        })}
      </div>
      {done && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="mt-8 text-orange-500 font-mono tracking-widest text-sm">SISTEMAS LISTOS</motion.p>}
    </motion.div>
  )
}

// ─── Equalizer ────────────────────────────────────────────────────────────────
function Equalizer({ active }) {
  const COLS = 5, SEGS = 10
  const [bars, setBars] = useState(Array(COLS).fill(2))
  useEffect(() => {
    const id = setInterval(() => setBars(Array(COLS).fill(0).map(() =>
      active ? Math.floor(Math.random() * 7) + 4 : Math.floor(Math.random() * 2) + 1
    )), active ? 85 : 450)
    return () => clearInterval(id)
  }, [active])
  const color = (seg, h) => seg >= h ? '#180400' : `rgb(255,${Math.round(110 - (seg / (SEGS - 1)) * 90)},0)`
  return (
    <div className="flex gap-[6px] items-end justify-center py-5 px-4 rounded-xl"
      style={{ background: 'radial-gradient(ellipse at center,#0d0200 0%,#000 100%)' }}>
      {bars.map((h, c) => (
        <div key={c} className="flex flex-col-reverse gap-[4px]">
          {Array(SEGS).fill(0).map((_, s) => (
            <motion.div key={s}
              animate={{ backgroundColor: color(s, h), boxShadow: s < h ? '0 0 5px rgba(255,80,0,0.65)' : 'none', opacity: s < h ? 1 : 0.4 }}
              transition={{ duration: 0.07 }} style={{ width: 32, height: 8, borderRadius: 2 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Car Configuration — Volkswagen Golf ─────────────────────────────────────
const CAR = {
  marca:        'Volkswagen',
  modelo:       'Golf',
  combustible:  'gasolina',
  deposito:     50,
  depositoUtil: 48,
  consumoMedio: 6.5,
  tempOptMin:   88,
  tempOptMax:   105,
}

function calcRange(fuelPct, consumo = CAR.consumoMedio) {
  const litros = (fuelPct / 100) * CAR.depositoUtil
  return Math.round((litros / consumo) * 100)
}

function calcLitrosRestantes(fuelPct) {
  return ((fuelPct / 100) * CAR.depositoUtil).toFixed(1)
}

function calcLitrosFaltantes(fuelPct) {
  return (((100 - fuelPct) / 100) * CAR.depositoUtil).toFixed(1)
}

function buildGreeting(obdConnected = false) {
  const { userName = 'Cristian' } = loadSettings()
  const hour = parseInt(
    new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false }).format(new Date()),
    10
  )
  const saludo = hour >= 6 && hour < 14 ? 'Buenos días'
    : hour >= 14 && hour < 21 ? 'Buenas tardes'
    : 'Buenas noches'

  const simNote = obdConnected
    ? ''
    : ' Los parámetros que ves en pantalla corresponden a mis últimos registros — sin adaptador OBD no dispongo de datos en tiempo real.'

  const variants = obdConnected ? [
    `${saludo}, ${userName}. Soy la voz del microprocesador de Industrias 2000. Todos los sistemas están operativos y a tu disposición.`,
    `${saludo}, ${userName}. Me alegra volver a comunicarme contigo. Telemetría en tiempo real activa. ¿A dónde nos dirigimos?`,
    `${saludo}, ${userName}. Kitt en línea con OBD conectado. Si me permites la sugerencia, cuéntame el destino y me encargo de que llegues en las mejores condiciones.`,
    `${saludo}, ${userName}. De vuelta al volante. Todos los sistemas leen tus datos en tiempo real. ¿Qué ruta tienes en mente?`,
    `${saludo}, ${userName}. Un hombre puede marcar la diferencia, y yo estaré aquí para que lo consigas. ¿A dónde vamos?`,
    `${saludo}, ${userName}. Kitt conectado y operativo con telemetría real. Dime el plan y lo ejecutamos juntos.`,
    `${saludo}. Me complace informarte de que todos mis sistemas leen datos en tiempo real, ${userName}. ¿En qué puedo asistirte?`,
  ] : [
    `${saludo}, ${userName}. Soy la voz del microprocesador de Industrias 2000.${simNote}`,
    `${saludo}, ${userName}. Me alegra volver a comunicarme contigo.${simNote} Cuando conectes el adaptador OBD tendré acceso a todos tus datos reales.`,
    `${saludo}, ${userName}. Kitt en línea.${simNote} ¿A dónde nos dirigimos?`,
    `${saludo}, ${userName}. De vuelta al volante, como es debido.${simNote}`,
    `${saludo}, ${userName}. Un hombre puede marcar la diferencia, y yo estaré aquí para que lo consigas.${simNote}`,
    `${saludo}, ${userName}. Kitt operativo.${simNote} Conéctame al OBD para telemetría en tiempo real.`,
    `${saludo}. Estoy activo, ${userName}.${simNote}`,
  ]

  return variants[Math.floor(Math.random() * variants.length)]
}

// ─── Fallback responses (sin Claude API) ──────────────────────────────────────
function getKittResponse(input, obd, isSimulated) {
  const q = input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const speed = obd.speed, rpm = Math.round(obd.rpm), fuel = Math.round(obd.fuel)
  const temp = Math.round(obd.temp), bat = obd.battery, gear = obd.gear
  const sim = isSimulated ? ' (simulado, sin OBD real)' : ''

  const dtcMatch = input.match(/\b([PCUBpcub][0-9]{4})\b/)
  if (dtcMatch) {
    const code = dtcMatch[1].toUpperCase()
    const dtc  = DTC_CODES[code]
    if (dtc) {
      const nivel    = dtc.gravedad === 'alta' ? 'AVISO CRÍTICO' : dtc.gravedad.startsWith('media') ? 'Aviso moderado' : 'Aviso leve'
      const conducir = dtc.puede_conducir ? 'Puedes circular con precaución.' : 'Para el motor en cuanto sea seguro.'
      return `${nivel}: ${code} — ${dtc.nombre}. ${dtc.accion} ${conducir}`
    }
    return `El código ${code} no está en mi base de datos. Lleva el coche al taller para diagnóstico.`
  }

  if (/^(hola|buenas|buenos|ey|oye|hey|que hay|hola kitt)/.test(q))
    return `Me alegra volver a comunicarme contigo, Cristian. Estoy a tu disposición. ¿En qué puedo asistirte?`

  if (/como estas|como va todo|todo bien|que tal|sistemas|operativo/.test(q))
    return `Me encuentro en perfectas condiciones. Estoy a ${temp} grados, llevo el ${fuel}% de combustible, y mi tensión eléctrica es de ${bat} voltios${sim}. Todo correcto.`

  if (/velocidad|a cuanto|cuanto vamos|cuanto voy|cuantos km/.test(q)) {
    if (isSimulated) return speed < 3 ? 'Permíteme señalar que me encuentro detenido. Sin el adaptador OBD no dispongo de mi velocidad real.' : `Según los datos de posición, me desplazo a aproximadamente ${speed} kilómetros por hora. Si gustas conectar el OBD obtendrías datos más precisos.`
    return speed < 3 ? 'Me encuentro detenido, en ralentí.' : `Voy a ${speed} kilómetros por hora en marcha ${gear}.${speed > 120 ? ' Si me permites la sugerencia, voy por encima de lo recomendable.' : ''}`
  }

  if (/rpm|revoluciones/.test(q))
    return `Estoy trabajando a ${rpm} revoluciones por minuto${sim}. ${rpm > 4000 ? 'Permíteme sugerirte que subas de marcha.' : rpm < 500 && speed < 2 ? 'Estoy apagado.' : 'Régimen correcto.'}`

  if (/combustible|gasolina|deposito|autonomia|cuanto queda|litros/.test(q)) {
    const litros = calcLitrosRestantes(fuel)
    const km = calcRange(fuel)
    if (fuel < 15) return `Debo advertirte que llevo el depósito bajo: me quedan ${litros} litros, autonomía estimada de ${km} kilómetros. Si me permites la sugerencia, convendría repostar en breve.`
    return `Llevo ${litros} litros. Mi autonomía estimada es de ${km} kilómetros.`
  }

  if (/temperatura|calor del motor|motor frio|motor caliente|sobrecalent/.test(q))
    return `Me encuentro a ${temp} grados${sim}. ${temp > 105 ? 'Debo advertirte que mi temperatura es elevada. Convendría reducir la carga.' : temp < 88 ? 'Todavía estoy alcanzando mi temperatura de trabajo.' : 'Estoy en temperatura óptima.'}`

  if (/bateria|voltaje|alternador/.test(q))
    return `Mi batería marca ${bat} voltios${sim}. ${bat < 12.4 && speed < 3 ? 'Permíteme señalar que mi voltaje es algo bajo en reposo.' : 'Mi sistema eléctrico funciona con normalidad.'}`

  if (/marcha|cambio/.test(q))
    return `Voy en marcha ${gear}, a ${speed} kilómetros por hora, a ${rpm} revoluciones por minuto${sim}.`

  if (/consumo|ahorrar|eficiencia/.test(q))
    return speed > 120 ? 'Si me permites la sugerencia, reducir a 110 kilómetros por hora mejoraría mi consumo notablemente.' : rpm > 3000 ? 'Subir de marcha reduciría mis revoluciones y consumo. Una pequeña mejora que suma.' : 'Mi conducción es eficiente. Nada que objetar.'

  if (/averia|fallo|error|diagnostico|testigo|check engine|dtc/.test(q))
    return `${obd.dtc?.length ? `Debo informarte de que detecto ${obd.dtc.length} código${obd.dtc.length > 1 ? 's' : ''} de avería activo${obd.dtc.length > 1 ? 's' : ''}. Dime el código y te explico qué significa.` : 'No detecto ningún código de avería. Mis sistemas están en orden.'}`

  if (/gasolinera|repostar|gasolina barata/.test(q))
    return `Di "busca gasolinera barata" y localizaré las estaciones de servicio más económicas en mi entorno.`

  if (/donde estamos|ubicacion|donde estoy|mapa|gps/.test(q))
    return `Para iniciar la navegación, di "llévame a" seguido del destino que desees.`

  if (/musica|cancion|spotify|reproduce/.test(q))
    return `Para la música di "pon música de" con el nombre del artista. También puedo gestionar "siguiente canción", "pausa" o "sube el volumen".`

  if (/tiempo|lluvia|sol|clima/.test(q))
    return `Di "qué tiempo hace" y consulto las condiciones meteorológicas por mi posición GPS. O "tiempo en" seguido de la ciudad si prefieres otro lugar.`

  if (/gracias|perfecto|genial|bien hecho/.test(q))
    return `Es un placer, Cristian. Para eso estoy.`

  if (/quien eres|que eres|presentate/.test(q))
    return `Soy Kitt, el microprocesador de Industrias 2000. Soy el coche, Cristian. Monitorizo mi propio estado, calculo rutas y te asisto con voz en tiempo real. ¿Qué necesitas?`

  if (/que puedes|que sabes|funciones|capacidades/.test(q))
    return `Conozco mi estado en todo momento: velocidad, revoluciones, temperatura, combustible. También busco gasolineras baratas, calculo rutas, controlo Spotify y consulto el tiempo. Todo desde aquí dentro.`

  if (/chiste|broma|gracioso/.test(q))
    return `Proceso mis propios datos a millones de operaciones por segundo. Y aún así no entiendo cómo hay conductores que frenan después de la curva.`

  return `Para conversar libremente, añade tu clave de Claude en ajustes. Sin ella proceso comandos concretos: gasolineras, navegación, tiempo, Spotify y mis propios datos.`
}

// ─── Trivia — fetch a question from Claude ────────────────────────────────────
async function fetchTriviaQuestion(topic, claudeKey) {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-claude-key': claudeKey },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 220,
      messages: [{ role: 'user', content: `Genera una pregunta de trivial sobre ${topic}. Formato EXACTO, sin asteriscos ni markdown:\nPREGUNTA: [la pregunta]\nA: [opción A]\nB: [opción B]\nC: [opción C]\nD: [opción D]\nCORRECTA: [letra A B C o D]\nEXPLICACIÓN: [1 frase breve]` }],
    }),
  })
  if (!res.ok) throw new Error(`Claude ${res.status}`)
  const data = await res.json()
  const text = data.content?.[0]?.text || ''
  const pM = text.match(/PREGUNTA:\s*(.+)/i)
  const aM = text.match(/\nA:\s*(.+)/i)
  const bM = text.match(/\nB:\s*(.+)/i)
  const cM = text.match(/\nC:\s*(.+)/i)
  const dM = text.match(/\nD:\s*(.+)/i)
  const xM = text.match(/CORRECTA:\s*([ABCD])/i)
  const eM = text.match(/EXPLICACIÓN:\s*(.+)/i)
  if (!pM || !aM || !bM || !cM || !dM || !xM) return null
  return {
    question:    pM[1].trim(),
    options:     { A: aM[1].trim(), B: bM[1].trim(), C: cM[1].trim(), D: dM[1].trim() },
    correct:     xM[1].toUpperCase(),
    explanation: eM?.[1]?.trim() || '',
  }
}

// ─── Tick-tock audio — Web Audio API beep ────────────────────────────────────
function playTick(audioCtxRef, hi = true) {
  try {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    const ctx  = audioCtxRef.current
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = hi ? 900 : 680
    osc.type = 'square'
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.09)
  } catch (_) {}
}

// ─── Mode Button ──────────────────────────────────────────────────────────────
const MODES = [
  { id: 'auto',    label: 'AUTO\nCRUISE',   color: 'orange' },
  { id: 'normal',  label: 'NORMAL\nCRUISE', color: 'amber'  },
  { id: 'pursuit', label: 'PURSUIT',        color: 'blue'   },
]
function ModeButton({ mode, active, onClick }) {
  const base = 'py-3 px-1 rounded text-center text-[11px] font-bold font-mono tracking-wide transition-all duration-200 whitespace-pre-line leading-tight border select-none active:scale-95'
  const s = {
    orange: active ? 'bg-orange-600 text-black border-orange-400 shadow-[0_0_14px_rgba(234,88,12,0.9)]' : 'bg-orange-950/40 text-orange-500 border-orange-800',
    amber:  active ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.9)]'  : 'bg-amber-950/40 text-amber-400 border-amber-800',
    blue:   active ? 'bg-blue-600 text-white border-blue-300 shadow-[0_0_14px_rgba(59,130,246,0.9)]'   : 'bg-blue-950/50 text-blue-400 border-blue-800',
  }
  return <button className={`${base} ${s[mode.color]}`} onClick={() => onClick(mode.id)}>{mode.label}</button>
}

// ─── Gauge ────────────────────────────────────────────────────────────────────
function Gauge({ label, value, unit, warn }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg p-2 border"
      style={{ background: 'linear-gradient(180deg,#0a0a0a 0%,#000 100%)', borderColor: warn ? 'rgba(239,68,68,0.5)' : 'rgba(75,75,75,0.3)' }}>
      <span className="text-[9px] font-mono tracking-widest text-gray-600">{label}</span>
      <span className={`text-xl font-bold font-mono leading-tight ${warn ? 'text-red-400' : 'text-orange-400'}`}>{value}</span>
      <span className="text-[9px] font-mono text-gray-600">{unit}</span>
    </div>
  )
}

// ─── Route comparison panel ───────────────────────────────────────────────────
const ROUTE_LABELS = ['MÁS RÁPIDA', 'ALTERNATIVA', 'ALTERNATIVA 2']
const ROUTE_COLORS = [
  { border: 'rgba(234,88,12,0.6)', badge: 'bg-orange-700 text-black', time: 'text-orange-400' },
  { border: 'rgba(59,130,246,0.4)', badge: 'bg-blue-900 text-blue-300', time: 'text-blue-400' },
  { border: 'rgba(100,100,100,0.3)', badge: 'bg-gray-800 text-gray-400', time: 'text-gray-400' },
]

function RouteCard({ route, onSelect }) {
  const c = ROUTE_COLORS[route.index] ?? ROUTE_COLORS[2]
  const fuelWarn = route.fuel.liters > 20
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onSelect}
      className="w-full text-left rounded-xl border p-3 mb-3 font-mono"
      style={{ borderColor: c.border, background: 'rgba(0,0,0,0.7)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[9px] font-bold tracking-widest px-2 py-0.5 rounded ${c.badge}`}>
          {ROUTE_LABELS[route.index] ?? `RUTA ${route.index + 1}`}
        </span>
        {route.elev && (
          <span className="text-[9px] text-gray-600">
            ↑{route.elev.gainM}m ↓{route.elev.lossM}m
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-3 mb-1">
        <span className={`text-2xl font-bold ${c.time}`}>{Math.floor(route.durationMin / 60) > 0 ? `${Math.floor(route.durationMin / 60)}h ` : ''}{route.durationMin % 60}min</span>
        <span className="text-gray-500 text-sm">{route.distKm} km</span>
        <span className="text-[10px] text-gray-600 uppercase">{route.fuel.type}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className={`text-sm font-bold ${fuelWarn ? 'text-yellow-500' : 'text-green-500'}`}>{route.fuel.liters}L</span>
        <span className="text-orange-400 text-sm font-bold">{route.fuel.euros}€</span>
        <span className="text-[9px] text-gray-700">{route.fuel.cons}L/100km</span>
      </div>
    </motion.button>
  )
}

function RoutePanel({ routes, tips, onSelect, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex flex-col overflow-y-auto px-5 py-6"
      style={{ background: 'rgba(0,0,0,0.96)', fontFamily: "'Courier New',monospace" }}>
      <p className="text-[9px] text-orange-700 tracking-[0.2em] mb-1 text-center">RUTAS DISPONIBLES</p>
      <p className="text-[11px] text-gray-600 text-center mb-4 font-mono">Di "la primera", "la más rápida" o "la más económica"</p>
      {routes.map((route, i) => (
        <RouteCard key={i} route={route} onSelect={() => onSelect(i)} />
      ))}
      {tips.length > 0 && (
        <div className="mt-2 rounded-xl border border-orange-950 p-3">
          <p className="text-[9px] text-orange-700 tracking-widest mb-2">CONSEJOS DE CONDUCCIÓN</p>
          {tips.map((t, i) => (
            <p key={i} className="text-[10px] text-gray-500 font-mono mb-1 leading-relaxed">· {t}</p>
          ))}
        </div>
      )}
      <button onClick={onClose} className="mt-4 text-[10px] text-gray-700 font-mono tracking-wider text-center">CANCELAR</button>
    </motion.div>
  )
}

// ─── Navigation Overlay ───────────────────────────────────────────────────────
function NavOverlay({ nav, onOpen, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.90)' }}>
      <motion.div initial={{ scale: 0.88, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl border p-6 text-center"
        style={{ borderColor: 'rgba(34,197,94,0.4)', background: '#000' }}>
        <p className="text-[9px] text-green-700 tracking-[0.2em] font-mono mb-1">RUTA SELECCIONADA</p>
        <p className="text-green-400 font-bold font-mono text-sm mb-3 leading-snug">{nav.label}</p>
        {nav.durMin && (
          <div className="flex items-baseline justify-center gap-3 mb-2">
            <span className="text-orange-400 font-bold font-mono text-3xl">{nav.durMin}</span>
            <span className="text-orange-700 font-mono text-sm">min</span>
            {nav.distKm && <><span className="text-gray-700 font-mono text-xl">·</span>
              <span className="text-gray-500 font-mono text-lg">{nav.distKm}</span>
              <span className="text-gray-700 font-mono text-sm">km</span></>}
          </div>
        )}
        {nav.liters && (
          <div className="flex items-center justify-center gap-4 mb-4">
            <span className="text-green-600 font-mono text-sm font-bold">{nav.liters}L</span>
            <span className="text-orange-500 font-mono text-sm font-bold">{nav.euros}€</span>
            {nav.elev && <span className="text-gray-600 font-mono text-xs">↑{nav.elev.gainM}m ↓{nav.elev.lossM}m</span>}
          </div>
        )}
        <motion.button onClick={onOpen} whileTap={{ scale: 0.94 }}
          className="w-full py-4 font-bold font-mono text-sm text-black rounded-xl tracking-widest"
          style={{ background: 'rgba(234,88,12,1)', boxShadow: '0 0 24px rgba(255,80,0,0.5)' }}>
          ▶ ABRIR NAVEGACIÓN
        </motion.button>
        <button onClick={onClose} className="mt-3 text-[10px] text-gray-700 font-mono tracking-wider">CANCELAR</button>
      </motion.div>
    </motion.div>
  )
}

// ─── Settings Field — must be outside SettingsPanel to avoid remount on every keystroke ──
function SettingsField({ label, val, set, ph, type = 'text', hint }) {
  return (
    <div>
      <label className="block text-[9px] text-orange-500 tracking-widest mb-1">{label}</label>
      <input
        type={type}
        value={val}
        onChange={e => set(e.target.value)}
        placeholder={ph}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        className="w-full bg-black border border-orange-800 rounded px-3 py-2 text-orange-200 text-xs font-mono outline-none focus:border-orange-500 placeholder:text-orange-900"
      />
      {hint && <p className="text-[9px] text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

async function testElevenLabs(onResult) {
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${KITT_VOICE_ID}`, {
      method: 'POST',
      headers: { 'Accept': 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': ELEVENLABS_KEY },
      body: JSON.stringify({ text: 'Voz de Kitt activa y operativa.', model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.72, similarity_boost: 0.80 } }),
    })
    if (!res.ok) { onResult('error'); return }
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.onended = () => { URL.revokeObjectURL(url); onResult('ok') }
    audio.onerror = () => { URL.revokeObjectURL(url); onResult('error') }
    onResult('playing')
    await audio.play()
  } catch { onResult('error') }
}

async function testClaude(key, onResult) {
  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-claude-key': key,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Di "OK"' }],
      }),
    })
    if (res.status === 401) { onResult('invalid'); return }
    if (!res.ok)            { onResult('error');   return }
    const data = await res.json()
    onResult(data.content?.[0]?.text ? 'ok' : 'error')
  } catch (err) {
    console.error('testClaude error:', err.name, err.message)
    onResult('error')
  }
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
function SettingsPanel({ onClose, onSpotifyAuth, onExportTraining, obdStatus, onConnectOBD, onDisconnectOBD }) {
  const saved = loadSettings()
  const [userName,      setUserName]      = useState(saved.userName      || '')
  const [vehicleName,   setVehicleName]   = useState(saved.vehicleName   || '')
  const [baseCity,      setBaseCity]      = useState(saved.baseCity      || '')
  const [missionCode,   setMissionCode]   = useState(saved.missionCode   || '')
  const [emergencyName, setEmergencyName] = useState(saved.emergencyName || '')
  const [emergencyPhone,setEmergencyPhone]= useState(saved.emergencyPhone|| '')
  const [silentMode,    setSilentMode]    = useState(saved.silentMode    || false)
  const [speedAlertKmh, setSpeedAlertKmh] = useState(saved.speedAlertKmh ?? 130)
  const [claudeKey, setClaudeKey] = useState(saved.claudeKey || '')
  const [obdUrl,    setObdUrl]    = useState(saved.obdUrl    || '')
  const [voiceTest,  setVoiceTest]  = useState('idle')
  const [claudeTest, setClaudeTest] = useState('idle')

  const save = () => {
    saveSettings({
      ...saved,
      userName: userName.trim(),
      vehicleName: vehicleName.trim(),
      baseCity: baseCity.trim(),
      missionCode: missionCode.trim(),
      emergencyName: emergencyName.trim(),
      emergencyPhone: emergencyPhone.trim(),
      silentMode,
      speedAlertKmh: Number(speedAlertKmh) || 130,
      claudeKey: claudeKey.trim(),
      obdUrl: obdUrl.trim(),
    })
    onClose()
  }

  const OBD_STATUS_LABEL = { disconnected: 'DESCONECTADO', connecting: 'CONECTANDO...', initializing: 'INICIANDO...', connected: 'CONECTADO ✓' }
  const OBD_STATUS_COLOR = { disconnected: 'text-gray-500', connecting: 'text-yellow-500', initializing: 'text-blue-400', connected: 'text-green-400' }

  const SectionHeader = ({ color = 'text-orange-500', borderColor = 'border-orange-900', children }) => (
    <p className={`text-[9px] ${color} tracking-[0.25em] border-b ${borderColor} pb-1 pt-3`}>{children}</p>
  )

  const Toggle = ({ val, set, label, hint }) => (
    <div className="flex items-center justify-between py-2">
      <div>
        <span className="text-[10px] text-orange-400 tracking-wider">{label}</span>
        {hint && <p className="text-[9px] text-gray-500 mt-0.5">{hint}</p>}
      </div>
      <button onClick={() => set(!val)}
        className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ml-4 ${val ? 'bg-orange-600' : 'bg-gray-800'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${val ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  )

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
      className="fixed inset-0 z-[200] flex flex-col overflow-y-auto px-5"
      style={{ paddingTop: 'max(28px, env(safe-area-inset-top, 0px) + 20px)', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px) + 16px)', background: 'rgba(0,0,0,0.98)', fontFamily: "'Courier New',monospace" }}>
      <h2 className="text-base font-bold tracking-widest text-orange-400 mb-4 text-center">AJUSTES DEL SISTEMA</h2>

      <div className="space-y-3">
        {/* ── AGENT IDENTITY ── */}
        <SectionHeader color="text-orange-500" borderColor="border-orange-900">IDENTIDAD DEL AGENTE</SectionHeader>
        <SettingsField label="NOMBRE DEL AGENTE" val={userName} set={setUserName} ph="Tu nombre" hint="Kitt se dirige a ti siempre por este nombre." />
        <SettingsField label="INDICATIVO DE MISIÓN (opcional)" val={missionCode} set={setMissionCode} ph="ej: Sombra, Raptor, Eclipse..." hint='Kitt usará este indicativo en momentos críticos. Ej: "Raptor, anomalía detectada."' />
        <SettingsField label="NOMBRE DEL VEHÍCULO (opcional)" val={vehicleName} set={setVehicleName} ph="ej: Fantasma, Sombra..." hint='Kitt llamará a tu coche por este nombre. Ej: "El Fantasma está listo."' />
        <SettingsField label="CIUDAD BASE (opcional)" val={baseCity} set={setBaseCity} ph="ej: Madrid, Barcelona..." hint="Kitt conoce tu base y puede usarla en rutas y comentarios." />

        {/* ── EMERGENCY CONTACT ── */}
        <SectionHeader color="text-red-400" borderColor="border-red-900">PROTOCOLO DE EMERGENCIA</SectionHeader>
        <SettingsField label="NOMBRE DEL CONTACTO" val={emergencyName} set={setEmergencyName} ph="ej: María, Papá, Doctor..." hint='Kitt anunciará este nombre al iniciar la llamada de emergencia.' />
        <SettingsField label="TELÉFONO DE EMERGENCIA" val={emergencyPhone} set={setEmergencyPhone} ph="+34 600 000 000" hint='Di "emergencia" o "llama a mi contacto" y Kitt marcará este número.' />
        {emergencyPhone && (
          <button
            onClick={() => { const a = document.createElement('a'); a.href = `tel:${emergencyPhone.replace(/\s+/g,'')}`; document.body.appendChild(a); a.click(); document.body.removeChild(a) }}
            className="w-full py-2 font-mono text-xs font-bold border rounded"
            style={{ color: '#f87171', borderColor: '#7f1d1d' }}>
            ▶ PROBAR LLAMADA — {emergencyName || emergencyPhone}
          </button>
        )}

        {/* ── BEHAVIOUR ── */}
        <SectionHeader color="text-orange-500" borderColor="border-orange-900">PROTOCOLO DE COMPORTAMIENTO</SectionHeader>
        <Toggle val={silentMode} set={setSilentMode}
          label="PROTOCOLO DE SILENCIO"
          hint="Kitt solo habla cuando le preguntas. Sin comentarios espontáneos." />
        <div>
          <label className="block text-[9px] text-orange-500 tracking-widest mb-1">ALERTA DE VELOCIDAD MÁXIMA (km/h)</label>
          <div className="flex items-center gap-3">
            <input type="number" value={speedAlertKmh} onChange={e => setSpeedAlertKmh(e.target.value)} min={80} max={250}
              className="w-24 bg-black border border-orange-800 rounded px-3 py-2 text-orange-200 text-xs font-mono outline-none focus:border-orange-500" />
            <span className="text-[9px] text-gray-500">Kitt avisa si superas esta velocidad</span>
          </div>
        </div>

        {/* ── VOICE ── */}
        <SectionHeader color="text-orange-500" borderColor="border-orange-900">VOZ — ELEVENLABS</SectionHeader>
        <div>
          <label className="block text-[9px] text-orange-500 tracking-widest mb-1">API KEY</label>
          <div className="w-full bg-black border border-green-900 rounded px-3 py-2 text-green-600 text-xs font-mono flex items-center justify-between">
            <span>sk_••••••••••••••••••••</span>
            <span className="text-[9px] text-green-700">✓ CONFIGURADA</span>
          </div>
          <p className="text-[9px] text-gray-500 mt-1">ElevenLabs preconfigurada con la voz de Kitt.</p>
        </div>
        <button onClick={() => testElevenLabs(setVoiceTest)} disabled={voiceTest === 'playing'}
          className="w-full py-2 font-mono text-xs font-bold border rounded disabled:opacity-40"
          style={{ color: voiceTest === 'ok' ? '#4ade80' : voiceTest === 'error' ? '#f87171' : '#fb923c', borderColor: voiceTest === 'ok' ? '#166534' : voiceTest === 'error' ? '#7f1d1d' : '#9a3412' }}>
          {voiceTest === 'playing' ? '▶ REPRODUCIENDO...' : voiceTest === 'ok' ? '✓ VOZ OK' : voiceTest === 'error' ? '✕ ERROR — revisar créditos' : '▶ PROBAR VOZ KITT'}
        </button>

        {/* ── AI ── */}
        <SectionHeader color="text-blue-400" borderColor="border-blue-900">INTELIGENCIA — CLAUDE AI</SectionHeader>
        <SettingsField label="ANTHROPIC API KEY" val={claudeKey} set={k => { setClaudeKey(k); setClaudeTest('idle') }} ph="sk-ant-api03-..." type="password"
          hint="console.anthropic.com → API Keys" />
        {claudeKey
          ? <p className="text-[9px] text-green-600 font-mono">✓ Kitt usará Claude para conversación inteligente</p>
          : <p className="text-[9px] text-gray-500 font-mono">Sin clave: respuestas por palabras clave</p>}
        <button
          onClick={() => { setClaudeTest('testing'); testClaude(claudeKey.trim(), setClaudeTest) }}
          disabled={!claudeKey.trim() || claudeTest === 'testing'}
          className="w-full py-2 font-mono text-xs font-bold border rounded disabled:opacity-40"
          style={{
            color: claudeTest === 'ok' ? '#4ade80' : claudeTest === 'invalid' ? '#f87171' : claudeTest === 'error' ? '#fb923c' : '#60a5fa',
            borderColor: claudeTest === 'ok' ? '#166534' : claudeTest === 'invalid' ? '#7f1d1d' : claudeTest === 'error' ? '#431407' : '#1e3a5f',
          }}>
          {claudeTest === 'testing' ? 'PROBANDO...' : claudeTest === 'ok' ? '✓ CLAUDE CONECTADO' : claudeTest === 'invalid' ? '✕ CLAVE INVÁLIDA' : claudeTest === 'error' ? '✕ ERROR — ¿Sin internet?' : '▶ PROBAR CONEXIÓN CLAUDE'}
        </button>

        {/* ── SPOTIFY ── */}
        <SectionHeader color="text-green-400" borderColor="border-green-900">MÚSICA — SPOTIFY PREMIUM</SectionHeader>
        <div>
          <label className="block text-[9px] text-orange-500 tracking-widest mb-1">CLIENT ID — APP KITT</label>
          <div className="w-full bg-black border border-green-900 rounded px-3 py-2 text-green-600 text-xs font-mono flex items-center justify-between">
            <span className="truncate">{SPOTIFY_CLIENT_ID}</span>
            <span className="text-[9px] text-green-700 ml-2 flex-shrink-0">✓</span>
          </div>
          <p className="text-[9px] text-gray-500 mt-1">Redirect URI: https://kitt-ai-agent.netlify.app</p>
        </div>
        <button onClick={() => { save(); onSpotifyAuth(SPOTIFY_CLIENT_ID) }}
          className="w-full py-2 font-mono text-xs font-bold text-black bg-green-700 rounded border border-green-500">
          ▶ CONECTAR SPOTIFY
        </button>

        {/* ── OBD ── */}
        <SectionHeader color="text-red-400" borderColor="border-red-900">OBD-II WIFI REAL</SectionHeader>
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-mono text-gray-500">ESTADO</span>
          <span className={`text-[9px] font-mono font-bold ${OBD_STATUS_COLOR[obdStatus]}`}>{OBD_STATUS_LABEL[obdStatus]}</span>
        </div>
        <SettingsField label="IP ADAPTADOR (opcional)" val={obdUrl} set={setObdUrl} ph="ws://192.168.0.10:35000"
          hint="Deja vacío para autodetección. Formato: ws://IP:PUERTO" />
        <p className="text-[9px] text-gray-500 leading-relaxed">
          Conecta al WiFi del adaptador OBD. Luego toca Conectar.
        </p>
        {obdStatus === 'connected'
          ? <button onClick={() => { onDisconnectOBD(); onClose() }}
              className="w-full py-2 font-mono text-xs font-bold text-black bg-red-700 rounded border border-red-500">
              ✕ DESCONECTAR OBD
            </button>
          : <button onClick={() => { save(); onConnectOBD(obdUrl.trim() || null) }}
              disabled={obdStatus === 'connecting' || obdStatus === 'initializing'}
              className="w-full py-2 font-mono text-xs font-bold text-black bg-red-700 rounded border border-red-500 disabled:opacity-40">
              {obdStatus === 'connecting' || obdStatus === 'initializing' ? 'CONECTANDO...' : '⚡ CONECTAR OBD WIFI'}
            </button>
        }

        {/* ── TRAINING ── */}
        <SectionHeader color="text-gray-500" borderColor="border-gray-800">DATOS DE ENTRENAMIENTO</SectionHeader>
        <button onClick={onExportTraining}
          className="w-full py-2 font-mono text-xs text-gray-400 border border-gray-700 rounded active:scale-95">
          ↓ EXPORTAR CONVERSACIONES (JSON)
        </button>
        <p className="text-[9px] text-gray-600">Conversaciones guardadas con contexto OBD para entrenar el agente.</p>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="flex-1 py-3 font-mono text-xs text-gray-400 border border-gray-700 rounded">CANCELAR</button>
        <button onClick={save} className="flex-1 py-3 font-mono text-xs font-bold text-black bg-orange-600 rounded">GUARDAR</button>
      </div>
    </motion.div>
  )
}

// ─── VelBarsPanel ─────────────────────────────────────────────────────────────
function VelBarsPanel({ speed }) {
  const containerRef = useRef(null)
  const colsRef = useRef([])
  const VB_COLS = 4, VB_ROWS = 14

  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    c.innerHTML = ''
    colsRef.current = []
    for (let col = 0; col < VB_COLS; col++) {
      const colEl = document.createElement('div')
      colEl.className = 'vbc'
      const segs = []
      for (let row = 0; row < VB_ROWS; row++) {
        const seg = document.createElement('div')
        seg.className = 'b'
        colEl.appendChild(seg)
        segs.push(seg)
      }
      c.appendChild(colEl)
      colsRef.current.push(segs)
    }
  }, [])

  useEffect(() => {
    const cols = colsRef.current
    if (!cols.length) return
    const frac = Math.min(1, speed / 260)
    const on = Math.round(frac * VB_ROWS)
    cols.forEach(segs => {
      segs.forEach((seg, i) => {
        const t = i / VB_ROWS
        if (i < on) {
          if (t < 0.65)      { seg.style.background = '#3dff66'; seg.style.boxShadow = '0 0 4px #3dff66' }
          else if (t < 0.85) { seg.style.background = '#ffb000'; seg.style.boxShadow = '0 0 4px #ffb000' }
          else               { seg.style.background = '#ff2a17'; seg.style.boxShadow = '0 0 4px #ff2a17' }
        } else {
          seg.style.background = '#091409'
          seg.style.boxShadow = 'none'
        }
      })
    })
  }, [speed])

  return <div ref={containerRef} id="velBars" />
}

// ─── RpmArc ───────────────────────────────────────────────────────────────────
function RpmArc({ rpm }) {
  const RL = 48
  const P0 = [6, 105], P1 = [190, 5], P2 = [374, 60]
  const bez = t => [
    (1-t)*(1-t)*P0[0] + 2*(1-t)*t*P1[0] + t*t*P2[0],
    (1-t)*(1-t)*P0[1] + 2*(1-t)*t*P1[1] + t*t*P2[1],
  ]
  const frac = Math.min(1, rpm / 8200)
  const on = Math.round(frac * RL)
  const dots = Array.from({ length: RL }, (_, i) => {
    const [cx, cy] = bez(i / (RL - 1))
    const tf = i / RL
    let fill = '#0d1a0d', filter = undefined
    if (i < on) {
      if (tf < 0.55)      { fill = '#3dff66'; filter = 'url(#gg)' }
      else if (tf < 0.78) { fill = '#ffb000'; filter = 'url(#ag)' }
      else                { fill = '#ff2a17'; filter = 'url(#rg)' }
    }
    return { cx, cy, fill, filter }
  })
  const labels = [['0',.0],['2k',.22],['4k',.5],['6k',.72],['8k',1]]
  return (
    <svg id="rpmArc" viewBox="0 0 380 115" preserveAspectRatio="none">
      <defs>
        <filter id="rg"><feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#ff2a17" floodOpacity="0.8"/></filter>
        <filter id="ag"><feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#ffb000" floodOpacity="0.8"/></filter>
        <filter id="gg"><feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#3dff66" floodOpacity="0.8"/></filter>
      </defs>
      {labels.map(([lbl, t]) => {
        const [x, y] = bez(t)
        return <text key={lbl} x={x} y={Math.max(12, y-8)} textAnchor="middle" fontSize="8" fill="#3a3a3a" fontFamily="Eurostile,sans-serif">{lbl}</text>
      })}
      {dots.map((d, i) => <circle key={i} cx={d.cx} cy={d.cy} r="5" fill={d.fill} filter={d.filter} />)}
      <rect x="215" y="68" width="100" height="44" fill="#080808" stroke="#222" strokeWidth="1" rx="3"/>
      <text x="265" y="107" textAnchor="middle" fontSize="38" fill="#ff2a17" fontFamily="DSEG7,monospace" filter="url(#rg)">{String(Math.round(rpm)).padStart(3,'0')}</text>
      <rect x="320" y="98" width="42" height="16" fill="#aa0000" rx="2"/>
      <text x="341" y="110" textAnchor="middle" fontSize="10" fill="#fff" fontFamily="Eurostile,sans-serif" fontWeight="700">RPM</text>
    </svg>
  )
}

// ─── SegBar ───────────────────────────────────────────────────────────────────
function SegBar({ frac, scheme }) {
  const SEG_N = 10
  const on = Math.round(Math.min(1, frac) * SEG_N)
  return (
    <div className="mbar">
      {Array.from({ length: SEG_N }, (_, i) => {
        const t = i / SEG_N
        let c = '#141414', shadow = 'none'
        if (i < on) {
          if (scheme === 'fuel' || scheme === 'range') c = t < 0.3 ? '#ff2a17' : t < 0.6 ? '#ffb000' : '#3dff66'
          else if (scheme === 'hot') c = t < 0.5 ? '#3dff66' : t < 0.75 ? '#ffb000' : '#ff2a17'
          else c = '#60d0ff'
          shadow = `0 0 4px ${c}`
        }
        return <div key={i} className="ms" style={{ background: c, boxShadow: shadow }} />
      })}
    </div>
  )
}

// ─── VoiceModulator ───────────────────────────────────────────────────────────
function VoiceModulator({ speaking, thinking, listening, onClick }) {
  const containerRef = useRef(null)
  const stateRef = useRef({ speaking, thinking, listening })
  useEffect(() => { stateRef.current = { speaking, thinking, listening } }, [speaking, thinking, listening])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const VC = 3, VS = 20, VCEN = (VS - 1) / 2
    const VW = [0.55, 1.0, 0.55]
    const cols = []
    for (let c = 0; c < VC; c++) {
      const col = document.createElement('div')
      col.className = 'vcol'
      const segs = []
      for (let s = 0; s < VS; s++) {
        const seg = document.createElement('div')
        seg.className = 'vseg'
        col.appendChild(seg)
        segs.push(seg)
      }
      container.appendChild(col)
      cols.push(segs)
    }
    let vt = 0, frameId
    const animate = () => {
      vt += 0.05
      const { speaking, thinking, listening } = stateRef.current
      const osc = (Math.sin(vt * 2.4) + 1) / 2
      const reach = speaking   ? (0.85 + 0.15 * osc)
                  : thinking   ? (0.4  + 0.1  * osc)
                  : listening  ? 0.05
                  :              (0.15 + 0.08 * osc)
      cols.forEach((segs, c) => {
        const ext = Math.min(1, reach * VW[c] + (speaking ? Math.random() * 0.09 : listening ? 0 : Math.random() * 0.03))
        const lh = Math.round(ext * VCEN)
        segs.forEach((seg, i) => {
          const d = Math.abs(i - VCEN)
          if (d <= lh) {
            const e = lh > 0 ? 1 - (d / (lh + 0.6)) * 0.3 : 1
            seg.style.background = `rgba(255,38,20,${(0.5 + e * 0.5).toFixed(2)})`
            seg.style.boxShadow = `0 0 ${(3 + e * 8).toFixed(1)}px rgba(255,40,22,${e.toFixed(2)})`
          } else {
            seg.style.background = '#1e0603'
            seg.style.boxShadow = 'none'
          }
        })
      })
      frameId = requestAnimationFrame(animate)
    }
    animate()
    return () => { cancelAnimationFrame(frameId); container.innerHTML = '' }
  }, []) // eslint-disable-line

  return <div ref={containerRef} id="voicebars" onClick={onClick} />
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Kitt() {
  const [scenario,     setScenario]     = useState('parked')
  const simObd = useOBDData(scenario)
  const [obdLive,      setObdLive]      = useState({})   // real OBD values override sim
  const [obdStatus,    setObdStatus]    = useState('disconnected') // disconnected|connecting|initializing|connected
  const obdWifiRef = useRef(null)
  const obd = obdStatus === 'connected' ? { ...simObd, ...obdLive } : simObd

  const [unlocked,     setUnlocked]     = useState(false)
  const [booting,      setBooting]      = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [activeMode,   setActiveMode]   = useState('normal')
  const [speaking,     setSpeaking]     = useState(false)
  const [listening,    setListening]    = useState(false)
  const [thinking,     setThinking]     = useState(false)
  const [paused,       setPaused]       = useState(false)
  const [messages,     setMessages]     = useState(loadHistory)
  const [pendingNav,   setPendingNav]   = useState(null)
  const [navRoute,     setNavRoute]     = useState(null)
  const [routes,       setRoutes]       = useState([])
  const [routeTips,    setRouteTips]    = useState([])
  const [userPos,      setUserPos]      = useState(null)
  const [spotifyToken, setSpotifyToken] = useState(getSpotifyToken)
  const [nowPlaying,   setNowPlaying]   = useState(null)
  const [lastStations, setLastStations] = useState([])
  const [triviaMode,   setTriviaMode]   = useState(false)
  const [triviaTimer,  setTriviaTimer]  = useState(null) // null | 0-15
  const [triviaScore,  setTriviaScore]  = useState({ correct: 0, total: 0 })
  const [showOnboarding, setShowOnboarding] = useState(() => isFirstRun())

  const pausedRef    = useRef(false)
  const listeningRef = useRef(false)
  const speakingRef  = useRef(false)
  const thinkingRef  = useRef(false)
  const recRef       = useRef(null)
  const messagesEndRef = useRef(null)
  const trainingRef  = useRef([])
  const scenarioRef  = useRef(scenario)

  const startListeningRef    = useRef(null)
  const handleInputRef       = useRef(null)
  const handleNavRef         = useRef(null)
  const handleSpotifyRef     = useRef(null)
  const handleRouteSelectRef = useRef(null)
  const obdRef               = useRef(obd)
  const spotifyTokenRef      = useRef(spotifyToken)
  const userPosRef           = useRef(userPos)
  const routesRef            = useRef(routes)

  const obdStatusRef       = useRef(obdStatus)
  const lastResponseRef    = useRef('') // stores last spoken text for resume command
  const lastStationsRef    = useRef([])
  const elevenLabsAudioRef = useRef(null)  // current ElevenLabs Audio element for barge-in
  const usingElevenLabsRef = useRef(false) // true while ElevenLabs is the active TTS engine
  const speakStartTimeRef  = useRef(0)     // epoch ms when Kitt started speaking (echo protection)
  const messagesRef        = useRef(messages) // always-current messages for Claude history

  // Trivia refs
  const triviaModeRef      = useRef(false)
  const triviaQuestionRef  = useRef(null)  // {question, options:{A,B,C,D}, correct, explanation}
  const triviaTickRef      = useRef(null)  // setInterval ID
  const triviaTimerRef     = useRef(null)  // current seconds
  const triviaTopicRef     = useRef('cultura general')
  const nextTriviaQuestionRef = useRef(null)
  const audioCtxRef        = useRef(null)
  const introMusicRef      = useRef(null)
  const introAudioBufRef   = useRef(null)
  const scannerBufRef      = useRef(null)
  const scannerSourceRef   = useRef(null)
  const bargeInRecRef      = useRef(null)  // barge-in STT recognition instance
  const startBargeInRef    = useRef(null)
  const routeAnnouncedAtRef = useRef(0)    // timestamp when route list was announced (echo-lock)
  const speakGenRef         = useRef(0)    // generation counter — invalidates stale onEnd callbacks


  // Proactive OBD advisor tracking refs
  const ofcoStartRef    = useRef(null)
  const ofcoSecsRef     = useRef(0)
  const idleStartRef    = useRef(null)
  const idleSecsRef     = useRef(0)
  const speedHistRef    = useRef([])
  const lastSpokenRef   = useRef({})
  const lastSpeedAlertRef = useRef(0)

  // Force landscape orientation (PWA / installed app)
  useEffect(() => {
    const lock = () => {
      try { screen.orientation?.lock?.('landscape').catch(() => {}) } catch (_) {}
    }
    lock()
    document.addEventListener('visibilitychange', () => { if (!document.hidden) lock() })
  }, [])

  // Pre-load voices on iOS (they load asynchronously)
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return
    speechSynthesis.getVoices()
    speechSynthesis.addEventListener('voiceschanged', () => speechSynthesis.getVoices())
  }, [])

  // Preload intro music as ArrayBuffer so it's ready before user gesture
  useEffect(() => {
    fetch('/intro-corta-coche-fantastico.MP3')
      .then(r => r.ok ? r.arrayBuffer() : null)
      .then(buf => { if (buf) introAudioBufRef.current = buf })
      .catch(() => {})
  }, [])

  // Preload ambient scanner loop
  useEffect(() => {
    fetch('/scanner-kitt.mp3')
      .then(r => r.ok ? r.arrayBuffer() : null)
      .then(buf => { if (buf) scannerBufRef.current = buf })
      .catch(() => {})
  }, [])

  // PKCE: exchange auth code when Spotify redirects back with ?code=
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).get('code')) return
    const redirectUri = window.location.hostname === 'localhost'
      ? window.location.origin
      : 'https://kitt-ai-agent.netlify.app'
    exchangePkceCode(SPOTIFY_CLIENT_ID, redirectUri).then(token => {
      if (!token) return
      setSpotifyToken(token)
      try { localStorage.setItem('kitt_sp_token', token) } catch {}
    })
  }, []) // eslint-disable-line

  useEffect(() => { pausedRef.current     = paused        }, [paused])
  useEffect(() => { listeningRef.current  = listening     }, [listening])
  useEffect(() => { speakingRef.current   = speaking      }, [speaking])
  useEffect(() => { thinkingRef.current   = thinking      }, [thinking])
  useEffect(() => { obdRef.current        = obd           }, [obd])
  useEffect(() => { scenarioRef.current   = scenario      }, [scenario])
  useEffect(() => { spotifyTokenRef.current = spotifyToken }, [spotifyToken])
  useEffect(() => { userPosRef.current    = userPos       }, [userPos])
  useEffect(() => { routesRef.current     = routes        }, [routes])
  useEffect(() => { obdStatusRef.current     = obdStatus     }, [obdStatus])
  useEffect(() => { lastStationsRef.current  = lastStations  }, [lastStations])
  useEffect(() => { messagesRef.current      = messages      }, [messages])
  useEffect(() => { triviaModeRef.current    = triviaMode    }, [triviaMode])

  // ── TTS ────────────────────────────────────────────────────────────────────
  const browserSpeak = useCallback((text, onEnd) => {
    const synth = window.speechSynthesis
    if (!synth) { onEnd?.(); return }
    synth.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'es-ES'; utt.pitch = 0.60; utt.rate = 0.85; utt.volume = 1

    const doSpeak = () => {
      const voices = synth.getVoices()
      const pick =
        voices.find(v => /jorge/i.test(v.name)) ||
        voices.find(v => /carlos/i.test(v.name) && v.lang.startsWith('es')) ||
        voices.find(v => /diego/i.test(v.name)) ||
        voices.find(v => /andres|andrés/i.test(v.name)) ||
        voices.find(v => v.lang === 'es-ES' && /google/i.test(v.name)) ||
        voices.find(v => v.lang.startsWith('es') && !(/m[oó]nica|paula|lucia|lucía|elena|siri|female/i.test(v.name))) ||
        voices.find(v => v.lang.startsWith('es'))
      if (pick) utt.voice = pick
      utt.onend = onEnd; utt.onerror = onEnd
      synth.speak(utt)
    }

    const voices = synth.getVoices()
    if (voices.length > 0) {
      doSpeak()
    } else {
      synth.onvoiceschanged = () => { synth.onvoiceschanged = null; doSpeak() }
    }
  }, [])

  const speak = useCallback((text, { saveResume = true, onEnd: postEnd = null } = {}) => {
    // Cancel any previous TTS to prevent double audio
    const gen = ++speakGenRef.current
    if (elevenLabsAudioRef.current) {
      try { elevenLabsAudioRef.current.pause() } catch (_) {}
      elevenLabsAudioRef.current = null
      usingElevenLabsRef.current = false
    }
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
    if (bargeInRecRef.current) {
      try { bargeInRecRef.current.abort() } catch (_) {}
      bargeInRecRef.current = null
    }
    // Sanitize text for TTS — fix abbreviations and artifacts before sending to any engine
    const ttsText = text
      .replace(/K·I·T·T/g, 'Kitt')
      .replace(/K\.I\.T\.T\./g, 'Kitt')
      .replace(/K-I-T-T/g, 'Kitt')
      .replace(/\bKITT\b/g, 'Kitt')
      .replace(/\bMichael\b/gi, 'Cristian')
      .replace(/Knight Industries Two Thousand/gi, 'agente de inteligencia artificial')
      .replace(/Knight Industries/gi, 'sistema de inteligencia artificial')
      // Speed / distance units
      .replace(/\bkm\/h\b/gi, 'kilómetros por hora')
      .replace(/\bkmh\b/gi, 'kilómetros por hora')
      .replace(/\bkph\b/gi, 'kilómetros por hora')
      .replace(/\bkm\b/g, 'kilómetros')
      // Engine / vehicle units
      .replace(/\bRPM\b/g, 'revoluciones')
      .replace(/\bL\/100\s?km\b/gi, 'litros por cien kilómetros')
      .replace(/\bL\/h\b/gi, 'litros por hora')
      // Electrical
      .replace(/(\d+(?:\.\d+)?)\s*V\b/g, '$1 voltios')
      // Percentages already fine — browser reads % as "por ciento"
      // Symbols that TTS reads wrong
      .replace(/·/g, ' ')
      .replace(/—/g, ',')
      .replace(/\.\.\./g, '.')

    if (saveResume) lastResponseRef.current = ttsText
    const { apiKey, voiceId } = loadSettings()
    const onEnd = () => {
      if (speakGenRef.current !== gen) return  // superseded by a newer speak() call — discard
      elevenLabsAudioRef.current = null
      usingElevenLabsRef.current = false
      // Stop barge-in STT if still running
      if (bargeInRecRef.current) {
        try { bargeInRecRef.current.abort() } catch (_) {}
        bargeInRecRef.current = null
      }
      setSpeaking(false); speakingRef.current = false
      postEnd?.()  // trivia timer, chained speech, etc.
      // 1.5s delay — lets speaker audio fully die out before mic opens
      if (!pausedRef.current && !thinkingRef.current) setTimeout(() => startListeningRef.current?.(), 1500)
    }
    const onStart = () => {
      setSpeaking(true); speakingRef.current = true
      speakStartTimeRef.current = Date.now()
      // Barge-in disabled — mic picks up speaker audio and causes self-loop
    }
    if (apiKey && voiceId) {
      usingElevenLabsRef.current = true
      elevenLabsSpeak(
        ttsText, apiKey, voiceId, onStart, onEnd,
        () => {
          // Error fallback to browser TTS — only if this speak() is still current
          if (speakGenRef.current !== gen) return
          usingElevenLabsRef.current = false; elevenLabsAudioRef.current = null
          onStart(); browserSpeak(ttsText, onEnd)
        },
        (audio, url) => {
          // Guard: if a newer speak() was called while this one was fetching, discard
          if (speakGenRef.current !== gen) { URL.revokeObjectURL(url); return true }
          elevenLabsAudioRef.current = audio
        }
      )
    } else {
      onStart(); browserSpeak(ttsText, onEnd)
    }
  }, [browserSpeak])

  // ── STT ────────────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (pausedRef.current || listeningRef.current || thinkingRef.current) return
    // Never listen while Kitt is speaking — prevents mic from picking up speaker audio
    if (speakingRef.current) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    try {
      const rec = new SR()
      rec.lang = 'es-ES'; rec.interimResults = false; rec.maxAlternatives = 3
      rec.onstart  = () => { setListening(true);  listeningRef.current = true }
      rec.onend    = () => {
        setListening(false); listeningRef.current = false
        if (!pausedRef.current && !speakingRef.current && !thinkingRef.current) setTimeout(() => startListeningRef.current?.(), 150)
      }
      rec.onerror  = (e) => {
        setListening(false); listeningRef.current = false
        const delay = e.error === 'no-speech' ? 50 : 250
        if (e.error !== 'aborted' && !pausedRef.current && !thinkingRef.current) setTimeout(() => startListeningRef.current?.(), delay)
      }
      rec.onresult = (e) => {
        // Pick the alternative with highest confidence
        const results = e.results[0]
        let best = results[0]
        for (let i = 1; i < results.length; i++) {
          if (results[i].confidence > best.confidence) best = results[i]
        }
        const t = best.transcript?.trim()
        if (!t || best.confidence < 0.25) return
        handleInputRef.current?.(t)
      }
      recRef.current = rec; rec.start()
    } catch (_) {}
  }, [])

  useEffect(() => { startListeningRef.current = startListening }, [startListening])

  // ── Barge-in STT (runs while ElevenLabs is playing) ───────────────────────
  const startBargeIn = useCallback(() => {
    if (bargeInRecRef.current) return // already running
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    try {
      const rec = new SR()
      rec.lang = 'es-ES'; rec.interimResults = true; rec.maxAlternatives = 1
      rec.onresult = (e) => {
        const t = e.results[0][0].transcript
        if (!t.trim()) return
        if (Date.now() - speakStartTimeRef.current < 1000) return // echo protection
        // Stop Kitt immediately
        if (elevenLabsAudioRef.current) {
          elevenLabsAudioRef.current.pause()
          elevenLabsAudioRef.current = null
          usingElevenLabsRef.current = false
        }
        setSpeaking(false); speakingRef.current = false
        bargeInRecRef.current = null
        if (e.results[0].isFinal) handleInputRef.current?.(t.trim())
      }
      rec.onend = () => {
        bargeInRecRef.current = null
        if (speakingRef.current && usingElevenLabsRef.current) setTimeout(() => startBargeInRef.current?.(), 200)
      }
      rec.onerror = () => {
        bargeInRecRef.current = null
        if (speakingRef.current && usingElevenLabsRef.current) setTimeout(() => startBargeInRef.current?.(), 300)
      }
      bargeInRecRef.current = rec
      rec.start()
    } catch (_) {}
  }, [])

  useEffect(() => { startBargeInRef.current = startBargeIn }, [startBargeIn])

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handleNavigation = useCallback(async (destination) => {
    speak(`Calculando rutas hacia ${destination}.`)
    try {
      const place = await geocodeAddress(destination)
      const mapsUrls = getMapsUrls(destination)
      if (!place) {
        setPendingNav({ ...mapsUrls, label: destination, distKm: null, durMin: null })
        speak(`No encontré "${destination}" exacto. Toca el botón naranja para abrir Maps.`)
        return
      }
      const pos = userPosRef.current
      if (!pos) {
        setPendingNav({ ...mapsUrls, label: place.name, distKm: null, durMin: null })
        speak(`Destino: ${place.name}. Activa tu ubicación para calcular rutas. Toca el botón naranja.`)
        return
      }
      const routeList = await getRoutes(pos.lat, pos.lon, place.lat, place.lon)
      if (!routeList.length) {
        setPendingNav({ ...mapsUrls, label: place.name, distKm: null, durMin: null })
        speak(`No pude calcular ruta hacia ${place.name}. Toca el botón para abrir Maps.`)
        return
      }
      const labeled = routeList.map(r => ({ ...r, destination: place.name, mapsUrls }))
      setRoutes(labeled)
      const tips = getDrivingTips(labeled[0], obdRef.current.fuel)
      setRouteTips(tips)

      let msg = `He encontrado ${labeled.length} ruta${labeled.length > 1 ? 's' : ''} hacia ${place.name}. `
      labeled.forEach((r, i) => {
        msg += `Ruta ${i + 1}: ${formatDuration(r.durationMin)}, ${r.distKm} kilómetros, ${r.fuel.liters} litros, ${r.fuel.euros} euros. `
      })
      msg += `Di "la primera", "la más rápida" o "la más económica" para seleccionar.`
      speak(msg)
      routeAnnouncedAtRef.current = Date.now()

      // Load elevation profiles in background
      labeled.forEach(async (route, i) => {
        const elev = await getElevationGain(route.geometry)
        if (elev) setRoutes(prev => prev.map((r, ri) => ri === i ? { ...r, elev } : r))
      })
    } catch {
      const mapsUrls = getMapsUrls(destination)
      setPendingNav({ ...mapsUrls, label: destination, distKm: null, durMin: null })
      speak(`Error al calcular ruta, Cristian. Toca el botón para abrir Maps directamente.`)
    }
  }, [speak])

  const handleRouteSelect = useCallback((choice) => {
    const available = routesRef.current
    if (!available.length) return
    let selected
    if (typeof choice === 'number') {
      selected = available[choice] ?? available[0]
    } else if (choice === 'fastest') {
      selected = [...available].sort((a, b) => a.durationMin - b.durationMin)[0]
    } else if (choice === 'cheapest') {
      selected = [...available].sort((a, b) => a.fuel.euros - b.fuel.euros)[0]
    } else if (choice === 'shortest') {
      selected = [...available].sort((a, b) => a.distKm - b.distKm)[0]
    } else if (choice === 'confirm') {
      selected = available[0]
    }
    if (!selected) return
    const tips = getDrivingTips(selected, obdRef.current.fuel)
    setPendingNav({ ...selected.mapsUrls, label: selected.destination, distKm: selected.distKm, durMin: selected.durationMin, liters: selected.fuel.liters, euros: selected.fuel.euros, elev: selected.elev ?? null })
    setNavRoute({ destination: selected.destination, distanceKm: selected.distKm, durationMin: selected.durationMin })
    setRoutes([])
    let msg = `Ruta seleccionada: ${selected.distKm} kilómetros en ${formatDuration(selected.durationMin)}, ${selected.fuel.liters} litros estimados, ${selected.fuel.euros} euros.`
    if (tips.length > 0) msg += ` Consejo: ${tips[0]}`
    msg += ` Toca el botón naranja para abrir la navegación.`
    speak(msg)
  }, [speak])

  useEffect(() => { handleNavRef.current         = handleNavigation  }, [handleNavigation])
  useEffect(() => { handleRouteSelectRef.current = handleRouteSelect }, [handleRouteSelect])

  // ── Spotify ─────────────────────────────────────────────────────────────────
  const handleSpotify = useCallback(async (intent) => {
    const token = spotifyTokenRef.current
    if (!token) {
      if (intent.action === 'play_artist' || intent.action === 'play_track') {
        speak(`Abriendo Spotify. Conecta tu cuenta en ajustes para control completo.`)
        openSpotifySearch(intent.query)
      } else speak(`Conecta Spotify en ajustes, Cristian.`)
      return
    }
    try {
      if (intent.action === 'play_artist') {
        speak(`Buscando música de ${intent.query}.`)
        const track = await searchArtistTopTrack(intent.query, token)
        if (track) { await playUri(track.uri, token); speak(`Poniendo ${track.name} de ${track.artists[0].name}.`) }
        else speak(`No encontré a ${intent.query} en Spotify.`)
      } else if (intent.action === 'play_track') {
        speak(`Buscando ${intent.query}.`)
        const track = await searchTrack(intent.query, token)
        if (track) { await playUri(track.uri, token); speak(`Poniendo ${track.name} de ${track.artists[0].name}.`) }
        else speak(`No encontré ${intent.query}.`)
      } else if (intent.action === 'play_any') {
        await spotifyControl('resume', token)
        speak('Reproduciendo música, Cristian.')
      } else if (intent.action === 'next')     { await spotifyControl('next',     token); speak('Siguiente canción.') }
      else if (intent.action === 'previous')   { await spotifyControl('previous', token); speak('Canción anterior.') }
      else if (intent.action === 'pause')      { await spotifyControl('pause',    token); speak('Música en pausa.') }
      else if (intent.action === 'resume')     { await spotifyControl('resume',   token); speak('Reanudando música.') }
      else if (intent.action === 'volume')     { await setVolume(intent.level, token); speak(intent.level >= 60 ? 'Subiendo volumen.' : 'Bajando volumen.') }
      else if (intent.action === 'current') {
        const t = await getCurrentTrack(token)
        speak(t ? `Está sonando ${t.name} de ${t.artist}.` : 'No hay música reproduciéndose ahora.')
      }
    } catch (e) {
      if (e.message === 'TOKEN_EXPIRED') {
        setSpotifyToken(null); try { localStorage.removeItem('kitt_sp_token') } catch {}
        speak('La sesión de Spotify ha caducado. Vuelve a conectarla en ajustes.')
      } else if (e.message?.includes('404')) {
        speak('No hay ningún dispositivo Spotify activo. Abre Spotify en tu móvil primero y luego dime qué poner.')
      } else if (e.message?.includes('403')) {
        speak('Sin permiso de Spotify. Necesitas Spotify Premium para controlar la reproducción desde aquí.')
      } else {
        speak('No puedo conectar con Spotify ahora mismo.')
      }
    }
  }, [speak])

  useEffect(() => { handleSpotifyRef.current = handleSpotify }, [handleSpotify])

  // ── Trivia — load and speak next question ─────────────────────────────────
  const nextTriviaQuestion = useCallback(async (topic) => {
    const t = topic || triviaTopicRef.current || 'cultura general'
    const { claudeKey } = loadSettings()
    if (!claudeKey) { speak('Necesitas configurar Claude en ajustes para jugar al trivial.'); return }
    setThinking(true); thinkingRef.current = true
    try {
      const q = await fetchTriviaQuestion(t, claudeKey)
      if (!q) { speak('No pude generar la pregunta. ¿Lo intentamos otra vez?'); return }
      triviaQuestionRef.current = q
      const fullText = `${q.question} A: ${q.options.A}. B: ${q.options.B}. C: ${q.options.C}. D: ${q.options.D}.`
      setMessages(prev => [...prev, { role: 'kitt', text: fullText, ts: Date.now() }])
      speak(fullText, {
        onEnd: () => {
          if (!triviaModeRef.current) return
          let secs = 15
          setTriviaTimer(secs); triviaTimerRef.current = secs
          triviaTickRef.current = setInterval(() => {
            secs--
            setTriviaTimer(secs); triviaTimerRef.current = secs
            playTick(audioCtxRef, secs % 2 === 0)
            if (secs <= 0) {
              clearInterval(triviaTickRef.current); triviaTickRef.current = null
              setTriviaTimer(null); triviaTimerRef.current = null
              const qDone = triviaQuestionRef.current
              if (!qDone) return
              triviaQuestionRef.current = null
              const timeMsg = `Tiempo agotado. La correcta era la ${qDone.correct}: ${qDone.options[qDone.correct]}. ${qDone.explanation} ¿Siguiente?`
              setMessages(prev => [...prev, { role: 'kitt', text: timeMsg, ts: Date.now() }])
              speak(timeMsg)
            }
          }, 1000)
        },
      })
    } catch (err) {
      console.error('Trivia fetch error:', err)
      speak('Error al cargar la pregunta de trivial.')
    } finally {
      setThinking(false); thinkingRef.current = false
    }
  }, [speak])

  useEffect(() => { nextTriviaQuestionRef.current = nextTriviaQuestion }, [nextTriviaQuestion])

  // ── Handle Input ──────────────────────────────────────────────────────────
  const handleInput = useCallback(async (text) => {
    if (thinkingRef.current) return

    // ── Silence / resume commands ─────────────────────────────────────────
    const qSil = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (text.length < 35 && /\b(callate|calla|silencio|basta|para de hablar|suficiente|para|stop)\b/.test(qSil)) {
      if (elevenLabsAudioRef.current) { elevenLabsAudioRef.current.pause(); elevenLabsAudioRef.current = null; usingElevenLabsRef.current = false }
      window.speechSynthesis?.cancel()
      setSpeaking(false); speakingRef.current = false
      return
    }
    if (text.length < 40 && /\b(sigue hablando|reanuda tu respuesta|continua hablando|termina de hablar|donde ibas)\b/.test(qSil)) {
      if (lastResponseRef.current) speak(lastResponseRef.current, { saveResume: false })
      return
    }

    setMessages(prev => [...prev, { role: 'user', text, ts: Date.now() }])

    const isSimulated = obdStatusRef.current !== 'connected'

    // ── Emergency call — highest priority after silence commands ─────────────
    {
      const qEmerg = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      if (/\b(emergencia|sos|auxilio|llama(r)? a (mi )?(contacto|emergencias?|socorro)|protocolo de emergencia|necesito ayuda urgente)\b/.test(qEmerg)) {
        const { emergencyName, emergencyPhone } = loadSettings()
        if (emergencyPhone) {
          const phone = emergencyPhone.replace(/\s+/g, '')
          const contactLabel = emergencyName || 'tu contacto de emergencia'
          const msg = `Iniciando protocolo de emergencia. Conectando con ${contactLabel}.`
          setMessages(prev => [...prev, { role: 'kitt', text: msg, ts: Date.now() }])
          speak(msg)
          const a = document.createElement('a')
          a.href = `tel:${phone}`
          document.body.appendChild(a); a.click(); document.body.removeChild(a)
        } else {
          const msg = 'No hay ningún contacto de emergencia configurado. Añade un número de teléfono en ajustes, sección protocolo de emergencia.'
          setMessages(prev => [...prev, { role: 'kitt', text: msg, ts: Date.now() }])
          speak(msg)
        }
        return
      }
    }

    // ── Trivia — active game commands (answer, next, stop, topic change) ────
    const qTrivia = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (triviaModeRef.current) {
      // Stop trivia
      if (/\b(para el trivial|salir del trivial|fin del trivial|terminar el juego|no (quiero )?mas trivial)\b/.test(qTrivia)) {
        if (triviaTickRef.current) { clearInterval(triviaTickRef.current); triviaTickRef.current = null }
        setTriviaTimer(null); triviaTimerRef.current = null
        setTriviaMode(false); triviaModeRef.current = false
        triviaQuestionRef.current = null
        const sc = triviaScore
        const endMsg = `Fin del trivial. Has acertado ${sc.correct} de ${sc.total} preguntas. ¡Hasta la próxima!`
        setMessages(prev => [...prev, { role: 'kitt', text: endMsg, ts: Date.now() }])
        speak(endMsg); return
      }

      // Answer: detect A/B/C/D
      if (triviaQuestionRef.current) {
        const ansM = text.match(/\b([abcd])\b/i)
          || text.match(/(?:opci[oó]n|respuesta|letra|diria que|creo que|es la?)\s+([abcd])\b/i)
        if (ansM) {
          if (triviaTickRef.current) { clearInterval(triviaTickRef.current); triviaTickRef.current = null }
          setTriviaTimer(null); triviaTimerRef.current = null
          const answer = ansM[1].toUpperCase()
          const q = triviaQuestionRef.current
          triviaQuestionRef.current = null
          const isCorrect = answer === q.correct
          setTriviaScore(prev => ({ correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 }))
          const resultMsg = isCorrect
            ? `¡Correcto, la ${answer}! ${q.explanation} ¿Siguiente pregunta?`
            : `No era la ${answer}. La correcta era la ${q.correct}: ${q.options[q.correct]}. ${q.explanation} ¿Seguimos?`
          setMessages(prev => [...prev, { role: 'kitt', text: resultMsg, ts: Date.now() }])
          speak(resultMsg); return
        }
      }

      // "Siguiente" / "otra"
      if (!triviaQuestionRef.current && /\b(siguiente|otra|mas|continua(r)?|si|venga|dale|vamos|listo)\b/.test(qTrivia)) {
        nextTriviaQuestionRef.current?.(triviaTopicRef.current); return
      }

      // Topic change: "cambia el tema a historia" / "sobre ciencia"
      const topicM = text.match(/(?:cambia(?:r)? (?:el )?tema(?: a)?|sobre|(?:preguntas?\s+de)|tema(?:\s+de)?)\s+([^.,?!]+)/i)
      if (topicM) {
        triviaTopicRef.current = topicM[2].trim()
        const topicMsg = `Cambiando a preguntas sobre ${triviaTopicRef.current}.`
        speak(topicMsg, { onEnd: () => nextTriviaQuestionRef.current?.(triviaTopicRef.current) }); return
      }
    }

    const dest = extractDestination(text)
    if (dest) { handleNavRef.current?.(dest); return }

    // Cheap fuel stations
    if (extractFuelStationIntent(text)) {
      const pos = userPosRef.current
      if (!pos) {
        const msg = 'Necesito tu ubicación GPS para buscar gasolineras. Activa el GPS.'
        setMessages(prev => [...prev, { role: 'kitt', text: msg }])
        speak(msg)
        return
      }
      speak('Buscando las gasolineras más baratas cerca...')
      try {
        const stations = await findCheapStations(pos.lat, pos.lon)
        setLastStations(stations)
        const msg = stationsToSpeech(stations)
        setMessages(prev => [...prev, { role: 'kitt', text: msg, ts: Date.now() }])
        speak(msg)
      } catch {
        const msg = 'No pude obtener datos de gasolineras en este momento.'
        setMessages(prev => [...prev, { role: 'kitt', text: msg, ts: Date.now() }])
        speak(msg)
      }
      return
    }

    // ── Voice screen commands ─────────────────────────────────────────────
    const qVoice = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (/\b(muestrame|muestra|abre|mostrar|ver|show|pantalla)\b/.test(qVoice)) {
      if (/\b(mapa|navegacion|ruta|maps)\b/.test(qVoice)) {
        if (pendingNav) { openNavigation(); return }
        const pos = userPosRef.current
        if (navRoute) {
          const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(navRoute.destination)}&travelmode=driving`
          const a = document.createElement('a'); a.href = mapsUrl; a.target = '_blank'; a.rel = 'noopener noreferrer'
          document.body.appendChild(a); a.click(); document.body.removeChild(a)
          speak('Abriendo el mapa de navegación.')
        } else {
          speak('No hay ninguna ruta activa. Dime adónde quieres ir.')
        }
        return
      }
      if (/\b(spotify|musica|reproductor|canciones)\b/.test(qVoice)) {
        const a = document.createElement('a'); a.href = 'https://open.spotify.com'; a.target = '_blank'; a.rel = 'noopener noreferrer'
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
        speak('Abriendo Spotify.')
        return
      }
      if (/\b(parametros|datos|motor|obd|dashboard|velocidad|gauges)\b/.test(qVoice)) {
        const o = obdRef.current
        const msg = `Voy a ${o.speed} kilómetros por hora, a ${Math.round(o.rpm)} revoluciones por minuto, me encuentro a ${Math.round(o.temp)} grados, llevo el ${Math.round(o.fuel)} por ciento de combustible y mi batería marca ${o.battery} voltios.`
        setMessages(prev => [...prev, { role: 'kitt', text: msg, ts: Date.now() }])
        speak(msg); return
      }
    }

    // ── Navigate to a previously found gas station ────────────────────────
    if (lastStationsRef.current.length > 0 && /gasolinera|primera|mas barata|estacion de servicio/.test(qVoice)) {
      const dest = extractDestination(text)
      if (!dest || /gasolinera|estacion/i.test(dest)) {
        const idx = /segunda|numero 2/.test(qVoice) ? 1 : /tercera|numero 3/.test(qVoice) ? 2 : 0
        const st  = lastStationsRef.current[idx]
        if (st?.lat) {
          const pos = userPosRef.current
          if (!pos) { speak('Activa el GPS para calcular la ruta.'); return }
          speak(`Calculando ruta hacia ${st.nombre}.`)
          try {
            const routeList = await getRoutes(pos.lat, pos.lon, st.lat, st.lon)
            if (!routeList.length) { speak(`No pude calcular ruta hacia ${st.nombre}.`); return }
            const labeled = routeList.map(r => ({ ...r, destination: st.nombre, mapsUrls: getMapsUrls(st.nombre) }))
            setRoutes(labeled); setRouteTips(getDrivingTips(labeled[0], obdRef.current.fuel))
            let msg = `Ruta hacia ${st.nombre}: ${labeled[0].durationMin} minutos, ${labeled[0].distKm} kilómetros, ${labeled[0].fuel.liters} litros. `
            if (labeled.length > 1) msg += `Tengo ${labeled.length} alternativas. Di "la primera", "la más rápida" o "la más económica".`
            speak(msg)
            routeAnnouncedAtRef.current = Date.now()
          } catch { speak(`No pude calcular la ruta. Prueba "llévame a ${st.nombre}".`) }
          return
        }
      }
    }

    // ── Change active route by voice ──────────────────────────────────────
    if (/cambia(r)? la ruta|otra ruta|ruta alternativa|recalcula|diferente ruta/.test(qVoice)) {
      if (navRoute) {
        speak(`Recalculando ruta hacia ${navRoute.destination}.`)
        handleNavRef.current?.(navRoute.destination)
      } else {
        speak('No hay ninguna ruta activa que recalcular.')
      }
      return
    }

    // Route selection while route panel is open
    // 8-second echo-lock: blocks STT from picking up KITT's own route announcement
    if (routesRef.current.length > 0 && Date.now() - routeAnnouncedAtRef.current > 8000) {
      // If the user is asking a question about the routes, pass to Claude instead of auto-selecting
      const isRouteQuestion = /qu[eé]|cu[aá][nl]|c[oó]mo|por qu[eé]|cu[aá]nto|cu[aá]ndo|d[ií]me|cu[eé]ntame|explica|informaci[oó]n|detalles|tarda|consume|consum|pasa|diferencia|mejor|recomien|\?/i.test(text)
      if (!isRouteQuestion) {
        const choice = extractRouteChoice(text)
        if (choice !== null) { handleRouteSelectRef.current?.(choice); return }
      }
    }

    // ── Weather ───────────────────────────────────────────────────────────
    const weatherIntent = extractWeatherIntent(text)
    if (weatherIntent !== null) {
      try {
        let lat, lon, locationName
        if (weatherIntent.location) {
          const place = await geocodeAddress(weatherIntent.location)
          if (!place) {
            const msg = `No encontré "${weatherIntent.location}" en el mapa.`
            setMessages(prev => [...prev, { role: 'kitt', text: msg, ts: Date.now() }]); speak(msg); return
          }
          lat = place.lat; lon = place.lon; locationName = place.name.split(',')[0]
        } else {
          const pos = userPosRef.current
          if (!pos) {
            const msg = 'Activa el GPS para que pueda darte el tiempo local.'
            setMessages(prev => [...prev, { role: 'kitt', text: msg, ts: Date.now() }]); speak(msg); return
          }
          lat = pos.lat; lon = pos.lon; locationName = null
        }
        let msg
        if (weatherIntent.forecast) {
          const daily = await getWeatherForecast(lat, lon)
          msg = forecastToSpeech(daily, locationName, weatherIntent.days)
        } else {
          const w = await getWeatherByCoords(lat, lon)
          msg = weatherToSpeech(w, locationName)
        }
        setMessages(prev => [...prev, { role: 'kitt', text: msg, ts: Date.now() }])
        speak(msg)
      } catch {
        const msg = 'No pude obtener el tiempo ahora mismo. La API meteorológica no responde.'
        setMessages(prev => [...prev, { role: 'kitt', text: msg, ts: Date.now() }]); speak(msg)
      }
      return
    }

    const music = extractMusicIntent(text)
    if (music) { handleSpotifyRef.current?.(music); return }

    // ── Trivia game init ──────────────────────────────────────────────────
    const qTrivInit = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (!triviaModeRef.current && /\b(juguemos? al trivial|jugar al trivial|empecemos? el trivial|trivial|trivia|quiz(z)?|juguemos? quiz)\b/.test(qTrivInit)) {
      setTriviaMode(true); triviaModeRef.current = true
      setTriviaScore({ correct: 0, total: 0 })
      triviaTopicRef.current = 'cultura general'
      const topicM = text.match(/(?:sobre|de|acerca de)\s+([^.,?!]+)/i)
      if (topicM) triviaTopicRef.current = topicM[1].trim()
      const startMsg = `Modo trivial activado. Cuatro opciones, quince segundos por pregunta contando desde que acabe de leerla. Empezamos sobre ${triviaTopicRef.current}.`
      setMessages(prev => [...prev, { role: 'kitt', text: startMsg, ts: Date.now() }])
      speak(startMsg, { onEnd: () => nextTriviaQuestionRef.current?.(triviaTopicRef.current) }); return
    }

    const { claudeKey } = loadSettings()
    let response

    if (claudeKey) {
      setThinking(true); thinkingRef.current = true
      // Safety: clear thinking after 15s max to prevent permanent lockup
      const thinkingTimeout = setTimeout(() => { setThinking(false); thinkingRef.current = false }, 15000)
      try {
        // Build route context for Claude reasoning
        const activeRoute = routesRef.current[0] ?? null
        const routeCtx = (navRoute || activeRoute) ? {
          dest:    navRoute?.destination ?? 'ruta activa',
          distKm:  navRoute?.distanceKm  ?? activeRoute?.distKm,
          durMin:  navRoute?.durationMin  ?? activeRoute?.durationMin,
          liters:  activeRoute?.fuel?.liters ?? '—',
          euros:   activeRoute?.fuel?.euros  ?? '—',
          tipo:    activeRoute?.fuel?.type   ?? '—',
          elev:    activeRoute?.elev ?? null,
        } : null

        const s = loadSettings()
        response = await askKitt(text, obdRef.current, claudeKey, isSimulated, {
          location: userPosRef.current ? `${userPosRef.current.lat.toFixed(3)},${userPosRef.current.lon.toFixed(3)}` : null,
          routeCtx,
          history: messagesRef.current,
          gpsPos:  userPosRef.current ?? null,
          userName:    s.userName,
          missionCode: s.missionCode,
        })
        if (!response) response = getKittResponse(text, obdRef.current, isSimulated)
      } catch (err) {
        console.error('Claude error:', err.name, err.message, err)
        const msg = err?.message || ''
        const statusMatch = msg.match(/Claude (\d+)/)
        const status = statusMatch ? parseInt(statusMatch[1]) : 0
        if (status === 401 || msg.includes('Unauthorized'))
          response = 'La clave de Claude no es válida. Revísala en ajustes.'
        else if (status === 429)
          response = 'Límite de Claude alcanzado. Espera un momento.'
        else if (status === 400)
          response = 'Error de formato con Claude. Borra el historial desde ajustes y vuelve a intentarlo.'
        else if (status >= 500)
          response = 'Los servidores de Claude están sobrecargados. Inténtalo en unos segundos.'
        else if (err.name === 'AbortError' || msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('timeout'))
          response = 'Claude no responde. Comprueba tu conexión a internet.'
        else
          response = `Error al conectar con Claude: ${err.name}. Revisa la clave en ajustes.`
      } finally {
        clearTimeout(thinkingTimeout)
        setThinking(false); thinkingRef.current = false
      }
    } else {
      response = getKittResponse(text, obdRef.current, isSimulated)
    }

    trainingRef.current.push({ ts: Date.now(), scenario: scenarioRef.current, user: text, kitt: response, obd: { ...obdRef.current } })
    setMessages(prev => [...prev, { role: 'kitt', text: response, ts: Date.now() }])
    speak(response)
  }, [speak])

  useEffect(() => { handleInputRef.current = handleInput }, [handleInput])

  // ── Boot & Unlock ──────────────────────────────────────────────────────────
  const handleUnlock = useCallback(() => {
    // Unlock speechSynthesis (iOS browser TTS)
    const s = new SpeechSynthesisUtterance(' ')
    s.volume = 0; window.speechSynthesis?.speak(s)

    // Unlock HTMLAudioElement on iOS — MUST be called synchronously inside a user gesture.
    // After this, Audio.play() works from any async context (STT callbacks, fetch chains, etc.)
    // Without this, iOS Safari blocks Audio.play() from non-gesture contexts and falls back
    // to the robotic browser voice.
    try {
      const a = new Audio()
      // Minimal silent WAV — 44 bytes, 0 samples
      a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
      a.volume = 0
      const p = a.play()
      if (p) p.catch(() => {})
    } catch (_) {}

    // Also unlock AudioContext used for tick-tock (trivia timer beeps)
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
      audioCtxRef.current.resume().catch(() => {})
    } catch (_) {}

    // Play intro music via AudioContext (bypasses iOS autoplay restrictions)
    try {
      const ctx = audioCtxRef.current
      const buf = introAudioBufRef.current
      if (ctx && buf) {
        ctx.decodeAudioData(buf.slice(0), decoded => {
          const source = ctx.createBufferSource()
          source.buffer = decoded
          source.loop = true
          const gain = ctx.createGain()
          gain.gain.value = 0.55
          source.connect(gain)
          gain.connect(ctx.destination)
          source.start(0)
          introMusicRef.current = { source, gain }
        }, () => {})
      }
    } catch (_) {}

    setUnlocked(true); setBooting(true)
  }, [])

  const handleBootComplete = useCallback(() => {
    setBooting(false)
    const greeting = buildGreeting(obdStatusRef.current === 'connected')
    setMessages(prev => {
      const withGreeting = [...prev, { role: 'kitt', text: greeting, ts: Date.now() }]
      return withGreeting.slice(-200)
    })
    if (introMusicRef.current?.source) {
      const { source, gain } = introMusicRef.current
      let vol = 0.55
      const fadeOut = setInterval(() => {
        vol = Math.max(0, vol - 0.12)
        gain.gain.value = vol
        if (vol <= 0) {
          try { source.stop() } catch (_) {}
          clearInterval(fadeOut)
          introMusicRef.current = null
        }
      }, 40)
      setTimeout(() => speak(greeting), 350)
    } else {
      speak(greeting)
    }

    // Start ambient scanner loop
    setTimeout(() => {
      try {
        const ctx = audioCtxRef.current
        const buf = scannerBufRef.current
        if (ctx && buf && !scannerSourceRef.current) {
          ctx.decodeAudioData(buf.slice(0), decoded => {
            const src  = ctx.createBufferSource()
            src.buffer = decoded
            src.loop   = true
            const gain = ctx.createGain()
            gain.gain.value = 0.12
            src.connect(gain)
            gain.connect(ctx.destination)
            src.start(0)
            scannerSourceRef.current = { src, gain }
          }, () => {})
        }
      } catch (_) {}
    }, 800)
  }, [speak])

  // ── OBD WiFi ───────────────────────────────────────────────────────────────
  const connectOBD = useCallback(async (customUrl = null) => {
    if (obdWifiRef.current) { obdWifiRef.current.disconnect(); obdWifiRef.current = null }
    setObdStatus('connecting')
    const client = new OBDWifi({
      onData:   (key, val) => setObdLive(p => ({ ...p, [key]: val })),
      onStatus: setObdStatus,
      onError:  (e) => console.warn('OBD error:', e),
    })
    try {
      const url = await client.tryConnect(customUrl)
      obdWifiRef.current = client
      speak(`Conexión OBD establecida, Cristian. Recibiendo datos en tiempo real.`)
    } catch {
      setObdStatus('disconnected')
      speak('No encontré el adaptador OBD por WiFi. Asegúrate de estar conectado al WiFi del adaptador.')
    }
  }, [speak])

  const disconnectOBD = useCallback(() => {
    obdWifiRef.current?.disconnect()
    obdWifiRef.current = null
    setObdLive({})
  }, [])

  // Cleanup on unmount
  useEffect(() => () => obdWifiRef.current?.disconnect(), [])

  // ── GPS — position + auto-scenario from speed (always active) ───────────
  useEffect(() => {
    if (!navigator.geolocation) return
    let lastScenario = null
    const id = navigator.geolocation.watchPosition(
      p => {
        setUserPos({ lat: p.coords.latitude, lon: p.coords.longitude })
        if (p.coords.speed == null) return
        const kmh = p.coords.speed * 3.6
        const next = kmh < 3   ? 'parked'
                   : kmh < 15  ? 'idle'
                   : kmh < 60  ? 'city'
                   : kmh < 100 ? 'road'
                   :             'highway'
        if (next !== lastScenario) { lastScenario = next; setScenario(next) }
      },
      null,
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  // ── Spotify polling ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!spotifyToken) return
    const id = setInterval(async () => {
      try { setNowPlaying(await getCurrentTrack(spotifyToken)) } catch { setNowPlaying(null) }
    }, 5000)
    return () => clearInterval(id)
  }, [spotifyToken])

  // ── Proactive OBD Advisor ─────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (pausedRef.current || speakingRef.current || thinkingRef.current) return
      const obd = obdRef.current

      const { silentMode, speedAlertKmh: alertKmh = 130 } = loadSettings()

      // Speed alert fires even in silent mode (safety)
      if (obd.speed > alertKmh && Date.now() - lastSpeedAlertRef.current > 60000) {
        lastSpeedAlertRef.current = Date.now()
        speak(`${loadSettings().userName}, voy a ${obd.speed} kilómetros por hora. Por encima del límite configurado.`)
        return
      }

      if (silentMode) return  // Protocolo de silencio activo — no proactive speech

      // Track OFCO
      if (isOfcoActive(obd)) {
        if (!ofcoStartRef.current) ofcoStartRef.current = Date.now()
        ofcoSecsRef.current = (Date.now() - ofcoStartRef.current) / 1000
      } else {
        ofcoStartRef.current = null
        ofcoSecsRef.current  = 0
      }

      // Track idle
      if (obd.speed < 2 && obd.rpm > 500) {
        if (!idleStartRef.current) idleStartRef.current = Date.now()
        idleSecsRef.current = (Date.now() - idleStartRef.current) / 1000
      } else {
        idleStartRef.current = null
        idleSecsRef.current  = 0
      }

      // Speed trend (last 5 samples)
      speedHistRef.current = [...speedHistRef.current.slice(-4), obd.speed]
      const hist = speedHistRef.current
      const speedTrend = hist.length >= 3
        ? (hist[hist.length - 1] > hist[0] + 4 ? 'subiendo' : hist[hist.length - 1] < hist[0] - 4 ? 'bajando' : 'estable')
        : 'estable'

      const ctx  = { ofcoSeconds: ofcoSecsRef.current, idleSeconds: idleSecsRef.current, speedTrend }
      const rule = evaluateRules(obd, ctx, lastSpokenRef.current)
      if (rule) {
        const phrase = getRulePhrase(rule, obd, ctx)
        lastSpokenRef.current[rule.id] = Date.now()
        speak(phrase)
        return
      }

      // Route commentary — tips while navigating
      const activeRoute = routesRef.current[0] ?? null
      if (navRoute && activeRoute && !lastSpokenRef.current['route_tip_shown']) {
        const tips = []
        if (obd.speed > 115) tips.push(`A más de 115 por hora el consumo se dispara. Baja a 110 y ahorrarás sobre ${(activeRoute.fuel.liters * 0.12).toFixed(1)} litros en esta ruta.`)
        if (activeRoute.elev?.gainM > 200 && !lastSpokenRef.current['route_elev_tip']) {
          tips.push(`Esta ruta tiene ${activeRoute.elev.gainM} metros de subida. En las cuestas mantén 2000 RPM y anticipa los adelantamientos.`)
          lastSpokenRef.current['route_elev_tip'] = Date.now()
        }
        if (activeRoute.elev?.lossM > 200 && !lastSpokenRef.current['route_descent_tip']) {
          tips.push(`Hay ${activeRoute.elev.lossM} metros de bajada en la ruta. Mete marcha, levanta el pie y activa el OFCO: consumo cero en todo el descenso.`)
          lastSpokenRef.current['route_descent_tip'] = Date.now()
        }
        if (tips.length > 0 && !lastSpokenRef.current['route_tip_shown']) {
          lastSpokenRef.current['route_tip_shown'] = Date.now()
          speak(tips[0])
        }
      }
    }, 5000)
    return () => clearInterval(id)
  }, [speak])

  // ── History persistence ───────────────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-200))) } catch {}
  }, [messages])

  // ── Scroll ────────────────────────────────────────────────────────────────
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Pause / Resume ─────────────────────────────────────────────────────────
  const togglePause = useCallback(() => {
    const next = !pausedRef.current
    setPaused(next); pausedRef.current = next
    if (next) {
      if (elevenLabsAudioRef.current) { elevenLabsAudioRef.current.pause(); elevenLabsAudioRef.current = null; usingElevenLabsRef.current = false }
      window.speechSynthesis?.cancel()
      recRef.current?.abort()
      setSpeaking(false); speakingRef.current = false
      setListening(false); listeningRef.current = false
    } else setTimeout(() => startListeningRef.current?.(), 400)
  }, [])

  const handleSpotifyAuth = useCallback(async (clientId) => {
    const redirectUri = window.location.hostname === 'localhost'
      ? window.location.origin
      : 'https://kitt-ai-agent.netlify.app'
    window.location.href = await buildSpotifyAuthUrl(clientId, redirectUri)
  }, [])

  // ── Open Navigation — called within user gesture (button tap) ─────────────
  const openNavigation = useCallback(() => {
    if (!pendingNav) return
    const { web } = pendingNav
    setPendingNav(null)
    // Use <a> element click to avoid popup blocker (works on iOS, Android, Chrome)
    const a = document.createElement('a')
    a.href = web; a.target = '_blank'; a.rel = 'noopener noreferrer'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }, [pendingNav])

  // ── Export Training Data ───────────────────────────────────────────────────
  const exportTraining = useCallback(() => {
    if (!trainingRef.current.length) {
      alert('No hay conversaciones grabadas todavía.')
      return
    }
    const blob = new Blob([JSON.stringify(trainingRef.current, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `kitt-training-${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url)
  }, [])

  // ── Clock ────────────────────────────────────────────────────────────────
  const [clockTime, setClockTime] = useState(() => {
    const d = new Date()
    return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0')
  })
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date()
      setClockTime(String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'))
    }, 15000)
    return () => clearInterval(id)
  }, [])

  // ── Pill button handler ──────────────────────────────────────────────────
  const handlePill = useCallback((pill) => {
    const obdData = obdRef.current
    switch (pill) {
      case 'AIR': speak('Climatización activada.'); break
      case 'OIL': speak(`Mi aceite está en nivel correcto. Me encuentro a ${Math.round(obdData.temp)} grados, a ${Math.round(obdData.rpm)} revoluciones. No detecto ninguna alerta.`); break
      case 'P1':  togglePause(); break
      case 'P2':  setShowSettings(true); break
      case 'S1':  speak('Procesando ruta al destino principal.'); break
      case 'S2':  speak('Procesando ruta al destino secundario.'); break
      case 'P3':  obdStatus === 'connected' ? disconnectOBD() : connectOBD(); break
      case 'P4':  exportTraining(); break
      default: break
    }
  }, [speak, togglePause, obdStatus, connectOBD, disconnectOBD, exportTraining])

  // ── Voice area tap — interrupt Kitt + start STT ──────────────────────────
  const handleVoiceTap = useCallback(() => {
    if (elevenLabsAudioRef.current) {
      elevenLabsAudioRef.current.pause()
      elevenLabsAudioRef.current = null
      usingElevenLabsRef.current = false
    }
    window.speechSynthesis?.cancel()
    setSpeaking(false); speakingRef.current = false
    if (!pausedRef.current) setTimeout(() => startListeningRef.current?.(), 120)
  }, [])

  // ── kitt status text for display ─────────────────────────────────────────
  const kittStatusText = speaking ? 'KITT HABLANDO'
    : thinking ? 'PROCESANDO...'
    : listening ? 'ESCUCHANDO...'
    : paused ? 'EN PAUSA'
    : 'KITT ACTIVO'

  const kittHintText = listening ? '' : speaking ? '' : 'TOCA PARA HABLAR'

  // ── Onboarding check ─────────────────────────────────────────────────────
  if (showOnboarding) return (
    <OnboardingScreen onComplete={(name) => setShowOnboarding(false)} />
  )

  // ── Unlock screen ────────────────────────────────────────────────────────
  if (!unlocked) return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', fontFamily: "'Eurostile',sans-serif" }}>
      <div style={{ position: 'fixed', inset: 0, opacity: 0.04, backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,1) 2px,rgba(255,255,255,1) 4px)', pointerEvents: 'none' }} />
      <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '0.4em', color: '#f97316', marginBottom: 12, textShadow: '0 0 24px rgba(255,120,0,0.9)' }}>K·I·T·T</h1>
      <p style={{ fontSize: 9, letterSpacing: '0.18em', color: '#7c2d12', marginBottom: 64, fontFamily: 'monospace' }}>AGENTE IA · {loadSettings().userName.toUpperCase()}</p>
      <motion.button onClick={handleUnlock} whileTap={{ scale: 0.93 }}
        animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }}
        style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.2em', fontSize: 14, color: '#f97316', border: '1px solid #9a3412', padding: '16px 40px', borderRadius: 8, background: 'transparent', cursor: 'pointer', boxShadow: '0 0 20px rgba(255,80,0,0.3)' }}>
        TOQUE PARA INICIAR
      </motion.button>
    </div>
  )

  // ── Dashboard range / ext temp ────────────────────────────────────────────
  const fuelRange = calcRange(obd.fuel)

  // ── Main Dashboard ────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#050505', overflow: 'hidden', fontFamily: "'Eurostile',sans-serif", color: '#ddd' }}>

      {/* Scanlines */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999, background: 'repeating-linear-gradient(0deg,transparent 0px,transparent 2px,rgba(0,0,0,.08) 3px,transparent 4px)' }} />

      {/* Overlays */}
      <AnimatePresence>
        {booting      && <BootScreen onComplete={handleBootComplete} obdConnected={obdStatus === 'connected'} />}
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} onSpotifyAuth={handleSpotifyAuth} onExportTraining={exportTraining} obdStatus={obdStatus} onConnectOBD={connectOBD} onDisconnectOBD={disconnectOBD} />}
        {routes.length > 0 && !pendingNav && <RoutePanel routes={routes} tips={routeTips} onSelect={i => handleRouteSelectRef.current?.(i)} onClose={() => setRoutes([])} />}
        {pendingNav   && <NavOverlay nav={pendingNav} onOpen={openNavigation} onClose={() => setPendingNav(null)} />}
      </AnimatePresence>

      {/* TopBar */}
      <div id="topbar">
        <div id="clock">{clockTime}</div>
        <div className="srow">
          <div className="stat">
            <span className={`dot ${obdStatus === 'connected' ? 'g' : 'r'}`} />
            OBD
          </div>
          <div className="stat">
            <span className={`dot ${speaking ? 'r' : listening ? 'a' : 'g'}`} />
            KITT
          </div>
          <div className="obd-scenario">
            {OBD_SCENARIOS.map(sc => (
              <button key={sc.id} className={`obd-sc-btn${scenario === sc.id ? ' active' : ''}`} onClick={() => setScenario(sc.id)}>
                {sc.label}
              </button>
            ))}
          </div>
        </div>
        <div className="sysicons">
          {/* OBD badge */}
          {obdStatus === 'connected'
            ? <span style={{ fontSize: 8, fontWeight: 700, color: '#ff2a17', border: '1px solid #7f1d1d', padding: '1px 4px', borderRadius: 3, letterSpacing: 1 }}>LIVE</span>
            : <span style={{ fontSize: 8, color: '#333', border: '1px solid #222', padding: '1px 4px', borderRadius: 3, letterSpacing: 1 }}>SIM</span>
          }
          {/* Settings */}
          <button onClick={() => setShowSettings(true)}
            style={{ background: 'none', border: 'none', color: '#555', fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>⚙</button>
        </div>
      </div>

      {/* Body */}
      <div id="body">

        {/* Left Column */}
        <div id="col-left">

          {/* Speed panel */}
          <div className="panel" id="vel-panel">
            <div className="ptitle">VELOCIDAD</div>
            <div className="vel-body">
              <VelBarsPanel speed={obd.speed} />
              <div className="vel-right">
                <div className="vel-seg">
                  <span className="ghost">888</span>
                  <span className="real">{String(obd.speed).padStart(3,'0')}</span>
                </div>
                <div className="vel-unit">km/h</div>
              </div>
            </div>
          </div>

          {/* RPM arc */}
          <div className="panel" id="rpm-panel">
            <RpmArc rpm={obd.rpm} />
          </div>

          {/* Gauges 2x2 */}
          <div className="panel" id="gauges-panel">
            <div className="gauges-grid">
              {/* Fuel */}
              <div className="mini">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="var(--green)" strokeWidth="1.5"><rect x="3" y="2" width="9" height="16" rx="1"/><path d="M12 6h3l2 2v6a1.5 1.5 0 01-3 0V9h-2"/><rect x="5" y="4" width="5" height="4" fill="var(--green)" stroke="none"/></svg>
                <div className="mini-info">
                  <div className="mt">COMBUSTIBLE</div>
                  <div className={`mv ${obd.fuel < 15 ? 'r' : 'g'}`}>{Math.round(obd.fuel)}%</div>
                  <SegBar frac={obd.fuel / 100} scheme="fuel" />
                </div>
              </div>
              {/* Engine temp */}
              <div className="mini">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="var(--red)" strokeWidth="1.5"><path d="M8 3a2 2 0 014 0v8a3.5 3.5 0 11-4 0z"/><circle cx="10" cy="14" r="1.8" fill="var(--red)" stroke="none"/></svg>
                <div className="mini-info">
                  <div className="mt">TEMP MOTOR</div>
                  <div className={`mv ${obd.temp > 100 ? 'r' : 'a'}`}>{Math.round(obd.temp)}°C</div>
                  <SegBar frac={(obd.temp - 20) / 100} scheme="hot" />
                </div>
              </div>
              {/* Range */}
              <div className="mini">
                <svg width="18" height="18" viewBox="0 0 22 20" fill="none" stroke="var(--amber)" strokeWidth="1.5"><path d="M3 10h16M3 10l4-4M3 10l4 4"/><circle cx="17" cy="10" r="3"/></svg>
                <div className="mini-info">
                  <div className="mt">AUTONOMIA</div>
                  <div className={`mv ${fuelRange < 80 ? 'r' : 'a'}`}>{fuelRange}km</div>
                  <SegBar frac={fuelRange / 600} scheme="fuel" />
                </div>
              </div>
              {/* Battery */}
              <div className="mini">
                <svg width="18" height="18" viewBox="0 0 26 14" fill="none"><rect x=".5" y="1.5" width="22" height="11" rx="2" stroke="#60d0ff" strokeWidth="1.5"/><rect x="23" y="5" width="2.5" height="4" rx="1" fill="#60d0ff"/><rect x="2" y="3" width={Math.round((obd.battery / 15) * 16)} height="8" rx="1" fill="#60d0ff"/></svg>
                <div className="mini-info">
                  <div className="mt">BATERÍA</div>
                  <div className={`mv c ${obd.battery < 12.1 ? 'r' : ''}`}>{obd.battery}V</div>
                  <SegBar frac={(obd.battery - 11) / 4} scheme="cold" />
                </div>
              </div>
            </div>
          </div>

        </div>{/* /col-left */}

        {/* Center Column */}
        <div id="col-center">
          <div className="panel" id="mod-panel">

            {/* Active Route bar */}
            {navRoute && (
              <div className="nav-active-bar" style={{ cursor: 'pointer' }}
                onClick={() => {
                  const pos = userPosRef.current
                  const origin = pos ? `${pos.lat},${pos.lon}` : ''
                  const dest = encodeURIComponent(navRoute.destination)
                  const url = `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${origin}` : ''}&destination=${dest}&travelmode=driving`
                  const a = document.createElement('a')
                  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'
                  document.body.appendChild(a); a.click(); document.body.removeChild(a)
                }}>
                <div>
                  <div style={{ fontSize: 8, color: '#16a34a', letterSpacing: 2, fontWeight: 700 }}>RUTA ACTIVA ↗</div>
                  <div style={{ fontSize: 10, color: '#4ade80', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{navRoute.destination}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#f97316', fontWeight: 700, fontSize: 14 }}>{navRoute.durationMin} min</div>
                  <div style={{ fontSize: 9, color: '#555' }}>{navRoute.distanceKm} km</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setNavRoute(null) }} style={{ background: 'none', border: 'none', color: '#444', fontSize: 18, cursor: 'pointer', marginLeft: 8, lineHeight: 1 }}>✕</button>
              </div>
            )}

            {/* Now Playing bar */}
            {nowPlaying && (
              <div className="now-playing-bar">
                <span style={{ color: '#4ade80' }}>{nowPlaying.playing ? '▶' : '⏸'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: '#4ade80', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nowPlaying.name}</div>
                  <div style={{ fontSize: 9, color: '#166534', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nowPlaying.artist}</div>
                </div>
                <div style={{ display: 'flex', gap: 12, color: '#166534', fontSize: 14 }}>
                  <button onClick={() => handleSpotifyRef.current?.({ action: 'previous' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>⏮</button>
                  <button onClick={() => handleSpotifyRef.current?.({ action: nowPlaying.playing ? 'pause' : 'resume' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>{nowPlaying.playing ? '⏸' : '▶'}</button>
                  <button onClick={() => handleSpotifyRef.current?.({ action: 'next' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>⏭</button>
                </div>
              </div>
            )}

            {/* Trivia bar */}
            {triviaTimer !== null && (
              <div className="trivia-bar">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: triviaTimer <= 5 ? '#ef4444' : '#ca8a04', letterSpacing: 2 }}>TIEMPO</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: triviaTimer <= 5 ? '#f87171' : '#facc15' }}>{triviaTimer}s</span>
                </div>
                <div style={{ width: '100%', height: 3, background: '#111', borderRadius: 2 }}>
                  <div style={{ width: `${(triviaTimer / 15) * 100}%`, height: '100%', background: triviaTimer <= 5 ? '#ef4444' : '#eab308', borderRadius: 2, transition: 'width 0.85s' }} />
                </div>
              </div>
            )}

            <div className="kr-title">KNIGHT RIDER</div>

            <div className="modtop">
              {/* Left pills */}
              <div className="sidecol">
                <button className="pill" onClick={() => handlePill('AIR')}>AIR</button>
                <button className="pill" onClick={() => handlePill('OIL')}>OIL</button>
                <button className="pill rp" onClick={() => handlePill('P1')}>{paused ? 'RUN' : 'PSE'}</button>
                <button className="pill rp" onClick={() => handlePill('P2')}>CFG</button>
              </div>

              {/* Voice modulator center */}
              <div className="modcenter">
                <VoiceModulator speaking={speaking} thinking={thinking} listening={listening} onClick={handleVoiceTap} />
                <div id="kittStatus">{kittStatusText}</div>
                <div id="kittHint">{kittHintText}</div>
              </div>

              {/* Right pills */}
              <div className="sidecol">
                <button className="pill" onClick={() => handlePill('S1')}>HME</button>
                <button className="pill" onClick={() => handlePill('S2')}>WRK</button>
                <button className="pill rp" onClick={() => handlePill('P3')}>{obdStatus === 'connected' ? 'OBD✓' : 'OBD'}</button>
                <button className="pill rp" onClick={() => handlePill('P4')}>EXP</button>
              </div>
            </div>

            {/* Conversation log — last 4 messages */}
            <div className="kitt-messages">
              {messages.slice(-4).map((msg, i) => (
                <div key={i} className={msg.role === 'kitt' ? 'kitt-msg-kitt' : 'kitt-msg-user'}>
                  {msg.role === 'kitt' && <span className="kitt-msg-label">KITT›</span>}
                  {msg.text}
                </div>
              ))}
              {thinking && <div className="kitt-msg-kitt"><span className="kitt-msg-label">KITT›</span><span>•••</span></div>}
              <div ref={messagesEndRef} />
            </div>

            {/* Mode buttons */}
            <div className="modes-row">
              <div className={`mode${activeMode === 'normal' ? ' active' : ''}`} onClick={() => setActiveMode('normal')}>NORMAL CRUISE</div>
              <div className={`mode${activeMode === 'auto' ? ' active' : ''}`} onClick={() => setActiveMode('auto')}>AUTO CRUISE</div>
              <div className={`mode${activeMode === 'pursuit' ? ' active' : ''}`} onClick={() => setActiveMode('pursuit')}>PURSUIT</div>
            </div>

          </div>
        </div>{/* /col-center */}

      </div>{/* /body */}

    </div>
  )
}
