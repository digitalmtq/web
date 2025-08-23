// netlify/functions/pindahRosterKelas.js

const API_BASE = "https://api.github.com/repos/digitalmtq/server/contents";
const ghHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github.v3+json",
  "Content-Type": "application/json",
});
const normKelas = (k) => (k && k.startsWith("kelas_") ? k : `kelas_${k}`);

async function readJsonFile(path, token) {
  const res = await fetch(`${API_BASE}/${path}`, { headers: ghHeaders(token) });
  if (res.status === 404) return { ok: true, exists: false, sha: null, data: [] };
  if (!res.ok) return { ok: false, status: res.status, error: await res.text().catch(()=>"") };
  const json = await res.json();
  let arr = [];
  try { arr = JSON.parse(Buffer.from(json.content, "base64").toString("utf-8")); } catch { arr = []; }
  if (!Array.isArray(arr)) arr = [];
  return { ok: true, exists: true, sha: json.sha, data: arr };
}

async function writeJsonFile(path, arrayData, token, sha = null, message = "update") {
  const body = {
    message,
    content: Buffer.from(JSON.stringify(arrayData, null, 2)).toString("base64"),
    committer: { name: "admin", email: "admin@local" },
  };
  if (sha) body.sha = sha;
  const res = await fetch(`${API_BASE}/${path}`, { method: "PUT", headers: ghHeaders(token), body: JSON.stringify(body) });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text().catch(()=>"") };
  return { ok: true };
}

// cari ID terkecil yang belum dipakai
function allocNextId(used) {
  let i = 1;
  while (used.has(String(i))) i++;
  return String(i);
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }
    const token = process.env.MTQ_TOKEN;
    if (!token) return { statusCode: 500, body: JSON.stringify({ error: "MTQ_TOKEN tidak tersedia" }) };

    let { kelasAsal, kelasTujuan, identifiers } = JSON.parse(event.body || "{}");
    if (!kelasAsal || !kelasTujuan || !Array.isArray(identifiers) || identifiers.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Wajib: kelasAsal, kelasTujuan, identifiers[]" }) };
    }

    const asal = normKelas(kelasAsal);
    const tujuan = normKelas(kelasTujuan);
    const asalPath = `${asal}.json`;
    const tujuanPath = `${tujuan}.json`;

    // baca sumber & tujuan
    const src = await readJsonFile(asalPath, token);
    if (!src.ok || !src.exists) return { statusCode: 404, body: JSON.stringify({ error: "File kelas asal tidak ditemukan" }) };
    const dst = await readJsonFile(tujuanPath, token);
    if (!dst.ok) return { statusCode: 500, body: JSON.stringify({ error: "Gagal baca kelas tujuan", detail: dst.error }) };

    const pick = new Set(identifiers.map(v => String(v).trim()).filter(Boolean));
    const match = (row) => {
      const id = (row.id ?? "").toString();
      const nis = (row.nis ?? "").toString();
      const nm = (row.nama ?? "").toLowerCase();
      return pick.has(id) || (nis && pick.has(nis)) || (nm && pick.has(nm));
    };

    const toMove = src.data.filter(match);
    if (toMove.length === 0) return { statusCode: 404, body: JSON.stringify({ error: "Santri tidak ditemukan di kelas asal" }) };

    // siapkan set ID terpakai di tujuan
    const dstArr = Array.isArray(dst.data) ? [...dst.data] : [];
    const usedIds = new Set(dstArr.map(r => (r.id ?? "").toString()).filter(Boolean));

    // buat idMap agar konsisten dengan absensi
    const idMap = []; // { oldId, newId, nis?, nama? }

    // upsert + auto-assign ID jika bentrok/ kosong
    const cleanedDst = dstArr.filter(r => {
      const rid = (r.id ?? "").toString();
      const rnis = (r.nis ?? "").toString();
      const rnm = (r.nama ?? "").toLowerCase();
      return !(pick.has(rid) || (rnis && pick.has(rnis)) || (rnm && pick.has(rnm)));
    });

    const movedWithIds = toMove.map(orig => {
      const row = { ...orig };
      const oldId = (row.id ?? "").toString();
      let targetId = oldId && !usedIds.has(oldId) ? oldId : allocNextId(usedIds);
      usedIds.add(targetId);
      if (oldId !== targetId) idMap.push({ oldId, newId: targetId, nis: row.nis ?? "", nama: row.nama ?? "" });
      row.id = targetId;
      return row;
    });

    const newDst = [...cleanedDst, ...movedWithIds];

    // tulis tujuan lalu asal
    const wDst = await writeJsonFile(
      tujuanPath, newDst, token, dst.exists ? dst.sha : null,
      dst.exists ? `Upsert ${movedWithIds.length} santri + auto-ID ke ${tujuan}` :
                   `Create ${tujuan} & seed ${movedWithIds.length} santri (auto-ID)`
    );
    if (!wDst.ok) return { statusCode: 500, body: JSON.stringify({ error: "Gagal menulis kelas tujuan" }) };

    const remaining = src.data.filter(r => !match(r));
    const wSrc = await writeJsonFile(
      asalPath, remaining, token, src.sha,
      `Remove ${toMove.length} santri pindah dari ${asal}`
    );
    if (!wSrc.ok) return { statusCode: 500, body: JSON.stringify({ error: "Gagal menulis kelas asal" }) };

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, moved: toMove.length, idMap })
    };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Unhandled error", detail: e.message }) };
  }
};
