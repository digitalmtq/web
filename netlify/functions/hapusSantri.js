const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    const { kelas, id, nis } = JSON.parse(event.body);

    if (!kelas) {
      return { statusCode: 400, body: "Kelas wajib diisi" };
    }
    if (!id && !nis) {
      return { statusCode: 400, body: "ID atau NIS wajib diisi" };
    }

    const GITHUB_TOKEN = process.env.MTQ_TOKEN;
    const owner = "dickymiswardi";
    const repo = "usermtq";
    const path = `absensi/kelas_${kelas}.json`;

    // ambil isi file dulu
    const resFile = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: { Authorization: `token ${GITHUB_TOKEN}` },
      }
    );

    if (resFile.status === 404) {
      return { statusCode: 404, body: `File kelas_${kelas}.json belum ada` };
    }

    const fileData = await resFile.json();
    const sha = fileData.sha;
    let santri = JSON.parse(
      Buffer.from(fileData.content, "base64").toString("utf-8")
    );

    // filter data
    const before = santri.length;
    santri = santri.filter(
      (s) =>
        String(s.id) !== String(id) &&
        String(s.nis || "") !== String(nis || "")
    );

    if (before === santri.length) {
      return { statusCode: 404, body: "Santri tidak ditemukan" };
    }

    // simpan perubahan
    const updateRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Hapus santri id:${id} nis:${nis} dari kelas_${kelas}`,
          content: Buffer.from(JSON.stringify(santri, null, 2)).toString("base64"),
          sha,
        }),
      }
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      return { statusCode: updateRes.status, body: errText };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Santri berhasil dihapus" }),
    };
  } catch (err) {
    console.error("Error hapusSantri:", err);
    return { statusCode: 500, body: "Internal server error" };
  }
};
