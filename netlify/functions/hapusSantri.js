import fetch from "node-fetch";

export async function handler(event) {
  console.log("=== HAPUS SANTRI START ===");

  const token = process.env.MTQ_TOKEN;
  if (!token) {
    console.error("❌ MTQ_TOKEN tidak tersedia di environment!");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server config error: MTQ_TOKEN missing" }),
    };
  }

  if (event.httpMethod !== "POST") {
    console.warn("❌ Method salah:", event.httpMethod);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Gunakan POST method" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
    console.log("📩 Request body:", body);
  } catch (err) {
    console.error("❌ Gagal parse body:", err.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Body harus JSON valid" }),
    };
  }

  const { kelas, id, nis } = body;
  if (!kelas) {
    console.warn("❌ Param kelas kosong");
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Parameter 'kelas' wajib diisi" }),
    };
  }
  if (!id && !nis) {
    console.warn("❌ Param id/nis kosong");
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Harus ada 'id' atau 'nis'" }),
    };
  }

  const repoOwner = "digitalmtq";
  const repoName = "server";
  const filePath = `kelas_${kelas}.json`;
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;

  try {
    // Ambil file existing dari GitHub
    console.log("🔗 GET:", apiUrl);
    const res = await fetch(apiUrl, {
      headers: { Authorization: `token ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("❌ Gagal ambil file:", res.status, text);
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: "Gagal ambil data GitHub" }),
      };
    }
    const fileData = await res.json();
    const sha = fileData.sha;
    const content = JSON.parse(
      Buffer.from(fileData.content, "base64").toString("utf-8")
    );

    console.log("📦 Data santri awal:", content);

    // Filter data
    let newData;
    if (id) {
      newData = content.filter((s) => String(s.id) !== String(id));
      console.log(`🗑 Filter by id=${id}`);
    } else if (nis) {
      newData = content.filter((s) => String(s.nis) !== String(nis));
      console.log(`🗑 Filter by nis=${nis}`);
    }

    if (newData.length === content.length) {
      console.warn("⚠ Tidak ada data yang dihapus");
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Santri tidak ditemukan" }),
      };
    }

    console.log("✅ Data setelah hapus:", newData);

    // Update file di GitHub
    const updateRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Hapus santri ${id ? `id=${id}` : `nis=${nis}`}`,
        content: Buffer.from(JSON.stringify(newData, null, 2)).toString("base64"),
        sha: sha,
      }),
    });

    if (!updateRes.ok) {
      const text = await updateRes.text();
      console.error("❌ Gagal update file:", updateRes.status, text);
      return {
        statusCode: updateRes.status,
        body: JSON.stringify({ error: "Gagal update file GitHub" }),
      };
    }

    console.log("✅ Update sukses");
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Santri berhasil dihapus" }),
    };
  } catch (err) {
    console.error("❌ Error di try-catch:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
