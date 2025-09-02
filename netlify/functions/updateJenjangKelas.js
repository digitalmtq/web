jenSel.addEventListener("change", async () => {
  const key   = String(row.dataset?.nis || row.dataset?.id || "").trim();
  const oldJ  = String(window.jenjangMap?.[kSem] ?? jenNow ?? "");
  const newJ  = String(jenSel.value || "");

  if (newJ && !/^A[1-8]$/.test(newJ)) {
    alert("Jenjang harus A1 - A8 (atau kosong).");
    jenSel.value = oldJ;
    return;
  }

  jenSel.disabled = true;
  jenSel.style.opacity = "0.6";
  try {
    const res = await fetch(`/.netlify/functions/updateJenjangKelas?kelas=${encodeURIComponent(kelas)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, jenjang: newJ })
    });

    // ← Tampilkan body text kalau gagal (supaya tidak cuma “Gagal update jenjang” generik)
    const text = await res.text();
    let out = {};
    try { out = JSON.parse(text); } catch {}

    if (!res.ok || out?.success !== true) {
      throw new Error(out?.error || text || "Gagal update jenjang.");
    }

    window.jenjangMap[key] = newJ;
  } catch (e) {
    alert("Gagal menyimpan jenjang ke kelas: " + e.message);
    jenSel.value = oldJ;
  } finally {
    jenSel.disabled = false;
    jenSel.style.opacity = "";
  }
});
