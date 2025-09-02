// netlify/functions/updateKeteranganKelas.js
// query: ?kelas=kelas_1
// body:  { key: "NIS/ID", keterangan: "A1" | "" }

const API_BASE = "https://api.github.com/repos/digitalmtq/server/contents";
const BRANCH   = "main";

async function fetchJson(path, token) {
  const r = await fetch(`${API_BASE}/${encodeURIComponent(path)}`, {
    headers: { Authorization: `token ${token}`, 'User-Agent': 'netlify-fn' }
  });
  if (!r.ok) throw new Error(`Fetch fail ${path}`);
  const j = await r.json();
  const content = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8'));
  return { content, sha: j.sha };
}

async function putJson(path, obj, sha, token, message) {
  const body = {
    message,
    content: Buffer.from(JSON.stringify(obj, null, 2)).toString('base64'),
    sha,
    branch: BRANCH
  };
  const r = await fetch(`${API_BASE}/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { Authorization: `token ${token}`, 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`Commit fail ${path}`);
  return r.json();
}

exports.handler = async (event) => {
  try {
    const kelas = new URLSearchParams(event.rawQuery || event.queryStringParameters).get('kelas');
    const { key, keterangan } = JSON.parse(event.body || '{}');
    if (!kelas || !key) return { statusCode: 400, body: JSON.stringify({ success:false, error:'Bad payload' }) };

    const token = process.env.MTQ_TOKEN;
    const filePath = `${kelas}.json`;

    const { content: roster, sha } = await fetchJson(filePath, token);

    // patch berdasarkan NIS/ID
    const k = String(key).trim();
    for (const s of roster) {
      const kk = String(s?.nis ?? s?.id ?? "").trim();
      if (kk === k) {
        // validasi sederhana
        if (keterangan && !/^A[1-8]$/.test(keterangan)) {
          return { statusCode: 400, body: JSON.stringify({ success:false, error:'Keterangan invalid' }) };
        }
        s.keterangan = keterangan || ""; // boleh kosong
        break;
      }
    }

    await putJson(filePath, roster, sha, token, `chore: update keterangan ${kelas} ${k} -> ${keterangan || '-'}`);
    return { statusCode: 200, body: JSON.stringify({ success:true }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ success:false, error:'Internal error' }) };
  }
};
