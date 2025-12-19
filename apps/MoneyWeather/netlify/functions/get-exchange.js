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
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await response.json();

    if (data.result !== 'success') {
      throw new Error('API returned error');
    }

    const rates = data.rates;
    const krwRate = rates.KRW;
    const jpyRate = rates.JPY;
    const cnyRate = rates.CNY;
    const eurRate = rates.EUR;

    const usdKrw = krwRate;
    const jpyKrw = krwRate / jpyRate * 100;
    const cnyKrw = krwRate / cnyRate;
    const eurKrw = krwRate / eurRate;

    const prevUsdKrw = 1435.50;
    const prevJpyKrw = 945.80;
    const prevCnyKrw = 196.50;
    const prevEurKrw = 1510.20;

    const result = {
      usd: {
        rate: parseFloat(usdKrw.toFixed(2)),
        change: parseFloat(((usdKrw - prevUsdKrw) / prevUsdKrw * 100).toFixed(2)),
        changePoints: parseFloat((usdKrw - prevUsdKrw).toFixed(2)),
        prevClose: prevUsdKrw
      },
      jpy: {
        rate: parseFloat(jpyKrw.toFixed(2)),
        change: parseFloat(((jpyKrw - prevJpyKrw) / prevJpyKrw * 100).toFixed(2)),
        changePoints: parseFloat((jpyKrw - prevJpyKrw).toFixed(2)),
        prevClose: prevJpyKrw
      },
      cny: {
        rate: parseFloat(cnyKrw.toFixed(2)),
        change: parseFloat(((cnyKrw - prevCnyKrw) / prevCnyKrw * 100).toFixed(2)),
        changePoints: parseFloat((cnyKrw - prevCnyKrw).toFixed(2)),
        prevClose: prevCnyKrw
      },
      eur: {
        rate: parseFloat(eurKrw.toFixed(2)),
        change: parseFloat(((eurKrw - prevEurKrw) / prevEurKrw * 100).toFixed(2)),
        changePoints: parseFloat((eurKrw - prevEurKrw).toFixed(2)),
        prevClose: prevEurKrw
      },
      timestamp: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Exchange API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch exchange rates', message: error.message })
    };
  }
};
