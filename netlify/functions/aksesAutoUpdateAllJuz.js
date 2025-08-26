import fetch from 'node-fetch';

const GITHUB_REPO = 'digitalmtq/server';
const FILE_PATH = 'autoUpdateAllJuz.json';
const BRANCH = 'main';

const TOKEN = process.env.MTQ_TOKEN;

export async function handler(event) {
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
  };

  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;

  // === GET: ambil file autoUpdateAllJuz.json ===
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

  // === POST: update / tulis ulang file ===
  if (event.httpMethod === 'POST') {
    try {
      //
