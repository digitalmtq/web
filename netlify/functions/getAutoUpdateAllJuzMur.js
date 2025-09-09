// netlify/functions/getAutoUpdateAllJuzMur.js  (COMMONJS, Node 18+)
const GITHUB_REPO = "digitalmtq/server";
const FILE_PATH   = "autoUpdateAllJuzMur.json";
const BRANCH      = "main";
const TOKEN       = process.env.MTQ_TOKEN;

const ghHeaders = () => ({
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "mtq-app/1.0"
});

const fileUrl = () =>
  `https://api.github.com/repos/${encodeURIComponent(GITHUB_REPO)}/contents/${encodeURIComponent(FILE_PATH)}?ref=${encodeURIComponent(BRANCH)}`;

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
    const b64 = json?.content || "";
    let content = "";
    try {
      content = Buffer.from(b64, "base64").toString("utf8") || "[]";
      // Validasi agar selalu JSON valid
      JSON.parse(content);
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
