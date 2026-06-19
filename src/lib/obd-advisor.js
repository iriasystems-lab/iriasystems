// ─── OBD Real-time Advisor — BMW 218i Active Tourer (F45) B38A15A ────────────
// Evaluates telemetry continuously and generates proactive KITT advice.
// Conditions based on validated research (see kitt_bmw_218i_knowledge_base.md).

const PRIORITY = { silencio: 0, info: 1, sugerencia: 2, aviso: 3, alerta: 4, critico: 5 }

// Minimum time between repeating the same rule (ms)
const COOLDOWN = {
  info:      50000,
  sugerencia: 35000,
  aviso:      18000,
  alerta:     12000,
  critico:     6000,
}

// ─── DTC database (BMW F45 / B38A15A most frequent codes) ────────────────────
export const DTC_CODES = {
  P0016: { nombre: 'Sincronización árbol levas/cigüeñal',       gravedad: 'alta',       puede_conducir: false, accion: 'Riesgo de daño en distribución. Para el motor y llama al taller.', causa: 'Cadena de distribución estirada o tensor desgastado — punto débil conocido del B38.' },
  P0017: { nombre: 'Desfase árbol de levas (escape)',            gravedad: 'alta',       puede_conducir: false, accion: 'Igual que P0016: revisar distribución urgente.',                      causa: 'Cadena de distribución / tensor desgastados.' },
  P0011: { nombre: 'VANOS admisión — posición avanzada',         gravedad: 'media',      puede_conducir: true,  accion: 'Circula suave y diagnostica pronto.',                                  causa: 'Solenoide VANOS sucio o aceite degradado.' },
  P0014: { nombre: 'VANOS escape — posición avanzada',           gravedad: 'media',      puede_conducir: true,  accion: 'Revisar, no urgente.',                                                 causa: 'Solenoide VANOS o presión de aceite baja.' },
  P0300: { nombre: 'Fallo de encendido — múltiples cilindros',   gravedad: 'alta',       puede_conducir: false, accion: 'Si el testigo parpadea, para inmediatamente: riesgo de destruir el catalizador.', causa: 'Bujías o bobinas agotadas, inyector sucio.' },
  P0301: { nombre: 'Fallo de encendido — cilindro 1',            gravedad: 'media-alta', puede_conducir: true,  accion: 'Circula suave y repáralo pronto para no dañar el catalizador.',       causa: 'Bobina o bujía del cilindro 1.' },
  P0302: { nombre: 'Fallo de encendido — cilindro 2',            gravedad: 'media-alta', puede_conducir: true,  accion: 'Igual que P0301.',                                                     causa: 'Bobina o bujía del cilindro 2.' },
  P0303: { nombre: 'Fallo de encendido — cilindro 3',            gravedad: 'media-alta', puede_conducir: true,  accion: 'El motor vibrará fuerte. Ve al taller.',                               causa: 'Bobina o bujía del cilindro 3.' },
  P0171: { nombre: 'Mezcla demasiado pobre',                     gravedad: 'media',      puede_conducir: true,  accion: 'Sube algo el consumo. Revisar sin urgencia.',                          causa: 'Fuga de admisión, MAF sucio o válvula PCV.' },
  P0172: { nombre: 'Mezcla demasiado rica',                      gravedad: 'media',      puede_conducir: true,  accion: 'Diagnóstico pronto; sube consumo y ensucia bujías.',                   causa: 'Inyector con fuga, sensor MAP/MAF o presión de combustible alta.' },
  P0234: { nombre: 'Sobrepresión de turbo',                      gravedad: 'alta',       puede_conducir: false, accion: 'Evita acelerones; el motor puede entrar en emergencia.',                causa: 'Wastegate o válvula de descarga del turbo.' },
  P0299: { nombre: 'Subpresión de turbo — coche va flojo',       gravedad: 'media-alta', puede_conducir: true,  accion: 'Circula suave; revisa fugas de presión.',                              causa: 'Fuga en manguitos de admisión/intercooler o wastegate.' },
  P0087: { nombre: 'Presión de combustible demasiado baja',      gravedad: 'media-alta', puede_conducir: true,  accion: 'Posible tirón o falta de potencia. Revisar pronto.',                   causa: 'Bomba de alta presión (HPFP) desgastada.' },
  P0420: { nombre: 'Catalizador por debajo del umbral',          gravedad: 'media',      puede_conducir: true,  accion: 'No es urgente para conducir, pero no pasarás la ITV.',                 causa: 'Catalizador envejecido o sonda lambda posterior.' },
  P0128: { nombre: 'Motor no alcanza temperatura de trabajo',    gravedad: 'baja-media', puede_conducir: true,  accion: 'No urgente; sube consumo en frío.',                                    causa: 'Termostato map-controlado quedado abierto.' },
  P052E: { nombre: 'Sistema ventilación cárter (PCV)',           gravedad: 'baja-media', puede_conducir: true,  accion: 'Ralentí inestable o mezcla pobre; revisar.',                           causa: 'Válvula PCV de la tapa de balancines — punto débil del B38.' },
  P0335: { nombre: 'Sensor de posición del cigüeñal',            gravedad: 'alta',       puede_conducir: false, accion: 'Puede que no arranque o se cale; revisar sensor.',                     causa: 'Sensor de cigüeñal o conector.' },
  P0507: { nombre: 'Ralentí más alto de lo esperado',            gravedad: 'baja',       puede_conducir: true,  accion: 'Revisar entrada de aire o válvula PCV.',                               causa: 'Fuga de admisión o válvula PCV.' },
  C0210: { nombre: 'TPMS — problema de presión de neumático',    gravedad: 'media',      puede_conducir: true,  accion: 'Comprueba presiones ahora; si una rueda pierde aire, no lo ignores.', causa: 'Presión baja real o sensor TPMS sin batería.' },
  U0100: { nombre: 'Pérdida de comunicación con centralita DME', gravedad: 'alta',       puede_conducir: false, accion: 'Fallo eléctrico serio. Para en zona segura.',                          causa: 'Problema de bus CAN, conector o tensión baja.' },
}

