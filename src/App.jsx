import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import CookieBanner from './components/CookieBanner'

const Home        = lazy(() => import('./pages/Home'))
const Servicios   = lazy(() => import('./pages/Servicios'))
const ServicePage = lazy(() => import('./pages/ServicePage'))
const SobreMi     = lazy(() => import('./pages/SobreMi'))
const Contacto    = lazy(() => import('./pages/Contacto'))
const AvisoLegal  = lazy(() => import('./pages/AvisoLegal'))
const Privacidad  = lazy(() => import('./pages/Privacidad'))
const Cookies     = lazy(() => import('./pages/Cookies'))
const NotFound    = lazy(() => import('./pages/NotFound'))

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#1a1208] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"                      element={<Home />} />
            <Route path="/servicios"             element={<Servicios />} />
            <Route path="/servicios/:slug"       element={<ServicePage />} />
            <Route path="/sobre-iryna"           element={<SobreMi />} />
            <Route path="/contacto"              element={<Contacto />} />
            <Route path="/aviso-legal"           element={<AvisoLegal />} />
            <Route path="/politica-privacidad"   element={<Privacidad />} />
            <Route path="/politica-cookies"      element={<Cookies />} />
            <Route path="*"                      element={<NotFound />} />
          </Routes>
          <CookieBanner />
        </Suspense>
      </BrowserRouter>
    </HelmetProvider>
  )
}
