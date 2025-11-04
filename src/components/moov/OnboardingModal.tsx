import React from 'react'

type OnboardingModalProps = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ open, onClose, children }) => {
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        animation: 'fadeIn 0.3s ease',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

export default OnboardingModal


