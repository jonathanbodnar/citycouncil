import React, { useRef, useState, useEffect } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import toast from 'react-hot-toast'

export interface W9FormData {
  name: string
  businessName: string
  taxClassification: 'individual' | 'c_corporation' | 's_corporation' | 'partnership' | 'trust_estate' | 'llc_c' | 'llc_s' | 'llc_p' | 'other'
  otherTaxClassification: string
  exemptPayeeCode: string
  exemptionFromFatcaCode: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
  taxId: string // SSN or EIN - NOT stored in DB, only used for PDF generation
  taxIdType: 'ssn' | 'ein'
}

interface W9FormProps {
  onSubmit: (data: W9FormData, signatureDataUrl: string) => Promise<void>
  initialData?: Partial<W9FormData>
  isLoading?: boolean
}

const W9Form: React.FC<W9FormProps> = ({ onSubmit, initialData, isLoading = false }) => {
  const signatureRef = useRef<SignatureCanvas>(null)
  const [formData, setFormData] = useState<W9FormData>({
    name: initialData?.name || '',
    businessName: initialData?.businessName || '',
    taxClassification: initialData?.taxClassification || 'individual',
    otherTaxClassification: initialData?.otherTaxClassification || '',
    exemptPayeeCode: initialData?.exemptPayeeCode || '',
    exemptionFromFatcaCode: initialData?.exemptionFromFatcaCode || '',
    addressLine1: initialData?.addressLine1 || '',
    addressLine2: initialData?.addressLine2 || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    zipCode: initialData?.zipCode || '',
    taxId: '',
    taxIdType: 'ssn'
  })

  const [signatureEmpty, setSignatureEmpty] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const clearSignature = () => {
    signatureRef.current?.clear()
    setSignatureEmpty(true)
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) newErrors.name = 'Name is required'
    if (!formData.addressLine1.trim()) newErrors.addressLine1 = 'Address is required'
    if (!formData.city.trim()) newErrors.city = 'City is required'
    if (!formData.state.trim()) newErrors.state = 'State is required'
    if (!/^\d{5}(-\d{4})?$/.test(formData.zipCode)) newErrors.zipCode = 'Invalid ZIP code'
    
    // Validate tax ID
    if (!formData.taxId.trim()) {
      newErrors.taxId = 'Tax ID is required'
    } else {
      const cleanTaxId = formData.taxId.replace(/\D/g, '')
      if (formData.taxIdType === 'ssn' && cleanTaxId.length !== 9) {
        newErrors.taxId = 'SSN must be 9 digits'
      } else if (formData.taxIdType === 'ein' && cleanTaxId.length !== 9) {
        newErrors.taxId = 'EIN must be 9 digits'
      }
    }

    if (formData.taxClassification === 'other' && !formData.otherTaxClassification.trim()) {
      newErrors.otherTaxClassification = 'Please specify tax classification'
    }

    if (signatureEmpty) {
      newErrors.signature = 'Signature is required'
      toast.error('Please sign the form')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error('Please fill in all required fields')
      return
    }

    const signatureDataUrl = signatureRef.current?.toDataURL() || ''
    
    await onSubmit(formData, signatureDataUrl)
  }

  const formatTaxId = (value: string, type: 'ssn' | 'ein'): string => {
    const cleaned = value.replace(/\D/g, '')
    if (type === 'ssn') {
      // Format: XXX-XX-XXXX
      if (cleaned.length <= 3) return cleaned
      if (cleaned.length <= 5) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5, 9)}`
    } else {
      // Format: XX-XXXXXXX
      if (cleaned.length <= 2) return cleaned
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 9)}`
    }
  }

  const handleTaxIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTaxId(e.target.value, formData.taxIdType)
    setFormData(prev => ({ ...prev, taxId: formatted }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Form W-9</h3>
        <p className="text-sm text-gray-700">
          Request for Taxpayer Identification Number and Certification
        </p>
        <p className="text-xs text-gray-600 mt-2">
          This information is required by the IRS for tax reporting purposes. Your information is encrypted and secure.
        </p>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Name (as shown on your income tax return) <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          className={`w-full px-4 py-3 rounded-lg border ${errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'} text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          placeholder="Individual: First name, middle initial, last name"
          required
        />
        {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
      </div>

      {/* Business Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Business name/disregarded entity name (if different from above)
        </label>
        <input
          type="text"
          name="businessName"
          value={formData.businessName}
          onChange={handleInputChange}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Leave blank if same as name"
        />
      </div>

      {/* Tax Classification */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Federal Tax Classification <span className="text-red-500">*</span>
        </label>
        <select
          name="taxClassification"
          value={formData.taxClassification}
          onChange={handleInputChange}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        >
          <option value="individual">Individual/Sole Proprietor or Single-member LLC</option>
          <option value="c_corporation">C Corporation</option>
          <option value="s_corporation">S Corporation</option>
          <option value="partnership">Partnership</option>
          <option value="trust_estate">Trust/Estate</option>
          <option value="llc_c">Limited Liability Company (taxed as C Corp)</option>
          <option value="llc_s">Limited Liability Company (taxed as S Corp)</option>
          <option value="llc_p">Limited Liability Company (taxed as Partnership)</option>
          <option value="other">Other</option>
        </select>
      </div>

      {formData.taxClassification === 'other' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Specify Other Classification <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="otherTaxClassification"
            value={formData.otherTaxClassification}
            onChange={handleInputChange}
            className={`w-full px-4 py-3 rounded-lg border ${errors.otherTaxClassification ? 'border-red-300' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            placeholder="Enter tax classification"
          />
          {errors.otherTaxClassification && <p className="mt-1 text-sm text-red-500">{errors.otherTaxClassification}</p>}
        </div>
      )}

      {/* Exemptions (optional) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Exempt Payee Code (if any)
          </label>
          <input
            type="text"
            name="exemptPayeeCode"
            value={formData.exemptPayeeCode}
            onChange={handleInputChange}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Exemption from FATCA Code (if any)
          </label>
          <input
            type="text"
            name="exemptionFromFatcaCode"
            value={formData.exemptionFromFatcaCode}
            onChange={handleInputChange}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Optional"
          />
        </div>
      </div>

      {/* Address */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Address <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="addressLine1"
          value={formData.addressLine1}
          onChange={handleInputChange}
          className={`w-full px-4 py-3 rounded-lg border ${errors.addressLine1 ? 'border-red-300' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3`}
          placeholder="Street address"
          required
        />
        <input
          type="text"
          name="addressLine2"
          value={formData.addressLine2}
          onChange={handleInputChange}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Apt, suite, etc. (optional)"
        />
      </div>

      {/* City, State, ZIP */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            City <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleInputChange}
            className={`w-full px-4 py-3 rounded-lg border ${errors.city ? 'border-red-300' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            State <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="state"
            value={formData.state}
            onChange={(e) => {
              const value = e.target.value.toUpperCase()
              if (/^[A-Z]{0,2}$/.test(value)) {
                setFormData(prev => ({ ...prev, state: value }))
              }
            }}
            className={`w-full px-4 py-3 rounded-lg border ${errors.state ? 'border-red-300' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            placeholder="CA"
            maxLength={2}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ZIP Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="zipCode"
            value={formData.zipCode}
            onChange={handleInputChange}
            className={`w-full px-4 py-3 rounded-lg border ${errors.zipCode ? 'border-red-300' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            placeholder="12345"
            required
          />
          {errors.zipCode && <p className="mt-1 text-sm text-red-500">{errors.zipCode}</p>}
        </div>
      </div>

      {/* Tax ID (SSN/EIN) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Taxpayer Identification Number <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-4 mb-3">
          <label className="flex items-center">
            <input
              type="radio"
              name="taxIdType"
              value="ssn"
              checked={formData.taxIdType === 'ssn'}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, taxIdType: 'ssn', taxId: '' }))
              }}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Social Security Number</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="taxIdType"
              value="ein"
              checked={formData.taxIdType === 'ein'}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, taxIdType: 'ein', taxId: '' }))
              }}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Employer ID Number</span>
          </label>
        </div>
        <input
          type="text"
          name="taxId"
          value={formData.taxId}
          onChange={handleTaxIdChange}
          className={`w-full px-4 py-3 rounded-lg border ${errors.taxId ? 'border-red-300' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono`}
          placeholder={formData.taxIdType === 'ssn' ? 'XXX-XX-XXXX' : 'XX-XXXXXXX'}
          maxLength={formData.taxIdType === 'ssn' ? 11 : 10}
          autoComplete="off"
          required
        />
        {errors.taxId && <p className="mt-1 text-sm text-red-500">{errors.taxId}</p>}
        <p className="mt-2 text-xs text-gray-500 flex items-start gap-2">
          <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <span>This information is encrypted and NOT stored in our database. It's only used to generate your W-9 PDF.</span>
        </p>
      </div>

      {/* Signature */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Signature <span className="text-red-500">*</span>
        </label>
        <div className="border-2 border-gray-300 rounded-lg bg-white">
          <SignatureCanvas
            ref={signatureRef}
            canvasProps={{
              className: 'w-full h-40 rounded-lg cursor-crosshair',
            }}
            onEnd={() => setSignatureEmpty(false)}
            backgroundColor="rgb(255, 255, 255)"
          />
        </div>
        <div className="flex justify-between items-center mt-2">
          <button
            type="button"
            onClick={clearSignature}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear Signature
          </button>
          {errors.signature && <p className="text-sm text-red-500">{errors.signature}</p>}
        </div>
      </div>

      {/* Certification */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-300">
        <p className="text-xs text-gray-700 leading-relaxed">
          <strong>Certification:</strong> Under penalties of perjury, I certify that:
          <br /><br />
          1. The number shown on this form is my correct taxpayer identification number, and
          <br />
          2. I am not subject to backup withholding, and
          <br />
          3. I am a U.S. citizen or other U.S. person, and
          <br />
          4. The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.
        </p>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Processing...' : 'Sign & Submit W-9'}
        </button>
      </div>
    </form>
  )
}

export default W9Form

