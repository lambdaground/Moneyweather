exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  async function fetchYahooQuote(symbol) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const data = await response.json();
      
      if (!data.chart || !data.chart.result || !data.chart.result[0]) {
        return null;
      }

      const result = data.chart.result[0];
      const meta = result.meta;
      const quotes = result.indicators.quote[0];
      const closes = quotes.close.filter(c => c !== null);
      
      const currentPrice = meta.regularMarketPrice || closes[closes.length - 1];
      const prevClose = meta.previousClose || meta.chartPreviousClose || closes[closes.length - 2];
      
      return {
        price: currentPrice,
        prevClose: prevClose,
        change: prevClose ? ((currentPrice - prevClose) / prevClose * 100) : 0,
        changePoints: prevClose ? (currentPrice - prevClose) : 0
      };
    } catch (error) {
      console.error(`Error fetching ${symbol}:`, error);
      return null;
    }
  }

  try {
    const [gold, silver] = await Promise.all([
      fetchYahooQuote('GC=F'),
      fetchYahooQuote('SI=F')
    ]);

    const TROY_OZ_TO_DON = 3.75 / 31.1035;

    const result = {
      gold: gold ? {
        pricePerOz: parseFloat(gold.price.toFixed(2)),
        pricePerDon: parseFloat((gold.price * TROY_OZ_TO_DON).toFixed(0)),
        change: parseFloat(gold.change.toFixed(2)),
        changePoints: parseFloat(gold.changePoints.toFixed(2)),
        buyPrice: parseFloat((gold.price * TROY_OZ_TO_DON * 1.03).toFixed(0)),
        sellPrice: parseFloat((gold.price * TROY_OZ_TO_DON * 0.97).toFixed(0))
      } : null,
      silver: silver ? {
        pricePerOz: parseFloat(silver.price.toFixed(2)),
        pricePerDon: parseFloat((silver.price * TROY_OZ_TO_DON).toFixed(0)),
        change: parseFloat(silver.change.toFixed(2)),
        changePoints: parseFloat(silver.changePoints.toFixed(2)),
        buyPrice: parseFloat((silver.price * TROY_OZ_TO_DON * 1.05).toFixed(0)),
        sellPrice: parseFloat((silver.price * TROY_OZ_TO_DON * 0.95).toFixed(0))
      } : null,
      timestamp: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Metal API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch metal prices', message: error.message })
    };
  }
};
