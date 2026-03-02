'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getAllPlayers, submitTournamentStats, getMarketSettings, updateMarketSettings, createPlayer } from '@/lib/db'
import { Player, MarketSettings, WeightConfig } from '@/types'
import { formatPrice } from '@/lib/pricing'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Shield, Plus, Settings, Lock, Unlock, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { DEFAULT_STARTING_PRICE, MAX_SHARES_PER_PLAYER } from '@/lib/pricing'

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [players, setPlayers] = useState<Player[]>([])
  const [settings, setSettings] = useState<MarketSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'stats' | 'weights' | 'addPlayer' | 'market'>('stats')

  // Tournament stats form
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [tournamentName, setTournamentName] = useState('')
  const [tournamentDate, setTournamentDate] = useState(new Date().toISOString().split('T')[0])
  const [goals, setGoals] = useState(0)
  const [assists, setAssists] = useState(0)
  const [ds, setDs] = useState(0)
  const [turns, setTurns] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // Add player form
  const [newName, setNewName] = useState('')
const [newTeam, setNewTeam] = useState('')
const [newPosition, setNewPosition] = useState('Handler')
const [newStartingPrice, setNewStartingPrice] = useState(100)

  // Weights form
  const [weights, setWeights] = useState<WeightConfig>({ goals: 2.5, assists: 2.0, ds: 1.5, turns: -1.0 })

  const load = async () => {
    const [ps, s] = await Promise.all([getAllPlayers(), getMarketSettings()])
    setPlayers(ps)
    setSettings(s)
    setWeights(s.weights)
    setLoading(false)
  }

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth')
    if (!authLoading && user && !user.isAdmin) router.push('/')
  }, [user, authLoading])

  useEffect(() => { if (user?.isAdmin) load() }, [user])

  const handleSubmitStats = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlayer || !tournamentName) return toast.error('Select a player and tournament name')
    setSubmitting(true)
    try {
      await submitTournamentStats(selectedPlayer, {
        tournamentId: `${tournamentName}-${tournamentDate}`,
        tournamentName,
        date: new Date(tournamentDate).toISOString(),
        goals, assists, ds, turns,
        priceChange: 0,
      }, weights)
      toast.success('Stats submitted! Prices updated.')
      setGoals(0); setAssists(0); setDs(0); setTurns(0)
      setTournamentName('')
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveWeights = async () => {
    await updateMarketSettings({ weights })
    toast.success('Weights saved')
  }

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName || !newTeam) return
    await createPlayer({
      name: newName,
      team: newTeam,
      position: newPosition,
      currentPrice: newStartingPrice,
      previousPrice: newStartingPrice,
      priceHistory: [{ date: new Date().toISOString(), price: newStartingPrice, tournamentName: 'IPO' }],
      tournamentStats: [],
      sharesAvailable: MAX_SHARES_PER_PLAYER,
      totalShares: MAX_SHARES_PER_PLAYER,
      createdAt: new Date().toISOString(),
    })
    toast.success(`${newName} added to the market!`)
    setNewName(''); setNewTeam(''); setNewStartingPrice(100)
    load()
  }

  const handleToggleMarket = async () => {
    if (!settings) return
    await updateMarketSettings({ isOpen: !settings.isOpen })
    setSettings({ ...settings, isOpen: !settings.isOpen })
    toast.success(settings.isOpen ? 'Market closed' : 'Market opened')
  }

  if (authLoading || loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!user?.isAdmin) return null

  const tabs = [
    { id: 'stats', label: 'Submit Stats' },
    { id: 'addPlayer', label: 'Add Player' },
    { id: 'weights', label: 'Price Weights' },
    { id: 'market', label: 'Market Control' },
  ] as const

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-6 h-6 text-yellow-400" />
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <span className={clsx(
          'ml-auto text-xs font-medium px-3 py-1 rounded-full',
          settings?.isOpen ? 'bg-green/20 text-green' : 'bg-red/20 text-red'
        )}>
          Market {settings?.isOpen ? 'Open' : 'Closed'}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              activeTab === tab.id ? 'bg-accent text-background' : 'bg-surface text-muted hover:text-text'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Submit Stats */}
      {activeTab === 'stats' && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Submit Tournament Stats</h2>
          <form onSubmit={handleSubmitStats} className="space-y-4">
            <div>
              <label className="text-xs text-muted block mb-1.5">Player</label>
              <select
                value={selectedPlayer}
                onChange={e => setSelectedPlayer(e.target.value)}
                required
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-accent"
              >
                <option value="">Select a player...</option>
                {players.sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {formatPrice(p.currentPrice)}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted block mb-1.5">Tournament Name</label>
                <input
                  type="text"
                  value={tournamentName}
                  onChange={e => setTournamentName(e.target.value)}
                  required
                  placeholder="e.g. Nationals 2025"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text placeholder-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1.5">Date</label>
                <input
                  type="date"
                  value={tournamentDate}
                  onChange={e => setTournamentDate(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Goals', val: goals, set: setGoals, color: 'text-green' },
                { label: 'Assists', val: assists, set: setAssists, color: 'text-accent' },
                { label: 'Ds', val: ds, set: setDs, color: 'text-yellow-400' },
                { label: 'Turns', val: turns, set: setTurns, color: 'text-red' },
              ].map(({ label, val, set, color }) => (
                <div key={label}>
                  <label className={clsx('text-xs block mb-1.5', color)}>{label}</label>
                  <input
                    type="number"
                    min={0}
                    value={val}
                    onChange={e => set(parseInt(e.target.value) || 0)}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-3 text-sm text-text text-center focus:outline-none focus:border-accent font-mono"
                  />
                </div>
              ))}
            </div>

            {/* Preview */}
            {selectedPlayer && (
              <div className="bg-surface rounded-xl p-3 text-sm">
                <p className="text-muted mb-1">Price change preview:</p>
                <p className={clsx(
                  'font-mono font-bold text-lg',
                  (goals * weights.goals + assists * weights.assists + ds * weights.ds + turns * weights.turns) >= 0 ? 'text-green' : 'text-red'
                )}>
                  {(() => {
                    const change = goals * weights.goals + assists * weights.assists + ds * weights.ds + turns * weights.turns
                    return `${change >= 0 ? '+' : ''}$${change.toFixed(2)}`
                  })()}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-accent text-background py-3 rounded-xl font-semibold text-sm hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {submitting ? 'Updating...' : 'Submit & Update Prices'}
            </button>
          </form>
        </div>
      )}

      {/* Add Player */}
      {activeTab === 'addPlayer' && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Add Player to Market</h2>
          <form onSubmit={handleAddPlayer} className="space-y-4">
            <div>
              <label className="text-xs text-muted block mb-1.5">Player Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                required
                placeholder="Full name"
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text placeholder-muted focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1.5">Team</label>
              <input
                type="text"
                value={newTeam}
                onChange={e => setNewTeam(e.target.value)}
                required
                placeholder="Team name"
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text placeholder-muted focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1.5">Position</label>
              <select
                value={newPosition}
                onChange={e => setNewPosition(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-accent"
              >
                <option>Handler</option>
                <option>Cutter</option>
                <option>Hybrid</option>
              </select>
            </div>
            <div>
  <label className="text-xs text-muted block mb-1.5">Starting Price ($)</label>
  <input
    type="number"
    min={1}
    value={newStartingPrice}
    onChange={e => setNewStartingPrice(parseFloat(e.target.value) || 100)}
    className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text placeholder-muted focus:outline-none focus:border-accent"
  />
</div>
<p className="text-xs text-muted">{MAX_SHARES_PER_PLAYER} shares available</p>
            <button type="submit" className="w-full bg-accent text-background py-3 rounded-xl font-semibold text-sm hover:bg-accent-dim transition-colors">
              Add Player
            </button>
          </form>

          <div className="mt-6 space-y-2">
            <p className="text-sm text-muted font-medium">Active Players ({players.length})</p>
            {players.sort((a,b) => a.name.localeCompare(b.name)).map(p => (
              <div key={p.id} className="flex justify-between items-center bg-surface rounded-lg px-3 py-2 text-sm">
                <span>{p.name}</span>
                <span className="text-muted">{p.team}</span>
                <span className="font-mono text-accent">{formatPrice(p.currentPrice)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weights */}
      {activeTab === 'weights' && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-2">Pricing Weights</h2>
          <p className="text-sm text-muted mb-6">
            Formula: New Price = Old Price + (Goals × {weights.goals}) + (Assists × {weights.assists}) + (Ds × {weights.ds}) + (Turns × {weights.turns})
          </p>
          <div className="space-y-4">
            {[
              { label: 'Goals Weight', key: 'goals' as const, color: 'text-green' },
              { label: 'Assists Weight', key: 'assists' as const, color: 'text-accent' },
              { label: 'Ds Weight', key: 'ds' as const, color: 'text-yellow-400' },
              { label: 'Turns Weight (use negative)', key: 'turns' as const, color: 'text-red' },
            ].map(({ label, key, color }) => (
              <div key={key}>
                <label className={clsx('text-xs block mb-1.5', color)}>{label}</label>
                <input
                  type="number"
                  step="0.1"
                  value={weights[key]}
                  onChange={e => setWeights(w => ({ ...w, [key]: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text font-mono focus:outline-none focus:border-accent"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSaveWeights}
            className="w-full mt-6 bg-accent text-background py-3 rounded-xl font-semibold text-sm hover:bg-accent-dim transition-colors"
          >
            Save Weights
          </button>
          <p className="text-xs text-muted text-center mt-2">Note: Changing weights only affects future stat submissions</p>
        </div>
      )}

      {/* Market Control */}
      {activeTab === 'market' && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Market Control</h2>
          <div className="bg-surface rounded-xl p-4 mb-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Market Status</p>
                <p className="text-sm text-muted mt-0.5">
                  {settings?.isOpen ? 'Trades are currently allowed' : 'Market is closed — no trades allowed'}
                </p>
              </div>
              <button
                onClick={handleToggleMarket}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors',
                  settings?.isOpen ? 'bg-red text-background hover:opacity-90' : 'bg-green text-background hover:opacity-90'
                )}
              >
                {settings?.isOpen ? <><Lock className="w-4 h-4" /> Close Market</> : <><Unlock className="w-4 h-4" /> Open Market</>}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted">Close the market during active tournaments. Reopen when ready to allow trading.</p>
        </div>
      )}
    </div>
  )
}
