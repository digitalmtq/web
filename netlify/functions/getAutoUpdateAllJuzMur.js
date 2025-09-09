// netlify/functions/getAutoUpdateAllJuzMur.js  (COMMONJS, Node 18+)

const GITHUB_REPO = "digitalmtq/server";
const FILE_PATH   = "autoUpdateAllJuzMur.json";
const BRANCH      = "main";
const TOKEN       = process.env.MTQ_TOKEN;

const ghHeaders = () => ({
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "mtq-app/1.0",
  "X-GitHub-Api-Version": "2022-11-28", // opsional
});

// ✅ JANGAN encode owner/repo sebagai satu segmen.
// encode hanya path FILE_PATH & query ref.
const fileUrl = () =>
  `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(FILE_PATH)}?ref=${encodeURIComponent(BRANCH)}`;

exports.handler = async () => {
  try {
    if (!TOKEN) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "MTQ_TOKEN belum diset di environment." }),
      };
    }

    const res = await fetch(fileUrl(), { headers: ghHeaders() });

    if (res.status === 404) {
      // file belum ada → kembalikan array kosong
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: "[]",
      };
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        statusCode: res.status,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          error: `Gagal ambil file dari GitHub (${res.status}).`,
          detail
        }),
      };
    }

    const json = await res.json();
    let content = "[]";
    try {
      content = Buffer.from(json?.content || "", "base64").toString("utf8") || "[]";
      JSON.parse(content); // validasi agar pasti JSON valid
    } catch {
      content = "[]";
    }

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: content,
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: String(e?.message || e) }),
    };
  }
};
