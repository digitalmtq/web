const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    const token = process.env.MTQ_TOKEN;
    const { kelasAsal, kelasTujuan, santri } = JSON.parse(event.body);
    if (!kelasAsal || !kelasTujuan || !santri?.length)
      return { statusCode: 400, body: JSON.stringify({ error: "Parameter wajib" }) };

    const apiBase = "https://api.github.com/repos/digitalmtq/server/contents/";
    const fileAsal = `${kelasAsal}.json`;
    const fileTujuan = `${kelasTujuan}.json`;

    // Ambil kelas asal
    const resAsal = await fetch(`${apiBase}${fileAsal}`, { headers: { Authorization:`Bearer ${token}`, Accept:"application/vnd.github.v3+json" } });
    const dataAsal = await resAsal.json();
    let santriAsal = JSON.parse(Buffer.from(dataAsal.content,"base64").toString("utf-8"));
    const shaAsal = dataAsal.sha;

    // Ambil kelas tujuan
    let santriTujuan = [];
    let shaTujuan = null;
    const resTujuan = await fetch(`${apiBase}${fileTujuan}`, { headers:{ Authorization:`Bearer ${token}`, Accept:"application/vnd.github.v3+json" } });
    if(resTujuan.ok){
      const dataTujuan = await resTujuan.json();
      santriTujuan = JSON.parse(Buffer.from(dataTujuan.content,"base64").toString("utf-8"));
      shaTujuan = dataTujuan.sha;
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
};
