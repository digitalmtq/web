// netlify/functions/hapusSantri.js
import fetch from "node-fetch";

/**
 * Util sederhana untuk panggilan GitHub API (Contents API).
 */
async function ghGet(url, token) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${url} gagal: ${res.status} ${text}`);
  }
  return res.json();
}

async function ghPut(url, token, body) {
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PUT ${url} gagal: ${res.status} ${text}`);
  }
  return res.json();
}

function decodeBase64(b64) {
  return Buffer.from(b64, "base64").toString("utf-8");
}
function encodeBase64(txt) {
  return Buffer.from(txt, "utf-8").toString("base64");
}

function sameIdOrNis(entry, keySet) {
  const idStr  = entry?.id  !== undefined ? String(entry.id)  : "";
  const nisStr = entry?.nis !== undefined ? String(entry.nis) : "";
  // cocok jika id atau nis ada di keySet
  return keySet.has(idStr) || keySet.has(nisStr);
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }

    const token = process.env.MTQ_TOKEN;
    if (!token) {
      return { statusCode: 500, body: JSON.stringify({ error: "MTQ_TOKEN belum di-set" }) };
    }

    const { kelas, identifier } = JSON.parse(event.body || "{}");
    if (!kelas || !identifier) {
      return { statusCode: 400, body: JSON.stringify({ error: "kelas & identifier wajib" }) };
    }

    const identifierStr = String(identifier);
    const repoOwner = "digitalmtq";
    const repoName = "server";
    const apiBase = `https://api.github.com/repos/${repoOwner}/${repoName}/contents`;

    // =========================
    // 1) Hapus dari kelas_X.json
    // =========================
    const kelasFile = (kelas.toLowerCase().startsWith("kelas_") ? `${kelas}.json` : `kelas_${kelas}.json`);
    const kelasUrl = `${apiBase}/${encodeURIComponent(kelasFile)}`;

    const kelasFileResp = await ghGet(kelasUrl, token);
    const kelasSha = kelasFileResp.sha;
    const kelasContent = JSON.parse(decodeBase64(kelasFileResp.content));

    // Cari santri yang cocok (id atau nis)
    const idx = kelasContent.findIndex(
      s => String(s?.id ?? "") === identifierStr || String(s?.nis ?? "") === identifierStr
    );

    let idMatch = null;
    let nisMatch = null;

    let kelasBaru = kelasContent;
    let removedFromKelas = false;

    if (idx >= 0) {
      idMatch = kelasContent[idx]?.id ?? null;
      nisMatch = kelasContent[idx]?.nis ?? null;

      kelasBaru = kelasContent.filter(
        s => String(s?.id ?? "") !== identifierStr && String(s?.nis ?? "") !== identifierStr
      );
      removedFromKelas = kelasBaru.length !== kelasContent.length;

      // Tulis balik kelas_X.json
      await ghPut(kelasUrl, token, {
        message: `hapus: ${identifierStr} dari ${kelasFile}`,
        content: encodeBase64(JSON.stringify(kelasBaru, null, 2)),
        sha: kelasSha,
        committer: { name: "admin", email: "admin@local" },
      });
    }
    // kalau tidak ketemu di kelas, tetap lanjut bersihkan absensi dengan kunci identifier saja

    // =====================================
    // 2) Bersihkan seluruh file di /absensi
    // =====================================
    const absensiDirUrl = `${apiBase}/absensi`;
    let absensiList = [];
    try {
      // Directory listing
      absensiList = await ghGet(absensiDirUrl, token); // array of {name, path, sha, type, ...}
      if (!Array.isArray(absensiList)) absensiList = [];
    } catch (e) {
      // Jika folder absensi belum ada, tidak apa-apa
      if (!String(e.message || "").includes("404")) throw e;
      absensiList = [];
    }

    // Filter hanya file absensi kelas ini, contoh: kelas_1_2025-08-20.json
    const prefix = (kelas.toLowerCase().startsWith("kelas_") ? `${kelas}_` : `kelas_${kelas}_`);
    const targetFiles = absensiList.filter(
      item => item.type === "file" && item.name.startsWith(prefix) && item.name.endsWith(".json")
    );

    // Kumpulan key yang akan dihapus pada data absensi:
    const keysToRemove = new Set(
      [identifierStr, idMatch, nisMatch].filter(Boolean).map(String)
    );

    let filesTouched = 0;
    let totalEntriesRemoved = 0;
    let filesProcessed = 0;

    for (const f of targetFiles) {
      filesProcessed += 1;

      // Ambil file absensi
      const fileResp = await ghGet(`${apiBase}/${encodeURIComponent(f.path)}`, token);
      const sha = fileResp.sha;
      let data = [];
      try {
        data = JSON.parse(decodeBase64(fileResp.content));
      } catch (_) {
        // Jika bukan JSON array valid, skip saja
        continue;
      }
      if (!Array.isArray(data) || data.length === 0) continue;

      const beforeLen = data.length;
      const filtered = data.filter(entry => !sameIdOrNis(entry, keysToRemove));

      if (filtered.length !== beforeLen) {
        filesTouched += 1;
        totalEntriesRemoved += (beforeLen - filtered.length);

        await ghPut(`${apiBase}/${encodeURIComponent(f.path)}`, token, {
          message: `hapus absensi milik ${[...keysToRemove].join("/")} di ${f.name}`,
          content: encodeBase64(JSON.stringify(filtered, null, 2)),
          sha,
          committer: { name: "admin", email: "admin@local" },
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        kelas,
        identifier: identifierStr,
        removedFromKelas,
        filesProcessed,
        filesTouched,
        totalEntriesRemoved,
      }),
    };
  } catch (err) {
    console.error("hapusSantri error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err.message || err) }) };
  }
}
