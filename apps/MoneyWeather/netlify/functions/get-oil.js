exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const apiKey = process.env.VITE_OPINET_API_KEY;
    
    if (!apiKey) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          gasoline: {
            price: 1680,
            change: null,
            changePoints: null
          },
          diesel: {
            price: 1580,
            change: null,
            changePoints: null
          },
          timestamp: new Date().toISOString(),
          source: 'mock'
        })
      };
    }

    const avgPriceUrl = `https://www.opinet.co.kr/api/avgAllPrice.do?code=${apiKey}&out=json`;
    const recentPriceUrl = `https://www.opinet.co.kr/api/avgRecentPrice.do?code=${apiKey}&out=json`;
    
    const [avgResponse, recentResponse] = await Promise.all([
      fetch(avgPriceUrl),
      fetch(recentPriceUrl)
    ]);
    
    const avgData = await avgResponse.json();
    const recentData = await recentResponse.json();

    if (!avgData.RESULT || avgData.RESULT.OIL.length === 0) {
      throw new Error('No oil price data');
    }

    const oils = avgData.RESULT.OIL;
    const gasoline = oils.find(o => o.PRODCD === 'B027');
    const diesel = oils.find(o => o.PRODCD === 'D047');

    let prevGasoline = null;
    let prevDiesel = null;
    
    if (recentData.RESULT && recentData.RESULT.OIL && recentData.RESULT.OIL.length >= 2) {
      const recentOils = recentData.RESULT.OIL;
      const sortedByDate = recentOils.sort((a, b) => b.DATE.localeCompare(a.DATE));
      
      const gasolineHistory = sortedByDate.filter(o => o.PRODCD === 'B027');
      const dieselHistory = sortedByDate.filter(o => o.PRODCD === 'D047');
      
      if (gasolineHistory.length >= 2) {
        prevGasoline = parseFloat(gasolineHistory[1].PRICE);
      }
      if (dieselHistory.length >= 2) {
        prevDiesel = parseFloat(dieselHistory[1].PRICE);
      }
    }

    const gasolinePrice = gasoline ? parseFloat(gasoline.PRICE) : null;
    const dieselPrice = diesel ? parseFloat(diesel.PRICE) : null;

    const result = {
      gasoline: gasoline ? {
        price: gasolinePrice,
        change: prevGasoline ? parseFloat(((gasolinePrice - prevGasoline) / prevGasoline * 100).toFixed(2)) : null,
        changePoints: prevGasoline ? parseFloat((gasolinePrice - prevGasoline).toFixed(2)) : null,
        prevPrice: prevGasoline
      } : null,
      diesel: diesel ? {
        price: dieselPrice,
        change: prevDiesel ? parseFloat(((dieselPrice - prevDiesel) / prevDiesel * 100).toFixed(2)) : null,
        changePoints: prevDiesel ? parseFloat((dieselPrice - prevDiesel).toFixed(2)) : null,
        prevPrice: prevDiesel
      } : null,
      timestamp: new Date().toISOString(),
      source: 'opinet'
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Oil API error:', error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        gasoline: { price: 1680, change: null, changePoints: null },
        diesel: { price: 1580, change: null, changePoints: null },
        timestamp: new Date().toISOString(),
        source: 'fallback'
      })
    };
  }
};
