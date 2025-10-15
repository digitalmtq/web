export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end   = url.searchParams.get("end");
  const limit = Number(url.searchParams.get("limit") ?? 5000);
  const dateCol = url.searchParams.get("date_col") ?? "tanggal"; // ganti sesuai skema

  const isoDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const csv = (text, status=200) => new Response(text, {
    status, headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    }
  });

  if ((start && !isoDate(start)) || (end && !isoDate(end))) {
    return csv("error,message\ninvalid_date,Use YYYY-MM-DD");
  }

  try {
    const where = [];
    const params = {};
    if (start) { where.push(`${dateCol} >= :start`); params.start = start; }
    if (end)   { where.push(`${dateCol} <= :end`);   params.end   = end;   }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // GANTI nama tabel kalau perlu:
    const sql = `SELECT * FROM absensi ${whereSql} ORDER BY ${dateCol} ASC LIMIT :limit;`;
    const { results } = await env.ABSENSI_DB.prepare(sql).bind({ ...params, limit }).all();

    if (!results?.length) return csv("info,detail\nno_data,range tidak ada data");

    const headers = Object.keys(results[0]);
    const esc = v => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [ headers.join(","), ...results.map(r => headers.map(h => esc(r[h])).join(",")) ];
    return csv(lines.join("\n"));
  } catch (e) {
    // bikin IMPORTDATA tidak #N/A: kirim CSV berisi error
    return csv(`error,message\n${(e && e.name) || "Error"},${JSON.stringify(e && e.message || e)}`);
  }
}
