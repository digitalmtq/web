// netlify/functions/hapusSantri.js
import fetch from "node-fetch";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const token = process.env.MTQ_TOKEN;
  const { id, kelas } = JSON.parse(event.body);

  if (!id || !kelas) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Parameter 'id' dan 'kelas' wajib diisi" }),
    };
  }

  const repo = "digitalmtq/server";
  const path = `absensi/kelas_${kelas}.json`;

  try {
    // Ambil file kelas
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      headers: { Authorization: `token ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Gagal ambil file kelas_${kelas}.json`);
    }

    const file = await res.json();
    const content = Buffer.from(file.content, "base64").toString("utf8");
    const data = JSON.parse(content);

    // Hapus berdasarkan id
    const newData = data.filter((s) => s.id !== id);

    if (newData.length === data.length) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Santri dengan id ${id} tidak ditemukan` }),
      };
    }

    // Update file di GitHub
    const updatedContent = Buffer.from(
      JSON.stringify(newData, null, 2)
    ).toString("base64");

    const updateRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Hapus santri id=${id} dari kelas ${kelas}`,
        content: updatedContent,
        sha: file.sha,
      }),
    });

    if (!updateRes.ok) {
      throw new Error("Gagal update file kelas di GitHub");
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
