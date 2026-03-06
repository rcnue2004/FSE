'use client'
import { useEffect, useState, useMemo } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/db'
import { ParsedPlayerGameStats } from '@/lib/parseCSV'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import clsx from 'clsx'

type ViewMode = 'season' | 'game'
type SortDir = 'asc' | 'desc'

interface SeasonStats {
  playerName: string
  goals: number
  assists: number
  ds: number
  throwaways: number
  drops: number
  turns: number
  catches: number
  completions: number
  throwAttempts: number
  completionPct: number
  catchingPct: number
  pulls: number
  oPointsPlayed: number
  dPointsPlayed: number
  pointsPlayed: number
  plusMinus: number
  gamesPlayed: number
}

const COLUMNS = [
  { key: 'playerName', label: 'Player', title: 'Player' },
  { key: 'plusMinus', label: '+/-', title: 'Plus/Minus' },
  { key: 'goals', label: 'G', title: 'Goals' },
  { key: 'assists', label: 'A', title: 'Assists' },
  { key: 'ds', label: 'D', title: 'Blocks' },
  { key: 'throwaways', label: 'TA', title: 'Throwaways' },
  { key: 'drops', label: 'DR', title: 'Drops' },
  { key: 'catches', label: 'REC', title: 'Catches/Receptions' },
  { key: 'completions', label: 'CMP', title: 'Completions' },
  { key: 'throwAttempts', label: 'ATT', title: 'Throw Attempts' },
  { key: 'completionPct', label: 'CMP%', title: 'Completion %' },
  { key: 'catchingPct', label: 'REC%', title: 'Catch %' },
  { key: 'pulls', label: 'PUL', title: 'Pulls' },
  { key: 'dPointsPlayed', label: 'D-Pts', title: 'Defensive Points Played' },
  { key: 'oPointsPlayed', label: 'O-Pts', title: 'Offensive Points Played' },
  { key: 'pointsPlayed', label: 'Pts', title: 'Points Played' },
  { key: 'gamesPlayed', label: 'GP', title: 'Games Played' },
] as const

type ColKey = typeof COLUMNS[number]['key']

