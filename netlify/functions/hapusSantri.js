const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }

    const { kelas, id } = JSON.parse(event.body);
    const filename = `absensi/kelas_${kelas}.json`;
    const url = `https://api.github.com/repos/digitalmtq/server/contents/${filename}`;

    console.log("➡️ Hapus santri:", id, "di", filename);

    // 🔹 Ambil file raw JSON
    const res = await fetch(url, {
      headers: {
        Authorization: `token ${process.env.MTQ_TOKEN}`,
        Accept: "application/vnd.github.v3.raw"
      }
    });

    let santri = [];
    if (res.status === 404) {
      console.warn("⚠️ File belum ada, buat file kosong []");
    } else if (res.ok) {
      try {
        santri = await res.json();
      } catch (e) {
        console.error("❌ File bukan JSON valid:", e);
        return { statusCode: 500, body: JSON.stringify({ error: "Format file tidak valid" }) };
      }
    } else {
      const text = await res.text();
      console.error("❌ Gagal ambil file:", res.status, text);
      return { statusCode: 500, body: JSON.stringify({ error: `Gagal ambil file (${res.status})` }) };
    }

    console.log("✅ Jumlah santri sebelum hapus:", santri.length);

    // 🔹 Hapus berdasarkan ID
    const newSantri = santri.filter(s => String(s.id).trim() !== String(id).trim());
    console.log("Jumlah sesudah hapus:", newSantri.length);

    // 🔹 Ambil SHA file untuk update
    let sha;
    const fileInfoRes = await fetch(url, { headers: { Authorization: `token ${process.env.MTQ_TOKEN}` } });
    if (fileInfoRes.ok) {
      const fileInfo = await fileInfoRes.json();
      sha = fileInfo.sha;
      console.log("SHA file:", sha);
    }

    // 🔹 Update atau buat file baru
    const updateRes = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `token ${process.env.MTQ_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `Hapus santri id ${id}`,
        content: Buffer.from(JSON.stringify(newSantri, null, 2)).toString("base64"),
        ...(sha ? { sha } : {})
      })
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error("❌ Gagal update file:", updateRes.status, errText);
      return { statusCode: 500, body: JSON.stringify({ error: `Gagal update file (${updateRes.status})` }) };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, deletedId: id }) };

  } catch (err) {
    console.error("❌ Error umum:", err);
    return { statusCode: 500, body: JSON.stringify({ error: `Internal Server Error: ${err.message}` }) };
  }
};
