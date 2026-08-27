import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/global.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root 를 찾을 수 없다')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
