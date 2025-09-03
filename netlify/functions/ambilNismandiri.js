// netlify/functions/ambilNismandiri.js
import { Buffer } from "node:buffer";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function handler(event) {
  // Preflight CORS
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  const token = process.env.MTQ_TOKEN;
  const githubApiUrl =
    "https://api.github.com/repos/digitalmtq/server/contents/user.json";

  // Ambil username dari query param (?username=tohi)
  const params = new URLSearchParams(event?.rawQuery || event?.queryStringParameters);
  const username =
    (typeof params.get === "function" ? params.get("username") : event?.queryStringParameters?.username) || "";

  if (!username) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Parameter 'username' wajib diisi" }),
    };
  }

  try {
    const response = await fetch(githubApiUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      throw new Error(`Gagal fetch data: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const content = Buffer.from(result.content || "", "base64").toString("utf-8");

    // user.json berupa array berisi objek {username, password, kelas:[], nis:[]}
    const users = JSON.parse(content || "[]");

    // Cari user by username (case-insensitive)
    const unameKey = String(username).trim().toLowerCase();
    const me = Array.isArray(users)
      ? users.find(
          (u) => String(u?.username || "").trim().toLowerCase() === unameKey
        )
      : null;

    if (!me) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: `User '${username}' tidak ditemukan` }),
      };
    }

    // Normalisasi ke array string
    const nisList = Array.isArray(me.nis)
      ? me.nis.map((n) => String(n ?? "").trim()).filter(Boolean)
      : me.nis
      ? [String(me.nis).trim()]
      : [];

    const kelasList = Array.isArray(me.kelas)
      ? me.kelas.map((k) => String(k ?? "").trim()).filter(Boolean)
      : me.kelas
      ? [String(me.kelas).trim()]
      : [];

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify({
        ok: true,
        username: me.username || username,
        nisList,
        kelasList,
        count: nisList.length,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
