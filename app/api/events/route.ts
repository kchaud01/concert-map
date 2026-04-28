// v3 - per-artist search, limited to top 50 by popularity
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
  let spotifyUrl = 'https://api.spotify.com/v1/me/following?type=artist&limit=50'

  try {
    while (spotifyUrl) {
      const res = await fetch(spotifyUrl, { headers: { Authorization: `Bearer ${accessToken}` } })
      const data = await res.json()
      if (!data.artists) break
      artists = [...artists, ...data.artists.items]
      spotifyUrl = data.artists.next
    }
  } catch (e) {
    return NextResponse.json({ error: 'Spotify fetch failed' }, { status: 500 })
  }

  if (artists.length === 0) {
    return NextResponse.json({ events: [], total: 0 })
  }

  // Sort by popularity and take top 100 to stay within rate limits
  // 100 artists x 1 call each = 100 calls, well within 5000/day limit
  const topArtists = [...artists]
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 100)

  const apiKey = process.env.TICKETMASTER_API_KEY
  const results: any[] = []
  const seen = new Set<string>()

  function isStrongMatch(eventName: string, artistName: string): boolean {
    const event = eventName.toLowerCase()
    const artist = artistName.toLowerCase()
    if (event === artist) return true
    if (event.startsWith(artist)) return true
    const artistNoThe = artist.replace(/^the\s+/, '')
    if (event.includes(artistNoThe) && artistNoThe.length > 4) return true
    const artistWords = artist.split(/\s+/).filter((w: string) => w.length > 2)
    const allWordsMatch = artistWords.every((word: string) => event.includes(word))
    if (allWordsMatch && artistWords.length > 0) return true
    return false
  }

  // Process in batches of 5 (parallel) to stay fast but not overwhelm
  const batches = []
  for (let i = 0; i < topArtists.length; i += 5) {
    batches.push(topArtists.slice(i, i + 5))
  }

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (artist: any) => {
        try {
          const tmUrl =
            `https://app.ticketmaster.com/discovery/v2/events.json` +
            `?apikey=${apiKey}` +
            `&keyword=${encodeURIComponent(artist.name)}` +
            `&classificationName=music` +
            `&startDateTime=${startDate}T00:00:00Z` +
            `&endDateTime=${endDate}T23:59:59Z` +
            `&size=5`

          const res = await fetch(tmUrl)
          const data = await res.json()

          if (data?.fault?.faultstring?.includes('Rate limit')) return []
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

    for (const event of batchResults.flat()) {
      const key = `${event.artistName}|${event.eventDate}|${event.venueCity}`
      if (!seen.has(key)) {
        seen.add(key)
        results.push(event)
      }
    }
  }

  // Save to cache
  if (results.length > 0) {
    await supabase
      .from('event_cache')
      .upsert({
        user_id: userId,
        start_date: startDate,
        end_date: endDate,
        events: results,
      }, { onConflict: 'user_id,start_date,end_date' })
  }

  return NextResponse.json({
    events: results,
    total: results.length,
    cached: false,
    artistsSearched: topArtists.length,
    totalArtists: artists.length
  })
}
