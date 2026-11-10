import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// dev/penrose: Penrose-tiling mode. The full console (App.jsx) stays in the
// tree for its audio/util functions; this branch just doesn't mount it.
import PenroseApp from './penrose/PenroseApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PenroseApp />
  </StrictMode>,
)
