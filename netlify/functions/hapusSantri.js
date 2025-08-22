exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method Not Allowed" })
      };
    }

    const { kelas, id } = JSON.parse(event.body);
    const filename = `absensi/kelas_${kelas}.json`;
    const url = `https://api.github.com/repos/digitalmtq/server/contents/${filename}`;

    console.log("➡️ Hapus santri:", id, "di", filename);

    // 🔹 Ambil file santri
    const res = await fetch(url, {
      headers: {
        Authorization: `token ${process.env.MTQ_TOKEN}`,
        Accept: "application/vnd.github.v3.raw"
      }
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("❌ Gagal ambil data GitHub:", res.status, text);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Gagal ambil data GitHub (${res.status})` })
      };
    }

    let santri;
    try {
      santri = await res.json();
    } catch (parseErr) {
      console.error("❌ Error parse JSON:", parseErr);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Format JSON file tidak valid" })
      };
    }

    console.log("✅ Data santri sebelum hapus:", santri.length);

    // 🔹 Filter santri
    const newSantri = santri.filter(s => String(s.id) !== String(id));
    console.log("✅ Data santri sesudah hapus:", newSantri.length);

    // 🔹 Ambil SHA file
    const fileInfoRes = await fetch(url, {
      headers: { Authorization: `token ${process.env.MTQ_TOKEN}` }
    });
    const fileInfo = await fileInfoRes.json();

    if (!fileInfo.sha) {
      console.error("❌ Tidak ada SHA:", fileInfo);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Gagal ambil SHA file" })
      };
    }

    // 🔹 Update file di GitHub
    const updateRes = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `token ${process.env.MTQ_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `Hapus santri id ${id}`,
        content: Buffer.from(JSON.stringify(newSantri, null, 2)).toString("base64"),
        sha: fileInfo.sha
      })
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error("❌ Gagal update file:", updateRes.status, errText);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Gagal update file (${updateRes.status})` })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, deletedId: id })
    };

  } catch (err) {
    console.error("❌ Error umum:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Internal Server Error: ${err.message}` })
    };
  }
};
