/**
 * Seed script — run once to populate Firestore with sample players
 * Usage: node scripts/seed.js (after setting up firebase-admin)
 * 
 * OR — use the Admin Panel → Add Player to add players manually via the UI.
 * 
 * To use this script:
 * 1. npm install firebase-admin
 * 2. Download your Firebase service account key from Firebase Console
 * 3. Set GOOGLE_APPLICATION_CREDENTIALS env var to the key path
 * 4. Run: node scripts/seed.js
 */

const admin = require('firebase-admin')

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
})

const db = admin.firestore()

const SAMPLE_PLAYERS = [
  { name: 'Alex Johnson', team: 'Revolver', position: 'Handler' },
  { name: 'Sam Williams', team: 'Sockeye', position: 'Cutter' },
  { name: 'Jordan Lee', team: 'Chain Lightning', position: 'Handler' },
  { name: 'Taylor Brown', team: 'Ring of Fire', position: 'Hybrid' },
  { name: 'Morgan Davis', team: 'Machine', position: 'Cutter' },
  { name: 'Casey Martinez', team: 'Furious George', position: 'Handler' },
  { name: 'Riley Wilson', team: 'Sub Zero', position: 'Cutter' },
  { name: 'Drew Anderson', team: 'Rhino', position: 'Hybrid' },
]

async function seed() {
  console.log('Seeding players...')
  
  // Initialize market settings
  await db.collection('settings').doc('market').set({
    isOpen: true,
    startingCash: 10000,
    weights: {
      goals: 2.5,
      assists: 2.0,
      ds: 1.5,
      turns: -1.0,
    },
  })
  console.log('✓ Market settings initialized')

  // Add players
  for (const player of SAMPLE_PLAYERS) {
    await db.collection('players').add({
      ...player,
      currentPrice: 100,
      previousPrice: 100,
      priceHistory: [
        { date: new Date().toISOString(), price: 100, tournamentName: 'IPO' },
      ],
      tournamentStats: [],
      sharesAvailable: 10,
      totalShares: 10,
      createdAt: new Date().toISOString(),
    })
    console.log(`✓ Added ${player.name}`)
  }

  console.log('Seeding complete!')
  process.exit(0)
}

seed().catch(console.error)
