# Money Weather (머니 웨더)

## Overview
A mobile-first financial dashboard that translates complex economic data into weather metaphors for users with low financial literacy. All UI is in Korean with friendly, beginner-focused messaging.

## Current State
**Status**: MVP Complete with Real Market Data
- 5 financial assets displayed as weather cards with live data
- Korean language UI throughout
- Mobile-first responsive design
- Dark/light mode support
- Detail modal with "머니 박사의 조언" (Dr. Money's Advice)
- Real-time market data from free APIs (no API keys required)

## Architecture

### Backend
- Express.js server on port 5000
- In-memory storage with 30-second cache for market data
- REST API endpoints:
  - `GET /api/market` - Get current market data (cached)
  - `POST /api/market/refresh` - Force regenerate market data (bypasses cache)

### Frontend
- React with TypeScript
- Tailwind CSS for styling
- React Query for data fetching
- Wouter for routing
- Shadcn UI components

### Data Sources (Real APIs)
| Asset | API Source | Endpoint |
|-------|-----------|----------|
| USD/KRW | ExchangeRate-API | v4/latest/USD (free, no key) |
| KOSPI | Yahoo Finance | ^KS11 chart data |
| Gold | Yahoo Finance | GC=F (Gold Futures) |
| Bitcoin | CoinGecko | simple/price (free, no key) |
| 10Y Bonds | Yahoo Finance | ^TNX (US Treasury Yield) |

### Data Flow
1. Server fetches real market data from multiple free APIs
2. Data is cached for 30 seconds to avoid rate limiting
3. Frontend fetches data via React Query with 30-second auto-refresh
4. User can force refresh to get latest data
5. If any API fails, fallback to mock data for that asset
6. Click card to see detailed advice in modal

## Asset Types & Weather Logic

| Asset | Sunny (Good) | Rainy (Bad) | Thunder (Volatile) |
|-------|-------------|-------------|-------------------|
| USD/KRW | < 1350 KRW | > 1400 KRW | - |
| KOSPI | Change > 0.5% | Change < -0.5% | \|Change\| > 2% |
| Gold | Change > 1% | Change < -1% | - |
| Bitcoin | Change > 1% | Change < -1% | \|Change\| > 3% |
| 10Y Bonds | Change > 0.1% | Change < -0.1% | - |

## File Structure
```
client/src/
├── components/
│   ├── WeatherCard.tsx    # Main weather card component
│   ├── DetailModal.tsx    # Dr. Money advice modal
│   └── Header.tsx         # App header with controls
├── pages/
│   └── Dashboard.tsx      # Main dashboard page
├── lib/
│   └── marketData.ts      # Types and utilities
server/
├── routes.ts              # API routes
├── storage.ts             # In-memory storage with caching
├── realMarketData.ts      # Real API integration service
shared/
└── schema.ts              # Shared types and schemas
```

## User Preferences
- Korean language UI
- Soft pastel color scheme (orange/slate/purple/gray)
- Mobile-first responsive design
- Weather metaphors for financial concepts

## Future Enhancements
- Historical price charts
- Push notifications for status changes
- Personalized portfolio tracking
- Educational content library
