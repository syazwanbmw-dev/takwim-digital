# Digest Aktiviti Mingguan (Telegram + Google Chat) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hantar digest teks biasa seminggu sekali — senarai aktiviti sekolah 7 hari akan datang yang ditanda untuk saluran berkenaan — ke group Telegram ibu bapa dan/atau Google Chat Space murid.

**Architecture:** Semua dalam `Code.js` + `Index.html` (single-file GAS web app). Penanda per-aktiviti disimpan sebagai satu baris senarai saluran `Kongsi: tg,gchat` dalam `description` event Calendar (corak sama `Reminder:`/`RemindTo:`), diisi oleh **dua checkbox bebas** dalam borang aktiviti. Satu handler trigger `sendWeeklyDigest_()` baca kalendar kerja, **tapis senarai berasingan untuk setiap sink** (`tgEvents` / `gchatEvents`), panggil `buildDigestText_()` sekali per sink, hantar melalui dua penghantar nipis (`sendToTelegram_`, `sendToGoogleChat_`), kemudian cap satu penanda `DGSENT_<isoWeek>` untuk seluruh run dalam Script Properties supaya minggu yang sama tak dihantar dua kali.

> **Rev.1 (2026-09-06 malam):** keputusan #3 spec diubah master — satu toggle "Kongsi umum" digantikan **dua checkbox bebas per saluran**. Task 3, 6, 7, 11 (dan teks docs) dalam plan ni sudah direvise mengikutnya; task lain tidak terjejas.

**Tech Stack:** Google Apps Script (V8 runtime), CalendarApp, PropertiesService, ScriptApp time trigger, `UrlFetchApp` (kali pertama dalam projek ni), vanilla JS client. Tiada library, tiada framework ujian.

**Spec:** `C:\Users\user\Documents\code\memory\plans\2026-09-06-telegram-gchat-weekly-digest.md` — baca sekali penuh sebelum Task 1. Keputusan dalamnya MUKTAMAD; plan ini tak boleh membatalkannya.

---

## Global Constraints

- **Bahasa:** semua komen kod, label UI dan mesej ralat dalam **Bahasa Melayu**. Komen terangkan **KENAPA**, bukan APA — padan ketumpatan komen `Code.js` sedia ada.
- **Gaya kod:** vanilla JS gaya fail sedia ada — `function(){}` (BUKAN arrow) dalam kod server `Code.js`; `const`/`let`; `var` hanya kalau fail sekitarnya guna `var`. **JANGAN** cadang/guna TypeScript. Arrow function DIBENARKAN dalam `Index.html` sahaja (fail itu memang guna arrow).
- **Tiada fail app baharu.** Hanya `Code.js` + `Index.html` yang di-push ke Apps Script (`.claspignore` hadkan `clasp push` ke `appsscript.json`, `Code.js`, `Index.html`). Satu fail baharu DIBENARKAN di root repo: `selftest-node.js` (pelari ujian lokal — lihat Task 1; ia tak pernah sampai ke Apps Script).
- **Tiada library baharu**, tiada `npm install`, tiada `package.json`.
- **Rahsia:** `BROADCAST_TG_TOKEN` dan `BROADCAST_GCHAT_WEBHOOKS` hidup dalam Script Properties SAHAJA. Repo ini **PUBLIC**. Token/URL webhook **tidak boleh** muncul dalam: kod, git, mesej ralat, audit log, atau respons `getSystemSettings`.
- **CRLF (Windows):** selepas SETIAP commit jalankan `grep -c $'\r' Code.js Index.html selftest-node.js` — mesti `0` untuk setiap fail. Kalau bukan 0, JANGAN commit; betulkan dulu (`node -e` tulis semula dengan `\n`). **Jangan guna Python** untuk apa-apa pembetulan — Node.js sahaja.
- **Gerbang setiap commit:** `node --check Code.js` (mesti senyap) **dan** `node selftest-node.js` (mesti keluar `0 GAGAL`).
- **Mutation test WAJIB:** setiap logik kritikal mesti dibuktikan boleh GAGAL. Prosedur: edit kod SEBENAR (bukan salinan), jalan `node selftest-node.js`, sahkan ujian yang dinamakan GAGAL, kemudian pulih dengan `git checkout -- Code.js` (pulih dari versi **COMMITTED**, bukan salinan tangan). Mutasi mesti **TIRU kegagalan** (ganti operator / tukar syarat), bukan sekadar memadam fungsi.
- **Satu task = satu commit.** Jangan gabung dua task dalam satu commit.
- **JANGAN deploy production** tanpa kelulusan eksplisit master (Task 14 menerangkan gerbang ini).
- Timezone runtime: `appsscript.json` = `Asia/Singapore`; `DEFAULT_CONFIG.TIMEZONE` = `Asia/Kuala_Lumpur` (offset sama, +08). Semua pengiraan "hari" guna getter tempatan `Date` — konsisten dengan `startOfDay_`/`isReminderDayMatch_` sedia ada.

## Fail & tanggungjawab

| Fail | Tanggungjawab | Perubahan |
|------|---------------|-----------|
| `Code.js` | Seluruh logik server | +~230 baris: 6 kunci config, keluarga `clamp*`, helper tulen digest, penanda `Kongsi`, dua sink, handler + trigger, `selfTestDigestHelpers_` |
| `Index.html` | UI client | Dua checkbox "Kongsi ke Telegram" / "Kongsi ke Google Chat" dalam borang aktiviti + lencana saluran dalam modal detail; 8 medan dalam System Settings |
| `selftest-node.js` (BAHARU, root) | Pelari ujian lokal | Muatkan `Code.js` dengan global GAS PALSU; jalankan suite tulen + ujian orkestrasi ber-side-effect |
| `SETUP.md` / `SETUP.html` | Panduan pemasang | Seksyen baharu: sediakan bot Telegram + webhook Chat, 6 tetapan, nota skop OAuth |
| `docs/PANDUAN-GURU.md` / `docs/index.html` | Panduan cikgu | Perenggan ringkas: dua checkbox saluran dan bila guna |

## Keputusan reka bentuk yang plan ini buat (spec tidak liputi)

Semua ini kecil, dan pelaksana **tidak** perlu fikir semula — ikut sahaja. Master boleh veto mana-mana semasa semakan plan.

1. **`selftest-node.js` di-COMMIT** (bukan simpan dalam folder sementara). Sebab: spec Seksyen 10 menuntut ujian jalan di `node` lokal + mutation test setiap commit; harness yang tinggal dalam folder sementara akan hilang dan mutation test jadi mustahil sesi depan. `.claspignore` sudah menghalang ia sampai ke Apps Script.
2. **Nama bulan/hari Melayu ditulis dalam `Code.js`**, bukan `formatDate_`. Sebab: `formatDate_` → `Utilities.formatDate` pulang nama Inggeris ("Monday, 8 September"), jadi contoh dalam spec Seksyen 7 ("Isnin, 8 September 2026") MUSTAHIL dicapai melaluinya.
3. **`digestEndDate_` ditulis di server**, salinan logik `displayEndDate()` dalam `Index.html`. Sebab: `displayEndDate` hanya wujud client-side; server tiada. Salinan merentas runtime dipolis oleh **ujian kembar** (Task 4) yang baca kedua-dua fail.
4. **`isoWeekKey_(date)` tanpa parameter `tz`.** Spec tulis `isoWeekKey_(date, tz)`, tetapi pengiraan dibuat atas komponen tempatan `Date` (skrip jalan dalam SATU zon waktu). Parameter yang diterima tapi diabaikan = jaminan PALSU.
5. **`clampDigestHour_` berasingan dari `clampReminderHour_`**, kedua-dua delegasi ke `clampInt_(value, max, fallback)` baharu. Sebab: `clampReminderHour_` jatuh balik ke `DEFAULT_CONFIG.REMINDER_HOUR`; digest mesti jatuh balik ke `DEFAULT_CONFIG.DIGEST_HOUR`. Guna semula terus akan mengikat dua tetapan yang tak berkaitan.
6. **Cara PADAM rahsia:** dua checkbox eksplisit dalam UI (`clearTgToken`, `clearGchatWebhooks`) — bukan nilai ajaib. Medan kosong = KEKALKAN yang lama (peraturan write-only spec 8.1).
7. **Sink Chat hanya terima URL `https://chat.googleapis.com/v1/spaces/...`** — disemak masa simpan (ralat jelas) DAN masa hantar (pertahanan berlapis). Halang digest ter-POST ke hos sewenang-wenang kerana salah taip.
8. **Setup Wizard TIDAK disentuh.** Ikut duluan `REMINDER_HOUR`, yang juga hanya wujud dalam System Settings. Spec Seksyen 2 sebut "Setup Wizard", tetapi Seksyen 11 (jadual fail) tidak — dan menambah 8 medan broadcast ke wizard pemasangan pertama menambah geseran untuk sekolah yang tak guna ciri ni.
9. **`projectSystemSettings_` + `mergeSettingsInput_` diasingkan sebagai fungsi tulen**, supaya gerbang write-only (dakwaan KESELAMATAN) boleh diuji tanpa sesi palsu.
10. **`installDigestTrigger_()` disediakan** (cermin `installReminderTrigger_`) untuk reset trigger dari editor tanpa menyentuh System Settings.
11. **Lencana saluran dalam modal detail aktiviti** (📣 Dikongsi: Telegram / Google Chat / kedua-dua). Tanpa ia, tiada cara guru/master MELIHAT saluran mana yang melekat selain buka semula borang edit.

---

## Task 1: Pelari ujian lokal (`selftest-node.js`) + garis dasar hijau

Tiada kod ciri dalam task ni. Task ni membina alat yang menghukum semua task selepasnya, dan membuktikan alat itu **menggigit** sebelum kita percaya padanya.

**Files:**
- Create: `C:\Users\user\Documents\code\takwim-digital\selftest-node.js`

**Interfaces:**
- Consumes: `Code.js` sedia ada (`selfTestRegHelpers_`, `selfTestReminderHelpers_`).
- Produces: `loadCode(names, overrides)` — muatkan `Code.js` dan pulangkan fungsi yang diminta, dengan global GAS palsu boleh diganti per-ujian. `fakeProps(seed)`, `fakeCalendar(events)`, `fakeEvent(o)`, `fakeUrlFetch()` — kilang objek palsu yang task kemudian guna. Bendera keluar: `process.exit(1)` bila ada FAIL.

- [ ] **Step 1: Cipta `selftest-node.js`**

```js
'use strict';
/*
  Pelari ujian LOKAL. Jalan: node selftest-node.js

  KENAPA fail ni wujud: fungsi dalam Code.js hanya boleh dijalankan dari editor
  Apps Script (manual, lambat, dan tak boleh masuk dalam gerbang pra-commit).
  Harness ni muatkan Code.js ke dalam skop terkawal dan SUNTIK objek GAS PALSU,
  supaya (a) self-test tulen jalan dalam milisaat setiap commit, dan (b) fungsi
  ber-side-effect (UrlFetchApp / PropertiesService / CalendarApp) boleh diuji
  tanpa menyentuh data sebenar atau menghantar mesej betul.

  Fail ni TIDAK pernah sampai ke Apps Script -- .claspignore hadkan `clasp push`
  kepada appsscript.json, Code.js, Index.html sahaja.
*/
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CODE_PATH = path.join(ROOT, 'Code.js');
const HTML_PATH = path.join(ROOT, 'Index.html');

// Global GAS yang Code.js sentuh. Disenaraikan EKSPLISIT sebagai parameter fungsi
// supaya setiap panggilan loadCode() dapat set palsu SENDIRI -- tiada keadaan bocor
// antara ujian (satu ujian yang menulis Properties tak boleh mencemar ujian lain).
const GAS_GLOBALS = ['CalendarApp', 'Utilities', 'PropertiesService', 'ScriptApp',
                     'MailApp', 'Session', 'LockService', 'Logger', 'UrlFetchApp'];

// ---- kilang objek palsu -------------------------------------------------

function fakeProps(seed) {
  const store = Object.assign({}, seed || {});
  const api = {
    getProperty: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setProperty: function (k, v) { store[k] = String(v); return api; },
    deleteProperty: function (k) { delete store[k]; return api; },
    getKeys: function () { return Object.keys(store); }
  };
  return { store: store, api: api };
}

function fakeEvent(o) {
  return {
    getId: function () { return o.id || 'ev1'; },
    getTitle: function () { return o.title || 'Tajuk'; },
    getDescription: function () { return o.description || ''; },
    getLocation: function () { return o.location || ''; },
    getStartTime: function () { return new Date(o.start); },
    getEndTime: function () { return new Date(o.end); },
    isAllDayEvent: function () { return !!o.allDay; }
  };
}

function fakeCalendar(events) {
  return {
    getName: function () { return 'Kalendar Ujian'; },
    getEvents: function () { return events || []; }
  };
}

// Rakam SETIAP panggilan fetch. Ujian menuntut BILANGAN dan KANDUNGAN panggilan --
// "tiada token -> tiada fetch" hanya boleh dibuktikan kalau kita nampak log kosong.
function fakeUrlFetch(responder) {
  const calls = [];
  return {
    calls: calls,
    api: {
      fetch: function (url, params) {
        calls.push({ url: url, params: params });
        const r = responder ? responder(url, params, calls.length) : {};
        return {
          getResponseCode: function () { return r.code === undefined ? 200 : r.code; },
          getContentText: function () { return r.body === undefined ? '{"ok":true}' : r.body; }
        };
      }
    }
  };
}

function defaultFakes() {
  const props = fakeProps({});
  return {
    __props: props,
    CalendarApp: {
      EventColor: { BLUE: 'B', GREEN: 'G', ORANGE: 'O', MAUVE: 'M', RED: 'R', GRAY: 'GY', YELLOW: 'Y' },
      getCalendarById: function () { return null; }
    },
    Utilities: {
      formatDate: function (d) { return String(d); },
      getUuid: function () { return 'uuid-palsu'; }
    },
    PropertiesService: { getScriptProperties: function () { return props.api; } },
    ScriptApp: {
      WeekDay: { SUNDAY: 'SUN', MONDAY: 'MON', TUESDAY: 'TUE', WEDNESDAY: 'WED',
                 THURSDAY: 'THU', FRIDAY: 'FRI', SATURDAY: 'SAT' },
      getProjectTriggers: function () { return []; }
    },
    MailApp: { sendEmail: function () {} },
    Session: { getEffectiveUser: function () { return { getEmail: function () { return 'admin@x.com'; } }; } },
    LockService: { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } },
    Logger: { log: function () {} },
    // Lalai SENGAJA meletup: mana-mana ujian yang tak sepatutnya buat permintaan luar
    // akan gagal dengan kuat, bukan senyap.
    UrlFetchApp: { fetch: function () { throw new Error('UrlFetchApp dipanggil tanpa dijangka'); } }
  };
}

// Muatkan Code.js dan pulangkan HANYA nama yang diminta. Nama yang tak wujud
// pulang `undefined` (bukan ReferenceError) supaya ujian boleh menuntut
// "fungsi ni belum wujud" dengan jelas.
function loadCode(names, overrides) {
  const src = fs.readFileSync(CODE_PATH, 'utf8');
  const fakes = Object.assign(defaultFakes(), overrides || {});
  const ret = '\n;return {' + names.map(function (n) {
    return JSON.stringify(n) + ':(typeof ' + n + '!=="undefined"?' + n + ':undefined)';
  }).join(',') + '};';
  const factory = new Function(GAS_GLOBALS.join(','), src + ret);
  const api = factory.apply(null, GAS_GLOBALS.map(function (g) { return fakes[g]; }));
  api.__fakes = fakes;
  return api;
}

// ---- pengumpul keputusan ------------------------------------------------

const results = [];
function ok(name, cond) { results.push((cond ? 'PASS' : 'FAIL') + ' :: ' + name); }
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// Jalankan suite selfTest* yang hidup DALAM Code.js. Suite tu lempar Error bila ada
// FAIL, jadi kita tangkap dan salin baris FAIL masuk laporan gabungan.
function runSuite(fnName) {
  const api = loadCode([fnName]);
  if (typeof api[fnName] !== 'function') {
    ok('suite ' + fnName + ' wujud dalam Code.js', false);
    return;
  }
  try {
    api[fnName]();
    ok('suite ' + fnName + ' semua PASS', true);
  } catch (e) {
    ok('suite ' + fnName + ' semua PASS', false);
    String(e.message).split('\n').forEach(function (line) {
      if (line.indexOf('FAIL') === 0) results.push('  ' + line);
    });
  }
}

// ---- suite dalam Code.js ------------------------------------------------

runSuite('selfTestRegHelpers_');
runSuite('selfTestReminderHelpers_');

// ---- ujian orkestrasi (perlu objek palsu -- tak boleh hidup dalam Code.js) ----
// (diisi bermula Task 10)

// ---- laporan ------------------------------------------------------------

const summary = results.join('\n');
console.log(summary);
const failed = results.filter(function (r) { return r.indexOf('FAIL') === 0; }).length;
console.log('\n' + (results.length - failed) + ' LULUS, ' + failed + ' GAGAL');
if (failed) process.exit(1);
```

- [ ] **Step 2: Jalankan — mesti hijau atas kod yang belum disentuh**

```bash
cd /c/Users/user/Documents/code/takwim-digital
node selftest-node.js
```

Jangkaan: `2 LULUS, 0 GAGAL`.

- [ ] **Step 3: Buktikan pelari ini MENGGIGIT (mutation test)**

Edit `Code.js` — tukar `clampReminderDays_` supaya jadi `>=` bukan padanan had:

```js
// SEBELUM: return n > 3 ? 3 : n;
// MUTASI:  return n > 3 ? 4 : n;
```

```bash
node selftest-node.js; echo "exit=$?"
```

Jangkaan: `FAIL :: suite selfTestReminderHelpers_ semua PASS` diikuti baris `FAIL :: clampReminderDays_ > 3 dipotong ke 3`, dan `exit=1`.

- [ ] **Step 4: Pulih dari versi COMMITTED**

```bash
git checkout -- Code.js
node selftest-node.js
```

Jangkaan: `2 LULUS, 0 GAGAL`.

- [ ] **Step 5: Gerbang CRLF + hurai**

```bash
node --check Code.js
grep -c $'\r' Code.js Index.html selftest-node.js
```

Jangkaan: `node --check` senyap; ketiga-tiga fail lapor `0`.

- [ ] **Step 6: Commit**

```bash
git add selftest-node.js
git commit -m "test: pelari self-test lokal (node) dengan global GAS palsu"
```

**Siap bila:** `node selftest-node.js` hijau, mutation test terbukti menggigit dan sudah dipulihkan, `git status` bersih.

---

## Task 2: Kunci config baharu + keluarga `clampInt_`

**Files:**
- Modify: `Code.js` — `DEFAULT_CONFIG` (baris ~3-28), `clampReminderHour_` (baris ~52-57), `selfTestReminderHelpers_` (baris ~1724-1727)

**Interfaces:**
- Consumes: `DEFAULT_CONFIG`, `clampReminderHour_` sedia ada.
- Produces: `DEFAULT_CONFIG.BROADCAST_TG_TOKEN` (`''`), `.BROADCAST_TG_CHAT_IDS` (`''`), `.BROADCAST_GCHAT_WEBHOOKS` (`''`), `.DIGEST_DAY` (`0`), `.DIGEST_HOUR` (`7`), `.DIGEST_MINUTE` (`45`); `clampInt_(value, max, fallback)`, `clampDigestHour_(value)`, `clampDigestDay_(value)`, `clampMinute_(value)` — semua pulang integer.

- [ ] **Step 1: Tulis ujian yang GAGAL dahulu** — tambah di HUJUNG `selfTestReminderHelpers_`, sebelum `const summary = results.join('\n');`

```js
  ok('clampInt_ dalam julat kekal', clampInt_(5, 23, 7) === 5);
  ok('clampInt_ atas had dipotong ke had', clampInt_(99, 23, 7) === 23 && clampInt_(9, 6, 0) === 6);
  ok('clampInt_ negatif/sampah -> fallback', clampInt_(-1, 23, 7) === 7 && clampInt_('abc', 23, 7) === 7);
  ok('clampInt_ 0 KEKAL 0 (0 nilai sah, bukan "kosong")', clampInt_(0, 23, 7) === 0);
  ok('clampDigestDay_ 0-6', clampDigestDay_(6) === 6 && clampDigestDay_(7) === 6 && clampDigestDay_('x') === DEFAULT_CONFIG.DIGEST_DAY);
  ok('clampMinute_ 0-59', clampMinute_(59) === 59 && clampMinute_(60) === 59 && clampMinute_('x') === DEFAULT_CONFIG.DIGEST_MINUTE);
  ok('clampDigestHour_ jatuh balik ke DIGEST_HOUR, BUKAN REMINDER_HOUR',
     clampDigestHour_('x') === DEFAULT_CONFIG.DIGEST_HOUR && clampDigestHour_(99) === 23);
  ok('DEFAULT_CONFIG ada 6 kunci broadcast/digest',
     DEFAULT_CONFIG.BROADCAST_TG_TOKEN === '' && DEFAULT_CONFIG.BROADCAST_TG_CHAT_IDS === '' &&
     DEFAULT_CONFIG.BROADCAST_GCHAT_WEBHOOKS === '' && DEFAULT_CONFIG.DIGEST_DAY === 0 &&
     DEFAULT_CONFIG.DIGEST_HOUR === 7 && DEFAULT_CONFIG.DIGEST_MINUTE === 45);
```

