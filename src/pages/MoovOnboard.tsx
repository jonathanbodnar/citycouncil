import React, { useState } from 'react'
import toast from 'react-hot-toast'
import supabase from '../services/supabase'

type Props = {}

const MoovOnboard = (props: Props) => {
  const [accountId, setAccountId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '', // 10 digits
    addressLine1: '',
    city: '',
    stateOrProvince: '', // 2 chars
    postalCode: '',
    month: '', // 2 digits
    day: '', // 2 digits
    year: '', // 4 digits
    ssn: '', // 9 digits
  })

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const toastId = 'moov-create'
    toast.loading('Creating & verifying Moov account...', { id: toastId })

    try {
      const { data, error } = await supabase.functions.invoke('moov-create-account', {
        body: form
      })

      if (error) throw error as any

      if (data?.accountID) {
        toast.success(`Account created! ID: ${data.accountID}`, { id: toastId })
        console.log('Moov account created:', data)
        setAccountId(data.accountID)
      } else {
        throw new Error('Failed to get accountID from response')
      }
    } catch (err: any) {
      console.error('Failed to create Moov account:', err)
      toast.error(err.message || 'Failed to create account', { id: toastId })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  // --- STYLING (with the fix) ---

  // 1. ⭐ THE FIX: An inline style object to force the style of the email field on ALL inputs.
  const inputFixStyle = {
    color: '#E5E7EB', // Light text color (Tailwind's `text-gray-200`)
    backgroundColor: '#374151', // Dark background (Tailwind's `bg-gray-700`)
    border: '1px solid #4B5563', // Darker border (Tailwind's `border-gray-600`)
    borderRadius: '0.375rem', // `rounded-md`
    padding: '0.75rem', // `p-3`
    width: '100%', // `w-full`
  }

  // 2. We remove the 'className' from the inputs and just use the style object.
  const labelStyle = 'block text-sm font-medium text-gray-200 mb-1'

  return (
    // 3. Using dark background colors to match your screenshot
    <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      {!accountId ? (
        <form onSubmit={handleCreateAccount} className='max-w-md w-full space-y-6 bg-gray-800 p-8 rounded-lg shadow-xl'>
          <h3 className='text-3xl font-extrabold text-white text-center mb-6'>Onboard New Talent</h3>
          <p className="text-center text-sm text-gray-300 mb-8">
            Please provide your details to create and verify your Moov account.
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="firstName" className={labelStyle}>First Name</label>
              {/* Apply the fix here */}
              <input style={inputFixStyle} id="firstName" name="firstName" value={form.firstName} onChange={handleFormChange} placeholder="John" required />
            </div>
            <div>
              <label htmlFor="lastName" className={labelStyle}>Last Name</label>
              {/* Apply the fix here */}
              <input style={inputFixStyle} id="lastName" name="lastName" value={form.lastName} onChange={handleFormChange} placeholder="Doe" required />
            </div>
            <div>
              <label htmlFor="email" className={labelStyle}>Email Address</label>
              {/* Apply the fix here */}
              <input style={inputFixStyle} id="email" name="email" type="email" value={form.email} onChange={handleFormChange} placeholder="john.doe@example.com" required />
            </div>
            <div>
              <label htmlFor="phone" className={labelStyle}>Phone Number</label>
              {/* Apply the fix here */}
              <input style={inputFixStyle} id="phone" name="phone" value={form.phone} onChange={handleFormChange} placeholder="5551234567 (10 digits)" maxLength={10} required />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-gray-700">
            <h4 className="text-xl font-semibold text-white">Address</h4>
            <div>
              <label htmlFor="addressLine1" className={labelStyle}>Address Line 1</label>
              <input style={inputFixStyle} id="addressLine1" name="addressLine1" value={form.addressLine1} onChange={handleFormChange} placeholder="123 Main St" required />
            </div>
            <div>
              <label htmlFor="city" className={labelStyle}>City</label>
              <input style={inputFixStyle} id="city" name="city" value={form.city} onChange={handleFormChange} placeholder="Anytown" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="stateOrProvince" className={labelStyle}>State (2-letter code)</label>
                <input style={inputFixStyle} id="stateOrProvince" name="stateOrProvince" value={form.stateOrProvince} onChange={handleFormChange} placeholder="CA" maxLength={2} required />
              </div>
              <div>
                <label htmlFor="postalCode" className={labelStyle}>Postal Code</label>
                <input style={inputFixStyle} id="postalCode" name="postalCode" placeholder="90210" required />
              </div>
            </div>
          </div>
          
          <div className="space-y-4 pt-4 border-t border-gray-700">
            <h4 className="text-xl font-semibold text-white">Date of Birth</h4>
            <div className='grid grid-cols-3 gap-4'>
              <div>
                <label htmlFor="month" className={labelStyle}>Month</label>
                <input style={inputFixStyle} id="month" name="month" value={form.month} onChange={handleFormChange} placeholder="MM" maxLength={2} required />
              </div>
              <div>
                <label htmlFor="day" className={labelStyle}>Day</label>
                <input style={inputFixStyle} id="day" name="day" value={form.day} onChange={handleFormChange} placeholder="DD" maxLength={2} required />
              </div>
              <div>
                <label htmlFor="year" className={labelStyle}>Year</label>
                <input style={inputFixStyle} id="year" name="year" value={form.year} onChange={handleFormChange} placeholder="YYYY" maxLength={4} required />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-gray-700">
            <h4 className="text-xl font-semibold text-white">Social Security Number</h4>
            <div>
              <label htmlFor="ssn" className={labelStyle}>SSN (9 digits)</label>
              <input style={inputFixStyle} id="ssn" name="ssn" value={form.ssn} onChange={handleFormChange} placeholder="123456789" maxLength={9} required />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className='w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out disabled:bg-gray-400'
          >
            {isLoading ? 'Processing...' : 'Create & Verify Account'}
          </button>
        </form>
      ) : (
        <div className='max-w-md w-full bg-gray-800 p-8 rounded-lg shadow-xl text-center'>
          <h3 className='text-3xl font-extrabold text-white mb-4'>Account Created!</h3>
          <p className='text-lg text-gray-300 mb-2'>
            Your account ID is:
          </p>
          <code className='block bg-gray-700 p-3 rounded-md text-white break-all text-sm mb-6'>
            {accountId}
          </code>
          <p className='text-base text-gray-400'>
            The account is now being verified. You will receive updates via webhooks.
          </p>
        </div>
      )}
    </div>
  )
}

export default MoovOnboard