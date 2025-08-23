// pindahKelas.js
const fetch = require("node-fetch");

const GITHUB_API = "https://api.github.com/repos/digitalmtq/server/contents";
const TOKEN = process.env.MTQ_TOKEN;

async function fetchGitHub(filePath) {
  const res = await fetch(`${GITHUB_API}/${filePath}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!res.ok) return { ok: false };
  const data = await res.json();
  return { ok: true, data };
}

async function updateGitHub(filePath, content, sha) {
  const body = {
    message: `Update file ${filePath}`,
    content: Buffer.from(JSON.stringify(content, null, 2)).toString("base64"),
    committer: { name: "admin", email: "admin@local" },
  };
  if (sha) body.sha = sha;

  const res = await fetch(`${GITHUB_API}/${filePath}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github.v3+json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

exports.handler = async (event) => {
  try {
    const { kelasAsal, kelasTujuan, santriIds, tanggal } = JSON.parse(event.body);

    if (!kelasAsal || !kelasTujuan || !santriIds?.length || !tanggal) {
      return { statusCode: 400, body: JSON.stringify({ error: "Parameter wajib: kelasAsal, kelasTujuan, santriIds, tanggal" }) };
    }

    const fileAsal = `absensi/${kelasAsal}_${tanggal}.json`;
    const fileTujuan = `absensi/${kelasTujuan}_${tanggal}.json`;

    // Ambil file asal
    const resAsal = await fetchGitHub(fileAsal);
    if (!resAsal.ok) return { statusCode: 404, body: JSON.stringify({ error: "File kelas asal tidak ditemukan" }) };
    let dataAsal = JSON.parse(Buffer.from(resAsal.data.content, "base64").toString("utf-8"));
    const shaAsal = resAsal.data.sha;

    // Ambil file tujuan
    const resTujuan = await fetchGitHub(fileTujuan);
    let dataTujuan = [];
    let shaTujuan = null;
    if (resTujuan.ok) {
      dataTujuan = JSON.parse(Buffer.from(resTujuan.data.content, "base64").toString("utf-8"));
      shaTujuan = resTujuan.data.sha;
    }

    // Filter santri yang dipindahkan
    const pindah = dataAsal.filter(s => santriIds.includes(s.id.toString()) || santriIds.includes(s.nis));
    if (!pindah.length) return { statusCode: 404, body: JSON.stringify({ error: "Santri tidak ditemukan di kelas asal" }) };

    // Hapus dari kelas asal
    dataAsal = dataAsal.filter(s => !santriIds.includes(s.id.toString()) && !santriIds.includes(s.nis));

    // Tambahkan ke kelas tujuan
    dataTujuan.push(...pindah);

    // Update GitHub
    const okAsal = await updateGitHub(fileAsal, dataAsal, shaAsal);
    const okTujuan = await updateGitHub(fileTujuan, dataTujuan, shaTujuan);

    if (okAsal && okTujuan) {
      return { statusCode: 200, body: JSON.stringify({ success: true, message: "Santri berhasil dipindahkan" }) };
    } else {
      return { statusCode: 500, body: JSON.stringify({ error: "Gagal update file di GitHub" }) };
    }

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
