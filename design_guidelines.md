# Money Weather (머니 웨더) Design Guidelines

## Design Approach
**Reference-Based Approach**: Financial education dashboard with weather metaphor system, optimized for financial beginners with low literacy. Mobile-first design philosophy.

## Language & Content
- **All UI text must be in Korean**
- Friendly, beginner-focused messaging throughout
- Weather metaphors to translate complex financial data into accessible concepts

## Color System (Soft Pastels)
- **Sunny Cards**: `bg-orange-50` with `border-orange-200`
- **Rainy Cards**: `bg-slate-50` with `border-slate-200`
- **Thunder Cards**: `bg-purple-50` with `border-purple-200`
- **Cloudy Cards**: Soft neutral pastels
- Avoid harsh red/blue trading colors - maintain soft, approachable aesthetic

## Typography
- Header: "오늘의 머니 웨더 🌤️" (Today's Money Weather)
- Asset names in Korean (e.g., "미국 달러", "비트코인")
- Primary emphasis on one-line messages (most important element)
- Secondary text for actual prices/rates (smaller, less prominent)

## Layout System
- **Mobile**: Single-column card layout, stacked vertically
- **Desktop**: Grid layout for cards
- Clean spacing with generous padding
- Mobile-first responsive breakpoints

## Component Library

### WeatherCard Component
Display hierarchy (top to bottom):
1. Asset Name (Korean, prominent)
2. Large Weather Icon from Lucide React (Sun, CloudRain, Zap, Umbrella, PiggyBank)
3. One-line Message (Korean, largest emphasis, core communication)
4. Actual price/rate (small, secondary text - e.g., "1,405 KRW")
5. Percentage change tag (visible, colored indicator - e.g., "+0.5%")

**Styling**: Cards use border and background colors based on weather status, rounded corners, shadow for depth

### Detail Modal/Sheet
- Triggered on card click
- Contains "Dr. Money's Advice" section
- Static educational tips related to specific asset
- Example Korean tips for each asset type
- Clean modal overlay with proper spacing

## Icons
Use **Lucide React** exclusively:
- Sun (Sunny/Good conditions)
- CloudRain (Rainy/Bad conditions)
- Zap (Thunder/Volatile)
- Umbrella (Protection metaphors)
- PiggyBank (Savings-related)
- Large icon sizes for visual impact

## Weather Status Visual System
- **Sunny (Good/Up)**: Orange pastel tones, Sun icon
- **Rainy (Bad/Down)**: Slate pastel tones, CloudRain icon
- **Cloudy (Flat/Neutral)**: Neutral pastels, Cloud icon
- **Thunder (Volatile)**: Purple pastel tones, Zap icon

## Accessibility
- Clear visual hierarchy with weather metaphors
- Large, readable icons for quick comprehension
- Beginner-friendly language avoiding financial jargon
- Touch-friendly card sizes for mobile interaction

## Images
No hero images required. This is a dashboard application focused on data cards. Visual interest comes from:
- Large colorful weather icons
- Pastel card backgrounds
- Clean typography hierarchy