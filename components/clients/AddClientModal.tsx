'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import Script from 'next/script'
import { X, Search, MapPin, Phone, Globe, Building2, CheckCircle, Loader2 } from 'lucide-react'

interface PlaceResult {
  name: string
  address: string
  place_id: string
  phone: string
  website: string
}

interface Props {
  mode?: 'add' | 'link'
  client?: {
    id: string
    name: string
    address?: string
  } | null
  onClose: () => void
  onAdded?: () => void
  onLinked?: () => void
}

declare global {
  interface Window { google: any }
}

export default function AddClientModal({ mode = 'add', client = null, onClose, onAdded, onLinked }: Props) {
  const inputRef        = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const [selected, setSelected] = useState<PlaceResult | null>(null)
  const [saving, setSaving]     = useState(false)
  const [mapsReady, setMapsReady] = useState(false)
  const [error, setError]       = useState('')

  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || !window.google?.maps?.places) return
    if (autocompleteRef.current) return

    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['establishment'],
      fields: ['name', 'formatted_address', 'place_id', 'formatted_phone_number', 'website'],
    })

    ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (!place?.place_id) return
      setSelected({
        name:     place.name || '',
        address:  place.formatted_address || '',
        place_id: place.place_id,
        phone:    place.formatted_phone_number || '',
        website:  place.website || '',
      })
    })

    autocompleteRef.current = ac
  }, [])

  useEffect(() => {
    if (mapsReady) initAutocomplete()
  }, [mapsReady, initAutocomplete])

  useEffect(() => {
    if (window.google?.maps?.places) setMapsReady(true)

    return () => {
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
      autocompleteRef.current = null
    }
  }, [])

  // Focus the input once the modal mounts
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(mode === 'link' && client ? `/api/clients/${client.id}` : '/api/clients', {
        method: mode === 'link' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:          mode === 'link' && client ? client.name : selected.name,
          address:       selected.address,
          gbp_id:        selected.place_id,
          phone:         selected.phone,
          website:       selected.website,
          gbp_connected: true,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Save failed')
      if (mode === 'link' && client) {
        await fetch(`/api/clients/${client.id}/sync`, { method: 'POST' })
        onLinked?.()
      } else {
        onAdded?.()
      }
    } catch (e: any) {
      setError(e.message || (mode === 'link' ? 'Failed to link GBP' : 'Failed to add client'))
    }
    setSaving(false)
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  return (
    <>
      {apiKey && (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`}
          strategy="afterInteractive"
          onReady={() => setMapsReady(true)}
          onError={() => setError('Google Places failed to load. Check NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and API restrictions.')}
        />
      )}

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {mode === 'link' ? 'Link GBP' : 'Add client'}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {mode === 'link'
                  ? `Search Google Business Profile for ${client?.name || 'this client'}`
                  : 'Search their Google Business Profile'}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={14} className="text-gray-400" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* API key warning */}
            {!apiKey && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 text-xs text-amber-700">
                Add <code className="font-mono bg-amber-100 px-1 rounded">GOOGLE_MAPS_API_KEY</code> and{' '}
                <code className="font-mono bg-amber-100 px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to your{' '}
                <code className="font-mono bg-amber-100 px-1 rounded">.env</code>, then restart the dev server.
              </div>
            )}

            {/* Search input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search business name or address…"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
              />
            </div>

            {/* Selected place preview */}
            {selected ? (
              <div className="border border-indigo-200 bg-indigo-50/60 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <CheckCircle size={13} className="text-indigo-600" />
                  <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">Selected</span>
                </div>

                <div className="flex items-center gap-2">
                  <Building2 size={13} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-gray-900">{selected.name}</span>
                </div>

                {selected.address && (
                  <div className="flex items-start gap-2">
                    <MapPin size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-gray-600 leading-relaxed">{selected.address}</span>
                  </div>
                )}

                {selected.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-600">{selected.phone}</span>
                  </div>
                )}

                {selected.website && (
                  <div className="flex items-center gap-2">
                    <Globe size={13} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-600 truncate">{selected.website}</span>
                  </div>
                )}

                <div className="pt-1 flex items-center gap-2">
                  <span className="text-[10px] font-mono text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded-md">
                    Place ID: {selected.place_id.slice(0, 22)}…
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono bg-green-100 text-green-700">GBP linked</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-7">
                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-2.5">
                  <MapPin size={20} className="text-gray-300" />
                </div>
                <div className="text-xs text-gray-400">Start typing to search for a business</div>
                <div className="text-[11px] text-gray-300 mt-1">Powered by Google Places</div>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 flex gap-2.5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!selected || saving}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <><Loader2 size={13} className="animate-spin" /> {mode === 'link' ? 'Linking...' : 'Adding...'}</>
              ) : mode === 'link' ? 'Link GBP' : 'Add client'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
