// netlify/functions/aksesAutoUpdateAllJuzMur.js  (COMMONJS, Node 18+)

const GITHUB_REPO = "digitalmtq/server";
const FILE_PATH   = "autoUpdateAllJuzMur.json";
const BRANCH      = "main";
const TOKEN       = process.env.MTQ_TOKEN;

const ghHeaders = () => ({
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github.v3+json",
  "Content-Type": "application/json",
  "User-Agent": "mtq-app/1.0",
  "X-GitHub-Api-Version": "2022-11-28", // opsional, bagus untuk future-proof
});

const fileUrl = () =>
  `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(FILE_PATH)}?ref=${encodeURIComponent(BRANCH)}`;

const putUrl = () =>
  `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(FILE_PATH)}`;

function b64(str) {
  return Buffer.from(String(str ?? ""), "utf8").toString("base64");
}

async function getCurrentFile() {
  const res = await fetch(fileUrl(), { headers: ghHeaders() });
  if (res.status === 404) {
    // file belum ada
    return { sha: null, contentStr: "[]", exists: false };
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`GET GitHub failed ${res.status}: ${t}`);
  }
  const json = await res.json();
  const contentStr = Buffer.from(json.content || "", "base64").toString("utf8");
  return { sha: json.sha, contentStr, exists: true };
}

function parseArraySafe(contentStr) {
  try {
    const parsed = JSON.parse(contentStr || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function upsertRecord(arr, record, kelasKey) {
  const idx = arr.findIndex((x) => x && x.kelas === kelasKey);
  if (idx >= 0) {
    arr[idx] = { ...arr[idx], ...record };
  } else {
    arr.push(record);
  }
  return arr;
}

async function putWithRetry(arr, sha, message, record, kelasKey) {
  // try once
  const body1 = {
    message,
    content: b64(JSON.stringify(arr, null, 2)),
    branch: BRANCH,
    ...(sha ? { sha } : {})
  };

  let putRes = await fetch(putUrl(), {
    method: "PUT",
    headers: ghHeaders(),
    body: JSON.stringify(body1)
  });

  if (putRes.ok) return putRes;

  // jika konflik SHA → ambil versi terbaru, re-merge, coba sekali lagi
  if (putRes.status === 409) {
    const latest = await getCurrentFile();
    let latestArr = parseArraySafe(latest.contentStr);
    latestArr = upsertRecord(latestArr, record, kelasKey);

    const body2 = {
      message: message + " (retry)",
      content: b64(JSON.stringify(latestArr, null, 2)),
      branch: BRANCH,
      ...(latest.sha ? { sha: latest.sha } : {})
    };

    putRes = await fetch(putUrl(), {
      method: "PUT",
      headers: ghHeaders(),
      body: JSON.stringify(body2)
    });
  }

  return putRes;
}

exports.handler = async (event) => {
  try {
    if (!TOKEN) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "MTQ_TOKEN belum diset di environment." })
      };
    }

    // === GET: kembalikan isi file apa adanya ===
    if (event.httpMethod === "GET") {
      try {
        const { contentStr } = await getCurrentFile();
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          body: contentStr || "[]"
        };
      } catch (e) {
        return {
          statusCode: 500,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ error: String(e.message || e) })
        };
      }
    }

    // === POST: upsert berdasarkan kelas ===
    if (event.httpMethod === "POST") {
      let payload = {};
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return {
          statusCode: 400,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ error: "Body bukan JSON valid." })
        };
      }

      const kelasRaw = (payload?.kelas ?? "").toString().trim();
      if (!kelasRaw) {
        return {
          statusCode: 400,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ error: "Parameter 'kelas' wajib ada." })
        };
      }

      const fromDate = (payload?.fromDate ?? "").toString().trim();
      const toDate   = (payload?.toDate ?? "").toString().trim();
      const count    = Array.isArray(payload?.data) ? payload.data.length :
                       Number.isFinite(payload?.count) ? Number(payload.count) : 0;

      const { sha, contentStr } = await getCurrentFile();
      let arr = parseArraySafe(contentStr);

      const nowIso = new Date().toISOString();
      const record = {
        kelas: kelasRaw,
        fromDate,
        toDate,
        updatedAt: nowIso,
        count
      };

      arr = upsertRecord(arr, record, kelasRaw);

      const message = `autoUpdateAllJuzMur: upsert kelas=${kelasRaw} (${fromDate || ""}..${toDate || ""}) count=${count}`;
      const putRes = await putWithRetry(arr, sha, message, record, kelasRaw);

      if (!putRes.ok) {
        const t = await putRes.text().catch(() => "");
        return {
          statusCode: putRes.status,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ error: `PUT GitHub failed ${putRes.status}: ${t}` })
        };
      }

      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: true, saved: record })
      };
    }

    return { statusCode: 405, headers: { "allow": "GET, POST" }, body: "Method Not Allowed" };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: String(e.message || e) })
    };
  }
};
