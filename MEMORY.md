# MEMORY — Takwim Digital

> Ingatan projek: status semasa, sejarah, keputusan master, gotcha. Baca lepas `CLAUDE.md`
> (tiada `CLAUDE.md` lagi untuk projek ni — cipta bila perlu arahan operasi stabil).

## Status Semasa (2026-09-07)

🟢 **LIVE production `@23`** — Google Apps Script, akaun DELIMa (Workspace sekolah).
`master` == `origin/master` @ `5febeee`, 21 commit di atas base `d6984a3`.

**Feature terbaharu: Digest Mingguan Telegram + Google Chat** — SIAP PENUH, LIVE, dan **teruji
hujung-ke-hujung dengan mesej Telegram SEBENAR** (bukan cuma unit test). Dibina guna
`superpowers:subagent-driven-development` (14 task, ~23 subagent dispatch merentas implementer/
reviewer/fixer, 2 fix round dalam-task + 1 fix wave whole-branch + 1 fix wave cross-AI Julius).

- Suite: `node selftest-node.js` → **87 LULUS, 0 GAGAL**. `node --check Code.js` senyap. CRLF 0
  merentas 7 fail (Code.js/Index.html/selftest-node.js/SETUP.md/SETUP.html/docs/PANDUAN-GURU.md/
  docs/index.html).
- Ulasan: 13 task-review + 1 whole-branch review (opus) + 1 Julius (Gemini, cross-AI) — semua
  bersih selepas fix round masing-masing. Ledger PENUH (setiap ruling, setiap fix, setiap
  penemuan dibuang/diterima) di
  `.superpowers/sdd/PLAN-telegram-gchat-digest/progress.md` (workspace SDD — **jangan padam**
  sehingga sesi lain sahkan tak perlu lagi; ia rekod satu-satunya untuk *kenapa* setiap keputusan
  dibuat, git log cuma rekod *apa*).
- Plan asal: `PLAN-telegram-gchat-digest.md` (LOCAL, **sengaja tak commit** — untuk rujukan
  master, bukan sebahagian repo public).
- Spec authoritative: `C:\Users\user\Documents\code\memory\plans\2026-09-06-telegram-gchat-weekly-digest.md`

**Apa yang LIVE:**
- Dua checkbox saluran ("Kongsi ke Telegram" / "Kongsi ke Google Chat") dalam borang aktiviti —
  guru boleh tanda satu, kedua-dua, atau tiada.
- `sendWeeklyDigest_()` — handler trigger mingguan, tapis senarai berasingan setiap saluran,
  hantar teks biasa (tajuk+tarikh Melayu+lokasi SAHAJA — PIC/agensi/keterangan TAK PERNAH bocor),
  penanda `DGSENT_<minggu>` elak hantar dua kali, `LockService` elak dua trigger serentak.
- System Settings: 8 kawalan broadcast/digest, token/webhook **write-only** (kosong = kekalkan,
  checkbox eksplisit = padam) — disahkan manual: token/webhook TAK PERNAH terpapar semula lepas
  simpan, dan simpan-tanpa-isi TAK padam nilai lama.
- **Diuji sekolah SK Salor sendiri (master, akaun sebenar):** satu bot Telegram
  (`@Takwimdigi_bot`) + satu group ibu bapa dikonfigurasi sebenar, mesej digest sebenar diterima
  dan disahkan kandungan betul.

**Apa yang BELUM:**
- Google Chat webhook — BELUM dikonfigurasi/diuji sebenar (master pilih Telegram dulu). Sink
  `sendToGoogleChat_` siap kod + ujian unit, tapi belum ada bukti hantar sebenar macam Telegram.
- Item 3-4 checklist smoke (write-only re-verify) — disahkan master secara manual selepas
  ditanya semula, LULUS.

## Prasyarat Manual (SEKALI SAHAJA, dah dibuat 2026-09-07)

Master dah Run fungsi yang sentuh `UrlFetchApp` (kali PERTAMA projek ni guna permintaan luar) dan
lulus skrin kebenaran OAuth (`script.external_request`). **Kalau sekolah lain pasang instance
baharu projek ni, langkah ni kena diulang** — lihat gotcha "Kebenaran OAuth" di bawah untuk cara
tepat (senang tersasar).

## Gotcha

### Kebenaran OAuth (`UrlFetchApp`) — DINAMIK, bukan statik, dan MOBILE gagal senyap
**Ini paling penting, makan ~1 jam nyahpepijat langsung dengan master 2026-09-07:**

- Apps Script semak kebenaran skop **secara DINAMIK** — bila kod BETUL-BETUL cuba panggil API
  istimewa (`UrlFetchApp.fetch()` dalam kes ni), **BUKAN** secara statik untuk keseluruhan
  fungsi/projek bila `Run` ditekan. Ini bermakna:
  - Jalankan fungsi yang TAK sampai panggil `UrlFetchApp` (cth `getSystemSettings`) **TAK** akan
    cetuskan skrin kebenaran — walaupun projek yang SAMA ada kod lain yang guna `UrlFetchApp`.
  - `sendWeeklyDigest_()` sendiri pun TAK cetuskan skrin kebenaran kalau ia `return` awal
    (config kosong) sebelum sempat sampai baris `UrlFetchApp.fetch()`.
  - Skrin kebenaran **hanya** timbul pada EKSEKUSI PERTAMA yang benar-benar mencapai baris kod
    yang panggil API istimewa tu.
