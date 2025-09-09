// COMMONJS
const GITHUB_REPO = "digitalmtq/server";
const FILE_PATH = "autoUpdateAllJuzMur.json";
const BRANCH = "main";
const TOKEN = process.env.MTQ_TOKEN;

const ghHeaders = () => ({
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github.v3+json",
  "Content-Type": "application/json",
});
const fileUrl = () =>
  `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(FILE_PATH)}?ref=${encodeURIComponent(BRANCH)}`;
const putUrl = () =>
  `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(FILE_PATH)}`;

async function getCurrentFile() {
  const res = await fetch(fileUrl(), { headers: ghHeaders() });
  if (res.status === 404) return { sha: null, contentStr: "[]" };
  if (!res.ok) {
    const t = await res.text().catch(()=> "");
    throw new Error(`GET GitHub failed ${res.status}: ${t}`);
  }
  const json = await res.json();
  return { sha: json.sha, contentStr: Buffer.from(json.content||"", "base64").toString("utf8") };
}
const b64 = (s)=>Buffer.from(s, "utf8").toString("base64");

exports.handler = async (event)=>{
  try{
    if (!TOKEN) return { statusCode:500, body: JSON.stringify({error:"MTQ_TOKEN belum diset."}) };

    if (event.httpMethod === "GET"){
      const { contentStr } = await getCurrentFile();
      return { statusCode:200, headers:{'content-type':'application/json'}, body: contentStr };
    }

    if (event.httpMethod === "POST"){
      let payload={}; try{ payload=JSON.parse(event.body||"{}"); }catch{ return {statusCode:400, body:'{"error":"Body bukan JSON valid."}'}; }
      const { fromDate, toDate, kelas } = payload||{};
      if (!kelas) return { statusCode:400, body:'{"error":"kelas wajib."}' };

      const { sha, contentStr } = await getCurrentFile();
      let arr=[]; try{ const p=JSON.parse(contentStr); arr=Array.isArray(p)? p:[]; }catch{}
      const nowIso = new Date().toISOString();
      const idx = arr.findIndex(x=>x && x.kelas===kelas);
      const rec = { kelas, fromDate:fromDate||"", toDate:toDate||"", updatedAt:nowIso };
      if (idx>=0) arr[idx] = { ...arr[idx], ...rec }; else arr.push(rec);

      const putBody = { message:`autoUpdateAllJuzMur: upsert ${kelas}`, content:b64(JSON.stringify(arr,null,2)), branch:BRANCH };
      if (sha) putBody.sha = sha;

      const putRes = await fetch(putUrl(), { method:'PUT', headers:ghHeaders(), body: JSON.stringify(putBody) });
      if (!putRes.ok){
        const t = await putRes.text().catch(()=> "");
        return { statusCode: putRes.status, headers:{'content-type':'application/json'}, body: JSON.stringify({error:`PUT fail ${putRes.status}: ${t}`}) };
      }
      return { statusCode:200, headers:{'content-type':'application/json'}, body: JSON.stringify({ok:true, saved:rec}) };
    }

    return { statusCode:405, body:"Method Not Allowed" };
  }catch(e){
    return { statusCode:500, headers:{'content-type':'application/json'}, body: JSON.stringify({error:String(e.message||e)}) };
  }
};
