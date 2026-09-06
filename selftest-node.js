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
