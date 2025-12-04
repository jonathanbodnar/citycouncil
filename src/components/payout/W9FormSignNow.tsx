import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import supabase from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'

interface W9FormSignNowProps {
  talentId: string
  onComplete: () => void
}

const W9FormSignNow: React.FC<W9FormSignNowProps> = ({ talentId, onComplete }) => {
  const { user } = useAuth()
  const [documentId, setDocumentId] = useState<string>('')
  const [signingUrl, setSigningUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [checkingStatus, setCheckingStatus] = useState(false)

  useEffect(() => {
    createDocument()
    
    // Poll for completion status every 5 seconds
    const interval = setInterval(checkDocumentStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const createDocument = async () => {
    try {
      setLoading(true)
      setError('')

      // Check if document already exists
      const { data: existingDoc } = await supabase
        .from('w9_envelopes')
        .select('envelope_id, signing_url, status')
        .eq('talent_id', talentId)
        .maybeSingle()

      if (existingDoc && existingDoc.status === 'completed') {
        toast.success('W-9 already completed!')
        onComplete()
        return
      }

      if (existingDoc && existingDoc.status !== 'completed' && existingDoc.signing_url) {
        // Reuse existing document
        setDocumentId(existingDoc.envelope_id)
        setSigningUrl(existingDoc.signing_url)
        setLoading(false)
        return
      }

      // Get current session for auth header
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      if (!accessToken) {
        throw new Error('Not logged in - please refresh the page and try again')
      }

      // Create new document via edge function with explicit auth
      const { data, error: invokeError } = await supabase.functions.invoke(
        'signnow-create-w9-invite',
        {
          body: { talentId },
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )

      if (invokeError) {
        throw new Error(invokeError.message)
      }

      if (data.error) {
        console.error('Edge function error details:', data)
        throw new Error(data.error)
      }

      console.log('Document created successfully:', data)
      console.log('Signing URL:', data.signingUrl)
      
      setDocumentId(data.documentId)
      setSigningUrl(data.signingUrl)
      setLoading(false)
    } catch (err: any) {
      console.error('Error creating W-9 document:', err)
      setError(err.message || 'Failed to create W-9 signing session')
      toast.error('Failed to load W-9 form')
      setLoading(false)
    }
  }

  const checkDocumentStatus = async () => {
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
      console.error('Error checking document status:', err)
    } finally {
      setCheckingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gradient-to-r from-pink-500 to-purple-600 mb-4"></div>
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
            onClick={createDocument}
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
        <h3 className="text-white font-semibold text-lg mb-2">📄 Complete Your W-9 Form</h3>
        <p className="text-gray-300 text-sm mb-3">
          Please fill out the official IRS Form W-9 below. This form is required for tax reporting purposes.
        </p>
        <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
          <li>Fill in all required fields directly on the form</li>
          <li>Sign using your mouse, trackpad, or touch screen</li>
          <li>Your information is encrypted and secure</li>
          <li>Click "Finish" when done to proceed to the next step</li>
        </ul>
      </div>

      {/* Open SignNow in new window */}
      <div className="flex flex-col items-center justify-center py-12">
        <div className="mb-8">
          <svg className="w-24 h-24 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-4">W-9 Form Ready</h3>
        
        <p className="text-gray-300 text-center max-w-md mb-8">
          Click the button below to open your W-9 form in a new window. Fill it out, sign it, and click "Finish" to complete this step.
        </p>
        
        <button
          onClick={() => window.open(signingUrl, '_blank', 'width=1200,height=800')}
          className="px-8 py-4 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl mb-4"
          style={{ background: 'linear-gradient(135deg, #ff006e 0%, #8338ec 50%, #3a86ff 100%)' }}
        >
          Open W-9 Form
        </button>
        
        <button
          onClick={async () => {
            // Manually mark as complete and move to next step
            try {
              const { error } = await supabase
                .from('w9_envelopes')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('talent_id', talentId)
              
              if (error) throw error
              
              toast.success('W-9 marked as complete!')
              onComplete()
            } catch (err: any) {
              console.error('Error marking W-9 complete:', err)
              toast.error('Failed to mark as complete')
            }
          }}
          className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg transition-all duration-200 hover:bg-green-700 mb-4"
        >
          I've Completed the W-9
        </button>
        
        <p className="text-sm text-gray-400 text-center max-w-md">
          After completing the form in the popup window, click "I've Completed the W-9" above to continue.
        </p>
        
        {/* Status indicator */}
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mt-6">
          <div className="animate-pulse h-2 w-2 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full"></div>
          <span>Waiting for form completion...</span>
        </div>
      </div>
    </div>
  )
}

export default W9FormSignNow

