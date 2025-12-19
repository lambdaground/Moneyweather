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
    const apiKey = process.env.ECOS_API_KEY;
    
    if (!apiKey) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          bokRate: { rate: 3.0, change: 0, prevRate: 3.0 },
          bond3y: { yield: 2.85, change: -0.02 },
          bond10y: { yield: 2.95, change: 0.01 },
          cpi: { value: 103.5, change: 2.1 },
          ppi: { value: 115.2, change: 1.8 },
          ccsi: { value: 98.5, change: -1.2 },
          timestamp: new Date().toISOString(),
          source: 'mock'
        })
      };
    }

    const today = new Date();
    const endDate = today.toISOString().split('T')[0].replace(/-/g, '');
    const startDate = new Date(today.setMonth(today.getMonth() - 3)).toISOString().split('T')[0].replace(/-/g, '');

    async function fetchEcosData(statCode, itemCode, cycle = 'D') {
      try {
        const url = `https://ecos.bok.or.kr/api/StatisticSearch/${apiKey}/json/kr/1/10/${statCode}/${cycle}/${startDate}/${endDate}/${itemCode}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.StatisticSearch && data.StatisticSearch.row) {
          const rows = data.StatisticSearch.row;
          const latest = rows[rows.length - 1];
          const prev = rows.length > 1 ? rows[rows.length - 2] : latest;
          return {
            value: parseFloat(latest.DATA_VALUE),
            prevValue: parseFloat(prev.DATA_VALUE),
            date: latest.TIME
          };
        }
        return null;
      } catch (e) {
        console.error(`ECOS fetch error for ${statCode}:`, e);
        return null;
      }
    }

    const [bokRate, bond3y, bond10y, cpi, ppi, ccsi] = await Promise.all([
      fetchEcosData('722Y001', '0101000'),
      fetchEcosData('817Y002', '010200000'),
      fetchEcosData('817Y002', '010210000'),
      fetchEcosData('901Y009', '0', 'M'),
      fetchEcosData('901Y010', '0', 'M'),
      fetchEcosData('511Y002', 'FME/99988', 'M')
    ]);

    const result = {
      bokRate: bokRate ? {
        rate: bokRate.value,
        change: parseFloat((bokRate.value - bokRate.prevValue).toFixed(2)),
        prevRate: bokRate.prevValue
      } : { rate: 3.0, change: 0, prevRate: 3.0 },
      bond3y: bond3y ? {
        yield: bond3y.value,
        change: parseFloat((bond3y.value - bond3y.prevValue).toFixed(2))
      } : { yield: 2.85, change: -0.02 },
      bond10y: bond10y ? {
        yield: bond10y.value,
        change: parseFloat((bond10y.value - bond10y.prevValue).toFixed(2))
      } : { yield: 2.95, change: 0.01 },
      cpi: cpi ? {
        value: cpi.value,
        change: parseFloat(((cpi.value - cpi.prevValue) / cpi.prevValue * 100).toFixed(1))
      } : { value: 103.5, change: 2.1 },
      ppi: ppi ? {
        value: ppi.value,
        change: parseFloat(((ppi.value - ppi.prevValue) / ppi.prevValue * 100).toFixed(1))
      } : { value: 115.2, change: 1.8 },
      ccsi: ccsi ? {
        value: ccsi.value,
        change: parseFloat((ccsi.value - ccsi.prevValue).toFixed(1))
      } : { value: 98.5, change: -1.2 },
      timestamp: new Date().toISOString(),
      source: apiKey ? 'ecos' : 'mock'
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('ECOS API error:', error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        bokRate: { rate: 3.0, change: 0, prevRate: 3.0 },
        bond3y: { yield: 2.85, change: -0.02 },
        bond10y: { yield: 2.95, change: 0.01 },
        cpi: { value: 103.5, change: 2.1 },
        ppi: { value: 115.2, change: 1.8 },
        ccsi: { value: 98.5, change: -1.2 },
        timestamp: new Date().toISOString(),
        source: 'fallback'
      })
    };
  }
};
