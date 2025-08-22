exports.handler = async (event) => {
  try {
    const token = process.env.MTQ_TOKEN;
    const kelas = event.queryStringParameters?.kelas;
    if (!kelas) return { statusCode: 400, body: JSON.stringify({ error: "Parameter 'kelas' wajib diisi" }) };

    const url = `https://api.github.com/repos/digitalmtq/server/contents/kelas_${kelas}.json`;

    const res = await fetch(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json"
      }
    });

    if (res.status === 404) return { statusCode: 200, body: JSON.stringify([]) }; // file belum ada

    if (!res.ok) {
      const text = await res.text();
      return { statusCode: res.status, body: JSON.stringify({ error: `Gagal fetch: ${text}` }) };
    }

    const result = await res.json();
    const santri = JSON.parse(Buffer.from(result.content, "base64").toString("utf-8"));

    return { statusCode: 200, body: JSON.stringify(santri) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