// ─── Real-time OBD rules ──────────────────────────────────────────────────────
// Each rule: { id, prioridad, check(obd, ctx), phrase(obd, ctx) }
// ctx = { ofcoSeconds, speedTrend, idleSeconds }
const RULES = [
  {
    id: 'temp_critica',
    prioridad: 'critico',
    check: (obd) => obd.temp > 118,
    phrase: (obd) => `Cristian, temperatura en rojo, ${Math.round(obd.temp)} grados. Para en cuanto sea seguro y apaga el motor.`,
  },
  {
    id: 'fuel_critico',
    prioridad: 'alerta',
    check: (obd) => obd.fuel < 8,
    phrase: (obd) => {
      const km = Math.round((obd.fuel / 100) * 49 / 5.5 * 100)
      return `Reserva crítica, Cristian: unos ${km} km de autonomía. Reposta en la próxima salida.`
    },
  },
  {
    id: 'temp_alta',
    prioridad: 'aviso',
    check: (obd) => obd.temp > 110 && obd.temp <= 118,
    phrase: (obd) => `La temperatura está a ${Math.round(obd.temp)} grados y subiendo. Baja el ritmo y no la pierdas de vista.`,
  },
  {
    id: 'bateria_baja',
    prioridad: 'aviso',
    check: (obd) => obd.battery < 12.0 && obd.rpm < 200,
    phrase: (obd) => `El voltaje en reposo está bajo, ${obd.battery} voltios. Si cuesta arrancar, revisa batería o alternador.`,
  },
  {
    id: 'fuel_bajo',
    prioridad: 'sugerencia',
    check: (obd) => obd.fuel >= 8 && obd.fuel < 15,
    phrase: (obd) => {
      const km = Math.round((obd.fuel / 100) * 49 / 6.0 * 100)
      return `Vas por debajo del 15% de depósito, unos ${km} km de margen. Ve pensando en repostar.`
    },
  },
  {
    id: 'acel_ineficiente',
    prioridad: 'sugerencia',
    check: (obd) => (obd.load ?? 0) > 75 && obd.rpm > 3500 && (obd.throttle ?? 0) > 60,
    phrase: () => 'Estás pidiéndole mucho al motor. Si no necesitas adelantar, suelta un poco y deja que la caja suba marcha.',
  },
  {
    id: 'marcha_corta',
    prioridad: 'sugerencia',
    check: (obd) => obd.speed > 70 && obd.rpm > 2700 && (obd.throttle ?? 100) < 25 && (obd.load ?? 100) < 45,
    phrase: (obd) => `Vas a ${obd.speed} km/h con ${obd.rpm} vueltas. Mantén gas constante y suave para que entre la marcha larga.`,
  },
  {
    id: 'velocidad_alta',
    prioridad: 'sugerencia',
    check: (obd) => obd.speed > 125 && (obd.throttle ?? 100) > 20,
    phrase: (obd) => `Por encima de 120 el consumo se dispara por la resistencia del aire. Bajar a 110 te ahorra bastante, Cristian.`,
  },
  {
    id: 'bajada_aprovechar',
    prioridad: 'info',
    check: (obd, ctx) => (obd.throttle ?? 100) < 10 && (obd.load ?? 100) < 10 && obd.speed > 60 && ctx.speedTrend === 'subiendo',
    phrase: () => 'Vas cuesta abajo sin gastar nada. Deja que ruede; si viene subida después, gana algo de velocidad ahora.',
  },
  {
    id: 'bateria_regen',
    prioridad: 'info',
    check: (obd) => obd.battery > 14.7 && (obd.throttle ?? 100) === 0 && obd.speed > 30,
    phrase: (obd) => `El alternador está recuperando energía con la inercia a ${obd.battery}V. Todo correcto.`,
  },
  {
    id: 'ofco_largo',
    prioridad: 'info',
    check: (obd, ctx) => isOfcoActive(obd) && ctx.ofcoSeconds > 30,
    phrase: (obd, ctx) => {
      const km = ((ctx.ofcoSeconds * obd.speed) / 3600).toFixed(1)
      return `Llevas ${Math.round(ctx.ofcoSeconds)} segundos en corte de inyección, ${km} km a consumo cero. Así se conduce.`
    },
  },
  {
    id: 'ofco_active',
    prioridad: 'info',
    check: (obd, ctx) => isOfcoActive(obd) && ctx.ofcoSeconds > 8 && ctx.ofcoSeconds <= 30,
    phrase: () => 'Inyección cortada: ahora mismo no gastas gasolina.',
  },
  {
    id: 'freno_motor',
    prioridad: 'info',
    check: (obd, ctx) => (obd.throttle ?? 100) === 0 && (obd.load ?? 100) < 5 && obd.rpm > 2000 && ctx.speedTrend === 'bajando',
    phrase: () => 'Estás reteniendo con el motor sin gastar. Ideal para llegar a la curva o a la salida.',
  },
  {
    id: 'velocidad_optima',
    prioridad: 'info',
    check: (obd) => obd.speed >= 95 && obd.speed <= 115 && (obd.throttle ?? 0) > 5 && (obd.throttle ?? 0) < 30 && (obd.load ?? 100) < 45,
    phrase: (obd) => `A ${obd.speed} km/h estás en la franja de consumo mínimo en autopista. Mantén esta velocidad.`,
  },
  {
    id: 'temp_fria',
    prioridad: 'info',
    check: (obd) => obd.temp < 70 && obd.rpm > 0 && obd.speed > 0,
    phrase: (obd) => `Motor aún frío a ${Math.round(obd.temp)} grados. Gasta algo más hasta que caliente; sin exigirle.`,
  },
  {
    id: 'ralenti_largo',
    prioridad: 'info',
    check: (obd, ctx) => obd.speed < 2 && obd.rpm > 500 && obd.rpm < 1100 && ctx.idleSeconds > 60,
    phrase: () => 'Llevas más de un minuto al ralentí gastando medio litro por hora. Si la espera es larga, apaga el motor.',
  },
]

