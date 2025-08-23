// netlify/functions/dataKelasMulaiTanggal.js
const API_BASE = "https://api.github.com/repos/digitalmtq/server/contents";

const ghHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github.v3+json",
  "Content-Type": "application/json",
});

const normKelas = (k) => (k?.startsWith("kelas_") ? k : `kelas_${k}`);

const readDir = async (dir, token) => {
  const res = await fetch(`${API_BASE}/${dir}`, { headers: ghHeaders(token) });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text().catch(()=>"") };
  return { ok: true, data: await res.json() };
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

const writeJsonFile = async (path, arrayData, token, sha=null, message="update") => {
  const body = {
    message,
    content: Buffer.from(JSON.stringify(arrayData, null, 2)).toString("base64"),
    committer: { name: "admin", email: "admin@local" },
  };
  if (sha) body.sha = sha;
  const res = await fetch(`${API_BASE}/${path}`, { method:"PUT", headers: ghHeaders(token), body: JSON.stringify(body) });
  if (!res.ok) return { ok:false, status:res.status, error: await res.text().catch(()=>"") };
  return { ok:true };
};

const matchIds = (row, idsOrNisSet) => {
  const idStr  = (row.id ?? "").toString();
  const nisStr = (row.nis ?? "").toString();
  return idsOrNisSet.has(idStr) || (nisStr && idsOrNisSet.has(nisStr));
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST")
      return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };

    const token = process.env.MTQ_TOKEN;
    if (!token)
      return { statusCode: 500, body: JSON.stringify({ error: "MTQ_TOKEN tidak tersedia" }) };

    let payload = {};
    try { payload = JSON.parse(event.body || "{}"); } catch {}
    let { kelasAsal, kelasTujuan, santriIds, startDate } = payload;

    if (!kelasAsal || !kelasTujuan || !Array.isArray(santriIds) || santriIds.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Wajib: kelasAsal, kelasTujuan, santriIds[]" }) };
    }

    const asal   = normKelas(kelasAsal);
    const tujuan = normKelas(kelasTujuan);
    const idsSet = new Set(santriIds.map(String));
    const hasStart = !!startDate;
    const dateOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);

    if (hasStart && !dateOk(startDate)) {
      return { statusCode: 400, body: JSON.stringify({ error: "startDate harus format YYYY-MM-DD" }) };
    }

    // List semua file absensi
    const dir = await readDir("absensi", token);
    if (!dir.ok) return { statusCode: 500, body: JSON.stringify({ error: "Gagal membaca folder absensi", detail: dir.error }) };

    // Filter file milik kelas asal, dan jika ada startDate, hanya tanggal >= startDate
    const asalFiles = dir.data
      .filter(f => f.type === "file" && new RegExp(`^${asal}_\\d{4}-\\d{2}-\\d{2}\\.json$`).test(f.name))
      .map(f => ({ name: f.name, path: `absensi/${f.name}`, date: f.name.replace(`${asal}_`, "").replace(".json","") }))
      .filter(item => !hasStart || item.date >= startDate)  // lexicographic ok for YYYY-MM-DD
      .sort((a,b) => a.date.localeCompare(b.date));

    if (asalFiles.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: "Tidak ada file absensi yang cocok (kelas/tanggal)" }) };
    }

    const report = [];
    let totalMoved = 0;

    for (const f of asalFiles) {
      const tanggal = f.date;
      const srcPath = f.path;
      const dstPath = `absensi/${tujuan}_${tanggal}.json`;

      const src = await readJsonFile(srcPath, token);
      if (!src.ok || !src.exists) { report.push({ tanggal, moved:0, note:"asal tidak terbaca/ada" }); continue; }

      const toMove = src.data.filter(r => matchIds(r, idsSet));
      if (toMove.length === 0) { report.push({ tanggal, moved:0, note:"tidak ada match" }); continue; }

      const remaining = src.data.filter(r => !matchIds(r, idsSet));

      const dst = await readJsonFile(dstPath, token);
      if (!dst.ok) { report.push({ tanggal, moved:0, note:`gagal baca tujuan (${dst.status})` }); continue; }

      let dstArr = dst.data || [];

      // hindari duplikat di tujuan berdasar id/nis
      const idSet  = new Set(dstArr.map(r => (r.id ?? "").toString()).filter(Boolean));
      const nisSet = new Set(dstArr.map(r => (r.nis ?? "").toString()).filter(Boolean));
      const appendable = toMove.filter(r => {
        const rid  = (r.id ?? "").toString();
        const rnis = (r.nis ?? "").toString();
        return !( (rid && idSet.has(rid)) || (rnis && nisSet.has(rnis)) );
      });

      const okDst = await writeJsonFile(
        dstPath,
        [...dstArr, ...appendable],
        token,
        dst.exists ? dst.sha : null,
        dst.exists ? `Append ${appendable.length} santri -> ${tujuan} (${tanggal})`
                   : `Create ${tujuan} (${tanggal}) & seed ${appendable.length} santri`
      );
      if (!okDst.ok) { report.push({ tanggal, moved:0, note:"gagal tulis tujuan" }); continue; }

      const okSrc = await writeJsonFile(
        srcPath,
        remaining,
        token,
        src.sha,
        `Remove ${toMove.length} santri pindah dari ${asal} (${tanggal})`
      );
      if (!okSrc.ok) { report.push({ tanggal, moved:0, note:"gagal tulis asal" }); continue; }

      totalMoved += appendable.length;
      report.push({ tanggal, moved: appendable.length, created: !dst.exists });
    }

    return { statusCode: 200, body: JSON.stringify({ success:true, totalMoved, details: report }) };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Unhandled error", detail: e.message }) };
  }
};
