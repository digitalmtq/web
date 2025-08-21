// netlify/functions/getSantri.js
import fetch from "node-fetch";

export async function handler(event) {
  const token = process.env.MTQ_TOKEN;
  const { kelas } = event.queryStringParameters;

  if (!kelas) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Parameter 'kelas' wajib diisi" }),
    };
  }

  const repo = "digitalmtq/server";
  const path = `kelas_${kelas}.json`;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      headers: { Authorization: `token ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Gagal ambil file ${path}`);
    }

    const file = await res.json();
    const content = Buffer.from(file.content, "base64").toString("utf8");
    const data = JSON.parse(content);

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
