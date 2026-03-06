'use client'
import { useEffect, useState, useMemo } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/db'
import { ParsedPlayerGameStats } from '@/lib/parseCSV'
import { ChevronUp, ChevronDown, ChevronsUpDown, Filter, X, Clock } from 'lucide-react'
import clsx from 'clsx'

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
  const [historicalStats, setHistoricalStats] = useState<(ParsedPlayerGameStats & { season: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'current' | 'historical'>('current')
  const [sortKey, setSortKey] = useState<ColKey>('plusMinus')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [showGameFilter, setShowGameFilter] = useState(false)
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set())
  const [histShowGameFilter, setHistShowGameFilter] = useState(false)
  const [histSelectedGames, setHistSelectedGames] = useState<Set<string>>(new Set())
  const [histSelectedSeasons, setHistSelectedSeasons] = useState<Set<string>>(new Set())
  const [histSortKey, setHistSortKey] = useState<ColKey>('plusMinus')
  const [histSortDir, setHistSortDir] = useState<SortDir>('desc')
  const [histSearch, setHistSearch] = useState('')

  useEffect(() => {
    async function load() {
      const [currentSnap, histSnap] = await Promise.all([
        getDocs(collection(db, 'gameStats')),
        getDocs(collection(db, 'historicalStats')),
      ])
      const currentData = currentSnap.docs.map(d => d.data() as ParsedPlayerGameStats)
      const histData = histSnap.docs.map(d => d.data() as ParsedPlayerGameStats & { season: string })
      setGameStats(currentData)
      setHistoricalStats(histData)
      setLoading(false)
    }
    load()
  }, [])

  const tournaments = useMemo(() => {
    return Array.from(new Set(gameStats.map(g => g.tournamentName))).sort()
  }, [gameStats])

  const allGames = useMemo(() => {
    const seen = new Set<string>()
    const games: { key: string; tournament: string; opponent: string; date: string }[] = []
    gameStats.forEach(g => {
      const key = `${g.tournamentName}__${g.opponent}`
      if (!seen.has(key)) {
        seen.add(key)
        games.push({
          key,
          tournament: g.tournamentName,
          opponent: g.opponent,
          date: new Date(g.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        })
      }
    })
    return games.sort((a, b) => a.tournament.localeCompare(b.tournament) || a.opponent.localeCompare(b.opponent))
  }, [gameStats])

  // Historical combined = current + historical
  const combinedStats = useMemo(() => {
    const currentWithSeason = gameStats.map(g => ({
      ...g,
      season: new Date(g.date).getFullYear().toString(),
    }))
    return [...currentWithSeason, ...historicalStats]
  }, [gameStats, historicalStats])

  const histSeasons = useMemo(() => {
    return Array.from(new Set(combinedStats.map(g => g.season))).sort((a, b) => b.localeCompare(a))
  }, [combinedStats])

  const histAllGames = useMemo(() => {
    const seen = new Set<string>()
    const games: { key: string; tournament: string; opponent: string; date: string; season: string }[] = []
    combinedStats.forEach(g => {
      const key = `${g.season}__${(g as any).tournamentName}__${g.opponent}`
      if (!seen.has(key)) {
        seen.add(key)
        games.push({
          key,
          tournament: (g as any).tournamentName,
          opponent: g.opponent,
          date: new Date(g.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          season: (g as any).season,
        })
      }
    })
    return games.sort((a, b) => b.season.localeCompare(a.season) || a.tournament.localeCompare(b.tournament))
  }, [combinedStats])

  useEffect(() => {
    if (histAllGames.length > 0 && histSelectedGames.size === 0) {
      setHistSelectedGames(new Set(histAllGames.map(g => g.key)))
      setHistSelectedSeasons(new Set(histSeasons))
    }
  }, [histAllGames])

  const histFilteredStats = useMemo(() => {
    return combinedStats.filter(g => {
      const key = `${(g as any).season}__${(g as any).tournamentName}__${g.opponent}`
      return histSelectedGames.has(key) && g.playerName.toLowerCase().includes(histSearch.toLowerCase())
    })
  }, [combinedStats, histSelectedGames, histSearch])

  const histSeasonStats = useMemo((): SeasonStats[] => {
    const map: Record<string, SeasonStats> = {}
    for (const g of histFilteredStats) {
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
      s.goals += g.goals; s.assists += g.assists; s.ds += g.ds
      s.throwaways += g.throwaways; s.drops += g.drops; s.turns += g.turns
      s.catches += g.catches; s.completions += g.completions
      s.throwAttempts += g.throwAttempts; s.pulls += g.pulls
      s.oPointsPlayed += g.oPointsPlayed; s.dPointsPlayed += g.dPointsPlayed
      s.pointsPlayed += g.pointsPlayed; s.gamesPlayed += 1
    }
    return Object.values(map).map(s => ({
      ...s,
      completionPct: (s.completions + s.throwaways) > 0 ? Math.round((s.completions / (s.completions + s.throwaways)) * 100) : 0,
      catchingPct: (s.catches + s.drops) > 0 ? Math.round((s.catches / (s.catches + s.drops)) * 100) : 0,
      plusMinus: s.goals + s.assists + s.ds - s.turns,
    }))
  }, [histFilteredStats])

  const sortedHistSeason = useMemo(() => {
    return [...histSeasonStats].sort((a, b) => {
      const va = a[histSortKey as keyof SeasonStats]
      const vb = b[histSortKey as keyof SeasonStats]
      if (typeof va === 'string' && typeof vb === 'string') {
        return histSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      return histSortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  }, [histSeasonStats, histSortKey, histSortDir])

  const handleHistSort = (key: ColKey) => {
    if (histSortKey === key) setHistSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setHistSortKey(key); setHistSortDir(key === 'playerName' ? 'asc' : 'desc') }
  }

  const HistSortIcon = ({ col }: { col: ColKey }) => {
    if (histSortKey !== col) return <ChevronsUpDown className="w-3 h-3 opacity-30" />
    return histSortDir === 'desc'
      ? <ChevronDown className="w-3 h-3 text-accent" />
      : <ChevronUp className="w-3 h-3 text-accent" />
  }

  useEffect(() => {
    if (allGames.length > 0) {
      setSelectedGames(new Set(allGames.map(g => g.key)))
    }
  }, [allGames])
const filteredStats = useMemo(() => {
    return gameStats.filter(g => {
      const key = `${g.tournamentName}__${g.opponent}`
      return selectedGames.has(key) && g.playerName.toLowerCase().includes(search.toLowerCase())
    })
  }, [gameStats, selectedGames, search])

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

  const rows = sortedSeason

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-text">Stats</h1>
          <p className="text-muted text-sm mt-1">WOOF Season Statistics</p>
        </div>
        <div className="flex bg-surface rounded-xl overflow-hidden border border-border">
          <button
            onClick={() => setActiveView('current')}
            className={clsx('px-4 py-2 text-sm font-medium transition-colors',
              activeView === 'current' ? 'bg-accent text-background' : 'text-muted hover:text-text'
            )}
          >
            Current
          </button>
          <button
            onClick={() => setActiveView('historical')}
            className={clsx('px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5',
              activeView === 'historical' ? 'bg-accent text-background' : 'text-muted hover:text-text'
            )}
          >
            <Clock className="w-3.5 h-3.5" /> Historical
          </button>
        </div>
      </div>

      {activeView === 'current' && <div>
      <div className="flex flex-wrap gap-3 mb-6 items-center">

        {/* Games Filter */}
        <div className="relative">
          <button
            onClick={() => setShowGameFilter(!showGameFilter)}
            className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text hover:border-accent transition-colors"
          >
            <Filter className="w-4 h-4 text-muted" />
            Games Filter
            {selectedGames.size < allGames.length && (
              <span className="bg-accent text-background text-xs font-bold px-1.5 py-0.5 rounded-full">
                {selectedGames.size}
              </span>
            )}
          </button>

          {showGameFilter && (
            <div className="absolute top-10 left-0 z-50 bg-card border border-border rounded-xl shadow-xl w-72 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                  <Filter className="w-4 h-4 text-accent" /> Games Filter
                </h3>
                <button onClick={() => setShowGameFilter(false)} className="text-muted hover:text-text">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setSelectedGames(new Set(allGames.map(g => g.key)))}
                  className="flex-1 text-xs bg-accent text-background py-1.5 rounded-lg font-medium hover:opacity-90"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedGames(new Set())}
                  className="flex-1 text-xs bg-surface border border-border text-muted py-1.5 rounded-lg font-medium hover:text-text"
                >
                  Deselect All
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {tournaments.map(tournament => {
                  const games = allGames.filter(g => g.tournament === tournament)
                  const allSelected = games.every(g => selectedGames.has(g.key))
                  const someSelected = games.some(g => selectedGames.has(g.key))
                  return (
                    <div key={tournament}>
                      {/* Tournament row */}
                      <label className="flex items-center gap-2 cursor-pointer py-1 hover:bg-surface rounded-lg px-2">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                          onChange={() => {
                            const next = new Set(selectedGames)
                            if (allSelected) {
                              games.forEach(g => next.delete(g.key))
                            } else {
                              games.forEach(g => next.add(g.key))
                            }
                            setSelectedGames(next)
                          }}
                          className="w-4 h-4 accent-accent"
                        />
                        <span className="text-sm font-semibold text-text">{tournament}</span>
                      </label>
                      {/* Individual games */}
                      {games.map(game => (
                        <label key={game.key} className="flex items-center justify-between gap-2 cursor-pointer py-1 pl-8 pr-2 hover:bg-surface rounded-lg">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedGames.has(game.key)}
                              onChange={() => {
                                const next = new Set(selectedGames)
                                if (selectedGames.has(game.key)) next.delete(game.key)
                                else next.add(game.key)
                                setSelectedGames(next)
                              }}
                              className="w-3.5 h-3.5 accent-accent"
                            />
                            <span className="text-sm text-muted">{game.opponent}</span>
                          </div>
                          <span className="text-xs text-muted">{game.date}</span>
                        </label>
                      ))}
                    </div>
                  )
                })}
              </div>

              <button
                onClick={() => setShowGameFilter(false)}
                className="w-full mt-3 bg-surface border border-border text-text text-sm py-2 rounded-lg hover:border-accent transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search player..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent"
        />

        <span className="text-muted text-xs ml-auto">
          {sortedSeason.length} players
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
                  <th
                    onClick={() => handleSort('playerName')}
                    className="text-left px-3 py-3 text-muted font-medium cursor-pointer hover:text-text whitespace-nowrap sticky left-0 bg-surface z-10"
                  >
                    <div className="flex items-center gap-1">
                      Player <SortIcon col="playerName" />
                    </div>
                  </th>
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
                  const g = row as any
                  return (
                    <tr
                      key={i}
                      className="border-b border-border/50 last:border-0 hover:bg-surface/50 transition-colors"
                    >
                      <td className="px-3 py-2.5 font-semibold text-text sticky left-0 bg-card whitespace-nowrap">{g.playerName}</td>
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
                      <td className="px-3 py-2.5 text-center font-mono text-muted">{g.gamesPlayed}</td>

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
      </div>}

      {/* Historical Section */}
      {activeView === 'historical' && (
        <div className="mt-10">
          <div className="flex flex-wrap gap-3 mb-6 items-center">
            {/* Historical Games Filter */}
            <div className="relative">
              <button
                onClick={() => setHistShowGameFilter(!histShowGameFilter)}
                className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text hover:border-accent transition-colors"
              >
                <Filter className="w-4 h-4 text-muted" />
                Games Filter
                {histSelectedGames.size < histAllGames.length && (
                  <span className="bg-accent text-background text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {histSelectedGames.size}
                  </span>
                )}
              </button>

              {histShowGameFilter && (
                <div className="absolute top-10 left-0 z-50 bg-card border border-border rounded-xl shadow-xl w-80 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                      <Filter className="w-4 h-4 text-accent" /> Games Filter
                    </h3>
                    <button onClick={() => setHistShowGameFilter(false)} className="text-muted hover:text-text">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setHistSelectedGames(new Set(histAllGames.map(g => g.key)))}
                      className="flex-1 text-xs bg-accent text-background py-1.5 rounded-lg font-medium hover:opacity-90"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setHistSelectedGames(new Set())}
                      className="flex-1 text-xs bg-surface border border-border text-muted py-1.5 rounded-lg font-medium hover:text-text"
                    >
                      Deselect All
                    </button>
                  </div>

                  <div className="space-y-3 max-h-72 overflow-y-auto">
                    {histSeasons.map(season => {
                      const seasonGames = histAllGames.filter(g => g.season === season)
                      const tournaments = Array.from(new Set(seasonGames.map(g => g.tournament)))
                      const allSeasonSelected = seasonGames.every(g => histSelectedGames.has(g.key))
                      const someSeasonSelected = seasonGames.some(g => histSelectedGames.has(g.key))
                      return (
                        <div key={season}>
                          {/* Season header */}
                          <label className="flex items-center gap-2 cursor-pointer py-1 hover:bg-surface rounded-lg px-2">
                            <input
                              type="checkbox"
                              checked={allSeasonSelected}
                              ref={el => { if (el) el.indeterminate = someSeasonSelected && !allSeasonSelected }}
                              onChange={() => {
                                const next = new Set(histSelectedGames)
                                if (allSeasonSelected) seasonGames.forEach(g => next.delete(g.key))
                                else seasonGames.forEach(g => next.add(g.key))
                                setHistSelectedGames(next)
                              }}
                              className="w-4 h-4 accent-accent"
                            />
                            <span className="text-sm font-bold text-accent">{season}</span>
                          </label>
                          {tournaments.map(tournament => {
                            const tourneyGames = seasonGames.filter(g => g.tournament === tournament)
                            const allTourneySelected = tourneyGames.every(g => histSelectedGames.has(g.key))
                            const someTourneySelected = tourneyGames.some(g => histSelectedGames.has(g.key))
                            return (
                              <div key={tournament} className="ml-4">
                                <label className="flex items-center gap-2 cursor-pointer py-1 hover:bg-surface rounded-lg px-2">
                                  <input
                                    type="checkbox"
                                    checked={allTourneySelected}
                                    ref={el => { if (el) el.indeterminate = someTourneySelected && !allTourneySelected }}
                                    onChange={() => {
                                      const next = new Set(histSelectedGames)
                                      if (allTourneySelected) tourneyGames.forEach(g => next.delete(g.key))
                                      else tourneyGames.forEach(g => next.add(g.key))
                                      setHistSelectedGames(next)
                                    }}
                                    className="w-3.5 h-3.5 accent-accent"
                                  />
                                  <span className="text-sm font-semibold text-text">{tournament}</span>
                                </label>
                                {tourneyGames.map(game => (
                                  <label key={game.key} className="flex items-center justify-between gap-2 cursor-pointer py-1 pl-8 pr-2 hover:bg-surface rounded-lg">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={histSelectedGames.has(game.key)}
                                        onChange={() => {
                                          const next = new Set(histSelectedGames)
                                          if (histSelectedGames.has(game.key)) next.delete(game.key)
                                          else next.add(game.key)
                                          setHistSelectedGames(next)
                                        }}
                                        className="w-3.5 h-3.5 accent-accent"
                                      />
                                      <span className="text-sm text-muted">{game.opponent}</span>
                                    </div>
                                    <span className="text-xs text-muted">{game.date}</span>
                                  </label>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => setHistShowGameFilter(false)}
                    className="w-full mt-3 bg-surface border border-border text-text text-sm py-2 rounded-lg hover:border-accent transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Search player..."
              value={histSearch}
              onChange={e => setHistSearch(e.target.value)}
              className="bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent"
            />

            <span className="text-muted text-xs ml-auto">{sortedHistSeason.length} players</span>
          </div>

          {sortedHistSeason.length === 0 ? (
            <div className="text-center py-24 text-muted">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg mb-2">No historical stats yet</p>
              <p className="text-sm">Upload a CSV with the Historical option checked in the Admin CSV Import tab</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface">
                      <th
                        onClick={() => handleHistSort('playerName')}
                        className="text-left px-3 py-3 text-muted font-medium cursor-pointer hover:text-text whitespace-nowrap sticky left-0 bg-surface z-10"
                      >
                        <div className="flex items-center gap-1">Player <HistSortIcon col="playerName" /></div>
                      </th>
                      {COLUMNS.filter(c => c.key !== 'playerName').map(col => (
                        <th
                          key={col.key}
                          onClick={() => handleHistSort(col.key as ColKey)}
                          title={col.title}
                          className="text-center px-3 py-3 text-muted font-medium cursor-pointer hover:text-text whitespace-nowrap"
                        >
                          <div className="flex items-center gap-1 justify-center">
                            {col.label} <HistSortIcon col={col.key as ColKey} />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHistSeason.map((row, i) => {
                      const g = row as any
                      return (
                        <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-surface/50 transition-colors">
                          <td className="px-3 py-2.5 font-semibold text-text sticky left-0 bg-card whitespace-nowrap">{g.playerName}</td>
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
                          <td className="px-3 py-2.5 text-center font-mono text-muted">{g.gamesPlayed}</td>
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
      )}
    </div>
  )
}