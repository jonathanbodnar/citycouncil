import React from 'react'

type FormState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  addressLine1: string
  city: string
  stateOrProvince: string
  postalCode: string
  month: string
  day: string
  year: string
  ssn: string
  taxIdType?: 'ssn' | 'ein'
}

type OnboardingFormProps = {
  form: FormState
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onTaxIdTypeChange?: (type: 'ssn' | 'ein') => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  isLoading: boolean
  glassCard: React.CSSProperties
  headingStyle: React.CSSProperties
  subheadingStyle: React.CSSProperties
  inputStyle: React.CSSProperties
  buttonBase: React.CSSProperties
  buttonHover: React.CSSProperties
  hover: boolean
  setHover: (v: boolean) => void
}

const OnboardingForm: React.FC<OnboardingFormProps> = ({
  form,
  onChange,
  onTaxIdTypeChange,
  onClose,
  onSubmit,
  isLoading,
  glassCard,
  headingStyle,
  subheadingStyle,
  inputStyle,
  buttonBase,
  buttonHover,
  hover,
  setHover,
}) => {
  const taxIdType = form.taxIdType || 'ssn'
  return (
    <form style={glassCard} onSubmit={onSubmit} className="light-theme">
      <button
        type='button'
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '10px',
          right: '14px',
          background: 'none',
          border: 'none',
          color: '#f9fafb',
          fontSize: '22px',
          cursor: 'pointer'
        }}
      >
        ×
      </button>

      <h3 style={headingStyle}>Setup Your Payouts Account</h3>
      <p style={subheadingStyle}>
        To receive payouts please enter your legal information. You can connect your bank account after verification.
      </p>

      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          name='firstName'
          placeholder='First Name'
          value={form.firstName}
          onChange={onChange}
          style={inputStyle}
          required
        />
        <input
          name='lastName'
          placeholder='Last Name'
          value={form.lastName}
          onChange={onChange}
          style={inputStyle}
          required
        />
      </div>

      <input
        name='email'
        placeholder='Email Address'
        value={form.email}
        onChange={onChange}
        style={inputStyle}
        required
      />
      <input
        name='phone'
        placeholder='Phone Number (10 digits)'
        value={form.phone}
        onChange={(e) => {
          if (/^\d{0,10}$/.test(e.target.value)) onChange(e)
        }}
        style={inputStyle}
        required
      />
      <input
        name='addressLine1'
        placeholder='Address'
        value={form.addressLine1}
        onChange={onChange}
        style={inputStyle}
        required
      />
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          name='city'
          placeholder='City'
          value={form.city}
          onChange={onChange}
          style={inputStyle}
          required
        />
        <input
          name='stateOrProvince'
          placeholder='State (e.g. CA)'
          value={form.stateOrProvince}
          onChange={(e) => {
            if (/^[A-Za-z]{0,2}$/.test(e.target.value)) onChange(e)
          }}
          style={inputStyle}
          maxLength={2}
          required
        />
      </div>
      <input
        name='postalCode'
        placeholder='Postal Code (5 digits)'
        value={form.postalCode}
        onChange={(e) => {
          if (/^\d{0,5}$/.test(e.target.value)) onChange(e)
        }}
        style={inputStyle}
        required
      />

      {/* Tax ID Type Toggle */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
          Tax ID Type
        </label>
        <div style={{ display: 'flex', gap: '12px' }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            cursor: 'pointer',
            padding: '10px 16px',
            borderRadius: '8px',
            border: taxIdType === 'ssn' ? '2px solid #8b5cf6' : '1px solid #d1d5db',
            background: taxIdType === 'ssn' ? 'rgba(139, 92, 246, 0.1)' : '#fff',
            transition: 'all 0.2s ease'
          }}>
            <input
              type="radio"
              name="taxIdType"
              value="ssn"
              checked={taxIdType === 'ssn'}
              onChange={() => onTaxIdTypeChange?.('ssn')}
              style={{ accentColor: '#8b5cf6' }}
            />
            <span style={{ fontSize: '14px', color: '#1f2937' }}>SSN (Individual)</span>
          </label>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            cursor: 'pointer',
            padding: '10px 16px',
            borderRadius: '8px',
            border: taxIdType === 'ein' ? '2px solid #8b5cf6' : '1px solid #d1d5db',
            background: taxIdType === 'ein' ? 'rgba(139, 92, 246, 0.1)' : '#fff',
            transition: 'all 0.2s ease'
          }}>
            <input
              type="radio"
              name="taxIdType"
              value="ein"
              checked={taxIdType === 'ein'}
              onChange={() => onTaxIdTypeChange?.('ein')}
              style={{ accentColor: '#8b5cf6' }}
            />
            <span style={{ fontSize: '14px', color: '#1f2937' }}>EIN (Business)</span>
          </label>
        </div>
      </div>

      <input
        name='ssn'
        type='password'
        placeholder={taxIdType === 'ssn' ? 'Social Security Number (9 digits)' : 'Employer Identification Number (9 digits)'}
        value={form.ssn}
        onChange={(e) => {
          if (/^\d{0,9}$/.test(e.target.value)) onChange(e)
        }}
        style={{
          ...inputStyle,
          letterSpacing: '0.3em',
          fontFamily: 'monospace',
          border: '1px solid #d1d5db',
          borderRadius: '10px',
          background: '#f9fafb'
        }}
        inputMode='numeric'
        pattern='\d*'
        maxLength={9}
        autoComplete='off'
        required
      />
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          name='month'
          placeholder='MM'
          value={form.month}
          onChange={(e) => {
            if (/^\d{0,2}$/.test(e.target.value)) onChange(e)
          }}
          style={{ ...inputStyle, marginBottom: 0 }}
          required
        />
        <input
          name='day'
          placeholder='DD'
          value={form.day}
          onChange={(e) => {
            if (/^\d{0,2}$/.test(e.target.value)) onChange(e)
          }}
          style={{ ...inputStyle, marginBottom: 0 }}
          required
        />
        <input
          name='year'
          placeholder='YYYY'
          value={form.year}
          onChange={(e) => {
            if (/^\d{0,4}$/.test(e.target.value)) onChange(e)
          }}
          style={{ ...inputStyle, marginBottom: 0 }}
          required
        />
      </div>

      {/* SSL Encryption Notice */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '12px',
        marginTop: '10px',
        marginBottom: '10px',
        background: 'rgba(34, 197, 94, 0.1)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: '8px',
        color: '#16a34a',
        fontSize: '13px'
      }}>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="currentColor" 
          style={{ width: '18px', height: '18px', flexShrink: 0 }}
        >
          <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
        </svg>
        <span>
          <strong>256-bit SSL Encrypted</strong> - Your information is secure
        </span>
      </div>

      <button
        type='submit'
        style={hover ? buttonHover : buttonBase}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        disabled={isLoading}
      >
        {isLoading ? 'Processing...' : 'Create & Verify Account'}
      </button>
    </form>
  )
}

export default OnboardingForm


