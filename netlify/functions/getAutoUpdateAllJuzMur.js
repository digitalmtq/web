// COMMONJS
const GITHUB_REPO = "digitalmtq/server";
const FILE_PATH   = "autoUpdateAllJuzMur.json";
const BRANCH      = "main";
const TOKEN       = process.env.MTQ_TOKEN;

const ghHeaders = ()=>({ Authorization:`Bearer ${TOKEN}`, Accept:"application/vnd.github.v3+json" });
const fileUrl = () =>
  `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(FILE_PATH)}?ref=${encodeURIComponent(BRANCH)}`;

exports.handler = async ()=>{
  try{
    if (!TOKEN) return { statusCode:500, headers:{'content-type':'application/json'}, body:'{"error":"MTQ_TOKEN belum diset."}' };
    const res = await fetch(fileUrl(), { headers: ghHeaders() });
    if (res.status===404) return { statusCode:200, headers:{'content-type':'application/json'}, body:'[]' };
    if (!res.ok){
      const t = await res.text().catch(()=> "");
      return { statusCode: res.status, headers:{'content-type':'application/json'}, body: JSON.stringify({error:`Gagal ambil file (${res.status})`, detail:t}) };
    }
    const json = await res.json();
    const content = Buffer.from(json.content||"", "base64").toString("utf8");
    return { statusCode:200, headers:{'content-type':'application/json'}, body: content||"[]"};
  }catch(e){
    return { statusCode:500, headers:{'content-type':'application/json'}, body: JSON.stringify({error:String(e.message||e)}) };
  }
};
