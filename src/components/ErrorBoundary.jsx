import { Component } from 'react'

/**
 * Last line of defence: a render error in one page must not leave the user
 * staring at a blank screen in an app they rely on daily.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="card-float-lg p-8 max-w-md w-full text-center">
          <p className="text-[40px] mb-3">🌿</p>
          <h1 className="font-display text-[22px] font-600 text-ink mb-2">
            Qualcosa è andato storto
          </h1>
          <p className="text-[13.5px] text-ink-soft leading-relaxed mb-6">
            I tuoi dati sono al sicuro. Ricarica la pagina per riprendere da dove eri.
            <br />
            <span className="text-ink/45">
              Your data is safe. Reload the page to pick up where you left off.
            </span>
          </p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            Ricarica · Reload
          </button>
        </div>
      </div>
    )
  }
}
