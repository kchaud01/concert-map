import { createServerSupabaseClient } from '@/utils/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

const CACHE_HOURS = 24

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0]
  const endDate = searchParams.get('endDate') || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const forceRefresh = searchParams.get('refresh') === 'true'
  const userId = session.user.id

  // Check cache first
  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from('event_cache')
      .select('events, created_at')
      .eq('user_id', userId)
      .eq('start_date', startDate)
      .eq('end_date', endDate)
      .single()

    if (cached) {
      const cacheAge = (Date.now() - new Date(cached.created_at).getTime()) / (1000 * 60 * 60)
      if (cacheAge < CACHE_HOURS) {
        return NextResponse.json({ 
          events: cached.events, 
          total: cached.events.length,
          cached: true,
          cacheAge: Math.round(cacheAge * 10) / 10
        })
      }
    }
  }

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
      if (!data.artists) break
      artists = [...artists, ...data.artists.items]
      url = data.artists.next
    }
  } catch (e) {
    return NextResponse.json({ error: 'Spotify fetch failed' }, { status: 500 })
  }

  if (artists.length === 0) {
    return NextResponse.json({ events: [], total: 0 })
  }

  // Check Ticketmaster rate limit with one test call
  const apiKey = process.env.TICKETMASTER_API_KEY
  const testRes = await fetch(
    `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}&keyword=${encodeURIComponent(artists[0].name)}&size=1`
  )
  const testData = await testRes.json()
  
  if (testData?.fault?.faultstring?.includes('Rate limit')) {
    // Return stale cache if available rather than empty
    const { data: staleCache } = await supabase
      .from('event_cache')
      .select('events, created_at')
      .eq('user_id', userId)
      .eq('start_date', startDate)
      .eq('end_date', endDate)
      .single()

    if (staleCache) {
      return NextResponse.json({ 
        events: staleCache.events, 
        total: staleCache.events.length,
        cached: true,
        stale: true,
        message: 'Ticketmaster rate limit reached — showing cached results'
      })
    }

    return NextResponse.json({ 
      events: [], 
      total: 0, 
      error: 'Ticketmaster rate limit reached. Please try again tomorrow.' 
    })
  }

  // Fetch events from Ticketmaster
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

  // Deduplicate
  const seen = new Set<string>()
  const deduped = results.filter(event => {
    const key = `${event.artistName}|${event.eventDate}|${event.venueCity}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Save to cache
  await supabase
    .from('event_cache')
    .upsert({
      user_id: userId,
      start_date: startDate,
      end_date: endDate,
      events: deduped,
    }, { onConflict: 'user_id,start_date,end_date' })

  return NextResponse.json({ events: deduped, total: deduped.length, cached: false })
}
