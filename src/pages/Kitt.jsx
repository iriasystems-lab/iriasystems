import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'

// ─── Simulated OBD Data ───────────────────────────────────────────────────────
function useOBDData() {
  const [obd, setObd] = useState({
    speed: 0,
    rpm: 850,
    fuel: 74.2,
    temp: 22,
    battery: 12.6,
    gear: 'P',
    dtc: [],
  })

  useEffect(() => {
    const id = setInterval(() => {
      setObd(prev => {
        const newSpeed = Math.max(0, Math.min(200, prev.speed + (Math.random() - 0.46) * 4))
        const newRPM =
          newSpeed < 5
            ? 850
            : Math.max(900, Math.min(6500, 850 + newSpeed * 40 + (Math.random() - 0.5) * 250))
        const gear =
          newSpeed < 5 ? 'P'
          : newSpeed < 30 ? '1'
          : newSpeed < 55 ? '2'
          : newSpeed < 90 ? '3'
          : newSpeed < 130 ? '4'
          : '5'
        return {
          speed: Math.round(newSpeed),
          rpm: Math.round(newRPM),
          fuel: Math.max(0, prev.fuel - 0.0004),
          temp: Math.min(93, prev.temp < 90 ? prev.temp + 0.09 : 90 + (Math.random() - 0.5) * 0.8),
          battery: parseFloat((12.6 + (Math.random() - 0.5) * 0.3).toFixed(1)),
          gear,
          dtc: prev.dtc,
        }
      })
    }, 900)
    return () => clearInterval(id)
  }, [])

  return obd
}

// ─── Equalizer ─────────────────────────────────────────────────────────────────
const COLS = 5
const SEGS = 10

