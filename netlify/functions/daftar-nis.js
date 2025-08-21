const fetch = require('node-fetch');
const REPO = 'digitalmtq/server';
const TOKEN = process.env.MTQ_TOKEN;
const BRANCH = 'main';

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github.v3+json',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { nis, username, password } = JSON.parse(event.body || '{}');
    if (!nis || !username || !password) return { statusCode: 400, body: JSON.stringify({ message: 'Data tidak lengkap.' }) };

    // Ambil user.json
    const userRes = await fetch(`https://api.github.com/repos/${REPO}/contents/user.json`, { headers });
    const userJson = await userRes.json();
    const userSha = userJson.sha;
    const users = JSON.parse(Buffer.from(userJson.content, 'base64').toString('utf-8'));

    if (users.find(u => u.username === username)) {
      return { statusCode: 409, body: JSON.stringify({ message: 'Username sudah terdaftar.' }) };
    }

    // Tambahkan user NIS
    users.push({ username, password, nis: Array.isArray(nis) ? nis : [nis] });
    const updatedContent = Buffer.from(JSON.stringify(users, null, 2)).toString('base64');

    const updateRes = await fetch(`https://api.github.com/repos/${REPO}/contents/user.json`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ message: `Tambah user NIS ${username}`, content: updatedContent, sha: userSha, branch: BRANCH }),
    });

    if (!updateRes.ok) {
      const error = await updateRes.text();
      return { statusCode: 500, body: JSON.stringify({ message: 'Gagal menyimpan user.json', error }) };
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'User NIS berhasil ditambahkan.' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Terjadi kesalahan.', error: err.message }) };
  }
};
