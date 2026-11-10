import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// dev/chingy: hexagram-only mode. The full console (App.jsx) stays in the
// tree for its audio/util functions; this branch just doesn't mount it.
import ChingyApp from './chingy/ChingyApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ChingyApp />
  </StrictMode>,
)
