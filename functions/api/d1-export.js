export async function onRequestGet(ctx) {
  const { request, env } = ctx;

  const url = new URL(request.url);
  const start = url.searchParams.get("start"); // YYYY-MM-DD
  const end   = url.searchParams.get("end");   // YYYY-MM-DD
  const limit = Number(url.searchParams.get("limit") ?? 5000);
  const dateCol = url.searchParams.get("date_col") ?? "tanggal"; // ganti sesuai skema

  const isoDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v);
  if ((start && !isoDate(start)) || (end && !isoDate(end))) {
    return new Response("Invalid date. Use YYYY-MM-DD", { status: 400 });
  }

  const where = [];
  const params = {};
  if (start) { where.push(`${dateCol} >= :start`); params.start = start; }
  if (end)   { where.push(`${dateCol} <= :end`);   params.end   = end;   }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // NOTE: pakai binding yang kamu daftarkan di wrangler.toml (contoh: ABSENSI_DB)
  const sql = `SELECT * FROM absensi ${whereSql} ORDER BY ${dateCol} ASC LIMIT :limit;`;
  const stmt = env.ABSENSI_DB.prepare(sql).bind({ ...params, limit });
  const { results } = await stmt.all();

  if (!results?.length) {
    return new Response("", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  const headers = Object.keys(results[0]);
  const esc = v => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [ headers.join(","), ...results.map(r => headers.map(h => esc(r[h])).join(",")) ];
  const csv = lines.join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
