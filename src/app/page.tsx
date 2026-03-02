'use client'
import { useEffect, useState } from 'react'
import { getAllPlayers } from '@/lib/db'
import { Player } from '@/types'
import PlayerCard from '@/components/ui/PlayerCard'
import { Search, TrendingUp, TrendingDown, BarChart2, RefreshCw } from 'lucide-react'
import { formatPrice, calcPercentChange } from '@/lib/pricing'
import clsx from 'clsx'

type SortKey = 'price' | 'change' | 'name' | 'goals' | 'assists'

export default function DashboardPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('price')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filter, setFilter] = useState<'all' | 'up' | 'down'>('all')

  const load = async () => {
    setLoading(true)
    const data = await getAllPlayers()
    setPlayers(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filtered = players
    .filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.team.toLowerCase().includes(search.toLowerCase())
      const pct = calcPercentChange(p.currentPrice, p.previousPrice)
      const matchFilter = filter === 'all' || (filter === 'up' && pct >= 0) || (filter === 'down' && pct < 0)
      return matchSearch && matchFilter
    })
    .sort((a, b) => {
      let va: number, vb: number
      switch (sortKey) {
        case 'price': va = a.currentPrice; vb = b.currentPrice; break
        case 'change':
          va = calcPercentChange(a.currentPrice, a.previousPrice)
          vb = calcPercentChange(b.currentPrice, b.previousPrice)
          break
        case 'name': return sortDir === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name)
        case 'goals':
          va = a.tournamentStats.reduce((s, t) => s + t.goals, 0)
          vb = b.tournamentStats.reduce((s, t) => s + t.goals, 0)
          break
        case 'assists':
          va = a.tournamentStats.reduce((s, t) => s + t.assists, 0)
          vb = b.tournamentStats.reduce((s, t) => s + t.assists, 0)
          break
        default: va = 0; vb = 0
      }
      return sortDir === 'asc' ? va - vb : vb - va
    })

  // Market stats
  const gainers = players.filter(p => calcPercentChange(p.currentPrice, p.previousPrice) > 0)
  const losers = players.filter(p => calcPercentChange(p.currentPrice, p.previousPrice) < 0)

  const SortButton = ({ label, k }: { label: string; k: SortKey }) => (
    <button
      onClick={() => handleSort(k)}
      className={clsx(
        'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
        sortKey === k ? 'bg-accent text-background' : 'bg-surface text-muted hover:text-text'
      )}
    >
      {label} {sortKey === k && (sortDir === 'desc' ? '↓' : '↑')}
    </button>
  )

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text">Market</h1>
          <p className="text-muted mt-1 text-sm">{players.length} players listed</p>
        </div>
        <button onClick={load} className="text-muted hover:text-accent transition-colors p-2">
          <RefreshCw className={clsx('w-5 h-5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted text-sm mb-1">
            <BarChart2 className="w-4 h-4" /> Total Players
          </div>
          <p className="text-2xl font-bold font-mono text-text">{players.length}</p>
        </div>
        <div className="bg-card border border-green/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green text-sm mb-1">
            <TrendingUp className="w-4 h-4" /> Gaining
          </div>
          <p className="text-2xl font-bold font-mono text-green">{gainers.length}</p>
        </div>
        <div className="bg-card border border-red/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red text-sm mb-1">
            <TrendingDown className="w-4 h-4" /> Losing
          </div>
          <p className="text-2xl font-bold font-mono text-red">{losers.length}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search players or teams..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'up', 'down'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-4 py-2.5 rounded-xl text-sm font-medium transition-colors capitalize',
                filter === f
                  ? f === 'up' ? 'bg-green text-background' : f === 'down' ? 'bg-red text-background' : 'bg-accent text-background'
                  : 'bg-surface text-muted hover:text-text'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Sort row */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <span className="text-muted text-sm self-center mr-1">Sort:</span>
        <SortButton label="Price" k="price" />
        <SortButton label="Change" k="change" />
        <SortButton label="Name" k="name" />
        <SortButton label="Goals" k="goals" />
        <SortButton label="Assists" k="assists" />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="rounded-xl bg-card border border-border p-4 h-36 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-muted">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No players found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => <PlayerCard key={p.id} player={p} />)}
        </div>
      )}
    </div>
  )
}
