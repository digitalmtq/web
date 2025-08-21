import fetch from "node-fetch";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const token = process.env.MTQ_TOKEN;
  const { id, kelas } = JSON.parse(event.body || "{}");

  if (!id || !kelas) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Parameter 'id' dan 'kelas' wajib diisi" }),
    };
  }

  const owner = "digitalmtq";
  const repo = "server";
  const path = `${kelas}.json`; // contoh: kelas_1.json
  const branch = "main";

  try {
    // 1. Ambil file lama
    const fileRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!fileRes.ok) {
      const err = await fileRes.text();
      console.error("❌ Gagal ambil file:", err);
      return { statusCode: fileRes.status, body: err };
    }

    const fileData = await fileRes.json();
    const sha = fileData.sha;
    const santriList = JSON.parse(
      Buffer.from(fileData.content, "base64").toString("utf8")
    );

    // 2. Filter data santri
    const updatedList = santriList.filter((s) => String(s.id) !== String(id));
    if (updatedList.length === santriList.length) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Santri tidak ditemukan" }),
      };
    }

    // 3. Encode ulang
    const newContent = Buffer.from(
      JSON.stringify(updatedList, null, 2)
    ).toString("base64");

    // 4. Push ke GitHub
    const updateRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({
          message: `Hapus santri id ${id} dari ${kelas}`,
          content: newContent,
          sha,
          branch,
        }),
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.text();
      console.error("❌ Gagal update file:", err);
      return { statusCode: updateRes.status, body: err };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, id }),
    };
  } catch (err) {
    console.error("❌ Error di hapusSantri.js:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
