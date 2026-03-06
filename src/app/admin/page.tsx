'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getAllPlayers, submitTournamentStats, getMarketSettings, updateMarketSettings, createPlayer, adminUpdateHolding, getLeaderboard, updatePlayer, undoTournamentStats, deleteGameStats } from '@/lib/db'

import { Player, MarketSettings, WeightConfig } from '@/types'
import { formatPrice } from '@/lib/pricing'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Shield, Plus, Settings, Lock, Unlock, Users, Edit2, Check, X, AlertTriangle, Upload } from 'lucide-react'
import clsx from 'clsx'
import { DEFAULT_STARTING_PRICE, MAX_SHARES_PER_PLAYER } from '@/lib/pricing'
import { parseFullCSV } from '@/lib/parseCSV'

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [players, setPlayers] = useState<Player[]>([])
  const [settings, setSettings] = useState<MarketSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'stats' | 'weights' | 'addPlayer' | 'market' | 'holdings' | 'warnings' | 'csvImport' | 'undo'>('stats')
  const [leaderboard, setLeaderboard] = useState<{uid: string; displayName: string; totalValue: number; cash: number; holdings: Record<string, number>}[]>([])
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [editingHolding, setEditingHolding] = useState<{playerId: string; value: string} | null>(null)
  const [savingHolding, setSavingHolding] = useState(false)
  const [viewMode, setViewMode] = useState<'byUser' | 'byPlayer'>('byUser')

  // Tournament stats form
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [tournamentName, setTournamentName] = useState('')
  const [warningPlayer, setWarningPlayer] = useState('')
  const [warningMessage, setWarningMessage] = useState('')
  const [savingWarning, setSavingWarning] = useState(false)
