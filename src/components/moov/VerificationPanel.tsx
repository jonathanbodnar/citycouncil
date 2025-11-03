import React from 'react'

type VerificationPanelProps = {
  accountId: string
  verification: any
  isChecking: boolean
  onCheck: () => void
  buttonBase: React.CSSProperties
  buttonHover: React.CSSProperties
}

const VerificationPanel: React.FC<VerificationPanelProps> = ({
  accountId,
  verification,
  isChecking,
  onCheck,
  buttonBase,
  buttonHover,
}) => {
  const [hover, setHover] = React.useState(false)

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      border: '1px solid rgba(255, 255, 255, 0.18)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      borderRadius: '20px',
      padding: '24px',
      width: '100%',
      maxWidth: '680px',
      color: '#f9fafb',
      marginTop: '16px'
    }}>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Onboarding Status</h3>
      <p>Your Moov account ID:</p>
      <code
        style={{
          display: 'block',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '10px',
          padding: '12px',
          margin: '12px 0',
          color: '#a78bfa'
        }}
      >
        {accountId}
      </code>
      <button
        className='mt-4'
        type='button'
        style={hover ? buttonHover : buttonBase}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={onCheck}
        disabled={isChecking}
      >
        {isChecking ? 'Checking…' : 'Refresh status'}
      </button>
      {verification && (
        <pre style={{
          marginTop: '12px',
          background: 'rgba(255,255,255,0.06)',
          padding: '12px',
          borderRadius: '10px',
          maxHeight: '240px',
          overflow: 'auto',
          color: '#e5e7eb'
        }}>
          {JSON.stringify(verification, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default VerificationPanel


