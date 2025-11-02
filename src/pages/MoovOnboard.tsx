import React, { useState } from 'react'
import toast from 'react-hot-toast'
import supabase from '../services/supabase'

type Props = {}

const MoovOnboard = (props: Props) => {
  const [accountId, setAccountId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hover, setHover] = useState(false)
  const [open, setOpen] = useState(false)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressLine1: '',
    city: '',
    stateOrProvince: '',
    postalCode: '',
    month: '',
    day: '',
    year: '',
    ssn: ''
  })

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let { name, value } = e.target
    if (name === 'stateOrProvince') value = value.toUpperCase()
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const validateForm = () => {
    const nameRegex = /^[A-Za-z]+$/
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const cityRegex = /^[A-Za-z\s]+$/
    const stateRegex =
      /^(A[KLRZ]|C[AOT]|D[EC]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEHINOST]|N[CDEHJMVY]|O[HKR]|P[AWR]|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY])$/
    const postalRegex = /^\d{5}$/
    const ssnRegex = /^\d{9}$/
    const phoneRegex = /^\d{10}$/
    const monthRegex = /^(0[1-9]|1[0-2])$/
    const dayRegex = /^(0[1-9]|[12][0-9]|3[01])$/
    const yearNum = Number(form.year)
    const currentYear = new Date().getFullYear()
    if (!nameRegex.test(form.firstName)) return 'First name must contain only letters'
    if (!nameRegex.test(form.lastName)) return 'Last name must contain only letters'
    if (!emailRegex.test(form.email)) return 'Please enter a valid email address'
    if (!phoneRegex.test(form.phone)) return 'Phone number must be exactly 10 digits'
    if (!cityRegex.test(form.city)) return 'City name must contain only letters'
    if (!stateRegex.test(form.stateOrProvince.toUpperCase()))
      return 'State must be a valid U.S. 2-letter code (e.g., CA, NY)'
    if (!postalRegex.test(form.postalCode)) return 'Postal code must be exactly 5 digits'
    if (!ssnRegex.test(form.ssn)) return 'SSN must be exactly 9 digits'
    if (!monthRegex.test(form.month)) return 'Month must be valid (01–12)'
    if (!dayRegex.test(form.day)) return 'Day must be valid (01–31)'
    if (isNaN(yearNum) || yearNum < 1895 || yearNum >= currentYear)
      return 'Year must be a valid year in the past (e.g., 1990)'
    return null
  }

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validateForm()
    if (validationError) {
      toast.error(validationError)
      return
    }
    setIsLoading(true)
    const toastId = 'moov-create'
    toast.loading('Creating & verifying Moov account...', { id: toastId })
    try {
      const { data, error } = await supabase.functions.invoke('moov-create-account', {
        body: form
      })
      if (error) throw error
      if (data?.accountID) {
        toast.success(`Account created! ID: ${data.accountID}`, { id: toastId })
        setAccountId(data.accountID)
      } else throw new Error('Failed to get accountID from response')
    } catch (err: any) {
      toast.error(err.message || 'Failed to create account', { id: 'moov-create' })
    } finally {
      setIsLoading(false)
    }
  }

  const glassCard: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    borderRadius: '20px',
    padding: '40px',
    width: '100%',
    maxWidth: '480px',
    color: '#f9fafb',
    margin: 'auto',
    position: 'relative',
    maxHeight: '90vh', // 🔹 Limit height for mobile
    overflowY: 'auto', // 🔹 Make form scrollable
    scrollbarWidth: 'thin' // For Firefox
  }

  const headingStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: '10px',
    color: '#ffffff'
  }

  const subheadingStyle: React.CSSProperties = {
    textAlign: 'center',
    fontSize: '14px',
    color: '#d1d5db',
    marginBottom: '30px'
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.08)',
    color: '#f9fafb',
    fontSize: '14px',
    outline: 'none',
    marginBottom: '16px',
    transition: 'all 0.3s ease'
  }

  const buttonBase: React.CSSProperties = {
    marginTop: '1rem',
    width: '100%',
    padding: '14px',
    fontSize: '16px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    boxShadow: '0 0 15px rgba(139, 92, 246, 0.4)'
  }

  const buttonHover: React.CSSProperties = {
    ...buttonBase,
    transform: 'translateY(-1px)',
    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
    boxShadow: '0 0 25px rgba(139, 92, 246, 0.6)'
  }

  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <button
        style={hover ? buttonHover : buttonBase}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => setOpen(true)}
      >
        Start Onboarding
      </button>

      {open && (
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
          onClick={() => setOpen(false)}
        >
          <div onClick={e => e.stopPropagation()}>
            {!accountId ? (
              <form style={glassCard} onSubmit={handleCreateAccount}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
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

                <h3 style={headingStyle}>Onboard New Talent</h3>
                <p style={subheadingStyle}>Please provide your details below.</p>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <input name="firstName" placeholder="First Name" value={form.firstName} onChange={handleFormChange} style={inputStyle} required />
                  <input name="lastName" placeholder="Last Name" value={form.lastName} onChange={handleFormChange} style={inputStyle} required />
                </div>

                <input name="email" placeholder="Email Address" value={form.email} onChange={handleFormChange} style={inputStyle} required />
                <input
                  name="phone"
                  placeholder="Phone Number (10 digits)"
                  value={form.phone}
                  onChange={e => {
                    if (/^\d{0,10}$/.test(e.target.value)) handleFormChange(e)
                  }}
                  style={inputStyle}
                  required
                />
                <input name="addressLine1" placeholder="Address" value={form.addressLine1} onChange={handleFormChange} style={inputStyle} required />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input name="city" placeholder="City" value={form.city} onChange={handleFormChange} style={inputStyle} required />
                  <input
                    name="stateOrProvince"
                    placeholder="State (e.g. CA)"
                    value={form.stateOrProvince}
                    onChange={e => {
                      if (/^[A-Za-z]{0,2}$/.test(e.target.value)) handleFormChange(e)
                    }}
                    style={inputStyle}
                    maxLength={2}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    name="postalCode"
                    placeholder="Postal Code (5 digits)"
                    value={form.postalCode}
                    onChange={e => {
                      if (/^\d{0,5}$/.test(e.target.value)) handleFormChange(e)
                    }}
                    style={inputStyle}
                    required
                  />
                  <input
                    name="ssn"
                    placeholder="SSN (9 digits)"
                    value={form.ssn}
                    onChange={e => {
                      if (/^\d{0,9}$/.test(e.target.value)) handleFormChange(e)
                    }}
                    style={inputStyle}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    name="month"
                    placeholder="MM"
                    value={form.month}
                    onChange={e => {
                      if (/^\d{0,2}$/.test(e.target.value)) handleFormChange(e)
                    }}
                    style={{ ...inputStyle, marginBottom: 0 }}
                    required
                  />
                  <input
                    name="day"
                    placeholder="DD"
                    value={form.day}
                    onChange={e => {
                      if (/^\d{0,2}$/.test(e.target.value)) handleFormChange(e)
                    }}
                    style={{ ...inputStyle, marginBottom: 0 }}
                    required
                  />
                  <input
                    name="year"
                    placeholder="YYYY"
                    value={form.year}
                    onChange={e => {
                      if (/^\d{0,4}$/.test(e.target.value)) handleFormChange(e)
                    }}
                    style={{ ...inputStyle, marginBottom: 0 }}
                    required
                  />
                </div>

                <button
                  type="submit"
                  style={hover ? buttonHover : buttonBase}
                  onMouseEnter={() => setHover(true)}
                  onMouseLeave={() => setHover(false)}
                  disabled={isLoading}
                >
                  {isLoading ? 'Processing...' : 'Create & Verify Account'}
                </button>
              </form>
            ) : (
              <div style={glassCard}>
                <h3 style={headingStyle}>Account Created!</h3>
                <p>Your account ID is:</p>
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
                <p style={{ color: '#cbd5e1' }}>Verification is in progress. You’ll receive updates soon.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MoovOnboard
