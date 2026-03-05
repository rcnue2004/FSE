export interface ParsedTournamentStats {
  playerName: string
  tournamentName: string
  date: string
  goals: number
  assists: number
  ds: number
  turns: number
}

export function parseStatsCSV(csvText: string): ParsedTournamentStats[] {
  const lines = csvText.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim())

  const idx = (name: string) => headers.indexOf(name)
  const tournamentIdx = idx('Tournamemnt')
  const dateIdx = idx('Date/Time')
  const eventTypeIdx = idx('Event Type')
  const actionIdx = idx('Action')
  const passerIdx = idx('Passer')
  const receiverIdx = idx('Receiver')
  const defenderIdx = idx('Defender')

  const statsMap: Record<string, ParsedTournamentStats> = {}

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < 10) continue

    const tournament = cols[tournamentIdx]?.trim()
    const date = cols[dateIdx]?.trim().split(' ')[0]
    const eventType = cols[eventTypeIdx]?.trim()
    const action = cols[actionIdx]?.trim()
    const passer = cols[passerIdx]?.trim()
    const receiver = cols[receiverIdx]?.trim()
    const defender = cols[defenderIdx]?.trim()

    if (!tournament) continue

    const getOrCreate = (playerName: string) => {
      const key = `${tournament}__${playerName}`
      if (!statsMap[key]) {
        statsMap[key] = {
          playerName,
          tournamentName: tournament,
          date: new Date(date).toISOString(),
          goals: 0,
          assists: 0,
          ds: 0,
          turns: 0,
        }
      }
      return statsMap[key]
    }

    if (action === 'Goal' && eventType === 'Offense') {
      if (receiver && receiver !== 'Anonymous') getOrCreate(receiver).goals++
      if (passer && passer !== 'Anonymous') getOrCreate(passer).assists++
    }

    if (action === 'D') {
      if (defender && defender !== 'Anonymous') getOrCreate(defender).ds++
    }

    if (action === 'Throwaway') {
      if (passer && passer !== 'Anonymous') getOrCreate(passer).turns++
    }
  }

  return Object.values(statsMap)
}