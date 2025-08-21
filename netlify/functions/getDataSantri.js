import fetch from "node-fetch";

export async function handler(event) {
  try {
    const token = process.env.MTQ_TOKEN;
    const { kelas } = event.queryStringParameters;

    if (!kelas) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Parameter 'kelas' wajib diisi" }),
      };
    }

    const owner = "digitalmtq";
    const repo = "server";
    const path = `${kelas}.json`; // contoh: kelas_1.json

    // Ambil file via GitHub API
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3.raw", // langsung JSON mentah
        },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: "Gagal ambil data", detail: errText }),
      };
    }

    const data = await res.json();
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
