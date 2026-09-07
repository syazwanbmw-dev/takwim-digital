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
    // tryLock lalai BERJAYA supaya ujian yang tak menguji kunci (majoriti) tak perlu
    // tahu langsung pasal LockService -- ujian kunci-dipegang override ini sendiri.
    LockService: { getScriptLock: function () { return { tryLock: function () { return true; }, waitLock: function () {}, releaseLock: function () {} }; } },
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

// Sisi PARSE (parseShareChannels_) berlabuh pada permulaan baris, jadi "Kongsi:" di
// tengah ayat BUKAN penanda. Sisi BUANG (cleanDescription_) mesti berlabuh SAMA --
// kalau tidak, guru yang menaip "kongsi" sebagai perkataan Melayu biasa dalam
// KETERANGAN kehilangan separuh ayatnya pada simpanan berikutnya, senyap.
(function ujianKongsiBerlabuhSimetri() {
  const api = loadCode(['cleanDescription_', 'parseShareChannels_']);
  const ayat = 'Kita akan Kongsi: tg dgn PIBG nanti';
  ok('cleanDescription_ TIDAK potong "Kongsi:" di tengah ayat (prosa guru kekal utuh)',
     api.cleanDescription_(ayat) === ayat);
  ok('parseShareChannels_ dan cleanDescription_ berlabuh SAMA pada ayat yang sama',
     eq(api.parseShareChannels_(ayat), []) && api.cleanDescription_(ayat) === ayat);
  // Berpasangan: pagar baharu tak boleh melembikkan kes yang memang patut dibuang.
  ok('cleanDescription_ TETAP buang baris penanda Kongsi yang sebenar',
     api.cleanDescription_('Perhimpunan bulanan\nKongsi: tg,gchat') === 'Perhimpunan bulanan' &&
     api.cleanDescription_('Kongsi: gchat') === '');
})();

