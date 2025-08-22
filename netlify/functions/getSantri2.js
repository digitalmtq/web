exports.handler = async (event) => {
  try {
    const token = process.env.MTQ_TOKEN;
    const kelas = event.queryStringParameters?.kelas;
    if (!kelas) return { statusCode: 400, body: JSON.stringify({ error: "Parameter 'kelas' wajib diisi" }) };

    const apiUrl = `https://api.github.com/repos/digitalmtq/server/contents/absensi/kelas_${kelas}.json`;

    const res = await fetch(apiUrl, {
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" }
    });

    if (res.status === 404) {
      // File belum ada → buat kosong
      const createRes = await fetch(apiUrl, {
        method: "PUT",
        headers: { Authorization: `token ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: `Buat file kosong kelas_${kelas}`, content: Buffer.from(JSON.stringify([], null,2)).toString("base64") })
      });
      if (!createRes.ok) {
        const text = await createRes.text();
        return { statusCode: 500, body: JSON.stringify({ error: `Gagal buat file kosong: ${text}` }) };
      }
      return { statusCode: 200, body: JSON.stringify([]) };
    }

    if (!res.ok) {
      const text = await res.text();
      return { statusCode: res.status, body: JSON.stringify({ error: `Gagal fetch data: ${text}` }) };
    }

    const result = await res.json();
    const decoded = Buffer.from(result.content, "base64").toString("utf-8");
    return { statusCode: 200, body: JSON.stringify(JSON.parse(decoded)) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
