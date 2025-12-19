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
    const apiKey = process.env.OPINET_API_KEY;
    
    if (!apiKey) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          gasoline: {
            price: 1680,
            change: 0.5,
            changePoints: 8.4
          },
          diesel: {
            price: 1580,
            change: 0.3,
            changePoints: 4.7
          },
          timestamp: new Date().toISOString(),
          source: 'mock'
        })
      };
    }

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    
    const url = `https://www.opinet.co.kr/api/avgAllPrice.do?code=${apiKey}&out=json`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.RESULT || data.RESULT.OIL.length === 0) {
      throw new Error('No oil price data');
    }

    const oils = data.RESULT.OIL;
    const gasoline = oils.find(o => o.PRODCD === 'B027');
    const diesel = oils.find(o => o.PRODCD === 'D047');

    const prevGasoline = 1672;
    const prevDiesel = 1575;

    const result = {
      gasoline: gasoline ? {
        price: parseFloat(gasoline.PRICE),
        change: parseFloat(((parseFloat(gasoline.PRICE) - prevGasoline) / prevGasoline * 100).toFixed(2)),
        changePoints: parseFloat((parseFloat(gasoline.PRICE) - prevGasoline).toFixed(2))
      } : null,
      diesel: diesel ? {
        price: parseFloat(diesel.PRICE),
        change: parseFloat(((parseFloat(diesel.PRICE) - prevDiesel) / prevDiesel * 100).toFixed(2)),
        changePoints: parseFloat((parseFloat(diesel.PRICE) - prevDiesel).toFixed(2))
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
        gasoline: { price: 1680, change: 0.5, changePoints: 8.4 },
        diesel: { price: 1580, change: 0.3, changePoints: 4.7 },
        timestamp: new Date().toISOString(),
        source: 'fallback'
      })
    };
  }
};
