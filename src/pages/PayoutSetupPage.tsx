import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckIcon, ClockIcon, DocumentTextIcon, IdentificationIcon, BuildingLibraryIcon, CreditCardIcon } from '@heroicons/react/24/solid'
import { ArrowRightIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import supabase from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import W9FormSignNow from '../components/payout/W9FormSignNow'
import VeriffKYCStep from '../components/payout/VeriffKYCStep'
import MoovOnboardingStep from '../components/payout/MoovOnboardingStep'
import PlaidBankStep from '../components/payout/PlaidBankStep'

const STEPS = [
  { 
    id: 0, 
    name: 'Get Started', 
    description: 'Overview',
    icon: ClockIcon,
    timeEstimate: null
  },
  { 
    id: 1, 
    name: 'W-9 Form', 
    description: 'Tax information',
    icon: DocumentTextIcon,
    timeEstimate: '2-3 minutes'
  },
  { 
    id: 2, 
    name: 'ID Verification', 
    description: 'Verify your identity',
    icon: IdentificationIcon,
    timeEstimate: '3-5 minutes'
  },
  { 
    id: 3, 
    name: 'Payment Account', 
    description: 'Account setup',
    icon: BuildingLibraryIcon,
    timeEstimate: '2-3 minutes'
  },
  { 
    id: 4, 
    name: 'Bank Account', 
    description: 'Link your bank',
    icon: CreditCardIcon,
    timeEstimate: '1-2 minutes'
  },
]

const PayoutSetupPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [talentId, setTalentId] = useState<string | null>(null)
  const [moovAccountId, setMoovAccountId] = useState<string | null>(null)
  const [prefillData, setPrefillData] = useState<any>(null)
  const [processingComplete, setProcessingComplete] = useState(false)

  // Load progress on mount
  useEffect(() => {
    loadProgress()
  }, [user])

  const loadProgress = async () => {
    try {
      if (!user?.id) {
        navigate('/login')
        return
      }

      const { data: talent, error } = await supabase
        .from('talent_profiles')
        .select('id, payout_onboarding_step, payout_onboarding_completed, moov_account_id, full_name')
        .eq('user_id', user.id)
        .single()

      if (error) {
        console.error('Error loading talent:', error)
        toast.error('Could not load your profile')
        navigate('/dashboard')
        return
      }

      if (talent) {
        // If already completed, redirect to dashboard
        if (talent.payout_onboarding_completed) {
          toast.success('Payout setup already completed!')
          navigate('/dashboard')
          return
        }

        setTalentId(talent.id)
        setMoovAccountId(talent.moov_account_id)
        
        // Resume from saved step (0 = intro, 1-4 = actual steps)
        const savedStep = talent.payout_onboarding_step || 0
        setCurrentStep(savedStep)
        
        // Mark previous steps as completed
        const completed = []
        for (let i = 1; i < savedStep; i++) {
          completed.push(i)
        }
        setCompletedSteps(completed)

        // Load user data for prefill
        const { data: userData } = await supabase
          .from('users')
          .select('full_name, phone')
          .eq('id', user.id)
          .single()

        setPrefillData({
          fullName: talent.full_name || userData?.full_name || '',
          phone: userData?.phone || '',
          email: user.email || ''
        })
      }
    } catch (error) {
      console.error('Error loading progress:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateProgress = async (step: number) => {
    try {
      if (!user?.id) return

      await supabase
        .from('talent_profiles')
        .update({ payout_onboarding_step: step })
        .eq('user_id', user.id)
    } catch (error) {
      console.error('Error updating progress:', error)
    }
  }

  const handleStartSetup = async () => {
    setCurrentStep(1)
    await updateProgress(1)
  }

  const handleW9Complete = async () => {
    setCompletedSteps(prev => [...prev, 1])
    setCurrentStep(2)
    await updateProgress(2)
    toast.success('W-9 completed successfully!')
  }

  const handleVeriffComplete = async () => {
    setCompletedSteps(prev => [...prev, 2])
    setCurrentStep(3)
    await updateProgress(3)
    toast.success('Identity verification complete!')
  }

  const handleMoovComplete = async (accountId: string) => {
    setMoovAccountId(accountId)
    setCompletedSteps(prev => [...prev, 3])
    setCurrentStep(4)
    await updateProgress(4)
    toast.success('Payment account verified!')
  }

  const handlePlaidComplete = async () => {
    setProcessingComplete(true)
    try {
      const { error } = await supabase
        .from('talent_profiles')
        .update({
          payout_onboarding_step: 5,
          payout_onboarding_completed: true,
          bank_account_linked: true
        })
        .eq('user_id', user?.id)

      if (error) throw error

      setCompletedSteps(prev => [...prev, 4])

      // Trigger processing of any pending payout batches
      if (talentId) {
        try {
          const { data: batchResult, error: batchError } = await supabase.functions.invoke(
            'moov-process-pending-batches',
            { body: { talentId } }
          )
          
          if (batchError) {
            console.error('Error processing pending batches:', batchError)
          } else if (batchResult?.processedCount > 0) {
            toast.success(`Processing ${batchResult.processedCount} pending payout(s)!`, { duration: 5000 })
          }
        } catch (batchErr) {
          console.error('Batch processing error (non-blocking):', batchErr)
        }
      }

      toast.success('Payout setup complete! 🎉')
      
      setTimeout(() => {
        navigate('/dashboard')
      }, 2000)
      
    } catch (error: any) {
      console.error('Error completing onboarding:', error)
      toast.error(error.message || 'Failed to complete setup')
      setProcessingComplete(false)
    }
  }

  const isStepCompleted = (step: number) => completedSteps.includes(step)
  const isStepCurrent = (step: number) => currentStep === step

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mb-4"></div>
          <p className="text-gray-300">Loading your progress...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Payout Setup</h1>
              <p className="text-gray-400 mt-1">Complete these steps to start receiving payments</p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-[300px,1fr] gap-8">
          {/* Sidebar - Progress Steps */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Your Progress</h3>
              <nav className="space-y-2">
                {STEPS.map((step, index) => {
                  const Icon = step.icon
                  const isCompleted = isStepCompleted(step.id)
                  const isCurrent = isStepCurrent(step.id)
                  const isAccessible = step.id <= currentStep
                  
                  return (
                    <div
                      key={step.id}
                      className={`
                        flex items-center gap-4 p-3 rounded-xl transition-all duration-200
                        ${isCurrent ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30' : ''}
                        ${isCompleted ? 'opacity-70' : ''}
                        ${!isAccessible && !isCompleted ? 'opacity-40' : ''}
                      `}
                    >
                      <div className={`
                        flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                        ${isCompleted ? 'bg-green-500' : isCurrent ? 'bg-gradient-to-r from-pink-500 to-purple-500' : 'bg-white/10'}
                      `}>
                        {isCompleted ? (
                          <CheckIcon className="w-5 h-5 text-white" />
                        ) : (
                          <Icon className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${isCurrent ? 'text-white' : 'text-gray-300'}`}>
                          {step.name}
                        </p>
                        <p className="text-sm text-gray-500 truncate">{step.description}</p>
                      </div>
                      {step.timeEstimate && !isCompleted && (
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          ~{step.timeEstimate}
                        </span>
                      )}
                    </div>
                  )
                })}
              </nav>

              {/* Save Progress Note */}
              <div className="mt-6 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <p className="text-sm text-blue-300">
                  <strong>💡 Tip:</strong> Your progress is automatically saved. You can leave and come back anytime to continue where you left off.
                </p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: '#ffffff' }}>
            {/* Step 0: Introduction */}
            {currentStep === 0 && (
              <div className="p-8 lg:p-12" style={{ backgroundColor: '#ffffff' }}>
                <div className="max-w-2xl mx-auto text-center">
                  <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-8">
                    <CreditCardIcon className="w-10 h-10 text-white" />
                  </div>
                  
                  <h2 className="text-3xl font-bold mb-4" style={{ color: '#111827' }}>
                    Let's Set Up Your Payouts
                  </h2>
                  <p className="text-lg mb-8" style={{ color: '#4b5563' }}>
                    To receive payments for your ShoutOut videos, we need to verify your identity and connect your bank account. This process takes about <strong>10-15 minutes</strong> total.
                  </p>

                  {/* Steps Overview */}
                  <div className="grid sm:grid-cols-2 gap-4 mb-10 text-left">
                    {STEPS.filter(s => s.id > 0).map((step) => {
                      const Icon = step.icon
                      return (
                        <div key={step.id} className="flex items-start gap-4 p-4 rounded-xl" style={{ backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-semibold" style={{ color: '#111827' }}>{step.name}</h4>
                            <p className="text-sm" style={{ color: '#4b5563' }}>{step.description}</p>
                            {step.timeEstimate && (
                              <p className="text-xs font-medium mt-1" style={{ color: '#db2777' }}>~{step.timeEstimate}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Important Notes */}
                  <div className="rounded-xl p-6 mb-8 text-left" style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
                    <h4 className="font-semibold mb-3" style={{ color: '#92400e' }}>📋 Before You Start</h4>
                    <ul className="text-sm space-y-2" style={{ color: '#b45309' }}>
                      <li>• Have your <strong>government-issued ID</strong> (driver's license or passport) ready</li>
                      <li>• Know your <strong>Social Security Number (SSN)</strong> or <strong>Employer Identification Number (EIN)</strong> for tax purposes</li>
                      <li>• Have your <strong>bank account login</strong> credentials handy</li>
                      <li>• Some steps may require <strong>verification time</strong> (usually instant, sometimes up to 24 hours)</li>
                    </ul>
                  </div>

                  {/* Continue Later Note */}
                  <div className="rounded-xl p-4 mb-8" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                    <p className="text-sm" style={{ color: '#1d4ed8' }}>
                      <strong>Don't have time right now?</strong> No problem! Your progress is saved automatically. You can start now and finish later.
                    </p>
                  </div>

                  <button
                    onClick={handleStartSetup}
                    className="inline-flex items-center gap-3 px-8 py-4 text-lg font-semibold text-white rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-xl"
                    style={{ background: 'linear-gradient(135deg, #ff006e 0%, #8338ec 50%, #3a86ff 100%)' }}
                  >
                    <span>Start Payout Setup</span>
                    <ArrowRightIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: W-9 Form */}
            {currentStep === 1 && talentId && (
              <div className="p-8">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">W-9 Tax Form</h3>
                  <p className="text-gray-600">
                    Complete your W-9 form for tax reporting purposes. This is required by the IRS for all payments over $600/year. You can use a SSN or an EIN to sign this if you'd rather use a business.
                  </p>
                </div>
                <W9FormSignNow
                  talentId={talentId}
                  onComplete={handleW9Complete}
                />
              </div>
            )}

            {/* Step 2: Veriff KYC */}
            {currentStep === 2 && talentId && (
              <div className="p-8">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Identity Verification</h3>
                  <p className="text-gray-600">
                    Verify your identity using Veriff. You'll need to take a photo of your ID and a selfie. This helps us comply with KYC (Know Your Customer) regulations.
                  </p>
                </div>
                <VeriffKYCStep
                  talentId={talentId}
                  onComplete={handleVeriffComplete}
                />
              </div>
            )}

            {/* Step 3: Moov Account */}
            {currentStep === 3 && (
              <div className="p-8">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Payment Account Setup</h3>
                  <p className="text-gray-600">
                    Create your secure payment account with Moov. This enables us to send payments directly to your bank.
                  </p>
                </div>
                <MoovOnboardingStep
                  onComplete={handleMoovComplete}
                  prefillData={prefillData}
                  existingMoovId={moovAccountId}
                />
              </div>
            )}

            {/* Step 4: Plaid Bank Link */}
            {currentStep === 4 && (
              <div className="p-8">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Link Your Bank Account</h3>
                  <p className="text-gray-600">
                    Securely connect your bank account via Plaid. This is where we'll deposit your earnings.
                  </p>
                </div>
                <PlaidBankStep
                  onComplete={handlePlaidComplete}
                  moovAccountId={moovAccountId}
                  isLoading={processingComplete}
                />
              </div>
            )}

            {/* Loading state for step 1 when talentId not ready */}
            {currentStep === 1 && !talentId && (
              <div className="flex items-center justify-center py-24">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PayoutSetupPage

