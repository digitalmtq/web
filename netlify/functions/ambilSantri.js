import { Octokit } from "@octokit/rest";

export async function handler(event) {
  try {
    const kelas = event.queryStringParameters?.kelas;
    if (!kelas) return { statusCode: 400, body: "Parameter kelas dibutuhkan" };

    const octokit = new Octokit({ auth: process.env.MTQ_TOKEN });
    const owner = "digitalmtq";
    const repo = "server";
    const path = `kelas_${kelas}.json`;

    let file;
    try {
      file = await octokit.repos.getContent({ owner, repo, path });
    } catch (err) {
      // File tidak ada → return array kosong
      return { statusCode: 200, body: JSON.stringify([]) };
    }

    const content = Buffer.from(file.data.content, "base64").toString();
    const santriData = JSON.parse(content);
    return { statusCode: 200, body: JSON.stringify(santriData) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
