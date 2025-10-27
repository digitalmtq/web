// functions/api/getSantri.js
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url   = new URL(request.url);
  const kelas = url.searchParams.get("kelas");

  if (!kelas) {
    return new Response(JSON.stringify({ error: "Parameter 'kelas' wajib diisi" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  // >>> FIX PATH: selalu ambil dari /server/kelas_<kelas>.json
  const path  = `server/kelas_${encodeURIComponent(kelas)}.json`;
  const apiUrl = `https://api.github.com/repos/digitalmtq/server/contents/${path}`;

  try {
    const gh = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "cf-pages-functions",
      },
      // >>> Matikan cache edge agar selalu terbaru
      cf: { cacheTtl: 0, cacheEverything: false },
    });

    // Jika file roster belum ada → jangan error; kembalikan array kosong
    if (gh.status === 404) {
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    if (!gh.ok) {
      return new Response(JSON.stringify({ error: `Gagal fetch data: ${gh.status}` }), {
        status: gh.status,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const result  = await gh.json();                // { content: "base64", ... }
    const decoded = atob(result.content || "");     // base64 -> string JSON
    let parsed = [];
    try { parsed = JSON.parse(decoded); } catch {}
    if (!Array.isArray(parsed)) parsed = [];

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
}
