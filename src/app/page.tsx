'use client'
import { useEffect, useState } from 'react'
import { getAllPlayers, db } from '@/lib/db'
import { Player, Trade } from '@/types'
import PlayerCard from '@/components/ui/PlayerCard'
import { Search, TrendingUp, TrendingDown, BarChart2, RefreshCw, Activity } from 'lucide-react'
import { formatPrice, calcPercentChange } from '@/lib/pricing'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { format } from 'date-fns'
import clsx from 'clsx'

type SortKey = 'price' | 'change' | 'name' | 'shares'

export default function DashboardPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('price')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filter, setFilter] = useState<'all' | 'up' | 'down'>('all')
  const [trades, setTrades] = useState<Trade[]>([])

  const load = async () => {
    setLoading(true)
    const data = await getAllPlayers()
    setPlayers(data)
    setLoading(false)
  }

  useEffect(() => {
    load()

    // Real time trade feed
    const q = query(collection(db, 'trades'), orderBy('timestamp', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const t = snap.docs.map(d => ({ id: d.id, ...d.data() } as Trade))
      setTrades(t)
    })
    return () => unsub()
  }, [])

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
        case 'shares':
          va = a.sharesAvailable
          vb = b.sharesAvailable
          break
        default: va = 0; vb = 0
      }
      return sortDir === 'asc' ? va - vb : vb - va
    })

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
      <div className="flex gap-6">

        {/* Left — Market */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-text">Market</h1>
              <p className="text-muted mt-1 text-sm">{players.length} players listed</p>
            </div>
            <button onClick={load} className="text-muted hover:text-accent transition-colors p-2">
              <RefreshCw className={clsx('w-5 h-5', loading && 'animate-spin')} />
            </button>
          </div>

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

          <div className="flex gap-2 mb-4 flex-wrap">
            <span className="text-muted text-sm self-center mr-1">Sort:</span>
            <SortButton label="Price" k="price" />
            <SortButton label="Change" k="change" />
            <SortButton label="Name" k="name" />
            <SortButton label="Shares" k="shares" />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(p => <PlayerCard key={p.id} player={p} />)}
            </div>
          )}
        </div>

        {/* Right — Trade Feed */}
        <div className="w-72 shrink-0 hidden lg:block">
          <div className="bg-card border border-border rounded-xl sticky top-24">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Activity className="w-4 h-4 text-accent" />
              <h2 className="font-semibold text-sm">Live Trade Feed</h2>
              <span className="ml-auto w-2 h-2 rounded-full bg-green animate-pulse" />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '80vh' }}>
              {trades.length === 0 ? (
                <div className="text-center py-8 text-muted text-sm">
                  No trades yet
                </div>
              ) : (
                trades.map((trade) => (
                  <div key={trade.id} className="px-4 py-3 border-b border-border last:border-0 hover:bg-surface transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={clsx(
                        'text-xs font-bold px-2 py-0.5 rounded-full',
                        trade.type === 'buy' ? 'bg-green/20 text-green' : 'bg-red/20 text-red'
                      )}>
                        {trade.type.toUpperCase()}
                      </span>
                      <span className="text-xs text-muted ml-auto">
                        {format(new Date(trade.timestamp), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <p className="text-sm text-text">
                      <span className="font-semibold">{trade.userName}</span>
                      {' '}{trade.type === 'buy' ? 'bought' : 'sold'}{' '}
                      <span className="font-semibold">{trade.shares} share{trade.shares > 1 ? 's' : ''}</span>
                      {' '}of{' '}
                      <span className="text-accent font-semibold">{trade.playerName}</span>
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {formatPrice(trade.price)}/share · Total: {formatPrice(trade.total)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}