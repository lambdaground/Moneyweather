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
    const apiKey = process.env.REB_API_KEY;
    
    if (!apiKey) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          gangnam: {
            index: 99.5,
            price: 24.88,
            change: 0.2,
            prevIndex: 99.3
          },
          timestamp: new Date().toISOString(),
          source: 'mock'
        })
      };
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');

    const url = `https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do?KEY=${apiKey}&Type=json&pIndex=1&pSize=10&STAT_CODE=A1001&DTACYCLE_CODE=MM&WRTTIME_IDTFR_ID=${year}${month}&CLS_ID=11680`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!data.SttsApiTblData || !data.SttsApiTblData[1] || !data.SttsApiTblData[1].row) {
      throw new Error('No REB data available');
    }

    const rows = data.SttsApiTblData[1].row;
    const gangnamRow = rows.find(r => r.CLS_NM && r.CLS_NM.includes('강남'));
    
    if (!gangnamRow) {
      throw new Error('Gangnam data not found');
    }

    const index = parseFloat(gangnamRow.DTA_VAL);
    const gangnamPrice = (index / 100) * 25;

    const prevIndex = 99.3;

    const result = {
      gangnam: {
        index: index,
        price: parseFloat(gangnamPrice.toFixed(2)),
        change: parseFloat(((index - prevIndex) / prevIndex * 100).toFixed(2)),
        prevIndex: prevIndex
      },
      timestamp: new Date().toISOString(),
      source: 'reb'
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('REB API error:', error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        gangnam: {
          index: 99.5,
          price: 24.88,
          change: 0.2,
          prevIndex: 99.3
        },
        timestamp: new Date().toISOString(),
        source: 'fallback'
      })
    };
  }
};
