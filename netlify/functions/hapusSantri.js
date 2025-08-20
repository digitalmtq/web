import fetch from "node-fetch";

export async function handler(event) {
  console.log("=== HAPUS SANTRI DEBUG START ===");

  try {
    // Cek token env
    const token = process.env.MTQ_TOKEN;
    if (!token) {
      console.error("ERROR: MTQ_TOKEN tidak ditemukan di environment!");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Server token tidak tersedia" }),
      };
    }
    console.log("Token OK (panjang):", token.length);

    // Validasi method
    if (event.httpMethod !== "POST") {
      console.error("Method salah:", event.httpMethod);
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method harus POST" }),
      };
    }

    // Parse body
    let bodyData;
    try {
      bodyData = JSON.parse(event.body);
    } catch (err) {
      console.error("Gagal parse body:", event.body, err);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Body tidak valid JSON" }),
      };
    }

    console.log("Body diterima:", bodyData);

    const { kelas, id } = bodyData;
    if (!kelas || !id) {
      console.error("Kelas atau ID kosong:", bodyData);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Parameter kelas dan id wajib" }),
      };
    }

    const filePath = `absensi/kelas_${kelas}.json`;
    console.log("Target file:", filePath);

    // Ambil file lama
    const getUrl = `https://api.github.com/repos/digitalmtq/server/contents/${filePath}`;
    console.log("GET URL:", getUrl);

    const getRes = await fetch(getUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!getRes.ok) {
      const txt = await getRes.text();
      console.error("Gagal ambil data GitHub:", getRes.status, txt);
      return {
        statusCode: getRes.status,
        body: JSON.stringify({ error: "Gagal ambil data GitHub", detail: txt }),
      };
    }

    const fileData = await getRes.json();
    console.log("Data file berhasil diambil, ukuran base64:", fileData.content.length);

    // Decode isi file
    const content = Buffer.from(fileData.content, "base64").toString("utf-8");
    let santriList;
    try {
      santriList = JSON.parse(content);
    } catch (err) {
      console.error("Gagal parse JSON file:", err, content.slice(0, 200));
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "File JSON rusak" }),
      };
    }

    console.log("Jumlah santri sebelum hapus:", santriList.length);

    // Hapus santri berdasarkan id
    const newList = santriList.filter((s) => String(s.id) !== String(id));
    console.log("Jumlah santri setelah hapus:", newList.length);

    if (newList.length === santriList.length) {
      console.warn("Tidak ada santri dengan ID:", id);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Santri tidak ditemukan" }),
      };
    }

    // Simpan kembali ke GitHub
    const updateRes = await fetch(getUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify({
        message: `Hapus santri id ${id} dari kelas ${kelas}`,
        content: Buffer.from(JSON.stringify(newList, null, 2)).toString("base64"),
        sha: fileData.sha,
      }),
    });

    if (!updateRes.ok) {
      const txt = await updateRes.text();
      console.error("Gagal update GitHub:", updateRes.status, txt);
      return {
        statusCode: updateRes.status,
        body: JSON.stringify({ error: "Gagal update GitHub", detail: txt }),
      };
    }

    console.log("Update GitHub berhasil.");
    console.log("=== HAPUS SANTRI DEBUG END ===");

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, id }),
    };
  } catch (err) {
    console.error("EXCEPTION:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error", detail: err.message }),
    };
  }
}
