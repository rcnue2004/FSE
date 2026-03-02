/**
 * Excel Import Utility
 * 
 * Use this in the Admin panel or run as a script to import players from your Excel file.
 * The Excel file should have columns: Name, Team, Position
 * (additional stat columns are also supported)
 * 
 * Usage in browser: Upload the .xlsx file and call importPlayersFromExcel(file)
 */

import * as XLSX from 'xlsx'
import { createPlayer } from './db'
import { DEFAULT_STARTING_PRICE, MAX_SHARES_PER_PLAYER } from './pricing'

interface ExcelPlayerRow {
  Name?: string
  name?: string
  Team?: string
  team?: string
  Position?: string
  position?: string
}

export async function importPlayersFromExcel(file: File): Promise<{ imported: number; errors: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const rows: ExcelPlayerRow[] = XLSX.utils.sheet_to_json(worksheet)

        let imported = 0
        const errors: string[] = []

        for (const row of rows) {
          const name = row.Name || row.name
          const team = row.Team || row.team || 'Unknown'
          const position = row.Position || row.position || 'Cutter'

          if (!name) {
            errors.push(`Row missing name: ${JSON.stringify(row)}`)
            continue
          }

          try {
            await createPlayer({
              name,
              team,
              position,
              currentPrice: DEFAULT_STARTING_PRICE,
              previousPrice: DEFAULT_STARTING_PRICE,
              priceHistory: [
                { date: new Date().toISOString(), price: DEFAULT_STARTING_PRICE, tournamentName: 'IPO' },
              ],
              tournamentStats: [],
              sharesAvailable: MAX_SHARES_PER_PLAYER,
              totalShares: MAX_SHARES_PER_PLAYER,
              createdAt: new Date().toISOString(),
            })
            imported++
          } catch (err: any) {
            errors.push(`Failed to import ${name}: ${err.message}`)
          }
        }

        resolve({ imported, errors })
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}
