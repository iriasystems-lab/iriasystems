#!/bin/bash
# Sincroniza los cambios de iriasystems → kitt-agent
# INSTRUCCIONES:
#   1. Abre una terminal en tu máquina
#   2. Navega a tu carpeta de kitt-agent:  cd /ruta/a/kitt-agent
#   3. Ejecuta:  bash <(curl -s https://raw.githubusercontent.com/iriasystems-lab/iriasystems/main/sync-to-kitt-agent.sh)
#      O descarga este fichero y ejecuta:  bash sync-to-kitt-agent.sh

set -e

echo "🚗 Sincronizando KITT desde iriasystems..."

# Añadir iriasystems como remote temporal (si ya existe, ignorar el error)
git remote add iriasys https://github.com/iriasystems-lab/iriasystems.git 2>/dev/null || true
git fetch iriasys main --quiet

FILES=(
  "src/pages/Kitt.jsx"
  "src/lib/claude.js"
  "src/lib/agent-context.js"
  "index.html"
  "public/Logo-kitt-app.jpeg"
  "public/kitt-icon-192.png"
  "public/kitt-icon-512.png"
  "public/apple-touch-icon.png"
  "public/kitt-manifest.json"
)

for f in "${FILES[@]}"; do
  if git checkout iriasys/main -- "$f" 2>/dev/null; then
    echo "  ✅ $f"
  else
    echo "  ⚠️  No encontrado en iriasystems: $f (ignorado)"
  fi
done

git add -A
git commit -m "feat: sync voz ElevenLabs, onboarding, logo, emergencia, missionCode desde iriasystems"
git push origin main

echo ""
echo "✅ ¡Listo! Netlify desplegará kitt-ai-agent.netlify.app en ~1 minuto."
