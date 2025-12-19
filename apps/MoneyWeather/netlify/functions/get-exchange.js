exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  function getPreviousBusinessDay(date) {
    const d = new Date(date);
    const day = d.getDay();
    if (day === 0) d.setDate(d.getDate() - 2);
    else if (day === 1) d.setDate(d.getDate() - 3);
    else d.setDate(d.getDate() - 1);
    return d;
  }

  function formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  try {
    const today = new Date();
    const prevDay = getPreviousBusinessDay(today);
    const prevStr = formatDate(prevDay);

    const [todayResponse, prevResponse] = await Promise.all([
      fetch('https://api.exchangerate.host/latest?base=USD&symbols=KRW,JPY,CNY,EUR'),
      fetch(`https://api.exchangerate.host/${prevStr}?base=USD&symbols=KRW,JPY,CNY,EUR`)
    ]);

    let todayRates = null;
    let prevRates = null;
    let source = 'exchangerate.host';

    const todayData = await todayResponse.json();
    const prevData = await prevResponse.json();

    if (todayData.success !== false && todayData.rates) {
      todayRates = todayData.rates;
    }

    if (prevData.success !== false && prevData.rates) {
      prevRates = prevData.rates;
    }

    if (!todayRates) {
      const fallbackResponse = await fetch('https://open.er-api.com/v6/latest/USD');
      const fallbackData = await fallbackResponse.json();
      
      if (fallbackData.result === 'success') {
        todayRates = fallbackData.rates;
        source = 'exchangerate-api-fallback';
        prevRates = null;
      } else {
        throw new Error('All exchange rate APIs failed');
      }
    }

    const usdKrw = todayRates.KRW;
    const jpyKrw = todayRates.KRW / todayRates.JPY * 100;
    const cnyKrw = todayRates.KRW / todayRates.CNY;
    const eurKrw = todayRates.KRW / todayRates.EUR;

    let prevUsdKrw = null, prevJpyKrw = null, prevCnyKrw = null, prevEurKrw = null;
    
    if (prevRates && prevRates.KRW && prevRates.JPY && prevRates.CNY && prevRates.EUR) {
      prevUsdKrw = prevRates.KRW;
      prevJpyKrw = prevRates.KRW / prevRates.JPY * 100;
      prevCnyKrw = prevRates.KRW / prevRates.CNY;
      prevEurKrw = prevRates.KRW / prevRates.EUR;
    }

    function calcChange(current, prev) {
      if (!prev) return { change: null, changePoints: null, prevClose: null };
      const changePoints = current - prev;
      const change = (changePoints / prev) * 100;
      return {
        change: parseFloat(change.toFixed(2)),
        changePoints: parseFloat(changePoints.toFixed(2)),
        prevClose: parseFloat(prev.toFixed(2))
      };
    }

    const result = {
      usdkrw: {
        rate: parseFloat(usdKrw.toFixed(2)),
        ...calcChange(usdKrw, prevUsdKrw)
      },
      jpykrw: {
        rate: parseFloat(jpyKrw.toFixed(2)),
        ...calcChange(jpyKrw, prevJpyKrw)
      },
      cnykrw: {
        rate: parseFloat(cnyKrw.toFixed(2)),
        ...calcChange(cnyKrw, prevCnyKrw)
      },
      eurkrw: {
        rate: parseFloat(eurKrw.toFixed(2)),
        ...calcChange(eurKrw, prevEurKrw)
      },
      timestamp: new Date().toISOString(),
      source: source
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
