const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }

    const { kelas, id } = JSON.parse(event.body);
    const filename = `absensi/kelas_${kelas}.json`;
    const url = `https://api.github.com/repos/digitalmtq/server/contents/${filename}`;

    console.log("➡️ Hapus santri:", id);

    // Ambil file JSON + SHA
    const fileRes = await fetch(url, {
      headers: { Authorization: `token ${process.env.MTQ_TOKEN}` }
    });

    let santri = [];
    let sha;

    if (fileRes.status === 404) {
      console.warn("⚠️ File belum ada, buat file kosong []");
      santri = [];
    } else if (fileRes.ok) {
      const fileData = await fileRes.json();
      sha = fileData.sha;
      const contentStr = Buffer.from(fileData.content, "base64").toString("utf-8");
      santri = JSON.parse(contentStr);
    } else {
      const text = await fileRes.text();
      return { statusCode: 500, body: JSON.stringify({ error: `Gagal ambil file (${fileRes.status}): ${text}` }) };
    }

    // Filter ID
    const newSantri = santri.filter(s => String(s.id).trim() !== String(id).trim());

    if (newSantri.length === santri.length) {
      return { statusCode: 400, body: JSON.stringify({ error: `ID ${id} tidak ditemukan` }) };
    }

    // Update file
    const updateRes = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `token ${process.env.MTQ_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `Hapus santri id ${id}`,
        content: Buffer.from(JSON.stringify(newSantri, null, 2)).toString("base64"),
        sha
      })
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      return { statusCode: 500, body: JSON.stringify({ error: `Gagal update file: ${errText}` }) };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, deletedId: id }) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: `Internal Server Error: ${err.message}` }) };
  }
};