// ─── Public helpers ───────────────────────────────────────────────────────────

export function isOfcoActive(obd) {
  return (obd.throttle ?? 100) === 0
    && (obd.load ?? 100) < 5
    && obd.rpm > 1200
    && obd.speed > 25
}

// Evaluate all rules and return highest-priority triggered rule (or null)
export function evaluateRules(obd, ctx, lastSpoken) {
  const now    = Date.now()
  let best     = null
  let bestPrio = -1

  for (const rule of RULES) {
    try {
      if (!rule.check(obd, ctx)) continue
      const p  = PRIORITY[rule.prioridad] ?? 0
      if (p <= bestPrio) continue
      const cd = COOLDOWN[rule.prioridad] ?? 30000
      if (lastSpoken[rule.id] && (now - lastSpoken[rule.id]) < cd) continue
      best     = rule
      bestPrio = p
    } catch { /* ignore rule errors */ }
  }
  return best
}

export function getRulePhrase(rule, obd, ctx) {
  return typeof rule.phrase === 'function' ? rule.phrase(obd, ctx) : rule.phrase
}

// Look up a DTC code and return a human-friendly object (or null)
export function lookupDtc(code) {
  return DTC_CODES[code.toUpperCase()] ?? null
}

// Format DTC for voice
export function dtcToSpeech(code, dtc) {
  const urgencia = dtc.gravedad === 'alta' ? 'AVISO IMPORTANTE' : dtc.gravedad === 'media-alta' ? 'Precaución' : 'Aviso'
  const conducir = dtc.puede_conducir ? 'Puedes continuar conduciendo con cuidado.' : 'No sigas conduciendo.'
  return `${urgencia}: código ${code}, ${dtc.nombre}. ${dtc.accion} ${conducir}`
}
