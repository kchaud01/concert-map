'use client'
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Event {
  artistName: string
  artistImage: string | null
  eventName: string
  eventDate: string
  eventTime: string
  venueName: string
  venueCity: string
  venueCountry: string
  lat: number
  lng: number
  ticketUrl: string
}

interface Props {
  events: Event[]
  flyTo: { lat: number; lng: number; zoom: number } | null
}

export default function Map({ events, flyTo }: Props) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<L.Marker[]>([])
  const [tooltip, setTooltip] = useState<{ event: Event; x: number; y: number } | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    mapRef.current = L.map(mapContainerRef.current, { center: [30, 0], zoom: 2 })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 18,
    }).addTo(mapRef.current)
    return () => { mapRef.current?.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    if (!flyTo || !mapRef.current) return
    mapRef.current.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom, { duration: 1.2 })
  }, [flyTo])

  useEffect(() => {
    if (!mapRef.current) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    events.forEach(event => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width: 44px; height: 44px; border-radius: 50%;
          border: 2.5px solid #1DB954;
          overflow: hidden; cursor: pointer;
          box-shadow: 0 0 8px rgba(29,185,84,0.5);
          background: #222;
        ">
          ${event.artistImage
            ? `<img src="${event.artistImage}" style="width:100%;height:100%;object-fit:cover;" />`
            : `<div style="width:100%;height:100%;background:#333;display:flex;align-items:center;justify-content:center;color:#1DB954;font-size:10px;font-weight:bold;">${event.artistName.slice(0, 2).toUpperCase()}</div>`
          }
        </div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      })

      const marker = L.marker([event.lat, event.lng], { icon }).addTo(mapRef.current!)

      marker.on('mouseover', () => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
        const containerPoint = mapRef.current!.latLngToContainerPoint([event.lat, event.lng])
        setTooltip({ event, x: containerPoint.x, y: containerPoint.y })
      })

      marker.on('mouseout', () => {
        hideTimerRef.current = setTimeout(() => setTooltip(null), 300)
      })

      markersRef.current.push(marker)
    })
  }, [events])

  const formatDate = (date: string, time: string) => {
    if (!date) return ''
    const d = new Date(date + 'T' + (time || '00:00:00'))
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      + (time ? ` · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : '')
  }

  const getFlightDate = (eventDate: string) => {
    if (!eventDate) return ''
    const d = new Date(eventDate)
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0].replace(/-/g, '')
  }

  const getGoogleFlightsUrl = (event: Event) => {
    const flightDate = getFlightDate(event.eventDate)
    const city = encodeURIComponent(event.venueCity)
    return `https://www.google.com/travel/flights?q=Flights+to+${city}+on+${flightDate}`
  }

  const handleTooltipEnter = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
  }

  const handleTooltipLeave = () => {
    hideTimerRef.current = setTimeout(() => setTooltip(null), 200)
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {tooltip && (
        <div
          onMouseEnter={handleTooltipEnter}
          onMouseLeave={handleTooltipLeave}
          style={{
            position: 'absolute',
            left: tooltip.x + 24,
            top: tooltip.y - 60,
            background: '#1a1a1a',
            border: '1px solid #444',
            borderRadius: '12px',
            padding: '14px',
            width: '270px',
            zIndex: 1000,
            boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
            cursor: 'default',
          }}
        >
          {/* Artist header */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
            {tooltip.event.artistImage && (
              <img src={tooltip.event.artistImage} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #1DB954' }} />
            )}
            <div>
              <div style={{ color: '#1DB954', fontWeight: '700', fontSize: '15px' }}>{tooltip.event.artistName}</div>
              <div style={{ color: '#bbb', fontSize: '11px', marginTop: '2px' }}>{tooltip.event.eventName}</div>
            </div>
          </div>

          {/* Venue and date */}
          <div style={{ borderTop: '1px solid #333', paddingTop: '10px', marginBottom: '12px' }}>
            <div style={{ color: '#e0e0e0', fontSize: '12px', marginBottom: '5px', display: 'flex', gap: '6px' }}>
              <span>📍</span>
              <span>{tooltip.event.venueName ? `${tooltip.event.venueName}, ` : ''}{tooltip.event.venueCity}, {tooltip.event.venueCountry}</span>
            </div>
            <div style={{ color: '#e0e0e0', fontSize: '12px', display: 'flex', gap: '6px' }}>
              <span>🗓</span>
              <span>{formatDate(tooltip.event.eventDate, tooltip.event.eventTime)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <a
              href={tooltip.event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: '#1DB954', color: '#fff', textDecoration: 'none',
                padding: '9px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
              }}
            >
              🎟 Buy Tickets
            </a>
            <a
              href={getGoogleFlightsUrl(tooltip.event)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: '#1a73e8', color: '#fff', textDecoration: 'none',
                padding: '9px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
              }}
            >
              ✈️ Find Flights
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
