'use client'

import { useState, useEffect, useCallback } from 'react'

type Game = {
  id: string
  created_at: string
  host_name: string
  session_type: 'match' | 'drill' | 'rally'
  format: 'singles' | 'doubles' | 'rr'
  ntrp_level: '3.5' | '4.0' | '4.5' | 'any'
  date: string
  time: string
  location: string
  spots_needed: number
  note: string
  players: string[]
}

const FORMAT_NEEDS = { singles: 2, doubles: 4, rr: 6 }
const TYPE_LABEL = { match: 'Match', drill: 'Drill session', rally: 'Hit around' }
const FMT_LABEL = { singles: 'Singles', doubles: 'Doubles', rr: 'Round-robin' }
const LEVEL_LABEL: Record<string, string> = { '3.5': '3.5 NTRP', '4.0': '4.0 NTRP', '4.5': '4.5 NTRP', any: 'Any level' }

function initials(name: string) {
  return name.split(' ').map(x => x[0]).join('').toUpperCase().slice(0, 2)
}

function avatarColor(name: string) {
  const colors = [
    'bg-emerald-100 text-emerald-800',
    'bg-blue-100 text-blue-800',
    'bg-amber-100 text-amber-800',
    'bg-pink-100 text-pink-800',
    'bg-lime-100 text-lime-800',
    'bg-purple-100 text-purple-800',
  ]
  return colors[name.charCodeAt(0) % colors.length]
}

