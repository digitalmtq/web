export async function handler(event) {
  const token = process.env.MTQ_TOKEN;
  const kelas = event.queryStringParameters?.kelas;

  if (!kelas) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Parameter 'kelas' wajib diisi" })
    };
  }

  const apiUrl = `https://api.github.com/repos/digitalmtq/server/contents/kelas_${kelas}.json`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json"
      }
    });

    if (!response.ok) {
      // Kalau 404 → return array kosong
      if (response.status === 404) return { statusCode: 200, body: JSON.stringify([]) };

      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Gagal fetch data: ${response.status}` })
      };
    }

    const result = await response.json();

    // Decode base64 -> UTF-8
    let decoded = [];
    try {
      decoded = JSON.parse(Buffer.from(result.content, 'base64').toString('utf-8'));
    } catch (err) {
      decoded = []; // fallback aman kalau JSON corrupt
    }

    if (!Array.isArray(decoded)) decoded = [];

    return {
      statusCode: 200,
      body: JSON.stringify(decoded)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
