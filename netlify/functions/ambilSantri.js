import { Octokit } from "@octokit/rest";

export async function handler(event) {
  const kelas = event.queryStringParameters?.kelas;
  if (!kelas) return { statusCode: 400, body: "Parameter kelas dibutuhkan" };

  const token = process.env.MTQ_TOKEN;
  if (!token) return { statusCode: 500, body: JSON.stringify([]) };

  const octokit = new Octokit({ auth: token });
  const owner = "digitalmtq";
  const repo = "server";
  const path = `kelas_${kelas}.json`;

  try {
    let file;
    try {
      file = await octokit.repos.getContent({ owner, repo, path });
    } catch (err) {
      // File tidak ada → buat kosong
      console.log("File tidak ada, auto-create:", path);
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

    const content = file?.data?.content || "";
    let santriData = [];
    try {
      santriData = JSON.parse(Buffer.from(content, "base64").toString());
    } catch (err) {
      console.log("JSON corrupt, return empty array:", err.message);
      santriData = [];
    }

    if (!Array.isArray(santriData)) santriData = [];
    return { statusCode: 200, body: JSON.stringify(santriData) };

  } catch (err) {
    console.error("Error ambilSantri:", err.message);
    return { statusCode: 200, body: JSON.stringify([]) }; // selalu return array
  }
}
