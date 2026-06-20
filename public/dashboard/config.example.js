/**
 * KITT Dashboard — Configuración de credenciales
 *
 * INSTRUCCIONES:
 * 1. Copia este archivo como "config.js" (mismo directorio)
 * 2. Rellena tus claves reales
 * 3. config.js está en .gitignore — nunca se sube al repositorio
 */
window.KITT_CONFIG = {
  // ElevenLabs — Text to Speech
  XI_KEY:   'TU_API_KEY_DE_ELEVENLABS',
  XI_VOICE: 'TU_VOICE_ID_DE_ELEVENLABS',

  // Anthropic — Claude (cerebro conversacional de KITT)
  // Clave Anthropic: console.anthropic.com → API Keys
  ANTHROPIC_KEY:      'TU_CLAVE_ANTHROPIC',
  // Usa el proxy Netlify (no expone la clave en red):
  ANTHROPIC_ENDPOINT: '/api/claude',
  ANTHROPIC_MODEL:    'claude-sonnet-4-6'
};
