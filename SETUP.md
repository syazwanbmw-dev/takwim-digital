# Panduan Pemasangan — Takwim Digital

**Deploy versi anda sendiri dari sifar.** Tiada pangkalan data untuk disediakan — sistem
guna Google Calendar sebagai sumber data dan Apps Script Script Properties untuk tetapan.

> 🇲🇾 **Bahasa Melayu** di bawah &nbsp;•&nbsp; 🇬🇧 [**English version**](#english) — scroll down

---

## Ringkasan seni bina

| Lapisan | Guna apa |
| --- | --- |
| Runtime | Google Apps Script (standalone, V8) |
| "Pangkalan data" acara | **Google Calendar** — setiap aktiviti = satu Calendar event |
| Tetapan & sesi & pengguna | `PropertiesService` (Script Properties): `APP_CONFIG_V3`, `PPD_USERS_V23`, `PPD_SESSIONS_V23`, `PPD_AUDIT_V23` |
| Cuti umum | Kalendar awam Google "Holidays in Malaysia" (baca sahaja, sudah di-hardcode) |
| Frontend | Satu fail `Index.html` (HTML + CSS + JS, tiada framework) |
| Identiti | Sesi Google sahaja — tiada kata laluan disimpan |

---

## Prasyarat

1. **Akaun Google** (peribadi atau Google Workspace). Akaun ini yang akan jadi pemilik
   skrip **dan** Super Admin pertama.
2. **Node.js 14+** dan **npm** — untuk `clasp`.
3. **Satu Google Calendar** yang akaun di atas boleh akses/urus. Semua aktiviti takwim
   akan ditulis ke kalendar ini. Boleh guna kalendar utama akaun, atau buat kalendar baharu.
4. **`clasp`** (Google Apps Script CLI):
   ```bash
   npm install -g @google/clasp
   ```
5. **Aktifkan Apps Script API** untuk akaun anda (sekali sahaja):
   buka <https://script.google.com/home/usersettings> → hidupkan **Google Apps Script API**.

---

## Langkah 1 — Ambil kod

```bash
git clone https://github.com/syazwanbmw-dev/takwim-digital.git
cd takwim-digital
```

## Langkah 2 — Log masuk clasp

```bash
clasp login
```
Tetingkap browser terbuka → benarkan akses. Token disimpan di `~/.clasprc.json`
(fail ini **tidak** masuk repo).

## Langkah 3 — Cipta projek Apps Script anda sendiri

`.clasp.json` repo asal **tidak disertakan** (setiap orang guna projek sendiri).
Pilih **satu**:

**A. Cipta projek baharu (disyorkan)**
```bash
clasp create --type webapp --title "Takwim Digital"
```
Ini jana `.clasp.json` baharu (mengandungi `scriptId` anda). Jika `clasp` cuba
tulis ganti `appsscript.json`, **kekalkan versi repo** (jangan terima yang kosong).

**B. Guna scriptId sedia ada**
```bash
cp .clasp.json.example .clasp.json
```
kemudian edit `.clasp.json`, ganti `PASTE_YOUR_OWN_APPS_SCRIPT_ID_HERE` dengan
scriptId projek Apps Script anda (jumpa di **Project Settings** dalam editor Apps Script).

## Langkah 4 — Hantar kod

```bash
clasp push -f
```
Semua `.js`, `.html` dan `appsscript.json` naik ke projek Apps Script anda.

## Langkah 5 — Deploy sebagai Web App

```bash
clasp deploy --description "v1"
```
atau melalui editor: `clasp open` → butang **Deploy** → **New deployment** →
jenis **Web app**, dengan tetapan:

| Tetapan | Nilai |
| --- | --- |
| **Execute as** | **Me** (akaun anda) — wajib, semua operasi kalendar jalan sebagai anda |
| **Who has access** | **Anyone within [domain anda]** (disyorkan untuk staf organisasi) — atau **Anyone with a Google Account** jika perlu orang luar (baca [Nota Keselamatan](#nota-keselamatan)) |

Kali pertama, Google minta kebenaran (akses Calendar, hantar email). Terima.

Salin **URL Web app** yang diberi.

## Langkah 6 — Setup Wizard

Buka URL Web app dalam browser. Kerana sistem belum dipasang, **Setup Wizard** muncul.
Isi:

| Medan | Nota |
| --- | --- |
| Nama Sistem / Aplikasi | cth. "Takwim SK Contoh" |
| Nama Organisasi | cth. "SK Contoh, Kuala Lumpur" |
| Nama Pendek | untuk label sidebar, cth. "Takwim" |
| **Google Calendar ID** | dari Google Calendar → **Settings** kalendar berkenaan → **Integrate calendar** → **Calendar ID** (rupa `xxxx@group.calendar.google.com`, atau alamat email anda untuk kalendar utama) |
| **Email Super Admin** | **mesti sama** dengan akaun Google yang deploy skrip ini |
| Warna Tema | kod hex, cth. `#0b6ef3` |
| Teks Footer / URL Ikon | pilihan; URL ikon mesti `https://` |

Tekan **Test Connection** — sistem sahkan kalendar boleh diakses + kuota email ada,
kemudian **Install**. Muat semula halaman → anda auto-login sebagai Super Admin.

## Langkah 7 — Luluskan pengguna

1. Staf lain buka URL yang sama → **daftar satu langkah** (isi nama, jawatan, unit).
   Tiada OTP — sesi Google mereka sudah buktikan pemilikan email.
2. Akaun baharu jadi **pending**.
3. Super Admin → **System Settings → Users** → luluskan + beri peranan.

### Peranan

| Peranan | Lihat | Cipta | Edit | Padam | Urus pengguna | Log audit | Kategori "Cuti Sekolah" |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **admin** (Super Admin) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **editor** | ✅ | ✅ | ✅ | — | — | — | — |
| **viewer** | ✅ | — | — | — | — | — | — |

---

## Kemas kini kemudian

```bash
clasp push -f
```
kemudian **Deploy → Manage deployments → (edit) → Version: New version → Deploy**.

Untuk pembangunan, deployment **`@HEAD`** (Test deployment) auto-ikut setiap
`clasp push` — guna URL itu untuk uji sebelum promote ke versi rasmi.

---

## Nota Keselamatan

- **`executeAs: USER_DEPLOYING`** — semua tulisan ke Calendar jalan sebagai *anda*
  (deployer), bukan pelawat. Sistem peranan dalaman app yang kawal siapa boleh buat apa.
- **Identiti = email sesi Google sahaja.** `access: DOMAIN` menjamin pelawat sudah
  login domain sah sebelum app dimuatkan. Setiap fungsi server disemak
  `requireSession_(token, kebenaran)` — tiada token sah = tiada data.
- **Jangan** tukar akses kepada `Anyone with a Google Account` melainkan anda faham:
  orang luar boleh daftar (mereka jadi *pending*, tidak nampak apa-apa sehingga
  diluluskan), tetapi ini meluaskan pendedahan. **Jangan sekali-kali** guna
  `Anyone (anonymous)` — app tak dapat baca email, tiada siapa boleh log masuk.
- **Tiada pangkalan data, tiada secret dalam kod.** Semua tetapan dalam Script
  Properties. Repo ini selamat untuk jadi public.
- Kalendar cuti umum Malaysia adalah awam & baca-sahaja — selamat di-hardcode.

## Menyelesaikan masalah

| Gejala | Punca / penyelesaian |
| --- | --- |
| "Sistem belum dipasang" | Wizard belum siap — buka **URL Web app**, bukan editor Apps Script. |
| "Calendar ID tidak dapat diakses" | Akaun deployer tak langgan / tiada akses ke kalendar itu. Tambah kalendar ke akaun tersebut dulu. |
| "Email Super Admin mesti sama dengan akaun…" | Email yang ditaip ≠ akaun yang deploy. Guna akaun yang sama. |
| Web app domain 404 / akses ditolak | Untuk domain Workspace dengan `access: DOMAIN`, guna bentuk URL `https://script.google.com/a/macros/DOMAIN_ANDA/s/DEPLOYMENT_ID/exec` (bukan `/macros/s/.../exec` generik). |
| Email kelulusan tak sampai | Kuota harian MailApp (Gmail biasa = 100/hari) habis, atau tersasar ke folder spam. |

---
<a name="english"></a>

# Setup Guide — Takwim Digital (English)

**Deploy your own copy from scratch.** There is no database to provision — the system
uses Google Calendar as its data store and Apps Script Script Properties for settings.

## Architecture at a glance

| Layer | What it uses |
| --- | --- |
| Runtime | Google Apps Script (standalone, V8) |
| Event "database" | **Google Calendar** — one activity = one Calendar event |
| Settings, sessions, users | `PropertiesService` (Script Properties): `APP_CONFIG_V3`, `PPD_USERS_V23`, `PPD_SESSIONS_V23`, `PPD_AUDIT_V23` |
| Public holidays | Google's public "Holidays in Malaysia" calendar (read-only, already hardcoded) |
| Frontend | Single `Index.html` (HTML + CSS + JS, no framework) |
| Identity | Google session only — no passwords stored |

## Prerequisites

1. A **Google account** (personal or Workspace). It becomes the script owner **and**
   the first Super Admin.
2. **Node.js 14+** and **npm** — for `clasp`.
3. **One Google Calendar** the account can access/manage. All calendar activities are
   written here. Use the account's primary calendar or create a new one.
4. **`clasp`**:
   ```bash
   npm install -g @google/clasp
   ```
5. **Enable the Apps Script API** once: open
   <https://script.google.com/home/usersettings> → turn on **Google Apps Script API**.

## Step 1 — Get the code

```bash
git clone https://github.com/syazwanbmw-dev/takwim-digital.git
cd takwim-digital
```

## Step 2 — clasp login

```bash
clasp login
```
A browser window opens → grant access. The token is stored at `~/.clasprc.json`
(never committed).

## Step 3 — Create your own Apps Script project

The original `.clasp.json` is **not included** (everyone uses their own project).
Pick **one**:

**A. New project (recommended)**
```bash
clasp create --type webapp --title "Takwim Digital"
```
This generates a fresh `.clasp.json` with your `scriptId`. If `clasp` tries to
overwrite `appsscript.json`, **keep the repo version**.

**B. Existing scriptId**
```bash
cp .clasp.json.example .clasp.json
```
then edit `.clasp.json` and replace `PASTE_YOUR_OWN_APPS_SCRIPT_ID_HERE` with your
Apps Script project's ID (found under **Project Settings** in the Apps Script editor).

## Step 4 — Push the code

```bash
clasp push -f
```

## Step 5 — Deploy as a Web App

```bash
clasp deploy --description "v1"
```
or via the editor: `clasp open` → **Deploy** → **New deployment** → **Web app**:

| Setting | Value |
| --- | --- |
| **Execute as** | **Me** (your account) — required; all calendar operations run as you |
| **Who has access** | **Anyone within [your domain]** (recommended for staff) — or **Anyone with a Google Account** if you need outside users (see [Security notes](#security-notes)) |

On first run Google asks for authorization (Calendar access, send email). Accept.
Copy the **Web app URL**.

## Step 6 — Setup Wizard

Open the Web app URL. Since the system is not installed yet, the **Setup Wizard** appears:

| Field | Note |
| --- | --- |
| App / System name | e.g. "Takwim SK Contoh" |
| Organisation name | e.g. "SK Contoh, Kuala Lumpur" |
| Short name | sidebar label, e.g. "Takwim" |
| **Google Calendar ID** | Google Calendar → that calendar's **Settings** → **Integrate calendar** → **Calendar ID** (looks like `xxxx@group.calendar.google.com`, or your email for the primary calendar) |
| **Super Admin email** | **must match** the Google account that deployed the script |
| Theme colour | hex, e.g. `#0b6ef3` |
| Footer text / Icon URL | optional; icon URL must be `https://` |

Press **Test Connection** — the system verifies calendar access + mail quota, then
**Install**. Reload → you are auto-logged in as Super Admin.

## Step 7 — Approve users

1. Other staff open the same URL → **one-step registration** (name, position, unit).
   No OTP — their Google session already proves email ownership.
2. New accounts are **pending**.
3. Super Admin → **System Settings → Users** → approve + assign a role.

### Roles

| Role | View | Create | Edit | Delete | Manage users | Audit log | "School Holiday" category |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **admin** (Super Admin) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **editor** | ✅ | ✅ | ✅ | — | — | — | — |
| **viewer** | ✅ | — | — | — | — | — | — |

## Updating later

```bash
clasp push -f
```
then **Deploy → Manage deployments → (edit) → Version: New version → Deploy**.

For development, the **`@HEAD`** test deployment auto-follows every `clasp push`.

<a name="security-notes"></a>
## Security notes

- **`executeAs: USER_DEPLOYING`** — all Calendar writes run as *you* (the deployer),
  not the visitor. The app's internal role system controls who can do what.
- **Identity = Google session email only.** `access: DOMAIN` guarantees a verified
  domain login before the app loads. Every server function is checked with
  `requireSession_(token, permission)` — no valid token, no data.
- **Do not** switch access to `Anyone with a Google Account` unless you understand:
  outsiders can then register (they become *pending*, see nothing until approved),
  but it widens exposure. **Never** use `Anyone (anonymous)` — the app cannot read an
  email and no one can sign in.
- **No database, no secrets in code.** All config lives in Script Properties. This
  repo is safe to be public.
- The Malaysia public-holiday calendar is public and read-only — safe to hardcode.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| "Sistem belum dipasang" | Wizard not finished — open the **Web app URL**, not the Apps Script editor. |
| "Calendar ID tidak dapat diakses" | The deployer account isn't subscribed to / has no access to that calendar. Add it to that account first. |
| "Email Super Admin mesti sama dengan akaun…" | The email you typed ≠ the deploying account. Use the same one. |
| Domain web app 404 / access denied | For Workspace domains with `access: DOMAIN`, use the URL form `https://script.google.com/a/macros/YOUR_DOMAIN/s/DEPLOYMENT_ID/exec` (not the generic `/macros/s/.../exec`). |
| Approval emails not arriving | MailApp daily quota (consumer Gmail = 100/day) exhausted, or in the spam folder. |
