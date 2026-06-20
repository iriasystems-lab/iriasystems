// Proxy function — forwards Claude API requests server-to-server (no CORS issues)
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const apiKey = (event.headers['x-claude-key'] || '').trim()
  if (!apiKey) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { type: 'authentication_error', message: 'Missing API key' } }),
    }
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: event.body,
    })
    const text = await res.text()
    return {
      statusCode: res.status,
      headers: { 'Content-Type': 'application/json' },
      body: text,
    }
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { type: 'proxy_error', message: err.message } }),
    }
  }
}
