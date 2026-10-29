// Genera public/sitemap.xml automáticamente antes de cada build.
// Lee los slugs de servicios desde src/data/services.js — nunca se desincroniza.

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// --- Leer slugs de servicios directamente del archivo fuente ---
const servicesFile = readFileSync(resolve(root, 'src/data/services.js'), 'utf-8')
const slugs = [...servicesFile.matchAll(/slug:\s*['"]([^'"]+)['"]/g)].map(m => m[1])

// --- Rutas estáticas (páginas fijas de la web) ---
const staticRoutes = [
  { path: '/',            priority: '1.0', changefreq: 'monthly' },
  { path: '/servicios',   priority: '0.9', changefreq: 'monthly' },
  { path: '/sobre-iryna', priority: '0.7', changefreq: 'monthly' },
  { path: '/contacto',    priority: '0.7', changefreq: 'monthly' },
]

// --- Rutas dinámicas (una por cada servicio) ---
const serviceRoutes = slugs.map(slug => ({
  path: `/servicios/${slug}`,
  priority: '0.8',
  changefreq: 'monthly',
}))

const allRoutes = [...staticRoutes, ...serviceRoutes]
const base = 'https://iriasystems.com'
const today = new Date().toISOString().split('T')[0]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes.map(r => `
  <url>
    <loc>${base}${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`).join('')}
</urlset>
`

const outPath = resolve(root, 'public/sitemap.xml')
writeFileSync(outPath, xml.trimStart())
console.log(`✅ sitemap.xml generado con ${allRoutes.length} URLs (${slugs.length} servicios)`)
slugs.forEach(s => console.log(`   → /servicios/${s}`))
