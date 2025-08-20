import fetch from "node-fetch";

export async function handler(event) {
  console.log("=== [hapusSantri.js] START ===");

  try {
    // Pastikan method benar
    if (event.httpMethod !== "POST") {
      console.log("❌ Method salah:", event.httpMethod);
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method harus POST" }),
      };
    }

    // Token
    const token = process.env.MTQ_TOKEN;
    if (!token) {
      console.error("❌ MTQ_TOKEN tidak ditemukan di environment");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Server token hilang" }),
      };
    }

    // Parse body
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (err) {
      console.error("❌ Gagal parse body:", err.message);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Body harus JSON valid" }),
      };
    }

    const { kelas, id } = body;
    if (!kelas || !id) {
      console.error("❌ Parameter hilang:", body);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Parameter 'kelas' dan 'id' wajib ada" }),
      };
    }

    console.log("➡ Input:", { kelas, id });

    // URL GitHub raw
    const repoOwner = "digitalmtq";
    const repoName = "server";
    const branch = "main";
    const filePath = `absensi/kelas_${kelas}.json`;
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;

    console.log("➡ API URL:", apiUrl);

    // Ambil data file dulu
    const getRes = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!getRes.ok) {
      const txt = await getRes.text();
      console.error("❌ Gagal ambil file:", getRes.status, txt);
      return {
        statusCode: getRes.status,
        body: JSON.stringify({ error: "Gagal ambil data GitHub", detail: txt }),
      };
    }

    const fileData = await getRes.json();
    const sha = fileData.sha;
    const content = Buffer.from(fileData.content, "base64").toString();
    let santriList = [];

    try {
      santriList = JSON.parse(content);
    } catch (err) {
      console.error("❌ JSON file rusak:", err.message);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "File JSON tidak valid" }),
      };
    }

    console.log("➡ Jumlah santri sebelum hapus:", santriList.length);

    // Hapus santri berdasarkan id
    const newList = santriList.filter((s) => String(s.id) !== String(id));
    if (newList.length === santriList.length) {
      console.warn("⚠ ID tidak ditemukan:", id);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Santri tidak ditemukan" }),
      };
    }

    console.log("➡ Jumlah santri sesudah hapus:", newList.length);

    // Update file ke GitHub
    const updateRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify({
        message: `Hapus santri ID ${id} dari kelas ${kelas}`,
        content: Buffer.from(JSON.stringify(newList, null, 2)).toString("base64"),
        sha,
      }),
    });

    if (!updateRes.ok) {
      const txt = await updateRes.text();
      console.error("❌ Gagal update file:", updateRes.status, txt);
      return {
        statusCode: updateRes.status,
        body: JSON.stringify({ error: "Gagal update data GitHub", detail: txt }),
      };
    }

    console.log("✅ Santri berhasil dihapus:", id);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, id }),
    };
  } catch (err) {
    console.error("❌ Error utama:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error", detail: err.message }),
    };
  } finally {
    console.log("=== [hapusSantri.js] END ===");
  }
}
