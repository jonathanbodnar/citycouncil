import React, { useState, useEffect } from 'react'
import { CheckIcon } from '@heroicons/react/24/solid'
import toast from 'react-hot-toast'
import supabase from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import W9Form, { W9FormData } from './W9Form'
import MoovOnboardingStep from './MoovOnboardingStep'
import PlaidBankStep from './PlaidBankStep'

interface PayoutOnboardingWizardProps {
  onComplete: () => void
  onClose?: () => void
}

const STEPS = [
  { id: 1, name: 'W-9 Form', description: 'Tax information' },
  { id: 2, name: 'Moov Account', description: 'Identity verification' },
  { id: 3, name: 'Bank Account', description: 'Link your bank' },
]

const PayoutOnboardingWizard: React.FC<PayoutOnboardingWizardProps> = ({ onComplete, onClose }) => {
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [talentId, setTalentId] = useState<string | null>(null)
  const [moovAccountId, setMoovAccountId] = useState<string | null>(null)
  const [prefillData, setPrefillData] = useState<any>(null)

  // Load progress on mount
  useEffect(() => {
    loadProgress()
  }, [user])

  const loadProgress = async () => {
    try {
      if (!user?.id) return

      const { data: talent, error } = await supabase
        .from('talent_profiles')
        .select('id, payout_onboarding_step, moov_account_id, full_name')
        .eq('user_id', user.id)
        .single()

      if (error) throw error

      if (talent) {
        setTalentId(talent.id)
        setMoovAccountId(talent.moov_account_id)
        
        // Resume from saved step
        const savedStep = talent.payout_onboarding_step || 0
        if (savedStep > 0) {
          setCurrentStep(savedStep)
          // Mark previous steps as completed
          const completed = []
          for (let i = 1; i < savedStep; i++) {
            completed.push(i)
          }
          setCompletedSteps(completed)
        }

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

  const handleW9Submit = async (formData: W9FormData, signatureDataUrl: string) => {
    setLoading(true)
    try {
      // Submit W-9 to edge function for PDF generation
      const { data, error } = await supabase.functions.invoke('generate-w9-pdf', {
        body: {
          ...formData,
          signatureDataUrl,
          talentId
        }
      })

      if (error) throw error

      toast.success('W-9 submitted successfully!')
      
      // Mark step 1 as completed
      setCompletedSteps(prev => [...prev, 1])
      setCurrentStep(2)
      await updateProgress(2)
      
    } catch (error: any) {
      console.error('Error submitting W-9:', error)
      toast.error(error.message || 'Failed to submit W-9')
    } finally {
      setLoading(false)
    }
  }

  const handleMoovComplete = async (accountId: string) => {
    try {
      setMoovAccountId(accountId)
      
      // Mark step 2 as completed
      setCompletedSteps(prev => [...prev, 2])
      setCurrentStep(3)
      await updateProgress(3)
      
      toast.success('Moov account verified!')
    } catch (error) {
      console.error('Error completing Moov step:', error)
    }
  }

  const handlePlaidComplete = async () => {
    setLoading(true)
    try {
      // Update talent profile to mark onboarding as completed
      const { error } = await supabase
        .from('talent_profiles')
        .update({
          payout_onboarding_step: 4,
          payout_onboarding_completed: true,
          bank_account_linked: true
        })
        .eq('user_id', user?.id)

      if (error) throw error

      toast.success('Payout setup complete! 🎉')
      
      // Mark step 3 as completed
      setCompletedSteps(prev => [...prev, 3])
      
      // Call onComplete callback
      setTimeout(() => {
        onComplete()
      }, 1000)
      
    } catch (error: any) {
      console.error('Error completing onboarding:', error)
      toast.error(error.message || 'Failed to complete setup')
    } finally {
      setLoading(false)
    }
  }

  const isStepCompleted = (step: number) => completedSteps.includes(step)
  const isStepCurrent = (step: number) => currentStep === step
  const isStepAccessible = (step: number) => step <= currentStep

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen px-4 py-8 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 rounded-t-2xl">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Setup Payouts</h2>
                <p className="text-blue-100">Complete these steps to start receiving payments</p>
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Progress Steps */}
          <div className="px-8 py-6 border-b border-gray-200">
            <nav aria-label="Progress">
              <ol className="flex items-center justify-between">
                {STEPS.map((step, index) => (
                  <li key={step.id} className={`relative ${index !== STEPS.length - 1 ? 'flex-1' : ''}`}>
                    <div className="flex items-center">
                      <div className="flex items-center">
                        <button
                          onClick={() => isStepAccessible(step.id) && setCurrentStep(step.id)}
                          disabled={!isStepAccessible(step.id)}
                          className={`
                            relative flex h-12 w-12 items-center justify-center rounded-full
                            transition-all duration-200
                            ${isStepCompleted(step.id)
                              ? 'bg-green-600 text-white'
                              : isStepCurrent(step.id)
                              ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                              : isStepAccessible(step.id)
                              ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }
                          `}
                        >
                          {isStepCompleted(step.id) ? (
                            <CheckIcon className="h-6 w-6" />
                          ) : (
                            <span className="text-lg font-semibold">{step.id}</span>
                          )}
                        </button>
                        <div className="ml-3 text-left hidden sm:block">
                          <p className={`text-sm font-semibold ${isStepCurrent(step.id) ? 'text-blue-600' : 'text-gray-700'}`}>
                            {step.name}
                          </p>
                          <p className="text-xs text-gray-500">{step.description}</p>
                        </div>
                      </div>
                      
                      {/* Connector line */}
                      {index !== STEPS.length - 1 && (
                        <div className="hidden sm:block flex-1 mx-4">
                          <div className={`h-0.5 ${isStepCompleted(step.id) ? 'bg-green-600' : 'bg-gray-200'}`} />
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </nav>
          </div>

          {/* Step Content */}
          <div className="px-8 py-8 max-h-[calc(100vh-400px)] overflow-y-auto">
            {currentStep === 1 && (
              <div>
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Complete Your W-9</h3>
                  <p className="text-gray-600">
                    We need your tax information to issue 1099s at year-end. This information is encrypted and secure.
                  </p>
                </div>
                <W9Form
                  onSubmit={handleW9Submit}
                  initialData={prefillData ? {
                    name: prefillData.fullName,
                  } : undefined}
                  isLoading={loading}
                />
              </div>
            )}

            {currentStep === 2 && (
              <div>
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Verify Your Identity</h3>
                  <p className="text-gray-600">
                    Create your Moov account to verify your identity for payments.
                  </p>
                </div>
                <MoovOnboardingStep
                  onComplete={handleMoovComplete}
                  prefillData={prefillData}
                  existingMoovId={moovAccountId}
                />
              </div>
            )}

            {currentStep === 3 && (
              <div>
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Link Your Bank Account</h3>
                  <p className="text-gray-600">
                    Connect your bank account securely via Plaid to receive payouts.
                  </p>
                </div>
                <PlaidBankStep
                  onComplete={handlePlaidComplete}
                  moovAccountId={moovAccountId}
                  isLoading={loading}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PayoutOnboardingWizard