- Skrin kebenaran Apps Script (`Authorization required` → `Review permissions` → pilih akaun →
  `Advanced` → `Go to <nama> (unsafe)` → `Allow`) buka sebagai **pop-up window** berasingan —
  dan **GAGAL SENYAP** (tiada popup langsung, terus throw
  `Error: You do not have permission to call UrlFetchApp.fetch...`) bila dijalankan dari
  **browser MOBILE** (disahkan: Chrome mobile Android). **Kena buat di DESKTOP/LAPTOP.**
- `sendWeeklyDigest_` (dan fungsi lain berakhir `_`) **TAK muncul** dalam dropdown Run/Debug
  Apps Script Editor (disahkan empirik, bukan andaian — inilah yang sebelum ni ditanda
  "verify-then-fix" dalam whole-branch review). **Teknik pengesahan/ujian manual:** tambah
  fungsi SEMENTARA terus dalam editor ONLINE (bukan repo, tak commit, tak `clasp pull` balik):
  ```js
  function AUTH_SEMENTARA_JANGAN_COMMIT() { sendWeeklyDigest_(); }
  ```
  Run dia, padam balik lepas siap. **AWAS:** `clasp push -f` timpa SEMUA fail termasuk Code.js
  dalam editor online — kalau fungsi sementara tu masih ada, ia HILANG bila push. Beritahu
  master untuk simpan/salin fungsi tu dulu kalau nak push semasa tengah guna teknik ni.
- SETUP.md/.html §8.4 "Step 0" (fallback "run mana-mana fungsi awam") — teks tu **tersilap**,
  ditulis sebelum gotcha dinamik ni ditemui. Perlu dibetulkan (belum dibuat — backlog).

### Digest mingguan
- `DGSENT_<minggu ISO>` dalam Script Properties — halang hantar dua kali seminggu sama. Untuk
  uji BERKALI-KALI dalam minggu yang sama semasa development/smoke, PADAM kunci ni secara manual
  (Project Settings → Script Properties, atau kod: `PropertiesService.getScriptProperties().deleteProperty('DGSENT_2026-W37')` — tukar nombor minggu ikut minggu semasa).
- `pruneDigestMarkers_()` kekalkan 8 penanda TERBAHARU sahaja (auto-jalan lepas setiap hantar
  berjaya) — tak perlu risau ia bertambah tanpa had.
- Jadual jam trigger (`DIGEST_HOUR`/`DIGEST_MINUTE`) Apps Script hantar dalam tetingkap
  **±15 minit** dari waktu ditetapkan (`nearMinute` window) — bukan tepat ke minit.
- `digestEndDate_` (server, Code.js) sengaja **berasingan** dari `displayEndDate()` (client,
  Index.html) — dua fungsi yang buat perkara SAMA (tolak 1000ms untuk allDay event) tapi wujud
  dalam DUA runtime berlainan (server GAS vs client JS), jadi tak boleh kongsi kod terus.
  **Ujian kembar** (Task 4, `selftest-node.js`) baca KEDUA-DUA fail dan banding hasil — kalau
  salah satu diubah tanpa yang lain, ujian tu gagal. **Jangan padam ujian kembar ni** walaupun
  nampak redundant.

## Keputusan Master

- **Satu saluran dulu (Telegram), Google Chat lain kali** (2026-09-07) — sistem sokong
  konfigurasi separa (satu/kedua-dua/tiada saluran), jadi tak perlu tunggu kedua-dua sedia untuk
  mula guna.
- **Rev.1 (2026-09-06 malam, sebelum coding)** — label checkbox **"Kongsi ke Telegram"** /
  **"Kongsi ke Google Chat"** SAHAJA, TIADA "(ibu bapa)"/"(murid)" ditambah — kekal sepanjang
  UI + docs (disahkan berulang kali semasa review, label mesti padan tepat merentas
  Index.html/SETUP.md/SETUP.html/docs).

## Minor Diketahui (backlog, tak menghalang guna)

- SETUP.md/.html §8.4 "Step 0" perlu dibetulkan (lihat gotcha OAuth di atas).
- `sendToTelegram_`/`sendToGoogleChat_` — 2 daripada 3 gerbang `addAudit_` setiap sink (migrate +
  HTTP-gagal) betul dalam kod tapi tak ada ujian mutation SENDIRI (cuma gerbang rangkaian yang
  dibuktikan). Kos vs faedah kecil untuk tambah lagi.
- `sendActivityReminders_` (trigger reminder HARIAN, LIVE, pre-existing — **bukan** sebahagian
  feature digest ni) ada corak bug **SAMA** yang baru dibetulkan untuk sink digest: `addAudit_`
  tak dibungkus try/catch dalam gelung penghantaran DAN dalam `catch` luarnya. **Bug sebenar di
  atas kod production yang guru/ibu bapa dah bergantung** — cadang jadi tugasan berasingan
  (jangan bundle dengan feature lain, ikut tabiat projek).

## Sejarah Ringkas (sebelum sesi ni)

Lihat `project_takwim_digital.md` dalam memory Lucy global untuk sejarah penuh sebelum feature
digest ni (setup awal, reminder email H-1/H-2/H-3, Guru Penerima, dll — LIVE `@8` 2026-08-23,
kemudian berkembang ke `@22` dengan Waktu Hantar Reminder boleh admin tukar).
