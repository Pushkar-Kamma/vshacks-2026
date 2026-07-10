import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <section id="center">
      <p style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '2px', fontSize: '14px' }}>
        vsHacks 2026 · July 11–12
      </p>

      <h1>Project name: TBD</h1>

      <p style={{ maxWidth: '640px' }}>
        Our team&apos;s hackathon project. The theme is announced at the opening
        ceremony &mdash; this is our starting canvas. Edit <code>src/App.jsx</code>{' '}
        to start building.
      </p>

      <button type="button" className="counter" onClick={() => setCount(count + 1)}>
        React works &mdash; clicked {count} times
      </button>

      <p style={{ display: 'flex', gap: '16px', margin: 0 }}>
        <a href="https://vshacks-2026.devpost.com/" target="_blank" rel="noreferrer">
          Devpost
        </a>
        <a href="https://discord.gg/fFagbFh45c" target="_blank" rel="noreferrer">
          Discord
        </a>
        <a
          href="https://github.com/Pushkar-Kamma/vshacks-2026"
          target="_blank"
          rel="noreferrer"
        >
          Repo
        </a>
      </p>
    </section>
  )
}

export default App
