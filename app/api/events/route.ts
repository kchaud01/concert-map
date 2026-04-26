import { createServerSupabaseClient } from '@/utils/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0]
  const endDate = searchParams.get('endDate') || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Fetch followed artists from Spotify
  const accessToken = session.provider_token
  let artists: any[] = []
  let url = 'https://api.spotify.com/v1/me/following?type=artist&limit=50'

  try {
    while (url) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const data = await res.json()
      if (!data.artists) {
        return NextResponse.json({ error: 'Spotify fetch failed', detail: data, artistCount: 0 })
      }
      artists = [...artists, ...data.artists.items]
      url = data.artists.next
    }
  } catch (e: any) {
    return NextResponse.json({ error: 'Spotify error', detail: e.message })
  }

  if (artists.length === 0) {
    return NextResponse.json({ error: 'No artists found', events: [], total: 0 })
  }

  // Test one Ticketmaster call to verify API key works
  const apiKey = process.env.TICKETMASTER_API_KEY
  const testArtist = artists[0]
  const testUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}&keyword=${encodeURIComponent(testArtist.name)}&classificationName=music&startDateTime=${startDate}T00:00:00Z&endDateTime=${endDate}T23:59:59Z&size=3`
  
  let testResult: any = null
  try {
    const testRes = await fetch(testUrl)
    testResult = await testRes.json()
  } catch (e: any) {
    return NextResponse.json({ error: 'Ticketmaster error', detail: e.message })
  }

  const results: any[] = []
  const batches = []
  for (let i = 0; i < artists.length; i += 5) {
    batches.push(artists.slice(i, i + 5))
  }

  function isStrongMatch(eventName: string, artistName: string): boolean {
    const event = eventName.toLowerCase()
    const artist = artistName.toLowerCase()
    if (event === artist) return true
    if (event.startsWith(artist)) return true
    const artistNoThe = artist.replace(/^the\s+/, '')
    if (event.includes(artistNoThe) && artistNoThe.length > 4) return true
    const artistWords = artist.split(/\s+/).filter(w => w.length > 2)
    const allWordsMatch = artistWords.every(word => event.includes(word))
    if (allWordsMatch && artistWords.length > 0) return true
    return false
  }

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (artist: any) => {
        try {
          const tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}&keyword=${encodeURIComponent(artist.name)}&classificationName=music&startDateTime=${startDate}T00:00:00Z&endDateTime=${endDate}T23:59:59Z&size=10`
          const res = await fetch(tmUrl)
          const data = await res.json()
          if (!data._embedded?.events) return []
          return data._embedded.events
            .filter((event: any) => isStrongMatch(event.name, artist.name))
            .map((event: any) => ({
              artistName: artist.name,
              artistImage: artist.images?.[0]?.url || null,
              artistId: artist.id,
              eventName: event.name,
              eventDate: event.dates?.start?.localDate,
              eventTime: event.dates?.start?.localTime,
              venueName: event._embedded?.venues?.[0]?.name,
              venueCity: event._embedded?.venues?.[0]?.city?.name,
              venueCountry: event._embedded?.venues?.[0]?.country?.name,
              lat: parseFloat(event._embedded?.venues?.[0]?.location?.latitude),
              lng: parseFloat(event._embedded?.venues?.[0]?.location?.longitude),
              ticketUrl: event.url,
            }))
            .filter((e: any) => e.lat && e.lng && !isNaN(e.lat) && !isNaN(e.lng))
        } catch {
          return []
        }
      })
    )
    results.push(...batchResults.flat())
  }

  const seen = new Set<string>()
  const deduped = results.filter(event => {
    const key = `${event.artistName}|${event.eventDate}|${event.venueCity}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return NextResponse.json({ 
    events: deduped, 
    total: deduped.length,
    debug: {
      artistCount: artists.length,
      firstArtist: testArtist.name,
      ticketmasterStatus: testResult?.fault || testResult?._embedded ? 'ok' : 'check',
      ticketmasterEvents: testResult?._embedded?.events?.length || 0,
      ticketmasterError: testResult?.fault?.faultstring || null,
      startDate,
      endDate
    }
  })
}
