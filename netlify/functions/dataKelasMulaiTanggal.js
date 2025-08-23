// netlify/functions/pindahKelasMulaiTanggal.js
const API_BASE = "https://api.github.com/repos/digitalmtq/server/contents";

const ghHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github.v3+json",
  "Content-Type": "application/json",
});
const normKelas = (k) => (k?.startsWith("kelas_") ? k : `kelas_${k}`);

async function readDir(dir, token) {
  const res = await fetch(`${API_BASE}/${dir}`, { headers: ghHeaders(token) });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text().catch(()=>"") };
  return { ok: true, data: await res.json() };
}
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
async function writeJsonFile(path, arrayData, token, sha=null, message="update") {
  const body = {
    message,
    content: Buffer.from(JSON.stringify(arrayData, null, 2)).toString("base64"),
    committer: { name: "admin", email: "admin@local" },
  };
  if (sha) body.sha = sha;
  const res = await fetch(`${API_BASE}/${path}`, { method:"PUT", headers: ghHeaders(token), body: JSON.stringify(body) });
  if (!res.ok) return { ok:false, status:res.status, error: await res.text().catch(()=>"") };
  return { ok:true };
}

// Remap ID sesuai idMap
function mapIdIfNeeded(row, idMap) {
  if (!Array.isArray(idMap) || idMap.length === 0) return row;
  const oldId = (row.id ?? "").toString();
  const found = idMap.find(m => String(m.oldId) === oldId);
  if (found && found.newId) return { ...row, id: String(found.newId) };
  return row;
}

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
    if (!token) return { statusCode: 500, body: JSON.stringify({ error: "MTQ_TOKEN tidak tersedia" }) };

    let { kelasAsal, kelasTujuan, santriIds, startDate, idMap } = JSON.parse(event.body || "{}");
    if (!kelasAsal || !kelasTujuan || !Array.isArray(santriIds) || santriIds.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Wajib: kelasAsal, kelasTujuan, santriIds[]" }) };
    }

    const asal   = normKelas(kelasAsal);
    const tujuan = normKelas(kelasTujuan);
    const idsSet = new Set(santriIds.map(String));

    const hasStart = !!startDate;
    const dateOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
    if (hasStart && startDate && !dateOk(startDate)) {
      return { statusCode: 400, body: JSON.stringify({ error: "startDate harus format YYYY-MM-DD" }) };
    }

    // 1) list file absensi kelas asal
    const dir = await readDir("absensi", token);
    if (!dir.ok) return { statusCode: 500, body: JSON.stringify({ error: "Gagal baca folder absensi", detail: dir.error }) };

    const asalFiles = dir.data
      .filter(f => f.type === "file" && new RegExp(`^${asal}_\\d{4}-\\d{2}-\\d{2}\\.json$`).test(f.name))
      .map(f => ({ name: f.name, path: `absensi/${f.name}`, date: f.name.replace(`${asal}_`, "").replace(".json","") }))
      .filter(item => !hasStart || item.date >= startDate)
      .sort((a,b) => a.date.localeCompare(b.date));

    if (asalFiles.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: "Tidak ada file absensi yang cocok" }) };
    }

    const report = [];
    let totalMoved = 0;

    for (const f of asalFiles) {
      const tanggal = f.date;
      const srcPath = f.path;
      const dstPath = `absensi/${tujuan}_${tanggal}.json`;

      const src = await readJsonFile(srcPath, token);
      if (!src.ok || !src.exists) { report.push({ tanggal, moved:0, note:"asal tidak ada" }); continue; }

      const toMoveRaw = src.data.filter(r => matchIds(r, idsSet));
      if (toMoveRaw.length === 0) { report.push({ tanggal, moved:0, note:"tidak ada match" }); continue; }

      // Remap ID sesuai idMap (konsisten dg roster)
      const toMove = toMoveRaw.map(r => mapIdIfNeeded(r, idMap));
      const remaining = src.data.filter(r => !matchIds(r, idsSet));

      // baca tujuan
      const dst = await readJsonFile(dstPath, token);
      if (!dst.ok) { report.push({ tanggal, moved:0, note:"gagal baca tujuan" }); continue; }
      let dstArr = dst.data || [];

      // Hindari dupe (berdasarkan id/nis) — diasumsikan id sudah sinkron dg roster
      const idSet = new Set(dstArr.map(r => (r.id ?? "").toString()).filter(Boolean));
      const nisSet = new Set(dstArr.map(r => (r.nis ?? "").toString()).filter(Boolean));
      const appendable = toMove.filter(r => {
        const rid = (r.id ?? "").toString();
        const rnis = (r.nis ?? "").toString();
        return !( (rid && idSet.has(rid)) || (rnis && nisSet.has(rnis)) );
      });

      // tulis tujuan
      const okDst = await writeJsonFile(
        dstPath,
        [...dstArr, ...appendable],
        token,
        dst.exists ? dst.sha : null,
        dst.exists ? `Append ${appendable.length} santri -> ${tujuan} (${tanggal})`
                   : `Create ${tujuan} (${tanggal}) & seed ${appendable.length} santri`
      );
      if (!okDst.ok) { report.push({ tanggal, moved:0, note:"gagal tulis tujuan" }); continue; }

      // tulis sumber (hapus pindahan)
      const okSrc = await writeJsonFile(
        srcPath,
        remaining,
        token,
        src.sha,
        `Remove ${toMoveRaw.length} santri pindah dari ${asal} (${tanggal})`
      );
      if (!okSrc.ok) { report.push({ tanggal, moved:0, note:"gagal tulis asal" }); continue; }

      totalMoved += appendable.length;
      report.push({ tanggal, moved: appendable.length });
    }

    return { statusCode: 200, body: JSON.stringify({ success:true, totalMoved, details: report }) };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Unhandled error", detail: e.message }) };
  }
};
