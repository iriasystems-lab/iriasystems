import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import ServicePage from './pages/ServicePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/servicios/:slug" element={<ServicePage />} />
      </Routes>
    </BrowserRouter>
  )
}
