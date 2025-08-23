import fetch from "node-fetch";

export async function handler(event) {
  try {
    const token = process.env.MTQ_TOKEN;
    const { kelasAsal, kelasTujuan, santri } = JSON.parse(event.body);

    if (!kelasAsal || !kelasTujuan || !santri || !santri.length) {
      return { statusCode: 400, body: JSON.stringify({ error: "Parameter wajib diisi" }) };
    }

    const fileAsal = kelasAsal.toLowerCase().startsWith("kelas_") ? `${kelasAsal}.json` : `kelas_${kelasAsal}.json`;
    const fileTujuan = kelasTujuan.toLowerCase().startsWith("kelas_") ? `${kelasTujuan}.json` : `kelas_${kelasTujuan}.json`;

    const apiBase = "https://api.github.com/repos/digitalmtq/server/contents/";

    // Ambil data kelas asal
    const resAsal = await fetch(`${apiBase}${fileAsal}`, { headers: { Authorization: `Bearer ${token}`, Accept:"application/vnd.github.v3+json" } });
    const dataAsal = await resAsal.json();
    const shaAsal = dataAsal.sha;
    let santriAsal = JSON.parse(Buffer.from(dataAsal.content,"base64").toString("utf-8"));

    // Ambil data kelas tujuan
    const resTujuan = await fetch(`${apiBase}${fileTujuan}`, { headers: { Authorization: `Bearer ${token}`, Accept:"application/vnd.github.v3+json" } });
    let dataTujuan = {};
    let shaTujuan = null;
    let santriTujuan = [];
    if(resTujuan.ok){
      dataTujuan = await resTujuan.json();
      shaTujuan = dataTujuan.sha;
      santriTujuan = JSON.parse(Buffer.from(dataTujuan.content,"base64").toString("utf-8"));
    }

    // Pindahkan santri
    const toMove = santriAsal.filter(s => santri.includes(s.id.toString()) || santri.includes(s.nis));
    santriAsal = santriAsal.filter(s => !santri.includes(s.id.toString()) && !santri.includes(s.nis));
    santriTujuan.push(...toMove);

    // Update kelas asal
    await fetch(`${apiBase}${fileAsal}`, {
      method: "PUT",
      headers:{ Authorization:`Bearer ${token}`, Accept:"application/vnd.github.v3+json" },
      body: JSON.stringify({
        message:`Hapus santri pindah kelas`,
        content: Buffer.from(JSON.stringify(santriAsal,null,2)).toString("base64"),
        sha: shaAsal,
        committer:{ name:"admin", email:"admin@local" }
      })
    });

    // Update kelas tujuan
    await fetch(`${apiBase}${fileTujuan}`, {
      method:"PUT",
      headers:{ Authorization:`Bearer ${token}`, Accept:"application/vnd.github.v3+json" },
      body: JSON.stringify({
        message:`Tambah santri pindah kelas`,
        content: Buffer.from(JSON.stringify(santriTujuan,null,2)).toString("base64"),
        sha: shaTujuan,
        committer:{ name:"admin", email:"admin@local" }
      })
    });

    return { statusCode: 200, body: JSON.stringify({ success:true }) };

  } catch(err){
    console.error(err);
    return { statusCode:500, body: JSON.stringify({ error: err.message }) };
  }
}
