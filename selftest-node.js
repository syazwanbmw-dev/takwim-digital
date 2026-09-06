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
runSuite('selfTestDigestHelpers_');

// ---- ujian orkestrasi (perlu objek palsu -- tak boleh hidup dalam Code.js) ----
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

// ---- laporan ------------------------------------------------------------

const summary = results.join('\n');
console.log(summary);
const failed = results.filter(function (r) { return r.indexOf('FAIL') === 0; }).length;
console.log('\n' + (results.length - failed) + ' LULUS, ' + failed + ' GAGAL');
if (failed) process.exit(1);
