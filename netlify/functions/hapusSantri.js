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

  const fileName = `kelas_${kelas}.json`;
  const githubApiUrl = `https://api.github.com/repos/digitalmtq/server/contents/${fileName}`;

  try {
    // Ambil file lama dari GitHub
    let fileData;
    let santriList = [];
    const getRes = await fetch(githubApiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "NetlifyFunction",
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (getRes.status === 404) {
      console.log(`${fileName} belum ada, buat baru.`);
    } else if (!getRes.ok) {
      throw new Error(`Gagal ambil data GitHub: ${getRes.statusText}`);
    } else {
      fileData = await getRes.json();
      try {
        const contentDecoded = Buffer.from(fileData.content, "base64").toString("utf-8");
        santriList = JSON.parse(contentDecoded);
      } catch (e) {
        console.warn("JSON corrupt, pakai array kosong");
        santriList = [];
      }
    }

    // Kirim semua santri sebelum hapus ke response untuk info
    const allSantriInfo = santriList.map((s) => ({
      id: s.id,
      nis: s.nis || "",
      nama: s.nama,
    }));

    // Hapus santri sesuai ID atau NIS
    const awalLength = santriList.length;
    santriList = santriList.filter(
      (s) => String(s.id) !== String(id) && String(s.nis || "") !== String(id)
    );

    if (santriList.length === awalLength) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: `Santri dengan ID/NIS ${id} tidak ditemukan.`,
          allSantri: allSantriInfo,
        }),
      };
    }

    // Encode & update ke GitHub
    const updatedContent = Buffer.from(JSON.stringify(santriList, null, 2)).toString("base64");

    const putBody = {
      message: `Menghapus santri ID/NIS ${id} dari ${fileName}`,
      content: updatedContent,
    };
    if (fileData && fileData.sha) putBody.sha = fileData.sha;

    const putRes = await fetch(githubApiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "NetlifyFunction",
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify(putBody),
    });

    if (!putRes.ok) {
      const errorText = await putRes.text();
      throw new Error(`Gagal simpan ke GitHub: ${putRes.status} ${errorText}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Santri ID/NIS ${id} berhasil dihapus`,
        allSantriBeforeDelete: allSantriInfo,
      }),
    };
  } catch (err) {
    console.error("Error hapusSantri:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
