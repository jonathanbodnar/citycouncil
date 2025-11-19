import React, { useState, useEffect } from 'react'
import {
  BanknotesIcon,
  CreditCardIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { Payout, VendorBankInfo } from '../types'
import toast from 'react-hot-toast'
import PayoutOnboardingWizard from './payout/PayoutOnboardingWizard'

interface PayoutWithOrder extends Payout {
  orders: {
    id: string
    request_details: string
    created_at: string
    amount: number
  }
}

const PayoutsDashboard: React.FC = () => {
  const { user } = useAuth()
  const [payouts, setPayouts] = useState<PayoutWithOrder[]>([])
  const [bankInfo, setBankInfo] = useState<VendorBankInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [moovAccountId, setMoovAccountId] = useState<string | null>(null)
  const [isLinkingBank, setIsLinkingBank] = useState(false)
  const [payoutsEnabled, setPayoutsEnabled] = useState(false)
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false)
  const [payoutOnboardingCompleted, setPayoutOnboardingCompleted] = useState(false)

  useEffect(() => {
    if (user?.user_type === 'talent') {
      fetchPayoutData()
      fetchPayoutsEnabledSetting()
    }
  }, [user])

  const fetchPayoutsEnabledSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'payouts_enabled')
        .single()

      if (error) throw error
      setPayoutsEnabled(data?.setting_value === 'true')
    } catch (error) {
      console.error('Error fetching payouts enabled setting:', error)
      // Default to false if setting doesn't exist
      setPayoutsEnabled(false)
    }
  }

  const fetchPayoutData = async () => {
    try {
      setLoading(true)

      // Get talent profile to get talent ID and moov account id
      const { data: talentProfile } = await supabase
        .from('talent_profiles')
        .select('id, moov_account_id, payout_onboarding_completed, bank_account_linked')
        .eq('user_id', user?.id)
        .single()

      if (!talentProfile) return

      const currentMoovId = talentProfile.moov_account_id || null
      setMoovAccountId(currentMoovId)
      setPayoutOnboardingCompleted(talentProfile.payout_onboarding_completed || false)

      // Fetch payouts
      const { data: payoutsData, error: payoutsError } = await supabase
        .from('payouts')
        .select(
          `
          *,
          orders (
            id,
            request_details,
            created_at,
            amount
          )
        `
        )
        .eq('talent_id', talentProfile.id)
        .order('created_at', { ascending: false })

      if (payoutsError) throw payoutsError
      setPayouts(payoutsData || [])

      if (currentMoovId) {
        const { data: banksData, error: banksError } =
          await supabase.functions.invoke(
            'moov-list-bank-accounts',
            { body: { moovAccountId: currentMoovId } } 
          )

        if (banksError) throw banksError

        if (banksData && banksData.length > 0) {
          console.log(banksData, 'banksData')
          const latestBank = banksData?.length - 1
          const moovBank = banksData[latestBank] 
          console.log(moovBank.lastFourAccountNumber, 'banksData')
          const bankInfoForDisplay: VendorBankInfo = {
            id: moovBank.bankAccountID,
            talent_id: talentProfile.id, // From our profile query
            account_holder_name: moovBank.holderName,
            bank_name: moovBank.bankName,
            account_type: moovBank.bankAccountType,
            account_number_masked: `****${moovBank.lastFourAccountNumber}`,
            is_verified: moovBank.status === 'verified',
            routing_number: moovBank.routingNumber,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          setBankInfo(bankInfoForDisplay)
        } else {
          setBankInfo(null) // No banks found
        }
      } else {
        setBankInfo(null) // No moov account
      }
      // --- END OF NEW LOGIC ---
    } catch (error) {
      console.error('Error fetching payout data:', error)
      toast.error('Failed to load payout information')
    } finally {
      setLoading(false)
    }
  }

  const linkBankViaPlaid = async () => {
    try {
      if (isLinkingBank) return
      setIsLinkingBank(true)
      // Ensure Moov account exists
      const { data: talentProfile, error: tpErr } = await supabase
        .from('talent_profiles')
        .select('id, moov_account_id')
        .eq('user_id', user?.id)
        .single()
      if (tpErr) throw tpErr
      if (!talentProfile) throw new Error('Talent profile not found')
      const accountId = talentProfile.moov_account_id || moovAccountId
      if (!accountId) {
        toast.error('Please create your Moov account before linking your bank.')
        return
      }

      // Create Plaid Link token
      toast.loading('Preparing Plaid Link…', { id: 'plaid-link' })
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth?.user?.id || user?.id
      if (!uid) throw new Error('Not authenticated')
      const { data: tokenResp, error: tokenErr } =
        await supabase.functions.invoke('plaid-create-link-token', {
          body: { userId: uid }
        })
      if (tokenErr) throw tokenErr
      const linkToken = (tokenResp as any)?.link_token
      if (!linkToken) throw new Error('Missing Plaid link_token')

      // Load Plaid script if needed
      const loadPlaidScript = () =>
        new Promise<void>((resolve, reject) => {
          if ((window as any).Plaid) return resolve()
          const s = document.createElement('script')
          s.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'
          s.async = true
          s.onload = () => resolve()
          s.onerror = () => reject(new Error('Failed to load Plaid Link'))
          document.body.appendChild(s)
        })

      await loadPlaidScript()

      const handler = (window as any).Plaid.create({
        token: linkToken,
        onSuccess: async (public_token: string, metadata: any) => {
          try {
            const selectedAccountId =
              metadata?.accounts?.[0]?.id || metadata?.account_id
            if (!selectedAccountId) throw new Error('No account selected')

            toast.loading('Linking your bank to Moov…', { id: 'plaid-link' })
            const { error: linkErr } = await supabase.functions.invoke(
              'moov-plaid-link-account',
              {
                body: {
                  public_token,
                  account_id: selectedAccountId,
                  moov_account_id: accountId
                }
              }
            )
            if (linkErr) throw linkErr

            toast.success('Bank linked successfully!', { id: 'plaid-link' })
            fetchPayoutData()
            setIsLinkingBank(false)
          } catch (err: any) {
            console.error('Plaid/Moov link error:', err)
            toast.error(err?.message || 'Failed to link bank account', {
              id: 'plaid-link'
            })
            setIsLinkingBank(false)
          }
        },
        onExit: () => {
          toast.dismiss('plaid-link')
          setIsLinkingBank(false)
        }
      })

      handler.open()
    } catch (error: any) {
      console.error('Plaid Link init error:', error)
      toast.error(error?.message || 'Failed to start Plaid Link', {
        id: 'plaid-link'
      })
      setIsLinkingBank(false)
    }
  }

  const exportPayouts = () => {
    if (payouts.length === 0) {
      toast.error('No payouts to export')
      return
    }

    // Create CSV content
    const headers = [
      'Date',
      'Order ID',
      'Description',
      'Amount',
      'Status',
      'Processed Date'
    ]
    const csvContent = [
      headers.join(','),
      ...payouts.map(payout =>
        [
          new Date(payout.created_at).toLocaleDateString(),
          payout.order_id,
          `"${payout.orders.request_details.substring(0, 50)}..."`,
          `$${payout.payout_amount.toFixed(2)}`,
          payout.status,
          payout.updated_at
            ? new Date(payout.updated_at).toLocaleDateString()
            : 'N/A'
        ].join(',')
      )
    ].join('\n')

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payouts_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    toast.success('Payouts exported successfully')
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <CheckCircleIcon className='h-5 w-5 text-green-500' />
      case 'failed':
        return <XCircleIcon className='h-5 w-5 text-red-500' />
      case 'pending':
        return <ClockIcon className='h-5 w-5 text-yellow-500' />
      default:
        return <ClockIcon className='h-5 w-5 text-gray-500' />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const totalEarnings = payouts
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + p.payout_amount, 0)

  const pendingEarnings = payouts
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + p.payout_amount, 0)

  if (loading) {
    return (
      <div className='space-y-6'>
        <div className='animate-pulse'>
          <div className='h-8 bg-gray-200 rounded w-1/4 mb-6'></div>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'>
            {[1, 2, 3].map(i => (
              <div key={i} className='bg-gray-200 h-24 rounded-lg'></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-4 md:space-y-6 pb-20 md:pb-0'>
      {/* Onboarding Wizard Modal */}
      {showOnboardingWizard && (
        <PayoutOnboardingWizard
          onComplete={() => {
            setShowOnboardingWizard(false)
            setPayoutOnboardingCompleted(true)
            fetchPayoutData()
          }}
          onClose={() => setShowOnboardingWizard(false)}
        />
      )}

      <div className='flex flex-col md:flex-row md:justify-between md:items-center gap-3'>
        <h2 className='text-xl md:text-2xl font-bold text-gray-900'>Payouts</h2>
        <div className='flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center'>
          {!payoutOnboardingCompleted && (
            <button
              onClick={() => setShowOnboardingWizard(true)}
              disabled={!payoutsEnabled}
              className='flex h-12 md:h-14 text-center justify-center items-center gap-2 px-3 md:px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed font-semibold'
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className='whitespace-nowrap'>Setup Payouts</span>
            </button>
          )}

          {payoutOnboardingCompleted && (
          <button
            onClick={exportPayouts}
            className='flex h-12 md:h-14 text-center justify-center items-center gap-2 px-3 md:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm md:text-base'
          >
            <ArrowDownTrayIcon className='h-4 w-4' />
            <span className='whitespace-nowrap'>Export CSV</span>
          </button>
          )}
        </div>
      </div>

      {/* Onboarding Required Notice */}
      {payoutsEnabled && !payoutOnboardingCompleted && (
        <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
          <div className='flex items-start gap-3'>
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className='text-sm font-semibold text-blue-900 mb-1'>
                Complete Payout Setup
              </h3>
              <p className='text-sm text-blue-800'>
                To receive payouts, please complete the onboarding process. This includes submitting your W-9, verifying your identity, and linking your bank account.
              </p>
              <button
                onClick={() => setShowOnboardingWizard(true)}
                className='mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors'
              >
                Get Started →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payouts Disabled Notice */}
      {!payoutsEnabled && (
        <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4'>
          <div className='flex items-start gap-3'>
            <ClockIcon className='h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5' />
            <div>
              <h3 className='text-sm font-semibold text-yellow-900 mb-1'>
                Payouts Coming Soon
              </h3>
              <p className='text-sm text-yellow-800'>
                Payouts will be enabled before soft launch - all videos completed prior to launch will be paid out as soon as payouts are enabled.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6'>
        <div className='bg-white rounded-lg shadow-sm p-4 md:p-6'>
          <div className='flex items-center'>
            <BanknotesIcon className='h-6 w-6 md:h-8 md:w-8 text-green-500' />
            <div className='ml-3 md:ml-4'>
              <p className='text-xs md:text-sm text-gray-600'>Total Earnings</p>
              <p className='text-lg md:text-2xl font-bold text-gray-900'>
                ${totalEarnings.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className='bg-white rounded-lg shadow-sm p-4 md:p-6'>
          <div className='flex items-center'>
            <ClockIcon className='h-6 w-6 md:h-8 md:w-8 text-yellow-500' />
            <div className='ml-3 md:ml-4'>
              <p className='text-xs md:text-sm text-gray-600'>Pending</p>
              <p className='text-lg md:text-2xl font-bold text-gray-900'>
                ${pendingEarnings.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className='bg-white rounded-lg shadow-sm p-4 md:p-6'>
          <div className='flex items-center'>
            <CreditCardIcon className='h-6 w-6 md:h-8 md:w-8 text-blue-500' />
            <div className='ml-3 md:ml-4'>
              <p className='text-xs md:text-sm text-gray-600'>Total Payouts</p>
              <p className='text-lg md:text-2xl font-bold text-gray-900'>
                {payouts.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bank Information */}
      <div className='bg-white rounded-lg shadow-sm p-4 md:p-6'>
        <h3 className='text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4'>
          Bank Information
        </h3>
        {bankInfo && (
          <div className='flex items-center gap-2 mb-4 text-green-600'>
            <CheckCircleIcon className='h-5 w-5' />
            <span>Bank account linked successfully</span>
          </div>
        )}
        {bankInfo ? (
          <div className='bg-gray-50 rounded-lg p-3 md:p-4'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4'>
              <div>
                <p className='text-sm text-gray-600'>Account Holder</p>
                <p className='font-medium'>{bankInfo.account_holder_name}</p>
              </div>
              <div>
                <p className='text-sm text-gray-600'>Bank Name</p>
                <p className='font-medium'>{bankInfo.bank_name}</p>
              </div>
              <div>
                <p className='text-sm text-gray-600'>Account Number</p>
                <p className='font-medium font-mono'>
                  {bankInfo.account_number_masked ||
                    `****${bankInfo.account_number?.slice(-4) || ''}`}
                </p>
              </div>
              <div>
                <p className='text-sm text-gray-600'>Status</p>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    bankInfo.is_verified
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {bankInfo.is_verified ? 'Verified' : 'Pending Verification'}
                </span>
              </div>
            </div>
            <button
              onClick={linkBankViaPlaid}
              disabled={isLinkingBank || !payoutsEnabled}
              className={`mt-4 text-sm underline ${
                isLinkingBank || !payoutsEnabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              {isLinkingBank ? 'Opening…' : 'Add Another Bank Account'}
            </button>
          </div>
        ) : (
          <div className='text-center py-8'>
            <CreditCardIcon className='h-12 w-12 text-gray-400 mx-auto mb-4' />
            <p className='text-gray-600 mb-4'>No bank information on file</p>
            <button
              onClick={linkBankViaPlaid}
              disabled={isLinkingBank || !payoutsEnabled}
              className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isLinkingBank ? 'Opening Plaid…' : 'Link Bank via Plaid'}
            </button>
          </div>
        )}
      </div>

      {/* Payouts List */}
      <div className='bg-white rounded-lg shadow-sm'>
        <div className='px-4 md:px-6 py-3 md:py-4 border-b border-gray-200'>
          <h3 className='text-base md:text-lg font-semibold text-gray-900'>
            Payout History
          </h3>
        </div>

        {payouts.length > 0 ? (
          <div className='divide-y divide-gray-200'>
            {payouts.map(payout => (
              <div key={payout.id} className='p-4 md:p-6'>
                <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
                  <div className='flex items-center space-x-3'>
                    {getStatusIcon(payout.status)}
                    <div>
                      <p className='font-medium text-gray-900'>
                        Order #{payout.order_id.slice(-8)}
                      </p>
                      <p className='text-sm text-gray-600'>
                        {payout.orders.request_details.substring(0, 60)}...
                      </p>
                      <p className='text-xs text-gray-500'>
                        {new Date(payout.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className='text-right'>
                    <p className='font-semibold text-gray-900'>
                      ${payout.payout_amount.toFixed(2)}
                    </p>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                        payout.status
                      )}`}
                    >
                      {payout.status}
                    </span>
                    {payout.status === 'paid' && payout.updated_at && (
                      <p className='text-xs text-gray-500 mt-1'>
                        Processed{' '}
                        {new Date(payout.updated_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className='text-center py-12'>
            <BanknotesIcon className='h-12 w-12 text-gray-400 mx-auto mb-4' />
            <h3 className='text-lg font-medium text-gray-900 mb-2'>
              No payouts yet
            </h3>
            <p className='text-gray-600'>
              Payouts will appear here when orders are completed.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default PayoutsDashboard
