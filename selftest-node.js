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
// Responder boleh pulang { error: 'mesej' } untuk mensimulasikan kegagalan rangkaian.
function fakeUrlFetch(responder) {
  const calls = [];
  return {
    calls: calls,
    api: {
      fetch: function (url, params) {
        calls.push({ url: url, params: params });
        const r = responder ? responder(url, params, calls.length) : {};
        if (r.error) throw new Error(r.error);
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

// --- sink (perlu UrlFetchApp + Properties palsu) ----
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

  // (f) Kegagalan rangkaian (DNS, timeout, SSL) throw exception -- JANGAN bocorkan URL/token
  const p6 = fakeProps({ APP_CONFIG_V3: CFG_UJI });
  const f6 = fakeUrlFetch(function () {
    // Simulasi kegagalan rangkaian: fetch throws dengan mesej yang boleh mengandungi URL+token
    return { error: 'Failed to resolve host: got getaddrinfo error for api.telegram.org with bottoken:XXX in URL' };
  });
  const a6 = loadCode(['sendToTelegram_'], { UrlFetchApp: f6.api,
    PropertiesService: { getScriptProperties: function () { return p6.api; } } });
  a6.sendToTelegram_('teks', TOKEN_UJI, '-100123, -100456');
  const rows6 = auditRows(p6);
  ok('sendToTelegram_ kegagalan rangkaian menghasilkan 2 audit (bukan 0 atau 1)',
     rows6.length === 2);
  ok('AUDIT kegagalan rangkaian TIDAK bocorkan token (tiada ' + TOKEN_UJI + ' dalam audit)',
     JSON.stringify(rows6).indexOf(TOKEN_UJI) === -1 && JSON.stringify(rows6).indexOf('123456789:') === -1 &&
     JSON.stringify(rows6).indexOf('getaddrinfo') === -1);
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

  // Kegagalan rangkaian (DNS, timeout, SSL) throw exception -- JANGAN bocorkan URL/kunci
  const p4 = fakeProps({ APP_CONFIG_V3: CFG_UJI });
  const f4 = fakeUrlFetch(function () {
    // Simulasi kegagalan rangkaian: fetch throws dengan mesej yang boleh mengandungi URL+kunci
    return { error: 'CERTIFICATE_VERIFY_FAILED: unable to verify the first certificate, URL was https://chat.googleapis.com/v1/spaces/AAQZxK/messages?key=KUNCI&token=RAHSIA' };
  });
  const a4 = loadCode(['sendToGoogleChat_'], { UrlFetchApp: f4.api,
    PropertiesService: { getScriptProperties: function () { return p4.api; } } });
  a4.sendToGoogleChat_('teks', HOOK_UJI + ', ' + HOOK_UJI);
  const rows4 = auditRows(p4);
  ok('sendToGoogleChat_ kegagalan rangkaian menghasilkan 2 audit (bukan 0 atau 1)',
     rows4.length === 2);
  ok('AUDIT kegagalan rangkaian TIDAK bocorkan kunci (tiada KUNCI/RAHSIA dalam audit)',
     JSON.stringify(rows4).indexOf('KUNCI') === -1 && JSON.stringify(rows4).indexOf('RAHSIA') === -1 &&
     JSON.stringify(rows4).indexOf('CERTIFICATE_VERIFY_FAILED') === -1);
})();

// ---- laporan ------------------------------------------------------------

const summary = results.join('\n');
console.log(summary);
const failed = results.filter(function (r) { return r.indexOf('FAIL') === 0; }).length;
console.log('\n' + (results.length - failed) + ' LULUS, ' + failed + ' GAGAL');
if (failed) process.exit(1);