- [ ] **Step 2: Jalankan — mesti GAGAL**

```bash
node selftest-node.js; echo "exit=$?"
```

Jangkaan: gagal dengan `ReferenceError: clampInt_ is not defined` yang ditangkap `runSuite` → `FAIL :: suite selfTestReminderHelpers_ semua PASS`, `exit=1`.

- [ ] **Step 3: Tambah 6 kunci ke `DEFAULT_CONFIG`** — selepas `REMINDER_HOUR: 7`, tukar baris itu jadi `REMINDER_HOUR: 7,` kemudian tambah:

```js
  // --- Broadcast digest mingguan (Telegram + Google Chat) ---
  // Token & URL webhook ialah RAHSIA: disimpan dalam Script Properties sahaja,
  // tak pernah dipulangkan ke client (lihat projectSystemSettings_) dan tak pernah
  // masuk audit log. Repo ni PUBLIC.
  BROADCAST_TG_TOKEN: '',
  // chat_id group Telegram dipisah koma. Group biasanya ID NEGATIF (cth -1001234567890).
  BROADCAST_TG_CHAT_IDS: '',
  // URL incoming webhook Google Chat Space dipisah koma.
  BROADCAST_GCHAT_WEBHOOKS: '',
  // Jadual trigger sendWeeklyDigest_: hari (0=Ahad..6=Sabtu), jam (0-23), minit (0-59).
  // nearMinute() Apps Script = tetingkap +-15 minit, bukan masa TEPAT.
  DIGEST_DAY: 0,
  DIGEST_HOUR: 7,
  DIGEST_MINUTE: 45
```

- [ ] **Step 4: Ganti `clampReminderHour_` dengan keluarga `clampInt_`** — ganti blok baris ~52-57 sepenuhnya:

```js
// Pagar integer dari client: potong ke `max`, dan jatuh balik ke `fallback` bila
// nilai rosak/negatif. Nota: 0 ialah nilai SAH (tengah malam / Ahad), jadi hanya
// isNaN dan negatif yang jatuh ke fallback -- bukan `!n`.
function clampInt_(value, max, fallback) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 0) return fallback;
  return n > max ? max : n;
}

// Had 0-23 (jam sehari) -- pagar nilai dari client, fallback default kalau rosak/tiada.
function clampReminderHour_(value) { return clampInt_(value, 23, DEFAULT_CONFIG.REMINDER_HOUR); }

// Jam digest SENGAJA tidak guna semula clampReminderHour_: fallback dia mesti
// DIGEST_HOUR. Kalau dikongsi, tukar lalai reminder akan diam-diam menukar
// kelakuan pemulihan digest -- dua tetapan yang tak berkaitan jadi terikat.
function clampDigestHour_(value) { return clampInt_(value, 23, DEFAULT_CONFIG.DIGEST_HOUR); }
function clampDigestDay_(value) { return clampInt_(value, 6, DEFAULT_CONFIG.DIGEST_DAY); }
function clampMinute_(value) { return clampInt_(value, 59, DEFAULT_CONFIG.DIGEST_MINUTE); }
```

- [ ] **Step 5: Jalankan — mesti LULUS**

```bash
node selftest-node.js
node --check Code.js
```

Jangkaan: `2 LULUS, 0 GAGAL`. Ujian `clampReminderHour_` LAMA (empat baris di baris ~1724-1727) mesti masih lulus — itu bukti refactor tak mengubah kelakuan sedia ada.

- [ ] **Step 6: Mutation test — buktikan pagar atas menggigit**

```js
// Dalam clampInt_, MUTASI: return n > max ? max : n;  ->  return n;
```

```bash
node selftest-node.js; echo "exit=$?"
```

Jangkaan GAGAL: `clampInt_ atas had dipotong ke had`, `clampDigestDay_ 0-6`, `clampMinute_ 0-59`, `clampDigestHour_ ...`, dan ujian sedia ada `clampReminderHour_ > 23 dipotong ke 23`. `exit=1`.

Mutasi kedua — buktikan fallback tak dikongsi:

```js
// Dalam clampDigestHour_, MUTASI: DEFAULT_CONFIG.DIGEST_HOUR -> DEFAULT_CONFIG.REMINDER_HOUR
// Sementara itu tukar DEFAULT_CONFIG.DIGEST_HOUR: 7 -> 8 supaya dua nilai BERBEZA.
```

Jangkaan GAGAL: `clampDigestHour_ jatuh balik ke DIGEST_HOUR, BUKAN REMINDER_HOUR`.
⚠️ Mutasi ni menyentuh DUA tempat — pastikan `git checkout -- Code.js` dijalankan selepasnya.

- [ ] **Step 7: Pulih + commit**

```bash
git checkout -- Code.js
```

Kemudian tulis semula perubahan Step 3/4/1 (guna `git stash`/salinan editor kalau perlu), sahkan hijau, dan:

```bash
node selftest-node.js && node --check Code.js && grep -c $'\r' Code.js
git add Code.js
git commit -m "feat(config): kunci broadcast/digest + keluarga clampInt_"
```

> **Petua pelaksana:** untuk elak menulis semula kod selepas mutation test, buat mutasi SELEPAS `git add` (staged) — kemudian `git checkout -- Code.js` pulih dari index, bukan dari HEAD. Tapi sahkan sekali lagi hijau selepas pulih.

**Siap bila:** 6 kunci wujud dalam `DEFAULT_CONFIG`, empat fungsi clamp wujud, `node selftest-node.js` hijau, kedua-dua mutasi terbukti gagal, commit bersih.

---

## Task 3: Helper tulen — `parseCsvList_`, `parseShareChannels_`, `sanitizeForGChat_`, `isoWeekKey_` + suite `selfTestDigestHelpers_`

**Files:**
- Modify: `Code.js` — seksyen baharu sebelum blok `SELF-TEST` (baris ~1676); suite baharu di hujung fail
- Modify: `selftest-node.js` — daftar suite baharu

**Interfaces:**
- Consumes: tiada (semua tulen).
- Produces: `parseCsvList_(raw) -> string[]`; `SHARE_CHANNELS` (`['tg','gchat']`); `parseShareChannels_(description) -> string[]` (subset `SHARE_CHANNELS`, susunan kanonik); `sanitizeForGChat_(s) -> string`; `isoWeekKey_(date) -> string` (`"2026-W37"`); `selfTestDigestHelpers_() -> string` (lempar Error bila ada FAIL).

- [ ] **Step 1: Tulis suite yang GAGAL dahulu** — tambah di HUJUNG `Code.js`:

```js
function selfTestDigestHelpers_() {
  const results = [];
  function ok(name, cond) { results.push((cond ? 'PASS' : 'FAIL') + ' :: ' + name); }
  function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  ok('parseCsvList_ pisah koma/semikolon/ruang + buang kosong',
     eq(parseCsvList_('-100a, -100b ; '), ['-100a', '-100b']));
  ok('parseCsvList_ TIDAK lowercase (chat_id & URL sensitif huruf besar)',
     eq(parseCsvList_('https://chat.googleapis.com/v1/spaces/AAQZxK/messages?key=K'),
        ['https://chat.googleapis.com/v1/spaces/AAQZxK/messages?key=K']));
  ok('parseCsvList_ kosong/null -> []', eq(parseCsvList_(''), []) && eq(parseCsvList_(null), []));

  ok('parseShareChannels_ Kongsi: tg -> [tg]', eq(parseShareChannels_('Kongsi: tg'), ['tg']));
  ok('parseShareChannels_ Kongsi: gchat -> [gchat]', eq(parseShareChannels_('Kongsi: gchat'), ['gchat']));
  ok('parseShareChannels_ dua saluran -> [tg,gchat]',
     eq(parseShareChannels_('PIC: Ali\nKongsi: tg,gchat\n[PPD_CATEGORY:program]'), ['tg', 'gchat']));
  ok('parseShareChannels_ susunan KANONIK (input gchat,tg tetap keluar tg dahulu)',
     eq(parseShareChannels_('Kongsi: gchat,tg'), ['tg', 'gchat']));
  ok('parseShareChannels_ tiada baris / senarai kosong -> []',
     eq(parseShareChannels_('PIC: Ali'), []) && eq(parseShareChannels_(''), []) &&
     eq(parseShareChannels_('Kongsi:   '), []));
  ok('parseShareChannels_ buang token TAK DIKENALI (tiada saluran hantu)',
     eq(parseShareChannels_('Kongsi: xyz'), []) && eq(parseShareChannels_('Kongsi: 1'), []) &&
     eq(parseShareChannels_('Kongsi: tg,whatsapp'), ['tg']));
  ok('parseShareChannels_ BERLABUH baris (bukan tengah ayat keterangan guru)',
     eq(parseShareChannels_('Kita akan Kongsi: tg dgn PIBG nanti'), []));
  ok('parseShareChannels_ huruf besar diterima', eq(parseShareChannels_('Kongsi: TG, GChat'), ['tg', 'gchat']));

  ok('sanitizeForGChat_ buang aksara format Chat',
     sanitizeForGChat_('*tebal* _condong_ ~garis~ `kod` <a|b>') === 'tebal condong garis kod ab');
  ok('sanitizeForGChat_ KEKALKAN baris baru + indent (susun atur digest bergantung padanya)',
     sanitizeForGChat_('a\n  b') === 'a\n  b');
  ok('sanitizeForGChat_ null -> kosong', sanitizeForGChat_(null) === '');

  ok('isoWeekKey_ 1 Jan 2026 (Khamis) -> 2026-W01', isoWeekKey_(new Date(2026, 0, 1)) === '2026-W01');
  ok('isoWeekKey_ 31 Dis 2026 -> 2026-W53 (tahun ada W53)', isoWeekKey_(new Date(2026, 11, 31)) === '2026-W53');
  ok('isoWeekKey_ 1 Jan 2027 masih 2026-W53 (sempadan tahun stabil)',
     isoWeekKey_(new Date(2027, 0, 1)) === '2026-W53');
  ok('isoWeekKey_ 29 Dis 2025 sudah 2026-W01 (minggu ISO milik tahun HADAPAN)',
     isoWeekKey_(new Date(2025, 11, 29)) === '2026-W01');
  ok('isoWeekKey_ 1 Jan 2023 (Ahad) -> 2022-W52 (minggu ISO milik tahun LEPAS)',
     isoWeekKey_(new Date(2023, 0, 1)) === '2022-W52');
  ok('isoWeekKey_ minggu <10 dipad 2 digit (susunan leksikografi = susunan masa)',
     isoWeekKey_(new Date(2026, 8, 6)) === '2026-W36' && isoWeekKey_(new Date(2026, 1, 2)) === '2026-W06');
  ok('isoWeekKey_ hari BERBEZA dalam minggu sama -> kunci sama',
     isoWeekKey_(new Date(2026, 8, 13)) === isoWeekKey_(new Date(2026, 8, 19)));

  const summary = results.join('\n');
  Logger.log(summary);
  const failed = results.filter(function (r) { return r.indexOf('FAIL') === 0; }).length;
  if (failed) throw new Error(failed + ' ujian GAGAL:\n' + summary);
  return summary;
}
```

- [ ] **Step 2: Daftar suite dalam pelari** — dalam `selftest-node.js`, di bawah `runSuite('selfTestReminderHelpers_');`:

```js
runSuite('selfTestDigestHelpers_');
```

- [ ] **Step 3: Jalankan — mesti GAGAL**

```bash
node selftest-node.js; echo "exit=$?"
```

Jangkaan: `FAIL :: suite selfTestDigestHelpers_ semua PASS` (ReferenceError: `parseCsvList_` tak wujud), `exit=1`.

- [ ] **Step 4: Tulis pelaksanaan** — sisip seksyen baharu dalam `Code.js` TEPAT SEBELUM komen blok `SELF-TEST (pilihan)` (baris ~1676):

```js
/* =========================================================
   DIGEST MINGGUAN -- Broadcast Telegram + Google Chat
   Dipanggil oleh trigger masa mingguan (lihat syncDigestTrigger_), BUKAN client.
   Reka bentuk: SATU teks biasa dibina sekali (buildDigestText_) kemudian di-fan-out
   ke dua sink nipis. Sink-agnostik supaya tambah/buang saluran = kos kecil.
   Kandungan SENGAJA terhad kepada tajuk/tarikh/lokasi -- audiens ialah ibu bapa &
   murid di LUAR domain sekolah, jadi PIC/agensi/nota dalaman tak pernah keluar.
   ========================================================= */

// "-100123, -100456 ; " -> ['-100123','-100456']. SENGAJA tidak lowercase:
// chat_id boleh jadi @username, dan URL webhook Chat sensitif huruf besar-kecil.
function parseCsvList_(raw) {
  return String(raw || '')
    .split(/[\s,;]+/)
    .map(function (v) { return v.trim(); })
    .filter(function (v) { return v.length > 0; });
}

// Saluran keluar yang DIKENALI. Susunan dalam array ni ialah susunan KANONIK
// baris `Kongsi:` -- satu aktiviti sentiasa menghasilkan satu bentuk teks yang sama,
// tak kira susunan guru menanda checkbox.
const SHARE_CHANNELS = ['tg', 'gchat'];

// Penanda perkongsian disimpan sebagai SATU baris senarai dalam description event
// (Calendar tiada medan tersuai) -- corak sama Reminder:/RemindTo:.
// "Kongsi: tg,gchat" -> ['tg','gchat'] ; "Kongsi: gchat" -> ['gchat'] ; tiada -> [].
// Padanan BERLABUH baris supaya perkataan "kongsi" dalam ayat keterangan guru tak
// tersalah jadi penanda. Token tak dikenali DIBUANG: senarai ni memandu saluran
// KELUAR domain sekolah, jadi hanya nama yang kita sendiri tulis boleh menghidupkannya.
function parseShareChannels_(description) {
  const m = String(description || '').match(/(?:^|\n)Kongsi:\s*([^\n]*)/i);
  if (!m) return [];
  const diminta = {};
  parseCsvList_(m[1]).forEach(function (t) { diminta[t.toLowerCase()] = true; });
  return SHARE_CHANNELS.filter(function (c) { return diminta[c] === true; });
}

// Google Chat menghurai * _ ~ ` sebagai format dan <...|...> sebagai pautan dalam
// mesej teks biasa. Buang aksara tu supaya tajuk/lokasi guru tak jadi format tak
// sengaja. Buang (bukan ganti ruang) sebab teks digest bergantung pada indent DUA
// ruang dan baris baru -- menyentuh ruang putih akan merosakkan susun atur.
function sanitizeForGChat_(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[*_~`<>|]/g, '');
}

// "2026-W37" mengikut ISO-8601. Dipakai sebagai kunci penanda DGSENT_ supaya
// digest tak dihantar dua kali dalam minggu yang sama.
// KENAPA ISO, bukan Utilities.formatDate('ww'): peraturan minggu Java bergantung
// pada locale skrip dan tak stabil merentas sempadan tahun. Nombor minggu dipad
// 2 digit supaya susunan leksikografi kunci = susunan masa (pruneDigestMarkers_
// bergantung pada sifat ni).
// Tiada parameter zon waktu: skrip jalan dalam SATU zon (appsscript.json), dan
// parameter yang diterima tapi diabaikan ialah jaminan palsu.
function isoWeekKey_(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // ISO: KHAMIS dalam minggu itu yang menentukan tahun minggu tersebut.
  const dayNum = (d.getDay() + 6) % 7; // Isnin=0 .. Ahad=6
  d.setDate(d.getDate() - dayNum + 3);
  const isoYear = d.getFullYear();
  const firstThu = new Date(isoYear, 0, 4); // 4 Jan sentiasa dalam minggu ISO ke-1
  firstThu.setDate(firstThu.getDate() - ((firstThu.getDay() + 6) % 7) + 3);
  const week = 1 + Math.round((d - firstThu) / 604800000);
  return isoYear + '-W' + (week < 10 ? '0' + week : String(week));
}
```

- [ ] **Step 5: Jalankan — mesti LULUS**

```bash
node selftest-node.js
node --check Code.js
```

Jangkaan: `3 LULUS, 0 GAGAL`.

- [ ] **Step 6: Mutation test (tiga mutasi)**

```js
// M1 -- buang labuhan baris:  /(?:^|\n)Kongsi:\s*([^\n]*)/i  ->  /Kongsi:\s*([^\n]*)/i
```
Jangkaan GAGAL: `parseShareChannels_ BERLABUH baris (bukan tengah ayat keterangan guru)`.

```js
// M1b -- terima token apa sahaja (buang tapisan saluran dikenali):
//   return SHARE_CHANNELS.filter(function (c) { return diminta[c] === true; });
//   ->  return parseCsvList_(m[1]);
```
Jangkaan GAGAL: `parseShareChannels_ buang token TAK DIKENALI`, `parseShareChannels_ susunan KANONIK`, `parseShareChannels_ huruf besar diterima`.

```js
// M2 -- buang padding minggu: (week < 10 ? '0' + week : String(week))  ->  String(week)
```
Jangkaan GAGAL: `isoWeekKey_ 1 Jan 2026 (Khamis) -> 2026-W01` dan `isoWeekKey_ minggu <10 dipad 2 digit`.

```js
// M3 -- sanitizeForGChat_ ganti ruang, bukan buang: replace(/[*_~`<>|]/g, ' ')
```
Jangkaan GAGAL: `sanitizeForGChat_ buang aksara format Chat`.

Selepas setiap mutasi: `node selftest-node.js; echo "exit=$?"` mesti `exit=1`, kemudian `git checkout -- Code.js` (atau pulih dari index kalau sudah `git add`).

- [ ] **Step 7: Commit**

```bash
node selftest-node.js && node --check Code.js && grep -c $'\r' Code.js selftest-node.js
git add Code.js selftest-node.js
git commit -m "feat(digest): helper tulen parseCsvList_/parseShareChannels_/sanitizeForGChat_/isoWeekKey_"
```

**Siap bila:** `selfTestDigestHelpers_` wujud dengan 21 semakan hijau, empat mutasi (M1, M1b, M2, M3) terbukti gagal, `node selftest-node.js` lapor `3 LULUS, 0 GAGAL`.

---

## Task 4: Label tarikh Melayu + pembetulan `end` eksklusif all-day (+ ujian kembar)

Ini task paling halus dalam plan. Dua perangkap: (a) `formatDate_` pulang nama Inggeris, (b) Google Calendar bagi `end` EKSKLUSIF untuk event all-day, jadi julat tarikh tersasar +1 hari kalau tak dibetulkan. Logik (b) sudah wujud di client (`displayEndDate` dalam `Index.html`) tetapi TIDAK di server.

**Files:**
- Modify: `Code.js` — seksyen `DIGEST MINGGUAN`, selepas `isoWeekKey_`; `selfTestDigestHelpers_`
- Modify: `selftest-node.js` — ujian kembar merentas fail

**Interfaces:**
- Consumes: `isSameCalDay_` (baharu, task ni).
- Produces: `DIGEST_DAY_MS` (array 7), `DIGEST_MONTH_MS` (array 12), `isSameCalDay_(a, b) -> boolean`, `digestEndDate_(e) -> Date`, `digestDateLong_(d) -> string`, `digestDateLabel_(e) -> string`. `e` ialah objek dari `eventToObject_` (`{start, end, allDay, ...}` — `start`/`end` ISO string).

- [ ] **Step 1: Tulis ujian yang GAGAL dahulu** — tambah dalam `selfTestDigestHelpers_` sebelum `const summary = ...`:

```js
  // Nota: Date bulan-0-based. 2026-09-07 ialah ISNIN, 2026-09-11 JUMAAT.
  const satuHari = { start: new Date(2026, 8, 7, 9, 0).toISOString(),
                     end: new Date(2026, 8, 7, 11, 0).toISOString(), allDay: false };
  ok('digestDateLabel_ satu hari -> "Isnin, 7 September 2026"',
     digestDateLabel_(satuHari) === 'Isnin, 7 September 2026');

  const julat = { start: new Date(2026, 8, 9, 8, 0).toISOString(),
                  end: new Date(2026, 8, 11, 17, 0).toISOString(), allDay: false };
  ok('digestDateLabel_ julat berjadual -> mula – tamat',
     digestDateLabel_(julat) === 'Rabu, 9 September 2026 – Jumaat, 11 September 2026');

  // Event all-day SATU hari: Calendar hantar end = tengah malam PERMULAAN hari BERIKUT.
  const allDaySatu = { start: new Date(2026, 8, 16, 0, 0).toISOString(),
                       end: new Date(2026, 8, 17, 0, 0).toISOString(), allDay: true };
  ok('digestDateLabel_ all-day SATU hari tak jadi julat palsu (end eksklusif)',
     digestDateLabel_(allDaySatu) === 'Rabu, 16 September 2026');

  const allDayJulat = { start: new Date(2026, 8, 14, 0, 0).toISOString(),
                        end: new Date(2026, 8, 19, 0, 0).toISOString(), allDay: true };
  ok('digestDateLabel_ all-day pelbagai hari tamat pada hari SEBENAR (bukan +1)',
     digestDateLabel_(allDayJulat) === 'Isnin, 14 September 2026 – Jumaat, 18 September 2026');

  ok('digestEndDate_ TIDAK sentuh event berjadual (allDay=false)',
     digestEndDate_(julat).getTime() === new Date(julat.end).getTime());

  ok('isSameCalDay_ hari sama walau jam berbeza',
     isSameCalDay_(new Date(2026, 8, 7, 0, 1), new Date(2026, 8, 7, 23, 59)));
  ok('isSameCalDay_ hari berbeza -> false',
     !isSameCalDay_(new Date(2026, 8, 7, 23, 59), new Date(2026, 8, 8, 0, 1)));

  ok('DIGEST_DAY_MS mula Ahad (padan Date.getDay())',
     DIGEST_DAY_MS[0] === 'Ahad' && DIGEST_DAY_MS[6] === 'Sabtu' && DIGEST_DAY_MS.length === 7);
  ok('DIGEST_MONTH_MS 12 bulan Melayu penuh',
     DIGEST_MONTH_MS.length === 12 && DIGEST_MONTH_MS[0] === 'Januari' && DIGEST_MONTH_MS[11] === 'Disember');
