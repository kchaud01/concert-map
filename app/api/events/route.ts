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

  const apiKey = process.env.TICKETMASTER_API_KEY

  // Build lookup map: artist name lowercase -> artist object
  const artistMap = new Map<string, any>()
  artists.forEach(a => {
    artistMap.set(a.name.toLowerCase(), a)
    // Also index without "the " prefix
    const noThe = a.name.toLowerCase().replace(/^the\s+/, '')
    if (noThe !== a.name.toLowerCase()) artistMap.set(noThe, a)
  })

  // Fetch pages of ALL music events and filter locally
  // This uses ~20 calls max instead of 233 calls (one per artist)
  const results: any[] = []
  const seen = new Set<string>()
  let page = 0
  let totalPages = 1
  let callCount = 0
  const MAX_PAGES = 20

  while (page < totalPages && callCount < MAX_PAGES) {
    const tmUrl =
      `https://app.ticketmaster.com/discovery/v2/events.json` +
      `?apikey=${apiKey}` +
      `&classificationName=music` +
      `&startDateTime=${startDate}T00:00:00Z` +
      `&endDateTime=${endDate}T23:59:59Z` +
      `&size=200` +
      `&page=${page}` +
      `&sort=date,asc`

    try {
      const res = await fetch(tmUrl)
      const data = await res.json()

      // Rate limit hit — return stale cache or error
      if (data?.fault?.faultstring?.includes('Rate limit')) {
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
            message: 'Showing cached results — Ticketmaster rate limit reached'
          })
        }

        return NextResponse.json({
          events: [],
          total: 0,
          error: 'Ticketmaster rate limit reached. Please try again later.'
        })
      }

      if (!data._embedded?.events) break

      totalPages = Math.min(data.page?.totalPages || 1, MAX_PAGES)
      callCount++

      for (const event of data._embedded.events) {
        const eventNameLower = event.name?.toLowerCase() || ''
        const attractions = event._embedded?.attractions || []

        let matchedArtist: any = null

        // Best match: exact attraction name
        for (const attraction of attractions) {
          const name = attraction.name?.toLowerCase()
          if (name && artistMap.has(name)) {
            matchedArtist = artistMap.get(name)
            break
          }
        }

        // Fallback: artist name contained in event name
        if (!matchedArtist) {
          for (const [artistKey, artist] of artistMap.entries()) {
            if (artistKey.length > 3 && eventNameLower.includes(artistKey)) {
              matchedArtist = artist
              break
            }
          }
        }

        if (!matchedArtist) continue

        const lat = parseFloat(event._embedded?.venues?.[0]?.location?.latitude)
        const lng = parseFloat(event._embedded?.venues?.[0]?.location?.longitude)
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) continue

        const venueCity = event._embedded?.venues?.[0]?.city?.name
        const eventDate = event.dates?.start?.localDate
        const dedupKey = `${matchedArtist.name}|${eventDate}|${venueCity}`
        if (seen.has(dedupKey)) continue
        seen.add(dedupKey)

        results.push({
          artistName: matchedArtist.name,
          artistImage: matchedArtist.images?.[0]?.url || null,
          artistId: matchedArtist.id,
          eventName: event.name,
          eventDate,
          eventTime: event.dates?.start?.localTime,
          venueName: event._embedded?.venues?.[0]?.name,
          venueCity,
          venueCountry: event._embedded?.venues?.[0]?.country?.name,
          lat,
          lng,
          ticketUrl: event.url,
        })
      }

      page++
    } catch (e) {
      break
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
    callsUsed: callCount
  })
}
