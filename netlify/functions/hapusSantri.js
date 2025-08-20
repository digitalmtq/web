import fetch from "node-fetch";

export async function handler(event) {
  console.log("=== DEBUG hapusSantri.js ===");

  const token = process.env.MTQ_TOKEN;
  if (!token) {
    console.error("❌ MTQ_TOKEN tidak ditemukan di environment");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "MTQ_TOKEN tidak ada di environment" }),
    };
  }

  // Ambil parameter dari body (POST)
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    console.error("❌ Body bukan JSON:", event.body);
    return { statusCode: 400, body: JSON.stringify({ error: "Body harus JSON" }) };
  }

  const { kelas, id, nis } = body || {};
  console.log("Input:", { kelas, id, nis });

  if (!kelas) {
    return { statusCode: 400, body: JSON.stringify({ error: "Parameter 'kelas' wajib" }) };
  }
  if (!id && !nis) {
    return { statusCode: 400, body: JSON.stringify({ error: "Wajib sertakan 'id' atau 'nis'" }) };
  }

  const repo = "dickymiswardi/usermtq";
  const path = `absensi/kelas_${kelas}.json`;
  const url = `https://api.github.com/repos/${repo}/contents/${path}`;

  console.log("Target file:", path);

  try {
    // Ambil file lama
    const res = await fetch(url, {
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("❌ Gagal ambil data GitHub:", res.status, text);
      return { statusCode: res.status, body: JSON.stringify({ error: "Gagal ambil data GitHub", detail: text }) };
    }

    const fileData = await res.json();
    const content = Buffer.from(fileData.content, "base64").toString("utf-8");
    let data = JSON.parse(content);

    console.log("Jumlah santri sebelum:", data.length);

    // Filter data
    const newData = data.filter(
      (s) => !( (id && s.id == id) || (nis && s.nis == nis) )
    );

    console.log("Jumlah santri sesudah:", newData.length);

    if (newData.length === data.length) {
      return { statusCode: 404, body: JSON.stringify({ error: "Santri tidak ditemukan" }) };
    }

    // Simpan kembali ke GitHub
    const updateRes = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify({
        message: `Hapus santri ${id || nis} dari kelas ${kelas}`,
        content: Buffer.from(JSON.stringify(newData, null, 2)).toString("base64"),
        sha: fileData.sha,
      }),
    });

    if (!updateRes.ok) {
      const text = await updateRes.text();
      console.error("❌ Gagal update GitHub:", updateRes.status, text);
      return { statusCode: updateRes.status, body: JSON.stringify({ error: "Gagal update GitHub", detail: text }) };
    }

    console.log("✅ Santri berhasil dihapus:", id || nis);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, removed: id || nis }),
    };
  } catch (err) {
    console.error("❌ Exception:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
