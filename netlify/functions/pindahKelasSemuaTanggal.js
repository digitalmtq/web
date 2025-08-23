// contoh handler tombol "Pindah Semua Tanggal"
confirmBtn.onclick = async () => {
  const santriIds = Array.from(selectSantri.selectedOptions).map(o => o.value); // gunakan id (atau nis)
  const kelasTujuan = document.querySelector('input[name="kelasTujuan"]:checked')?.value;
  const kelasAsal = kelasSelect.value; // ex: "kelas_1"

  if (!santriIds.length || !kelasTujuan) {
    alert("Pilih santri dan kelas tujuan.");
    return;
  }

  statusText.textContent = "Memproses semua tanggal...";
  const res = await fetch("/.netlify/functions/pindahKelasSemuaTanggal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kelasAsal, kelasTujuan, santriIds })
  });
  const out = await res.json();
  if (out.success) {
    console.log(out.details); // ringkasan per tanggal
    statusText.style.color = "green";
    statusText.textContent = `Berhasil pindah ${out.totalMoved} entri lintas tanggal.`;
    loadSantriData();
    modal.style.display = "none";
  } else {
    statusText.style.color = "red";
    statusText.textContent = out.error || "Gagal memindahkan data.";
  }
};
