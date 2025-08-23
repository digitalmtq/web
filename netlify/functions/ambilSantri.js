import { Octokit } from "@octokit/rest";

export async function handler(event) {
  try {
    const kelas = event.queryStringParameters?.kelas;
    if (!kelas) return { statusCode: 400, body: "Parameter kelas dibutuhkan" };

    const token = process.env.MTQ_TOKEN;
    if (!token) return { statusCode: 500, body: JSON.stringify({ error: "Token GitHub tidak tersedia" }) };

    const octokit = new Octokit({ auth: token });
    const owner = "digitalmtq";
    const repo = "server";
    const path = `kelas_${kelas}.json`;

    let file;
    try {
      file = await octokit.repos.getContent({ owner, repo, path });
    } catch (err) {
      // File belum ada → buat kosong
      const emptyData = [];
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: `Auto-create ${path}`,
        content: Buffer.from(JSON.stringify(emptyData, null, 2)).toString("base64"),
        committer: { name: "server", email: "server@local" },
        author: { name: "server", email: "server@local" },
      });
      return { statusCode: 200, body: JSON.stringify([]) };
    }

    const content = Buffer.from(file.data.content, "base64").toString();
    let santriData = [];
    try {
      santriData = JSON.parse(content);
    } catch (err) {
      // Jika JSON corrupt → return array kosong
      santriData = [];
    }

    if (!Array.isArray(santriData)) santriData = [];

    return { statusCode: 200, body: JSON.stringify(santriData) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
