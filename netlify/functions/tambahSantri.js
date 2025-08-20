import fetch from "node-fetch";
import { Buffer } from "buffer";

export async function handler(event) {
  const token = process.env.MTQ_TOKEN;
  const { nama, semester, kelas, nis } = JSON.parse(event.body || "{}");

  if (!nama || !semester || !kelas || !nis) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Parameter nama, semester, kelas, dan nis wajib diisi." }),
    };
  }

  const fileName = `kelas_${kelas.split("_")[1]}.json`;
  const githubApiUrl = `https://api.github.com/repos/digitalmtq/server/contents/${fileName}`;

  try {
    // 🔹 1. Ambil file lama (dari GitHub API)
    const getRes = await fetch(githubApiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "NetlifyFunction",
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!getRes.ok) {
      throw new Error(`Gagal mengambil data GitHub: ${getRes.statusText}`);
    }

    const fileData = await getRes.json();
    const contentDecoded = Buffer.from(fileData.content, "base64").toString("utf-8");
    const santriList = JSON.parse(contentDecoded);

    // 🔹 2. Buat ID baru (berurutan, bukan ambil max biar tidak meloncat)
    const nextId = santriList.length > 0 
      ? santriList[santriList.length - 1].id + 1 
      : 1;

    // 🔹 3. Tambahkan santri baru
    santriList.push({ id: nextId, nis, nama, semester });

    // 🔹 4. Encode konten baru ke Base64
    const updatedContent = Buffer.from(JSON.stringify(santriList, null, 2)).toString("base64");

    // 🔹 5. Kirim PUT ke GitHub API
    const putRes = await fetch(githubApiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "NetlifyFunction",
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify({
        message: `Menambahkan santri ${nama} (NIS ${nis}) ke ${fileName}`,
        content: updatedContent,
        sha: fileData.sha,
      }),
    });

    if (!putRes.ok) {
      const errorText = await putRes.text();
      throw new Error(`Gagal menyimpan ke GitHub: ${putRes.status} ${errorText}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Santri berhasil ditambahkan" }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
