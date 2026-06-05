/**
 * One-time migration: copy top-level Firestore collections into a game sub-tree.
 *
 * Prerequisites:
 *   npm install -D tsx firebase-admin
 *
 * Run:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json \
 *     npx tsx scripts/migrate.ts
 *
 * Or on Windows PowerShell:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\serviceAccountKey.json"
 *   npx tsx scripts/migrate.ts
 *
 * Get your service account key:
 *   Firebase Console → Project Settings → Service Accounts → Generate new private key
 */

import * as admin from 'firebase-admin'

// ── SET THIS before running ───────────────────────────────────────────────────
const GAME_ID = 'your-game-id-here'
// ─────────────────────────────────────────────────────────────────────────────

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
})

const db = admin.firestore()

async function copyCollection(srcPath: string, dstPath: string): Promise<number> {
  const snap = await db.collection(srcPath).get()
  if (snap.empty) {
    console.log(`  (empty) ${srcPath}`)
    return 0
  }
  const BATCH_SIZE = 400
  let count = 0
  let batch = db.batch()
  for (const docSnap of snap.docs) {
    batch.set(db.collection(dstPath).doc(docSnap.id), docSnap.data())
    count++
    if (count % BATCH_SIZE === 0) {
      await batch.commit()
      batch = db.batch()
    }
  }
  if (count % BATCH_SIZE !== 0) await batch.commit()
  return count
}

async function migrate() {
  if (GAME_ID === 'your-game-id-here') {
    console.error('ERROR: Set GAME_ID at the top of the script before running.')
    process.exit(1)
  }

  console.log(`Migrating into games/${GAME_ID}/...\n`)

  // 1. Players
  process.stdout.write('Copying players... ')
  const playerCount = await copyCollection('players', `games/${GAME_ID}/players`)
  console.log(`${playerCount} docs`)

  // 2. Market settings
  process.stdout.write('Copying settings/market... ')
  const settingsSnap = await db.doc('settings/market').get()
  if (settingsSnap.exists) {
    await db.doc(`games/${GAME_ID}/settings/market`).set(settingsSnap.data()!)
    console.log('done')
  } else {
    console.log('(not found, skipped)')
  }

  // 3. Trades
  process.stdout.write('Copying trades... ')
  const tradeCount = await copyCollection('trades', `games/${GAME_ID}/trades`)
  console.log(`${tradeCount} docs`)

  // 4. gameStats
  process.stdout.write('Copying gameStats... ')
  const gameStatsCount = await copyCollection('gameStats', `games/${GAME_ID}/gameStats`)
  console.log(`${gameStatsCount} docs`)

  // 5. historicalStats
  process.stdout.write('Copying historicalStats... ')
  const histCount = await copyCollection('historicalStats', `games/${GAME_ID}/historicalStats`)
  console.log(`${histCount} docs`)

  // 6. Users — create per-game portfolios and add gameId to each user's games array
  process.stdout.write('Migrating user portfolios... ')
  const usersSnap = await db.collection('users').get()
  let userCount = 0
  const BATCH_SIZE = 400
  let batch = db.batch()
  let ops = 0

  for (const userDoc of usersSnap.docs) {
    const user = userDoc.data()
    const uid = userDoc.id
    const portfolio = user.portfolio || {}

    // Create game-scoped portfolio
    batch.set(db.doc(`games/${GAME_ID}/portfolios/${uid}`), {
      userId: uid,
      holdings: portfolio.holdings || {},
      cash: portfolio.cash ?? user.startingCash ?? 10000,
      totalValue: portfolio.totalValue ?? user.startingCash ?? 10000,
    })
    ops++

    // Add gameId to user's games array if not already present
    const games: string[] = user.games || []
    if (!games.includes(GAME_ID)) {
      batch.update(db.doc(`users/${uid}`), {
        games: [...games, GAME_ID],
      })
      ops++
    }

    userCount++
    if (ops >= BATCH_SIZE) {
      await batch.commit()
      batch = db.batch()
      ops = 0
    }
  }
  if (ops > 0) await batch.commit()
  console.log(`${userCount} users`)

  console.log(`\nMigration complete.`)
  console.log(`  Players:          ${playerCount}`)
  console.log(`  Trades:           ${tradeCount}`)
  console.log(`  Game stats:       ${gameStatsCount}`)
  console.log(`  Historical stats: ${histCount}`)
  console.log(`  Users:            ${userCount}`)
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
