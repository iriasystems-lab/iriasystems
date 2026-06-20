// ELM327 WiFi OBD-II direct connection
// Adapter creates a WiFi hotspot → phone connects → app connects via WebSocket

const CANDIDATES = [
  'ws://192.168.0.10:35000',
  'ws://192.168.4.1:35000',
  'ws://192.168.0.10:8080',
  'ws://192.168.4.1:8080',
  'ws://192.168.1.1:35000',
  'ws://10.0.0.1:35000',
]

// ELM327 initialization sequence
const INIT_CMDS = ['ATZ\r', 'ATE0\r', 'ATL0\r', 'ATH0\r', 'ATS0\r', 'ATSP0\r']

// OBD-II Mode 01 PIDs
const PID_MAP = {
  '010D': 'speed',    // Vehicle speed km/h
  '010C': 'rpm',      // Engine RPM
  '012F': 'fuel',     // Fuel level %
  '0105': 'temp',     // Engine coolant temp °C
  '0142': 'battery',  // Control module voltage V
  '010B': 'map',      // Intake manifold pressure kPa
  '0111': 'throttle', // Throttle position %
  '0104': 'load',     // Engine load %
}

const POLL_PIDS = ['010D', '010C', '012F', '0105', '0142', '0111', '0104']

function parseResponse(pid, raw) {
  const hex = raw.replace(/[^0-9A-Fa-f]/g, '')
  if (hex.length < 6) return null
  const bytes = hex.match(/.{2}/g)?.map(b => parseInt(b, 16)) || []
  // ELM327 response format: mode+0x40 | PID | data bytes
  // Skip first 2 bytes (echo of mode+PID)
  const [A, B] = bytes.slice(2)
  if (A === undefined) return null
  switch (pid) {
    case '010D': return A                                     // km/h
    case '010C': return Math.round(((A * 256 + (B || 0)) / 4)) // RPM
    case '012F': return parseFloat((A / 2.55).toFixed(1))    // %
    case '0105': return A - 40                                // °C
    case '0142': return parseFloat(((A * 256 + (B || 0)) / 1000).toFixed(2)) // V
    case '010B': return A                                     // kPa
    case '0111': return parseFloat((A / 2.55).toFixed(1))    // %
    case '0104': return parseFloat((A / 2.55).toFixed(1))    // %
    default:     return null
  }
}

export class OBDWifi {
  constructor({ onData, onStatus, onError }) {
    this.onData   = onData
    this.onStatus = onStatus
    this.onError  = onError
    this.ws       = null
    this.polling  = null
    this._resolver = null
    this._buf     = ''
    this.url      = null
    this.ready    = false
  }

  async tryConnect(customUrl = null) {
    const targets = customUrl ? [customUrl] : CANDIDATES
    for (const url of targets) {
      try {
        await this._connect(url)
        this.url = url
        return url
      } catch {}
    }
    throw new Error('No se encontró ningún adaptador OBD WiFi')
  }

  _connect(url) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), 3500)
      try {
        const ws = new WebSocket(url)
        ws.onopen = async () => {
          clearTimeout(timeout)
          this.ws = ws
          this.onStatus('initializing')
          try {
            for (const cmd of INIT_CMDS) await this._cmd(cmd, 1200)
            this.ready = true
            this.onStatus('connected')
            this._startPolling()
            resolve()
          } catch (e) { reject(e) }
        }
        ws.onmessage = (e) => this._recv(typeof e.data === 'string' ? e.data : '')
        ws.onerror   = () => { clearTimeout(timeout); reject(new Error('ws error')) }
        ws.onclose   = () => {
          this.ready = false
          this.onStatus('disconnected')
          this._stopPolling()
        }
      } catch (e) { clearTimeout(timeout); reject(e) }
    })
  }

  _recv(data) {
    this._buf += data
    const promptIdx = this._buf.indexOf('>')
    if (promptIdx !== -1 || this._buf.includes('\r\r')) {
      const msg = this._buf.replace(/>/g, '').trim()
      this._buf = ''
      if (this._resolver) { this._resolver(msg); this._resolver = null }
    }
  }

  _cmd(cmd, timeout = 800) {
    return new Promise((resolve) => {
      this._resolver = resolve
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(cmd)
      setTimeout(() => { if (this._resolver) { this._resolver(''); this._resolver = null } }, timeout)
    })
  }

  _startPolling() {
    let idx = 0
    this.polling = setInterval(async () => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.ready) return
      const pid = POLL_PIDS[idx++ % POLL_PIDS.length]
      const res = await this._cmd(pid + '\r', 600)
      const val = parseResponse(pid, res)
      if (val !== null) this.onData(PID_MAP[pid] || pid, val)
    }, 300)
  }

  _stopPolling() {
    clearInterval(this.polling)
    this.polling = null
  }

  disconnect() {
    this._stopPolling()
    this.ws?.close()
    this.ws    = null
    this.ready = false
    this.onStatus('disconnected')
  }

  // Scan for available PIDs on this vehicle
  async scanPIDs() {
    if (!this.ready) return []
    const supported = []
    // Mode 01 PID 00 = bitmap of supported PIDs 01-20
    const res = await this._cmd('0100\r', 1500)
    const hex = res.replace(/[^0-9A-Fa-f]/g, '')
    if (hex.length >= 8) {
      const bits = parseInt(hex.slice(4, 12), 16)
      for (let i = 0; i < 32; i++) {
        if (bits & (1 << (31 - i))) supported.push(`01${(i + 1).toString(16).padStart(2, '0').toUpperCase()}`)
      }
    }
    return supported
  }
}
