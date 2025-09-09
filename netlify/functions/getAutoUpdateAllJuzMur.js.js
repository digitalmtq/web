// netlify/functions/getAutoUpdateAllJuzMur.js  (COMMONJS, Node 18, tanpa node-fetch)

const GITHUB_REPO = "digitalmtq/server";
const FILE_PATH   = "autoUpdateAllJuzMur.json"; // ← file khusus MURAJAAH
const BRANCH      = "main";
const TOKEN       = process.env.MTQ_TOKEN;

const ghHeaders = () => ({
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github.v3+json",
});

const fileUrl = () =>
  `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(FILE_PATH)}?ref=${encodeURIComponent(BRANCH)}`;

exports.handler = async (event = {}) => {
  try {
    if (!TOKEN) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "MTQ_TOKEN belum diset di environment." }),
      };
    }

    // dukung ?kelas=... via queryStringParameters (Netlify) atau fallback rawUrl
    const kelasFromQS = event.queryStringParameters?.kelas;
    let kelas = kelasFromQS;
    if (!kelas && event.rawUrl) {
      try {
        const u = new URL(event.rawUrl);
        kelas = u.searchParams.get("kelas") || undefined;
      } catch {}
    }

    const res = await fetch(fileUrl(), { headers: ghHeaders() });

    if (res.status === 404) {
      // file belum ada
      const body = kelas ? "null" : "[]";
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body,
      };
    }

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return {
        statusCode: res.status,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          error: `Gagal ambil file dari GitHub (${res.status}).`,
          detail: t
        }),
      };
    }

    const json = await res.json();
    const content = Buffer.from(json.content || "", "base64").toString("utf8") || "[]";

    // Jika user meminta ?kelas=..., kembalikan 1 entri (atau null bila tidak ada)
    if (kelas) {
      let arr = [];
      try {
        const parsed = JSON.parse(content);
        arr = Array.isArray(parsed) ? parsed : [];
      } catch { arr = []; }

      const found = arr.find(x => x && x.kelas === kelas) || null;
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(found),
      };
    }

    // Default: kembalikan seluruh isi array
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: content,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: String(err?.message || err) }),
    };
  }
};
