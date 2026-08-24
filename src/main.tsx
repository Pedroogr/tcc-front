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
import { TooltipProvider } from '@/components/ui/tooltip'

const isAdminRoute = /^\/admin\/?$/.test(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? (
      <AdminApp />
    ) : (
      <TooltipProvider>
        <App />
      </TooltipProvider>
    )}
  </StrictMode>,
)
