import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import ServicePage from './pages/ServicePage'
import Kitt from './pages/Kitt'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/kitt" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/servicios/:slug" element={<ServicePage />} />
        <Route path="/kitt" element={<Kitt />} />
      </Routes>
    </BrowserRouter>
  )
}
