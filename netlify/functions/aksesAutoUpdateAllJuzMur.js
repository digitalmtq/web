// netlify/functions/aksesAutoUpdateAllJuzMur.js  (COMMONJS, Node 18+)

const GITHUB_REPO = "digitalmtq/server";
const FILE_PATH   = "autoUpdateAllJuzMur.json"; // ← khusus MUR
const BRANCH      = "main";

const TOKEN = process.env.MTQ_TOKEN;

const ghHeaders = () => ({
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github.v3+json",
  "Content-Type": "application/json",
});

const fileUrl = (path = FILE_PATH) =>
  `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(BRANCH)}`;

const putUrl = (path = FILE_PATH) =>
  `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(path)}`;

async function getCurrentFile() {
  const res = await fetch(fileUrl(), { headers: ghHeaders() });
  if (res.status === 404) {
    // file belum ada → anggap array kosong
    return { sha: null, contentStr: "[]" };
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`GET GitHub failed ${res.status}: ${t}`);
  }
  const json = await res.json();
  const contentStr = Buffer.from(json.content || "", "base64").toString("utf8");
  const sha = json.sha;
  return { sha, contentStr };
}

function base64Encode(str) {
  return Buffer.from(str, "utf8").toString("base64");
}

exports.handler = async (event) => {
  try {
    if (!TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "MTQ_TOKEN belum diset di environment." }),
      };
    }

    // === GET: kembalikan isi autoUpdateAllJuzMur.json
    // Optional query ?kelas=... untuk hanya 1 entri
    if (event.httpMethod === "GET") {
      try {
        const { contentStr } = await getCurrentFile();

        // filter opsional per kelas
        const url = new URL(event.rawUrl || `http://x${event.path}${event.rawQuery ? "?" + event.rawQuery : ""}`);
        const kelas = url.searchParams.get("kelas");

        if (!kelas) {
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: contentStr,
          };
        }

        let arr = [];
        try {
          const parsed = JSON.parse(contentStr);
          arr = Array.isArray(parsed) ? parsed : [];
        } catch { arr = []; }

        const found = arr.find(x => x && x.kelas === kelas);
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(found || null),
        };
      } catch (e) {
        return {
          statusCode: 500,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ error: String(e.message || e) }),
        };
      }
    }

    // === POST: upsert entry berdasarkan kelas
    if (event.httpMethod === "POST") {
      let payload = {};
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return { statusCode: 400, body: JSON.stringify({ error: "Body bukan JSON valid." }) };
      }

      const { fromDate, toDate, kelas, data } = payload || {};
      if (!kelas) {
        return { statusCode: 400, body: JSON.stringify({ error: "Parameter 'kelas' wajib ada." }) };
      }

      // ambil file saat ini (atau default [])
      const { sha, contentStr } = await getCurrentFile();

      let arr;
      try {
        const parsed = JSON.parse(contentStr);
        arr = Array.isArray(parsed) ? parsed : [];
      } catch {
        // jika file korup/format lain → reset jadi array
        arr = [];
      }

      // upsert: cari berdasarkan kelas
      const nowIso = new Date().toISOString();
      const idx = arr.findIndex((x) => x && x.kelas === kelas);

      const record = {
        kelas,
        fromDate: fromDate || "",
        toDate: toDate || "",
        // metadata opsional
        updatedAt: nowIso,
        count: Array.isArray(data) ? data.length : 0,
      };

      if (idx >= 0) arr[idx] = { ...arr[idx], ...record };
      else arr.push(record);

      const newContent = JSON.stringify(arr, null, 2);

      // commit ke GitHub
      const putBody = {
        message: `autoUpdateAllJuzMur: upsert kelas=${kelas} (${fromDate || ""}..${toDate || ""})`,
        content: base64Encode(newContent),
        branch: BRANCH,
      };
      if (sha) putBody.sha = sha;

      const putRes = await fetch(putUrl(), {
        method: "PUT",
        headers: ghHeaders(),
        body: JSON.stringify(putBody),
      });

      if (!putRes.ok) {
        const t = await putRes.text().catch(() => "");
        return {
          statusCode: putRes.status,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ error: `PUT GitHub failed ${putRes.status}: ${t}` }),
        };
      }

      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: true, saved: record }),
      };
    }

    // (opsional) preflight
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 204,
        headers: {
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: "",
      };
    }

    return { statusCode: 405, body: "Method Not Allowed" };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: String(err.message || err) }),
    };
  }
};
