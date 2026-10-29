# Preview Kalender ATMI 2027

Situs statis (HTML + CSS + JS, PDF.js dari CDN). Tidak perlu build.

## Letakkan PDF hasil kompres

Buat folder `pdf/` lalu isi dengan:

- `pdf/kalender-dinding-preview.pdf`
- `pdf/kalender-duduk-preview.pdf`

Kalau nama file berbeda, ubah di bagian `CONFIG` pada `app.js`.

## Uji di komputer

PDF.js tidak jalan kalau `index.html` dibuka langsung (file://). Jalankan server lokal:

```bash
python -m http.server 8000
```

Lalu buka http://localhost:8000

## Deploy

```bash
git init
git add .
git commit -m "Preview kalender ATMI 2027"
git remote add origin <URL-REPO-GITHUB>
git push -u origin main
```

Di Vercel: Add New Project, pilih repo, Framework Preset **Other**, kosongkan Build Command, lalu Deploy.

## Pintasan keyboard

| Tombol | Fungsi |
|---|---|
| ← → / PageUp PageDown / Spasi | Pindah halaman |
| Home / End | Halaman pertama / terakhir |
| F | Layar penuh |
| + − 0 | Perbesar, perkecil, pas layar |
| 1 / 2 | Kalender dinding / duduk |

Tautan langsung: `/#dinding` dan `/#duduk`.

Pastikan folder Google Drive diatur "Anyone with the link" agar bisa dibuka atasan.
