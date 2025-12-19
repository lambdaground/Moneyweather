# Money Weather (머니 웨더)

## Overview
A mobile-first financial dashboard that translates complex economic data into weather metaphors for users with low financial literacy. All UI is in Korean with friendly, beginner-focused messaging.

## Current State
**Status**: MVP Complete with Real Market Data + ECOS Economic Indicators
- 25 financial assets displayed as weather cards with live data
- 6 category filters: 환율, 지수, 원자재, 코인, 금리
- 4 weather status filters: 맑음, 흐림, 비, 번개
- Live timestamp showing data freshness
- Korean language UI throughout
- Mobile-first responsive design
- Dark/light mode support
- Detail modal with "머니 박사의 조언" (Dr. Money's Advice)
- Real-time market data from multiple APIs (including Korean government APIs)
- **Drag-and-drop card reordering** with localStorage persistence
- **Dual badge display**: Each card shows BOTH percentage change (e.g., "+1.58%") AND point change (e.g., "+64.44pt")
- **Gold/Silver in 한 돈 (3.75g)**: Prices shown per 돈 unit with separate buy/sell prices
  - 1 돈 = 3.75g, Conversion: price_per_don = price_per_oz * (3.75 / 31.1035)
  - 살 때 (customer buys) = dealer's sell price (higher, +3% for gold, +5% for silver)
  - 팔 때 (customer sells) = dealer's buy price (lower, -3% for gold, -5% for silver)
- **강남 아파트 in 억원 (30평)**: Prices shown as "24.9억 (30평)" instead of abstract index
  - Conversion: gangnam_price = (index / 100) × 25억원 (Gangnam 30-pyeong baseline)
- **Enhanced typography**: Larger font sizes for filter buttons (text-base) and icons (w-5 h-5)
- **Interactive price charts**: 5-day historical charts in detail modal using Recharts
- **Market status indicators**: Real-time market open/close status for stock indices
  - KOSPI/KOSDAQ: 장 중 (9:00-15:30 KST), 장 전 (8:00-9:00), 장 마감
  - NASDAQ/S&P 500: 장 중 (9:30-16:00 EST), 프리마켓 (4:00-9:30 EST), 애프터마켓 (16:00-20:00 EST), 장 마감
  - Countdown timer shows "X시간 Y분 후 개장" when market is closed

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
| USD/KRW | Yahoo Finance | KRW=X (previousClose 기반 등락률) |
| JPY/KRW | Yahoo Finance | JPYKRW=X (1엔당 → 100엔당 변환) |
| CNY/KRW | Yahoo Finance | CNYKRW=X |
| EUR/KRW | Yahoo Finance | EURKRW=X |
| Fear & Greed | Alternative.me | /fng/?limit=2 (free, no key) |
| KOSPI | Yahoo Finance | ^KS11 chart data |
| KOSDAQ | Yahoo Finance | ^KQ11 chart data |
| NASDAQ | Yahoo Finance | ^IXIC chart data |
| S&P 500 | Yahoo Finance | ^GSPC chart data |
| Gold | Yahoo Finance | GC=F (Gold Futures) |
| Silver | Yahoo Finance | SI=F (Silver Futures) |
| Gasoline (휘발유) | Opinet (오피넷) | avgAllPrice (OPINET_API_KEY required) |
| Diesel (경유) | Opinet (오피넷) | avgAllPrice (OPINET_API_KEY required) |
| 강남 아파트 | 부동산통계정보시스템 (REB) | SttsApiTblData → 강남 30평 시세 변환 (REB_API_KEY required) |
| Bitcoin | CoinGecko | simple/price (free, no key) |
| Ethereum | CoinGecko | simple/price (free, no key) |
| 10Y Bonds | Yahoo Finance | ^TNX (US Treasury Yield) |
| 2Y Bonds | Yahoo Finance | ^IRX (US 2Y Treasury) |
| 국고채 3년 | ECOS 817Y002 | 010200000 (일별 시장금리) |
| 국고채 10년 | ECOS 817Y002 | 010210000 (일별 시장금리) |
| 소비자물가 | ECOS 901Y009 | CPI (월별) |
| 생산자물가 | ECOS 901Y010 | PPI (월별) |
| 소비자심리 | ECOS 511Y002 | CCSI (월별, FME/99988) |

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

### Index (지수) - 5 assets
| Asset | Sunny | Rainy | Thunder |
|-------|-------|-------|---------|
| Fear & Greed | Score >= 70 | Score 30-49 | Score < 30 or \|Change\| >= 15 |
| KOSPI | Change > 0.5% | Change < -0.5% | \|Change\| > 2% |
| KOSDAQ | Change > 0.5% | Change < -0.5% | \|Change\| > 2% |
| NASDAQ | Change > 0.5% | Change < -0.5% | \|Change\| > 2% |
| S&P 500 | Change > 0.5% | Change < -0.5% | \|Change\| > 2% |

### Commodity (원자재) - 5 assets
| Asset | Sunny | Rainy | Cloudy |
|-------|-------|-------|--------|
| Gold | Change > 1% | Change < -1% | between |
| Silver | Change > 1.5% | Change < -1.5% | between |
| 휘발유 (Gasoline) | < 1,600원/L | > 1,750원/L | between |
| 경유 (Diesel) | < 1,500원/L | > 1,650원/L | between |
| 강남 아파트 (30평) | Change > 0.5% | Change < -0.5% | between |

### Crypto (코인) - 2 assets
| Asset | Sunny | Rainy | Thunder |
|-------|-------|-------|---------|
| Bitcoin | Change > 1% | Change < -1% | \|Change\| > 3% |
| Ethereum | Change > 1% | Change < -1% | \|Change\| > 3% |

### Bonds (금리) - 6 assets
| Asset | Sunny | Rainy | Cloudy/Thunder |
|-------|-------|-------|----------------|
| 10Y Treasury | Change > 0.1% | Change < -0.1% | between |
| 2Y Treasury | Change > 0.1% | Change < -0.1% | between |
| 한국 기준금리 | 인상 | 인하 | 동결 / 0.25%p 이상 변동시 번개 |
| 국고채 3년 | Change > 0.1% | Change < -0.1% | between |
| 국고채 10년 | Change > 0.1% | Change < -0.1% | between |
| 장단기 금리차 | 확대 > 0.05%p | 축소 or < 0.2%p | 역전(마이너스)시 번개 |

### Economic Indicators (경제지표) - 3 assets
| Asset | API Source | Notes |
|-------|-----------|-------|
| 소비자물가(CPI) | ECOS 901Y009 | 물가 상승 = 비, 하락 = 맑음 |
| 생산자물가(PPI) | ECOS 901Y010 | 물가 상승 = 비, 하락 = 맑음 |
| 소비자심리(CCSI) | ECOS 511Y002 | 100 이상 낙관, 90 미만 비관, 강한 비관시 번개 |

## File Structure
```
client/src/
├── components/
│   ├── CategoryFilter.tsx     # Category filter buttons (환율, 지수, etc.)
│   ├── WeatherFilter.tsx      # Weather status filter (맑음, 흐림, 비, 번개)
│   ├── WeatherCard.tsx        # Main weather card component
│   ├── SortableWeatherCard.tsx # Draggable wrapper for WeatherCard
│   ├── DetailModal.tsx        # Dr. Money advice modal
│   └── Header.tsx             # App header with controls
├── pages/
│   └── Dashboard.tsx          # Main dashboard with DnD context & filtering
├── lib/
│   └── marketData.ts          # Types and utilities
server/
├── routes.ts                  # API routes
├── storage.ts                 # In-memory storage with caching
├── realMarketData.ts          # Real API integration service
shared/
└── schema.ts                  # Shared types and schemas
```

## Drag-and-Drop Implementation
Uses @dnd-kit library for card reordering:
- `DndContext` with `DragOverlay` in Dashboard.tsx
- `SortableContext` with `rectSortingStrategy` for grid layout
- Card order saved to localStorage key: `moneyweather_card_order`
- Edit mode toggle disables auto-refresh to prevent data races

## User Preferences
- Korean language UI
- Soft pastel color scheme (orange/slate/purple/gray)
- Mobile-first responsive design
- Weather metaphors for financial concepts

## Future Enhancements
- Push notifications for status changes
- Personalized portfolio tracking
- Educational content library
