import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import supabase from '../services/supabase'
import OnboardingModal from '../components/moov/OnboardingModal'
import OnboardingForm from '../components/moov/OnboardingForm'
 

type Props = {}

const MoovOnboard = (props: Props) => {
  const [accountId, setAccountId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hover, setHover] = useState(false)
  const [open, setOpen] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [verification, setVerification] = useState<any>(null)
  const [verificationStatus, setVerificationStatus] = useState<string>('unverified')
  const [initLoading, setInitLoading] = useState(true)
  
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

  // Prefill user data on component mount
  useEffect(() => {
    const prefillUserData = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const uid = authData?.user?.id
        if (!uid) return

        // Get user email from auth
        const userEmail = authData.user.email || ''

        // Get user's talent profile for full name
        const { data: profile } = await supabase
          .from('talent_profiles')
          .select('full_name')
          .eq('user_id', uid)
          .maybeSingle()

        // Get user's phone from public.users table
        const { data: userData } = await supabase
          .from('users')
          .select('phone')
          .eq('id', uid)
          .maybeSingle()

        // Parse full name into first/last
        let firstName = ''
        let lastName = ''
        if (profile?.full_name) {
          const nameParts = profile.full_name.trim().split(' ')
          firstName = nameParts[0] || ''
          lastName = nameParts.slice(1).join(' ') || ''
        }

        // Clean phone number (remove formatting)
        let cleanPhone = ''
        if (userData?.phone) {
          cleanPhone = userData.phone.replace(/\D/g, '')
          // Remove country code if present
          if (cleanPhone.startsWith('1') && cleanPhone.length === 11) {
            cleanPhone = cleanPhone.slice(1)
          }
        }

        // Update form with prefilled data
        setForm(prev => ({
          ...prev,
          firstName,
          lastName,
          email: userEmail,
          phone: cleanPhone
        }))
      } catch (error) {
        console.error('Error prefilling user data:', error)
      }
    }

    if (open && !accountId) {
      prefillUserData()
    }
  }, [open, accountId])

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let { name, value } = e.target
    if (name === 'stateOrProvince') value = value.toUpperCase()
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleCheckVerification = async () => {
    const idToCheck = accountId
    
    setIsChecking(true)
    toast.loading('Checking verification status…', { id: 'moov-get' })
    try {
      // Send accountId in request body (edge function supports body)
      const { data, error } = await supabase.functions.invoke(
        'moov-get-account',
        {
          body: { accountId: idToCheck } // Send as a JSON object
        }
      )
      if (error) throw error
      const status = data?.capabilities[0]?.status == 'enabled' ? "verified" : "unverified"
      console.log(data, 'data')
      setVerification(data) // for the <pre> tag
      setVerificationStatus(status) // for the status display
      toast.success(`Verification: ${status}`, { id: 'moov-get' })
      console.log('Moov account details:', data)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to fetch verification', { id: 'moov-get' })
    } finally {
      setIsChecking(false)
    }
  }

  // On mount: check if talent already has a moov_account_id
  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const uid = auth?.user?.id
        if (!uid) return
        const { data: tp } = await supabase
          .from('talent_profiles')
          .select('moov_account_id')
          .eq('user_id', uid)
          .maybeSingle()
        if (tp?.moov_account_id) {
          setAccountId(tp.moov_account_id)
        }
      } catch (_) {
        // ignore
      } finally {
        setInitLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After initial load, if we have an accountId, automatically trigger a check
  useEffect(() => {
    if (!initLoading && accountId) {
      handleCheckVerification()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initLoading, accountId])

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
    if (!nameRegex.test(form.firstName))
      return 'First name must contain only letters'
    if (!nameRegex.test(form.lastName))
      return 'Last name must contain only letters'
    if (!emailRegex.test(form.email))
      return 'Please enter a valid email address'
    if (!phoneRegex.test(form.phone))
      return 'Phone number must be exactly 10 digits'
    if (!cityRegex.test(form.city)) return 'City name must contain only letters'
    if (!stateRegex.test(form.stateOrProvince.toUpperCase()))
      return 'State must be a valid U.S. 2-letter code (e.g., CA, NY)'
    if (!postalRegex.test(form.postalCode))
      return 'Postal code must be exactly 5 digits'
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
      const { data, error } = await supabase.functions.invoke(
        'moov-create-account',
        {
          body: form
        }
      )
      if (error) throw error
      if (data?.accountID) {
        toast.success(`Account created! ID: ${data.accountID}`, { id: toastId })
        setAccountId(data.accountID)
        // Store in talent_profiles.moov_account_id so we can resume later
        try {
          const { data: auth } = await supabase.auth.getUser()
          const uid = auth?.user?.id
          if (uid) {
            const { error: updErr } = await supabase
              .from('talent_profiles')
              .update({ moov_account_id: data.accountID })
              .eq('user_id', uid)
            if (updErr) console.error('Failed to update moov_account_id:', updErr)
          }
        } catch (e) {
          console.error('Persist moov_account_id failed:', e)
        }
      } else throw new Error('Failed to get accountID from response')
    } catch (err: any) {
      toast.error(err.message || 'Failed to create account', {
        id: 'moov-create'
      })
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
    width: '100%',
    textWrap: 'nowrap',
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
    <>
      {initLoading ? (
        <button
          className='h-14'
          style={buttonBase}
          disabled
        >
          Loading…
        </button>
      ) : accountId ? (
        <button
          className='h-14'
          style={hover ? buttonHover : buttonBase}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={handleCheckVerification}
          disabled={isChecking}
        >
          {isChecking ? 'Checking…' : 'Check verification'}
        </button>
      ) : (
        <button
          className='h-14'
          style={hover ? buttonHover : buttonBase}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={() => setOpen(true)}
        >
          Start Onboarding
        </button>
      )}

      <OnboardingModal open={open} onClose={() => setOpen(false)}>
        {!accountId ? (
          <OnboardingForm
            form={form}
            onChange={handleFormChange}
            onClose={() => setOpen(false)}
            onSubmit={handleCreateAccount}
            isLoading={isLoading}
            glassCard={glassCard}
            headingStyle={headingStyle}
            subheadingStyle={subheadingStyle}
            inputStyle={inputStyle}
            buttonBase={buttonBase}
            buttonHover={buttonHover}
            hover={hover}
            setHover={setHover}
          />
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
            <p style={{ color: '#cbd5e1' }}>
              Verification is in progress. You’ll receive updates soon.
            </p>
          </div>
        )}
      </OnboardingModal>
      
    </>
  )
}

export default MoovOnboard
