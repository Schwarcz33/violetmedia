// ElevenLabs TTS Proxy — keeps API key server-side
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders('application/json'), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const EL_KEY = process.env.ELEVENLABS_API_KEY;
  if (!EL_KEY) {
    return { statusCode: 500, headers: corsHeaders('application/json'), body: JSON.stringify({ error: 'ELEVENLABS_API_KEY not configured' }) };
  }

  try {
    const { text, voiceId } = JSON.parse(event.body);

    if (!text || !voiceId) {
      return { statusCode: 400, headers: corsHeaders('application/json'), body: JSON.stringify({ error: 'text and voiceId required' }) };
    }

    // Limit text length for security
    const safeText = text.slice(0, 1000);

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key': EL_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: safeText,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true
        }
      })
    });

    if (!res.ok) {
      const err = await res.text();
      return { statusCode: res.status, headers: corsHeaders('application/json'), body: err };
    }

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return {
      statusCode: 200,
      headers: corsHeaders('audio/mpeg'),
      body: base64,
      isBase64Encoded: true
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders('application/json'),
      body: JSON.stringify({ error: err.message })
    };
  }
};

function corsHeaders(contentType) {
  return {
    'Content-Type': contentType || 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}