function formatDate(date: string, time: string) {
  const dt = new Date(date + 'T' + time)
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function Home() {
  const [tab, setTab] = useState<'feed' | 'post'>('feed')
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [posting, setPosting] = useState(false)
  const [success, setSuccess] = useState('')

  const [hostName, setHostName] = useState('')
  const [sessionType, setSessionType] = useState<'match' | 'drill' | 'rally'>('match')
  const [format, setFormat] = useState<'singles' | 'doubles' | 'rr'>('singles')
  const [ntrpLevel, setNtrpLevel] = useState<'3.5' | '4.0' | '4.5' | 'any'>('3.5')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [time, setTime] = useState('08:00')
  const [location, setLocation] = useState('')
  const [note, setNote] = useState('')

  const fetchGames = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/games')
    const data = await res.json()
    setGames(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchGames() }, [fetchGames])

  async function postGame() {
    if (!hostName || !date || !time) { alert('Please fill in your name, date, and time.'); return }
    setPosting(true)
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host_name: hostName, session_type: sessionType, format, ntrp_level: ntrpLevel, date, time, location, note, spots_needed: FORMAT_NEEDS[format] })
    })
    if (res.ok) {
      setSuccess('Game posted! Friends can now see and join it.')
      setTimeout(() => setSuccess(''), 4000)
      setHostName(''); setLocation(''); setNote('')
      setTab('feed')
      fetchGames()
    }
    setPosting(false)
  }

  async function joinGame(game: Game, playerName: string) {
    if (game.players.includes(playerName)) { alert("You've already joined this game!"); return }
    if (game.players.length >= game.spots_needed) { alert('This game is already full.'); return }
    const newPlayers = [...game.players, playerName]
    const res = await fetch('/api/games', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: game.id, players: newPlayers })
    })
    if (res.ok) fetchGames()
  }

  const filtered = games.filter(g => filter === 'all' || g.ntrp_level === filter)
  const spotsLeft = (g: Game) => Math.max(0, g.spots_needed - g.players.length)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-400 rounded-full relative overflow-hidden flex-shrink-0">
              <div className="absolute w-7 h-3.5 border-t-2 border-white/60 rounded-t-full top-1 left-0.5" />
            </div>
            <span className="font-serif text-xl text-gray-900">court<span className="text-emerald-600">match</span></span>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button onClick={() => setTab('feed')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'feed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Open games</button>
            <button onClick={() => setTab('post')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'post' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Post game</button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {success && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
            <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l2.5 2.5 5.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            {success}
          </div>
        )}

        {tab === 'feed' && (
          <div>
            <div className="flex gap-2 flex-wrap mb-4 items-center">
              <span className="text-xs text-gray-400 font-medium">Filter:</span>
              {[['all', 'All levels'], ['3.5', '3.5'], ['4.0', '4.0'], ['4.5', '4.5'], ['any', 'Any level']].map(([val, label]) => (
                <button key={val} onClick={() => setFilter(val)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${filter === val ? 'bg-emerald-50 border-emerald-400 text-emerald-800' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {label}
                </button>
              ))}
            </div>

            {loading && <div className="text-center py-12 text-gray-400">Loading games...</div>}

            {!loading && filtered.length === 0 && (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">🎾</div>
                <p className="text-gray-400 text-sm">No games at this level yet.</p>
                <button onClick={() => setTab('post')} className="mt-4 bg-emerald-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">Be the first to post one</button>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {filtered.map(g => {
                const left = spotsLeft(g)
                const full = left === 0
                const pct = Math.round((g.players.length / g.spots_needed) * 100)
                return (
                  <div key={g.id} className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-gray-300 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${avatarColor(g.host_name)}`}>{initials(g.host_name)}</div>
                          <span className="font-medium text-gray-900 text-sm">{g.host_name}</span>
                        </div>
                        <div className="text-sm text-gray-500">{formatDate(g.date, g.time)}</div>
                        {g.location && <div className="text-xs text-gray-400 mt-0.5">📍 {g.location}</div>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${g.session_type === 'match' ? 'bg-blue-50 text-blue-700' : g.session_type === 'drill' ? 'bg-amber-50 text-amber-700' : 'bg-lime-50 text-lime-700'}`}>{TYPE_LABEL[g.session_type]}</span>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${g.format === 'singles' ? 'bg-purple-50 text-purple-700' : g.format === 'doubles' ? 'bg-pink-50 text-pink-700' : 'bg-emerald-50 text-emerald-700'}`}>{FMT_LABEL[g.format]}</span>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${g.ntrp_level === '3.5' ? 'bg-purple-50 text-purple-700' : g.ntrp_level === '4.0' ? 'bg-emerald-50 text-emerald-700' : g.ntrp_level === '4.5' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{LEVEL_LABEL[g.ntrp_level]}</span>
                        {full ? <span className="text-xs px-2 py-1 rounded-full font-medium bg-red-50 text-red-600">Full</span> : <span className="text-xs px-2 py-1 rounded-full font-medium bg-emerald-50 text-emerald-700">+{left} spot{left > 1 ? 's' : ''}</span>}
                      </div>
                    </div>

                    {g.note && <p className="text-sm text-gray-500 mb-3">{g.note}</p>}

                    <div className="mb-3">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-xs text-gray-400">{g.players.length}/{g.spots_needed} confirmed{full ? ' · ready to play 🎾' : ''}</div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div className="flex items-center">
                        {g.players.map((p, i) => (
                          <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border-2 border-white ${avatarColor(p)}`} style={{ marginLeft: i > 0 ? '-6px' : '0' }} title={p}>{initials(p)}</div>
                        ))}
                        {g.players.length > 1 && <span className="text-xs text-gray-400 ml-2">{g.players.slice(1).join(', ')}</span>}
                      </div>
                      {!full && (
                        <button onClick={() => { const n = prompt('Your name to join?'); if (n) joinGame(g, n) }}
                          className="bg-emerald-600 text-white px-4 py-1.5 rounded-xl text-xs font-medium hover:bg-emerald-700 transition-colors">
                          Join game
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'post' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="font-serif text-xl text-gray-900 mb-4">Post a game</h2>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Session type</label>
              <div className="grid grid-cols-3 gap-2">
                {(['match', 'drill', 'rally'] as const).map(t => (
                  <button key={t} onClick={() => setSessionType(t)}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${sessionType === t ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {t === 'match' ? '🎾 Match' : t === 'drill' ? '🎯 Drill' : '😊 Hit around'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Skill level (NTRP)</label>
              <div className="grid grid-cols-4 gap-2">
                {([['any', 'Any', 'Open'], ['3.5', '3.5', 'Intermediate'], ['4.0', '4.0', 'Strong inter.'], ['4.5', '4.5', 'Advanced']] as const).map(([val, label, sub]) => (
                  <button key={val} onClick={() => setNtrpLevel(val)}
                    className={`py-2 px-1 rounded-xl border text-center transition-all ${ntrpLevel === val ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className={`font-serif text-lg ${ntrpLevel === val ? 'text-emerald-800' : 'text-gray-700'}`}>{label}</div>
                    <div className={`text-xs mt-0.5 ${ntrpLevel === val ? 'text-emerald-600' : 'text-gray-400'}`}>{sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Format</label>
              <div className="grid grid-cols-3 gap-2">
                {([['singles', 'Singles', '1v1 · needs 2'], ['doubles', 'Doubles', '2v2 · needs 4'], ['rr', 'Round-robin', 'Everyone plays']] as const).map(([val, label, sub]) => (
                  <button key={val} onClick={() => setFormat(val)}
                    className={`py-2.5 rounded-xl border text-center transition-all ${format === val ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className={`text-sm font-medium ${format === val ? 'text-emerald-800' : 'text-gray-700'}`}>{label}</div>
                    <div className={`text-xs mt-0.5 ${format === val ? 'text-emerald-600' : 'text-gray-400'}`}>{sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-700">
              {FMT_LABEL[format]} · {LEVEL_LABEL[ntrpLevel]} — needs {FORMAT_NEEDS[format] - 1} more player{FORMAT_NEEDS[format] - 1 > 1 ? 's' : ''} to confirm.
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Your name</label>
                <input value={hostName} onChange={e => setHostName(e.target.value)} placeholder="e.g. Alex" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Time</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Location</label>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Riverside Park Ct 3" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Note (optional)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Singles only, bring balls, warm-up first..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400 resize-none h-16" />
            </div>

            <button onClick={postGame} disabled={posting}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
              {posting ? 'Posting...' : 'Post game'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
