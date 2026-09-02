# Pasang Takwim Digital untuk Sekolah Anda

**Untuk cikgu — tak perlu tahu coding.** Anda cuma salin kod dan tampal ke Google
Apps Script. Siap dalam lebih kurang 15 minit. Percuma selama-lamanya (guna kuota
Google akaun anda sendiri).

> 💡 Versi paling senang guna (dengan butang **Salin** sekali klik) ada di:
> **https://syazwanbmw-dev.github.io/takwim-digital/**

---

## Apa yang anda perlukan

1. **Akaun Google** — elok guna akaun sekolah (Google Workspace / GAFE / DELIMa).
   Akaun ini jadi **Super Admin** (pentadbir penuh) sistem anda.
2. **Satu Google Calendar** untuk takwim sekolah — boleh guna yang sedia ada atau
   buat baharu (Langkah 1).
3. Lebih kurang **15 minit**.

---

## Langkah 1 — Sediakan Google Calendar untuk takwim

Jika sekolah anda sudah ada kalendar khas untuk takwim, langkau langkah ini.

1. Buka [calendar.google.com](https://calendar.google.com).
2. Di sebelah kiri, cari **"Other calendars"** → klik tanda **+** → **Create new calendar**.
3. Nama: contoh *"Takwim SK Contoh"* → klik **Create calendar**.

Kita akan perlukan **Calendar ID** kalendar ini nanti (Langkah 7).

---

## Langkah 2 — Buka Google Apps Script

1. Pergi ke [script.google.com](https://script.google.com).
2. Klik **New project** (butang biru, kiri atas).
3. Projek baharu terbuka. Ada satu fail bernama **`Code.gs`** dengan sedikit kod contoh.

---

## Langkah 3 — Masukkan kod bahagian 1 (`Code.gs`)

1. Klik di dalam kotak kod `Code.gs`, tekan **Ctrl + A** (pilih semua) kemudian
   **Delete** — kosongkan fail.
2. Salin **seluruh isi** fail `Code.js` dari repo:
   👉 <https://github.com/syazwanbmw-dev/takwim-digital/blob/master/Code.js>
   (klik butang **Copy raw file** di penjuru kanan atas kotak kod di GitHub)
3. Kembali ke Apps Script, klik dalam `Code.gs`, tekan **Ctrl + V** (tampal).

> Nama fail di GitHub `Code.js`, di Apps Script `Code.gs` — **tak mengapa**, isinya
> sama. Jangan ubah apa-apa dalam kod, tampal seadanya.

---

## Langkah 4 — Masukkan kod bahagian 2 (`Index.html`)

1. Di Apps Script, sebelah kiri (panel **Files**), klik tanda **+** → pilih **HTML**.
2. Namakan fail: **`Index`** — huruf **I besar**, **jangan** taip `.html`. Tekan Enter.
3. Fail `Index.html` terbuka dengan kandungan contoh. Tekan **Ctrl + A** → **Delete**.
4. Salin **seluruh isi** fail `Index.html` dari repo:
   👉 <https://github.com/syazwanbmw-dev/takwim-digital/blob/master/Index.html>
5. Kembali ke Apps Script, klik dalam `Index.html`, tekan **Ctrl + V**.

---

## Langkah 5 — Tetapkan zon waktu (`appsscript.json`)

1. Di Apps Script, klik ikon **⚙️ Project Settings** (roda gigi, panel kiri).
2. Tandakan kotak **"Show 'appsscript.json' manifest file in editor"**.
3. Kembali ke **Editor** (ikon `< >`). Buka fail **`appsscript.json`**.
4. Tekan **Ctrl + A** → **Delete**, kemudian tampal kod ini:

```json
{
  "timeZone": "Asia/Kuala_Lumpur",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

5. Tekan **Ctrl + S** untuk simpan semua fail.

---

## Langkah 6 — Deploy (terbitkan) sebagai laman web

1. Kanan atas → **Deploy** → **New deployment**.
2. Klik ikon **⚙️** di sebelah *"Select type"* → pilih **Web app**.
3. Isi:
   - **Description:** `v1`
   - **Execute as:** **Me** (akaun anda)
   - **Who has access:**
     - Guna akaun **sekolah (Workspace)** → pilih **Anyone within [nama sekolah anda]**
     - Guna **Gmail biasa** → pilih **Anyone with a Google Account**
       (anda akan luluskan setiap guru satu per satu — lihat Langkah 9)
4. Klik **Deploy**.
5. Google akan minta kebenaran:
   - **Authorize access** → pilih akaun anda
   - Skrin *"Google hasn't verified this app"* → klik **Advanced** →
     **Go to (nama projek) (unsafe)** → **Allow**
   - ⚠️ Ini **normal** — anda yang pasang skrip ini sendiri, jadi ia selamat.
6. Selesai. **Salin URL Web app** yang dipaparkan — inilah alamat sistem takwim anda.

---

## Langkah 7 — Dapatkan Calendar ID

1. Buka [calendar.google.com](https://calendar.google.com).
2. Sebelah kiri, cari kalendar takwim anda → hover → klik **⋮** → **Settings and sharing**.
3. Skrol ke bahagian **Integrate calendar**.
4. Salin nilai **Calendar ID** — rupanya seperti `abc123...@group.calendar.google.com`
   (jika anda guna kalendar utama, ia adalah alamat e-mel anda).

---

## Langkah 8 — Siapkan sistem (Setup Wizard)

1. Buka **URL Web app** (dari Langkah 6) dalam pelayar.
2. Borang **Setup** akan muncul. Isi:

   | Medan | Contoh / nota |
   |---|---|
   | Nama Sistem / Aplikasi | *Takwim SK Contoh* |
   | Nama Organisasi | *SK Contoh, Kuala Lumpur* |
   | Nama Pendek | *Takwim* (untuk label menu) |
   | Google Calendar ID | tampal nilai dari Langkah 7 |
   | E-mel Super Admin | **e-mel akaun yang anda guna sekarang** — mesti sama |
   | Warna Tema / Footer / URL Ikon | pilihan |

3. Klik **Test Connection**. Jika hijau (berjaya), klik **Install**.
4. **Muat semula** halaman — anda terus masuk sebagai **Super Admin**. ✅

---

## Langkah 9 — Jemput guru lain

1. Guru lain buka **URL yang sama** → klik daftar → isi nama, jawatan, unit.
   Tiada kata laluan, tiada OTP — akaun Google mereka sudah mengesahkan identiti.
2. Akaun mereka berstatus **"menunggu kelulusan"**.
3. Anda (Super Admin) → menu **System Settings → Users** → **Luluskan** + pilih peranan:

   | Peranan | Boleh buat |
   |---|---|
   | **admin** | semua — termasuk urus pengguna & kategori "Cuti Sekolah" |
   | **editor** | tambah / ubah aktiviti takwim |
   | **viewer** | lihat sahaja |

---

## Bila ada versi baharu — cara kemas kini

1. Buka projek Apps Script anda.
2. Salin semula isi **`Code.gs`** dan **`Index.html`** dari repo (pautan di Langkah 3 & 4),
   ganti isi lama sepenuhnya.
3. **Ctrl + S** untuk simpan.
4. **Deploy → Manage deployments** → klik ✏️ (edit) → **Version: New version** → **Deploy**.

URL Web app anda **kekal sama** selepas kemas kini.

---

## Masalah biasa

| Masalah | Sebab & penyelesaian |
|---|---|
| *"Sistem belum dipasang"* | Anda belum siap Setup Wizard. Buka **URL Web app**, bukan editor Apps Script. |
| *"Calendar ID tidak dapat diakses"* | Calendar ID salah, atau akaun anda tiada akses ke kalendar itu. Semak semula Langkah 7. |
| *"E-mel Super Admin mesti sama dengan akaun…"* | E-mel dalam borang ≠ akaun yang deploy. Guna akaun yang **sama** untuk kedua-duanya. |
| Skrin *"Google hasn't verified this app"* nampak menakutkan | Normal untuk skrip yang anda pasang sendiri. **Advanced → Go to … (unsafe) → Allow**. |
| Guru lain buka URL → *"You need access"* | Semasa Deploy, *Who has access* ditetapkan terlalu ketat. **Manage deployments → edit → tukar akses → New version → Deploy**. |

---

## Untuk yang biasa dengan `clasp` / Git

Ada panduan teknikal (guna CLI `clasp`, dwibahasa) di:
[`SETUP.md`](https://github.com/syazwanbmw-dev/takwim-digital/blob/master/SETUP.md)

---

Kod sumber: <https://github.com/syazwanbmw-dev/takwim-digital> · Lesen **MIT** (guna & ubah suai bebas)