export default function StatsPage() {
  const [gameStats, setGameStats] = useState<ParsedPlayerGameStats[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('season')
  const [sortKey, setSortKey] = useState<ColKey>('plusMinus')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedTournament, setSelectedTournament] = useState<string>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const snap = await getDocs(collection(db, 'gameStats'))
      const data = snap.docs.map(d => d.data() as ParsedPlayerGameStats)
      setGameStats(data)
      setLoading(false)
    }
    load()
  }, [])

  const tournaments = useMemo(() => {
        const t = Array.from(new Set(gameStats.map(g => g.tournamentName))).sort()

    return t
  }, [gameStats])

  const filteredStats = useMemo(() => {
    const filtered = selectedTournament === 'all'
      ? gameStats
      : gameStats.filter(g => g.tournamentName === selectedTournament)

    return filtered.filter(g =>
      g.playerName.toLowerCase().includes(search.toLowerCase())
    )
  }, [gameStats, selectedTournament, search])

  // Aggregate to season totals
  const seasonStats = useMemo((): SeasonStats[] => {
    const map: Record<string, SeasonStats> = {}
    for (const g of filteredStats) {
      if (!map[g.playerName]) {
        map[g.playerName] = {
          playerName: g.playerName,
          goals: 0, assists: 0, ds: 0,
          throwaways: 0, drops: 0, turns: 0,
          catches: 0, completions: 0, throwAttempts: 0,
          completionPct: 0, catchingPct: 0,
          pulls: 0, oPointsPlayed: 0, dPointsPlayed: 0,
          pointsPlayed: 0, plusMinus: 0, gamesPlayed: 0,
        }
      }
      const s = map[g.playerName]
      s.goals += g.goals
      s.assists += g.assists
      s.ds += g.ds
      s.throwaways += g.throwaways
      s.drops += g.drops
      s.turns += g.turns
      s.catches += g.catches
      s.completions += g.completions
      s.throwAttempts += g.throwAttempts
      s.pulls += g.pulls
      s.oPointsPlayed += g.oPointsPlayed
      s.dPointsPlayed += g.dPointsPlayed
      s.pointsPlayed += g.pointsPlayed
      s.gamesPlayed += 1
    }
    return Object.values(map).map(s => ({
      ...s,
      completionPct: (s.completions + s.throwaways) > 0 ? Math.round((s.completions / (s.completions + s.throwaways)) * 100) : 0,
      catchingPct: (s.catches + s.drops) > 0 ? Math.round((s.catches / (s.catches + s.drops)) * 100) : 0,
      plusMinus: s.goals + s.assists + s.ds - s.turns,
    }))
  }, [filteredStats])

  const handleSort = (key: ColKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'playerName' ? 'asc' : 'desc') }
  }

  const sortedSeason = useMemo(() => {
    return [...seasonStats].sort((a, b) => {
      const va = a[sortKey as keyof SeasonStats]
      const vb = b[sortKey as keyof SeasonStats]
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  }, [seasonStats, sortKey, sortDir])

  const sortedGames = useMemo(() => {
    return [...filteredStats].sort((a, b) => {
      const va = a[sortKey as keyof ParsedPlayerGameStats]
      const vb = b[sortKey as keyof ParsedPlayerGameStats]
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  }, [filteredStats, sortKey, sortDir])

  const SortIcon = ({ col }: { col: ColKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 opacity-30" />
    return sortDir === 'desc'
      ? <ChevronDown className="w-3 h-3 text-accent" />
      : <ChevronUp className="w-3 h-3 text-accent" />
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const rows = viewMode === 'season' ? sortedSeason : sortedGames

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-text">Stats</h1>
          <p className="text-muted text-sm mt-1">WOOF Season Statistics</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        {/* View toggle */}
        <div className="flex bg-surface rounded-xl overflow-hidden border border-border">
          <button
            onClick={() => setViewMode('season')}
            className={clsx('px-4 py-2 text-sm font-medium transition-colors',
              viewMode === 'season' ? 'bg-accent text-background' : 'text-muted hover:text-text'
            )}
          >
            Season
          </button>
          <button
            onClick={() => setViewMode('game')}
            className={clsx('px-4 py-2 text-sm font-medium transition-colors',
              viewMode === 'game' ? 'bg-accent text-background' : 'text-muted hover:text-text'
            )}
          >
            By Game
          </button>
        </div>

        {/* Tournament filter */}
        <select
          value={selectedTournament}
          onChange={e => setSelectedTournament(e.target.value)}
          className="bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
        >
          <option value="all">All Tournaments</option>
          {tournaments.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Search */}
        <input
          type="text"
          placeholder="Search player..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent"
        />

        <span className="text-muted text-xs ml-auto">
          {viewMode === 'season' ? `${sortedSeason.length} players` : `${sortedGames.length} game logs`}
        </span>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="text-center py-24 text-muted">
          <p className="text-lg mb-2">No stats yet</p>
          <p className="text-sm">Upload a CSV file from the Admin panel to populate stats</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  {COLUMNS.map(col => (
                    col.key === 'playerName' || viewMode === 'game'
                      ? null
                      : null
                  ))}
                  {viewMode === 'game' && (
                    <>
                      <th
                        onClick={() => handleSort('playerName')}
                        className="text-left px-3 py-3 text-muted font-medium cursor-pointer hover:text-text whitespace-nowrap sticky left-0 bg-surface z-10"
                      >
                        <div className="flex items-center gap-1">
                          Player <SortIcon col="playerName" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('tournamentName' as ColKey)}
                        className="text-left px-3 py-3 text-muted font-medium cursor-pointer hover:text-text whitespace-nowrap"
                      >
                        <div className="flex items-center gap-1">
                          Tournament <SortIcon col={'tournamentName' as ColKey} />
                        </div>
                      </th>
                      <th className="text-left px-3 py-3 text-muted font-medium whitespace-nowrap">
                        Opponent
                      </th>
                    </>
                  )}
                  {viewMode === 'season' && (
                    <th
                      onClick={() => handleSort('playerName')}
                      className="text-left px-3 py-3 text-muted font-medium cursor-pointer hover:text-text whitespace-nowrap sticky left-0 bg-surface z-10"
                    >
                      <div className="flex items-center gap-1">
                        Player <SortIcon col="playerName" />
                      </div>
                    </th>
                  )}
                  {COLUMNS.filter(c => c.key !== 'playerName').map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key as ColKey)}
                                           title={col.title}
                      className="text-center px-3 py-3 text-muted font-medium cursor-pointer hover:text-text whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1 justify-center">
                        {col.label} <SortIcon col={col.key as ColKey} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const isGame = viewMode === 'game'
                  const g = row as any
                  return (
                    <tr
                      key={i}
                      className="border-b border-border/50 last:border-0 hover:bg-surface/50 transition-colors"
                    >
                      {isGame && (
                        <>
                          <td className="px-3 py-2.5 font-semibold text-text sticky left-0 bg-card whitespace-nowrap">{g.playerName}</td>
                          <td className="px-3 py-2.5 text-muted whitespace-nowrap">{g.tournamentName}</td>
                          <td className="px-3 py-2.5 text-muted whitespace-nowrap">vs {g.opponent}</td>
                        </>
                      )}
                      {!isGame && (
                        <td className="px-3 py-2.5 font-semibold text-text sticky left-0 bg-card whitespace-nowrap">{g.playerName}</td>
                      )}
                      <td className={clsx('px-3 py-2.5 text-center font-mono font-bold',
                        g.plusMinus > 0 ? 'text-green' : g.plusMinus < 0 ? 'text-red' : 'text-muted'
                      )}>{g.plusMinus > 0 ? `+${g.plusMinus}` : g.plusMinus}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-green font-bold">{g.goals}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-accent">{g.assists}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-green">{g.ds}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-red">{g.throwaways}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-red">{g.drops}</td>
                      <td className="px-3 py-2.5 text-center font-mono">{g.catches}</td>
                      <td className="px-3 py-2.5 text-center font-mono">{g.completions}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-muted">{g.throwAttempts}</td>
                      <td className={clsx('px-3 py-2.5 text-center font-mono',
                        g.completionPct === 0 ? 'text-muted' : g.completionPct >= 85 ? 'text-green' : 'text-red'
                      )}>{g.completionPct > 0 ? `${g.completionPct}%` : '—'}</td>
                      <td className={clsx('px-3 py-2.5 text-center font-mono',
                        g.catchingPct === 0 ? 'text-muted' : g.catchingPct >= 85 ? 'text-green' : 'text-red'
                      )}>{g.catchingPct > 0 ? `${g.catchingPct}%` : '—'}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-muted">{g.pulls}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-muted">{g.dPointsPlayed}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-muted">{g.oPointsPlayed}</td>
                      <td className="px-3 py-2.5 text-center font-mono">{g.pointsPlayed}</td>
                      {!isGame && <td className="px-3 py-2.5 text-center font-mono text-muted">{g.gamesPlayed}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted mt-4 text-center">
              CMP% = Completions / (Completions + Throwaways) · REC% = Catches / (Catches + Drops) · +/- = Goals+Assists+Ds−(Throwaways+Drops)

      </p>
    </div>
  )
}