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
      
      if (closes.length < 2) {
        const currentPrice = meta.regularMarketPrice || closes[closes.length - 1];
        const prevClose = meta.previousClose || meta.chartPreviousClose;
        return {
          price: currentPrice,
          prevClose: prevClose,
          change: prevClose ? ((currentPrice - prevClose) / prevClose * 100) : 0,
          changePoints: prevClose ? (currentPrice - prevClose) : 0
        };
      }

      const currentPrice = closes[closes.length - 1];
      const prevClose = meta.previousClose || closes[closes.length - 2];
      
      return {
        price: currentPrice,
        prevClose: prevClose,
        change: ((currentPrice - prevClose) / prevClose * 100),
        changePoints: currentPrice - prevClose
      };
    } catch (error) {
      console.error(`Error fetching ${symbol}:`, error);
      return null;
    }
  }

  try {
    const [kospi, kosdaq, nasdaq, sp500, dowjones, bonds10y, bonds2y] = await Promise.all([
      fetchYahooQuote('^KS11'),
      fetchYahooQuote('^KQ11'),
      fetchYahooQuote('^IXIC'),
      fetchYahooQuote('^GSPC'),
      fetchYahooQuote('^DJI'),
      fetchYahooQuote('^TNX'),
      fetchYahooQuote('^IRX')
    ]);

    const result = {
      kospi: kospi ? {
        price: parseFloat(kospi.price.toFixed(2)),
        change: parseFloat(kospi.change.toFixed(2)),
        changePoints: parseFloat(kospi.changePoints.toFixed(2)),
        prevClose: parseFloat(kospi.prevClose.toFixed(2))
      } : null,
      kosdaq: kosdaq ? {
        price: parseFloat(kosdaq.price.toFixed(2)),
        change: parseFloat(kosdaq.change.toFixed(2)),
        changePoints: parseFloat(kosdaq.changePoints.toFixed(2)),
        prevClose: parseFloat(kosdaq.prevClose.toFixed(2))
      } : null,
      nasdaq: nasdaq ? {
        price: parseFloat(nasdaq.price.toFixed(2)),
        change: parseFloat(nasdaq.change.toFixed(2)),
        changePoints: parseFloat(nasdaq.changePoints.toFixed(2)),
        prevClose: parseFloat(nasdaq.prevClose.toFixed(2))
      } : null,
      sp500: sp500 ? {
        price: parseFloat(sp500.price.toFixed(2)),
        change: parseFloat(sp500.change.toFixed(2)),
        changePoints: parseFloat(sp500.changePoints.toFixed(2)),
        prevClose: parseFloat(sp500.prevClose.toFixed(2))
      } : null,
      dowjones: dowjones ? {
        price: parseFloat(dowjones.price.toFixed(2)),
        change: parseFloat(dowjones.change.toFixed(2)),
        changePoints: parseFloat(dowjones.changePoints.toFixed(2)),
        prevClose: parseFloat(dowjones.prevClose.toFixed(2))
      } : null,
      bonds10y: bonds10y ? {
        yield: parseFloat(bonds10y.price.toFixed(2)),
        change: parseFloat(bonds10y.changePoints.toFixed(2)),
        prevClose: parseFloat(bonds10y.prevClose.toFixed(2))
      } : null,
      bonds2y: bonds2y ? {
        yield: parseFloat((bonds2y.price / 10).toFixed(2)),
        change: parseFloat((bonds2y.changePoints / 10).toFixed(2)),
        prevClose: parseFloat((bonds2y.prevClose / 10).toFixed(2))
      } : null,
      timestamp: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Indices API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch indices', message: error.message })
    };
  }
};
