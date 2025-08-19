import fetch from 'node-fetch';

const GITHUB_REPO = 'dickymiswardi/private';
const FILE_PATH = 'autoUpdateAllJuz.json';
const BRANCH = 'main';
const TOKEN = process.env.MTQ_TOKEN;

export async function handler() {
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
  };

  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Gagal ambil file dari GitHub');
    const json = await res.json();
    const content = Buffer.from(json.content, 'base64').toString('utf8');
    return { statusCode: 200, body: content };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
