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
    const response = await fetch('https://api.alternative.me/fng/?limit=2');
    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      throw new Error('No fear and greed data available');
    }

    const current = data.data[0];
    const previous = data.data[1] || data.data[0];

    const currentValue = parseInt(current.value);
    const previousValue = parseInt(previous.value);
    const change = currentValue - previousValue;

    const result = {
      value: currentValue,
      classification: current.value_classification,
      change: change,
      previousValue: previousValue,
      timestamp: current.timestamp,
      updatedAt: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Fear & Greed API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch fear and greed index', message: error.message })
    };
  }
};
