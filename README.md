# 🥏 Frisbee Stock Exchange

A fantasy stock market for ultimate frisbee players. Trade players like stocks — prices move based on real tournament performance.

**Live look:** Dark mode, Robinhood-style UI, real-time price animations, full trading system.

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/frisbee-stock-exchange.git
cd frisbee-stock-exchange
npm install
```

### 2. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com) → Create Project
2. Enable **Authentication** → Email/Password
3. Enable **Firestore Database** (start in test mode, then apply rules below)
4. Go to Project Settings → Web App → Copy config values

### 3. Environment Variables

```bash
cp .env.local.example .env.local
# Fill in your Firebase values
```

### 4. Apply Firestore Security Rules

In Firebase Console → Firestore → Rules, paste the contents of `firestore.rules`.

### 5. Make Yourself an Admin

After registering your account:
1. Go to Firebase Console → Firestore → `users` collection
2. Find your user document
3. Set `isAdmin: true`

### 6. Import Your Players

**Option A — Excel Upload (recommended):**
- Sign in as admin
- Go to Admin Panel → Add Player → use the import section
- Upload your `Frisbee Stock Exchange.xlsx`
- Required columns: `Name`, `Team` (optional: `Position`)

**Option B — Manual:**
- Admin Panel → Add Player → fill in the form

**Option C — Seed Script:**
```bash
# Install firebase-admin
npm install firebase-admin

# Download service account key from Firebase Console → Project Settings → Service Accounts
# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"

# Run seed
node scripts/seed.js
```

### 7. Run Locally

```bash
npm run dev
# Visit http://localhost:3000
```

---

## 🚢 Deploy to Vercel

```bash
npm install -g vercel
vercel

# Add your env vars in Vercel dashboard → Project → Settings → Environment Variables
```

Or connect your GitHub repo to Vercel for auto-deploy on push.

---

## 📐 Pricing Formula

```
New Price = Old Price + (Goals × goalsWeight) + (Assists × assistsWeight) + (Ds × dsWeight) + (Turns × turnsWeight)
```

**Default weights:**
| Stat    | Weight |
|---------|--------|
| Goals   | +2.5   |
| Assists | +2.0   |
| Ds      | +1.5   |
| Turns   | -1.0   |

Change weights anytime in **Admin Panel → Price Weights**.

---

## 🎮 Game Rules

- Everyone starts with **$10,000** in fake cash
- **Max 10 shares** per player (total in circulation)
- **No shorting**, no options, no derivatives
- **No buying your own stock** (enforced by server)
- **Market closes** during tournaments (admin controls this)
- All trades are logged

---

## 🗄️ Database Schema (Firestore)

```
/players/{playerId}
  name: string
  team: string
  position: string
  currentPrice: number
  previousPrice: number
  priceHistory: PricePoint[]
  tournamentStats: TournamentStats[]
  sharesAvailable: number
  totalShares: number

/users/{uid}
  displayName: string
  email: string
  isAdmin: boolean
  startingCash: number
  portfolio:
    cash: number
    holdings: { [playerId]: sharesOwned }

/trades/{tradeId}
  userId, playerId, type, shares, price, total, timestamp

/settings/market
  isOpen: boolean
  startingCash: number
  weights: { goals, assists, ds, turns }
```

---

## 🗂️ Project Structure

```
src/
  app/
    page.tsx          # Dashboard / Market
    auth/page.tsx     # Login / Register
    player/[id]/      # Player detail + trading
    portfolio/page.tsx # Your holdings + leaderboard
    admin/page.tsx    # Admin panel
  components/
    layout/Navbar.tsx
    ui/PlayerCard.tsx
    ui/ImportSection.tsx
    charts/PriceChart.tsx
  lib/
    firebase.ts       # Firebase init
    db.ts             # Firestore operations
    pricing.ts        # Price calculation logic
    importExcel.ts    # Excel importer
  hooks/
    useAuth.tsx       # Auth context
  types/index.ts      # TypeScript types
```

---

## 🔧 Admin Workflow

1. **Before tournament:** Close the market (`Admin → Market Control → Close Market`)
2. **After tournament:** Submit each player's stats (`Admin → Submit Stats`)
   - Prices auto-update instantly
   - Charts update
   - Portfolio values refresh automatically
3. **Reopen market:** `Admin → Market Control → Open Market`

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 14, React, Tailwind CSS
- **Database:** Firebase Firestore
- **Auth:** Firebase Authentication
- **Charts:** Recharts
- **Deploy:** Vercel (free tier)
- **Icons:** Lucide React

All free tier — no paid services required.
