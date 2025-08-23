const fetch = require('node-fetch');

const GITHUB_API = 'https://api.github.com/repos/digitalmtq/server/contents/absensi';
const TOKEN = process.env.MTQ_TOKEN;

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  try {
    const res = await fetch(GITHUB_API, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      const error = await res.text();
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Gagal fetch file absensi', error }),
      };
    }

    const data = await res.json();

    // Ambil hanya file kelas_*.json dengan tanggal
    const absensiFiles = data
      .filter(file => /^kelas_\d+_\d{4}-\d{2}-\d{2}\.json$/.test(file.name))
      .map(file => file.name); // contoh: "kelas_1_2025-08-01.json"

    return {
      statusCode: 200,
      body: JSON.stringify(absensiFiles),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Terjadi kesalahan', error: err.message }),
    };
  }
};
