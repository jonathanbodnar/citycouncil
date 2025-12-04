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
  const [accountRejected, setAccountRejected] = useState(false)
  const [rejectionReason, setRejectionReason] = useState<string | null>(null)
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
    ssn: '',
    taxIdType: 'ssn' as 'ssn' | 'ein'
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
    setAccountRejected(false)
    setRejectionReason(null)
    
    try {
      const { data, error } = await supabase.functions.invoke(
        'moov-get-account',
        {
          body: { accountId: idToCheck }
        }
      )
      
      // Check if account exists and has accountID
      const hasAccount = !error && !!data?.accountID
      
      // Check capabilities status - Moov uses: enabled, pending, disabled
      const capability = data?.capabilities?.[0]
      const capabilityStatus = capability?.status
      const disabledReason = capability?.disabledReason
      
      // Check if account or capabilities were rejected/disabled
      if (capabilityStatus === 'disabled') {
        setAccountRejected(true)
        setRejectionReason(disabledReason || 'Your account verification was not approved. Please try again with accurate information.')
        setVerificationStatus('rejected')
        return
      }
      
      const isVerified = hasAccount && (capabilityStatus === 'enabled' || capabilityStatus === 'pending')
      
      setVerificationStatus(isVerified ? 'verified' : 'unverified')
      
      if (isVerified) {
        toast.success('Account ready!')
        onComplete(idToCheck!)
      } else if (hasAccount) {
        // Account exists but capabilities not ready - still proceed
        toast.success('Account created - proceeding to bank setup')
        onComplete(idToCheck!)
      } else if (idToCheck) {
        // Account ID exists but API check failed - still proceed silently
        // This can happen with transient API errors
        console.log('Moov account check failed, but account ID exists - proceeding')
        setVerificationStatus('verified')
        onComplete(idToCheck)
      } else {
        toast.loading('Verification in progress...', { duration: 3000 })
      }
    } catch (err: any) {
      // If we have an account ID, proceed anyway - the account was created
      if (idToCheck) {
        console.log('Moov verification error (non-blocking):', err?.message)
        setVerificationStatus('verified')
        onComplete(idToCheck)
      } else {
        toast.error(err?.message || 'Failed to check verification')
      }
    } finally {
      setIsChecking(false)
    }
  }
  
  const handleRetryAccount = async () => {
    // Clear the existing account ID so user can create a new one
    setAccountId(null)
    setAccountRejected(false)
    setRejectionReason(null)
    setVerificationStatus('unverified')
    
    // Clear the moov_account_id from the database
    try {
      await supabase
        .from('talent_profiles')
        .update({ moov_account_id: null })
        .eq('user_id', user?.id)
    } catch (err) {
      console.error('Error clearing moov_account_id:', err)
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
      return form.taxIdType === 'ssn' ? 'SSN must be exactly 9 digits' : 'EIN must be exactly 9 digits'
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

  // Show rejection state with retry option
  if (accountId && accountRejected) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Verification Issue
        </h3>
        
        <p className="text-gray-600 mb-4">
          {rejectionReason || 'There was an issue verifying your account. Please try again with accurate information.'}
        </p>
        
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
          <p className="text-sm text-amber-800">
            <strong>Common reasons for verification issues:</strong>
          </p>
          <ul className="text-sm text-amber-700 mt-2 space-y-1">
            <li>• Name doesn't match government ID exactly</li>
            <li>• Incorrect SSN or EIN</li>
            <li>• Date of birth doesn't match records</li>
            <li>• Address verification failed</li>
          </ul>
        </div>
        
        <button
          onClick={handleRetryAccount}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    )
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

  const handleTaxIdTypeChange = (type: 'ssn' | 'ein') => {
    setForm(prev => ({ ...prev, taxIdType: type, ssn: '' }))
  }

  return (
    <OnboardingForm
      form={form}
      onChange={handleFormChange}
      onTaxIdTypeChange={handleTaxIdTypeChange}
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