(function ujianSettingsBroadcast() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const render = sliceBody(html, 'function renderSettings(){', '\nfunction saveSettingsUI');
  const save = sliceBody(html, 'function saveSettingsUI(btn){', '\nfunction ');

  ok('settings ada medan token Telegram jenis password (tak terpapar di skrin)',
     /id="setTgToken"[^>]*type="password"|type="password"[^>]*id="setTgToken"/.test(stripComments(render)));
  ok('settings TIDAK cuba mengisi semula nilai token/webhook (write-only)',
     !/[^a-zA-Z0-9_]s\.broadcastTgToken[^a-zA-Z0-9_]/.test(render) && !/[^a-zA-Z0-9_]s\.broadcastGchatWebhooks[^a-zA-Z0-9_]/.test(render));
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

// Medan TOKEN bertaip password, jadi token yang tersalah tampal ke dalam medan
// CHAT ID sebelahnya TIDAK KELIHATAN oleh admin. Nilai itu gagal validasi chat_id --
// dan kalau mesej ralat mengulang nilainya, token penuh mendarat dalam toast UI DAN
// dalam rekod eksekusi Cloud Logging. Ralat mesti sebut NOMBOR entri sahaja.
(function ujianRalatChatIdTidakUlangNilai() {
  const api = loadCode(['validateSetupInput_']);
  const asas = {
    appName: 'Takwim', officeName: 'SK Salor', shortName: 'SKS',
    timezone: 'Asia/Kuala_Lumpur', calendarId: 'x@group.calendar.google.com',
    adminEmail: 'admin@sekolah.edu.my', themeColor: '#0b6ef3'
  };
  const TOKEN_TERSALAH_TAMPAL = '123456789:AAHdqTcvbXcvbXcvbXcvbXcvbXcvbXcvbXc';
  let mesej = '';
  try {
    api.validateSetupInput_(Object.assign({}, asas,
      { broadcastTgChatIds: '-100123, ' + TOKEN_TERSALAH_TAMPAL }));
  } catch (e) { mesej = e.message; }
  ok('validateSetupInput_ TOLAK token yang tersalah tampal dalam medan chat_id',
     mesej.indexOf('chat_id') !== -1);
  ok('mesej ralat chat_id TIDAK memuatkan nilai itu sendiri (token boleh mendarat di sini)',
     mesej !== '' && mesej.indexOf(TOKEN_TERSALAH_TAMPAL) === -1 && mesej.indexOf('AAHdq') === -1);
  ok('mesej ralat chat_id sebut NOMBOR entri supaya admin tahu yang mana rosak',
     /#2/.test(mesej));
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

// addAudit_ sendiri pegang LockService.getScriptLock().waitLock(). LockService palsu
// ni buat waitLock GAGAL pada panggilan PERTAMA sahaja (macam LockService.waitLock
// tamat masa atas satu addAudit_ tunggal), lepas tu pulih -- supaya kita boleh
// buktikan sasaran PERTAMA punya addAudit_ meletup tanpa membutakan sasaran lain.
function fakeLockGagalSekali() {
  let n = 0;
  return { getScriptLock: function () {
    return {
      tryLock: function () { return true; },
      waitLock: function () { n++; if (n === 1) throw new Error('LockService: waitLock tamat masa'); },
      releaseLock: function () {}
    };
  } };
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

  // (g) addAudit_ SENDIRI meletup pada sasaran PERTAMA -- sasaran KEDUA mesti tetap
  // dicuba. Ini yang bezakan gerbang ni drpd ujian (c) di atas: (c) buktikan fetch yang
  // gagal tak henti gelung; ujian ni buktikan addAudit_ yang gagal pun tak henti gelung.
  const p7 = fakeProps({ APP_CONFIG_V3: CFG_UJI });
  const f7 = fakeUrlFetch(function (url, params, n) {
    return n === 1 ? { code: 403, body: '{"ok":false,"description":"bot was kicked"}' } : {};
  });
  const a7 = loadCode(['sendToTelegram_'], { UrlFetchApp: f7.api,
    LockService: fakeLockGagalSekali(),
    PropertiesService: { getScriptProperties: function () { return p7.api; } } });
  let meletup7 = false;
  let berjaya7;
  try { berjaya7 = a7.sendToTelegram_('teks', TOKEN_UJI, '-100123, -100456'); } catch (e) { meletup7 = true; }
  ok('sendToTelegram_ addAudit_ gagal pada sasaran pertama -> TIDAK throw keluar dari sink',
     !meletup7);
  ok('sendToTelegram_ addAudit_ gagal pada sasaran pertama -> sasaran KEDUA tetap dicuba',
     f7.calls.length === 2 && berjaya7 === 1);
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

  // (e) addAudit_ SENDIRI meletup pada sasaran PERTAMA -- sasaran KEDUA mesti tetap
  // dicuba. Ini yang bezakan gerbang ni drpd ujian di atas: ujian di atas buktikan fetch
  // yang gagal tak henti gelung; ujian ni buktikan addAudit_ yang gagal pun tak henti gelung.
  const p5 = fakeProps({ APP_CONFIG_V3: CFG_UJI });
  const f5 = fakeUrlFetch(function (url, params, n) {
    return n === 1 ? { error: 'rangkaian putus' } : {};
  });
  const a5 = loadCode(['sendToGoogleChat_'], { UrlFetchApp: f5.api,
    LockService: fakeLockGagalSekali(),
    PropertiesService: { getScriptProperties: function () { return p5.api; } } });
  let meletup5 = false;
  let berjaya5;
  try { berjaya5 = a5.sendToGoogleChat_('teks', HOOK_UJI + ', ' + HOOK_UJI); } catch (e) { meletup5 = true; }
  ok('sendToGoogleChat_ addAudit_ gagal pada sasaran pertama -> TIDAK throw keluar dari sink',
     !meletup5);
  ok('sendToGoogleChat_ addAudit_ gagal pada sasaran pertama -> sasaran KEDUA tetap dicuba',
     f5.calls.length === 2 && berjaya5 === 1);
})();

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

(function ujianDigestSaluranBertandaBelumDikonfig() {
  // Jurang pelancaran sebenar: Telegram sudah dikonfig, Chat BELUM. Minggu ni satu-satunya
  // aktiviti bertanda ialah 'gchat'. Senarai GABUNGAN tidak kosong, jadi pagar lama
  // membenarkan aliran teruskan -- tetapi kedua-dua gerbang hantar palsu, jadi TIADA
  // apa dihantar sedangkan penanda DGSENT_ dibakar. Minggu itu hilang KEKAL (kecuali
  // Script Property dipadam manual) walaupun webhook Chat diisi kemudian.
  const hariIni = function (n) { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + n); x.setHours(9); return x; };
  const d = duniaDigest({
    cfg: { BROADCAST_TG_TOKEN: TOKEN_UJI, BROADCAST_TG_CHAT_IDS: '-100123', BROADCAST_GCHAT_WEBHOOKS: '' },
    events: [
      { id: 'g1', title: 'Kuiz Sains CHAT', description: 'Kongsi: gchat\n[PPD_CATEGORY:program]',
        location: 'Makmal', start: hariIni(1), end: hariIni(1), allDay: false }
    ]
  });
  d.api.sendWeeklyDigest_();
  ok('saluran bertanda BELUM dikonfig -> TIADA fetch langsung', d.fetch.calls.length === 0);
  ok('saluran bertanda BELUM dikonfig -> penanda DGSENT_ TIDAK dibakar (minggu masih boleh keluar)',
     d.props.store[kunciMingguIni(d.api)] === undefined);
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

(function ujianDigestKegagalanPropertiesTidakMeletup() {
  // Berbeza dari ujian rangkaian di atas: ini simulasi PropertiesService SENDIRI gagal
  // (kuota/servis terganggu) -- mod kegagalan Apps Script yang nyata dan didokumenkan.
  // getConfig_() ialah baris PERTAMA dalam try sendWeeklyDigest_, jadi getProperty yang
  // throw di situ mencetuskan catch. Dua panggilan getProperty PERTAMA gagal (lepas itu
  // servis "pulih"): panggilan #1 = getConfig_() dalam try; panggilan #2 = SAMA ADA
  // getConfig_() kedua dalam catch (kod LAMA -- ini akan throw SEBELUM addAudit_ sempat
  // dipanggil, sebab ia dinilai sebagai hujah) ATAU props.getProperty('PPD_AUDIT_V23')
  // dalam addAudit_ (kod BAIK -- ditangkap oleh try dalamannya sendiri, rows jadi []).
  // Kalau catch masih panggil getConfig_() lagi, pengecualian ke-2 ni lepaskan terus
  // keluar dari sendWeeklyDigest_ -- itulah dapatan pemeriksa.
  let panggilan = 0;
  const cfgJson = CFG_UJI;
  const propsAsas = fakeProps({ APP_CONFIG_V3: cfgJson });
  const getPropertyAsal = propsAsas.api.getProperty;
  propsAsas.api.getProperty = function (k) {
    panggilan++;
    if (panggilan <= 2) throw new Error('PropertiesService: servis terganggu buat sementara');
    return getPropertyAsal(k);
  };
  const api = loadCode(['sendWeeklyDigest_'], {
    PropertiesService: { getScriptProperties: function () { return propsAsas.api; } }
  });
  let meletup = false;
  try { api.sendWeeklyDigest_(); } catch (e) { meletup = true; }
  ok('kegagalan PropertiesService (bukan rangkaian) TIDAK melempar keluar dari handler trigger', !meletup);
  ok('kegagalan PropertiesService tetap diaudit sebagai DIGEST_RUN_FAILED',
     JSON.stringify(auditRows(propsAsas)).indexOf('DIGEST_RUN_FAILED') !== -1);
})();

(function ujianDigestKegagalanPropertiesBERTERUSAN() {
  // Ujian di atas membiarkan servis "pulih" selepas 2 panggilan -- ia TIDAK membuktikan
  // gangguan BERTERUSAN dapat ditanggung. Di sini SETIAP getProperty gagal, jadi
  // addAudit_ sendiri meletup dari dalam (addAudit_ baca PPD_AUDIT_V23, kemudian
  // getConfig_() untuk MAX_AUDIT_ROWS -- panggilan kedua itu TIDAK berpagar dalam
  // addAudit_). addAudit_ ialah kod sedia ada di luar skop; jadi sendWeeklyDigest_
  // yang mesti memagar panggilan auditnya sendiri. Kontrak: handler trigger tak
  // berjadual TIDAK BOLEH sekali-kali melempar keluar, walau audit pun hilang.
  const propsAsas = fakeProps({ APP_CONFIG_V3: CFG_UJI });
  propsAsas.api.getProperty = function () {
    throw new Error('PropertiesService: servis terganggu BERTERUSAN');
  };
  const api = loadCode(['sendWeeklyDigest_'], {
    PropertiesService: { getScriptProperties: function () { return propsAsas.api; } }
  });
  let meletup = false;
  try { api.sendWeeklyDigest_(); } catch (e) { meletup = true; }
  ok('kegagalan PropertiesService BERTERUSAN (audit pun gagal) TIDAK melempar keluar dari handler trigger',
     !meletup);
})();

(function ujianDigestKunciSerentak() {
  // Simulasi larian KEDUA yang tercetus semasa larian PERTAMA masih pegang kunci
  // (quirk trigger masa GAS berganda -- jarang, tapi didokumentasikan). Config +
  // kalendar di bawah SENGAJA dibina supaya larian AKAN menghantar kalau kunci
  // tak menyekat -- itulah cara ujian ni membezakan "disekat kunci" drpd
  // "tiada apa nak dihantar" (dua sebab lain yang juga hasilkan 0 fetch).
  const cfg = Object.assign(JSON.parse(CFG_UJI), {
    BROADCAST_TG_TOKEN: TOKEN_UJI, BROADCAST_TG_CHAT_IDS: '-100123', BROADCAST_GCHAT_WEBHOOKS: ''
  });
  const props = fakeProps({ APP_CONFIG_V3: JSON.stringify(cfg) });
  const f = fakeUrlFetch();
  const esok = function (n, jam) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); d.setHours(jam || 9); return d; };
  const events = [fakeEvent({ id: 'k1', title: 'Aktiviti Kunci', description: 'Kongsi: tg\n[PPD_CATEGORY:program]',
    location: 'Padang', start: esok(1), end: esok(1, 10), allDay: false })];
  const lockDipegangLain = { getScriptLock: function () {
    return { tryLock: function () { return false; }, releaseLock: function () {} };
  } };
  const api = loadCode(['sendWeeklyDigest_'], {
    UrlFetchApp: f.api,
    LockService: lockDipegangLain,
    PropertiesService: { getScriptProperties: function () { return props.api; } },
    CalendarApp: {
      EventColor: { BLUE: 'B', GREEN: 'G', ORANGE: 'O', MAUVE: 'M', RED: 'R', GRAY: 'GY', YELLOW: 'Y' },
      getCalendarById: function () { return fakeCalendar(events); }
    }
  });
  let meletup = false;
  try { api.sendWeeklyDigest_(); } catch (e) { meletup = true; }
  ok('sendWeeklyDigest_ kunci sudah dipegang larian lain -> TIADA fetch dan TIDAK throw',
     !meletup && f.calls.length === 0);
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

// ---- laporan ------------------------------------------------------------

const summary = results.join('\n');
console.log(summary);
const failed = results.filter(function (r) { return r.indexOf('FAIL') === 0; }).length;
console.log('\n' + (results.length - failed) + ' LULUS, ' + failed + ' GAGAL');
if (failed) process.exit(1);
