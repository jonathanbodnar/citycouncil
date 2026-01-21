import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import supabase from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'

interface VeriffKYCStepProps {
  talentId: string
  onComplete: () => void
}

const VeriffKYCStep: React.FC<VeriffKYCStepProps> = ({ talentId, onComplete }) => {
  const { user } = useAuth()
  const [sessionId, setSessionId] = useState<string>('')
  const [sessionUrl, setSessionUrl] = useState<string>('')
  const [verificationCode, setVerificationCode] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [checkingStatus, setCheckingStatus] = useState(false)

  useEffect(() => {
    createSession()
    
    // Poll for verification status every 5 seconds
    const interval = setInterval(checkVerificationStatus, 5000)
    
    // Listen for postMessage from the Veriff popup when it completes
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'veriff-complete') {
        console.log('Received veriff-complete message from popup')
        // Immediately check verification status
        checkVerificationStatus()
      }
    }
    
    window.addEventListener('message', handleMessage)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  const createSession = async (forceNew: boolean = false) => {
    try {
      setLoading(true)
      setError('')

      // Check if session already exists
      const { data: existingSession } = await supabase
        .from('veriff_sessions')
        .select('session_id, session_url, verification_code, status, created_at')
        .eq('talent_id', talentId)
        .maybeSingle()

      if (existingSession && existingSession.status === 'approved') {
        toast.success('Identity verification already complete!')
        onComplete()
        return
      }

      // Check if existing session is still valid (less than 7 days old) and not forcing new
      if (!forceNew && existingSession && existingSession.status !== 'approved' && existingSession.session_url) {
        const createdAt = new Date(existingSession.created_at)
        const now = new Date()
        const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
        
        // Veriff sessions expire after 7 days, but let's be safe and create new one after 5 days
        if (daysSinceCreation < 5) {
          // Reuse existing session
          setSessionId(existingSession.session_id)
          setSessionUrl(existingSession.session_url)
          setVerificationCode(existingSession.verification_code || '')
          setLoading(false)
          return
        }
        // Session is old, fall through to create new one
        console.log('Existing Veriff session expired, creating new one...')
      }

      // Create new session via edge function
      const { data, error: invokeError } = await supabase.functions.invoke(
        'veriff-create-session',
        {
          body: { talentId }
        }
      )

      if (invokeError) {
        throw new Error(invokeError.message)
      }

      if (data.error) {
        console.error('Edge function error details:', data)
        throw new Error(data.error)
      }

      console.log('Veriff session created successfully:', data)
      
      setSessionId(data.sessionId)
      setSessionUrl(data.sessionUrl)
      setVerificationCode(data.verificationCode)
      setLoading(false)
    } catch (err: any) {
      console.error('Error creating Veriff session:', err)
      setError(err.message || 'Failed to create verification session')
      toast.error('Failed to load identity verification')
      setLoading(false)
    }
  }

  const checkVerificationStatus = async () => {
    if (!talentId || checkingStatus) return

    try {
      setCheckingStatus(true)

      const { data: session } = await supabase
        .from('veriff_sessions')
        .select('status')
        .eq('talent_id', talentId)
        .maybeSingle()

      if (session?.status === 'approved') {
        toast.success('Identity verification approved!')
        onComplete()
      } else if (session?.status === 'declined') {
        toast.error('Identity verification was declined. Please try again.')
        setError('Verification declined. Please start a new verification.')
      }
    } catch (err) {
      console.error('Error checking verification status:', err)
    } finally {
      setCheckingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Preparing identity verification...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h3 className="text-red-600 font-semibold text-lg mb-2">Error</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => createSession()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-purple-500/50 rounded-lg p-6">
        <h3 className="text-white font-semibold text-lg mb-2">📸 Identity Verification Required</h3>
        <p className="text-gray-300 text-sm mb-3">
          To comply with KYC (Know Your Customer) regulations, we need to verify your identity using Veriff.
        </p>
        <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
          <li>Have your government-issued ID ready (passport, driver's license, or national ID)</li>
          <li>Ensure you're in a well-lit area</li>
          <li>Follow the on-screen instructions carefully</li>
          <li>The process takes about 2-5 minutes</li>
        </ul>
      </div>

      {/* Verification Code */}
      {verificationCode && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-2">Your Verification Code:</p>
          <code className="text-2xl font-bold text-gray-900 tracking-wider">{verificationCode}</code>
          <p className="text-xs text-gray-500 mt-2">You may be asked for this code during verification</p>
        </div>
      )}

      {/* Open Veriff Button */}
      <div className="flex flex-col items-center justify-center py-8">
        <div className="mb-6">
          <svg className="w-24 h-24 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        
        <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready to Verify</h3>
        
        <p className="text-gray-600 text-center max-w-md mb-8">
          Click the button below to start your identity verification with Veriff.
        </p>
        
        <button
          onClick={() => window.open(sessionUrl, '_blank', 'width=800,height=900')}
          className="px-8 py-4 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl mb-4"
          style={{ background: 'linear-gradient(135deg, #ff006e 0%, #8338ec 50%, #3a86ff 100%)' }}
        >
          Start Verification
        </button>
        
        <p className="text-sm text-gray-500 text-center max-w-md">
          After completing verification, this page will automatically detect completion and move to the next step.
        </p>
        
        {/* Status indicator */}
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mt-6">
          <div className="animate-pulse h-2 w-2 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full"></div>
          <span>Waiting for verification completion...</span>
        </div>
        
        {/* Session expired? Start new one */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center mb-3">
            Session expired or having issues?
          </p>
          <button
            onClick={() => createSession(true)}
            className="text-sm text-blue-600 hover:text-blue-700 underline"
          >
            Start New Verification Session
          </button>
        </div>
      </div>
    </div>
  )
}

export default VeriffKYCStep

