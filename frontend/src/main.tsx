import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import ClientPortal from './components/ClientPortal.tsx'
import './index.css'

// Check if we're on the client portal route
const isClientPortal = window.location.pathname.startsWith('/client/');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isClientPortal ? <ClientPortal /> : <App />}
  </React.StrictMode>,
)
