const fetch = require('node-fetch');

const REPO = 'digitalmtq/server';
const TOKEN = process.env.MTQ_TOKEN;
const BRANCH = 'main';

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github.v3+json',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { kelas, tanggal, nis } = event.queryStringParameters;
    if (!kelas) return { statusCode: 400, body: JSON.stringify({ message: "'kelas' wajib diisi" }) };
    if (!tanggal) return { statusCode: 400, body: JSON.stringify({ message: "'tanggal' wajib diisi" }) };

    // 1️⃣ Ambil file kelas
    const resKelas = await fetch(`https://api.github.com/repos/${REPO}/contents/${kelas}.json`, { headers });
    if (!resKelas.ok) {
      const errText = await resKelas.text();
      return { statusCode: 500, body: JSON.stringify({ message: `Gagal ambil ${kelas}.json`, error: errText }) };
    }
    const kelasJson = await resKelas.json();
    let santriData = JSON.parse(Buffer.from(kelasJson.content, 'base64').toString('utf-8'));

    // 2️⃣ Filter NIS jika ada (untuk user NIS)
    if (nis) {
      santriData = santriData.filter(s => s.nis === nis);
    }

    // 3️⃣ Ambil absensi dari tanggal
    const absensiFile = `absensi/${kelas}_${tanggal}.json`;
    const resAbsensi = await fetch(`https://api.github.com/repos/${REPO}/contents/${absensiFile}`, { headers });
    let absensiData = [];
    if (resAbsensi.ok) {
      const absensiJson = await resAbsensi.json();
      absensiData = JSON.parse(Buffer.from(absensiJson.content, 'base64').toString('utf-8'));
    }

    // 4️⃣ Gabungkan data santri + absensi
    const result = santriData.map(s => {
      const abs = absensiData.find(a => a.id === s.id) || {};
      return {
        ...s,
        absensi: abs.absensi || '-',
        dari: abs.dari || '-',
        sampai: abs.sampai || '-',
        page: abs.page || '-',
        totalHalaman: abs.totalHalaman || '-',
        juzTerbaca: abs.juzTerbaca || '-',
        totalJuz: abs.totalJuz ?? 0,
        nilai: abs.nilai ?? '-',
      };
    });

    return { statusCode: 200, body: JSON.stringify(result) };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ message: 'Terjadi kesalahan', error: err.message }) };
  }
};
