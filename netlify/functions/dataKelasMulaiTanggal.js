// netlify/functions/pindahKelasMulaiTanggal.js
// ... (biarkan bagian atas sama seperti versi kamu sekarang)

const mapIdIfNeeded = (row, idMap) => {
  if (!Array.isArray(idMap) || idMap.length === 0) return row;
  const oldId = (row.id ?? "").toString();
  const found = idMap.find(m => String(m.oldId) === oldId);
  if (found && found.newId) {
    return { ...row, id: String(found.newId) };
  }
  return row;
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST")
      return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };

    const token = process.env.MTQ_TOKEN;
    if (!token) return { statusCode: 500, body: JSON.stringify({ error: "MTQ_TOKEN tidak tersedia" }) };

    let { kelasAsal, kelasTujuan, santriIds, startDate, idMap } = JSON.parse(event.body || "{}");

    // ... (validasi & listing file sama persis seperti punyamu)

    // Saat akan append ke tujuan:
    //   const appendable = toMove.filter(... dupe check ...)  <-- sebelum tulis:
    // Remap id jika ada di idMap:
    const appendableRemapped = appendable.map(r => mapIdIfNeeded(r, idMap));

    // lalu tulis appendableRemapped (bukan appendable)
    // ... sisanya sama
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Unhandled error", detail: e.message }) };
  }
};
