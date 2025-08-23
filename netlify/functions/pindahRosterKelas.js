// netlify/functions/pindahRosterKelas.js
// Pakai fetch bawaan Netlify runtime

const API_BASE = "https://api.github.com/repos/digitalmtq/server/contents";

const ghHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github.v3+json",
  "Content-Type": "application/json",
});

const normKelas = (k) => (k && k.startsWith("kelas_") ? k : `kelas_${k}`);

async function readJsonFile(path, token) {
  const res = await fetch(`${API_BASE}/${path}`, { headers: ghHeaders(token) });
  if (res.status === 404) {
    return { ok: true, exists: false, sha: null, data: [] };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text };
  }
  const json = await res.json();
  let arr = [];
  try {
    arr = JSON.parse(Buffer.from(json.content, "base64").toString("utf-8"));
  } catch {
    arr = [];
  }
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

  const res = await fetch(`${API_BASE}/${path}`, {
    method: "PUT",
    headers: ghHeaders(token),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text };
  }
  return { ok: true };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }

    const token = process.env.MTQ_TOKEN;
    if (!token) {
      return { statusCode: 500, body: JSON.stringify({ error: "MTQ_TOKEN tidak tersedia di environment Netlify" }) };
    }

    let payload = {};
    try { payload = JSON.parse(event.body || "{}"); } catch {}

    let { kelasAsal, kelasTujuan, identifiers } = payload;
    // identifiers: array berisi id atau nis atau nama (bebas campur), contoh: ["3","1234112","moro"]
    if (!kelasAsal || !kelasTujuan || !Array.isArray(identifiers) || identifiers.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Wajib: kelasAsal, kelasTujuan, identifiers[]" }) };
    }

    const asal = normKelas(kelasAsal);
    const tujuan = normKelas(kelasTujuan);
    const asalPath = `${asal}.json`;
    const tujuanPath = `${tujuan}.json`;

    // 1) Baca file asal & tujuan
    const src = await readJsonFile(asalPath, token);
    if (!src.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: "Gagal baca file kelas asal", detail: src.error, status: src.status }) };
    }
    if (!src.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: "File kelas asal tidak ditemukan" }) };
    }

    const dst = await readJsonFile(tujuanPath, token);
    if (!dst.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: "Gagal baca file kelas tujuan", detail: dst.error, status: dst.status }) };
    }

    // 2) Siapkan set untuk pencocokan & deduplikasi
    const pickSet = new Set(identifiers.map((v) => v.toString().trim()).filter(Boolean));

    const matchRow = (row) => {
      const idStr = (row.id ?? "").toString();
      const nisStr = (row.nis ?? "").toString();
      const namaStr = (row.nama ?? "").toString().toLowerCase();
      return pickSet.has(idStr) || (nisStr && pickSet.has(nisStr)) || (namaStr && pickSet.has(namaStr));
    };

    // 3) Ambil yang dipindah & sisakan yang lain
    const toMove = src.data.filter(matchRow);
    const remaining = src.data.filter((r) => !matchRow(r));

    if (toMove.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: "Santri tidak ditemukan di kelas asal" }) };
    }

    // 4) Deduplikasi di tujuan (berdasarkan id/nis) — upsert (hapus duplikat lama, tambah yang baru)
    let dstArr = dst.data || [];
    const dstIdSet = new Set(dstArr.map((r) => (r.id ?? "").toString()).filter(Boolean));
    const dstNisSet = new Set(dstArr.map((r) => (r.nis ?? "").toString()).filter(Boolean));

    // buang yang bentrok dulu
    dstArr = dstArr.filter((r) => {
      const rid = (r.id ?? "").toString();
      const rnis = (r.nis ?? "").toString();
      return !( (rid && pickSet.has(rid)) || (rnis && pickSet.has(rnis)) || (r.nama && pickSet.has(r.nama.toString().toLowerCase())) );
    });

    // tambahkan yang dipindah (upsert)
    const newDst = [...dstArr, ...toMove];

    // 5) Tulis tujuan (buat baru kalau belum ada)
    const writeDst = await writeJsonFile(
      tujuanPath,
      newDst,
      token,
      dst.exists ? dst.sha : null,
      dst.exists
        ? `Upsert ${toMove.length} santri ke ${tujuan}`
        : `Create ${tujuan} & seed ${toMove.length} santri (pindah)`
    );
    if (!writeDst.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: "Gagal menulis file kelas tujuan" }) };
    }

    // 6) Tulis asal (hapus yang dipindah)
    const writeSrc = await writeJsonFile(
      asalPath,
      remaining,
      token,
      src.sha,
      `Remove ${toMove.length} santri dari ${asal} (pindah kelas)`
    );
    if (!writeSrc.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: "Gagal menulis file kelas asal" }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        moved: toMove.length,
        from: asal,
        to: tujuan,
      }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Unhandled error", detail: e.message }) };
  }
};
