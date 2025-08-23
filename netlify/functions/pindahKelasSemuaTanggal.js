// netlify/functions/pindahKelasSemuaTanggal.js
// NOTE: gunakan fetch bawaan Netlify, JANGAN require('node-fetch')

const API_BASE = "https://api.github.com/repos/digitalmtq/server/contents";

const ghHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github.v3+json",
  "Content-Type": "application/json",
});

const readDir = async (dir, token) => {
  const res = await fetch(`${API_BASE}/${dir}`, { headers: ghHeaders(token) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text };
  }
  const data = await res.json();
  return { ok: true, status: 200, data };
};

const readJsonFile = async (path, token) => {
  const res = await fetch(`${API_BASE}/${path}`, { headers: ghHeaders(token) });
  if (res.status === 404) return { ok: true, exists: false, sha: null, data: [] };
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
};

const writeJsonFile = async (path, arrayData, token, sha = null, message = "update") => {
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
};

const idOrNisMatch = (row, idsOrNisSet) => {
  const idStr = (row.id ?? "").toString();
  const nisStr = (row.nis ?? "").toString();
  return idsOrNisSet.has(idStr) || (nisStr && idsOrNisSet.has(nisStr));
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST")
      return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };

    const token = process.env.MTQ_TOKEN;
    if (!token)
      return { statusCode: 500, body: JSON.stringify({ error: "MTQ_TOKEN tidak tersedia di environment Netlify" }) };

    let payload = {};
    try { payload = JSON.parse(event.body || "{}"); } catch {}
    const { kelasAsal, kelasTujuan, santriIds } = payload;

    if (!kelasAsal || !kelasTujuan || !Array.isArray(santriIds) || santriIds.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Wajib: kelasAsal, kelasTujuan, santriIds[]" }) };
    }

    const normKelas = (k) => (k.startsWith("kelas_") ? k : `kelas_${k}`);
    const asal = normKelas(kelasAsal);
    const tujuan = normKelas(kelasTujuan);
    const idsSet = new Set(santriIds.map(String));

    // 1) list semua file dalam folder absensi
    const dir = await readDir("absensi", token);
    if (!dir.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: "Gagal membaca folder absensi", detail: dir.error, status: dir.status }) };
    }

    // 2) filter file milik kelas asal
    const asalFiles = dir.data
      .filter(f => f.type === "file" && new RegExp(`^${asal}_\\d{4}-\\d{2}-\\d{2}\\.json$`).test(f.name))
      .map(f => ({ name: f.name, path: `absensi/${f.name}` }));

    if (asalFiles.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: "Tidak ada file absensi untuk kelas asal" }) };
    }

    const report = [];
    let totalMoved = 0;

    for (const f of asalFiles) {
      const tanggal = f.name.replace(`${asal}_`, "").replace(".json", "");
      const srcPath = f.path;
      const dstPath = `absensi/${tujuan}_${tanggal}.json`;

      const src = await readJsonFile(srcPath, token);
      if (!src.ok) {
        report.push({ tanggal, moved: 0, note: `gagal baca asal (${src.status})` });
        continue;
      }
      if (!src.exists) {
        report.push({ tanggal, moved: 0, note: "asal tidak ada" });
        continue;
      }

      const toMove = src.data.filter(r => idOrNisMatch(r, idsSet));
      if (toMove.length === 0) {
        report.push({ tanggal, moved: 0, note: "santri tidak ada pada tanggal ini" });
        continue;
      }
      const remaining = src.data.filter(r => !idOrNisMatch(r, idsSet));

      const dst = await readJsonFile(dstPath, token);
      if (!dst.ok) {
        report.push({ tanggal, moved: 0, note: `gagal baca tujuan (${dst.status})` });
        continue;
      }
      let dstArr = dst.data || [];

      // hindari duplikasi di tujuan
      const idSet = new Set(dstArr.map(r => (r.id ?? "").toString()));
      const nisSet = new Set(dstArr.map(r => (r.nis ?? "").toString()).filter(Boolean));
      const appendable = toMove.filter(r => !idSet.has((r.id ?? "").toString()) && (!r.nis || !nisSet.has(r.nis.toString())));

      const writeDst = await writeJsonFile(
        dstPath,
        [...dstArr, ...appendable],
        dst.exists ? dst.sha : null,
        dst.exists
          ? `Append ${appendable.length} santri -> ${tujuan} (${tanggal})`
          : `Create ${tujuan} (${tanggal}) & seed ${appendable.length} santri`
      );
      if (!writeDst.ok) {
        report.push({ tanggal, moved: 0, note: `gagal tulis tujuan (${writeDst.status})` });
        continue;
      }

      const writeSrc = await writeJsonFile(
        srcPath,
        remaining,
        src.sha,
        `Remove ${toMove.length} santri pindah dari ${asal} (${tanggal})`
      );
      if (!writeSrc.ok) {
        report.push({ tanggal, moved: 0, note: `gagal tulis asal (${writeSrc.status})` });
        continue;
      }

      totalMoved += appendable.length;
      report.push({ tanggal, moved: appendable.length, created: !dst.exists, note: "" });
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, totalMoved, details: report }) };

  } catch (e) {
    // Pastikan tidak 502—selalu beri JSON error yang jelas
    return { statusCode: 500, body: JSON.stringify({ error: "Unhandled error", detail: e.message }) };
  }
};
