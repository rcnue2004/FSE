'use client'
import { useEffect, useState } from 'react'
import { useGame } from '@/context/GameContext'
import { getTournamentSchedule } from '@/lib/db'
import { TournamentEvent } from '@/types'
import { Calendar, MapPin, Disc } from 'lucide-react'
import { format } from 'date-fns'
import clsx from 'clsx'

export default function SchedulePage() {
  const { currentGameId, currentGame } = useGame()
  const [events, setEvents] = useState<TournamentEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentGameId) {
      setLoading(false)
      return
    }
    setLoading(true)
    getTournamentSchedule(currentGameId).then(data => {
      setEvents(data)
      setLoading(false)
    })
  }, [currentGameId])

  if (!currentGameId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <Disc className="w-14 h-14 text-accent animate-spin" style={{ animationDuration: '4s' }} />
        <div>
          <h1 className="text-3xl font-bold text-text mb-2">No Game Selected</h1>
          <p className="text-muted text-sm">Choose a game to view its schedule.</p>
        </div>
        <a href="/" className="bg-accent text-background px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity">
          Select a Game
        </a>
      </div>
    )
  }

  const now = new Date()
  const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const upcoming = sorted.filter(e => new Date(e.date) >= now)
  const past = sorted.filter(e => new Date(e.date) < now)

  const Card = ({ ev, isPast }: { ev: TournamentEvent; isPast: boolean }) => (
    <div
      className={clsx(
        'rounded-2xl p-5 border transition-colors',
        isPast ? 'bg-surface/50 border-border opacity-60' : 'bg-card border-border'
      )}
    >
      <div className="flex items-start justify-between gap-4 mb-2">
        <h3 className={clsx('font-bold text-lg', isPast ? 'text-muted' : 'text-text')}>{ev.name}</h3>
        {!isPast && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-accent/20 text-accent shrink-0">
            Upcoming
          </span>
        )}
      </div>
      <div className={clsx('flex items-center gap-2 text-sm mb-1', isPast ? 'text-muted' : 'text-text')}>
        <Calendar className="w-4 h-4 text-accent" />
        {format(new Date(ev.date), 'EEEE, MMMM d, yyyy')}
      </div>
      <div className="flex items-center gap-2 text-sm text-muted mb-2">
        <MapPin className="w-4 h-4" />
        {ev.location}
      </div>
      {ev.notes && <p className="text-sm text-muted mt-2">{ev.notes}</p>}
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text">Tournament Schedule</h1>
        <p className="text-muted mt-1 text-sm">{currentGame?.name || 'Schedule'}</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="rounded-2xl bg-card border border-border p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-24 text-muted">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No tournaments scheduled yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div className="space-y-4">
              {upcoming.map(ev => <Card key={ev.id} ev={ev} isPast={false} />)}
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3 mt-2">Past Tournaments</h2>
              <div className="space-y-4">
                {past.map(ev => <Card key={ev.id} ev={ev} isPast={true} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
