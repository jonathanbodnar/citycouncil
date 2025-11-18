import React, { useState, useEffect } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import toast from 'react-hot-toast'
import supabase from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'

interface PlaidBankStepProps {
  onComplete: () => void
  moovAccountId: string | null
  isLoading?: boolean
}

const PlaidBankStep: React.FC<PlaidBankStepProps> = ({ onComplete, moovAccountId, isLoading }) => {
  const { user } = useAuth()
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [preparingLink, setPreparingLink] = useState(false)
  const [bankLinked, setBankLinked] = useState(false)

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      console.log('Plaid Link success:', { public_token, metadata })
      toast.loading('Connecting bank account...', { id: 'plaid-success' })
      
      try {
        // Exchange public token and link to Moov
        const { data, error } = await supabase.functions.invoke('moov-plaid-link-secure', {
          body: {
            publicToken: public_token,
            moovAccountId: moovAccountId,
            userId: user?.id,
            accountId: metadata.accounts?.[0]?.id,
            institutionName: metadata.institution?.name,
            accountName: metadata.accounts?.[0]?.name,
            accountMask: metadata.accounts?.[0]?.mask
          }
        })

        if (error) throw error

        toast.success('Bank account linked successfully!', { id: 'plaid-success' })
        setBankLinked(true)
        
        // Wait a moment before completing
        setTimeout(() => {
          onComplete()
        }, 1500)
        
      } catch (error: any) {
        console.error('Error linking bank:', error)
        toast.error(error.message || 'Failed to link bank account', { id: 'plaid-success' })
      }
    },
    onExit: (err, metadata) => {
      if (err) {
        console.error('Plaid Link error:', err)
        toast.error('Failed to connect bank account')
      }
    }
  })

  const preparePlaidLink = async () => {
    if (!moovAccountId) {
      toast.error('Please complete Moov account verification first')
      return
    }

    setPreparingLink(true)
    toast.loading('Preparing Plaid Link...', { id: 'plaid-link' })
    
    try {
      const { data, error } = await supabase.functions.invoke('moov-plaid-link-secure', {
        body: {
          action: 'create_link_token',
          moovAccountId: moovAccountId,
          userId: user?.id
        }
      })

      if (error) throw error

      if (data?.linkToken) {
        setLinkToken(data.linkToken)
        toast.success('Ready to connect bank', { id: 'plaid-link' })
      } else {
        throw new Error('No link token received')
      }
    } catch (error: any) {
      console.error('Error preparing Plaid:', error)
      toast.error(error.message || 'Failed to prepare bank connection', { id: 'plaid-link' })
    } finally {
      setPreparingLink(false)
    }
  }

  // Auto-prepare link on mount
  useEffect(() => {
    if (moovAccountId && !linkToken) {
      preparePlaidLink()
    }
  }, [moovAccountId])

  // Auto-open when ready
  useEffect(() => {
    if (ready && linkToken && !bankLinked) {
      open()
    }
  }, [ready, linkToken, open, bankLinked])

  if (!moovAccountId) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Moov Account Required</h3>
        <p className="text-gray-600">
          Please complete the Moov account verification step first before linking your bank.
        </p>
      </div>
    )
  }

  if (bankLinked) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Bank Account Linked!</h3>
        <p className="text-gray-600">
          Your bank account has been successfully connected. You're all set to receive payouts!
        </p>
      </div>
    )
  }

  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      </div>
      
      <h3 className="text-2xl font-bold text-gray-900 mb-4">Connect Your Bank Account</h3>
      
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        We use Plaid to securely connect your bank account. Your credentials are never stored on our servers.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md mx-auto mb-8">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div className="text-left">
            <h4 className="text-sm font-semibold text-blue-900 mb-1">Secure & Private</h4>
            <p className="text-xs text-blue-800">
              Plaid uses bank-level encryption. We never see your login credentials.
            </p>
          </div>
        </div>
      </div>

      {preparingLink ? (
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Preparing secure connection...</p>
        </div>
      ) : linkToken ? (
        <button
          onClick={() => open()}
          disabled={!ready || isLoading}
          className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {ready ? 'Connect Bank Account' : 'Loading...'}
        </button>
      ) : (
        <button
          onClick={preparePlaidLink}
          disabled={isLoading}
          className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Prepare Connection
        </button>
      )}

      <p className="text-xs text-gray-500 mt-6">
        By connecting your bank account, you agree to Plaid's Terms of Service
      </p>
    </div>
  )
}

export default PlaidBankStep

