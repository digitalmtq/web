// netlify/functions/pindahKelasSemuaTanggal.js
const API_BASE = "https://api.github.com/repos/digitalmtq/server/contents";

const ghHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github.v3+json",
  "Content-Type": "application/json",
});

const readDir = async (dir, token) => {
  const res = await fetch(`${API_BASE}/${dir}`, { headers: ghHeaders(token) });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text().catch(()=>"") };
  return { ok: true, status: 200, data: await res.json() };
};

const readJsonFile = async (path, token) => {
  const res = await fetch(`${API_BASE}/${path}`, { headers: ghHeaders(token) });
  if (res.status === 404) return { ok: true, exists: false, sha: null, data: [] };
  if (!res.ok) return { ok: false, status: res.status, error: await res.text().catch(()=>"") };
  const json = await res.json();
  let arr = [];
  try { arr = JSON.parse(Buffer.from(json.content, "base64").toString("utf-8")); } catch { arr = []; }
  if (!Array.isArray(arr)) arr = [];
  return { ok: true, exists: true, sha: json.sha, data: arr };
};

const writeJsonFile = async (path, arrayData, token, sha = null, message = "update") => {
  const body = {
    message,
    content: Buffer.from(JSON.stringify(arrayData, null, 2)).toString("base64"),
    committer: { name: "admin", email: "admin@local" },
  };
  if (sha) body.sha = sha;
  const res = await fetch(`${API_BASE}/${path}`, { method: "PUT", headers: ghHeaders(token), body: JSON.stringify(body) });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text().catch(()=>"") };
  return { ok: true };
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };

    const token = process.env.MTQ_TOKEN;
    if (!token) return { statusCode: 500, body: JSON.stringify({ error: "MTQ_TOKEN tidak tersedia" }) };

    let payload = {};
    try { payload = JSON.parse(event.body || "{}"); } catch {}
    let { kelasAsal, kelasTujuan, santriIds } = payload;

    if (!kelasAsal || !kelasTujuan || !Array.isArray(santriIds) || santriIds.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Wajib: kelasAsal, kelasTujuan, santriIds[]" }) };
    }

    const normKelas = (k) => (k.startsWith("kelas_") ? k : `kelas_${k}`);
    const asal = normKelas(kelasAsal);
    const tujuan = normKelas(kelasTujuan);

    // --- Ambil roster kelas asal untuk memetakan id <-> nis <-> nama ---
    const roster = await readJsonFile(`${asal}.json`, token);
    const selectedSet = new Set(santriIds.map(String));
    const idSet   = new Set();
    const nisSet  = new Set();
    const namaSet = new Set();

    if (roster.ok) {
      for (const s of roster.data) {
        const id  = (s.id ?? "").toString();
        const nis = (s.nis ?? "").toString();
        const nm  = (s.nama ?? "").toString();
        if (selectedSet.has(id) || (nis && selectedSet.has(nis))) {
          if (id)  idSet.add(id);
          if (nis) nisSet.add(nis);
          if (nm)  namaSet.add(nm);
        }
      }
    }
    // fallback: kalau user kirim id saja & roster gagal, tetap gunakan selectedSet sebagai id
    for (const v of selectedSet) idSet.add(v);

    const matchRow = (row) => {
      const rid = (row.id ?? "").toString();
      const rnis = (row.nis ?? "").toString();
      const rnm = (row.nama ?? "").toString();
      return (rid && idSet.has(rid)) || (rnis && nisSet.has(rnis)) || (rnm && namaSet.has(rnm));
    };

    // 1) List semua file di /absensi
    const dir = await readDir("absensi", token);
    if (!dir.ok) return { statusCode: 500, body: JSON.stringify({ error: "Gagal membaca folder absensi", detail: dir.error, status: dir.status }) };

    // 2) Filter file milik kelas asal
    const asalFiles = dir.data
      .filter(f => f.type === "file" && new RegExp(`^${asal}_\\d{4}-\\d{2}-\\d{2}\\.json$`).test(f.name))
      .map(f => ({ name: f.name, path: `absensi/${f.name}` }));

    if (asalFiles.length === 0) return { statusCode: 404, body: JSON.stringify({ error: "Tidak ada file absensi untuk kelas asal" }) };

    const report = [];
    let totalMoved = 0;

    for (const f of asalFiles) {
      const tanggal = f.name.replace(`${asal}_`, "").replace(".json", "");
      const srcPath = f.path;
      const dstPath = `absensi/${tujuan}_${tanggal}.json`;

      const src = await readJsonFile(srcPath, token);
      if (!src.ok || !src.exists) { report.push({ tanggal, moved: 0, note: "asal tidak terbaca/ada" }); continue; }

      const toMove = src.data.filter(matchRow);
      if (toMove.length === 0) { report.push({ tanggal, moved: 0, note: "tidak ada match (id/nis/nama)" }); continue; }

      const remaining = src.data.filter(r => !matchRow(r));

      const dst = await readJsonFile(dstPath, token);
      if (!dst.ok) { report.push({ tanggal, moved: 0, note: `gagal baca tujuan (${dst.status})` }); continue; }

      let dstArr = dst.data || [];
      const dstId  = new Set(dstArr.map(r => (r.id ?? "").toString()).filter(Boolean));
      const dstNis = new Set(dstArr.map(r => (r.nis ?? "").toString()).filter(Boolean));

      const appendable = toMove.filter(r => {
        const rid = (r.id ?? "").toString();
        const rnis = (r.nis ?? "").toString();
        const dupId  = rid && dstId.has(rid);
        const dupNis = rnis && dstNis.has(rnis);
        return !(dupId || dupNis);
      });

      // Tulis tujuan (buat baru kalau belum ada)
      const okDst = await writeJsonFile(
        dstPath,
        [...dstArr, ...appendable],
        token,
        dst.exists ? dst.sha : null,
        dst.exists
          ? `Append ${appendable.length} santri -> ${tujuan} (${tanggal})`
          : `Create ${tujuan} (${tanggal}) & seed ${appendable.length} santri`
      );
      if (!okDst.ok) { report.push({ tanggal, moved: 0, note: `gagal tulis tujuan (${okDst.status})` }); continue; }

      // Tulis sumber (hapus pindahan)
      const okSrc = await writeJsonFile(
        srcPath,
        remaining,
        token,
        src.sha,
        `Remove ${toMove.length} santri pindah dari ${asal} (${tanggal})`
      );
      if (!okSrc.ok) { report.push({ tanggal, moved: 0, note: `gagal tulis asal (${okSrc.status})` }); continue; }

      totalMoved += appendable.length;
      report.push({ tanggal, moved: appendable.length, created: !dst.exists, note: appendable.length===0 ? "duplikat di tujuan" : "" });
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, totalMoved, details: report }) };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Unhandled error", detail: e.message }) };
  }
};
