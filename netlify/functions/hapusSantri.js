exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };

    const { kelas, id } = JSON.parse(event.body || "{}");
    if (!kelas || !id) return { statusCode: 400, body: JSON.stringify({ error: "Parameter 'kelas' dan 'id' wajib diisi" }) };

    const token = process.env.MTQ_TOKEN;
    const url = `https://api.github.com/repos/digitalmtq/server/contents/kelas_${kelas}.json`;

    // Ambil file
    const res = await fetch(url, { headers: { Authorization: `token ${token}` } });
    if (!res.ok) return { statusCode: res.status, body: JSON.stringify({ error: "Gagal ambil file" }) };

    const fileData = await res.json();
    const sha = fileData.sha;
    const santri = JSON.parse(Buffer.from(fileData.content, "base64").toString("utf-8"));

    const newSantri = santri.filter(s => String(s.id) !== String(id));
    if (newSantri.length === santri.length) return { statusCode: 400, body: JSON.stringify({ error: `ID ${id} tidak ditemukan` }) };

    // Update file
    const updateRes = await fetch(url, {
      method: "PUT",
      headers: { Authorization: `token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Hapus santri id ${id}`,
        content: Buffer.from(JSON.stringify(newSantri, null,2)).toString("base64"),
        sha
      })
    });

    if (!updateRes.ok) {
      const text = await updateRes.text();
      return { statusCode: 500, body: JSON.stringify({ error: `Gagal update file: ${text}` }) };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, deletedId: id }) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
