import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import supabase from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import OnboardingForm from '../moov/OnboardingForm'

interface MoovOnboardingStepProps {
  onComplete: (accountId: string) => void
  prefillData?: {
    fullName: string
    email: string
    phone: string
  }
  existingMoovId?: string | null
}

const MoovOnboardingStep: React.FC<MoovOnboardingStepProps> = ({
  onComplete,
  prefillData,
  existingMoovId
}) => {
  const { user } = useAuth()
  const [accountId, setAccountId] = useState<string | null>(existingMoovId || null)
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<string>('unverified')
  const [hover, setHover] = useState(false)

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

  // Prefill user data
  useEffect(() => {
    if (prefillData) {
      const nameParts = prefillData.fullName.trim().split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''
      
      // Clean phone number
      let cleanPhone = ''
      if (prefillData.phone) {
        cleanPhone = prefillData.phone.replace(/\D/g, '')
        if (cleanPhone.startsWith('1') && cleanPhone.length === 11) {
          cleanPhone = cleanPhone.slice(1)
        }
      }

      setForm(prev => ({
        ...prev,
        firstName,
        lastName,
        email: prefillData.email,
        phone: cleanPhone
      }))
    }
  }, [prefillData])

  // Check if account already exists
  useEffect(() => {
    if (accountId) {
      handleCheckVerification()
    }
  }, [accountId])

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let { name, value } = e.target
    if (name === 'stateOrProvince') value = value.toUpperCase()
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleCheckVerification = async () => {
    const idToCheck = accountId
    
    setIsChecking(true)
    try {
      const { data, error } = await supabase.functions.invoke(
        'moov-get-account',
        {
          body: { accountId: idToCheck }
        }
      )
      if (error) throw error
      
      // Check if account exists and has accountID - that's sufficient for individual accounts
      // Capabilities may be pending but we can still proceed to bank linking
      const hasAccount = !!data?.accountID
      const capabilityStatus = data?.capabilities?.[0]?.status
      const isVerified = hasAccount && (capabilityStatus === 'enabled' || capabilityStatus === 'pending')
      
      setVerificationStatus(isVerified ? 'verified' : 'unverified')
      
      if (isVerified) {
        toast.success('Account ready!')
        onComplete(idToCheck!)
      } else if (hasAccount) {
        // Account exists but capabilities not ready - still proceed
        toast.success('Account created - proceeding to bank setup')
        onComplete(idToCheck!)
      } else {
        toast.loading('Verification in progress...', { duration: 3000 })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to check verification')
    } finally {
      setIsChecking(false)
    }
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

    if (!nameRegex.test(form.firstName))
      return 'First name must contain only letters'
    if (!nameRegex.test(form.lastName))
      return 'Last name must contain only letters'
    if (!emailRegex.test(form.email))
      return 'Please enter a valid email address'
    if (!phoneRegex.test(form.phone))
      return 'Phone number must be exactly 10 digits'
    if (!cityRegex.test(form.city)) 
      return 'City name must contain only letters'
    if (!stateRegex.test(form.stateOrProvince.toUpperCase()))
      return 'State must be a valid U.S. 2-letter code (e.g., CA, NY)'
    if (!postalRegex.test(form.postalCode))
      return 'Postal code must be exactly 5 digits'
    if (!ssnRegex.test(form.ssn)) 
      return 'SSN must be exactly 9 digits'
    if (!monthRegex.test(form.month)) 
      return 'Month must be valid (01–12)'
    if (!dayRegex.test(form.day)) 
      return 'Day must be valid (01–31)'
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
        
        // Store in talent_profiles
        const { error: updErr } = await supabase
          .from('talent_profiles')
          .update({ moov_account_id: data.accountID })
          .eq('user_id', user?.id)
        
        if (updErr) console.error('Failed to update moov_account_id:', updErr)
        
        // Check verification status
        setTimeout(() => {
          handleCheckVerification()
        }, 2000)
        
      } else {
        throw new Error('Failed to get accountID from response')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create account', { id: toastId })
    } finally {
      setIsLoading(false)
    }
  }

  const buttonBase: React.CSSProperties = {
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

  const glassCard: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '20px',
    padding: '40px',
    width: '100%',
    maxWidth: '600px',
    margin: 'auto'
  }

  const headingStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: '10px',
    color: '#1f2937'
  }

  const subheadingStyle: React.CSSProperties = {
    textAlign: 'center',
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '30px'
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    background: '#f9fafb',
    color: '#1f2937',
    fontSize: '14px',
    outline: 'none',
    marginBottom: '16px',
    transition: 'all 0.3s ease',
    WebkitTextFillColor: '#1f2937',
  }

  if (accountId) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          {verificationStatus === 'verified' ? (
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-10 h-10 text-yellow-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
        </div>
        
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          {verificationStatus === 'verified' ? 'Account Verified!' : 'Account Created'}
        </h3>
        
        <p className="text-gray-600 mb-6">
          {verificationStatus === 'verified' 
            ? 'Your identity has been verified successfully.'
            : 'Your account is being verified. This usually takes a few moments.'}
        </p>
        
        <code className="block bg-gray-100 rounded-lg px-4 py-3 text-sm text-gray-700 mb-6">
          Account ID: {accountId}
        </code>
        
        <button
          onClick={handleCheckVerification}
          disabled={isChecking || verificationStatus === 'verified'}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isChecking ? 'Checking...' : verificationStatus === 'verified' ? 'Verified ✓' : 'Check Verification Status'}
        </button>
      </div>
    )
  }

  return (
    <OnboardingForm
      form={form}
      onChange={handleFormChange}
      onClose={() => {}}
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
  )
}

export default MoovOnboardingStep

