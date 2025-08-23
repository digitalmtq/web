import { Octokit } from "@octokit/rest";

export async function handler(event) {
  try {
    const { kelas, identifier } = JSON.parse(event.body);
    if (!kelas || !identifier) {
      return { statusCode: 400, body: "Parameter kelas dan identifier dibutuhkan" };
    }

    const octokit = new Octokit({ auth: process.env.MTQ_TOKEN });
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
      file = await octokit.repos.getContent({ owner, repo, path });
    }

    const content = Buffer.from(file.data.content, "base64").toString();
    const data = JSON.parse(content);

    // Hapus santri yang cocok dengan id atau nis
    const filtered = data.filter(s => s.id != identifier && s.nis != identifier);

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `Hapus santri ${identifier}`,
      content: Buffer.from(JSON.stringify(filtered, null, 2)).toString("base64"),
      sha: file.data.sha,
      committer: { name: "server", email: "server@local" },
      author: { name: "server", email: "server@local" },
    });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
