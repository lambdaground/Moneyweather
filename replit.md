# Money Weather (머니 웨더)

## Overview
A mobile-first financial dashboard that translates complex economic data into weather metaphors for users with low financial literacy. All UI is in Korean with friendly, beginner-focused messaging.

## Current State
**Status**: MVP Complete with Real Market Data
- 14 financial assets displayed as weather cards with live data
- 5 category filters: 환율, 지수, 원자재, 코인, 금리
- 4 weather status filters: 맑음, 흐림, 비, 번개
- Live timestamp showing data freshness
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
- React Query for data fetching with 30-second auto-refresh
- Wouter for routing
- Shadcn UI components

### Data Sources (Real APIs)
| Asset | API Source | Endpoint |
|-------|-----------|----------|
| USD/KRW | ExchangeRate-API | v4/latest/USD (free, no key) |
| JPY/KRW | ExchangeRate-API | Calculated from USD rates |
| CNY/KRW | ExchangeRate-API | Calculated from USD rates |
| EUR/KRW | ExchangeRate-API | Calculated from USD rates |
| KOSPI | Yahoo Finance | ^KS11 chart data |
| KOSDAQ | Yahoo Finance | ^KQ11 chart data |
| S&P 500 | Yahoo Finance | ^GSPC chart data |
| Gold | Yahoo Finance | GC=F (Gold Futures) |
| Silver | Yahoo Finance | SI=F (Silver Futures) |
| Oil (WTI) | Yahoo Finance | CL=F (Crude Oil Futures) |
| Bitcoin | CoinGecko | simple/price (free, no key) |
| Ethereum | CoinGecko | simple/price (free, no key) |
| 10Y Bonds | Yahoo Finance | ^TNX (US Treasury Yield) |
| 2Y Bonds | Yahoo Finance | ^IRX (US 2Y Treasury) |

### Data Flow
1. Server fetches real market data from multiple free APIs
2. Data is cached for 30 seconds to avoid rate limiting
3. Frontend fetches data via React Query with 30-second auto-refresh
4. User can force refresh to get latest data
5. If any API fails, fallback to mock data for that asset
6. Click card to see detailed advice in modal
7. Category filter allows focusing on specific asset types

## Asset Categories & Weather Logic

### Currency (환율) - 4 assets
| Asset | Sunny | Rainy | Cloudy |
|-------|-------|-------|--------|
| USD/KRW | < 1350 KRW | > 1400 KRW | between |
| JPY/KRW | < 900 /100엔 | > 950 /100엔 | between |
| CNY/KRW | < 200 KRW | > 220 KRW | between |
| EUR/KRW | < 1550 KRW | > 1700 KRW | between |

### Index (지수) - 3 assets
| Asset | Sunny | Rainy | Thunder |
|-------|-------|-------|---------|
| KOSPI | Change > 0.5% | Change < -0.5% | \|Change\| > 2% |
| KOSDAQ | Change > 0.5% | Change < -0.5% | \|Change\| > 2% |
| S&P 500 | Change > 0.5% | Change < -0.5% | \|Change\| > 2% |

### Commodity (원자재) - 3 assets
| Asset | Sunny | Rainy | Cloudy |
|-------|-------|-------|--------|
| Gold | Change > 1% | Change < -1% | between |
| Silver | Change > 1.5% | Change < -1.5% | between |
| Oil | Change > 1.5% | Change < -1.5% | between |

### Crypto (코인) - 2 assets
| Asset | Sunny | Rainy | Thunder |
|-------|-------|-------|---------|
| Bitcoin | Change > 1% | Change < -1% | \|Change\| > 3% |
| Ethereum | Change > 1% | Change < -1% | \|Change\| > 3% |

### Bonds (금리) - 2 assets
| Asset | Sunny | Rainy | Cloudy |
|-------|-------|-------|--------|
| 10Y Treasury | Change > 0.1% | Change < -0.1% | between |
| 2Y Treasury | Change > 0.1% | Change < -0.1% | between |

## File Structure
```
client/src/
├── components/
│   ├── CategoryFilter.tsx # Category filter buttons (환율, 지수, etc.)
│   ├── WeatherFilter.tsx  # Weather status filter (맑음, 흐림, 비, 번개)
│   ├── WeatherCard.tsx    # Main weather card component
│   ├── DetailModal.tsx    # Dr. Money advice modal
│   └── Header.tsx         # App header with controls
├── pages/
│   └── Dashboard.tsx      # Main dashboard page with dual filtering
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
