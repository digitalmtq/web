import fetch from "node-fetch";
import { Buffer } from "buffer";

export async function handler(event) {
  const token = process.env.MTQ_TOKEN;

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed. Gunakan POST." }),
    };
  }

  const { id, kelas } = JSON.parse(event.body || "{}");

  if (!id || !kelas) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Parameter id dan kelas wajib diisi." }),
    };
  }

  // Pastikan format nama file benar (kelas_1.json, kelas_2.json, dst)
  const fileName = `kelas_${kelas}.json`;
  const githubApiUrl = `https://api.github.com/repos/dickymiswardi/private/contents/${fileName}`;

  try {
    // 1. Ambil file lama dari GitHub
    const getRes = await fetch(githubApiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "NetlifyFunction",
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!getRes.ok) throw new Error(`Gagal ambil data GitHub: ${getRes.statusText}`);

    const fileData = await getRes.json();
    const contentDecoded = Buffer.from(fileData.content, "base64").toString("utf-8");
    let santriList = JSON.parse(contentDecoded);

    // 2. Hapus santri sesuai ID (handle tipe data number/string)
    const awalLength = santriList.length;
    santriList = santriList.filter(
      (s) => String(s.id) !== String(id) && String(s.nis || "") !== String(id)
    );

    if (santriList.length === awalLength) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Santri dengan ID ${id} tidak ditemukan.` }),
      };
    }

    // 3. Encode & update ke GitHub
    const updatedContent = Buffer.from(
      JSON.stringify(santriList, null, 2)
    ).toString("base64");

    const putRes = await fetch(githubApiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "NetlifyFunction",
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify({
        message: `Menghapus santri ID ${id} dari ${fileName}`,
        content: updatedContent,
        sha: fileData.sha,
      }),
    });

    if (!putRes.ok) {
      const errorText = await putRes.text();
      throw new Error(`Gagal simpan ke GitHub: ${putRes.status} ${errorText}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: `Santri ID ${id} berhasil dihapus` }),
    };
  } catch (err) {
    console.error("Error hapusSantri:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
