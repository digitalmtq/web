export async function handler(event) {
  const token = process.env.MTQ_TOKEN;
  const kelas = event.queryStringParameters.kelas;

  if (!kelas) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Parameter 'kelas' wajib diisi" })
    };
  }

  // URL API GitHub untuk file kelas
  const apiUrl = `https://api.github.com/repos/digitalmtq/server/contents/kelas_${kelas}.json`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json"
      }
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Gagal fetch data: ${response.status}` })
      };
    }

    const result = await response.json();

    // Decode base64 content menjadi JSON
    const decoded = Buffer.from(result.content, 'base64').toString('utf-8');
    const santriData = JSON.parse(decoded);

    return {
      statusCode: 200,
      body: JSON.stringify(santriData)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