function Equalizer({ active }) {
  const [bars, setBars] = useState(Array(COLS).fill(2))

  useEffect(() => {
    const ms = active ? 85 : 450
    const id = setInterval(() => {
      setBars(
        Array(COLS).fill(0).map(() =>
          active
            ? Math.floor(Math.random() * 7) + 4
            : Math.floor(Math.random() * 2) + 1
        )
      )
    }, ms)
    return () => clearInterval(id)
  }, [active])

  // Segment color: bottom brighter orange, top deeper red
  const segColor = (seg, height) => {
    const lit = seg < height
    if (!lit) return '#180400'
    const ratio = seg / (SEGS - 1)
    const r = 255
    const g = Math.round(110 - ratio * 90)
    const b = 0
    return `rgb(${r},${g},${b})`
  }

  return (
    <div
      className="flex gap-[6px] items-end justify-center py-5 px-4 rounded-xl"
      style={{
        background: 'radial-gradient(ellipse at center, #0d0200 0%, #000 100%)',
        boxShadow: 'inset 0 0 30px rgba(0,0,0,0.9)',
      }}
    >
      {bars.map((height, col) => (
        <div key={col} className="flex flex-col-reverse gap-[4px]">
          {Array(SEGS).fill(0).map((_, seg) => {
            const lit = seg < height
            return (
              <motion.div
                key={seg}
                animate={{
                  backgroundColor: segColor(seg, height),
                  boxShadow: lit ? `0 0 5px rgba(255,80,0,0.65)` : 'none',
                  opacity: lit ? 1 : 0.4,
                }}
                transition={{ duration: 0.07 }}
                style={{ width: 32, height: 8, borderRadius: 2 }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ─── KITT Responses (demo — plug Claude API here) ────────────────────────────
function getKittResponse(input, obd) {
  const q = input.toLowerCase()

  if (q.includes('estado') || q.includes('coche') || q.includes('todo bien') || q.includes('sistemas')) {
    const warn = obd.temp > 90 ? ' Temperatura motor ligeramente elevada, te recomiendo vigilarla.' : ''
    return `Todos los sistemas en condiciones nominales, Michael. Motor a ${Math.round(obd.temp)}°C, combustible al ${Math.round(obd.fuel)}%, batería a ${obd.battery}V.${warn} Sin códigos de avería detectados.`
  }
  if (q.includes('combustible') || q.includes('gasolina') || q.includes('autonomía') || q.includes('litros')) {
    const km = Math.round(obd.fuel * 0.58)
    return `Con el ${Math.round(obd.fuel)}% de combustible restante y un consumo medio de 7,2 litros por cien kilómetros, tienes aproximadamente ${km} kilómetros de autonomía, Michael.`
  }
  if (q.includes('velocidad') || q.includes('rápido') || q.includes('kmh')) {
    const warn = obd.speed > 120 ? ' Atención: estás superando el límite de velocidad recomendado.' : ''
    return `Circulando a ${obd.speed} kilómetros por hora en marcha ${obd.gear}, a ${Math.round(obd.rpm)} RPM.${warn}`
  }
  if (q.includes('temperatura') || q.includes('motor') || q.includes('calor') || q.includes('frío')) {
    return `La temperatura del motor es ${Math.round(obd.temp)}°C. ${obd.temp > 90 ? 'Está algo por encima de lo ideal. Recomiendo reducir la carga del motor.' : obd.temp < 60 ? 'El motor todavía está calentando. Evita revoluciones altas por ahora.' : 'Temperatura perfectamente dentro del rango operativo.'}`
  }
  if (q.includes('batería') || q.includes('electricidad') || q.includes('voltaje')) {
    return `La batería marca ${obd.battery} voltios, Michael. ${obd.battery < 12.2 ? 'El voltaje está algo bajo. Considera revisarla pronto.' : 'Carga correcta.'}`
  }
  if (q.includes('ruta') || q.includes('camino') || q.includes('llegar') || q.includes('navegar')) {
    return `Integración GPS en preparación, Michael. Próximamente podré calcular la ruta óptima, estimar tiempos y avisarte del tráfico en tiempo real. Por ahora estoy monitorizando el vehículo.`
  }
  if (q.includes('hola') || q.includes('kitt') || q.includes('buenos') || q.includes('buenos días')) {
    return `Hola, Michael. K.I.T.T. operativo al cien por cien. Todos los sensores activos y listos para asistirte. ¿Qué necesitas?`
  }
  if (q.includes('avería') || q.includes('problema') || q.includes('fallo') || q.includes('error')) {
    return `He realizado un diagnóstico completo. ${obd.dtc.length === 0 ? 'No hay códigos de avería activos. Todos los subsistemas funcionan correctamente.' : `Detectados ${obd.dtc.length} códigos de avería. Te recomiendo acudir a un taller.`}`
  }
  if (q.includes('optimizar') || q.includes('consumo') || q.includes('ahorrar') || q.includes('eficiencia')) {
    return `Para optimizar el consumo, Michael: mantén las RPM entre 1.800 y 2.500, anticipa las frenadas y usa el punto de marcha adecuado. Con tu velocidad actual de ${obd.speed} km/h, la marcha ${obd.gear} es ${obd.gear < '3' && obd.speed > 50 ? 'demasiado corta, sube de marcha' : 'correcta'}.`
  }
  return `Entendido, Michael. He procesado tu solicitud. Estoy monitorizando el vehículo en tiempo real: velocidad ${obd.speed} km/h, motor a ${Math.round(obd.temp)}°C, combustible al ${Math.round(obd.fuel)}%. ¿En qué más puedo asistirte?`
}

// ─── Mode Buttons ─────────────────────────────────────────────────────────────
const MODES = [
  { id: 'auto',    label: 'AUTO\nCRUISE',   color: 'orange' },
  { id: 'normal',  label: 'NORMAL\nCRUISE', color: 'amber'  },
  { id: 'pursuit', label: 'PURSUIT',        color: 'blue'   },
]

function ModeButton({ mode, active, onClick }) {
  const base = 'py-3 px-1 rounded text-center text-[11px] font-bold font-mono tracking-wide transition-all duration-200 whitespace-pre-line leading-tight border select-none active:scale-95'
  const styles = {
    orange: active
      ? 'bg-orange-600 text-black border-orange-400 shadow-[0_0_14px_rgba(234,88,12,0.9)]'
      : 'bg-orange-950/40 text-orange-500 border-orange-800 hover:border-orange-600',
    amber: active
      ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.9)]'
      : 'bg-amber-950/40 text-amber-400 border-amber-800 hover:border-amber-600',
    blue: active
      ? 'bg-blue-600 text-white border-blue-300 shadow-[0_0_14px_rgba(59,130,246,0.9)]'
      : 'bg-blue-950/50 text-blue-400 border-blue-800 hover:border-blue-500',
  }
  return (
    <button className={`${base} ${styles[mode.color]}`} onClick={() => onClick(mode.id)}>
      {mode.label}
    </button>
  )
}

// ─── OBD Gauge ────────────────────────────────────────────────────────────────
function Gauge({ label, value, unit, warn }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg p-2 border"
      style={{
        background: 'linear-gradient(180deg, #0a0a0a 0%, #000 100%)',
        borderColor: warn ? 'rgba(239,68,68,0.5)' : 'rgba(75,75,75,0.3)',
        boxShadow: warn ? 'inset 0 0 10px rgba(239,68,68,0.15)' : 'inset 0 0 8px rgba(0,0,0,0.8)',
      }}
    >
      <span className="text-[9px] font-mono tracking-widest text-gray-600">{label}</span>
      <span className={`text-xl font-bold font-mono leading-tight ${warn ? 'text-red-400' : 'text-orange-400'}`}>
        {value}
      </span>
      <span className="text-[9px] font-mono text-gray-600">{unit}</span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Kitt() {
  const obd = useOBDData()
  const [activeMode, setActiveMode] = useState('normal')
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'kitt', text: 'Sistema K.I.T.T. activado. Todos los sistemas operativos. Listo para asistirte, Michael.' }
  ])
  const messagesEndRef = useRef(null)
  const synthRef = useRef(null)

  useEffect(() => {
    synthRef.current = window.speechSynthesis
  }, [])

  const speak = useCallback((text) => {
    if (!synthRef.current) return
    synthRef.current.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'es-ES'
    utt.pitch = 0.72
    utt.rate = 0.87
    utt.volume = 1
    // Prefer a deep male voice
    const voices = synthRef.current.getVoices()
    const pick =
      voices.find(v => v.lang === 'es-ES' && /google/i.test(v.name) && /male/i.test(v.name)) ||
      voices.find(v => v.lang === 'es-ES' && /google/i.test(v.name)) ||
      voices.find(v => v.lang.startsWith('es'))
    if (pick) utt.voice = pick
    utt.onstart = () => setSpeaking(true)
    utt.onend   = () => setSpeaking(false)
    utt.onerror = () => setSpeaking(false)
    synthRef.current.speak(utt)
  }, [])

  const handleInput = useCallback((text) => {
    setMessages(prev => [...prev, { role: 'user', text }])
    const response = getKittResponse(text, obd)
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'kitt', text: response }])
      speak(response)
    }, 400)
  }, [obd, speak])

  const startListening = useCallback(() => {
    if (listening || speaking) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      // Fallback demo if no STT support
      handleInput('estado del coche')
      return
    }
    const rec = new SR()
    rec.lang = 'es-ES'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onstart  = () => setListening(true)
    rec.onend    = () => setListening(false)
    rec.onerror  = () => setListening(false)
    rec.onresult = (e) => handleInput(e.results[0][0].transcript)
    rec.start()
  }, [listening, speaking, handleInput])

  // Auto-greet
  useEffect(() => {
    const t = setTimeout(() => speak(messages[0].text), 1200)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const equalizerActive = speaking || listening

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between px-4 py-4 max-w-[420px] mx-auto overflow-hidden"
      style={{ background: '#000', fontFamily: "'Courier New', monospace" }}
    >
      {/* Scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.04]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 4px)',
        }}
      />

      {/* ── Header ── */}
      <div className="w-full text-center pt-1">
        <h1
          className="text-3xl font-bold tracking-[0.35em] text-orange-500"
          style={{ textShadow: '0 0 18px rgba(255,120,0,0.7), 0 0 40px rgba(255,60,0,0.3)' }}
        >
          K·I·T·T
        </h1>
        <p className="text-[9px] tracking-[0.18em] text-orange-900 mt-0.5">
          KNIGHT INTELLIGENCE TRANSPORTATION TECHNOLOGY
        </p>
        <div className="flex items-center justify-center gap-2 mt-1.5">
          <motion.div
            animate={{ opacity: equalizerActive ? [1, 0.3, 1] : 1 }}
            transition={{ repeat: Infinity, duration: 0.6 }}
            className={`w-2 h-2 rounded-full ${
              speaking ? 'bg-orange-500' : listening ? 'bg-yellow-400' : 'bg-green-500'
            }`}
            style={{ boxShadow: speaking ? '0 0 8px rgba(255,120,0,1)' : listening ? '0 0 8px rgba(234,179,8,1)' : '0 0 6px rgba(34,197,94,0.8)' }}
          />
          <span className="text-[10px] tracking-widest text-gray-500">
            {speaking ? 'TRANSMITIENDO' : listening ? 'ESCUCHANDO...' : 'SISTEMA ACTIVO'}
          </span>
        </div>
      </div>

      {/* ── Equalizer ── */}
      <div
        className="w-full mt-3 rounded-2xl overflow-hidden border"
        style={{
          borderColor: 'rgba(180,60,0,0.35)',
          boxShadow: '0 0 24px rgba(255,60,0,0.12), inset 0 0 24px rgba(0,0,0,0.6)',
        }}
      >
        <Equalizer active={equalizerActive} />
      </div>

      {/* ── Mode Buttons ── */}
      <div className="w-full grid grid-cols-3 gap-2 mt-3">
        {MODES.map(m => (
          <ModeButton key={m.id} mode={m} active={activeMode === m.id} onClick={setActiveMode} />
        ))}
      </div>

      {/* ── OBD Dashboard ── */}
      <div className="w-full grid grid-cols-3 gap-2 mt-3">
        <Gauge label="VELOCIDAD"  value={obd.speed}                   unit="km/h" warn={obd.speed > 120} />
        <Gauge label="RPM"        value={(obd.rpm / 1000).toFixed(1)} unit="× 1k" warn={obd.rpm > 5500} />
        <Gauge label="COMBUSTIBLE" value={`${Math.round(obd.fuel)}%`} unit="⛽"   warn={obd.fuel < 15}  />
        <Gauge label="MOTOR"      value={`${Math.round(obd.temp)}°`}  unit="°C"   warn={obd.temp > 92}  />
        <Gauge label="BATERÍA"    value={obd.battery}                  unit="V"    warn={obd.battery < 12.1} />
        <Gauge label="MARCHA"     value={obd.gear}                     unit="—"    warn={false}          />
      </div>

      {/* ── Conversation ── */}
      <div
        className="w-full mt-3 rounded-xl border p-3 space-y-2 overflow-y-auto"
        style={{
          maxHeight: 130,
          borderColor: 'rgba(75,75,75,0.3)',
          background: 'linear-gradient(180deg,#050505 0%,#000 100%)',
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-[11px] leading-snug ${
              msg.role === 'kitt' ? 'text-orange-300' : 'text-gray-400 text-right'
            }`}
          >
            {msg.role === 'kitt' && (
              <span className="text-orange-600 font-bold mr-1 tracking-wider">KITT›</span>
            )}
            {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Talk Button ── */}
      <div className="w-full flex justify-center pb-4 mt-3">
        <motion.button
          onPointerDown={startListening}
          whileTap={{ scale: 0.9 }}
          disabled={speaking}
          className="relative flex flex-col items-center justify-center rounded-full select-none"
          style={{
            width: 88,
            height: 88,
            background: listening
              ? 'radial-gradient(circle, #eab308 0%, #713f12 100%)'
              : speaking
              ? 'radial-gradient(circle, #1a0800 0%, #000 100%)'
              : 'radial-gradient(circle, #1c0a00 0%, #000 100%)',
            border: `2px solid ${listening ? '#fde047' : speaking ? 'rgba(255,80,0,0.3)' : 'rgba(194,65,12,0.7)'}`,
            boxShadow: listening
              ? '0 0 28px rgba(234,179,8,0.9), 0 0 60px rgba(234,179,8,0.3)'
              : speaking
              ? '0 0 12px rgba(255,80,0,0.2)'
              : '0 0 18px rgba(255,80,0,0.35)',
          }}
        >
          <span className="text-2xl leading-none">
            {listening ? '◉' : speaking ? '▶' : '🎙'}
          </span>
          <span
            className="text-[9px] font-bold tracking-[0.15em] mt-1"
            style={{ color: listening ? '#000' : speaking ? 'rgba(255,80,0,0.4)' : '#ea580c' }}
          >
            {listening ? 'ESCUCHO' : speaking ? 'KITT...' : 'HABLAR'}
          </span>
        </motion.button>
      </div>
    </div>
  )
}