```

- [ ] **Step 2: Jalankan — mesti GAGAL**

```bash
node selftest-node.js; echo "exit=$?"
```

Jangkaan: `exit=1`, ReferenceError `digestDateLabel_`.

- [ ] **Step 3: Tulis pelaksanaan** — dalam `Code.js`, selepas `isoWeekKey_`:

```js
// Nama hari/bulan Melayu ditulis di SINI (bukan formatDate_) sebab
// Utilities.formatDate pulang nama INGGERIS ("Monday, 8 September") mengikut
// locale skrip -- digest pergi kepada ibu bapa & murid, jadi ia mesti Melayu.
// Index (0..) sengaja padan Date.getDay() / Date.getMonth().
const DIGEST_DAY_MS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const DIGEST_MONTH_MS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
                         'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];

function isSameCalDay_(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Google Calendar guna 'end' EKSKLUSIF untuk event sepanjang hari (allDay): tengah
// malam PERMULAAN hari LEPAS event tamat. Tolak 1 saat SEBELUM sebarang pengiraan
// "hari", kalau tidak label julat tersasar +1 hari dan ibu bapa dapat tarikh SALAH.
// Ini SALINAN displayEndDate() dalam Index.html -- runtime BERBEZA (server tak boleh
// panggil fungsi client), jadi salinan ni dipolis oleh ujian kembar dalam
// selftest-node.js yang membaca KEDUA-DUA fail.
function digestEndDate_(e) {
  const end = new Date(e.end);
  return e.allDay ? new Date(end.getTime() - 1000) : end;
}

function digestDateLong_(d) {
  return DIGEST_DAY_MS[d.getDay()] + ', ' + d.getDate() + ' ' +
         DIGEST_MONTH_MS[d.getMonth()] + ' ' + d.getFullYear();
}

// Satu hari -> "Isnin, 7 September 2026". Pelbagai hari -> "mula – tamat" (en-dash,
// padan contoh dalam spec).
function digestDateLabel_(e) {
  const start = new Date(e.start);
  const end = digestEndDate_(e);
  const label = digestDateLong_(start);
  return isSameCalDay_(start, end) ? label : label + ' – ' + digestDateLong_(end);
}
```

- [ ] **Step 4: Tulis ujian KEMBAR merentas fail** — dalam `selftest-node.js`, gantikan komen `// (diisi bermula Task 10)` dengan:

```js
// --- ujian kembar: nama bulan server vs client -------------------------------
// KENAPA: Index.html (client) dan Code.js (server) masing-masing simpan senarai
// bulan Melayu sendiri, sebab dua RUNTIME berbeza. Salinan yang menyimpang senyap
// akan buat digest dan skrin sebut bulan berbeza untuk aktiviti yang SAMA.
(function ujianKembarBulan() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const m = html.match(/const\s+MONTH_LONG_MS\s*=\s*(\[[^\]]*\])/);
  ok('Index.html masih ada MONTH_LONG_MS untuk dibanding', !!m);
  if (!m) return;
  const client = JSON.parse(m[1].replace(/'/g, '"'));
  const api = loadCode(['DIGEST_MONTH_MS']);
  ok('DIGEST_MONTH_MS (server) === MONTH_LONG_MS (client)', eq(api.DIGEST_MONTH_MS, client));
})();

// --- ujian kembar: pembetulan end eksklusif all-day --------------------------
// digestEndDate_ (server) ialah salinan displayEndDate (client). Kalau salah satu
// dibetulkan tanpa satu lagi, tarikh tamat aktiviti all-day akan bercanggah.
(function ujianKembarEndDate() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  ok('Index.html masih tolak 1000ms untuk allDay (displayEndDate)',
     /function displayEndDate\(e\)\{return e\.allDay\?new Date\(new Date\(e\.end\)\.getTime\(\)-1000\)/.test(html));
  const api = loadCode(['digestEndDate_']);
  const ev = { end: new Date(2026, 8, 17, 0, 0).toISOString(), allDay: true };
  ok('digestEndDate_ (server) tolak 1000ms yang sama',
     api.digestEndDate_(ev).getTime() === new Date(2026, 8, 17, 0, 0).getTime() - 1000);
})();
```

- [ ] **Step 5: Jalankan — mesti LULUS**

```bash
node selftest-node.js
node --check Code.js
```

Jangkaan: semua PASS, `0 GAGAL`.

- [ ] **Step 6: Mutation test (tiga mutasi)**

```js
// M1 -- Code.js: buang pembetulan all-day
//   return e.allDay ? new Date(end.getTime() - 1000) : end;  ->  return end;
```
Jangkaan GAGAL: `digestDateLabel_ all-day SATU hari tak jadi julat palsu`, `digestDateLabel_ all-day pelbagai hari tamat pada hari SEBENAR`, `digestEndDate_ (server) tolak 1000ms yang sama`.

```js
// M2 -- Code.js: DIGEST_MONTH_MS[8] 'September' -> 'Sept'
```
Jangkaan GAGAL: `DIGEST_MONTH_MS (server) === MONTH_LONG_MS (client)` **dan** ujian label — bukti ujian kembar benar-benar menghukum penyimpangan.

```js
// M3 -- Code.js: DIGEST_DAY_MS mula 'Isnin' (buang 'Ahad' dari depan, tambah di hujung)
```
Jangkaan GAGAL: `digestDateLabel_ satu hari -> "Isnin, 7 September 2026"`, `DIGEST_DAY_MS mula Ahad`.

Pulih selepas setiap mutasi.

- [ ] **Step 7: Commit**

```bash
node selftest-node.js && node --check Code.js && grep -c $'\r' Code.js selftest-node.js
git add Code.js selftest-node.js
git commit -m "feat(digest): label tarikh Melayu + pembetulan end eksklusif all-day"
```

**Siap bila:** label tarikh betul untuk 4 bentuk event (satu hari berjadual, julat berjadual, all-day satu hari, all-day julat), ujian kembar hijau dan terbukti menggigit.

---

## Task 5: `buildDigestText_` — pembina teks digest (satu format, dipakai kedua-dua sink)

**Files:**
- Modify: `Code.js` — seksyen `DIGEST MINGGUAN`, selepas `digestDateLabel_`; `selfTestDigestHelpers_`

**Interfaces:**
- Consumes: `digestDateLabel_`, `sortByStart_` (sedia ada, baris ~1671).
- Produces: `buildDigestText_(events, cfg) -> string`. `events` = array objek `eventToObject_` yang **sudah ditapis oleh pemanggil** (Task 11 memanggilnya SEKALI PER SINK dengan senarai saluran tersendiri — fungsi ni tidak tahu apa-apa tentang saluran); `cfg` = objek `getConfig_()`.

- [ ] **Step 1: Tulis ujian yang GAGAL dahulu** — tambah dalam `selfTestDigestHelpers_`:

```js
  const cfgUji = { OFFICE_NAME: 'Sekolah Kebangsaan Salor' };
  const evUji = [
    { title: 'Minggu Bahasa', location: 'Dewan Sekolah', allDay: false,
      start: new Date(2026, 8, 9, 8, 0).toISOString(), end: new Date(2026, 8, 11, 17, 0).toISOString(),
      pic: 'Cikgu Ali', agency: 'JPN Kelantan', description: 'nota dalaman rahsia',
      remindTo: ['guru@sekolah.edu.my'], reminderDays: 2, categoryLabel: 'Program' },
    { title: 'Hari Sukan Sekolah', location: 'Padang Sekolah', allDay: false,
      start: new Date(2026, 8, 7, 7, 30).toISOString(), end: new Date(2026, 8, 7, 13, 0).toISOString(),
      pic: '', agency: '', description: '', remindTo: [], reminderDays: 0, categoryLabel: 'Program' },
    { title: 'Gotong-royong Perdana', location: '', allDay: false,
      start: new Date(2026, 8, 12, 8, 0).toISOString(), end: new Date(2026, 8, 12, 12, 0).toISOString(),
      pic: '', agency: '', description: '', remindTo: [], reminderDays: 0, categoryLabel: 'Program' }
  ];
  const teks = buildDigestText_(evUji, cfgUji);

  ok('buildDigestText_ baris pertama tajuk digest',
     teks.split('\n')[0] === '📅 Aktiviti Sekolah — Minggu Ini');
  ok('buildDigestText_ baris kedua OFFICE_NAME', teks.split('\n')[1] === 'Sekolah Kebangsaan Salor');
  ok('buildDigestText_ SUSUN ikut tarikh menaik (bukan susunan input)',
     teks.indexOf('Hari Sukan') < teks.indexOf('Minggu Bahasa') &&
     teks.indexOf('Minggu Bahasa') < teks.indexOf('Gotong-royong'));
  ok('buildDigestText_ setiap aktiviti guna bullet + indent dua ruang',
     teks.indexOf('• Hari Sukan Sekolah\n  Isnin, 7 September 2026 · Padang Sekolah') !== -1);
  ok('buildDigestText_ julat pelbagai hari dipapar penuh',
     teks.indexOf('  Rabu, 9 September 2026 – Jumaat, 11 September 2026 · Dewan Sekolah') !== -1);
  ok('buildDigestText_ lokasi kosong -> em-dash', teks.indexOf('· —') !== -1);
  ok('buildDigestText_ tutup dengan nota automatik',
     teks.indexOf('—\nMesej automatik daripada sistem takwim sekolah. Sila jangan balas.') !== -1);

  // Gerbang KEBOCORAN: audiens ialah ibu bapa & murid di luar domain sekolah.
  ok('buildDigestText_ TIDAK bocorkan PIC/agensi/nota dalaman/penerima',
     teks.indexOf('Cikgu Ali') === -1 && teks.indexOf('JPN Kelantan') === -1 &&
     teks.indexOf('nota dalaman') === -1 && teks.indexOf('guru@sekolah.edu.my') === -1 &&
     teks.indexOf('PIC') === -1 && teks.indexOf('Agensi') === -1);
  ok('buildDigestText_ TIADA markup Telegram/Chat (teks biasa tulen)',
     teks.indexOf('<b>') === -1 && teks.indexOf('**') === -1 && teks.indexOf('_') === -1);

  ok('buildDigestText_ senarai kosong tetap pulang string (caller yang guard)',
     typeof buildDigestText_([], cfgUji) === 'string');
  ok('buildDigestText_ cfg tanpa OFFICE_NAME tak pancarkan "undefined"',
     buildDigestText_(evUji, {}).indexOf('undefined') === -1);
```

- [ ] **Step 2: Jalankan — mesti GAGAL**

```bash
node selftest-node.js; echo "exit=$?"
```

Jangkaan: `exit=1`.

- [ ] **Step 3: Tulis pelaksanaan** — dalam `Code.js`, selepas `digestDateLabel_`:

```js
// Teks BIASA tulen. Satu FORMAT dipakai kedua-dua sink, tetapi fungsi ni dipanggil
// SEKALI PER SINK: pemanggil (sendWeeklyDigest_) yang menapis senarai aktiviti untuk
// saluran berkenaan, jadi kandungan dua mesej memang boleh berbeza. Fungsi ni sendiri
// tidak tahu apa-apa tentang saluran -- itu yang menjadikannya sink-agnostik.
// Tiada HTML, tiada markdown -- markup yang salah pada satu sink akan muncul sebagai
// sampah pada sink satu lagi.
// Kandungan SENGAJA hanya tajuk / tarikh / lokasi. Jangan sesekali tambah PIC,
// agensi, keterangan dalaman atau senarai penerima di sini: penerima ialah group
// ibu bapa dan Space murid, bukan bilik guru.
function buildDigestText_(events, cfg) {
  const lines = [];
  lines.push('📅 Aktiviti Sekolah — Minggu Ini');
  const office = (cfg && cfg.OFFICE_NAME) ? String(cfg.OFFICE_NAME) : '';
  if (office) lines.push(office);
  lines.push('');

  // slice() dulu: jangan susun semula array milik pemanggil.
  events.slice().sort(sortByStart_).forEach(function (e) {
    lines.push('• ' + e.title);
    lines.push('  ' + digestDateLabel_(e) + ' · ' + (e.location ? e.location : '—'));
    lines.push('');
  });

  lines.push('—');
  lines.push('Mesej automatik daripada sistem takwim sekolah. Sila jangan balas.');
  return lines.join('\n');
}
```

- [ ] **Step 4: Jalankan — mesti LULUS**

```bash
node selftest-node.js
node --check Code.js
```

- [ ] **Step 5: Mutation test (dua mutasi)**

```js
// M1 -- bocorkan medan dalaman:
//   lines.push('  ' + digestDateLabel_(e) + ' · ' + (e.location ? e.location : '—'));
//   ->  lines.push('  ' + digestDateLabel_(e) + ' · ' + (e.location || '—') + ' · PIC: ' + e.pic);
```
Jangkaan GAGAL: `buildDigestText_ TIDAK bocorkan PIC/agensi/nota dalaman/penerima`.

```js
// M2 -- buang susunan:  events.slice().sort(sortByStart_)  ->  events.slice()
```
Jangkaan GAGAL: `buildDigestText_ SUSUN ikut tarikh menaik (bukan susunan input)`.

Pulih selepas setiap mutasi.

- [ ] **Step 6: Commit**

```bash
node selftest-node.js && node --check Code.js && grep -c $'\r' Code.js
git add Code.js
git commit -m "feat(digest): buildDigestText_ -- pembina teks biasa untuk kedua-dua sink"
```

**Siap bila:** teks yang dihasilkan padan bentuk contoh spec Seksyen 7 baris demi baris, gerbang kebocoran hijau dan terbukti menggigit.

---

## Task 6: Penanda `Kongsi` dalam `description` event (server)

**Files:**
- Modify: `Code.js` — `eventToObject_` (baris ~1202-1223), `holidayToObject_` (~1164-1182), `buildDescription_` (~1238-1249), `parseDescriptionMeta_` (~1251-1259), `cleanDescription_` (~1283-1291), `selfTestDigestHelpers_`

**Interfaces:**
- Consumes: `parseShareChannels_`, `SHARE_CHANNELS` (Task 3).
- Produces: `buildDescription_` kini tulis baris `Kongsi: tg,gchat` (senarai saluran yang ditanda, susunan kanonik) bila `payload.shareTg === true` dan/atau `payload.shareGchat === true`; `parseDescriptionMeta_` pulang medan tambahan `shareChannels: string[]`; `eventToObject_` dedah `shareChannels: string[]`; `holidayToObject_` dedah `shareChannels: []`.

- [ ] **Step 1: Tulis ujian yang GAGAL dahulu** — tambah dalam `selfTestDigestHelpers_`:

```js
  const descDua = buildDescription_({
    description: 'Perhimpunan bulanan', pic: 'Cikgu Ali', agency: 'PIBG',
    reminderDays: '2', remindTo: ['a@x.com'], shareTg: true, shareGchat: true
  }, 'program');
  ok('buildDescription_ dua saluran -> "Kongsi: tg,gchat"',
     /(?:^|\n)Kongsi: tg,gchat(?:\n|$)/.test(descDua));
  ok('buildDescription_ letak Kongsi SELEPAS RemindTo dan SEBELUM PPD_CATEGORY',
     descDua.indexOf('RemindTo:') < descDua.indexOf('Kongsi:') &&
     descDua.indexOf('Kongsi:') < descDua.indexOf('[PPD_CATEGORY:'));
  ok('buildDescription_ medan LAMA tak terjejas',
     descDua.indexOf('PIC: Cikgu Ali') !== -1 && descDua.indexOf('Agensi: PIBG') !== -1 &&
     descDua.indexOf('Reminder: 2') !== -1 && descDua.indexOf('RemindTo: a@x.com') !== -1);

  const descTg = buildDescription_({ description: 'Sukan', shareTg: true }, 'program');
  const descGchat = buildDescription_({ description: 'Kuiz', shareGchat: true }, 'program');
  ok('buildDescription_ SATU saluran sahaja -> senarai satu nama',
     /(?:^|\n)Kongsi: tg(?:\n|$)/.test(descTg) && /(?:^|\n)Kongsi: gchat(?:\n|$)/.test(descGchat));
  ok('buildDescription_ susunan TETAP tg dahulu walau hanya gchat ditanda dulu',
     buildDescription_({ shareGchat: true, shareTg: true }, 'lain').indexOf('Kongsi: tg,gchat') !== -1);

  ok('parseDescriptionMeta_ round-trip shareChannels dua saluran',
     eq(parseDescriptionMeta_(descDua).shareChannels, ['tg', 'gchat']));
  ok('parseDescriptionMeta_ round-trip satu saluran (tidak bocor ke saluran lain)',
     eq(parseDescriptionMeta_(descTg).shareChannels, ['tg']) &&
     eq(parseDescriptionMeta_(descGchat).shareChannels, ['gchat']));
  ok('parseDescriptionMeta_ medan lama masih round-trip selepas Kongsi ditambah',
     parseDescriptionMeta_(descDua).pic === 'Cikgu Ali' &&
     parseDescriptionMeta_(descDua).reminderDays === 2 &&
     eq(parseDescriptionMeta_(descDua).remindTo, ['a@x.com']));

  const descTiada = buildDescription_({ description: 'Mesyuarat panitia', pic: 'Cikgu Siti' }, 'mesyuarat');
  ok('buildDescription_ TIADA baris Kongsi bila tiada checkbox ditanda (lalai OFF)',
     descTiada.indexOf('Kongsi') === -1);
  ok('parseDescriptionMeta_ tiada baris Kongsi -> []',
     eq(parseDescriptionMeta_(descTiada).shareChannels, []));
  ok('buildDescription_ nilai palsu-truthy dari client TIDAK menghidupkan saluran',
     buildDescription_({ shareTg: 'false' }, 'lain').indexOf('Kongsi') === -1 &&
     buildDescription_({ shareGchat: 1 }, 'lain').indexOf('Kongsi') === -1 &&
     buildDescription_({ shareTg: 'tg' }, 'lain').indexOf('Kongsi') === -1);

  // Kalau cleanDescription_ tak buang baris ni, penanda akan muncul dalam kotak
  // KETERANGAN bila guru edit, kemudian ditulis semula sebagai teks biasa --
  // penanda berganda, dan aktiviti kekal "dikongsi" walau checkbox dibuang.
  ok('cleanDescription_ buang baris Kongsi dari paparan',
     cleanDescription_(descDua).indexOf('Kongsi') === -1 &&
     cleanDescription_(descDua) === 'Perhimpunan bulanan');
  ok('round-trip PENUH: tanda dua -> baca -> bina semula tanpa saluran -> tidak lagi dikongsi',
     (function () {
       const meta = parseDescriptionMeta_(descDua);
       const semula = buildDescription_({
         description: cleanDescription_(descDua), pic: meta.pic, agency: meta.agency,
         reminderDays: meta.reminderDays, remindTo: meta.remindTo,
         shareTg: false, shareGchat: false
       }, 'program');
       return eq(parseDescriptionMeta_(semula).shareChannels, []) && semula.indexOf('Kongsi') === -1;
     })());
  ok('round-trip SEPARA: buang satu saluran sahaja, satu lagi KEKAL',
     (function () {
       const meta = parseDescriptionMeta_(descDua);
       const semula = buildDescription_({
         description: cleanDescription_(descDua), pic: meta.pic,
         shareTg: false, shareGchat: true
       }, 'program');
       return eq(parseDescriptionMeta_(semula).shareChannels, ['gchat']);
     })());
```

- [ ] **Step 2: Jalankan — mesti GAGAL**

```bash
node selftest-node.js; echo "exit=$?"
```

Jangkaan: `exit=1` (`parseDescriptionMeta_(...).shareChannels` masih `undefined`).

- [ ] **Step 3: `buildDescription_`** — tambah SELEPAS blok `remindTo`, SEBELUM `parts.push('[PPD_CATEGORY:...`:

```js
  // Penanda perkongsian: SENARAI saluran yang aktiviti ni dibenarkan keluar.
  // Dua checkbox BEBAS di borang -- guru boleh hantar ke Telegram sahaja, Chat
  // sahaja, atau kedua-dua. Susunan TETAP (tg dahulu) supaya baris kanonik.
  // Perbandingan === true (bukan truthy) supaya string 'false' atau nombor 1 dari
  // client tak tersalah menghidupkan saluran KELUAR domain sekolah.
  const saluran = [];
  if (payload.shareTg === true) saluran.push('tg');
  if (payload.shareGchat === true) saluran.push('gchat');
  if (saluran.length) parts.push('Kongsi: ' + saluran.join(','));
```

- [ ] **Step 4: `parseDescriptionMeta_`** — tukar baris `return`:

```js
  return {
    pic: pic, agency: agency, reminderDays: reminderDays, remindTo: remindTo,
    shareChannels: parseShareChannels_(description)
  };
```

- [ ] **Step 5: `cleanDescription_`** — tambah satu `.replace` selepas baris `RemindTo`:

```js
    .replace(/\n?Kongsi:\s*.+/ig, '')
```

- [ ] **Step 6: `eventToObject_`** — tambah selepas `agency: meta.agency,`:

```js
    agency: meta.agency,
    shareChannels: meta.shareChannels
```

- [ ] **Step 7: `holidayToObject_`** — tambah selepas `agency: '',`:

```js
    agency: '',
    // Cuti Google datang dari kalendar LUAR yang kita tak boleh tanda. Bentuk objek
    // kekal sama dengan eventToObject_ sebab dashboard gabungkan dua senarai ni --
    // dan penapis saluran dalam sendWeeklyDigest_ memanggil .indexOf() terus atas
    // medan ni, jadi ia mesti array, bukan undefined.
    shareChannels: [],
```

- [ ] **Step 8: Jalankan — mesti LULUS**

```bash
node selftest-node.js
node --check Code.js
```

- [ ] **Step 9: Mutation test (tiga mutasi)**

```js
// M1 -- terima truthy:  if (payload.shareTg === true)  ->  if (payload.shareTg)
```
Jangkaan GAGAL: `buildDescription_ nilai palsu-truthy dari client TIDAK menghidupkan saluran`.

```js
// M2 -- buang pembersihan paparan: ganti baris .replace(/\n?Kongsi:\s*.+/ig, '')
//        dengan komen yang menamakannya (jangan padam sunyi)
```
Jangkaan GAGAL: `cleanDescription_ buang baris Kongsi dari paparan`, `round-trip PENUH...`, `round-trip SEPARA...`.
**Ini mutasi yang spec Seksyen 10 tuntut secara eksplisit** — kalau ia tidak gagal, ujian tidak menanggung beban dan kebocoran penanda ke kotak Keterangan akan lolos.

```js
// M3 -- salah susunan: alihkan `if (saluran.length) parts.push('Kongsi: ' + ...)`
//        ke BAWAH parts.push('[PPD_CATEGORY:...')
```
Jangkaan GAGAL: `buildDescription_ letak Kongsi SELEPAS RemindTo dan SEBELUM PPD_CATEGORY`.

```js
// M4 -- silang saluran masa TULIS:
//   if (payload.shareTg === true) saluran.push('tg');  ->  ... saluran.push('gchat');
//   if (payload.shareGchat === true) saluran.push('gchat');  ->  ... saluran.push('tg');
```
Jangkaan GAGAL: `buildDescription_ SATU saluran sahaja -> senarai satu nama`, `parseDescriptionMeta_ round-trip satu saluran (tidak bocor ke saluran lain)`, `round-trip SEPARA...`.

Pulih selepas setiap mutasi.

- [ ] **Step 10: Commit**

```bash
node selftest-node.js && node --check Code.js && grep -c $'\r' Code.js
git add Code.js
git commit -m "feat(digest): penanda saluran Kongsi dalam description event + medan shareChannels"
```

**Siap bila:** penanda round-trip penuh DAN separa (buang satu saluran, satu lagi kekal), semua ujian reminder LAMA masih hijau, empat mutasi terbukti gagal.

---

## Task 7: Dua checkbox saluran dalam borang aktiviti + lencana dalam modal detail

Tiada DOM runtime untuk diuji, jadi gerbang task ni ialah **ujian bentuk sumber** yang membaca `Index.html`. Dua perangkap yang mesti dielak: ujian sumber boleh dipuaskan oleh KOMEN, dan tetingkap hirisan boleh terlimpah ke fungsi jiran. Helper `sliceBody()` di Step 1 menangani kedua-duanya.

**Files:**
- Modify: `Index.html` — borang aktiviti (baris ~262-282), `renderDetail` (~906), `editEvent` (~840), `saveEventUI` (~841-842), `resetEventForm` (~897)
- Modify: `selftest-node.js` — ujian bentuk sumber

**Interfaces:**
- Consumes: medan `shareChannels` (array) pada objek event dari `eventToObject_` (Task 6).
- Produces: elemen `#eventShareTg` + `#eventShareGchat` (dua checkbox bebas); helper `shareBadge(e)`; `saveEventUI` hantar `shareTg: eventShareTg.checked` dan `shareGchat: eventShareGchat.checked` dalam payload ke `createCalendarEvent`/`updateCalendarEvent`.

- [ ] **Step 1: Tambah helper hirisan + ujian yang GAGAL** — dalam `selftest-node.js`, sebelum blok laporan:

```js
// --- ujian bentuk sumber Index.html -----------------------------------------
// KENAPA bukan ujian DOM: projek ni tiada framework ujian browser. Yang kita boleh
// hukum ialah BENTUK kod client. Dua perangkap dielak di sini:
//  1. Komen boleh memuaskan ujian sumber -> komen dibuang SEBELUM padanan.
//  2. Tetingkap hirisan boleh terlimpah ke fungsi JIRAN -> sliceBody() menuntut
//     penanda mula yang UNIK, dan meletup kalau ia muncul 0 atau >1 kali.
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
function sliceBody(src, startMarker, endMarker) {
  const clean = stripComments(src);
  const parts = clean.split(startMarker);
  if (parts.length !== 2) {
    throw new Error('sliceBody: penanda mula TIDAK unik (' + (parts.length - 1) + ' padanan): ' + startMarker);
  }
  const rest = parts[1];
  const end = rest.indexOf(endMarker);
  if (end === -1) throw new Error('sliceBody: penanda tamat tak jumpa: ' + endMarker);
  return rest.slice(0, end);
}

(function ujianBorangKongsi() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const bersih = stripComments(html);

  ok('borang aktiviti ada DUA checkbox saluran',
     /<input[^>]+id="eventShareTg"[^>]+type="checkbox"|<input[^>]+type="checkbox"[^>]+id="eventShareTg"/.test(bersih) &&
     /<input[^>]+id="eventShareGchat"[^>]+type="checkbox"|<input[^>]+type="checkbox"[^>]+id="eventShareGchat"/.test(bersih));
  ok('label checkbox RINGKAS -- tiada "(ibu bapa)" / "(murid)" (keputusan master Rev.1)',
     bersih.indexOf('Kongsi ke Telegram') !== -1 && bersih.indexOf('Kongsi ke Google Chat') !== -1 &&
     bersih.indexOf('(ibu bapa)') === -1 && bersih.indexOf('(murid)') === -1);

  const save = sliceBody(html, 'function saveEventUI(btn){', '\nfunction ');
  ok('saveEventUI hantar DUA bendera saluran dari checkbox masing-masing',
     /shareTg\s*:\s*eventShareTg\.checked/.test(save) &&
     /shareGchat\s*:\s*eventShareGchat\.checked/.test(save));

  const edit = sliceBody(html, 'function editEvent(){', '\nfunction ');
  ok('editEvent pulihkan KEDUA-DUA checkbox dari shareChannels',
     /eventShareTg\.checked\s*=\s*\(selectedEvent\.shareChannels\|\|\[\]\)\.indexOf\('tg'\)\s*!==\s*-1/.test(edit) &&
     /eventShareGchat\.checked\s*=\s*\(selectedEvent\.shareChannels\|\|\[\]\)\.indexOf\('gchat'\)\s*!==\s*-1/.test(edit));

  // Perangkap SEBENAR: resetEventForm hanya kosongkan .value dalam satu gelung, jadi
  // checkbox TIDAK tersentuh. Tanpa baris reset eksplisit, tanda dari aktiviti
  // sebelumnya melekat -- aktiviti peribadi tersiar ke group ibu bapa.
  const reset = sliceBody(html, 'function resetEventForm(){', '\nfunction ');
  ok('resetEventForm nyahtanda KEDUA-DUA checkbox secara EKSPLISIT',
     /eventShareTg\.checked\s*=\s*false/.test(reset) && /eventShareGchat\.checked\s*=\s*false/.test(reset));

  const detail = sliceBody(html, 'function renderDetail(){', '\nfunction ');
  ok('renderDetail panggil lencana perkongsian', /shareBadge\(e\)/.test(detail));

  const badge = sliceBody(html, 'function shareBadge(e){', '\nfunction ');
  ok('shareBadge namakan saluran secara berasingan (TG / Chat / kedua-dua)',
     /indexOf\('tg'\)/.test(badge) && /indexOf\('gchat'\)/.test(badge) &&
     badge.indexOf('Telegram') !== -1 && badge.indexOf('Google Chat') !== -1);
})();
```

- [ ] **Step 2: Jalankan — mesti GAGAL**

```bash
node selftest-node.js; echo "exit=$?"
```

Jangkaan: tujuh FAIL baharu, `exit=1`.

- [ ] **Step 3: Tambah dua checkbox dalam borang** — dalam `Index.html`, SELEPAS medan `AGENSI` (baris ~281), sebelum medan `KETERANGAN`:

```html
      <div class="field wide"><label>KONGSI DALAM DIGEST MINGGUAN</label><div style="display:flex;gap:16px;flex-wrap:wrap"><label style="font-weight:normal;font-size:14px;letter-spacing:normal;color:#1e293b"><input id="eventShareTg" type="checkbox" style="width:auto;margin-right:7px">Kongsi ke Telegram</label><label style="font-weight:normal;font-size:14px;letter-spacing:normal;color:#1e293b"><input id="eventShareGchat" type="checkbox" style="width:auto;margin-right:7px">Kongsi ke Google Chat</label></div><div class="eventSub">Boleh pilih satu atau kedua-dua. Hanya tajuk, tarikh dan lokasi dihantar keluar — PIC, agensi dan keterangan dalaman tidak pernah dikongsi.</div></div>
```

- [ ] **Step 4: `saveEventUI`** — tambah dua medan pada objek `p` (hujung, sebelum `}`):

```js
description:eventDescription.value.trim(),shareTg:eventShareTg.checked,shareGchat:eventShareGchat.checked};
```

- [ ] **Step 5: `editEvent`** — tambah sebelum `setRemindToUI(selectedEvent.remindTo);`:

```js
eventShareTg.checked=(selectedEvent.shareChannels||[]).indexOf('tg')!==-1;eventShareGchat.checked=(selectedEvent.shareChannels||[]).indexOf('gchat')!==-1;
```

- [ ] **Step 6: `resetEventForm`** — tambah di hujung fungsi (selepas `eventReminder.value='0'`):

```js
;eventShareTg.checked=false;eventShareGchat.checked=false
```

Bentuk akhir fungsi:

```js
function resetEventForm(){eventFormTitle.textContent='Tambah Aktiviti';['eventId','eventTitle','eventLocation','eventPic','eventAgency','eventDescription'].forEach(id=>document.getElementById(id).value='');eventCategory.value='program';eventReminder.value='0';eventShareTg.checked=false;eventShareGchat.checked=false}
```

- [ ] **Step 7: Lencana dalam modal detail**

Tambah helper baharu TEPAT SELEPAS `function renderDetail(){...}` (jangan letak dalam fungsi lain — ujian menghiris badan `shareBadge` dengan penanda uniknya sendiri):

```js
// Lencana saluran untuk modal detail. Menamakan saluran satu-satu supaya guru nampak
// aktiviti ni pergi ke MANA -- bukan sekadar "dikongsi". Tiada saluran -> tiada lencana.
function shareBadge(e){const c=e.shareChannels||[];const n=[];if(c.indexOf('tg')!==-1)n.push('Telegram');if(c.indexOf('gchat')!==-1)n.push('Google Chat');return n.length?'<br>📣 Dikongsi: '+n.join(' + '):''}
```

Kemudian dalam template literal `renderDetail`, tambah selepas bahagian lokasi dalam blok `<div class="notice">`:

```js
${e.location?'<br>📍 '+esc(e.location):''}${shareBadge(e)}
```

- [ ] **Step 8: Jalankan — mesti LULUS**

```bash
node selftest-node.js
grep -c $'\r' Index.html
```

- [ ] **Step 9: Mutation test (dua mutasi)**

```js
// M1 -- Index.html: buang SATU baris reset sahaja (;eventShareGchat.checked=false)
//        dari resetEventForm -- separuh pembetulan ialah kegagalan yang paling mungkin
```
Jangkaan GAGAL: `resetEventForm nyahtanda KEDUA-DUA checkbox secara EKSPLISIT`.

```js
// M2 -- Index.html: ganti baris reset itu dengan KOMEN sahaja:
//   // eventShareGchat.checked=false
// Ini membuktikan ujian sumber tidak boleh dipuaskan oleh komen.
```
Jangkaan GAGAL: ujian yang sama mesti tetap GAGAL. Kalau ia LULUS, `stripComments` rosak — betulkan sebelum teruskan.

```js
// M3 -- Index.html: silang saluran dalam editEvent:
//   eventShareTg.checked=(selectedEvent.shareChannels||[]).indexOf('gchat')!==-1;
```
Jangkaan GAGAL: `editEvent pulihkan KEDUA-DUA checkbox dari shareChannels`.

Pulih selepas setiap mutasi (`git checkout -- Index.html`).

- [ ] **Step 10: Commit**

```bash
node selftest-node.js && grep -c $'\r' Index.html selftest-node.js
git add Index.html selftest-node.js
git commit -m "feat(ui): dua checkbox saluran dalam borang aktiviti + lencana modal detail"
```

**Siap bila:** tujuh ujian bentuk hijau, mutasi komen terbukti masih gagal, `grep -c $'\r' Index.html` = 0.

---

## Task 8: `weekDayEnum_` + `syncDigestTrigger_` + `installDigestTrigger_`

**Files:**
- Modify: `Code.js` — seksyen `DIGEST MINGGUAN`, selepas `buildDigestText_`
- Modify: `selftest-node.js` — ujian trigger dengan `ScriptApp` palsu

**Interfaces:**
- Consumes: `clampDigestHour_`, `clampDigestDay_`, `clampMinute_` (Task 2).
- Produces: `weekDayEnum_(n) -> ScriptApp.WeekDay.*`; `syncDigestTrigger_(day, hour, minute) -> void`; `installDigestTrigger_() -> string`.

- [ ] **Step 1: Tulis ujian yang GAGAL dahulu** — dalam `selftest-node.js`, selepas blok ujian borang:

```js
// --- trigger digest (perlu ScriptApp palsu) ----------------------------------
(function ujianSyncDigestTrigger() {
  const dipadam = [];
  const dibina = [];
  function builder(fn) {
    const b = {
      timeBased: function () { return b; },
      onWeekDay: function (d) { dibina.push(['onWeekDay', d]); return b; },
      atHour: function (h) { dibina.push(['atHour', h]); return b; },
      nearMinute: function (m) { dibina.push(['nearMinute', m]); return b; },
      create: function () { dibina.push(['create', fn]); return b; }
    };
    return b;
  }
  const triggerPalsu = function (name) {
    return { getHandlerFunction: function () { return name; } };
  };
  const ScriptAppPalsu = {
    WeekDay: { SUNDAY: 'SUN', MONDAY: 'MON', TUESDAY: 'TUE', WEDNESDAY: 'WED',
               THURSDAY: 'THU', FRIDAY: 'FRI', SATURDAY: 'SAT' },
    getProjectTriggers: function () {
      return [triggerPalsu('sendWeeklyDigest_'), triggerPalsu('sendActivityReminders_'),
              triggerPalsu('sendWeeklyDigest_')];
    },
    deleteTrigger: function (t) { dipadam.push(t.getHandlerFunction()); },
    newTrigger: function (fn) { return builder(fn); }
  };

  const api = loadCode(['syncDigestTrigger_', 'weekDayEnum_'], { ScriptApp: ScriptAppPalsu });

  ok('weekDayEnum_ 0..6 -> Ahad..Sabtu',
     api.weekDayEnum_(0) === 'SUN' && api.weekDayEnum_(3) === 'WED' && api.weekDayEnum_(6) === 'SAT');
  ok('weekDayEnum_ luar julat / sampah -> Ahad',
     api.weekDayEnum_(7) === 'SUN' && api.weekDayEnum_(-1) === 'SUN' && api.weekDayEnum_('x') === 'SUN');

  api.syncDigestTrigger_(1, 7, 45);
  ok('syncDigestTrigger_ padam SEMUA trigger digest lama (2 daripada 3)',
     eq(dipadam, ['sendWeeklyDigest_', 'sendWeeklyDigest_']));
  ok('syncDigestTrigger_ TIDAK sentuh trigger reminder', dipadam.indexOf('sendActivityReminders_') === -1);
  ok('syncDigestTrigger_ bina satu trigger mingguan ikut hari/jam/minit',
     eq(dibina, [['onWeekDay', 'MON'], ['atHour', 7], ['nearMinute', 45], ['create', 'sendWeeklyDigest_']]));

  // Nilai rosak dari client tak boleh meletupkan pembinaan trigger.
  dibina.length = 0;
  api.syncDigestTrigger_('x', 99, 'y');
  ok('syncDigestTrigger_ pagar nilai rosak -> Ahad / 23 / lalai minit',
     eq(dibina, [['onWeekDay', 'SUN'], ['atHour', 23], ['nearMinute', 45], ['create', 'sendWeeklyDigest_']]));
})();
```

- [ ] **Step 2: Jalankan — mesti GAGAL**

```bash
node selftest-node.js; echo "exit=$?"
```

- [ ] **Step 3: Tulis pelaksanaan** — dalam `Code.js`, selepas `buildDigestText_`:

```js
// 0..6 -> ScriptApp.WeekDay.SUNDAY..SATURDAY. Luar julat / sampah -> Ahad (lalai
// spec). Tidak boleh jadi jadual pemalar di peringkat fail: ScriptApp.WeekDay
// hanya wujud pada runtime Apps Script.
function weekDayEnum_(n) {
  const days = [ScriptApp.WeekDay.SUNDAY, ScriptApp.WeekDay.MONDAY, ScriptApp.WeekDay.TUESDAY,
                ScriptApp.WeekDay.WEDNESDAY, ScriptApp.WeekDay.THURSDAY, ScriptApp.WeekDay.FRIDAY,
                ScriptApp.WeekDay.SATURDAY];
  return days[clampDigestDay_(n)];
}

// Padam SEMUA trigger sendWeeklyDigest_ sedia ada, cipta SATU baharu. Idempotent --
// selamat dipanggil berkali-kali, tak akan bertambah trigger. Dipanggil AUTOMATIK
// oleh installSystem()/updateSystemSettings() setiap kali System Settings disimpan,
// corak sama syncReminderTrigger_.
// nearMinute() = tetingkap +-15 minit, BUKAN masa tepat -- ini had Apps Script,
// diterima untuk digest mingguan.
function syncDigestTrigger_(day, hour, minute) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendWeeklyDigest_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendWeeklyDigest_').timeBased()
    .onWeekDay(weekDayEnum_(day))
    .atHour(clampDigestHour_(hour))
    .nearMinute(clampMinute_(minute))
    .create();
}

// Bootstrap MANUAL dari Apps Script Editor (Run) -- untuk reset trigger tanpa
// menyimpan System Settings, atau untuk sistem yang sudah dipasang sebelum ciri ni
// wujud. Cermin installReminderTrigger_.
function installDigestTrigger_() {
  const cfg = getConfig_();
  syncDigestTrigger_(cfg.DIGEST_DAY, cfg.DIGEST_HOUR, cfg.DIGEST_MINUTE);
  return 'Trigger digest direset -- ' + DIGEST_DAY_MS[clampDigestDay_(cfg.DIGEST_DAY)] + ' lebih kurang ' +
         String(clampDigestHour_(cfg.DIGEST_HOUR)).padStart(2, '0') + ':' +
         String(clampMinute_(cfg.DIGEST_MINUTE)).padStart(2, '0') + '.';
}
```

- [ ] **Step 4: Jalankan — mesti LULUS**

```bash
node selftest-node.js
node --check Code.js
```

- [ ] **Step 5: Mutation test (dua mutasi)**

```js
// M1 -- padam trigger yang SALAH:
//   if (t.getHandlerFunction() === 'sendWeeklyDigest_')  ->  if (true)
```
Jangkaan GAGAL: `syncDigestTrigger_ TIDAK sentuh trigger reminder`, `syncDigestTrigger_ padam SEMUA trigger digest lama (2 daripada 3)`.

```js
// M2 -- buang pagar hari:  return days[clampDigestDay_(n)];  ->  return days[n];
```
Jangkaan GAGAL: `weekDayEnum_ luar julat / sampah -> Ahad`, `syncDigestTrigger_ pagar nilai rosak`.

Pulih selepas setiap mutasi.

- [ ] **Step 6: Commit**

```bash
node selftest-node.js && node --check Code.js && grep -c $'\r' Code.js
git add Code.js selftest-node.js
git commit -m "feat(digest): weekDayEnum_ + syncDigestTrigger_ + installDigestTrigger_"
```

**Siap bila:** trigger digest dibina dengan hari/jam/minit yang betul, trigger reminder terbukti tidak tersentuh, dua mutasi terbukti gagal.

---

## Task 9: Plumbing tetapan — validasi, gerbang write-only, gabungan, trigger

Task paling berbahaya dalam plan. `validateSetupInput_` ialah PENAPIS: apa-apa kunci yang tidak dikeluarkannya akan jatuh balik ke `DEFAULT_CONFIG` pada SETIAP simpanan tetapan. Kalau enam kunci baharu tidak ditambah di situ, token dan chat_id master akan lenyap secara SENYAP setiap kali dia tekan "Simpan Tetapan".

**Files:**
- Modify: `Code.js` — `validateSetupInput_` (~59-96), `installSystem` (~137-164), `getSystemSettings` (~166-183), `updateSystemSettings` (~185-211); fungsi tulen baharu diletak TEPAT SELEPAS `validateSetupInput_`
- Modify: `selftest-node.js` — ujian gerbang write-only

**Interfaces:**
- Consumes: `parseCsvList_`, `clampDigest*`/`clampMinute_`, `syncDigestTrigger_`.
- Produces: `projectSystemSettings_(cfg) -> object` (bentuk yang dihantar ke client); `mergeSettingsInput_(input, current) -> object` (input untuk `validateSetupInput_`); `validateSetupInput_` kini pulang 6 kunci tambahan; `getSystemSettings` pulang `broadcastTgChatIds`, `broadcastTgTokenSet`, `broadcastGchatSet`, `broadcastGchatCount`, `digestDay`, `digestHour`, `digestMinute`.

- [ ] **Step 1: Tulis ujian yang GAGAL dahulu** — tambah dalam `selfTestDigestHelpers_` (fungsi tulen, tiada sesi diperlukan):

```js
  function inputAsas(extra) {
    return Object.assign({
      appName: 'Takwim', officeName: 'SK Salor', shortName: 'SKS',
      timezone: 'Asia/Kuala_Lumpur', calendarId: 'x@group.calendar.google.com',
      adminEmail: 'admin@sekolah.edu.my', themeColor: '#0b6ef3'
    }, extra || {});
  }
  const TOKEN_UJI = '123456789:AAHdqTcvbXcvbXcvbXcvbXcvbXcvbXcvbXc';
  const HOOK_UJI = 'https://chat.googleapis.com/v1/spaces/AAQZxK/messages?key=K&token=T';

  const cfgV = validateSetupInput_(inputAsas({
    broadcastTgToken: TOKEN_UJI, broadcastTgChatIds: '-1001234567890, -1009876543210',
    broadcastGchatWebhooks: HOOK_UJI, digestDay: 1, digestHour: 6, digestMinute: 30
  }));
  ok('validateSetupInput_ SIMPAN 6 kunci broadcast (kalau tidak, ia dipadam setiap simpanan)',
     cfgV.BROADCAST_TG_TOKEN === TOKEN_UJI &&
     cfgV.BROADCAST_TG_CHAT_IDS === '-1001234567890,-1009876543210' &&
     cfgV.BROADCAST_GCHAT_WEBHOOKS === HOOK_UJI &&
     cfgV.DIGEST_DAY === 1 && cfgV.DIGEST_HOUR === 6 && cfgV.DIGEST_MINUTE === 30);
  ok('validateSetupInput_ tanpa medan broadcast -> lalai kosong (tak meletup)',
     validateSetupInput_(inputAsas()).BROADCAST_TG_TOKEN === '' &&
     validateSetupInput_(inputAsas()).DIGEST_DAY === DEFAULT_CONFIG.DIGEST_DAY);

  function ralat(fn) { try { fn(); return ''; } catch (e) { return e.message; } }

  const rTok = ralat(function () { validateSetupInput_(inputAsas({ broadcastTgToken: 'bukan-token' })); });
  ok('validateSetupInput_ TOLAK token bentuk salah', rTok.indexOf('Token bot Telegram') !== -1);
  ok('mesej ralat token TIDAK memuatkan token itu sendiri (repo PUBLIC, toast UI)',
     ralat(function () { validateSetupInput_(inputAsas({ broadcastTgToken: 'rahsia123:XX' })); })
       .indexOf('rahsia123') === -1);
  ok('validateSetupInput_ TERIMA token sah (ujian berpasangan: tolak DAN terima)',
     validateSetupInput_(inputAsas({ broadcastTgToken: TOKEN_UJI })).BROADCAST_TG_TOKEN === TOKEN_UJI);

  ok('validateSetupInput_ TOLAK chat_id bukan nombor/@username',
     ralat(function () { validateSetupInput_(inputAsas({ broadcastTgChatIds: '-100123, bukan-id' })); })
       .indexOf('chat_id') !== -1);
  ok('validateSetupInput_ TERIMA chat_id negatif dan @username',
     validateSetupInput_(inputAsas({ broadcastTgChatIds: '-1001234567890, @takwimsks' }))
       .BROADCAST_TG_CHAT_IDS === '-1001234567890,@takwimsks');

  ok('validateSetupInput_ TOLAK webhook bukan hos chat.googleapis.com',
     ralat(function () { validateSetupInput_(inputAsas({ broadcastGchatWebhooks: 'https://jahat.example.com/x' })); })
       .indexOf('webhook Google Chat') !== -1);
  ok('mesej ralat webhook TIDAK memuatkan URL (URL bawa kunci rahsia)',
     ralat(function () { validateSetupInput_(inputAsas({ broadcastGchatWebhooks: 'https://jahat.example.com/?key=RAHSIA' })); })
       .indexOf('RAHSIA') === -1);
  ok('validateSetupInput_ TERIMA webhook Google Chat sah',
     validateSetupInput_(inputAsas({ broadcastGchatWebhooks: HOOK_UJI })).BROADCAST_GCHAT_WEBHOOKS === HOOK_UJI);

  // --- gerbang write-only ---
  const cfgPenuh = Object.assign({}, DEFAULT_CONFIG, {
    OFFICE_NAME: 'SK Salor', BROADCAST_TG_TOKEN: TOKEN_UJI,
    BROADCAST_TG_CHAT_IDS: '-100123', BROADCAST_GCHAT_WEBHOOKS: HOOK_UJI
  });
  const keluar = projectSystemSettings_(cfgPenuh);
  ok('projectSystemSettings_ TIDAK pernah pulangkan token/webhook mentah',
     JSON.stringify(keluar).indexOf(TOKEN_UJI) === -1 && JSON.stringify(keluar).indexOf(HOOK_UJI) === -1 &&
     JSON.stringify(keluar).indexOf('AAQZxK') === -1);
  ok('projectSystemSettings_ pulangkan BENDERA, bukan nilai',
     keluar.broadcastTgTokenSet === true && keluar.broadcastGchatSet === true && keluar.broadcastGchatCount === 1);
  ok('projectSystemSettings_ bendera false bila belum diset',
     projectSystemSettings_(DEFAULT_CONFIG).broadcastTgTokenSet === false &&
     projectSystemSettings_(DEFAULT_CONFIG).broadcastGchatSet === false);
  ok('projectSystemSettings_ chat_id BUKAN rahsia -- dipulangkan supaya admin nampak sasaran',
     keluar.broadcastTgChatIds === '-100123');
  ok('projectSystemSettings_ kekalkan medan tetapan sedia ada',
     keluar.appName === DEFAULT_CONFIG.APP_NAME && keluar.reminderHour === DEFAULT_CONFIG.REMINDER_HOUR);

  // --- gabungan write-only ---
  const gab1 = mergeSettingsInput_({ appName: 'Takwim' }, cfgPenuh);
  ok('mergeSettingsInput_ medan rahsia KOSONG -> KEKALKAN nilai lama',
     gab1.broadcastTgToken === TOKEN_UJI && gab1.broadcastGchatWebhooks === HOOK_UJI);
  const gab2 = mergeSettingsInput_({ broadcastTgToken: '   ' }, cfgPenuh);
  ok('mergeSettingsInput_ ruang kosong DIKIRA kosong (bukan token baharu)',
     gab2.broadcastTgToken === TOKEN_UJI);
  const gab3 = mergeSettingsInput_({ broadcastTgToken: 'token-baharu' }, cfgPenuh);
  ok('mergeSettingsInput_ nilai baharu MENGGANTI yang lama', gab3.broadcastTgToken === 'token-baharu');
  const gab4 = mergeSettingsInput_({ clearTgToken: true, clearGchatWebhooks: true }, cfgPenuh);
  ok('mergeSettingsInput_ checkbox padam -> kosongkan rahsia',
     gab4.broadcastTgToken === '' && gab4.broadcastGchatWebhooks === '');
  const gab5 = mergeSettingsInput_({ broadcastTgChatIds: '' }, cfgPenuh);
  ok('mergeSettingsInput_ chat_id BUKAN rahsia -- kosong bermakna PADAM',
     gab5.broadcastTgChatIds === '');
  const gab6 = mergeSettingsInput_({}, cfgPenuh);
  ok('mergeSettingsInput_ tanpa input digest -> kekalkan jadual semasa',
     gab6.digestDay === cfgPenuh.DIGEST_DAY && gab6.digestHour === cfgPenuh.DIGEST_HOUR &&
     gab6.digestMinute === cfgPenuh.DIGEST_MINUTE);
  ok('mergeSettingsInput_ digestDay=0 (Ahad) TIDAK dianggap kosong',
     mergeSettingsInput_({ digestDay: 0 }, Object.assign({}, cfgPenuh, { DIGEST_DAY: 3 })).digestDay === 0);
```

- [ ] **Step 2: Jalankan — mesti GAGAL**

```bash
node selftest-node.js; echo "exit=$?"
```

- [ ] **Step 3: Tambah 6 kunci ke `validateSetupInput_`** — dalam objek `cfg`, selepas baris `REMINDER_HOUR: ...` (tambah koma pada baris itu):

```js
    REMINDER_HOUR: clampReminderHour_(input.reminderHour !== undefined ? input.reminderHour : DEFAULT_CONFIG.REMINDER_HOUR),
    // AWAS: fungsi ni ialah PENAPIS. Kunci yang tak disenaraikan di sini akan
    // jatuh balik ke DEFAULT_CONFIG pada SETIAP simpanan System Settings --
    // iaitu token & chat_id admin lenyap tanpa sebarang mesej.
    BROADCAST_TG_TOKEN: String(input.broadcastTgToken || '').trim(),
    BROADCAST_TG_CHAT_IDS: parseCsvList_(input.broadcastTgChatIds).slice(0, 20).join(','),
    BROADCAST_GCHAT_WEBHOOKS: parseCsvList_(input.broadcastGchatWebhooks).slice(0, 10).join(','),
    DIGEST_DAY: clampDigestDay_(input.digestDay !== undefined ? input.digestDay : DEFAULT_CONFIG.DIGEST_DAY),
    DIGEST_HOUR: clampDigestHour_(input.digestHour !== undefined ? input.digestHour : DEFAULT_CONFIG.DIGEST_HOUR),
    DIGEST_MINUTE: clampMinute_(input.digestMinute !== undefined ? input.digestMinute : DEFAULT_CONFIG.DIGEST_MINUTE)
```

- [ ] **Step 4: Tambah validasi** — dalam `validateSetupInput_`, sebelum `return cfg;`:

```js
  // Bentuk token @BotFather: "<digit>:<rentetan>". Kita semak BENTUK sahaja (sah/tidak
  // hanya Telegram yang tahu). Mesej ralat TIDAK PERNAH mengulang token: ia berakhir
  // dalam toast UI dan mungkin dalam log.
  if (cfg.BROADCAST_TG_TOKEN && !/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(cfg.BROADCAST_TG_TOKEN)) {
    throw new Error('Token bot Telegram tidak sah. Bentuk sepatutnya: 123456789:AA...(35 aksara).');
  }
  // chat_id group ialah nombor (biasanya NEGATIF); channel awam boleh guna @username.
  // Menolak apa-apa yang lain menangkap ralat tampal biasa (tampal JSON penuh getUpdates).
  const idRosak = parseCsvList_(cfg.BROADCAST_TG_CHAT_IDS).filter(function (id) {
    return !/^-?\d{1,20}$/.test(id) && !/^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(id);
  });
  if (idRosak.length) {
    throw new Error('chat_id Telegram tidak sah: ' + idRosak.join(', ') +
                    '. Guna nombor (cth -1001234567890) atau @namachannel.');
  }
  // Hos DIKUNCI: webhook Chat sentiasa di chat.googleapis.com. Tanpa pagar ni, satu
  // salah taip menghantar seluruh digest ke hos milik orang lain.
  // Ralat sebut NOMBOR entri, bukan URL -- URL bawa kunci & token rahsia.
  const hookSalah = [];
  parseCsvList_(cfg.BROADCAST_GCHAT_WEBHOOKS).forEach(function (u, i) {
    if (!/^https:\/\/chat\.googleapis\.com\/v1\/spaces\/\S+$/.test(u)) hookSalah.push(i + 1);
  });
  if (hookSalah.length) {
    throw new Error('URL webhook Google Chat #' + hookSalah.join(', #') +
                    ' tidak sah. Mesti bermula https://chat.googleapis.com/v1/spaces/');
  }
```

- [ ] **Step 5: Tambah dua fungsi tulen** — TEPAT SELEPAS `validateSetupInput_`:

```js
// Pure -- bentuk tetapan yang dihantar ke client. Diasingkan dari getSystemSettings()
// supaya gerbang WRITE-ONLY (token & URL webhook tak pernah keluar dari server) boleh
// diuji tanpa sesi palsu. Client hanya dapat BENDERA "sudah diset?", jadi rahsia tak
// pernah wujud dalam DOM, localStorage, atau tab rangkaian pelayar.
// chat_id BUKAN rahsia -- admin perlu nampak sasaran untuk sunting/buang.
function projectSystemSettings_(cfg) {
  return {
    appName: cfg.APP_NAME,
    officeName: cfg.OFFICE_NAME,
    shortName: cfg.SHORT_NAME,
    timezone: cfg.TIMEZONE,
    calendarId: cfg.CALENDAR_ID,
    adminEmail: cfg.ADMIN_EMAIL,
    themeColor: cfg.THEME_COLOR,
    allowRegistration: cfg.ALLOW_REGISTRATION,
    footerText: cfg.FOOTER_TEXT,
    iconUrl: cfg.ICON_URL,
    allowedEmailDomains: cfg.ALLOWED_EMAIL_DOMAINS,
    reminderHour: cfg.REMINDER_HOUR,
    broadcastTgChatIds: cfg.BROADCAST_TG_CHAT_IDS,
    broadcastTgTokenSet: !!cfg.BROADCAST_TG_TOKEN,
    broadcastGchatSet: !!cfg.BROADCAST_GCHAT_WEBHOOKS,
    broadcastGchatCount: parseCsvList_(cfg.BROADCAST_GCHAT_WEBHOOKS).length,
    digestDay: cfg.DIGEST_DAY,
    digestHour: cfg.DIGEST_HOUR,
    digestMinute: cfg.DIGEST_MINUTE
  };
}

// Pure -- gabung input admin dengan config semasa sebelum validasi.
// Peraturan medan RAHSIA: borang tak pernah memaparkan nilai semasa, jadi medan
// kosong bermaksud "jangan ubah", BUKAN "padam". Untuk memadam, admin tanda
// checkbox clearTgToken / clearGchatWebhooks -- niat eksplisit, bukan nilai ajaib.
function mergeSettingsInput_(input, current) {
  input = input || {};
  const tokenBaharu = String(input.broadcastTgToken || '').trim();
  const hookBaharu = String(input.broadcastGchatWebhooks || '').trim();
  return {
    appName: input.appName || current.APP_NAME,
    officeName: input.officeName || current.OFFICE_NAME,
    shortName: input.shortName || current.SHORT_NAME,
    timezone: input.timezone || current.TIMEZONE,
    calendarId: input.calendarId || current.CALENDAR_ID,
    adminEmail: current.ADMIN_EMAIL,
    themeColor: input.themeColor || current.THEME_COLOR,
    allowRegistration: input.allowRegistration !== false,
    footerText: input.footerText !== undefined ? input.footerText : current.FOOTER_TEXT,
    iconUrl: input.iconUrl !== undefined ? input.iconUrl : current.ICON_URL,
    allowedEmailDomains: input.allowedEmailDomains !== undefined ? input.allowedEmailDomains : current.ALLOWED_EMAIL_DOMAINS,
    reminderHour: input.reminderHour !== undefined ? input.reminderHour : current.REMINDER_HOUR,
    broadcastTgToken: input.clearTgToken === true ? '' : (tokenBaharu || current.BROADCAST_TG_TOKEN),
    broadcastGchatWebhooks: input.clearGchatWebhooks === true ? '' : (hookBaharu || current.BROADCAST_GCHAT_WEBHOOKS),
    // chat_id bukan rahsia: ia DIPAPAR dalam borang, jadi kosong = admin memang padam.
    broadcastTgChatIds: input.broadcastTgChatIds !== undefined ? input.broadcastTgChatIds : current.BROADCAST_TG_CHAT_IDS,
    digestDay: input.digestDay !== undefined ? input.digestDay : current.DIGEST_DAY,
    digestHour: input.digestHour !== undefined ? input.digestHour : current.DIGEST_HOUR,
    digestMinute: input.digestMinute !== undefined ? input.digestMinute : current.DIGEST_MINUTE
  };
}
```

- [ ] **Step 6: Sambungkan ke tiga titik panggilan**

`getSystemSettings` — ganti seluruh badan selepas `requireSession_`:

```js
function getSystemSettings(token) {
  requireSession_(token, 'canManageUsers');
  return projectSystemSettings_(getConfig_());
}
```

`updateSystemSettings` — ganti blok `const mergedInput = {...}` dengan satu baris, dan tambah panggilan trigger:

```js
  const mergedInput = mergeSettingsInput_(input, current);
  const next = Object.assign({}, DEFAULT_CONFIG, validateSetupInput_(mergedInput));

  const cal = CalendarApp.getCalendarById(next.CALENDAR_ID);
  if (!cal) throw new Error('Calendar ID baharu tidak dapat diakses.');

  PropertiesService.getScriptProperties().setProperty('APP_CONFIG_V3', JSON.stringify(next));
  syncReminderTrigger_(next.REMINDER_HOUR);
  syncDigestTrigger_(next.DIGEST_DAY, next.DIGEST_HOUR, next.DIGEST_MINUTE);
  addAudit_('SYSTEM_SETTINGS_UPDATED', next.APP_NAME + ' | ' + next.OFFICE_NAME, admin.user.email);
```

`installSystem` — selepas `syncReminderTrigger_(finalCfg.REMINDER_HOUR);`:

```js
  syncDigestTrigger_(finalCfg.DIGEST_DAY, finalCfg.DIGEST_HOUR, finalCfg.DIGEST_MINUTE);
```

- [ ] **Step 7: Jalankan — mesti LULUS**

```bash
node selftest-node.js
node --check Code.js
```

- [ ] **Step 8: Mutation test (empat mutasi)**

```js
// M1 -- padam baris BROADCAST_TG_CHAT_IDS dari objek cfg dalam validateSetupInput_
//        (ganti dengan komen yang menamakannya, jangan padam sunyi)
```
Jangkaan GAGAL: `validateSetupInput_ SIMPAN 6 kunci broadcast`. Ini pepijat kehilangan data SEBENAR yang paling mungkin berlaku.

```js
// M2 -- bocorkan rahsia:  broadcastTgTokenSet: !!cfg.BROADCAST_TG_TOKEN
//        ->  broadcastTgToken: cfg.BROADCAST_TG_TOKEN
```
Jangkaan GAGAL: `projectSystemSettings_ TIDAK pernah pulangkan token/webhook mentah`.

```js
// M3 -- kosong bermakna padam:  (tokenBaharu || current.BROADCAST_TG_TOKEN)  ->  tokenBaharu
```
Jangkaan GAGAL: `mergeSettingsInput_ medan rahsia KOSONG -> KEKALKAN nilai lama`, `ruang kosong DIKIRA kosong`.

```js
// M4 -- longgarkan hos webhook:  /^https:\/\/chat\.googleapis\.com\/v1\/spaces\/\S+$/
//        ->  /^https:\/\/\S+$/
```
Jangkaan GAGAL: `validateSetupInput_ TOLAK webhook bukan hos chat.googleapis.com`.

Pulih selepas setiap mutasi.

- [ ] **Step 9: Commit**

```bash
node selftest-node.js && node --check Code.js && grep -c $'\r' Code.js
git add Code.js
git commit -m "feat(settings): tetapan broadcast/digest + gerbang write-only token & webhook"
```

**Siap bila:** enam kunci selamat merentas simpanan tetapan, rahsia terbukti tidak pernah keluar ke client, empat mutasi terbukti gagal, ujian tetapan sedia ada (`reminderHour`) masih hijau.

---

## Task 10: Dua penghantar — `sendToTelegram_` + `sendToGoogleChat_`

**Files:**
- Modify: `Code.js` — seksyen `DIGEST MINGGUAN`, selepas `installDigestTrigger_`
- Modify: `selftest-node.js` — ujian sink dengan `UrlFetchApp` palsu

**Interfaces:**
- Consumes: `parseCsvList_`, `sanitizeForGChat_`, `addAudit_`, `getConfig_`.
- Produces: `sendToTelegram_(text, token, chatIdsCsv) -> number` (bilangan sasaran berjaya); `sendToGoogleChat_(text, webhooksCsv) -> number`.

- [ ] **Step 1: Tulis ujian yang GAGAL dahulu** — dalam `selftest-node.js`, selepas blok ujian trigger:

```js
// --- sink (perlu UrlFetchApp + Properties palsu) -----------------------------
const CFG_UJI = JSON.stringify({
  APP_NAME: 'Takwim', OFFICE_NAME: 'SK Salor', SHORT_NAME: 'SKS',
  ADMIN_EMAIL: 'admin@sekolah.edu.my', CALENDAR_ID: 'kal@group.calendar.google.com',
  TIMEZONE: 'Asia/Kuala_Lumpur', MAX_AUDIT_ROWS: 400
});
const TOKEN_UJI = '123456789:AAHdqTcvbXcvbXcvbXcvbXcvbXcvbXcvbXc';
const HOOK_UJI = 'https://chat.googleapis.com/v1/spaces/AAQZxK/messages?key=KUNCI&token=RAHSIA';

function auditRows(props) {
  try { return JSON.parse(props.store.PPD_AUDIT_V23 || '[]'); } catch (e) { return []; }
}

(function ujianSinkTelegram() {
  // (a) tiada token / tiada chat_id -> TIADA permintaan luar langsung
  const f1 = fakeUrlFetch();
  const a1 = loadCode(['sendToTelegram_'], { UrlFetchApp: f1.api,
    PropertiesService: { getScriptProperties: function () { return fakeProps({ APP_CONFIG_V3: CFG_UJI }).api; } } });
  const n0 = a1.sendToTelegram_('teks', '', '-100123');
  const n1 = a1.sendToTelegram_('teks', TOKEN_UJI, '');
  const n2 = a1.sendToTelegram_('', TOKEN_UJI, '-100123');
  ok('sendToTelegram_ tiada token/chat_id/teks -> TIADA fetch langsung',
     f1.calls.length === 0 && n0 === 0 && n1 === 0 && n2 === 0);

  // (b) dua chat_id -> dua POST, teks MENTAH (tiada sanitize, tiada parse_mode)
  const p2 = fakeProps({ APP_CONFIG_V3: CFG_UJI });
  const f2 = fakeUrlFetch();
  const a2 = loadCode(['sendToTelegram_'], { UrlFetchApp: f2.api,
    PropertiesService: { getScriptProperties: function () { return p2.api; } } });
  const hantar = a2.sendToTelegram_('Tajuk *bintang*', TOKEN_UJI, '-100123, -100456');
  ok('sendToTelegram_ satu POST per chat_id', f2.calls.length === 2 && hantar === 2);
  ok('sendToTelegram_ guna endpoint sendMessage bot',
     f2.calls[0].url === 'https://api.telegram.org/bot' + TOKEN_UJI + '/sendMessage');
  ok('sendToTelegram_ muteHttpExceptions supaya 4xx tak meletup',
     f2.calls[0].params.muteHttpExceptions === true);
  ok('sendToTelegram_ hantar teks MENTAH (tiada parse_mode -> * kekal apa adanya)',
     JSON.parse(f2.calls[0].params.payload).text === 'Tajuk *bintang*' &&
     JSON.parse(f2.calls[0].params.payload).parse_mode === undefined);
  ok('sendToTelegram_ chat_id kedua betul', JSON.parse(f2.calls[1].params.payload).chat_id === '-100456');

  // (c) satu sasaran gagal -> sasaran lain TERUSKAN + audit
  const p3 = fakeProps({ APP_CONFIG_V3: CFG_UJI });
  const f3 = fakeUrlFetch(function (url, params, n) {
    return n === 1 ? { code: 403, body: '{"ok":false,"description":"bot was kicked"}' } : {};
  });
  const a3 = loadCode(['sendToTelegram_'], { UrlFetchApp: f3.api,
    PropertiesService: { getScriptProperties: function () { return p3.api; } } });
  const berjaya = a3.sendToTelegram_('teks', TOKEN_UJI, '-100123, -100456');
  ok('sendToTelegram_ satu gagal TIDAK menghalang yang lain', f3.calls.length === 2 && berjaya === 1);
  const rows3 = auditRows(p3);
  ok('sendToTelegram_ audit kegagalan dengan sink + id + sebab',
     rows3.length === 1 && rows3[0].action === 'DIGEST_SEND_FAILED' &&
     rows3[0].detail.indexOf('telegram') !== -1 && rows3[0].detail.indexOf('-100123') !== -1 &&
     rows3[0].detail.indexOf('bot was kicked') !== -1);
  ok('AUDIT TIDAK PERNAH memuatkan token (ia ada dalam URL -- mudah tersalah log)',
     JSON.stringify(rows3).indexOf(TOKEN_UJI) === -1 && JSON.stringify(rows3).indexOf('123456789:') === -1);

  // (d) ok:false dengan kod 200 -- Telegram lapor gagal DALAM badan JSON
  const p4 = fakeProps({ APP_CONFIG_V3: CFG_UJI });
  const f4 = fakeUrlFetch(function () { return { code: 200, body: '{"ok":false,"description":"chat not found"}' }; });
  const a4 = loadCode(['sendToTelegram_'], { UrlFetchApp: f4.api,
    PropertiesService: { getScriptProperties: function () { return p4.api; } } });
  ok('sendToTelegram_ 200 + ok:false DIKIRA GAGAL (bukan berjaya)',
     a4.sendToTelegram_('teks', TOKEN_UJI, '-100123') === 0 &&
     auditRows(p4)[0].detail.indexOf('chat not found') !== -1);

  // (e) group naik taraf jadi supergroup -> chat_id berubah
  const p5 = fakeProps({ APP_CONFIG_V3: CFG_UJI });
  const f5 = fakeUrlFetch(function () {
    return { code: 400, body: '{"ok":false,"description":"group upgraded","parameters":{"migrate_to_chat_id":-1009999}}' };
  });
  const a5 = loadCode(['sendToTelegram_'], { UrlFetchApp: f5.api,
    PropertiesService: { getScriptProperties: function () { return p5.api; } } });
  a5.sendToTelegram_('teks', TOKEN_UJI, '-100123');
  const aksi5 = auditRows(p5).map(function (r) { return r.action; });
  ok('sendToTelegram_ audit DIGEST_CHATID_MIGRATED dengan ID baharu',
     aksi5.indexOf('DIGEST_CHATID_MIGRATED') !== -1 &&
     JSON.stringify(auditRows(p5)).indexOf('-1009999') !== -1);
})();

(function ujianSinkGChat() {
  const p1 = fakeProps({ APP_CONFIG_V3: CFG_UJI });
  const f1 = fakeUrlFetch();
  const a1 = loadCode(['sendToGoogleChat_'], { UrlFetchApp: f1.api,
    PropertiesService: { getScriptProperties: function () { return p1.api; } } });

  ok('sendToGoogleChat_ tiada webhook -> TIADA fetch',
     a1.sendToGoogleChat_('teks', '') === 0 && f1.calls.length === 0);

  const n = a1.sendToGoogleChat_('Tajuk *bintang* <a|b>', HOOK_UJI);
  ok('sendToGoogleChat_ POST ke URL webhook', n === 1 && f1.calls[0].url === HOOK_UJI);
  ok('sendToGoogleChat_ hantar JSON {text} yang SUDAH disanitize',
     JSON.parse(f1.calls[0].params.payload).text === 'Tajuk bintang ab');

  // Hos asing DITOLAK di titik hantar juga (bukan hanya masa simpan)
  const p2 = fakeProps({ APP_CONFIG_V3: CFG_UJI });
  const f2 = fakeUrlFetch();
  const a2 = loadCode(['sendToGoogleChat_'], { UrlFetchApp: f2.api,
    PropertiesService: { getScriptProperties: function () { return p2.api; } } });
  const n2 = a2.sendToGoogleChat_('teks', 'https://jahat.example.com/hook?key=RAHSIA');
  ok('sendToGoogleChat_ TOLAK hos bukan chat.googleapis.com (pertahanan berlapis)',
     n2 === 0 && f2.calls.length === 0);
  ok('audit hos ditolak TIDAK simpan query string (ia bawa kunci)',
     JSON.stringify(auditRows(p2)).indexOf('RAHSIA') === -1);

  // Kegagalan HTTP diaudit tanpa membocorkan kunci webhook
  const p3 = fakeProps({ APP_CONFIG_V3: CFG_UJI });
  const f3 = fakeUrlFetch(function () { return { code: 404, body: 'Not Found' }; });
  const a3 = loadCode(['sendToGoogleChat_'], { UrlFetchApp: f3.api,
    PropertiesService: { getScriptProperties: function () { return p3.api; } } });
  a3.sendToGoogleChat_('teks', HOOK_UJI);
  const rows3 = auditRows(p3);
  ok('sendToGoogleChat_ audit kegagalan dengan kod HTTP',
     rows3[0].action === 'DIGEST_SEND_FAILED' && rows3[0].detail.indexOf('gchat') !== -1 &&
     rows3[0].detail.indexOf('404') !== -1);
  ok('AUDIT gchat TIDAK PERNAH memuatkan kunci/token webhook',
     JSON.stringify(rows3).indexOf('KUNCI') === -1 && JSON.stringify(rows3).indexOf('RAHSIA') === -1);
})();
```

- [ ] **Step 2: Jalankan — mesti GAGAL**

```bash
node selftest-node.js; echo "exit=$?"
```

- [ ] **Step 3: Tulis pelaksanaan** — dalam `Code.js`, selepas `installDigestTrigger_`:

```js
// Best-effort per sasaran: satu group yang tercicir (bot ditendang, chat_id lapuk)
// TIDAK boleh menghalang group lain menerima digest. Corak sama gelung penerima
// dalam sendActivityReminders_.
// Pulangkan BILANGAN sasaran berjaya -- itu yang membolehkan ujian membuktikan
// "tiada token -> tiada permintaan luar".
function sendToTelegram_(text, token, chatIdsCsv) {
  if (!text || !token) return 0;
  const ids = parseCsvList_(chatIdsCsv);
  if (!ids.length) return 0;

  const adminEmail = getConfig_().ADMIN_EMAIL;
  const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
  let berjaya = 0;

  ids.forEach(function (id) {
    try {
      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        // SENGAJA tiada parse_mode: teks dihantar mentah, jadi tajuk aktiviti yang
        // mengandungi _ atau * tak akan memecahkan penghuraian Telegram.
        payload: JSON.stringify({ chat_id: id, text: text, disable_web_page_preview: true }),
        muteHttpExceptions: true
      });
      const code = res.getResponseCode();
      let body = {};
      try { body = JSON.parse(res.getContentText() || '{}') || {}; } catch (e2) { body = {}; }

      // Group yang naik taraf jadi supergroup TUKAR chat_id. Rakam ID baharu supaya
      // master boleh kemas tetapan -- kalau tidak, digest senyap selama-lamanya.
      if (body.parameters && body.parameters.migrate_to_chat_id) {
        addAudit_('DIGEST_CHATID_MIGRATED', id + ' -> ' + body.parameters.migrate_to_chat_id, adminEmail);
      }

      if (code >= 200 && code <= 299 && body.ok !== false) { berjaya++; return; }
      // JANGAN sertakan `url` di sini: ia mengandungi token bot.
      addAudit_('DIGEST_SEND_FAILED',
                'telegram | ' + id + ' | HTTP ' + code + ' | ' + (body.description || ''), adminEmail);
    } catch (e) {
      addAudit_('DIGEST_SEND_FAILED', 'telegram | ' + id + ' | ' + e.message, adminEmail);
    }
  });
  return berjaya;
}

// URL webhook Chat mengandungi kunci rahsia dalam query string. Dua peraturan:
// (1) hos DIKUNCI ke chat.googleapis.com -- salah taip tak boleh menghantar takwim
//     sekolah ke pelayan orang lain (validateSetupInput_ menyemak masa SIMPAN;
//     semakan kedua di sini sebab trigger boleh jalan atas config lama);
// (2) hanya bahagian SEBELUM '?' pernah masuk audit.
function sendToGoogleChat_(text, webhooksCsv) {
  if (!text) return 0;
  const urls = parseCsvList_(webhooksCsv);
  if (!urls.length) return 0;

  const adminEmail = getConfig_().ADMIN_EMAIL;
  const badan = JSON.stringify({ text: sanitizeForGChat_(text) });
  let berjaya = 0;

  urls.forEach(function (u) {
    const label = String(u).split('?')[0];
    if (!/^https:\/\/chat\.googleapis\.com\/v1\/spaces\/\S+$/.test(u)) {
      addAudit_('DIGEST_SEND_FAILED', 'gchat | ' + label + ' | hos bukan chat.googleapis.com', adminEmail);
      return;
    }
    try {
      const res = UrlFetchApp.fetch(u, {
        method: 'post', contentType: 'application/json',
        payload: badan, muteHttpExceptions: true
      });
      const code = res.getResponseCode();
      if (code >= 200 && code <= 299) { berjaya++; return; }
      addAudit_('DIGEST_SEND_FAILED', 'gchat | ' + label + ' | HTTP ' + code, adminEmail);
    } catch (e) {
      addAudit_('DIGEST_SEND_FAILED', 'gchat | ' + label + ' | ' + e.message, adminEmail);
    }
  });
  return berjaya;
}
```

- [ ] **Step 4: Jalankan — mesti LULUS**

```bash
node selftest-node.js
node --check Code.js
```

- [ ] **Step 5: Mutation test (lima mutasi)**

```js
// M1 -- buang gerbang token:  if (!text || !token) return 0;
//        ->  // gerbang token dibuang (mutasi)
```
Jangkaan GAGAL: `sendToTelegram_ tiada token/chat_id/teks -> TIADA fetch langsung`.

```js
// M2 -- abaikan ok:false:  if (code >= 200 && code <= 299 && body.ok !== false)
//        ->  if (code >= 200 && code <= 299)
```
Jangkaan GAGAL: `sendToTelegram_ 200 + ok:false DIKIRA GAGAL`.

```js
// M3 -- bocorkan token ke audit: tambah ' | ' + url pada detail DIGEST_SEND_FAILED
```
Jangkaan GAGAL: `AUDIT TIDAK PERNAH memuatkan token`.

```js
// M4 -- gelung berhenti pada kegagalan: tukar ids.forEach(...) jadi gelung `for`
//        dengan `return` selepas addAudit_ kegagalan pertama
```
Jangkaan GAGAL: `sendToTelegram_ satu gagal TIDAK menghalang yang lain`.

```js
// M5 -- buang kunci hos gchat: padam blok `if (!/^https:\/\/chat\.googleapis...`
//        (ganti dengan komen yang menamakannya)
```
Jangkaan GAGAL: `sendToGoogleChat_ TOLAK hos bukan chat.googleapis.com`.

Pulih selepas setiap mutasi.

- [ ] **Step 6: Commit**

```bash
node selftest-node.js && node --check Code.js && grep -c $'\r' Code.js selftest-node.js
git add Code.js selftest-node.js
git commit -m "feat(digest): penghantar Telegram + Google Chat (best-effort, rahsia tak masuk audit)"
```

**Siap bila:** kedua-dua sink menghantar, mengaudit kegagalan tanpa membocorkan rahsia, meneruskan selepas kegagalan separa; lima mutasi terbukti gagal.

---

## Task 11: Handler `sendWeeklyDigest_` + `pruneDigestMarkers_`

**Files:**
- Modify: `Code.js` — seksyen `DIGEST MINGGUAN`, selepas `sendToGoogleChat_`
- Modify: `selftest-node.js` — ujian orkestrasi hujung-ke-hujung dengan kalendar palsu

**Interfaces:**
- Consumes: semua yang dibina Task 2-10.
- Produces: `sendWeeklyDigest_() -> void` (handler trigger, nama ini dirujuk oleh `syncDigestTrigger_`); `pruneDigestMarkers_() -> void`.

- [ ] **Step 1: Tulis ujian yang GAGAL dahulu** — dalam `selftest-node.js`, selepas ujian sink:

```js
// --- orkestrasi sendWeeklyDigest_ -------------------------------------------
// Membina "dunia" lengkap: config, kalendar, Properties, UrlFetchApp -- semua palsu.
function duniaDigest(opsi) {
  opsi = opsi || {};
  const cfg = Object.assign(JSON.parse(CFG_UJI), opsi.cfg || {
    BROADCAST_TG_TOKEN: TOKEN_UJI, BROADCAST_TG_CHAT_IDS: '-100123',
    BROADCAST_GCHAT_WEBHOOKS: HOOK_UJI
  });
  const props = fakeProps(Object.assign({ APP_CONFIG_V3: JSON.stringify(cfg) }, opsi.props || {}));
  const fetch = fakeUrlFetch(opsi.responder);
  const esok = function (n, jam) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); d.setHours(jam || 9); return d; };
  // Empat kombinasi saluran -- setiap satu mesti berakhir di tempat yang BETUL sahaja.
  const events = (opsi.events || [
    { id: 'e1', title: 'Hari Sukan TG', description: 'PIC: Ali\nKongsi: tg\n[PPD_CATEGORY:program]',
      location: 'Padang', start: esok(2), end: esok(2, 13), allDay: false },
    { id: 'e2', title: 'Kuiz Sains CHAT', description: 'Kongsi: gchat\n[PPD_CATEGORY:program]',
      location: 'Makmal', start: esok(3), end: esok(3, 11), allDay: false },
    { id: 'e3', title: 'Perhimpunan DUA', description: 'Kongsi: tg,gchat\n[PPD_CATEGORY:program]',
      location: 'Dewan', start: esok(4), end: esok(4, 10), allDay: false },
    { id: 'e4', title: 'Mesyuarat Panitia SULIT', description: 'PIC: Siti\n[PPD_CATEGORY:mesyuarat]',
      location: 'Bilik Guru', start: esok(5), end: esok(5, 11), allDay: false }
  ]).map(fakeEvent);
  const api = loadCode(['sendWeeklyDigest_', 'pruneDigestMarkers_', 'isoWeekKey_'], {
    UrlFetchApp: fetch.api,
    PropertiesService: { getScriptProperties: function () { return props.api; } },
    CalendarApp: {
      EventColor: { BLUE: 'B', GREEN: 'G', ORANGE: 'O', MAUVE: 'M', RED: 'R', GRAY: 'GY', YELLOW: 'Y' },
      getCalendarById: function () { return fakeCalendar(events); }
    }
  });
  return { api: api, props: props, fetch: fetch };
}
function kunciMingguIni(api) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return 'DGSENT_' + api.isoWeekKey_(t);
}

(function ujianDigestAliranPenuh() {
  const d = duniaDigest();
  d.api.sendWeeklyDigest_();
  ok('sendWeeklyDigest_ hantar ke KEDUA-DUA sink', d.fetch.calls.length === 2);

  const panggilTg = d.fetch.calls.filter(function (c) { return c.url.indexOf('api.telegram.org') !== -1; })[0];
  const panggilGc = d.fetch.calls.filter(function (c) { return c.url.indexOf('chat.googleapis.com') !== -1; })[0];
  const teksTg = JSON.parse(panggilTg.params.payload).text;
  const teksGc = JSON.parse(panggilGc.params.payload).text;

  ok('digest Telegram = aktiviti tg + dua-saluran SAHAJA',
     teksTg.indexOf('Hari Sukan TG') !== -1 && teksTg.indexOf('Perhimpunan DUA') !== -1 &&
     teksTg.indexOf('Kuiz Sains CHAT') === -1);
  ok('digest Google Chat = aktiviti gchat + dua-saluran SAHAJA',
     teksGc.indexOf('Kuiz Sains CHAT') !== -1 && teksGc.indexOf('Perhimpunan DUA') !== -1 &&
     teksGc.indexOf('Hari Sukan TG') === -1);
  ok('aktiviti TIADA saluran tak masuk mana-mana digest',
     teksTg.indexOf('Mesyuarat Panitia SULIT') === -1 && teksGc.indexOf('Mesyuarat Panitia SULIT') === -1);
  ok('digest TIDAK bocorkan PIC walau untuk aktiviti bertanda',
     teksTg.indexOf('Ali') === -1 && teksGc.indexOf('Ali') === -1);
  ok('penanda minggu diset selepas hantar', d.props.store[kunciMingguIni(d.api)] !== undefined);
})();

(function ujianDigestSatuSaluranSahaja() {
  // Kedua-dua sink DIKONFIG penuh, tetapi minggu ni hanya ada aktiviti bertanda 'tg'.
  // Space murid TIDAK boleh menerima mesej kosong atau mesej yang bukan untuk mereka.
  const hariIni = function (n) { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + n); x.setHours(9); return x; };
  const d = duniaDigest({ events: [
    { id: 'x1', title: 'Hanya Telegram', description: 'Kongsi: tg\n[PPD_CATEGORY:program]',
      location: 'Padang', start: hariIni(1), end: hariIni(1), allDay: false }
  ] });
  d.api.sendWeeklyDigest_();
  ok('tiada aktiviti gchat -> sink Chat TIDAK dipanggil langsung',
     d.fetch.calls.length === 1 && d.fetch.calls[0].url.indexOf('api.telegram.org') !== -1);
  ok('penanda TETAP diset walau hanya satu saluran dihantar',
     d.props.store[kunciMingguIni(d.api)] !== undefined);

  const d2 = duniaDigest({ events: [
    { id: 'x2', title: 'Hanya Chat', description: 'Kongsi: gchat\n[PPD_CATEGORY:program]',
      location: 'Makmal', start: hariIni(1), end: hariIni(1), allDay: false }
  ] });
  d2.api.sendWeeklyDigest_();
  ok('tiada aktiviti tg -> sink Telegram TIDAK dipanggil langsung',
     d2.fetch.calls.length === 1 && d2.fetch.calls[0].url.indexOf('chat.googleapis.com') !== -1);
})();

(function ujianDigestGuardKonfigurasi() {
  const d = duniaDigest({ cfg: { BROADCAST_TG_TOKEN: '', BROADCAST_TG_CHAT_IDS: '', BROADCAST_GCHAT_WEBHOOKS: '' } });
  d.api.sendWeeklyDigest_();
  ok('tiada konfigurasi -> TIADA fetch, TIADA penanda',
     d.fetch.calls.length === 0 && d.props.store[kunciMingguIni(d.api)] === undefined);

  // Token ada tapi chat_id kosong: Telegram BELUM sedia, tetapi Chat sedia.
  const d2 = duniaDigest({ cfg: { BROADCAST_TG_TOKEN: TOKEN_UJI, BROADCAST_TG_CHAT_IDS: '', BROADCAST_GCHAT_WEBHOOKS: HOOK_UJI } });
  d2.api.sendWeeklyDigest_();
  ok('Telegram separuh dikonfig -> Chat SAHAJA tetap dihantar',
     d2.fetch.calls.length === 1 && d2.fetch.calls[0].url === HOOK_UJI);

  const d3 = duniaDigest({ cfg: { BROADCAST_TG_TOKEN: TOKEN_UJI, BROADCAST_TG_CHAT_IDS: '-100123', BROADCAST_GCHAT_WEBHOOKS: '' } });
  d3.api.sendWeeklyDigest_();
  ok('Chat tak dikonfig -> Telegram SAHAJA tetap dihantar',
     d3.fetch.calls.length === 1 && d3.fetch.calls[0].url.indexOf('api.telegram.org') !== -1);
})();

(function ujianDigestMingguKosong() {
  const d = duniaDigest({ events: [
    { id: 'e9', title: 'Mesyuarat', description: '[PPD_CATEGORY:mesyuarat]',
      location: '', start: new Date(), end: new Date(), allDay: false }
  ] });
  d.api.sendWeeklyDigest_();
  ok('KEDUA-DUA senarai saluran kosong -> skip SENYAP dan TIDAK set penanda',
     d.fetch.calls.length === 0 && d.props.store[kunciMingguIni(d.api)] === undefined);
})();

(function ujianDigestSekaliSeminggu() {
  const d = duniaDigest();
  d.api.sendWeeklyDigest_();
  const bil = d.fetch.calls.length;
  d.api.sendWeeklyDigest_();
  ok('larian kedua dalam minggu SAMA tidak menghantar apa-apa lagi', d.fetch.calls.length === bil);
})();

(function ujianDigestUrutanPenanda() {
  // Penanda mesti diset SELEPAS cuba hantar. Kalau ia diset dahulu, kegagalan
  // sementara (rangkaian) akan mengunci minggu itu tanpa sebarang mesej terhantar.
  let penandaMasaHantar = 'BELUM DISEMAK';
  const d = duniaDigest({ responder: function () { return {}; } });
  const kunci = kunciMingguIni(d.api);
  const fetchAsal = d.fetch.api.fetch;
  d.fetch.api.fetch = function (url, params) {
    penandaMasaHantar = d.props.store[kunci];
    return fetchAsal(url, params);
  };
  d.api.sendWeeklyDigest_();
  ok('penanda DGSENT_ belum wujud pada masa fetch pertama (set SELEPAS hantar)',
     penandaMasaHantar === undefined);
})();

(function ujianDigestKegagalanTidakMeletup() {
  const d = duniaDigest({ responder: function () { throw new Error('rangkaian putus'); } });
  let meletup = false;
  try { d.api.sendWeeklyDigest_(); } catch (e) { meletup = true; }
  ok('kegagalan rangkaian TIDAK melempar keluar dari handler trigger', !meletup);
  ok('kegagalan rangkaian tetap diaudit',
     JSON.stringify(auditRows(d.props)).indexOf('DIGEST_SEND_FAILED') !== -1);
  ok('penanda TETAP diset selepas cuba (snapshot mingguan, bukan baris gilir cuba semula)',
     d.props.store[kunciMingguIni(d.api)] !== undefined);
})();

(function ujianPruneDigestMarkers() {
  const seed = { APP_CONFIG_V3: CFG_UJI, PPD_USERS_V23: '{}' };
  for (let i = 1; i <= 9; i++) seed['DGSENT_2026-W' + (i < 10 ? '0' + i : i)] = '1';
  seed['DGSENT_2025-W52'] = '1';
  const props = fakeProps(seed);
  const api = loadCode(['pruneDigestMarkers_'], {
    PropertiesService: { getScriptProperties: function () { return props.api; } } });
  api.pruneDigestMarkers_();
  const tinggal = Object.keys(props.store).filter(function (k) { return k.indexOf('DGSENT_') === 0; }).sort();
  ok('pruneDigestMarkers_ kekalkan 8 penanda TERBAHARU sahaja', tinggal.length === 8);
  ok('pruneDigestMarkers_ buang yang PALING LAMA (merentas sempadan tahun)',
     tinggal.indexOf('DGSENT_2025-W52') === -1 && tinggal.indexOf('DGSENT_2026-W01') === -1 &&
     tinggal.indexOf('DGSENT_2026-W09') !== -1);
  ok('pruneDigestMarkers_ TIDAK sentuh kunci lain', props.store.APP_CONFIG_V3 !== undefined);
})();
```

- [ ] **Step 2: Jalankan — mesti GAGAL**

```bash
node selftest-node.js; echo "exit=$?"
```

- [ ] **Step 3: Tulis pelaksanaan** — dalam `Code.js`, selepas `sendToGoogleChat_`:

```js
// Handler trigger mingguan. Dipanggil oleh trigger masa (syncDigestTrigger_), BUKAN
// client -- tiada token sesi di sini, jadi tiada requireSession_.
// Prasyarat sekali sahaja: master mesti Run fungsi ni SEKALI dari Apps Script Editor
// untuk memberi kebenaran "sambung ke perkhidmatan luar" (UrlFetchApp). Tanpa itu,
// eksekusi trigger gagal SENYAP.
function sendWeeklyDigest_() {
  try {
    const cfg = getConfig_();
    // Telegram perlu token DAN sekurang-kurangnya satu chat_id; Chat perlu webhook.
    // Kalau tiada saluran langsung yang lengkap -- tak ada apa nak buat.
    const tgSedia = !!(cfg.BROADCAST_TG_TOKEN && cfg.BROADCAST_TG_CHAT_IDS);
    const gcSedia = !!cfg.BROADCAST_GCHAT_WEBHOOKS;
    if (!tgSedia && !gcSedia) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(today);
    rangeEnd.setDate(rangeEnd.getDate() + 7);

    // Kalendar KERJA sahaja. Cuti Google (getHolidayEvents_) sengaja tidak digabung:
    // ia kalendar luar yang tak boleh ditanda "Kongsi", dan ibu bapa sudah tahu cuti am.
    const events = safeGetEvents_(getPPDCalendar_(), today, rangeEnd).map(eventToObject_);

    // Setiap sink tapis senarainya SENDIRI: guru boleh tanda satu saluran sahaja,
    // jadi kandungan dua digest ini memang boleh berbeza.
    const tgEvents = events.filter(function (e) { return e.shareChannels.indexOf('tg') !== -1; });
    const gchatEvents = events.filter(function (e) { return e.shareChannels.indexOf('gchat') !== -1; });

    // Minggu tanpa sebarang aktiviti bertanda: skip SENYAP dan JANGAN set penanda,
    // supaya aktiviti yang ditanda lewat pada minggu yang sama masih boleh keluar.
    if (!tgEvents.length && !gchatEvents.length) return;

    const props = PropertiesService.getScriptProperties();
    const kunci = 'DGSENT_' + isoWeekKey_(today);
    if (props.getProperty(kunci)) return;

    // Senarai kosong TIDAK dihantar: sink yang tiada aktiviti minggu ni tak patut
    // menerima mesej "kosong" yang hanya ada tajuk dan nota kaki.
    if (tgSedia && tgEvents.length) {
      sendToTelegram_(buildDigestText_(tgEvents, cfg), cfg.BROADCAST_TG_TOKEN, cfg.BROADCAST_TG_CHAT_IDS);
    }
    if (gcSedia && gchatEvents.length) {
      sendToGoogleChat_(buildDigestText_(gchatEvents, cfg), cfg.BROADCAST_GCHAT_WEBHOOKS);
    }

    // Penanda diset SELEPAS cuba semua sink, tanpa mengira kegagalan separa: digest
    // ialah SNAPSHOT mingguan. Cuba semula berisiko menghantar dua kali ke sink yang
    // sudah berjaya; minggu tertinggal boleh diterima (keputusan master, spec 6).
    props.setProperty(kunci, String(Date.now()));
    pruneDigestMarkers_();
  } catch (e) {
    addAudit_('DIGEST_RUN_FAILED', e.message, getConfig_().ADMIN_EMAIL);
  }
}

// Script Properties ialah ruang terhad dan dikongsi seluruh sistem. Penanda minggu
// hanya perlu cukup lama untuk menghalang penghantaran berganda -- 8 minggu memberi
// jidar besar. Kunci diisih leksikografi: aman kerana isoWeekKey_ memad nombor
// minggu kepada 2 digit ("2026-W06" < "2026-W10").
function pruneDigestMarkers_() {
  const props = PropertiesService.getScriptProperties();
  const kunci = props.getKeys().filter(function (k) { return k.indexOf('DGSENT_') === 0; });
  if (kunci.length <= 8) return;
  kunci.sort();
  kunci.slice(0, kunci.length - 8).forEach(function (k) { props.deleteProperty(k); });
}
```

- [ ] **Step 4: Jalankan — mesti LULUS**

```bash
node selftest-node.js
node --check Code.js
```

- [ ] **Step 5: Mutation test (tujuh mutasi — termasuk semua yang dinamakan spec Seksyen 10)**

```js
// M1 -- gerbang konfigurasi:  if (!tgSedia && !gcSedia) return;
//        ->  if (!tgSedia || !gcSedia) return;
```
Jangkaan GAGAL: `Telegram separuh dikonfig -> Chat SAHAJA tetap dihantar`, `Chat tak dikonfig -> Telegram SAHAJA tetap dihantar`.

```js
// M2 -- penapis saluran Telegram dibuka luas:
//   const tgEvents = events.filter(function (e) { return e.shareChannels.indexOf('tg') !== -1; });
//   ->  const tgEvents = events.filter(function () { return true; });
```
Jangkaan GAGAL: `digest Telegram = aktiviti tg + dua-saluran SAHAJA`, `aktiviti TIADA saluran tak masuk mana-mana digest`, `KEDUA-DUA senarai saluran kosong -> skip SENYAP`.

```js
// M2b -- SILANG SALURAN (mutasi yang spec Seksyen 10 tuntut):
//   dalam penapis tgEvents, tukar indexOf('tg')  ->  indexOf('gchat')
```
Jangkaan GAGAL: `digest Telegram = aktiviti tg + dua-saluran SAHAJA`, `tiada aktiviti gchat -> sink Chat TIDAK dipanggil langsung`, `tiada aktiviti tg -> sink Telegram TIDAK dipanggil langsung`.
Mutasi ni penting sebab ia **tidak** mengubah bilangan mesej yang dihantar dalam kes biasa — hanya isi kandungannya. Ujian yang cuma mengira panggilan `fetch` tak akan menangkapnya.

```js
// M2c -- buang gerbang senarai kosong per sink:
//   if (tgSedia && tgEvents.length)  ->  if (tgSedia)
```
Jangkaan GAGAL: `tiada aktiviti tg -> sink Telegram TIDAK dipanggil langsung`.

```js
// M3 -- urutan penanda: alihkan props.setProperty(kunci, ...) ke ATAS blok sink
```
Jangkaan GAGAL: `penanda DGSENT_ belum wujud pada masa fetch pertama`.

```js
// M4 -- set penanda walau minggu kosong: alihkan
//        `if (!tgEvents.length && !gchatEvents.length) return;` ke BAWAH blok setProperty
```
Jangkaan GAGAL: `KEDUA-DUA senarai saluran kosong -> skip SENYAP dan TIDAK set penanda`.

```js
// M5 -- prune terlalu agresif:  if (kunci.length <= 8) return;  ->  if (kunci.length <= 2) return;
//        dan  kunci.length - 8  ->  kunci.length - 2
```
Jangkaan GAGAL: `pruneDigestMarkers_ kekalkan 8 penanda TERBAHARU sahaja`.

Pulih selepas setiap mutasi.

- [ ] **Step 6: Commit**

```bash
node selftest-node.js && node --check Code.js && grep -c $'\r' Code.js selftest-node.js
git add Code.js selftest-node.js
git commit -m "feat(digest): handler mingguan sendWeeklyDigest_ (tapis per saluran) + prune DGSENT_"
```

**Siap bila:** aliran penuh spec Seksyen 6 dilaksanakan dan diuji (guard konfigurasi, dua penapis saluran, satu-saluran-sahaja, sekali-seminggu, urutan penanda, kegagalan tak meletup, prune); tujuh mutasi terbukti gagal — termasuk silang saluran yang tidak mengubah bilangan mesej.

---

## Task 12: Skrin System Settings — 8 kawalan broadcast/digest

**Files:**
- Modify: `Index.html` — `renderSettings` (baris ~467-487), `saveSettingsUI` (~488-500)
- Modify: `selftest-node.js` — ujian bentuk sumber

**Interfaces:**
- Consumes: `projectSystemSettings_` (Task 9) — `broadcastTgTokenSet`, `broadcastGchatSet`, `broadcastGchatCount`, `broadcastTgChatIds`, `digestDay`, `digestHour`, `digestMinute`.
- Produces: payload `updateSystemSettings` kini membawa `broadcastTgToken`, `clearTgToken`, `broadcastTgChatIds`, `broadcastGchatWebhooks`, `clearGchatWebhooks`, `digestDay`, `digestHour`, `digestMinute`.

- [ ] **Step 1: Tulis ujian yang GAGAL dahulu** — dalam `selftest-node.js`, selepas blok `ujianBorangKongsi`:

```js
(function ujianSettingsBroadcast() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const render = sliceBody(html, 'function renderSettings(){', '\nfunction saveSettingsUI');
  const save = sliceBody(html, 'function saveSettingsUI(btn){', '\nfunction ');

  ok('settings ada medan token Telegram jenis password (tak terpapar di skrin)',
     /id="setTgToken"[^>]*type="password"|type="password"[^>]*id="setTgToken"/.test(stripComments(render)));
  ok('settings TIDAK cuba mengisi semula nilai token/webhook (write-only)',
     render.indexOf('s.broadcastTgToken') === -1 && render.indexOf('s.broadcastGchatWebhooks') === -1);
  ok('settings papar BENDERA "sudah diset" untuk token & webhook',
     render.indexOf('s.broadcastTgTokenSet') !== -1 && render.indexOf('s.broadcastGchatSet') !== -1);
  ok('settings ada checkbox padam untuk kedua-dua rahsia',
     /id="setClearTgToken"/.test(render) && /id="setClearGchat"/.test(render));
  ok('settings ada dropdown hari/jam/minit digest',
     /id="setDigestDay"/.test(render) && /id="setDigestHour"/.test(render) && /id="setDigestMinute"/.test(render));
  ok('dropdown hari guna nama Melayu bermula Ahad',
     /Ahad/.test(render) && /Sabtu/.test(render));

  ok('saveSettingsUI hantar lapan medan broadcast/digest',
     /broadcastTgToken\s*:/.test(save) && /clearTgToken\s*:/.test(save) &&
     /broadcastTgChatIds\s*:/.test(save) && /broadcastGchatWebhooks\s*:/.test(save) &&
     /clearGchatWebhooks\s*:/.test(save) && /digestDay\s*:/.test(save) &&
     /digestHour\s*:/.test(save) && /digestMinute\s*:/.test(save));
  ok('saveSettingsUI hantar digestDay/Hour/Minute sebagai NOMBOR (parseInt)',
     /digestDay\s*:\s*parseInt\(/.test(save) && /digestHour\s*:\s*parseInt\(/.test(save) &&
     /digestMinute\s*:\s*parseInt\(/.test(save));
})();
```

- [ ] **Step 2: Jalankan — mesti GAGAL**

```bash
node selftest-node.js; echo "exit=$?"
```

- [ ] **Step 3: Tambah medan dalam `renderSettings`** — sisip SELEPAS medan `WAKTU HANTAR REMINDER` (baris ~480), sebelum medan `DOMAIN EMAIL DIBENARKAN`:

```js
        <div class="field wide" style="border-top:1px solid var(--line);padding-top:14px"><label>DIGEST MINGGUAN KE IBU BAPA / MURID</label><div class="eventSub">Aktiviti yang ditanda <b>Kongsi ke Telegram</b> / <b>Kongsi ke Google Chat</b> dihantar sekali seminggu ke saluran masing-masing. Kosongkan token/webhook untuk mengekalkan nilai tersimpan.</div></div>
        <div class="field wide"><label>TOKEN BOT TELEGRAM</label><input id="setTgToken" type="password" autocomplete="new-password" placeholder="${s.broadcastTgTokenSet?'••••• tersimpan — isi untuk ganti':'123456789:AA… dari @BotFather'}"><div class="eventSub">${s.broadcastTgTokenSet?'✅ Token sudah tersimpan.':'⚠️ Belum diset — digest Telegram tidak akan dihantar.'} <label style="font-weight:normal;letter-spacing:normal"><input id="setClearTgToken" type="checkbox" style="width:auto;margin:0 4px 0 10px"> padam token tersimpan</label></div></div>
        <div class="field wide"><label>CHAT ID GROUP TELEGRAM</label><input id="setTgChatIds" value="${attr(s.broadcastTgChatIds||'')}" placeholder="-1001234567890, -1009876543210"><div class="eventSub">Dipisah koma. ID group biasanya nombor negatif — dapatkan dari <code>api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code>.</div></div>
        <div class="field wide"><label>WEBHOOK GOOGLE CHAT</label><input id="setGchatWebhooks" type="password" autocomplete="new-password" placeholder="${s.broadcastGchatSet?'••••• '+s.broadcastGchatCount+' webhook tersimpan — isi untuk ganti':'https://chat.googleapis.com/v1/spaces/…'}"><div class="eventSub">${s.broadcastGchatSet?'✅ '+s.broadcastGchatCount+' webhook tersimpan.':'⚠️ Belum diset — digest Google Chat tidak akan dihantar.'} <label style="font-weight:normal;letter-spacing:normal"><input id="setClearGchat" type="checkbox" style="width:auto;margin:0 4px 0 10px"> padam webhook tersimpan</label></div></div>
        <div class="field"><label>HARI HANTAR DIGEST</label><select id="setDigestDay">${['Ahad','Isnin','Selasa','Rabu','Khamis','Jumaat','Sabtu'].map((n,i)=>`<option value="${i}" ${Number(s.digestDay)===i?'selected':''}>${n}</option>`).join('')}</select></div>
        <div class="field"><label>JAM DIGEST</label><select id="setDigestHour">${Array.from({length:24},(_,h)=>`<option value="${h}" ${Number(s.digestHour)===h?'selected':''}>${String(h).padStart(2,'0')}</option>`).join('')}</select></div>
        <div class="field"><label>MINIT DIGEST</label><select id="setDigestMinute">${[0,15,30,45].map(m=>`<option value="${m}" ${Number(s.digestMinute)===m?'selected':''}>${String(m).padStart(2,'0')}</option>`).join('')}</select><div class="eventSub">Apps Script menghantar dalam tetingkap lebih kurang ±15 minit dari waktu ini.</div></div>
```

- [ ] **Step 4: Tambah medan dalam `saveSettingsUI`** — dalam objek `p`, selepas `reminderHour:parseInt(setReminderHour.value,10)` (tambah koma):

```js
    reminderHour:parseInt(setReminderHour.value,10),
    broadcastTgToken:setTgToken.value.trim(),
    clearTgToken:setClearTgToken.checked,
    broadcastTgChatIds:setTgChatIds.value.trim(),
    broadcastGchatWebhooks:setGchatWebhooks.value.trim(),
    clearGchatWebhooks:setClearGchat.checked,
    digestDay:parseInt(setDigestDay.value,10),
    digestHour:parseInt(setDigestHour.value,10),
    digestMinute:parseInt(setDigestMinute.value,10)
```

- [ ] **Step 5: Jalankan — mesti LULUS**

```bash
node selftest-node.js
grep -c $'\r' Index.html
```

- [ ] **Step 6: Mutation test (dua mutasi)**

```js
// M1 -- Index.html: tukar placeholder token jadi nilai sebenar:
//        placeholder="${s.broadcastTgToken||''}"
```
Jangkaan GAGAL: `settings TIDAK cuba mengisi semula nilai token/webhook (write-only)`.
(Nota: ini juga akan gagal di server — `projectSystemSettings_` tak pernah hantar medan itu — jadi UI hanya papar kosong. Ujian menangkap NIAT yang salah sebelum ia jadi kebocoran.)

```js
// M2 -- Index.html: hantar digestHour sebagai string:
//        digestHour:setDigestHour.value
```
Jangkaan GAGAL: `saveSettingsUI hantar digestDay/Hour/Minute sebagai NOMBOR (parseInt)`.

Pulih selepas setiap mutasi (`git checkout -- Index.html`).

- [ ] **Step 7: Semakan visual manual (master atau pelaksana, di `@HEAD`)**

Belum boleh dilakukan sebelum deploy — direkod di sini sebagai sebahagian daripada checklist Task 14 langkah 4. **Jangan tandakan task ni siap berdasarkan andaian UI kelihatan betul.**

- [ ] **Step 8: Commit**

```bash
node selftest-node.js && grep -c $'\r' Index.html selftest-node.js
git add Index.html selftest-node.js
git commit -m "feat(settings): UI digest mingguan -- token/webhook write-only + jadual hari/jam/minit"
```

**Siap bila:** lapan kawalan wujud, ujian bentuk hijau, dan tiada rujukan kepada `s.broadcastTgToken`/`s.broadcastGchatWebhooks` di mana-mana dalam `Index.html`.

---

## Task 13: Dokumentasi (SETUP + PANDUAN-GURU)

Ikut aliran docs master: **kemas kini `.md` DULU, kemudian pantulkan ke `.html`.** `SETUP.html` dan `docs/index.html` ialah salinan bergaya yang disunting tangan — bukan output yang dijana — jadi ia mesti dikemas kini secara manual dan **tidak boleh** dijana semula.

**Files:**
- Modify: `SETUP.md` — seksyen baharu selepas `## Langkah 7 — Luluskan pengguna` (baris ~116-132), dan nota dalam `## Nota Keselamatan` (~145)
- Modify: `SETUP.html` — pantulkan seksyen yang sama selepas `<h3>Langkah 7 …</h3>` (~198) dan dalam `<h2>Nota Keselamatan</h2>` (~219)
- Modify: `docs/PANDUAN-GURU.md` — perenggan dalam `## Langkah 8 — Siapkan sistem (Setup Wizard)` (~118) atau seksyen ringkas baharu sebelum `## Langkah 9`
- Modify: `docs/index.html` — pantulkan perenggan yang sama dalam blok langkah 8/9

**Interfaces:** tiada kod.

- [ ] **Step 1: `SETUP.md` — tambah seksyen baharu selepas Langkah 7**

Kandungan wajib (tulis penuh, jangan ringkaskan):

```markdown
## Langkah 8 (pilihan) — Digest mingguan ke Telegram & Google Chat

Sistem boleh menghantar satu senarai aktiviti sekali seminggu kepada **ibu bapa**
(group Telegram) dan **murid** (Google Chat Space). Setiap aktiviti ada **dua
checkbox bebas** dalam borang: **"Kongsi ke Telegram"** dan **"Kongsi ke Google
Chat"** — guru boleh pilih satu, kedua-dua, atau tiada. Hanya **tajuk, tarikh dan
lokasi** dihantar — PIC, agensi dan keterangan dalaman tidak pernah keluar.

Langkau seksyen ni sepenuhnya kalau sekolah anda tak perlukan saluran keluar.

### 8.1 Sediakan bot Telegram

1. Buka Telegram, cari **@BotFather**, hantar `/newbot`, ikut arahan. Salin token
   yang diberi (bentuk `123456789:AA…`).
2. Tambah bot itu ke setiap group ibu bapa yang hendak menerima digest.
3. Dapatkan `chat_id` setiap group: hantar satu mesej dalam group, kemudian buka
   `https://api.telegram.org/bot<TOKEN>/getUpdates` dalam pelayar dan salin
   `result[].message.chat.id` (nombor **negatif**, cth `-1001234567890`).

> ⚠️ Kalau *privacy mode* bot masih ON (lalai), `getUpdates` mungkin tak
> memaparkan mesej biasa. Hantar `/start@namabot` dalam group, atau tambah
> `@RawDataBot` sementara untuk membaca `chat_id`.

### 8.2 Sediakan webhook Google Chat

1. Buka Space yang dikehendaki dalam Google Chat.
2. Nama Space → **Apps & integrations** → **Webhooks** → **Add webhooks**.
3. Beri nama (cth "Takwim Sekolah"), salin URL yang bermula
   `https://chat.googleapis.com/v1/spaces/…`.

### 8.3 Isi tetapan

Dashboard → **System Settings** → bahagian **Digest mingguan ke ibu bapa / murid**:

| Medan | Isi |
|-------|-----|
| Token bot Telegram | token dari 8.1 (medan ini **write-only** — nilai tersimpan tak pernah dipaparkan semula) |
| Chat ID group Telegram | senarai `chat_id` dipisah koma |
| Webhook Google Chat | URL dari 8.2, dipisah koma kalau lebih satu (**write-only**) |
| Hari / Jam / Minit | bila digest dihantar (lalai Ahad 07:45) |

Tekan **Simpan Tetapan** — trigger mingguan dicipta automatik.

### 8.4 Beri kebenaran sekali sahaja

Digest menggunakan perkhidmatan **permintaan luar** (`UrlFetchApp`) yang belum
pernah dipakai sistem ini. Buka Apps Script Editor → pilih fungsi
**`sendWeeklyDigest_`** → **Run** → **Allow** pada skrin kebenaran.

Tanpa langkah ni, trigger mingguan akan gagal **secara senyap**. Hanya pemilik
script (Super Admin) perlu melakukannya; guru lain tidak terjejas.

### 8.5 Uji

Tanda satu aktiviti akan datang dengan **kedua-dua** checkbox saluran, kemudian Run
`sendWeeklyDigest_` sekali lagi. Mesej sepatutnya masuk ke group Telegram **dan**
Space Chat. Ulang dengan **satu** checkbox sahaja ditanda dan sahkan mesej pergi ke
saluran itu **sahaja**.

> Digest hanya dihantar **sekali seminggu**: selepas berjaya, sistem merekod
> penanda minggu itu. Untuk menguji berkali-kali dalam minggu yang sama, buang
> kunci `DGSENT_…` dalam **Project Settings → Script Properties**.
```

- [ ] **Step 2: `SETUP.md` — tambah dalam `## Nota Keselamatan`**

```markdown
- **Token Telegram & URL webhook Chat** disimpan dalam Script Properties sahaja.
  Ia tidak pernah dipulangkan ke pelayar, tidak pernah masuk ke dalam log audit,
  dan tidak wujud dalam repositori. Medan UI-nya **write-only**: kosong bermakna
  "kekalkan yang tersimpan", dan ada checkbox berasingan untuk memadamnya.
- URL webhook Google Chat ditolak kecuali ia bermula
  `https://chat.googleapis.com/v1/spaces/` — satu salah taip tidak boleh
  menghantar takwim sekolah ke pelayan orang lain.
```

- [ ] **Step 3: `SETUP.html` — pantulkan Step 1 & 2**

Salin struktur `<h3>`/`<p>`/`<table>` dari langkah sekitarnya. Jangan cipta gaya baharu; guna kelas sedia ada dalam fail itu. Bahagian Bahasa Inggeris (`# Setup Guide — Takwim Digital (English)` dalam `SETUP.md` dan blok `<h2>Overview</h2>` ke bawah dalam `SETUP.html`) **juga** perlukan seksyen padanan — tulis versi Inggeris ringkas bagi 8.1–8.5.

- [ ] **Step 4: `docs/PANDUAN-GURU.md` — perenggan untuk cikgu**

```markdown
## Kongsi aktiviti dengan ibu bapa & murid (pilihan)

Dalam borang **Tambah / Edit Aktiviti** ada dua checkbox: **"Kongsi ke Telegram"**
dan **"Kongsi ke Google Chat"**. Bila ditanda, aktiviti itu akan masuk dalam
senarai ringkas yang dihantar sekali seminggu ke saluran berkenaan.

- Boleh pilih **satu sahaja**, kedua-dua, atau tiada langsung.
- Lalai **tidak** bertanda — aktiviti dalaman kekal dalaman.
- Hanya **tajuk, tarikh dan lokasi** dihantar keluar. PIC, agensi dan keterangan
  tidak pernah dikongsi.
- Digest hanya keluar kalau Super Admin sudah menyiapkan tetapan Telegram/Chat
  (Langkah 8 dalam panduan pemasangan).
```

- [ ] **Step 5: `docs/index.html` — pantulkan Step 4** dengan gaya blok langkah sedia ada.

- [ ] **Step 6: Semakan silang docs lawan kod**

```bash
grep -n "Kongsi ke Telegram\|Kongsi ke Google Chat" SETUP.md SETUP.html docs/PANDUAN-GURU.md docs/index.html Index.html
grep -n "sendWeeklyDigest_" SETUP.md SETUP.html
grep -c $'\r' SETUP.md SETUP.html docs/PANDUAN-GURU.md docs/index.html
```

Sahkan: kedua-dua label checkbox dalam docs **sama tepat** dengan label dalam `Index.html` (dan tiada "(ibu bapa)"/"(murid)" ditambah — keputusan master Rev.1); nama fungsi `sendWeeklyDigest_` dieja betul (dokumen menyuruh master menaipnya dalam editor); semua fail lapor `0` CRLF.

- [ ] **Step 7: Commit**

```bash
git add SETUP.md SETUP.html docs/PANDUAN-GURU.md docs/index.html
git commit -m "docs: panduan digest mingguan Telegram + Google Chat"
```

**Siap bila:** kelima-lima fail dokumen selari, label UI padan, `grep` CRLF sifar.

---

## Task 14: Verify penuh + pipeline Kata (seal → deploy bergerbang)

Task ni **tiada kod baharu**. Ia gerbang terakhir.

**Files:** tiada perubahan kod dijangka. Kalau semakan menemui isu, betulkan dan commit berasingan sebelum meneruskan.

- [ ] **Step 1: Gerbang automatik penuh**

```bash
cd /c/Users/user/Documents/code/takwim-digital
node --check Code.js
node selftest-node.js
grep -c $'\r' Code.js Index.html selftest-node.js SETUP.md SETUP.html docs/PANDUAN-GURU.md docs/index.html
git status --short
git log --oneline -14
```

Jangkaan: `node --check` senyap; `0 GAGAL`; setiap fail `0`; 13 commit ciri (Task 1-13) di atas `d6984a3`.

`git status --short` sepatutnya menunjukkan **tepat satu** baris: `?? PLAN-telegram-gchat-digest.md`. Fail plan ini SENGAJA tidak di-commit — ia untuk semakan master, bukan sebahagian repo public. Sebab itu setiap task menggunakan `git add <fail>` yang eksplisit dan **tidak pernah** `git add -A`.

- [ ] **Step 2: Semakan silang nama fungsi (elak jaminan palsu)**

```bash
grep -n "sendWeeklyDigest_\|syncDigestTrigger_\|installDigestTrigger_" Code.js
grep -n "shareChannels\|shareTg\|shareGchat\|'tg'\|'gchat'" Code.js Index.html
```

Sahkan: rentetan `'sendWeeklyDigest_'` dalam `syncDigestTrigger_` **sama tepat** dengan nama fungsi sebenar (satu huruf salah = trigger yang tak pernah menyala, dan tiada ujian boleh menangkapnya di sisi Apps Script); `shareChannels` dieja sama di server dan client; nama saluran ialah `'tg'`/`'gchat'` di SETIAP tempat (tiada `'telegram'` atau `'chat'` menyelinap masuk — satu ejaan berbeza = saluran yang senyap selama-lamanya).

- [ ] **Step 3: `sight-hone` — semakan kod baharu sahaja**

Jalankan skill `sight-hone` ke atas diff `d6984a3..HEAD`. Betulkan penemuan sebagai commit berasingan (`fix(...)`), kemudian ulang Step 1.

- [ ] **Step 4: `cross-ai-julius` — mata kedua**

Jalankan skill `cross-ai-julius` untuk **menjana prompt**. Master yang tampal prompt itu ke Gemini secara manual dan membawa balik jawapannya. Sertakan dalam prompt: `sendWeeklyDigest_`, kedua-dua sink, `mergeSettingsInput_`, `projectSystemSettings_`, dan soalan TERBUKA ("apa yang boleh gagal secara senyap di sini?"), bukan soalan berfokus sahaja.

⛔ **Berhenti di sini dan tunggu master.** Jangan teruskan ke Step 5 sebelum master memberi jawapan Julius atau berkata teruskan.

- [ ] **Step 5: `commit-seal`**

Jalankan skill `commit-seal`. Ia checklist wajib sebelum kod meninggalkan mesin ini.

- [ ] **Step 6: Push**

```bash
git push origin master
```

- [ ] **Step 7: Deploy ke makmal master (`@HEAD`) — bukan production**

```bash
clasp push -f
```

`@HEAD` = `AKfycbx9-4N8GgMoyM4T_RVxQQU5oVP713C297qhCRp88sBj` mengikut `clasp push` secara automatik. Beritahu master bahawa versi makmal sudah sedia untuk dicuba.

- [ ] **Step 8: Checklist smoke MANUAL master di `@HEAD`** (master yang jalankan, pada peranti yang dia sebutkan)

0. **DAHULUKAN INI — sebelum semua ujian lain.** Apps Script Editor → buka pemilih fungsi (dropdown sebelah **Run**/**Debug**) → **adakah `sendWeeklyDigest_` tersenarai?**
   - **Ya** → pilih ia → **Run** → **Allow** pada skrin kebenaran.
   - **Tidak** (nama berakhir garis bawah dianggap *private*, jadi editor mungkin menyembunyikannya) → pilih mana-mana fungsi **awam** yang sedia ada, contoh `getSystemSettings` → **Run** → **Allow**. Abaikan ralat hujah yang muncul selepas itu; yang penting ialah geran OAuth, dan ia diberi kepada **keseluruhan script**.
   - ⚠️ **JANGAN** cipta fungsi awam baharu sebagai pembalut — deployment `access: DOMAIN` bermakna mana-mana pengguna domain boleh memanggilnya melalui `google.script.run` dan mencetuskan siaran ke group ibu bapa.
   - **Catat fungsi mana yang digunakan** dalam laporan. Ini kali PERTAMA projek ni cuba Run-dari-editor (trigger reminder dulu sentiasa dicipta melalui butang UI), jadi jawapannya belum pernah diketahui.
   - Kenapa didahulukan: kebenaran BAHARU menahan **semua trigger milik pemilik**, termasuk trigger peringatan harian `sendActivityReminders_` yang sudah dipakai ibu bapa & guru. Sehingga **Allow** ditekan, ia turut gagal — senyap. (Selepas nombor 0 selesai, nombor 5 di bawah sudah terpenuhi.)
1. **System Settings** buka tanpa ralat; medan token/webhook kosong dan menunjukkan status "Belum diset".
2. Isi token + `chat_id` + webhook + Ahad/07/45 → **Simpan Tetapan** → toast berjaya.
3. Buka semula System Settings → medan token/webhook **masih kosong**, tetapi status kini "✅ tersimpan"; `chat_id` terpapar semula.
4. Simpan sekali lagi **tanpa** mengisi token → buka semula → status masih "✅ tersimpan" (bukti kosong = kekalkan).
5. Apps Script Editor → **Run `sendWeeklyDigest_`** → skrin kebenaran → **Allow**.
6. Tanda satu aktiviti akan datang dengan **kedua-dua** checkbox saluran → Simpan → buka detail aktiviti → lencana `📣 Dikongsi: Telegram + Google Chat` kelihatan. Buka Edit semula → kedua-dua checkbox masih bertanda, dan kotak KETERANGAN **tiada** teks "Kongsi:".
7. Buka **Tambah Aktiviti** yang BAHARU → kedua-dua checkbox mesti **kosong** (bukti reset borang).
8. Run `sendWeeklyDigest_` → mesej masuk group Telegram **dan** Space Chat; semak isi: tajuk + tarikh Melayu + lokasi, **tiada** PIC/agensi.
9. Run `sendWeeklyDigest_` sekali lagi → **tiada** mesej kedua (penanda mingguan berfungsi).
9b. Padam kunci `DGSENT_…` (Project Settings → Script Properties), tanda satu aktiviti dengan **Telegram sahaja**, nyahtanda yang lain → Run → mesej masuk Telegram **SAHAJA**, Space Chat senyap. Ulang sebaliknya untuk Google Chat sahaja.
10. Apps Script → **Triggers** → ada tepat SATU trigger `sendWeeklyDigest_` (mingguan) dan SATU `sendActivityReminders_` (harian).

Laporkan keputusan setiap nombor **berserta peranti** yang digunakan.

- [ ] **Step 9: ⛔ GERBANG — deploy production**

**JANGAN jalankan langkah ni tanpa master berkata dengan jelas "deploy production".** Kelulusan dalam plan ini BUKAN kelulusan untuk deploy.

Bila (dan hanya bila) master beri kebenaran eksplisit:

```bash
clasp create-deployment -i AKfycbxEF2omj4UZF3jbykg6RCXuo7QFEVwqAsv-jYVOs01M-FMZhXU14M-5eG5Vb3F7SEybyg
```

Kemudian sahkan versi baharu muncul dan minta master menyemak URL production.

- [ ] **Step 10: Kemas kini memory projek**

Selepas deploy (atau selepas master menangguhkannya), tulis ke `MEMORY.md` projek `takwim-digital` — **cipta fail itu kalau belum wujud**, ikut format memory per-projek master:

- Status semasa (nombor deployment, keputusan suite, apa yang LIVE dan apa yang belum).
- Prasyarat manual yang mesti berlaku sekali: master Run `sendWeeklyDigest_` untuk kebenaran `UrlFetchApp`.
- Gotcha: `nearMinute` ialah tetingkap ±15 minit; `DGSENT_` mesti dipadam secara manual untuk menguji dua kali dalam minggu yang sama.
- Sebab `digestEndDate_` wujud berasingan dari `displayEndDate` (dua runtime) dan bahawa ujian kembar mempolisnya.

**Siap bila:** semua gerbang automatik hijau, `sight-hone` dan `cross-ai-julius` selesai, master telah menjalankan checklist smoke dan melaporkan keputusannya, dan deploy production sama ada diluluskan secara eksplisit atau ditangguhkan dengan sengaja.

---

## Self-review (dijalankan semasa plan ditulis)

**Liputan spec** — setiap seksyen spec dipetakan ke task:

| Spec | Task |
|------|------|
| §4 senarai 15 fungsi baharu | T3 (4), T4 (label+`digestEndDate_`), T5 (`buildDigestText_`), T8 (`weekDayEnum_`, `syncDigestTrigger_`), T10 (2 sink), T11 (`sendWeeklyDigest_`, `pruneDigestMarkers_`), T2 (`clampDigestDay_`, `clampMinute_`), T3 (`selfTestDigestHelpers_`) |
| §5.1 baris senarai saluran `Kongsi:` + `cleanDescription_` WAJIB buang | T6 (termasuk mutasi M2 yang spec tuntut) |
| §5.2 enam kunci `DEFAULT_CONFIG` | T2 (kunci) + T9 (validasi & plumbing) |
| §5.3 `DGSENT_` + prune 8 | T11 |
| §6 aliran 11 langkah | T11 |
| §7 format mesej | T4 + T5 |
| §8.1 rahsia / write-only | T9 (server) + T12 (UI) |
| §8.2 sasaran admin sahaja | sedia ada (`requireSession_(token,'canManageUsers')`) — disahkan tidak berubah dalam T9 |
| §8.3 best-effort + migrasi chat_id | T10 |
| §8.4 kandungan terhad | T5 (gerbang kebocoran) |
| §8.5 skop OAuth | T13 (docs) + T14 Step 8.5 |
| §9 prasyarat manual master | T13 §8.1–8.5 + T14 Step 8 |
| §10 jadual ujian + **6 mutasi wajib** | T3–T11. Pemetaan mutasi spec: guard token → **T10 M1**; `&&`→`||` guard konfigurasi → **T11 M1**; penapis Telegram dibuka luas → **T11 M2**; silang saluran `'tg'`→`'gchat'` → **T11 M2b**; buang `Kongsi:` dari `cleanDescription_` → **T6 M2**; penanda `DGSENT_` sebelum hantar → **T11 M3** |
| §11 fail disentuh | T6/T7/T9/T12 (`Code.js`, `Index.html`), T13 (docs) |

**Jurang yang sengaja dibiarkan:** Setup Wizard (keputusan 8 di atas); `getSystemSettings`/`updateSystemSettings` tidak diuji melalui sesi sebenar (logik berisiko diekstrak jadi fungsi tulen — keputusan 9).

**Ketekalan jenis:** dua bendera **boolean** masuk (`payload.shareTg === true`, `payload.shareGchat === true`) → satu **string** senarai dalam description (`Kongsi: tg,gchat`) → satu **array** keluar di setiap lapisan bacaan (`meta.shareChannels`, `e.shareChannels`, `holidayToObject_` → `[]` supaya `.indexOf()` dalam penapis tak pernah jumpa `undefined`). Nama saluran ialah `'tg'`/`'gchat'` — satu ejaan sahaja, ditakrifkan sekali dalam `SHARE_CHANNELS`. `digestDay/Hour/Minute` ialah integer dari `parseInt` di client hingga `clamp*` di server. Kedua-dua sink pulang `number`. `parseCsvList_` sentiasa pulang `string[]`.

---

## Cara melaksana

Plan ni disimpan LOKAL (`PLAN-telegram-gchat-digest.md`, tidak di-commit). Dua pilihan pelaksanaan:

1. **Subagent-driven (disyorkan)** — satu subagent segar per task, semakan antara task.
2. **Inline** — laksana dalam sesi ini dengan checkpoint per task.

Apa pun pilihannya: **satu task = satu commit**, dan mutation test tidak boleh dilangkau.
