import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
