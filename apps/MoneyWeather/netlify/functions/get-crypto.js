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
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_last_updated_at=true',
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API returned ${response.status}`);
    }

    const data = await response.json();

    const result = {
      bitcoin: data.bitcoin ? {
        usd: data.bitcoin.usd,
        usd_24h_change: parseFloat((data.bitcoin.usd_24h_change || 0).toFixed(2)),
        last_updated_at: data.bitcoin.last_updated_at
      } : null,
      ethereum: data.ethereum ? {
        usd: data.ethereum.usd,
        usd_24h_change: parseFloat((data.ethereum.usd_24h_change || 0).toFixed(2)),
        last_updated_at: data.ethereum.last_updated_at
      } : null,
      timestamp: new Date().toISOString(),
      source: 'coingecko_usd'
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Crypto API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch crypto prices', message: error.message })
    };
  }
};
