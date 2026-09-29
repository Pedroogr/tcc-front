import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fontes locais: a demonstracao nao pode depender de rede.
// Archivo e variavel, entao um import cobre toda a faixa de peso.
import '@fontsource-variable/archivo'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './index.css'
import App from './App.tsx'
import { AdminApp } from './admin/AdminApp.tsx'
import { OperatorApp } from './operator/OperatorApp.tsx'
import { GestureStationApp } from './gesture/GestureStationApp.tsx'
import { TooltipProvider } from '@/components/ui/tooltip'

const isAdminRoute = /^\/admin\/?$/.test(window.location.pathname)
const isOperatorRoute = /^\/operator\/?$/.test(window.location.pathname)
const gestureStationMatch = window.location.pathname.match(
  /^\/gesture-station\/([^/]+)\/?$/,
)

function decodeRoutePart(value: string | undefined) {
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}
const gestureStationAuctionId = decodeRoutePart(gestureStationMatch?.[1])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {gestureStationAuctionId ? (
      <GestureStationApp auctionId={gestureStationAuctionId} />
    ) : isOperatorRoute ? (
      <OperatorApp />
    ) : isAdminRoute ? (
      <AdminApp />
    ) : (
      <TooltipProvider>
        <App />
      </TooltipProvider>
    )}
  </StrictMode>,
)
