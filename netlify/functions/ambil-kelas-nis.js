const fetch = require('node-fetch'); 
const REPO = 'digitalmtq/server';
const TOKEN = process.env.MTQ_TOKEN;
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github.v3+json',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Ambil daftar file repo
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents`, { headers });
    const data = await res.json();

    // Filter file kelas_{}.json
    const kelasFiles = data.filter(f => /^kelas_\d+\.json$/.test(f.name));

    const kelasData = [];

    for (const file of kelasFiles) {
      const kelasName = file.name.replace('.json', '');
      const fileRes = await fetch(file.download_url);
      const santri = await fileRes.json(); // berisi array {id, nis, nama, semester}
      kelasData.push({ kelas: kelasName, santri });
    }

    return { statusCode: 200, body: JSON.stringify(kelasData) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Terjadi kesalahan', error: err.message }) };
  }
};
