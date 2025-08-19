import fetch from 'node-fetch';

const GITHUB_REPO = 'dickymiswardi/private';
const FILE_PATH = 'autoUpdateAllJuz.json';
const BRANCH = 'main';

const TOKEN = process.env.MTQ_TOKEN;

export async function handler(event) {
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
  };

  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;

  if (event.httpMethod === 'GET') {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        return { statusCode: res.status, body: JSON.stringify({ error: 'Gagal ambil file.' }) };
      }
      const json = await res.json();
      const content = Buffer.from(json.content, 'base64').toString('utf8');
      return { statusCode: 200, body: content };
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const resGet = await fetch(url, { headers });
      if (!resGet.ok) throw new Error('Gagal ambil SHA file');
      const fileData = await resGet.json();
      const sha = fileData.sha;

      const existingContent = Buffer.from(fileData.content, 'base64').toString('utf8');
      let existingJson = [];
      try {
        existingJson = JSON.parse(existingContent);
        if (!Array.isArray(existingJson)) existingJson = [];
      } catch {
        existingJson = [];
      }

      const body = JSON.parse(event.body);
      const newData = {
        updatedAt: new Date().toISOString(),
        fromDate: body.fromDate || body.from_date,
        toDate: body.toDate || body.to_date,
        kelas: body.kelas,
        data: body.data,
      };

      // Cari index data lama berdasarkan kelas yang sama
      const existingIndex = existingJson.findIndex(item => item.kelas === newData.kelas);

      if (existingIndex !== -1) {
        // Replace data lama dengan data baru
        existingJson[existingIndex] = newData;
      } else {
        // Jika tidak ada, tambah data baru
        existingJson.push(newData);
      }

      const contentEncoded = Buffer.from(JSON.stringify(existingJson, null, 2)).toString('base64');

      const updateRes = await fetch(url, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Update autoUpdateAllJuz.json at ${new Date().toISOString()}`,
          content: contentEncoded,
          sha,
          branch: BRANCH,
        }),
      });

      if (!updateRes.ok) {
        const errorText = await updateRes.text();
        return { statusCode: updateRes.status, body: JSON.stringify({ error: errorText }) };
      }

      return { statusCode: 200, body: JSON.stringify({ message: 'File berhasil diupdate' }) };
    } catch (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
}