const [csvImporting, setCsvImporting] = useState(false)
  const [csvPreview, setCsvPreview] = useState<any[]>([])
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvSkipped, setCsvSkipped] = useState<string[]>([])
  const [statsOnly, setStatsOnly] = useState(false)
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
    const [ps, s, lb] = await Promise.all([getAllPlayers(), getMarketSettings(), getLeaderboard()])
    setPlayers(ps)
    setSettings(s)
    setWeights(s.weights)
    const lbWithDetails = await Promise.all(
      lb.map(async (entry) => {
        const { getUser } = await import('@/lib/db')
        const u = await getUser(entry.uid)
        return {
          ...entry,
          cash: u?.portfolio.cash || 0,
          holdings: u?.portfolio.holdings || {},
        }
      })
    )
    setLeaderboard(lbWithDetails)
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
    { id: 'warnings', label: 'Warnings' },
    { id: 'csvImport', label: 'CSV Import' },
    { id: 'undo', label: 'Undo' },
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

      {/* Warnings */}
      {activeTab === 'warnings' && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-2">Player Warnings</h2>
          <p className="text-sm text-muted mb-6">Add a caution warning to a player. Users will see a yellow triangle on their card with your message when they hover over it.</p>

          <div className="space-y-4 mb-6">
            <div>
              <label className="text-xs text-muted block mb-1.5">Player</label>
              <select
                value={warningPlayer}
                onChange={e => {
                  setWarningPlayer(e.target.value)
                  const p = players.find(p => p.id === e.target.value)
                  setWarningMessage(p?.warning || '')
                }}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-accent"
              >
                <option value="">Select a player...</option>
                {players.sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.warning ? '⚠️' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted block mb-1.5">Warning Message</label>
              <input
                type="text"
                value={warningMessage}
                onChange={e => setWarningMessage(e.target.value)}
                placeholder="e.g. Broken hand, won't be playing"
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text placeholder-muted focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (!warningPlayer) return
                  setSavingWarning(true)
                  await updatePlayer(warningPlayer, { warning: warningMessage })
                  toast.success('Warning saved!')
                  setSavingWarning(false)
                  load()
                }}
                disabled={!warningPlayer || savingWarning}
                className="flex-1 bg-green text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {savingWarning ? 'Saving...' : 'Save Warning'}
              </button>
              <button
                onClick={async () => {
                  if (!warningPlayer) return
                  setSavingWarning(true)
                  await updatePlayer(warningPlayer, { warning: '' })
                  setWarningMessage('')
                  toast.success('Warning removed')
                  setSavingWarning(false)
                  load()
                }}
                disabled={!warningPlayer || savingWarning}
                className="flex-1 bg-red text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                Remove Warning
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted font-medium">Current Warnings</p>
            {players.filter(p => p.warning).length === 0 ? (
              <p className="text-sm text-muted text-center py-4">No active warnings</p>
            ) : (
              players.filter(p => p.warning).map(p => (
                <div key={p.id} className="flex items-center gap-3 bg-surface rounded-lg px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text">{p.name}</p>
                    <p className="text-xs text-muted">{p.warning}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    
      {/* Holdings Manager */}
      {activeTab === 'holdings' && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-accent" /> Holdings Manager
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('byUser')}
                className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  viewMode === 'byUser' ? 'bg-accent text-background' : 'bg-surface text-muted hover:text-text')}
              >
                By User
              </button>
              <button
                onClick={() => setViewMode('byPlayer')}
                className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  viewMode === 'byPlayer' ? 'bg-accent text-background' : 'bg-surface text-muted hover:text-text')}
              >
                By Player
              </button>
            </div>
          </div>

          {viewMode === 'byUser' && (
            <div className="space-y-3">
              {leaderboard.map((entry) => (
                <div key={entry.uid} className="bg-surface rounded-xl overflow-hidden">
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-border/30 transition-colors"
                    onClick={() => setSelectedUser(selectedUser === entry.uid ? null : entry.uid)}
                  >
                    <div>
                      <p className="font-semibold text-text">{entry.displayName}</p>
                      <p className="text-xs text-muted mt-0.5">
                        Cash: <span className="text-green font-mono">{formatPrice(entry.cash)}</span>
                        {' · '}Total: <span className="text-accent font-mono">{formatPrice(entry.totalValue)}</span>
                      </p>
                    </div>
                    <span className="text-muted text-sm">
                      {Object.values(entry.holdings).filter(v => v > 0).length} positions
                      {selectedUser === entry.uid ? ' ▲' : ' ▼'}
                    </span>
                  </div>

                  {selectedUser === entry.uid && (
                    <div className="border-t border-border">
                      {Object.keys(entry.holdings).filter(pid => entry.holdings[pid] > 0).length === 0 ? (
                        <p className="text-muted text-sm px-4 py-3">No holdings</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left px-4 py-2 text-muted font-medium">Player</th>
                              <th className="text-center px-4 py-2 text-muted font-medium">Shares</th>
                              <th className="text-right px-4 py-2 text-muted font-medium">Value</th>
                              <th className="text-right px-4 py-2 text-muted font-medium">Edit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(entry.holdings)
                              .filter(([, qty]) => qty > 0)
                              .map(([pid, qty]) => {
                                const player = players.find(p => p.id === pid)
                                if (!player) return null
                                const isEditing = editingHolding?.playerId === pid && selectedUser === entry.uid
                                return (
                                  <tr key={pid} className="border-b border-border/50 last:border-0">
                                    <td className="px-4 py-2 text-text">{player.name}</td>
                                    <td className="px-4 py-2 text-center">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          min={0}
                                          max={10}
                                          value={editingHolding.value}
                                          onChange={e => setEditingHolding({ playerId: pid, value: e.target.value })}
                                          className="w-16 bg-background border border-accent rounded px-2 py-1 text-center text-sm font-mono focus:outline-none"
                                          autoFocus
                                        />
                                      ) : (
                                        <span className="font-mono font-bold">{qty}</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2 text-right font-mono text-accent">
                                      {formatPrice(player.currentPrice * qty)}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                      {isEditing ? (
                                        <div className="flex gap-1 justify-end">
                                          <button
                                            onClick={async () => {
                                              setSavingHolding(true)
                                              try {
                                                await adminUpdateHolding(entry.uid, pid, parseInt(editingHolding.value) || 0)
                                                toast.success('Holdings updated')
                                                setEditingHolding(null)
                                                load()
                                              } catch (e: any) {
                                                toast.error(e.message)
                                              } finally {
                                                setSavingHolding(false)
                                              }
                                            }}
                                            disabled={savingHolding}
                                            className="text-green hover:opacity-80 p-1"
                                          >
                                            <Check className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => setEditingHolding(null)}
                                            className="text-red hover:opacity-80 p-1"
                                          >
                                            <X className="w-4 h-4" />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setEditingHolding({ playerId: pid, value: String(qty) })}
                                          className="text-muted hover:text-accent transition-colors p-1"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {viewMode === 'byPlayer' && (
            <div className="space-y-3">
              {players.sort((a, b) => a.name.localeCompare(b.name)).map((player) => {
                const owners = leaderboard.filter(u => (u.holdings[player.id] || 0) > 0)
                return (
                  <div key={player.id} className="bg-surface rounded-xl overflow-hidden">
                    <div
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-border/30 transition-colors"
                      onClick={() => setSelectedUser(selectedUser === player.id ? null : player.id)}
                    >
                      <div>
                        <p className="font-semibold text-text">{player.name}</p>
                        <p className="text-xs text-muted mt-0.5">
                          Price: <span className="text-accent font-mono">{formatPrice(player.currentPrice)}</span>
                          {' · '}Available: <span className="font-mono">{player.sharesAvailable}/{player.totalShares}</span>
                        </p>
                      </div>
                      <span className="text-muted text-sm">
                        {owners.length} owner{owners.length !== 1 ? 's' : ''}
                        {selectedUser === player.id ? ' ▲' : ' ▼'}
                      </span>
                    </div>

                    {selectedUser === player.id && (
                      <div className="border-t border-border">
                        {owners.length === 0 ? (
                          <p className="text-muted text-sm px-4 py-3">No one owns this player</p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left px-4 py-2 text-muted font-medium">User</th>
                                <th className="text-center px-4 py-2 text-muted font-medium">Shares</th>
                                <th className="text-right px-4 py-2 text-muted font-medium">Value</th>
                                <th className="text-right px-4 py-2 text-muted font-medium">Edit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {owners.map((entry) => {
                                const qty = entry.holdings[player.id] || 0
                                const isEditing = editingHolding?.playerId === `${player.id}-${entry.uid}`
                                return (
                                  <tr key={entry.uid} className="border-b border-border/50 last:border-0">
                                    <td className="px-4 py-2 text-text">{entry.displayName}</td>
                                    <td className="px-4 py-2 text-center">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          min={0}
                                          max={10}
                                          value={editingHolding.value}
                                          onChange={e => setEditingHolding({ playerId: `${player.id}-${entry.uid}`, value: e.target.value })}
                                          className="w-16 bg-background border border-accent rounded px-2 py-1 text-center text-sm font-mono focus:outline-none"
                                          autoFocus
                                        />
                                      ) : (
                                        <span className="font-mono font-bold">{qty}</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2 text-right font-mono text-accent">
                                      {formatPrice(player.currentPrice * qty)}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                      {isEditing ? (
                                        <div className="flex gap-1 justify-end">
                                          <button
                                            onClick={async () => {
                                              setSavingHolding(true)
                                              try {
                                                await adminUpdateHolding(entry.uid, player.id, parseInt(editingHolding.value) || 0)
                                                toast.success('Holdings updated')
                                                setEditingHolding(null)
                                                load()
                                              } catch (e: any) {
                                                toast.error(e.message)
                                              } finally {
                                                setSavingHolding(false)
                                              }
                                            }}
                                            disabled={savingHolding}
                                            className="text-green hover:opacity-80 p-1"
                                          >
                                            <Check className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => setEditingHolding(null)}
                                            className="text-red hover:opacity-80 p-1"
                                          >
                                            <X className="w-4 h-4" />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setEditingHolding({ playerId: `${player.id}-${entry.uid}`, value: String(qty) })}
                                          className="text-muted hover:text-accent transition-colors p-1"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    {/* CSV Import */}
      {activeTab === 'csvImport' && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-2">CSV Stat Import</h2>
          <p className="text-sm text-muted mb-6">
            Upload your stats CSV file. Stats for tournaments that already exist on a player will be automatically skipped to prevent duplicates.
          </p>

          <div className="space-y-4">
            <label className={`
              flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors
              ${csvFile ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50 hover:bg-surface'}
            `}>
              <Upload className="w-8 h-8 text-muted mb-2" />
              <span className="text-sm text-muted">
                {csvFile ? csvFile.name : 'Click to upload .csv file'}
              </span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setCsvFile(file)
                  setCsvPreview([])
                  setCsvSkipped([])

                  const text = await file.text()
                  const { tournamentStats: parsed, gameStats: parsedGames } = parseFullCSV(text)
                  // Store game stats for saving later
                  ;(window as any).__pendingGameStats = parsedGames

                  const skipped: string[] = []
                  const toImport: any[] = []

                  for (const stat of parsed) {
                    const player = players.find(p =>
                      p.name.toLowerCase() === stat.playerName.toLowerCase()
                    )
                    if (!player) {
                      skipped.push(`${stat.playerName} (player not found in market)`)
                      continue
                    }
                    const alreadyExists = player.tournamentStats.some(
                      t => t.tournamentName.toLowerCase() === stat.tournamentName.toLowerCase()
                    )
                    if (alreadyExists && !statsOnly) {
                      skipped.push(`${stat.playerName} — ${stat.tournamentName} (already uploaded)`)
                      continue
                    }
                    toImport.push({ ...stat, playerId: player.id, isDuplicate: alreadyExists })
                  }

                  setCsvPreview(toImport)
                  setCsvSkipped(skipped)
                }}
              />
            </label>

<label className="flex items-center gap-3 cursor-pointer bg-surface border border-border rounded-xl px-4 py-3">
              <input
                type="checkbox"
                checked={statsOnly}
                onChange={e => setStatsOnly(e.target.checked)}
                className="w-4 h-4 accent-accent"
              />
              <div>
                <p className="text-sm font-medium text-text">Stats only — don't update stock prices</p>
                <p className="text-xs text-muted">Use this to import historical stats without affecting current prices</p>
              </div>
            </label>
            {csvPreview.length > 0 && (
              <div>
                <p className="text-sm font-medium text-text mb-2">
                  Ready to import {csvPreview.length} player stat{csvPreview.length > 1 ? 's' : ''}:
                </p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {csvPreview.map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 text-sm">
                      <span className="font-medium text-text">{s.playerName}</span>
                      <span className="text-muted">{s.tournamentName}</span>
                      <span className="text-xs font-mono">
                        <span className="text-green">G{s.goals}</span>{' '}
                        <span className="text-accent">A{s.assists}</span>{' '}
                        <span className="text-yellow-400">D{s.ds}</span>{' '}
                        <span className="text-red">T{s.turns}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {csvSkipped.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted mb-2">
                  Skipping {csvSkipped.length} (duplicates or unknown players):
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {csvSkipped.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 bg-surface rounded-lg px-3 py-2 text-sm text-muted">
                      <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0" />
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {csvPreview.length > 0 && (
              <button
                onClick={async () => {
                  setCsvImporting(true)
                  let imported = 0
                  try {
                    for (const stat of csvPreview) {
                      if (!statsOnly && !stat.isDuplicate) {
                        await submitTournamentStats(stat.playerId, {
                          tournamentId: `${stat.tournamentName}-${stat.date}`,
                          tournamentName: stat.tournamentName,
                          date: stat.date,
                          goals: stat.goals,
                          assists: stat.assists,
                          ds: stat.ds,
                          turns: stat.turns,
                          priceChange: 0,
                        }, weights)
                      }
                      imported++
                    }
                       // Save game stats to Firestore
                    const { collection: col, addDoc } = await import('firebase/firestore')
                    const { db: firedb } = await import('@/lib/db')
                    const pendingGames = (window as any).__pendingGameStats || []
                    for (const gs of pendingGames) {
                      if (csvPreview.some((s: any) => s.playerName === gs.playerName && s.tournamentName === gs.tournamentName)) {
                        await addDoc(col(firedb, 'gameStats'), gs)
                      }
                    }
                    toast.success(`Imported stats for ${imported} players!`)
                    setCsvPreview([])
                    setCsvFile(null)
                    setCsvSkipped([])
                    load()
                  } catch (e: any) {
                    toast.error('Import failed: ' + e.message)
                  } finally {
                    setCsvImporting(false)
                  }
                }}
                disabled={csvImporting}
                className="w-full bg-accent text-background py-3 rounded-xl font-semibold text-sm hover:bg-accent-dim transition-colors disabled:opacity-50"
              >
                {csvImporting ? `Importing...` : `Import ${csvPreview.length} Players`}
              </button>
            )}
          </div>
        </div>
      )}  {/* Undo */}
      {activeTab === 'undo' && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-2">Undo Stat Submissions</h2>
          <p className="text-sm text-muted mb-6">
            Remove a tournament's stats from a player and revert their stock price to what it was before.
          </p>
          <div className="space-y-3">
            {players
              .filter(p => p.tournamentStats && p.tournamentStats.length > 0)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(player => (
                <div key={player.id} className="bg-surface rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="font-semibold text-text">{player.name}</p>
                    <p className="text-xs text-muted font-mono">{formatPrice(player.currentPrice)}</p>
                  </div>
                  <div className="divide-y divide-border/50">
                    {player.tournamentStats.map(stat => (
                      <div key={stat.tournamentId} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm text-text font-medium">{stat.tournamentName}</p>
                          <p className="text-xs text-muted font-mono">
                            G{stat.goals} A{stat.assists} D{stat.ds} T{stat.turns} ·{' '}
                            <span className={stat.priceChange >= 0 ? 'text-green' : 'text-red'}>
                              {stat.priceChange >= 0 ? '+' : ''}{formatPrice(stat.priceChange)}
                            </span>
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            if (!confirm(`Undo ${stat.tournamentName} stats for ${player.name}? Price will revert by ${formatPrice(stat.priceChange)}.`)) return
                            try {
                              await undoTournamentStats(player.id, stat.tournamentId)
                              await deleteGameStats(stat.tournamentName)
                              toast.success(`Undone ${stat.tournamentName} for ${player.name}`)
                              load()
                            } catch (e: any) {
                              toast.error(e.message)
                            }
                          }}
                          className="text-xs bg-red/20 text-red px-3 py-1.5 rounded-lg hover:bg-red/30 transition-colors font-medium"
                        >
                          Undo
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            {players.filter(p => p.tournamentStats && p.tournamentStats.length > 0).length === 0 && (
              <p className="text-muted text-sm text-center py-8">No stat submissions yet</p>
            )}
          </div>
        </div>
      )}</div>
  )
}