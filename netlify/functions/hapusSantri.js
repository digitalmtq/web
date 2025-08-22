const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    // Hanya POST
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }

    const { kelas, id } = JSON.parse(event.body);
    if (!kelas || !id) {
      return { statusCode: 400, body: JSON.stringify({ error: "Parameter 'kelas' dan 'id' wajib diisi" }) };
    }

    const filename = `absensi/kelas_${kelas}.json`;
    const url = `https://api.github.com/repos/digitalmtq/server/contents/${filename}`;
    const token = process.env.MTQ_TOKEN;

    console.log("➡️ Hapus santri:", id, "di", filename);

    // Ambil file santri dari GitHub
    const res = await fetch(url, { headers: { Authorization: `token ${token}` } });

    let santri = [];
    let sha;

    if (res.status === 404) {
      // File belum ada → buat kosong
      console.warn("⚠️ File belum ada, buat file kosong []");
      const createRes = await fetch(url, {
        method: "PUT",
        headers: { Authorization: `token ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Buat file ${filename} kosong`,
          content: Buffer.from(JSON.stringify([], null, 2)).toString("base64")
        })
      });

      if (!createRes.ok) {
        const text = await createRes.text();
        console.error("❌ Gagal membuat file kosong:", text);
        return { statusCode: 500, body: JSON.stringify({ error: "Gagal membuat file kosong" }) };
      }

      return { statusCode: 200, body: JSON.stringify({ success: true, deletedId: id, note: "File baru dibuat kosong" }) };
    }

    if (!res.ok) {
      const text = await res.text();
      console.error("❌ Gagal ambil data GitHub:", res.status, text);
      return { statusCode: 500, body: JSON.stringify({ error: `Gagal ambil data GitHub (${res.status})` }) };
    }

    // Ambil konten & decode JSON
    const fileData = await res.json();
    sha = fileData.sha;
    try {
      santri = JSON.parse(Buffer.from(fileData.content, "base64").toString("utf-8"));
    } catch (err) {
      console.error("❌ Error parse JSON:", err);
      return { statusCode: 500, body: JSON.stringify({ error: "Format JSON file tidak valid" }) };
    }

    console.log("✅ Data santri sebelum hapus:", santri.map(s => s.id));

    // Hapus berdasarkan ID (Number agar selalu cocok)
    const newSantri = santri.filter(s => Number(s.id) !== Number(id));
    if (newSantri.length === santri.length) {
      return { statusCode: 400, body: JSON.stringify({ error: `ID ${id} tidak ditemukan` }) };
    }

    console.log("✅ Data santri sesudah hapus:", newSantri.map(s => s.id));

    // Update file GitHub
    const updateRes = await fetch(url, {
      method: "PUT",
      headers: { Authorization: `token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Hapus santri id ${id}`,
        content: Buffer.from(JSON.stringify(newSantri, null, 2)).toString("base64"),
        sha
      })
    });

    if (!updateRes.ok) {
      const text = await updateRes.text();
      console.error("❌ Gagal update file:", updateRes.status, text);
      return { statusCode: 500, body: JSON.stringify({ error: `Gagal update file (${updateRes.status})` }) };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, deletedId: id }) };

  } catch (err) {
    console.error("❌ Error umum:", err);
    return { statusCode: 500, body: JSON.stringify({ error: `Internal Server Error: ${err.message}` }) };
  }
};
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
