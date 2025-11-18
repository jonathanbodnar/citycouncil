import React, { useState, useEffect } from 'react'
import { DocumentTextIcon, ArrowDownTrayIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline'
import { supabase } from '../../services/supabase'
import toast from 'react-hot-toast'

interface W9Form {
  id: string
  talent_id: string
  name: string
  business_name: string | null
  tax_classification: string
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  zip_code: string
  signature_date: string
  pdf_storage_url: string | null
  pdf_generated_at: string | null
  created_at: string
  talent_profiles: {
    full_name: string
    users: {
      email: string
    }
  }
}

const W9Management: React.FC = () => {
  const [w9Forms, setW9Forms] = useState<W9Form[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending'>('all')

  useEffect(() => {
    fetchW9Forms()
  }, [])

  const fetchW9Forms = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('w9_forms')
        .select(`
          *,
          talent_profiles!inner (
            full_name,
            users!inner (
              email
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      setW9Forms(data || [])
    } catch (error: any) {
      console.error('Error fetching W-9 forms:', error)
      toast.error('Failed to load W-9 forms')
    } finally {
      setLoading(false)
    }
  }

  const downloadW9 = async (w9: W9Form) => {
    try {
      toast.loading('Generating W-9 HTML...', { id: 'download-w9' })
      
      // Get the Supabase function URL
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
      const functionUrl = `${supabaseUrl}/functions/v1/generate-w9-pdf-download?w9Id=${w9.id}`
      
      // Open in new tab
      window.open(functionUrl, '_blank')
      toast.success('W-9 opened in new tab', { id: 'download-w9' })
    } catch (error: any) {
      console.error('Error downloading W-9:', error)
      toast.error('Failed to download W-9', { id: 'download-w9' })
    }
  }

  const getTaxClassificationLabel = (classification: string): string => {
    const labels: Record<string, string> = {
      individual: 'Individual/Sole Proprietor',
      c_corporation: 'C Corporation',
      s_corporation: 'S Corporation',
      partnership: 'Partnership',
      trust_estate: 'Trust/Estate',
      llc_c: 'LLC (C Corp)',
      llc_s: 'LLC (S Corp)',
      llc_p: 'LLC (Partnership)',
      other: 'Other',
    }
    return labels[classification] || classification
  }

  const filteredForms = w9Forms.filter(form => {
    const matchesSearch = 
      form.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      form.talent_profiles.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      form.talent_profiles.users.email.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'completed' && form.pdf_storage_url) ||
      (filterStatus === 'pending' && !form.pdf_storage_url)

    return matchesSearch && matchesFilter
  })

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">W-9 Forms Management</h2>
        <p className="text-gray-300">View and download W-9 forms submitted by talent</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total W-9s</p>
              <p className="text-3xl font-bold text-white mt-1">{w9Forms.length}</p>
            </div>
            <DocumentTextIcon className="w-12 h-12 text-blue-400" />
          </div>
        </div>
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Completed</p>
              <p className="text-3xl font-bold text-white mt-1">
                {w9Forms.filter(f => f.pdf_storage_url).length}
              </p>
            </div>
            <CheckCircleIcon className="w-12 h-12 text-green-400" />
          </div>
        </div>
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Pending</p>
              <p className="text-3xl font-bold text-white mt-1">
                {w9Forms.filter(f => !f.pdf_storage_url).length}
              </p>
            </div>
            <ClockIcon className="w-12 h-12 text-yellow-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Forms</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* W-9 Forms List */}
      <div className="glass rounded-xl overflow-hidden">
        {filteredForms.length === 0 ? (
          <div className="text-center py-12">
            <DocumentTextIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No W-9 forms found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Talent
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Legal Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Tax Classification
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredForms.map((form) => (
                  <tr key={form.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {form.talent_profiles.full_name}
                        </div>
                        <div className="text-sm text-gray-400">
                          {form.talent_profiles.users.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-white">{form.name}</div>
                      {form.business_name && (
                        <div className="text-xs text-gray-400">{form.business_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">
                        {getTaxClassificationLabel(form.tax_classification)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">
                        {form.city}, {form.state}
                      </div>
                      <div className="text-xs text-gray-400">{form.zip_code}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">
                        {new Date(form.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(form.created_at).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {form.pdf_storage_url ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircleIcon className="w-4 h-4 mr-1" />
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <ClockIcon className="w-4 h-4 mr-1" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => downloadW9(form)}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default W9Management

