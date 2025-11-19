import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import supabase from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'

interface W9FormSignatureAPIProps {
  onComplete: () => void
  talentId: string
}

const W9FormSignatureAPI: React.FC<W9FormSignatureAPIProps> = ({ onComplete, talentId }) => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [envelopeId, setEnvelopeId] = useState<string>('')
  const [signingUrl, setSigningUrl] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [checkingStatus, setCheckingStatus] = useState(false)

  useEffect(() => {
    createEnvelope()
    
    // Poll for completion status
    const interval = setInterval(checkEnvelopeStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const createEnvelope = async () => {
    try {
      setLoading(true)
      setError('')

      // Check if envelope already exists
      const { data: existingEnvelope } = await supabase
        .from('w9_envelopes')
        .select('envelope_id, signing_url, status')
        .eq('talent_id', talentId)
        .maybeSingle()

      if (existingEnvelope && existingEnvelope.status === 'completed') {
        toast.success('W-9 already completed!')
        onComplete()
        return
      }

      if (existingEnvelope && existingEnvelope.status !== 'completed') {
        // Reuse existing envelope
        setEnvelopeId(existingEnvelope.envelope_id)
        setSigningUrl(existingEnvelope.signing_url)
        setLoading(false)
        return
      }

      // Create new envelope via edge function
      const { data, error: invokeError } = await supabase.functions.invoke(
        'signatureapi-create-w9-envelope',
        {
          body: { talentId }
        }
      )

      if (invokeError) {
        throw new Error(invokeError.message)
      }

      if (data.error) {
        console.error('Edge function error details:', data)
        throw new Error(data.error + (data.details ? `\n${data.details}` : ''))
      }

      setEnvelopeId(data.envelopeId)
      setSigningUrl(data.signingUrl)
      setLoading(false)
    } catch (err: any) {
      console.error('Error creating W-9 envelope:', err)
      setError(err.message || 'Failed to create W-9 signing session')
      toast.error('Failed to load W-9 form')
      setLoading(false)
    }
  }

  const checkEnvelopeStatus = async () => {
    if (!talentId || checkingStatus) return

    try {
      setCheckingStatus(true)

      const { data: envelope } = await supabase
        .from('w9_envelopes')
        .select('status')
        .eq('talent_id', talentId)
        .maybeSingle()

      if (envelope?.status === 'completed') {
        toast.success('W-9 completed successfully!')
        onComplete()
      }
    } catch (err) {
      console.error('Error checking envelope status:', err)
    } finally {
      setCheckingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-white text-lg">Loading W-9 form...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-6 max-w-md">
          <h3 className="text-red-400 font-semibold text-lg mb-2">Error Loading Form</h3>
          <p className="text-white mb-4">{error}</p>
          <button
            onClick={createEnvelope}
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
      <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-6">
        <h3 className="text-white font-semibold text-lg mb-2">📄 Complete Your W-9 Form</h3>
        <p className="text-gray-300 text-sm mb-3">
          Please fill out the official IRS Form W-9 below. This form is required for tax reporting purposes.
        </p>
        <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
          <li>Fill in all required fields directly on the form</li>
          <li>Sign using your mouse, trackpad, or touch screen</li>
          <li>Your information is encrypted and secure</li>
          <li>The completed form will be saved automatically</li>
        </ul>
      </div>

      {/* Embedded SignatureAPI iframe */}
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-white/20 overflow-hidden">
        <iframe
          src={signingUrl}
          className="w-full border-0"
          style={{ minHeight: '800px', height: '80vh' }}
          allow="camera; microphone"
          title="W-9 Form Signing"
        />
      </div>

      {/* Status indicator */}
      <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
        <div className="animate-pulse h-2 w-2 bg-blue-500 rounded-full"></div>
        <span>Waiting for form completion...</span>
      </div>
    </div>
  )
}

export default W9FormSignatureAPI

