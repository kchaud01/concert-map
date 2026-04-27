import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('date', { ascending: true })
    .order('time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await supabase
    .from('games')
    .insert([{
      host_name: body.host_name,
      session_type: body.session_type,
      format: body.format,
      ntrp_level: body.ntrp_level,
      date: body.date,
      time: body.time,
      location: body.location,
      spots_needed: body.spots_needed,
      note: body.note || '',
      players: [body.host_name],
    }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, players } = body

  const { data, error } = await supabase
    .from('games')
    .update({ players })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
