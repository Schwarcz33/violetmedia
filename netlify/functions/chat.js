// Groq API Proxy — keeps API key server-side
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'GROQ_API_KEY not configured' }) };
  }

  try {
    const { messages, model, max_tokens, temperature } = JSON.parse(event.body);

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model: model || 'openai/gpt-oss-120b',
        messages: messages || [],
        max_tokens: Math.min(max_tokens || 300, 500),
        temperature: temperature || 0.7
      })
    });

    if (!res.ok) {
      const err = await res.text();
      return { statusCode: res.status, headers: corsHeaders(), body: err };
    }

    const data = await res.json();
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: err.message })
    };
  }
};

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}
