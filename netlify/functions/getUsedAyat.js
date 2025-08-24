// netlify/functions/getUsedAyat.js
import fetch from "node-fetch";

/* ========= Util tanggal ========= */
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function* eachDate(startStr, endStr) {
  const start = new Date(startStr);
  const end = new Date(endStr);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    yield fmtDate(d);
  }
}

/* ========= Quran helpers ========= */
const JUMLAH_AYAT = [
  null,
  7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,
  135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,
  85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,
  13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,
  42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,
  11,11,8,3,9,5,4,7,3,6,3,5,4,5,6
];
function isValidSA(s, a) {
  const ns = Number(s), na = Number(a);
  if (!Number.isInteger(ns) || !Number.isInteger(na)) return false;
  if (ns < 1 || ns > 114) return false;
  const max = JUMLAH_AYAT[ns];
  return !!max && na >= 1 && na <= max;
}
function expandRange(dariStr, sampaiStr) {
  if (!dariStr || !sampaiStr) return [];
  const [s1, a1] = String(dariStr).split(":").map(Number);
  const [s2, a2] = String(sampaiStr).split(":").map(Number);
  if (!isValidSA(s1, a1) || !isValidSA(s2, a2)) return [];
  if (s1 > s2 || (s1 === s2 && a1 > a2)) return expandRange(`${s2}:${a2}`, `${s1}:${a1}`);

  const out = [];
  for (let s = s1; s <= s2; s++) {
    const startA = (s === s1) ? a1 : 1;
    const endA = (s === s2) ? a2 : JUMLAH_AYAT[s];
    for (let a = startA; a <= endA; a++) out.push(`${s}:${a}`);
  }
  return out;
}

/* ========= Base URL untuk call function internal ========= */
function baseUrl() {
  return process.env.URL || process.env.DEPLOY_PRIME_URL || "http://localhost:8888";
}

/* ========= Filter akses (meniru loadSantriData) ========= */
function filterSantriByUser(santriData, user, kelas) {
  if (!user) return santriData; // tanpa user → semua santri kelas
  if (Array.isArray(user.kelas) && user.kelas.length && !user.kelas.includes(kelas)) {
    return []; // kelas tidak diizinkan
  }
  if (Array.isArray(user.nis) && user.nis.length) {
    const nisSet = new Set(user.nis.map(String));
    return santriData.filter(s => nisSet.has(String(s.nis)));
  }
  return santriData;
}

/* ========= Handler ========= */
export async function handler(event) {
  try {
    const q = event.queryStringParameters || {};
    const kelas = q.kelas;
    const excludeTanggal = q.excludeTanggal || ""; // tanggal aktif: biar tetap bisa pilih
    const username = q.username || "";             // kirim dari frontend (pengganti localStorage)

    if (!kelas) {
      return { statusCode: 400, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Parameter 'kelas' wajib diisi" }) };
    }

    // default rentang: 1 Jan tahun berjalan → hari ini
    const now = new Date();
    const year = now.getFullYear();
    const start = q.start || `${year}-01-01`;
    const end   = q.end   || fmtDate(now);

    const base = baseUrl();

    // (1) Ambil santri kelas
    const resSantri = await fetch(`${base}/.netlify/functions/getSantri?kelas=${encodeURIComponent(kelas)}`);
    if (!resSantri.ok) {
      return { statusCode: 502, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: `Gagal ambil getSantri (${resSantri.status})` }) };
    }
    let santriData = await resSantri.json();

    // (2) Ambil user & terapkan filter akses
    let user = null;
    if (username) {
      try {
        const resUsers = await fetch(`${base}/.netlify/functions/getUsers`);
        if (resUsers.ok) {
          const users = await resUsers.json();
          user = Array.isArray(users) ? users.find(u => u.username === username) : null;
        }
      } catch (_) { /* ignore */ }
    }
    santriData = filterSantriByUser(santriData, user, kelas);

    // kalau user punya batasan kelas dan kelas tidak diizinkan → kosong
    if (user && Array.isArray(user.kelas) && user.kelas.length && !user.kelas.includes(kelas)) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ used: {}, meta: { kelas, start, end, excludeTanggal, filtered: true, reason: "kelas not allowed" } })
      };
    }

    // set id/nis yang dihitung
    const allowedIds = new Set(
      santriData.map(s => String(s.id ?? s.nis ?? "")).filter(Boolean)
    );

    // (3) Loop hari: panggil getAbsensi → ARRAY seperti contohmu
    const usedMap = new Map(); // idKey -> Set("s:a")
    let filesOK = 0, filesErr = 0;

    for (const ymd of eachDate(start, end)) {
      // skip tanggal aktif — supaya masih bisa pilih/edit hari yang sama
      if (excludeTanggal && String(ymd) === String(excludeTanggal)) continue;

      try {
        const urlAbs = `${base}/.netlify/functions/getAbsensi?kelas=${encodeURIComponent(kelas)}&tanggal=${encodeURIComponent(ymd)}`;
        const resAbs = await fetch(urlAbs);
        if (!resAbs.ok) { filesErr++; continue; }

        const rows = await resAbs.json(); // <-- ARRAY, seperti raw GitHub-mu
        if (!Array.isArray(rows)) { filesErr++; continue; }
        filesOK++;

        for (const row of rows) {
          // jika file mencantumkan tanggal per-objek, hormati excludeTanggal lagi
          if (excludeTanggal && row.tanggal && String(row.tanggal) === String(excludeTanggal)) continue;

          const idKey = String(row.id ?? row.nis ?? row.idSantri ?? "").trim();
          if (!idKey || (allowedIds.size && !allowedIds.has(idKey))) continue;

          if (!usedMap.has(idKey)) usedMap.set(idKey, new Set());

          // format per-ayat
          if (row.surah != null && row.ayat != null && isValidSA(row.surah, row.ayat)) {
            usedMap.get(idKey).add(`${Number(row.surah)}:${Number(row.ayat)}`);
            continue;
          }
          // atau format rentang dari→sampai
          if (row.dari && row.sampai) {
            for (const key of expandRange(row.dari, row.sampai)) {
              usedMap.get(idKey).add(key);
            }
          }
        }
      } catch (_) {
        filesErr++;
      }
    }

    // (4) hasilkan JSON sederhana
    const usedOut = {};
    for (const [idKey, setVal] of usedMap.entries()) usedOut[idKey] = Array.from(setVal);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        used: usedOut,
        meta: {
          kelas,
          start, end,
          excludeTanggal: excludeTanggal || null,
          username: username || null,
          totalSantri: Object.keys(usedOut).length,
          files_ok: filesOK,
          files_error: filesErr
        }
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Terjadi kesalahan internal getUsedAyat", message: String(err?.message || err) }),
    };
  }
}
