export interface ParsedTournamentStats {
  playerName: string
  tournamentName: string
  date: string
  goals: number
  assists: number
  ds: number
  turns: number
}

export interface ParsedPlayerGameStats {
  playerName: string
  tournamentName: string
  opponent: string
  date: string
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
}

export interface ParsedCSVResult {
  tournamentStats: ParsedTournamentStats[]
  gameStats: ParsedPlayerGameStats[]
}

export function parseStatsCSV(csvText: string): ParsedTournamentStats[] {
  return parseFullCSV(csvText).tournamentStats
}

export function parseFullCSV(csvText: string): ParsedCSVResult {
  const lines = csvText.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim())

  const idx = (name: string) => headers.indexOf(name)
  const tournamentIdx = idx('Tournamemnt')
  const opponentIdx = idx('Opponent')
  const dateIdx = idx('Date/Time')
  const eventTypeIdx = idx('Event Type')
  const actionIdx = idx('Action')
  const passerIdx = idx('Passer')
  const receiverIdx = idx('Receiver')
  const defenderIdx = idx('Defender')
  const lineIdx = idx('Line')

  // Find player column indices (Player 0 through Player 27)
  const playerColIndices: number[] = []
  for (let i = 0; i <= 27; i++) {
    const pi = idx(`Player ${i}`)
    if (pi >= 0) playerColIndices.push(pi)
  }

  const gameStatsMap: Record<string, ParsedPlayerGameStats> = {}
  const pointsTracked = new Set<string>() // track unique points to avoid double counting

  const getOrCreate = (playerName: string, tournament: string, opponent: string, date: string) => {
    const key = `${tournament}__${opponent}__${playerName}`
    if (!gameStatsMap[key]) {
      gameStatsMap[key] = {
        playerName,
        tournamentName: tournament,
        opponent,
        date: new Date(date).toISOString(),
        goals: 0, assists: 0, ds: 0,
        throwaways: 0, drops: 0, turns: 0,
        catches: 0, completions: 0, throwAttempts: 0,
        completionPct: 0, catchingPct: 0,
        pulls: 0, oPointsPlayed: 0, dPointsPlayed: 0,
        pointsPlayed: 0, plusMinus: 0,
      }
    }
    return gameStatsMap[key]
  }

  // Track points played per player
  // Each row has the players on field — we need to track unique points
  const pointPlayers: Record<string, Set<string>> = {} // pointKey -> set of players
  
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < 10) continue

    const tournament = cols[tournamentIdx]?.trim()
    const opponent = cols[opponentIdx]?.trim()
    const date = cols[dateIdx]?.trim().split(' ')[0]
    const eventType = cols[eventTypeIdx]?.trim()
    const action = cols[actionIdx]?.trim()
    const passer = cols[passerIdx]?.trim()
    const receiver = cols[receiverIdx]?.trim()
    const defender = cols[defenderIdx]?.trim()
    const line = cols[lineIdx]?.trim()
    const ourScore = cols[idx('Our Score - End of Point')]?.trim()
    const theirScore = cols[idx('Their Score - End of Point')]?.trim()
    const elapsed = cols[idx('Point Elapsed Seconds')]?.trim()

    if (!tournament || !opponent) continue

    // Track which players are on field this row
    const onField = playerColIndices
      .map(pi => cols[pi]?.trim())
      .filter(p => p && p !== 'Anonymous' && p !== '')

    // Use score+elapsed as a unique point key to avoid double counting points played
    const pointKey = `${tournament}__${opponent}__${ourScore}__${theirScore}__${elapsed}__${line}`
    if (!pointPlayers[pointKey]) {
      pointPlayers[pointKey] = new Set()
      // Add all on-field players for this point
      onField.forEach(p => {
        pointPlayers[pointKey].add(`${p}__${line}`)
      })
    }

    // Goals
    if (action === 'Goal' && eventType === 'Offense') {
      if (receiver && receiver !== 'Anonymous') getOrCreate(receiver, tournament, opponent, date).goals++
      if (passer && passer !== 'Anonymous') {
        getOrCreate(passer, tournament, opponent, date).assists++
        getOrCreate(passer, tournament, opponent, date).completions++
        getOrCreate(passer, tournament, opponent, date).throwAttempts++
      }
      if (receiver && receiver !== 'Anonymous') {
        getOrCreate(receiver, tournament, opponent, date).catches++
      }
    }

    // Catches (non-scoring)
    if (action === 'Catch') {
      if (receiver && receiver !== 'Anonymous') {
        getOrCreate(receiver, tournament, opponent, date).catches++
      }
      if (passer && passer !== 'Anonymous') {
        getOrCreate(passer, tournament, opponent, date).completions++
        getOrCreate(passer, tournament, opponent, date).throwAttempts++
      }
    }

    // Ds
    if (action === 'D') {
      if (defender && defender !== 'Anonymous') getOrCreate(defender, tournament, opponent, date).ds++
    }

    // Throwaways
    if (action === 'Throwaway') {
      if (passer && passer !== 'Anonymous') {
        getOrCreate(passer, tournament, opponent, date).throwaways++
        getOrCreate(passer, tournament, opponent, date).throwAttempts++
      }
    }

    // Drops
    if (action === 'Drop') {
      if (receiver && receiver !== 'Anonymous') {
        getOrCreate(receiver, tournament, opponent, date).drops++
      }
      // Passer still completed the throw attempt
      if (passer && passer !== 'Anonymous' && passer !== 'Anonymous') {
        getOrCreate(passer, tournament, opponent, date).throwAttempts++
      }
    }

    // Pulls
    if (action === 'Pull' || action === 'PullOb') {
      if (defender && defender !== 'Anonymous') {
        getOrCreate(defender, tournament, opponent, date).pulls++
      }
    }
  }

  // Now calculate points played from pointPlayers
  for (const [pointKey, playersOnField] of Object.entries(pointPlayers)) {
    const parts = pointKey.split('__')
    const tournament = parts[0]
    const opponent = parts[1]
    const line = parts[5]

    playersOnField.forEach(entry => {
      const [playerName, playerLine] = entry.split('__')
      const rows2 = lines.slice(1).filter(l => {
        const c = l.split(',')
        return c[tournamentIdx]?.trim() === tournament && c[opponentIdx]?.trim() === opponent
      })
      if (rows2.length === 0) return
      const firstRow = rows2[0].split(',')
      const date = firstRow[dateIdx]?.trim().split(' ')[0]
      const s = getOrCreate(playerName, tournament, opponent, date)
      s.pointsPlayed++
      if (playerLine === 'O') s.oPointsPlayed++
      if (playerLine === 'D') s.dPointsPlayed++
    })
  }

  // Calculate derived stats
  const gameStats = Object.values(gameStatsMap).map(s => {
    s.turns = s.throwaways + s.drops
    s.completionPct = s.throwAttempts > 0 ? Math.round((s.completions / s.throwAttempts) * 100) : 0
    const catchAttempts = s.catches + s.drops
    s.catchingPct = catchAttempts > 0 ? Math.round((s.catches / catchAttempts) * 100) : 0
    s.plusMinus = s.goals + s.assists + s.ds - s.turns
    return s
  })

  // Aggregate to tournament level for price updates
  const tourneyMap: Record<string, ParsedTournamentStats> = {}
  for (const g of gameStats) {
    const key = `${g.tournamentName}__${g.playerName}`
    if (!tourneyMap[key]) {
      tourneyMap[key] = {
        playerName: g.playerName,
        tournamentName: g.tournamentName,
        date: g.date,
        goals: 0, assists: 0, ds: 0, turns: 0,
      }
    }
    tourneyMap[key].goals += g.goals
    tourneyMap[key].assists += g.assists
    tourneyMap[key].ds += g.ds
    tourneyMap[key].turns += g.turns
  }

  return {
    tournamentStats: Object.values(tourneyMap),
    gameStats,
  }
}