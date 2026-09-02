# 📅 Takwim Digital

Papan pemuka takwim / kalendar aktiviti untuk organisasi, dibina atas **Google Apps
Script + Google Calendar**. Tiada pangkalan data, tiada pelayan untuk diurus — deploy
salinan anda sendiri dalam beberapa minit.

> A calendar / activity-planner dashboard for an organisation, built on **Google Apps
> Script + Google Calendar**. No database, no server to run — deploy your own copy in
> minutes.

---

## 👩‍🏫 Panduan mudah untuk cikgu (tanpa coding)

**➡️ https://syazwanbmw-dev.github.io/takwim-digital/**

Salin & tampal kod terus ke Google Apps Script — ada butang **Salin** sekali klik,
siap dalam ± 15 minit. Sumber: [`docs/PANDUAN-GURU.md`](docs/PANDUAN-GURU.md).

---

## ✨ Ciri / Features

- **Sumber data = Google Calendar** — setiap aktiviti ialah satu Calendar event; guna
  Google Calendar seperti biasa dan takwim ikut sekali.
- **Paparan bulan / tahun / senarai**, sel berwarna ikut status (aktiviti / cuti).
- **Cuti umum Malaysia automatik** dari kalendar awam Google.
- **Kategori "Cuti Sekolah"** khas untuk pentadbir (cuti penggal, cuti tambahan).
- **Akses berperanan** — `admin` / `editor` / `viewer`. Setiap panggilan server
  disemak sesi; tiada token sah = tiada data.
- **Pendaftaran satu langkah** guna sesi Google (tiada OTP, tiada kata laluan disimpan).
- **Sesi gelongsor** — lanjut automatik 7 hari semasa aktif, had mutlak 30 hari.
- **Log audit** untuk operasi memusnahkan.
- **Cetak laporan** kalendar bulanan (grid) + senarai aktiviti.
- **Setup Wizard** dalam-app — nama, organisasi, Calendar ID, tema, ikon; semua
  disimpan dalam Script Properties.
- Responsif telefon / tablet / desktop, satu fail `Index.html` tanpa framework.

## 🧱 Seni bina / Architecture

| Lapisan / Layer | |
| --- | --- |
| Runtime | Google Apps Script (standalone, V8) |
| Data acara / Event data | **Google Calendar** |
| Tetapan, sesi, pengguna, audit | `PropertiesService` (Script Properties) |
| Frontend | `Index.html` — HTML + CSS + JS, tiada framework |
| Identiti / Identity | Sesi Google sahaja / Google session only |

## 🚀 Deploy versi anda / Deploy your own

Panduan penuh dari sifar (dwibahasa) / Full from-scratch guide (bilingual):

➡️ **[SETUP.md](SETUP.md)** &nbsp;•&nbsp; versi HTML boleh buka terus dalam browser: **[SETUP.html](SETUP.html)**

Ringkasnya / In short:

```bash
npm install -g @google/clasp
clasp login
git clone https://github.com/syazwanbmw-dev/takwim-digital.git
cd takwim-digital
clasp create --type webapp --title "Takwim Digital"   # jana .clasp.json anda sendiri
clasp push -f
clasp deploy --description "v1"
```

Kemudian buka URL Web app → lengkapkan **Setup Wizard** (nama app, Calendar ID, email
Super Admin = akaun yang deploy). Butiran & troubleshooting dalam **[SETUP.md](SETUP.md)**.

## 🔒 Keselamatan / Security

- `executeAs: USER_DEPLOYING` — operasi Calendar jalan sebagai deployer, bukan pelawat.
- Identiti dari sesi Google; setiap fungsi server dilindungi `requireSession_`.
- **Tiada pangkalan data, tiada secret dalam kod** — semua tetapan dalam Script Properties.
- Jangan guna akses `Anyone (anonymous)` — app perlu email sesi untuk berfungsi.
  Lihat [SETUP.md → Nota Keselamatan](SETUP.md#nota-keselamatan).

## 📄 Lesen / License

[MIT](LICENSE) — guna, ubah, edar, deploy versi sendiri secara bebas; kekalkan notis
hakcipta. / Use, modify, distribute and self-deploy freely; keep the copyright notice.
