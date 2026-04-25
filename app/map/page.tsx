'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const MapComponent = dynamic(() => import('@/components/Map'), { ssr: false })

export default function MapPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 3)
    return d.toISOString().split('T')[0]
  })
  const [artistFilter, setArtistFilter] = useState('')
  const [locationSearch, setLocationSearch] = useState('')
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom: number } | null>(null)

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/events?startDate=${startDate}&endDate=${endDate}`)
      const data = await res.json()
      setEvents(data.events || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEvents() }, [])

  const handleLocationSearch = async () => {
    if (!locationSearch.trim()) return
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationSearch)}&format=json&limit=1`
      )
      const data = await res.json()
      if (data.length > 0) {
        setFlyTo({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), zoom: 8 })
      }
    } catch (e) {
      console.error(e)
    }
  }

  const filteredEvents = artistFilter.trim()
    ? events.filter((e: any) =>
        e.artistName.toLowerCase().includes(artistFilter.toLowerCase())
      )
    : events

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ padding: '10px 20px', background: '#191414', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', borderBottom: '1px solid #333' }}>
        <span style={{ color: '#1DB954', fontWeight: '700', fontSize: '18px', marginRight: '4px' }}>Concert Map</span>

        {/* Date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ color: '#aaa', fontSize: '12px' }}>From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #555', fontSize: '12px', background: '#2a2a2a', color: '#fff', colorScheme: 'dark' }} />
          <label style={{ color: '#aaa', fontSize: '12px' }}>To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #555', fontSize: '12px', background: '#2a2a2a', color: '#fff', colorScheme: 'dark' }} />
          <button onClick={fetchEvents}
            style={{ padding: '5px 14px', background: '#1DB954', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>
            {loading ? 'Loading...' : 'Search'}
          </button>
        </div>

        <div style={{ width: '1px', height: '24px', background: '#444' }} />

        {/* Artist filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="text"
            placeholder="Filter by artist..."
            value={artistFilter}
            onChange={e => setArtistFilter(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #555', fontSize: '12px', background: '#2a2a2a', color: '#fff', width: '160px' }}
          />
          {artistFilter && (
            <button onClick={() => setArtistFilter('')}
              style={{ padding: '5px 8px', background: '#444', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
              ✕
            </button>
          )}
        </div>

        <div style={{ width: '1px', height: '24px', background: '#444' }} />

        {/* Location search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="text"
            placeholder="Zoom to city... (e.g. Berlin)"
            value={locationSearch}
            onChange={e => setLocationSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLocationSearch()}
            style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #555', fontSize: '12px', background: '#2a2a2a', color: '#fff', width: '200px' }}
          />
          <button onClick={handleLocationSearch}
            style={{ padding: '5px 12px', background: '#2a2a2a', color: '#1DB954', border: '1px solid #1DB954', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>
            Go
          </button>
        </div>

        {!loading && (
          <span style={{ color: '#aaa', fontSize: '12px', marginLeft: 'auto' }}>
            {filteredEvents.length}{artistFilter ? ` of ${events.length}` : ''} shows
          </span>
        )}
      </div>

      <div style={{ flex: 1 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#111' }}>
            <div style={{ color: '#1DB954', fontSize: '18px' }}>Loading your concerts...</div>
          </div>
        ) : (
          <MapComponent events={filteredEvents} flyTo={flyTo} />
        )}
      </div>
    </div>
  )
}
