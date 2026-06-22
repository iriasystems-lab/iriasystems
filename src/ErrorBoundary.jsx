import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error: error?.message || 'Error desconocido' }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          background: '#0a0a0a', color: '#c9a227', minHeight: '100vh',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Arial, sans-serif', padding: '20px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>K·I·T·T·</div>
          <div style={{ color: '#e87c2a', fontSize: '14px', marginBottom: '12px' }}>
            Error de inicialización
          </div>
          <div style={{
            background: '#111', border: '1px solid #333', borderRadius: '4px',
            padding: '12px', maxWidth: '400px', fontSize: '11px',
            color: '#888', wordBreak: 'break-all'
          }}>
            {this.state.error}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px', background: '#c9a227', color: '#000',
              border: 'none', padding: '10px 24px', borderRadius: '4px',
              fontSize: '13px', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            REINTENTAR
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
