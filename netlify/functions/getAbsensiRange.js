import fetch from "node-fetch";

export async function handler(event) {
  const token = process.env.MTQ_TOKEN;
  const { kelas, start, end } = event.queryStringParameters;

  if (!kelas || !start || !end) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Parameter 'kelas', 'start', dan 'end' wajib diisi" }),
    };
  }

  // Fungsi untuk membuat array tanggal antara start dan end
  function generateDateRange(startDate, endDate) {
    const dates = [];
    let current = new Date(startDate);
    const endD = new Date(endDate);
    while (current <= endD) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  const tanggalList = generateDateRange(start, end);
  const hasilGabungan = [];

  for (const tanggal of tanggalList) {
    const fileName = `${kelas}_${tanggal}.json`;
    const apiUrl = `https://api.github.com/repos/dickymiswardi/private/contents/absensi/${fileName}`;

    try {
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (response.status === 404) continue; // Lewati jika file tidak ditemukan

      if (!response.ok) {
        throw new Error(`Gagal fetch: ${response.status}`);
      }

      const result = await response.json();
      const decoded = Buffer.from(result.content, "base64").toString("utf-8");
      const jsonData = JSON.parse(decoded);

      hasilGabungan.push(...jsonData);
    } catch (err) {
      console.error(`Gagal ambil data untuk ${tanggal}:`, err.message);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(hasilGabungan),
  };
}
