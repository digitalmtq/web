// netlify/functions/hapusSantri.js
const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }

    const { kelas, id } = JSON.parse(event.body);
    if (!kelas || !id) {
      return { statusCode: 400, body: JSON.stringify({ error: "Parameter 'kelas' dan 'id' wajib diisi" }) };
    }

    const filename = `kelas_${kelas}.json`;
    const url = `https://api.github.com/repos/digitalmtq/server/contents/${filename}`;
    const token = process.env.MTQ_TOKEN;

    console.log("➡️ Hapus santri ID:", id, "di file:", filename);

    // Ambil file dari GitHub
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json"
      }
    });

    if (res.status === 404) {
      console.warn("⚠️ File belum ada, buat file kosong []");
      const createRes = await fetch(url, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Buat file ${filename} kosong`,
          content: Buffer.from(JSON.stringify([], null, 2)).toString("base64")
        })
      });
      if (!createRes.ok) {
        const text = await createRes.text();
        console.error("❌ Gagal membuat file kosong:", text);
        return { statusCode: 500, body: JSON.stringify({ error: "Gagal buat file kosong" }) };
      }
      return { statusCode: 200, body: JSON.stringify({ success: true, note: "File baru dibuat kosong" }) };
    }

    if (!res.ok) {
      const text = await res.text();
      console.error("❌ Gagal ambil file:", res.status, text);
      return { statusCode: 500, body: JSON.stringify({ error: `Gagal ambil file GitHub (${res.status})` }) };
    }

    const fileData = await res.json();
    let santriData;
    try {
      santriData = JSON.parse(Buffer.from(fileData.content, "base64").toString("utf-8"));
    } catch (err) {
      console.error("❌ JSON parsing error:", err);
      return { statusCode: 500, body: JSON.stringify({ error: "JSON file tidak valid" }) };
    }

    console.log("✅ Data sebelum hapus:", santriData);

    // Filter santri berdasarkan ID
    const newSantri = santriData.filter(s => String(s.id) !== String(id));

    if (newSantri.length === santriData.length) {
      console.warn("⚠️ ID tidak ditemukan:", id);
      return { statusCode: 400, body: JSON.stringify({ error: `ID ${id} tidak ditemukan` }) };
    }

    // Update file di GitHub
    const updateRes = await fetch(url, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Hapus santri ID ${id}`,
        content: Buffer.from(JSON.stringify(newSantri, null, 2)).toString("base64"),
        sha: fileData.sha
      })
    });

    if (!updateRes.ok) {
      const text = await updateRes.text();
      console.error("❌ Gagal update file:", updateRes.status, text);
      return { statusCode: 500, body: JSON.stringify({ error: `Gagal update file (${updateRes.status})` }) };
    }

    console.log("✅ Santri berhasil dihapus:", id);
    return { statusCode: 200, body: JSON.stringify({ success: true, deletedId: id }) };

  } catch (err) {
    console.error("❌ Error umum:", err);
    return { statusCode: 500, body: JSON.stringify({ error: `Internal Server Error: ${err.message}` }) };
  }
};
