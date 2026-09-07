const UNIVERSAL_CORE_VERSION = '1.0.0';

const DEFAULT_CONFIG = {
  APP_NAME: 'Dashboard Calendar',
  OFFICE_NAME: 'Organisasi',
  SHORT_NAME: 'Calendar',
  TIMEZONE: 'Asia/Kuala_Lumpur',
  CALENDAR_ID: '',
  ADMIN_EMAIL: '',
  THEME_COLOR: '#0b6ef3',
  ALLOW_REGISTRATION: true,
  FOOTER_TEXT: '',
  ICON_URL: '',
  SESSION_DAYS: 7,
  SESSION_ABSOLUTE_DAYS: 30,
  MAX_AUDIT_ROWS: 400,
  // Senarai domain email dibenarkan untuk daftar sendiri (dipisah koma, tanpa '@').
  // Kosong = benarkan semua. Berguna bila webapp access = "Anyone with a Google Account".
  ALLOWED_EMAIL_DOMAINS: '',
  // Kawalan banjir pendaftaran (tiada UI -- pemasang mahir ubah via APP_CONFIG_V3).
  // MAX_PENDING_REGISTRATIONS: siling keras jumlah akaun 'pending' serentak.
  // MAX_REGISTRATIONS_PER_MINUTE: throttle letusan merentas SEMUA pengguna.
  MAX_PENDING_REGISTRATIONS: 50,
  MAX_REGISTRATIONS_PER_MINUTE: 10,
  // Jam (0-23) trigger sendActivityReminders_ jalan setiap hari. Boleh admin ubah
  // via System Settings -- lihat syncReminderTrigger_() untuk cara ia diguna pakai.
  REMINDER_HOUR: 7,
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
};

// Pagar keselamatan Google Chat: hos DIKUNCI ke chat.googleapis.com.
// Digunakan dalam validateSetupInput_ (masa simpan) dan sendToGoogleChat_ (masa hantar).
const GCHAT_WEBHOOK_HOST_RE = /^https:\/\/chat\.googleapis\.com\/v1\/spaces\/\S+$/;

function getConfig_() {
  const raw = PropertiesService.getScriptProperties().getProperty('APP_CONFIG_V3');
  if (!raw) return Object.assign({}, DEFAULT_CONFIG);
  try {
    return Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw));
  } catch (e) {
    return Object.assign({}, DEFAULT_CONFIG);
  }
}

function isInstalled_() {
  return PropertiesService.getScriptProperties().getProperty('SYSTEM_INSTALLED_V3') === 'true';
}

function requireInstalled_() {
  if (!isInstalled_()) throw new Error('Sistem belum dipasang. Sila lengkapkan Setup Wizard.');
}

function validateHexColor_(hex) {
  return /^#[0-9a-fA-F]{6}$/.test(String(hex || '').trim());
}

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

function validateSetupInput_(input) {
  input = input || {};
  const cfg = {
    APP_NAME: String(input.appName || '').trim().slice(0, 120),
    OFFICE_NAME: String(input.officeName || '').trim().slice(0, 160),
    SHORT_NAME: String(input.shortName || '').trim().slice(0, 60),
    TIMEZONE: String(input.timezone || 'Asia/Kuala_Lumpur').trim(),
    CALENDAR_ID: String(input.calendarId || '').trim(),
    ADMIN_EMAIL: normalizeEmail_(input.adminEmail),
    THEME_COLOR: String(input.themeColor || '#0b6ef3').trim(),
    ALLOW_REGISTRATION: input.allowRegistration !== false,
    FOOTER_TEXT: String(input.footerText || '').trim().slice(0, 180),
    ICON_URL: String(input.iconUrl || '').trim().slice(0, 500),
    ALLOWED_EMAIL_DOMAINS: parseDomainList_(input.allowedEmailDomains).slice(0, 20).join(','),
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
  };

  if (!cfg.APP_NAME || !cfg.OFFICE_NAME || !cfg.SHORT_NAME || !cfg.CALENDAR_ID || !cfg.ADMIN_EMAIL) {
    throw new Error('Nama sistem, organisasi, nama pendek, email admin dan Calendar ID diperlukan.');
  }
  if (!isValidEmail_(cfg.ADMIN_EMAIL)) throw new Error('Email Super Admin tidak sah.');
  if (!validateHexColor_(cfg.THEME_COLOR)) throw new Error('Warna tema tidak sah.');
  if (cfg.ICON_URL && !/^https:\/\/\S+$/i.test(cfg.ICON_URL)) {
    throw new Error('URL ikon mesti pautan langsung bermula dengan https://');
  }
  if (cfg.ALLOWED_EMAIL_DOMAINS) {
    const doms = cfg.ALLOWED_EMAIL_DOMAINS.split(',');
    const bad = doms.filter(function (d) { return !isValidDomain_(d); });
    if (bad.length) throw new Error('Domain email tidak sah: ' + bad.join(', '));
    // Pagar footgun: senarai yang tak masukkan domain Super Admin akan kunci admin
    // keluar (dan biasanya bermakna admin salah taip senarai).
    const adminDom = emailDomain_(cfg.ADMIN_EMAIL);
    if (adminDom && doms.indexOf(adminDom) === -1) {
      throw new Error('Domain email Super Admin (' + adminDom + ') mesti termasuk dalam senarai domain dibenarkan.');
    }
  }

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
    if (!GCHAT_WEBHOOK_HOST_RE.test(u)) hookSalah.push(i + 1);
  });
  if (hookSalah.length) {
    throw new Error('URL webhook Google Chat #' + hookSalah.join(', #') +
                    ' tidak sah. Mesti bermula https://chat.googleapis.com/v1/spaces/');
  }
  return cfg;
}

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

function getBootstrapState() {
  const installed = isInstalled_();
  const cfg = getConfig_();
  return {
    installed: installed,
    config: {
      appName: cfg.APP_NAME,
      officeName: cfg.OFFICE_NAME,
      shortName: cfg.SHORT_NAME,
      timezone: cfg.TIMEZONE,
      themeColor: cfg.THEME_COLOR,
      allowRegistration: cfg.ALLOW_REGISTRATION,
      footerText: cfg.FOOTER_TEXT,
      iconUrl: cfg.ICON_URL
    }
  };
}

function testSetupConnection(input) {
  if (isInstalled_()) throw new Error('Sistem telah dipasang.');
  const cfg = validateSetupInput_(input);

  const ownerEmail = normalizeEmail_(Session.getEffectiveUser().getEmail());
  if (ownerEmail && cfg.ADMIN_EMAIL !== ownerEmail) {
    throw new Error('Untuk keselamatan, email Super Admin mesti sama dengan akaun Google yang memiliki/deploy Apps Script ini: ' + ownerEmail);
  }

  const cal = CalendarApp.getCalendarById(cfg.CALENDAR_ID);
  if (!cal) throw new Error('Calendar ID tidak dapat diakses oleh akaun pemilik script.');

  return {
    success: true,
    calendarName: cal.getName(),
    ownerEmail: ownerEmail || cfg.ADMIN_EMAIL,
    mailQuotaAvailable: MailApp.getRemainingDailyQuota() > 0,
    message: 'Sambungan Calendar berjaya.'
  };
}

function installSystem(input) {
  if (isInstalled_()) throw new Error('Sistem telah dipasang.');
  const cfg = validateSetupInput_(input);

  const ownerEmail = normalizeEmail_(Session.getEffectiveUser().getEmail());
  if (ownerEmail && cfg.ADMIN_EMAIL !== ownerEmail) {
    throw new Error('Email Super Admin mesti sama dengan akaun Google pemilik/deployer Apps Script: ' + ownerEmail);
  }

  const cal = CalendarApp.getCalendarById(cfg.CALENDAR_ID);
  if (!cal) throw new Error('Calendar ID tidak dapat diakses.');

  const finalCfg = Object.assign({}, DEFAULT_CONFIG, cfg);
  const props = PropertiesService.getScriptProperties();
  props.setProperty('APP_CONFIG_V3', JSON.stringify(finalCfg));
  props.setProperty('SYSTEM_INSTALLED_V3', 'true');

  ensureSecuritySalt_();
  ensureAdminRecord_();
  syncReminderTrigger_(finalCfg.REMINDER_HOUR);
  syncDigestTrigger_(finalCfg.DIGEST_DAY, finalCfg.DIGEST_HOUR, finalCfg.DIGEST_MINUTE);
  addAudit_('SYSTEM_INSTALLED', finalCfg.APP_NAME + ' | ' + finalCfg.OFFICE_NAME, finalCfg.ADMIN_EMAIL);

  return {
    success: true,
    message: 'Sistem berjaya dipasang.',
    config: getBootstrapState().config
  };
}

function getSystemSettings(token) {
  requireSession_(token, 'canManageUsers');
  return projectSystemSettings_(getConfig_());
}

function updateSystemSettings(token, input) {
  const admin = requireSession_(token, 'canManageUsers');
  const current = getConfig_();
  const mergedInput = mergeSettingsInput_(input, current);
  const next = Object.assign({}, DEFAULT_CONFIG, validateSetupInput_(mergedInput));

  const cal = CalendarApp.getCalendarById(next.CALENDAR_ID);
  if (!cal) throw new Error('Calendar ID baharu tidak dapat diakses.');

  PropertiesService.getScriptProperties().setProperty('APP_CONFIG_V3', JSON.stringify(next));
  syncReminderTrigger_(next.REMINDER_HOUR);
  syncDigestTrigger_(next.DIGEST_DAY, next.DIGEST_HOUR, next.DIGEST_MINUTE);
  addAudit_('SYSTEM_SETTINGS_UPDATED', next.APP_NAME + ' | ' + next.OFFICE_NAME, admin.user.email);
  return { success: true, message: 'Tetapan sistem dikemaskini.', config: getBootstrapState().config };
}


const CATEGORY_CONFIG = {
  program:   { label: 'Program',   color: CalendarApp.EventColor.BLUE },
  mesyuarat: { label: 'Mesyuarat', color: CalendarApp.EventColor.GREEN },
  lawatan:   { label: 'Lawatan',   color: CalendarApp.EventColor.ORANGE },
  taklimat:  { label: 'Taklimat',  color: CalendarApp.EventColor.MAUVE },
  deadline:  { label: 'Deadline',  color: CalendarApp.EventColor.RED },
  lain:      { label: 'Lain-lain', color: CalendarApp.EventColor.GRAY },
  cuti:      { label: '🎉 Cuti',   color: CalendarApp.EventColor.YELLOW }
};

// Calendar rasmi Google "Holidays in Malaysia" -- ID kekal sama setiap tahun,
// Google update senarai cuti sendiri (termasuk cuti bertarikh bergerak macam Diwali/Hari Raya).
const HOLIDAY_CALENDAR_ID = 'en.malaysia#holiday@group.v.calendar.google.com';

const ROLE_CONFIG = {
  admin: {
    label: 'Super Admin',
    canView: true, canCreate: true, canEdit: true, canDelete: true,
    canManageUsers: true, canViewAudit: true
  },
  editor: {
    label: 'Editor',
    canView: true, canCreate: true, canEdit: true, canDelete: false,
    canManageUsers: false, canViewAudit: false
  },
  viewer: {
    label: 'Viewer',
    canView: true, canCreate: false, canEdit: false, canDelete: false,
    canManageUsers: false, canViewAudit: false
  }
};

function doGet() {
  ensureSecuritySalt_();
  if (isInstalled_()) ensureAdminRecord_();

  // Suntik nama/label sebenar terus dari server sebelum HTML sampai ke browser --
  // elak "flash" nama default (Dashboard Calendar) semasa client tunggu round-trip
  // getBootstrapState() yang boleh ambil 1-2 saat pada Apps Script.
  const cfg = getPublicConfig();
  const tpl = HtmlService.createTemplateFromFile('Index');
  tpl.appName = cfg.appName;
  tpl.officeName = cfg.officeName;
  tpl.shortName = cfg.shortName;

  return tpl.evaluate()
    .setTitle(cfg.appName)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* =========================================================
   PUBLIC AUTH API
========================================================= */

function getPublicConfig() {
  const cfg = getConfig_();
  return {
    appName: cfg.APP_NAME,
    officeName: cfg.OFFICE_NAME,
    shortName: cfg.SHORT_NAME,
    themeColor: cfg.THEME_COLOR,
    allowRegistration: cfg.ALLOW_REGISTRATION,
    footerText: cfg.FOOTER_TEXT
  };
}

/**
 * Sumber kebenaran TUNGGAL untuk identiti pengguna: sesi Google. Bila web app
 * ditetapkan access:DOMAIN, pengguna wajib login domain Google Workspace anda
 * dulu sebelum boleh sampai sini. Dibalut try/catch -- gagal-selamat, kalau
 * dasar domain sekat scope email, pulang '' bukan crash.
 * Disahkan berfungsi utk akaun BUKAN-pemilik skrip via probe manual 2026-08-27.
 */
function getActiveUserEmail_() {
  try {
    return normalizeEmail_(Session.getActiveUser().getEmail());
  } catch (e) {
    return '';
  }
}

/**
 * Registration -- SATU langkah, tiada OTP. Google session dah buktikan pemilikan
 * email, jadi tinggal kumpul profil sahaja. Akaun terus jadi PENDING, tunggu admin.
 */
function submitRegistration(profile) {
  requireInstalled_();
  const cfg = getConfig_();
  if (!cfg.ALLOW_REGISTRATION) throw new Error('Pendaftaran staff ditutup oleh Super Admin.');

  const email = getActiveUserEmail_();
  if (!email) throw new Error('Tidak dapat kesan email akaun Google anda. Sila cuba semula atau hubungi Super Admin.');

  // Penapis domain -- murah, tiada lock. addAudit_ selamat di sini (lock belum dipegang).
  const allowedDomains = parseDomainList_(cfg.ALLOWED_EMAIL_DOMAINS);
  if (allowedDomains.length && allowedDomains.indexOf(emailDomain_(email)) === -1) {
    addAudit_('REGISTRATION_DOMAIN_BLOCKED', email, email);
    throw new Error('Pendaftaran hanya dibenarkan untuk email domain: ' + allowedDomains.join(', ') + '.');
  }

  profile = sanitizeProfile_(profile);
  // Email dari CLIENT diabaikan sepenuhnya -- guna nilai SERVER di atas. Elak guru
  // (atau sesiapa manipulate network tab) daftar guna email orang lain, sebab OTP
  // yang dulu buktikan pemilikan email tu dah takde lagi.
  profile.email = email;

  if (!profile.name || !profile.position || !profile.unit) {
    throw new Error('Nama, jawatan dan unit diperlukan.');
  }

  // Semakan kadar mesti DALAM lock (kira pending + baca/tulis throttle mesti atomik).
  // addAudit_ guna lock yang SAMA -> tak boleh dipanggil di sini; tangguh ke selepas release.
  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let rateBlock = null;   // { audit: string|null, msg: string } kalau ditolak
  let newPending = null;  // { user, pendingTotal } kalau rekod pending NET-BAHARU dicipta
  try {
    const users = getUsers_();
    const existing = users[email];

    if (existing && existing.status === 'approved') {
      throw new Error('Email ini sudah mempunyai akaun. Sila buka semula aplikasi.');
    }

    if (existing && existing.status === 'pending') {
      // Kemas kini profil sahaja (cth betulkan typo). Bukan akaun net-baharu --
      // tak dikira terhadap had/throttle, createdAt dikekalkan.
      existing.name = profile.name;
      existing.position = profile.position;
      existing.unit = profile.unit;
      saveUsers_(users);
    } else {
      // Akaun net-baharu (baharu, ATAU daftar semula selepas rejected/suspended).
      const maxPending = Number(cfg.MAX_PENDING_REGISTRATIONS) || 50;
      const maxPerMin = Number(cfg.MAX_REGISTRATIONS_PER_MINUTE) || 10;
      const pendingCount = Object.keys(users).reduce(function (n, k) {
        return n + (users[k] && users[k].status === 'pending' ? 1 : 0);
      }, 0);

      let box = {};
      try { box = JSON.parse(props.getProperty('PPD_REG_THROTTLE_V1') || '{}'); } catch (e) { box = {}; }
      const now = Date.now();
      let stamps = Array.isArray(box.s) ? box.s.filter(function (t) { return typeof t === 'number' && now - t < 60000; }) : [];
      let lastAudit = typeof box.a === 'number' ? box.a : 0;

      if (pendingCount >= maxPending) {
        rateBlock = { audit: 'REGISTRATION_QUEUE_FULL', msg: 'Barisan pendaftaran penuh (' + maxPending + '). Sila hubungi Super Admin untuk luluskan permohonan sedia ada.' };
      } else if (stamps.length >= maxPerMin) {
        // Audit throttle SEKALI setiap 5 minit -- elak penyerang evict sejarah audit
        // (ring buffer MAX_AUDIT_ROWS) dengan spam REGISTRATION_THROTTLED.
        const doAudit = now - lastAudit > 300000;
        if (doAudit) lastAudit = now;
        rateBlock = { audit: doAudit ? 'REGISTRATION_THROTTLED' : null, msg: 'Terlalu banyak pendaftaran serentak. Sila cuba lagi dalam seminit.' };
        props.setProperty('PPD_REG_THROTTLE_V1', JSON.stringify({ s: stamps, a: lastAudit }));
      } else {
        stamps.push(now);
        props.setProperty('PPD_REG_THROTTLE_V1', JSON.stringify({ s: stamps.slice(-100), a: lastAudit }));
        users[email] = {
          email: email,
          name: profile.name,
          position: profile.position,
          unit: profile.unit,
          status: 'pending',
          role: '',
          createdAt: new Date().toISOString(),
          approvedAt: '',
          approvedBy: '',
          suspendedAt: ''
        };
        saveUsers_(users);
        // Tangguh e-mel admin ke LUAR lock -- MailApp lambat + addAudit_ guna lock SAMA.
        newPending = { user: users[email], pendingTotal: pendingCount + 1 };
      }
    }
  } finally {
    lock.releaseLock();
  }

  if (rateBlock) {
    if (rateBlock.audit) addAudit_(rateBlock.audit, email, email);
    throw new Error(rateBlock.msg);
  }

  addAudit_('REGISTRATION_SUBMITTED', email + ' | ' + profile.name, email);

  // Hanya untuk pendaftaran net-baharu -- bukan bila guru betulkan typo profil 'pending'.
  if (newPending) notifyAdminNewRegistration_(newPending.user, newPending.pendingTotal);

  return {
    success: true,
    status: 'pending',
    message: 'Pendaftaran berjaya. Permohonan sedang menunggu kelulusan Super Admin.'
  };
}

/**
 * Login -- zero-klik. Dipanggil client sebaik page load bila tiada token
 * localStorage sedia ada. Semakan status SAMA PERSIS macam flow OTP lama, cuma
 * langkah "buktikan email" tukar dari OTP kepada sesi Google yang dah sedia ada.
 */
function attemptAutoLogin() {
  requireInstalled_();
  const email = getActiveUserEmail_();
  if (!email) return { success: false, reason: 'no-email' };

  ensureAdminRecord_();
  const users = getUsers_();
  const user = users[email];

  if (!user) return { success: false, reason: 'not-registered', email: email };
  if (user.status === 'pending') return { success: false, reason: 'pending' };
  if (user.status === 'rejected') return { success: false, reason: 'rejected' };
  if (user.status === 'suspended') return { success: false, reason: 'suspended' };
  if (user.status !== 'approved') return { success: false, reason: 'inactive' };

  const token = createSession_(user);
  addAudit_('LOGIN_SUCCESS', user.name || user.email, email);

  return {
    success: true,
    token: token,
    user: publicUser_(user)
  };
}

function restoreSession(token) {
  try {
    const session = requireSession_(token, 'canView');
    return {
      valid: true,
      user: session.user,
      permissions: session.permissions,
      dashboard: getDashboardDataInternal_()
    };
  } catch (e) {
    return { valid: false, message: e.message };
  }
}

function logout(token) {
  revokeSession_(token);
  return { success: true };
}

/* =========================================================
   ADMIN - APPROVAL / USER MANAGEMENT
========================================================= */

function getAdminUsers(token) {
  requireSession_(token, 'canManageUsers');
  const users = getUsers_();

  const rows = Object.keys(users)
    .map(email => publicUser_(users[email]))
    .sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      return (a.name || a.email).localeCompare(b.name || b.email);
    });

  return { users: rows };
}

// Senarai ringkas guru approved untuk checkbox "Guru Penerima" reminder --
// kebenaran canCreate (sesiapa yang boleh tambah aktiviti), BUKAN canManageUsers,
// sebab ni bukan pengurusan pengguna. Cuma email+nama, tiada position/unit/role.
function getApprovedUserOptions(token) {
  requireSession_(token, 'canCreate');
  const users = getUsers_();
  return Object.keys(users)
    .map(function(email) { return users[email]; })
    .filter(function(u) { return u.status === 'approved'; })
    .map(function(u) { return { email: u.email, name: u.name || u.email }; })
    .sort(function(a, b) { return a.name.localeCompare(b.name); });
}

function approveUser(token, email, role) {
  const admin = requireSession_(token, 'canManageUsers');
  email = normalizeEmail_(email);
  role = String(role || '').toLowerCase();

  if (!['editor', 'viewer'].includes(role)) throw new Error('Role tidak sah.');
  if (email === normalizeEmail_(getConfig_().ADMIN_EMAIL)) throw new Error('Super Admin tidak perlu diluluskan.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  let user;
  try {
    const users = getUsers_();
    user = users[email];
    if (!user) throw new Error('Permohonan pengguna tidak ditemui.');

    user.status = 'approved';
    user.role = role;
    user.approvedAt = new Date().toISOString();
    user.approvedBy = admin.user.email;
    user.suspendedAt = '';
    users[email] = user;
    saveUsers_(users);
  } finally {
    lock.releaseLock();
  }

  addAudit_('USER_APPROVED', email + ' → ' + role, admin.user.email);
  sendApprovalEmail_(user);

  return { success: true, message: 'Pengguna diluluskan sebagai ' + ROLE_CONFIG[role].label + '.' };
}

function rejectUser(token, email) {
  const admin = requireSession_(token, 'canManageUsers');
  email = normalizeEmail_(email);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const users = getUsers_();
    if (!users[email]) throw new Error('Pengguna tidak ditemui.');
    users[email].status = 'rejected';
    users[email].role = '';
    saveUsers_(users);
  } finally {
    lock.releaseLock();
  }

  revokeAllUserSessions_(email);
  addAudit_('USER_REJECTED', email, admin.user.email);
  return { success: true, message: 'Permohonan ditolak.' };
}

function changeUserRole(token, email, role) {
  const admin = requireSession_(token, 'canManageUsers');
  email = normalizeEmail_(email);
  role = String(role || '').toLowerCase();

  if (!['editor', 'viewer'].includes(role)) throw new Error('Role tidak sah.');
  if (email === normalizeEmail_(getConfig_().ADMIN_EMAIL)) throw new Error('Role Super Admin dikunci.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const users = getUsers_();
    if (!users[email]) throw new Error('Pengguna tidak ditemui.');
    if (users[email].status !== 'approved') throw new Error('Pengguna belum diluluskan.');
    users[email].role = role;
    saveUsers_(users);
  } finally {
    lock.releaseLock();
  }

  revokeAllUserSessions_(email);
  addAudit_('ROLE_CHANGED', email + ' → ' + role, admin.user.email);
  return { success: true, message: 'Role dikemaskini. Pengguna perlu login semula.' };
}

function suspendUser(token, email) {
  const admin = requireSession_(token, 'canManageUsers');
  email = normalizeEmail_(email);
  if (email === normalizeEmail_(getConfig_().ADMIN_EMAIL)) throw new Error('Super Admin tidak boleh digantung.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const users = getUsers_();
    if (!users[email]) throw new Error('Pengguna tidak ditemui.');
    users[email].status = 'suspended';
    users[email].suspendedAt = new Date().toISOString();
    saveUsers_(users);
  } finally {
    lock.releaseLock();
  }

  revokeAllUserSessions_(email);
  addAudit_('USER_SUSPENDED', email, admin.user.email);
  return { success: true, message: 'Akaun digantung.' };
}

function reactivateUser(token, email) {
  const admin = requireSession_(token, 'canManageUsers');
  email = normalizeEmail_(email);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const users = getUsers_();
    if (!users[email]) throw new Error('Pengguna tidak ditemui.');
    users[email].status = 'approved';
    users[email].suspendedAt = '';
    if (!users[email].role) users[email].role = 'viewer';
    saveUsers_(users);
  } finally {
    lock.releaseLock();
  }

  addAudit_('USER_REACTIVATED', email, admin.user.email);
  return { success: true, message: 'Akaun diaktifkan semula.' };
}

function deleteUser(token, email) {
  const admin = requireSession_(token, 'canManageUsers');
  email = normalizeEmail_(email);
  if (email === normalizeEmail_(getConfig_().ADMIN_EMAIL)) throw new Error('Super Admin tidak boleh dipadam.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const users = getUsers_();
    const user = users[email];
    if (!user) throw new Error('Pengguna tidak ditemui.');
    // Hanya rekod yang sudah Suspended/Ditolak boleh dipadam kekal — staff
    // Approved/Pending kena disuspend/ditolak dulu, elak admin tersilap
    // padam akaun yang masih aktif log masuk.
    if (user.status !== 'suspended' && user.status !== 'rejected') {
      throw new Error('Hanya akaun Suspended atau Ditolak boleh dipadam kekal.');
    }
    delete users[email];
    saveUsers_(users);
  } finally {
    lock.releaseLock();
  }

  revokeAllUserSessions_(email);
  addAudit_('USER_DELETED', email, admin.user.email);
  return { success: true, message: 'Akaun dipadam kekal.' };
}

function getAuditLog(token) {
  requireSession_(token, 'canViewAudit');

  let rows = [];
  const raw = PropertiesService.getScriptProperties().getProperty('PPD_AUDIT_V23');
  try { rows = raw ? JSON.parse(raw) : []; } catch (e) { rows = []; }

  return { rows: Array.isArray(rows) ? rows.slice(0, getConfig_().MAX_AUDIT_ROWS) : [] };
}

/* =========================================================
   AUTHENTICATED CALENDAR API
========================================================= */

function getDashboardData(token) {
  requireSession_(token, 'canView');
  return getDashboardDataInternal_();
}

function getMonthData(token, year, monthIndex) {
  requireSession_(token, 'canView');

  const cal = getPPDCalendar_();
  const start = new Date(Number(year), Number(monthIndex), 1);
  const end = new Date(Number(year), Number(monthIndex) + 1, 1);
  const events = safeGetEvents_(cal, start, end).map(eventToObject_)
    .concat(getHolidayEvents_(start, end))
    .sort(sortByStart_);

  return {
    year: Number(year),
    monthIndex: Number(monthIndex),
    label: formatDate_(start, 'MMMM yyyy'),
    events: events
  };
}

// Utk cetak "Semua Bulan" (tab Laporan) -- SATU query Calendar utk seluruh tahun, kumpul
// ikut bulan sendiri (server-side). Elak 12 panggilan getMonthData berasingan (12 round-trip
// google.script.run yg perlahan); event pelbagai-bulan (cth 30 Jan - 2 Feb) muncul dlm KEDUA
// bulan (overlap check, sama semantik dgn eventOverlapsDay() client-side).
function getYearData(token, year) {
  requireSession_(token, 'canView');

  const y = Number(year);
  const cal = getPPDCalendar_();
  const yearStart = new Date(y, 0, 1);
  const yearEnd = new Date(y + 1, 0, 1);
  const events = safeGetEvents_(cal, yearStart, yearEnd).map(eventToObject_)
    .concat(getHolidayEvents_(yearStart, yearEnd))
    .sort(sortByStart_);

  const months = [];
  for (let m = 0; m < 12; m++) {
    const mStart = new Date(y, m, 1);
    const mEnd = new Date(y, m + 1, 1);
    months.push({
      year: y,
      monthIndex: m,
      label: formatDate_(mStart, 'MMMM yyyy'),
      events: events.filter(function(e) {
        const s = new Date(e.start), en = new Date(e.end);
        return s < mEnd && en > mStart;
      })
    });
  }

  return { year: y, months: months, allEvents: events };
}

function getEventsForDate(token, dateStr) {
  requireSession_(token, 'canView');

  const p = String(dateStr || '').split('-').map(Number);
  if (p.length !== 3) throw new Error('Tarikh tidak sah.');

  const start = new Date(p[0], p[1] - 1, p[2], 0, 0, 0, 0);
  const end = new Date(p[0], p[1] - 1, p[2], 23, 59, 59, 999);

  const cal = getPPDCalendar_();
  const events = safeGetEvents_(cal, start, end).map(eventToObject_)
    .concat(getHolidayEvents_(start, end))
    .sort(sortByStart_);

  return {
    date: dateStr,
    label: formatDate_(start, 'EEEE, d MMMM yyyy'),
    events: events
  };
}

function createCalendarEvent(token, payload) {
  const session = requireSession_(token, 'canCreate');
  validateEventPayload_(payload);

  const cal = getPPDCalendar_();
  const category = CATEGORY_CONFIG[payload.category] ? payload.category : 'lain';
  assertCutiAdminOnly_(session, category);

  const event = cal.createEvent(
    String(payload.title).trim(),
    new Date(payload.start),
    new Date(payload.end),
    {
      location: String(payload.location || '').trim(),
      description: buildDescription_(payload, category)
    }
  );

  event.setColor(CATEGORY_CONFIG[category].color);

  addAudit_('EVENT_CREATED', event.getTitle(), session.user.email);
  return { success: true, message: 'Aktiviti berjaya ditambah.', event: eventToObject_(event) };
}

function updateCalendarEvent(token, payload) {
  const session = requireSession_(token, 'canEdit');
  if (!payload || !payload.id) throw new Error('ID aktiviti diperlukan.');
  validateEventPayload_(payload);

  const cal = getPPDCalendar_();
  const event = findEventByIdInCalendar_(cal, payload.id);
  if (!event) throw new Error('Aktiviti tidak ditemui.');

  const existingCategory = getCategory_(event, event.getDescription() || '');
  assertCutiAdminOnly_(session, existingCategory);

  const oldTitle = event.getTitle();
  const category = CATEGORY_CONFIG[payload.category] ? payload.category : 'lain';
  assertCutiAdminOnly_(session, category);

  event.setTitle(String(payload.title).trim());
  event.setTime(new Date(payload.start), new Date(payload.end));
  event.setLocation(String(payload.location || '').trim());
  event.setDescription(buildDescription_(payload, category));
  event.setColor(CATEGORY_CONFIG[category].color);
  // Bersihkan popup reminder lama (sistem reminder dulu) -- migrasi ke email digest,
  // event lama yang masih ada popup Calendar tak patut kekal bila diedit lagi.
  try { event.removeAllReminders(); } catch (e) {}

  addAudit_('EVENT_UPDATED', oldTitle + ' → ' + event.getTitle(), session.user.email);
  return { success: true, message: 'Aktiviti berjaya dikemaskini.', event: eventToObject_(event) };
}


function rescheduleCalendarEvent(token, payload) {
  const session = requireSession_(token, 'canEdit');

  if (!payload || !payload.id || !payload.start || !payload.end) {
    throw new Error('ID, masa mula dan masa tamat diperlukan.');
  }

  const start = new Date(payload.start);
  const end = new Date(payload.end);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Tarikh atau masa tidak sah.');
  }
  if (end <= start) {
    throw new Error('Masa tamat mesti selepas masa mula.');
  }

  const cal = getPPDCalendar_();
  const event = findEventByIdInCalendar_(cal, payload.id);
  if (!event) throw new Error('Aktiviti tidak ditemui.');
  assertCutiAdminOnly_(session, getCategory_(event, event.getDescription() || ''));

  const oldStart = event.getStartTime();
  event.setTime(start, end);

  addAudit_(
    'EVENT_RESCHEDULED',
    event.getTitle() + ' | ' +
    formatDate_(oldStart, 'dd/MM/yyyy HH:mm') + ' → ' +
    formatDate_(start, 'dd/MM/yyyy HH:mm'),
    session.user.email
  );

  return {
    success: true,
    message: 'Tarikh dan masa aktiviti berjaya dipindahkan.',
    event: eventToObject_(event)
  };
}

function duplicateCalendarEvent(token, payload) {
  const session = requireSession_(token, 'canCreate');

  if (!payload || !payload.id || !payload.start || !payload.end) {
    throw new Error('ID, masa mula dan masa tamat diperlukan.');
  }

  const start = new Date(payload.start);
  const end = new Date(payload.end);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Tarikh atau masa tidak sah.');
  }
  if (end <= start) {
    throw new Error('Masa tamat mesti selepas masa mula.');
  }

  const cal = getPPDCalendar_();
  const source = findEventByIdInCalendar_(cal, payload.id);
  if (!source) throw new Error('Aktiviti asal tidak ditemui.');

  const clone = cal.createEvent(
    source.getTitle(),
    start,
    end,
    {
      location: source.getLocation() || '',
      description: source.getDescription() || ''
    }
  );

  try { clone.setColor(source.getColor()); } catch (e) {}
  // Nota: reminderDays (email) ikut serta AUTOMATIK sebab description disalin terus
  // (baris 825) -- tiada popup Calendar untuk clone lagi sejak migrasi ke email digest.

  addAudit_(
    'EVENT_DUPLICATED',
    source.getTitle() + ' | ' +
    formatDate_(source.getStartTime(), 'dd/MM/yyyy HH:mm') + ' → ' +
    formatDate_(start, 'dd/MM/yyyy HH:mm'),
    session.user.email
  );

  return {
    success: true,
    message: 'Aktiviti berjaya diduplikasi ke tarikh baharu.',
    event: eventToObject_(clone)
  };
}

function deleteCalendarEvent(token, eventId) {
  const session = requireSession_(token, 'canDelete');

  const cal = getPPDCalendar_();
  const event = findEventByIdInCalendar_(cal, eventId);
  if (!event) throw new Error('Aktiviti tidak ditemui.');
  assertCutiAdminOnly_(session, getCategory_(event, event.getDescription() || ''));

  const title = event.getTitle();
  event.deleteEvent();

  addAudit_('EVENT_DELETED', title, session.user.email);
  return { success: true, message: 'Aktiviti dipadam.' };
}

function searchCalendarEvents(token, query) {
  requireSession_(token, 'canView');

  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];

  const cal = getPPDCalendar_();
  const start = new Date();
  start.setMonth(start.getMonth() - 3);
  const end = new Date();
  end.setMonth(end.getMonth() + 12);

  return safeGetEvents_(cal, start, end)
    .map(eventToObject_)
    .filter(function(e) {
      return [e.title, e.description, e.location, e.categoryLabel, e.pic, e.agency]
        .join(' ').toLowerCase().indexOf(q) !== -1;
    })
    .sort(sortByStart_)
    .slice(0, 60);
}

/* =========================================================
   SESSION INTERNALS
========================================================= */

function createSession_(user) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  const tokenHash = hashText_(token);
  const sessions = getSessions_();

  sessions[tokenHash] = {
    email: user.email,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + getConfig_().SESSION_DAYS * 24 * 60 * 60 * 1000
  };

  saveSessions_(pruneSessions_(sessions));
  return token;
}

function requireSession_(token, permission) {
  if (!token) throw new Error('Sesi login diperlukan.');

  const sessions = getSessions_();
  const key = hashText_(String(token));
  const s = sessions[key];

  if (!s) throw new Error('Sesi tidak sah. Sila login semula.');

  const now = Date.now();
  const cfg = getConfig_();
  // Had MUTLAK dari masa LOGIN (createdAt) -- ni yg bezakan sliding tulen (tak pernah tamat
  // selagi aktif, risiko token dicuri/PC dikongsi tak pernah automatik tamat) drpd hybrid ni.
  const hardLimit = new Date(s.createdAt).getTime() + cfg.SESSION_ABSOLUTE_DAYS * 24 * 60 * 60 * 1000;

  if (now > s.expiresAt || now > hardLimit) {
    delete sessions[key];
    saveSessions_(sessions);
    throw new Error('Sesi telah tamat. Sila login semula.');
  }

  // Sliding: lanjutkan tempoh SESSION_DAYS dari SEKARANG setiap kali aktif, tapi jangan lepas
  // had mutlak. Tulis PropertiesService cuma bila lanjutan >1 jam -- elak rewrite blob sesi
  // (SEMUA guru dlm satu property) pada SETIAP panggilan API, yg boleh cecah had kuota GAS.
  const slidingExpiry = Math.min(now + cfg.SESSION_DAYS * 24 * 60 * 60 * 1000, hardLimit);
  if (slidingExpiry - s.expiresAt > 60 * 60 * 1000) {
    s.expiresAt = slidingExpiry;
    sessions[key] = s;
    saveSessions_(sessions);
  }

  const users = getUsers_();
  const user = users[normalizeEmail_(s.email)];

  if (!user || user.status !== 'approved') throw new Error('Akaun tidak aktif.');

  const role = user.role;
  const permissions = ROLE_CONFIG[role];
  if (!permissions) throw new Error('Role akaun tidak sah.');
  if (permission && !permissions[permission]) throw new Error('Anda tidak mempunyai kebenaran untuk tindakan ini.');

  return {
    user: publicUser_(user),
    permissions: permissions
  };
}

// Kategori 'cuti' (cuti penggal/tambahan KPM) -- Admin sahaja boleh cipta/ubah/padam.
// Disemak SERVER-SIDE (bukan sekadar sorok butang UI) sebab google.script.run boleh
// dipanggil terus dari console pelayar, memintas apa-apa sekatan client-side.
function assertCutiAdminOnly_(session, category) {
  if (category === 'cuti' && session.user.role !== 'admin') {
    throw new Error('Cuti Sekolah hanya boleh diuruskan oleh Admin.');
  }
}

function revokeSession_(token) {
  if (!token) return;
  const sessions = getSessions_();
  delete sessions[hashText_(String(token))];
  saveSessions_(sessions);
}

function revokeAllUserSessions_(email) {
  email = normalizeEmail_(email);
  const sessions = getSessions_();
  Object.keys(sessions).forEach(function(k) {
    if (normalizeEmail_(sessions[k].email) === email) delete sessions[k];
  });
  saveSessions_(sessions);
}

function getSessions_() {
  const raw = PropertiesService.getScriptProperties().getProperty('PPD_SESSIONS_V23');
  try {
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? o : {};
  } catch (e) {
    return {};
  }
}

function saveSessions_(sessions) {
  PropertiesService.getScriptProperties().setProperty('PPD_SESSIONS_V23', JSON.stringify(sessions));
}

function pruneSessions_(sessions) {
  const now = Date.now();
  Object.keys(sessions).forEach(function(k) {
    if (!sessions[k] || sessions[k].expiresAt < now) delete sessions[k];
  });
  return sessions;
}

/* =========================================================
   DATA STORAGE
========================================================= */

function ensureAdminRecord_() {
  const email = normalizeEmail_(getConfig_().ADMIN_EMAIL);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const users = getUsers_();
    const old = users[email] || {};
    users[email] = {
      email: email,
      name: old.name || 'Super Admin',
      position: old.position || 'Super Admin',
      unit: old.unit || getConfig_().OFFICE_NAME,
      status: 'approved',
      role: 'admin',
      createdAt: old.createdAt || new Date().toISOString(),
      approvedAt: old.approvedAt || new Date().toISOString(),
      approvedBy: email,
      suspendedAt: ''
    };
    saveUsers_(users);
  } finally {
    lock.releaseLock();
  }
}

function getUsers_() {
  const raw = PropertiesService.getScriptProperties().getProperty('PPD_USERS_V23');
  try {
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? o : {};
  } catch (e) {
    return {};
  }
}

function saveUsers_(users) {
  PropertiesService.getScriptProperties().setProperty('PPD_USERS_V23', JSON.stringify(users));
}

function addAudit_(action, detail, actor) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const props = PropertiesService.getScriptProperties();
    let rows = [];
    try { rows = JSON.parse(props.getProperty('PPD_AUDIT_V23') || '[]'); } catch (e) { rows = []; }
    if (!Array.isArray(rows)) rows = [];

    rows.unshift({
      time: new Date().toISOString(),
      actor: normalizeEmail_(actor),
      action: String(action || ''),
      detail: String(detail || '').slice(0, 500)
    });

    props.setProperty('PPD_AUDIT_V23', JSON.stringify(rows.slice(0, getConfig_().MAX_AUDIT_ROWS)));
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
   CALENDAR INTERNALS
========================================================= */

function getDashboardDataInternal_() {
  const cal = getPPDCalendar_();
  const now = new Date();

  const todayStart = startOfDay_(now);
  const todayEnd = endOfDay_(now);

  const upcomingEnd = new Date(todayEnd);
  upcomingEnd.setDate(upcomingEnd.getDate() + 7);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const todayEvents = safeGetEvents_(cal, todayStart, todayEnd).map(eventToObject_)
    .concat(getHolidayEvents_(todayStart, todayEnd))
    .sort(sortByStart_);
  const upcomingEvents = safeGetEvents_(cal, todayStart, upcomingEnd)
    .map(eventToObject_)
    .concat(getHolidayEvents_(todayStart, upcomingEnd))
    .filter(function(e) { return new Date(e.end) >= now; })
    .sort(sortByStart_);
  const monthEvents = safeGetEvents_(cal, monthStart, monthEnd).map(eventToObject_)
    .concat(getHolidayEvents_(monthStart, monthEnd))
    .sort(sortByStart_);
  const reminders = upcomingEvents.filter(function(e) { return e.hasReminder; }).slice(0, 12);

  return {
    calendarName: cal.getName(),
    todayLabel: formatDate_(now, 'EEEE, d MMMM yyyy'),
    stats: {
      today: todayEvents.length,
      upcoming: upcomingEvents.length,
      month: monthEvents.length,
      reminders: reminders.length
    },
    nextEvent: upcomingEvents.length ? upcomingEvents[0] : null,
    todayEvents: todayEvents,
    upcomingEvents: upcomingEvents,
    monthEvents: monthEvents,
    reminders: reminders,
    report: buildReport_(monthEvents),
    month: {
      year: now.getFullYear(),
      monthIndex: now.getMonth(),
      label: formatDate_(now, 'MMMM yyyy')
    }
  };
}

function getPPDCalendar_() {
  const cal = CalendarApp.getCalendarById(getConfig_().CALENDAR_ID);
  if (!cal) throw new Error('Calendar sistem tidak dapat diakses oleh pemilik script.');
  return cal;
}

// Gagal-selamat: kalau calendar cuti tak boleh diakses (mis. sekatan domain),
// pulangkan senarai kosong sahaja -- JANGAN pecahkan dashboard sekolah sebab ni.
function getHolidayEvents_(start, end) {
  try {
    const cal = CalendarApp.getCalendarById(HOLIDAY_CALENDAR_ID);
    if (!cal) return [];
    return cal.getEvents(start, end).map(holidayToObject_);
  } catch (e) {
    return [];
  }
}

function holidayToObject_(event) {
  return {
    id: event.getId(),
    title: event.getTitle() || '(Cuti)',
    description: '',
    location: '',
    start: event.getStartTime().toISOString(),
    end: event.getEndTime().toISOString(),
    allDay: event.isAllDayEvent(),
    category: 'cuti',
    categoryLabel: CATEGORY_CONFIG.cuti.label,
    hasReminder: false,
    reminderDays: 0,
    remindTo: [],
    pic: '',
    agency: '',
    // Cuti Google datang dari kalendar LUAR yang kita tak boleh tanda. Bentuk objek
    // kekal sama dengan eventToObject_ sebab dashboard gabungkan dua senarai ni --
    // dan penapis saluran dalam sendWeeklyDigest_ memanggil .indexOf() terus atas
    // medan ni, jadi ia mesti array, bukan undefined.
    shareChannels: [],
    isHoliday: true
  };
}

function safeGetEvents_(calendar, start, end) {
  try { return calendar.getEvents(start, end); }
  catch (e) { throw new Error('Gagal membaca Calendar: ' + e.message); }
}

function findEventByIdInCalendar_(calendar, eventId) {
  const start = new Date();
  start.setFullYear(start.getFullYear() - 2);
  const end = new Date();
  end.setFullYear(end.getFullYear() + 3);

  const events = calendar.getEvents(start, end);
  for (let i = 0; i < events.length; i++) {
    if (events[i].getId() === eventId) return events[i];
  }
  return null;
}

function eventToObject_(event) {
  const description = event.getDescription() || '';
  const category = getCategory_(event, description);
  const meta = parseDescriptionMeta_(description);

  return {
    id: event.getId(),
    title: event.getTitle() || '(Tanpa tajuk)',
    description: cleanDescription_(description),
    location: event.getLocation() || '',
    start: event.getStartTime().toISOString(),
    end: event.getEndTime().toISOString(),
    allDay: event.isAllDayEvent(),
    category: category,
    categoryLabel: CATEGORY_CONFIG[category].label,
    hasReminder: meta.reminderDays > 0,
    reminderDays: meta.reminderDays,
    remindTo: meta.remindTo,
    pic: meta.pic,
    agency: meta.agency,
    shareChannels: meta.shareChannels
  };
}

function getCategory_(event, description) {
  const marker = description.match(/\[PPD_CATEGORY:([a-z]+)\]/i);
  if (marker && CATEGORY_CONFIG[marker[1].toLowerCase()]) return marker[1].toLowerCase();

  const text = (event.getTitle() + ' ' + description).toLowerCase();
  if (/mesyuarat|meeting|perbincangan/.test(text)) return 'mesyuarat';
  if (/lawatan|visit|turun padang/.test(text)) return 'lawatan';
  if (/taklimat|briefing|ceramah/.test(text)) return 'taklimat';
  if (/deadline|tarikh akhir|hantar|tutup/.test(text)) return 'deadline';
  if (/program|majlis|kempen|jiwa@|komuniti/.test(text)) return 'program';
  return 'lain';
}

function buildDescription_(payload, category) {
  const parts = [];
  if (payload.description) parts.push(String(payload.description).trim());
  if (payload.pic) parts.push('PIC: ' + String(payload.pic).trim());
  if (payload.agency) parts.push('Agensi: ' + String(payload.agency).trim());
  const reminderDays = clampReminderDays_(payload.reminderDays);
  if (reminderDays > 0) parts.push('Reminder: ' + reminderDays);
  const remindTo = normalizeRemindToList_(payload.remindTo);
  if (remindTo.length) parts.push('RemindTo: ' + remindTo.join(','));
  // Penanda perkongsian: SENARAI saluran yang aktiviti ni dibenarkan keluar.
  // Dua checkbox BEBAS di borang -- guru boleh hantar ke Telegram sahaja, Chat
  // sahaja, atau kedua-dua. Susunan TETAP (tg dahulu) supaya baris kanonik.
  // Perbandingan === true (bukan truthy) supaya string 'false' atau nombor 1 dari
  // client tak tersalah menghidupkan saluran KELUAR domain sekolah.
  const saluran = [];
  if (payload.shareTg === true) saluran.push('tg');
  if (payload.shareGchat === true) saluran.push('gchat');
  if (saluran.length) parts.push('Kongsi: ' + saluran.join(','));
  parts.push('[PPD_CATEGORY:' + category + ']');
  return parts.join('\n');
}

function parseDescriptionMeta_(description) {
  const pic = (description.match(/(?:^|\n)PIC:\s*(.+)/i) || [,''])[1].trim();
  const agency = (description.match(/(?:^|\n)Agensi:\s*(.+)/i) || [,''])[1].trim();
  const reminderMatch = description.match(/(?:^|\n)Reminder:\s*(\d+)/i);
  const reminderDays = reminderMatch ? clampReminderDays_(reminderMatch[1]) : 0;
  const remindToMatch = description.match(/(?:^|\n)RemindTo:\s*(.+)/i);
  const remindTo = remindToMatch ? normalizeRemindToList_(remindToMatch[1]) : [];
  return {
    pic: pic, agency: agency, reminderDays: reminderDays, remindTo: remindTo,
    shareChannels: parseShareChannels_(description)
  };
}

// Had H-1/H-2/H-3 sahaja (padan pilihan dropdown UI) -- pagar nilai dari client
// yang boleh dimanipulasi (console/API terus), bukan cuma bergantung dropdown.
function clampReminderDays_(value) {
  const n = parseInt(value || 0, 10);
  if (isNaN(n) || n < 0) return 0;
  return n > 3 ? 3 : n;
}

// Terima array (dari client) ATAU string dipisah koma (dari description bila baca
// balik) -- trim/lowercase/dedupe, buang entri kosong. Guna normalizeEmail_ sedia ada
// supaya konsisten dgn cara emel dinormalisasi di seluruh sistem (login/pendaftaran).
function normalizeRemindToList_(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  const seen = {};
  const out = [];
  list.forEach(function(v) {
    const email = normalizeEmail_(v);
    if (email && !seen[email]) { seen[email] = true; out.push(email); }
  });
  return out;
}

function cleanDescription_(description) {
  return description
    .replace(/\n?\[PPD_CATEGORY:[a-z]+\]/ig, '')
    .replace(/\n?PIC:\s*.+/ig, '')
    .replace(/\n?Agensi:\s*.+/ig, '')
    .replace(/\n?Reminder:\s*\d+/ig, '')
    .replace(/\n?RemindTo:\s*.+/ig, '')
    // Buang baris Kongsi dari paparan: kalau tak, penanda muncul dalam kotak
    // KETERANGAN bila guru edit, kemudian ditulis semula sebagai teks biasa --
    // penanda berganda, dan aktiviti kekal "dikongsi" walau checkbox dibuang.
    .replace(/\n?Kongsi:\s*.+/ig, '')
    .trim();
}

function validateEventPayload_(payload) {
  if (!payload || !payload.title || !payload.start || !payload.end) {
    throw new Error('Tajuk, masa mula dan masa tamat diperlukan.');
  }

  const start = new Date(payload.start);
  const end = new Date(payload.end);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('Tarikh atau masa tidak sah.');
  if (end <= start) throw new Error('Masa tamat mesti selepas masa mula.');
}

function buildReport_(events) {
  // Cuti/perayaan dikecualikan -- laporan ni track aktiviti kerja sekolah sahaja.
  // Semak kategori (bukan cuma isHoliday) supaya cuti penggal/tambahan KPM yang
  // direkod terus dlm sistem (bukan dari Google) turut dikecualikan.
  const workEvents = events.filter(function(e) { return e.category !== 'cuti'; });
  const counts = { program:0, mesyuarat:0, lawatan:0, taklimat:0, deadline:0, lain:0 };
  workEvents.forEach(function(e) {
    if (counts[e.category] !== undefined) counts[e.category]++;
    else counts.lain++;
  });

  return {
    total: workEvents.length,
    rows: Object.keys(counts).map(function(key) {
      return { key:key, label:CATEGORY_CONFIG[key].label, count:counts[key] };
    })
  };
}

/* =========================================================
   SECURITY / UTILITIES
========================================================= */

function ensureSecuritySalt_() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PPD_SECURITY_SALT')) {
    props.setProperty('PPD_SECURITY_SALT', Utilities.getUuid() + Utilities.getUuid());
  }
}

function hashText_(text) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(text),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    const v = b < 0 ? b + 256 : b;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function sanitizeProfile_(profile) {
  profile = profile || {};
  return {
    name: String(profile.name || '').trim().slice(0, 100),
    email: normalizeEmail_(profile.email),
    position: String(profile.position || '').trim().slice(0, 120),
    unit: String(profile.unit || '').trim().slice(0, 120)
  };
}

function publicUser_(user) {
  return {
    email: user.email,
    name: user.name,
    position: user.position,
    unit: user.unit,
    status: user.status,
    role: user.role,
    roleLabel: ROLE_CONFIG[user.role] ? ROLE_CONFIG[user.role].label : '',
    createdAt: user.createdAt || '',
    approvedAt: user.approvedAt || ''
  };
}

function sendApprovalEmail_(user) {
  try {
    const cfg = getConfig_();
    MailApp.sendEmail({
      to: user.email,
      subject: 'Akses ' + cfg.APP_NAME + ' Diluluskan',
      name: cfg.SHORT_NAME + ' Calendar',
      htmlBody:
        '<div style="font-family:Arial,sans-serif">' +
        '<h2 style="color:' + cfg.THEME_COLOR + '">Permohonan Diluluskan</h2>' +
        '<p>Salam ' + escapeHtmlServer_(user.name) + ',</p>' +
        '<p>Akses anda ke ' + escapeHtmlServer_(cfg.APP_NAME) + ' telah diluluskan sebagai <strong>' +
        escapeHtmlServer_(ROLE_CONFIG[user.role].label) + '</strong>.</p>' +
        '<p>Anda kini boleh buka link dashboard dan terus log masuk automatik menggunakan akaun Google anda.</p>' +
        '</div>',
      body: 'Akses ' + cfg.APP_NAME + ' anda telah diluluskan sebagai ' + ROLE_CONFIG[user.role].label + '.'
    });
  } catch (e) {
    addAudit_('APPROVAL_EMAIL_FAILED', user.email + ' | ' + e.message, getConfig_().ADMIN_EMAIL);
  }
}

// Beritahu Super Admin ada permohonan akses baru menunggu kelulusan.
// Dipanggil di LUAR lock (MailApp lambat), best-effort -- gagal hantar tak patah pendaftaran.
function notifyAdminNewRegistration_(user, pendingTotal) {
  try {
    const cfg = getConfig_();
    if (!cfg.ADMIN_EMAIL) return;
    const row_ = function (label, val) {
      return '<tr><td style="padding:2px 10px 2px 0"><strong>' + label + '</strong></td>' +
             '<td style="padding:2px 0">' + escapeHtmlServer_(val) + '</td></tr>';
    };
    MailApp.sendEmail({
      to: cfg.ADMIN_EMAIL,
      subject: 'Permohonan Akses Baru — ' + cfg.APP_NAME,
      name: cfg.SHORT_NAME + ' Calendar',
      htmlBody:
        '<div style="font-family:Arial,sans-serif">' +
        '<h2 style="color:' + cfg.THEME_COLOR + '">Permohonan Akses Baru</h2>' +
        '<p>Seorang pengguna baharu telah mendaftar dan sedang menunggu kelulusan anda:</p>' +
        '<table style="border-collapse:collapse">' +
        row_('Nama', user.name) + row_('Jawatan', user.position) +
        row_('Unit', user.unit) + row_('Email', user.email) +
        '</table>' +
        '<p>Jumlah permohonan menunggu kelulusan sekarang: <strong>' + pendingTotal + '</strong>.</p>' +
        '<p>Sila buka panel <strong>Pengurusan Pengguna</strong> dalam dashboard untuk luluskan atau tolak.</p>' +
        '</div>',
      body:
        'Permohonan akses baru: ' + user.name + ' (' + user.email + '), ' +
        user.position + ' — ' + user.unit + '. ' +
        'Jumlah menunggu kelulusan: ' + pendingTotal + '. ' +
        'Sila buka panel Pengurusan Pengguna dalam dashboard untuk luluskan.'
    });
  } catch (e) {
    addAudit_('PENDING_NOTIFY_EMAIL_FAILED', user.email + ' | ' + e.message, getConfig_().ADMIN_EMAIL);
  }
}

/* =========================================================
   PERINGATAN AKTIVITI -- Email Digest Harian
   Dipanggil oleh trigger time-driven (lihat installReminderTrigger_), BUKAN client.
   Reka bentuk: SATU email SEHARI (bukan satu per aktiviti) gabung semua aktiviti
   yang jatuh TEPAT H-1/H-2/H-3 (ikut reminderDays dipilih bila aktiviti
   ditambah/diedit). Cuti Google Malaysia (getHolidayEvents_) tak pernah masuk sini
   sebab ia dari calendar berasingan -- fungsi ni cuma scan calendar KERJA.
   ========================================================= */
function sendActivityReminders_() {
  try {
    const cfg = getConfig_();
    if (!cfg.ADMIN_EMAIL) return;
    const cal = getPPDCalendar_();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(today);
    rangeEnd.setDate(rangeEnd.getDate() + 4);

    const due = safeGetEvents_(cal, today, rangeEnd)
      .map(eventToObject_)
      .filter(function(e) { return isReminderDayMatch_(e, today) && !isReminderSent_(e.id); });

    if (!due.length) return;

    const users = getUsers_();
    const approvedEmails = Object.keys(users)
      .map(function(email) { return users[email]; })
      .filter(function(u) { return u.status === 'approved'; })
      .map(function(u) { return u.email; });

    // Setiap aktiviti boleh ada penerima BERBEZA (Semua Guru / Guru Tertentu),
    // jadi kandungan digest kini PERIBADI per guru -- bukan satu BCC sekaligus
    // macam sebelum ni. inbox: email -> senarai aktiviti relevan untuk dia.
    // adminUnsent: aktiviti "Guru Tertentu" yang SEMUA nama dah tak approved --
    // TAK dihantar kat sesiapa, admin je dapat notis (keputusan master).
    const inbox = {};
    const adminUnsent = [];
    due.forEach(function(e) {
      const result = resolveEventRecipients_(e, approvedEmails, cfg.ADMIN_EMAIL);
      if (result.allSuspended) {
        adminUnsent.push(e);
        if (!inbox[cfg.ADMIN_EMAIL]) inbox[cfg.ADMIN_EMAIL] = [];
        return;
      }
      result.recipients.forEach(function(email) {
        if (!inbox[email]) inbox[email] = [];
        inbox[email].push(e);
      });
    });

    // Best-effort per penerima -- satu emel gagal (cth alamat rosak) tak patut
    // halang penerima lain terima digest mereka.
    Object.keys(inbox).forEach(function(email) {
      const events = inbox[email];
      const unsent = email === cfg.ADMIN_EMAIL ? adminUnsent : [];
      if (!events.length && !unsent.length) return;
      try {
        MailApp.sendEmail({
          to: email,
          subject: 'Peringatan Aktiviti — ' + cfg.APP_NAME,
          name: cfg.SHORT_NAME + ' Calendar',
          htmlBody: buildReminderDigestHtml_(events, cfg, unsent),
          body: buildReminderDigestText_(events, unsent)
        });
      } catch (e) {
        addAudit_('REMINDER_EMAIL_FAILED', email + ' | ' + e.message, cfg.ADMIN_EMAIL);
      }
    });

    due.forEach(function(e) { markReminderSent_(e.id); });
  } catch (e) {
    addAudit_('REMINDER_DIGEST_FAILED', e.message, getConfig_().ADMIN_EMAIL);
  }
}

// Pure -- tentukan senarai emel yang patut terima reminder aktiviti ni.
// remindTo diisi -> HANYA nama tu (ditapis kekal approved) + admin (overview).
// remindTo kosong ("Semua Guru") -> semua approved + admin. Admin SENTIASA
// termasuk supaya dia nampak gambaran penuh (keputusan master).
// Pulangkan { recipients, allSuspended }. "Guru Tertentu" yang SEMUA nama dalam
// senarai dah tak approved (disuspend/dipadam) -- JANGAN fallback broadcast ke
// Semua Guru (keputusan master 2026-09-06): allSuspended=true, recipients kosong,
// caller (sendActivityReminders_) yang uruskan notis khas ke admin sahaja.
function resolveEventRecipients_(event, approvedEmails, adminEmail) {
  const wasTargeted = !!(event.remindTo && event.remindTo.length);

  if (!wasTargeted) {
    const set = {};
    approvedEmails.forEach(function(e) { if (e) set[e] = true; });
    if (adminEmail) set[adminEmail] = true;
    return { recipients: Object.keys(set), allSuspended: false };
  }

  const approvedSet = {};
  approvedEmails.forEach(function(e) { approvedSet[e] = true; });
  const remindTo = event.remindTo.filter(function(e) { return approvedSet[e]; });

  if (!remindTo.length) return { recipients: [], allSuspended: true };

  const set = {};
  remindTo.forEach(function(e) { set[e] = true; });
  if (adminEmail) set[adminEmail] = true;
  return { recipients: Object.keys(set), allSuspended: false };
}

// Pure -- kira sama ada aktiviti jatuh TEPAT pada hari H-nya. Diuji dalam
// selfTestReminderHelpers_(). Semakan "dah hantar" (isReminderSent_) SENGAJA
// berasingan sebab tu stateful (PropertiesService), bukan logik tarikh.
function isReminderDayMatch_(event, today) {
  if (!event.reminderDays) return false;
  const startDay = new Date(event.start);
  startDay.setHours(0, 0, 0, 0);
  const diff = Math.round((startDay - today) / 86400000);
  return diff === event.reminderDays;
}

function isReminderSent_(eventId) {
  return !!PropertiesService.getScriptProperties().getProperty('RSENT_' + eventId);
}

function markReminderSent_(eventId) {
  PropertiesService.getScriptProperties().setProperty('RSENT_' + eventId, String(Date.now()));
}

// unsent (optional) -- HANYA diisi untuk digest admin: aktiviti "Guru Tertentu"
// yang semua nama ditag dah tak approved, jadi TAK dihantar kat sesiapa. Admin
// nampak kad amaran berasingan (bukan tersenarai macam reminder biasa).
function buildReminderDigestHtml_(events, cfg, unsent) {
  const cards = events.map(function(e) {
    const rows = [];
    rows.push(reminderRow_('Tarikh', formatDate_(new Date(e.start), 'EEEE, d MMMM yyyy')));
    rows.push(reminderRow_('Lagi', e.reminderDays + ' hari lagi'));
    if (e.location) rows.push(reminderRow_('Lokasi', e.location));
    if (e.pic) rows.push(reminderRow_('PIC', e.pic));
    if (e.agency) rows.push(reminderRow_('Agensi', e.agency));
    return '<div style="border-left:4px solid ' + cfg.THEME_COLOR + ';padding:8px 12px;margin:10px 0;background:#f7f9fc">' +
      '<p style="margin:0 0 6px;font-weight:bold;font-size:15px">' + escapeHtmlServer_(e.title) +
      ' <span style="font-weight:normal;color:#6f7f93">(' + escapeHtmlServer_(e.categoryLabel) + ')</span></p>' +
      '<table style="border-collapse:collapse;font-size:14px">' + rows.join('') + '</table>' +
      '</div>';
  }).join('');

  const unsentCards = (unsent || []).map(function(e) {
    return '<div style="border-left:4px solid #dc2626;padding:8px 12px;margin:10px 0;background:#fef2f2">' +
      '<p style="margin:0 0 4px;font-weight:bold;font-size:15px;color:#dc2626">⚠️ Reminder TIDAK dihantar — ' +
      escapeHtmlServer_(e.title) + '</p>' +
      '<p style="margin:0;font-size:13px">Semua guru yang ditag sebagai "Guru Penerima" untuk aktiviti ini ' +
      'sudah tidak aktif (disuspend/dipadam). Sila semak semula senarai penerima aktiviti ini.</p>' +
      '</div>';
  }).join('');

  const intro = events.length
    ? '<p>Berikut aktiviti berjadual dalam <strong>' + escapeHtmlServer_(cfg.APP_NAME) + '</strong> yang akan berlangsung tidak lama lagi:</p>'
    : '';

  return '<div style="font-family:Arial,sans-serif">' +
    '<h2 style="color:' + cfg.THEME_COLOR + '">Peringatan Aktiviti Akan Datang</h2>' +
    '<p>Salam sejahtera,</p>' +
    intro +
    cards +
    unsentCards +
    '<p style="color:#6f7f93;font-size:12px">Emel ini dihantar automatik oleh sistem ' + escapeHtmlServer_(cfg.APP_NAME) + '. Sila jangan balas emel ini.</p>' +
    '</div>';
}

function reminderRow_(label, val) {
  return '<tr><td style="padding:2px 10px 2px 0"><strong>' + label + '</strong></td>' +
         '<td style="padding:2px 0">' + escapeHtmlServer_(val) + '</td></tr>';
}

function buildReminderDigestText_(events, unsent) {
  const lines = [];
  if (events.length) {
    lines.push('Peringatan Aktiviti:');
    events.forEach(function(e) {
      lines.push('- ' + e.title + ' (' + e.reminderDays + ' hari lagi, ' + formatDate_(new Date(e.start), 'd MMMM yyyy') + ')');
    });
  }
  (unsent || []).forEach(function(e) {
    lines.push('[TIDAK DIHANTAR] ' + e.title + ' -- semua guru ditag sudah tidak aktif.');
  });
  return lines.join('\n');
}

// Jalankan SEKALI SAHAJA dari Apps Script Editor (Run) selepas deploy code ni --
// clasp push/deploy TAK automatik cipta trigger. Idempotent: selamat dijalankan
// berkali-kali, tak akan duplicate trigger.
// Padam SEMUA trigger sendActivityReminders_ sedia ada, cipta SATU baharu ikut jam
// (0-23) yang diberi. Idempotent -- selamat dipanggil berkali-kali, tak akan
// bertambah trigger. Dipanggil AUTOMATIK oleh installSystem()/updateSystemSettings()
// setiap kali System Settings disimpan, supaya jadual reminder sentiasa padan
// REMINDER_HOUR terkini tanpa admin perlu masuk Apps Script Editor langsung.
function syncReminderTrigger_(hour) {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'sendActivityReminders_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendActivityReminders_').timeBased().everyDays(1).atHour(clampReminderHour_(hour)).create();
}

// Bootstrap MANUAL dari Apps Script Editor (Run) -- HANYA perlu sekali untuk
// sistem yang dipasang SEBELUM ciri jam-boleh-tukar ni wujud (trigger belum
// pernah dicipta). Sistem baharu / lepas System Settings pertama kali disimpan
// dah auto-dapat trigger via syncReminderTrigger_(), tak perlu fungsi ni lagi.
function installReminderTrigger_() {
  const hour = getConfig_().REMINDER_HOUR;
  syncReminderTrigger_(hour);
  return 'Trigger direset -- jalan setiap hari lebih kurang jam ' + String(hour).padStart(2, '0') + ':00.';
}

function escapeHtmlServer_(s) {
  return String(s || '').replace(/[&<>"']/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// "moe-dl.edu.my, @Sekolahku.Edu.My ; x" -> ['moe-dl.edu.my','sekolahku.edu.my']
// Buang '@' di depan, lowercase, pisah ikut koma/ruang/semikolon, tolak yang kosong.
function parseDomainList_(raw) {
  return String(raw || '')
    .toLowerCase()
    .split(/[\s,;]+/)
    .map(function (d) { return d.replace(/^@+/, '').trim(); })
    .filter(function (d) { return d.length > 0; });
}

function isValidDomain_(d) {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(String(d || ''));
}

// Domain bahagian selepas '@' bagi satu email (sudah dinormalkan lowercase).
function emailDomain_(email) {
  var parts = String(email || '').split('@');
  return parts.length === 2 ? parts[1] : '';
}

function sortByStart_(a,b) { return new Date(a.start) - new Date(b.start); }
function startOfDay_(d) { const x=new Date(d);x.setHours(0,0,0,0);return x; }
function endOfDay_(d) { const x=new Date(d);x.setHours(23,59,59,999);return x; }
function formatDate_(d,p) { return Utilities.formatDate(d, getConfig_().TIMEZONE, p); }

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

// 0..6 -> ScriptApp.WeekDay.SUNDAY..SATURDAY. Luar julat / sampah -> Ahad (lalai
// spec). Tidak boleh jadi jadual pemalar di peringkat fail: ScriptApp.WeekDay
// hanya wujud pada runtime Apps Script.
// Pagar julat SENDIRI (bukan clampDigestDay_): clampDigestDay_ POTONG nilai tinggi
// ke 6 (Sabtu), jadi day=7 akan jadi Sabtu, bukan Ahad. Spec mahu luar julat DUA
// arah -> Ahad, jadi kita tapis 0..6 terus di sini.
function weekDayEnum_(n) {
  const days = [ScriptApp.WeekDay.SUNDAY, ScriptApp.WeekDay.MONDAY, ScriptApp.WeekDay.TUESDAY,
                ScriptApp.WeekDay.WEDNESDAY, ScriptApp.WeekDay.THURSDAY, ScriptApp.WeekDay.FRIDAY,
                ScriptApp.WeekDay.SATURDAY];
  const i = parseInt(n, 10);
  return days[(i >= 0 && i <= 6) ? i : 0];
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
      // JANGAN sertakan e.message di sini: pada kegagalan tahap rangkaian (DNS, timeout,
      // SSL), e.message boleh mengandungi URL endpoint lengkap (bersama token bot rahsia).
      addAudit_('DIGEST_SEND_FAILED', 'telegram | ' + id + ' | ralat rangkaian', adminEmail);
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
    if (!GCHAT_WEBHOOK_HOST_RE.test(u)) {
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
      // JANGAN sertakan e.message di sini: pada kegagalan tahap rangkaian (DNS, timeout,
      // SSL), e.message boleh mengandungi URL webhook lengkap (bersama key/token rahsia).
      addAudit_('DIGEST_SEND_FAILED', 'gchat | ' + label + ' | ralat rangkaian', adminEmail);
    }
  });
  return berjaya;
}

// Handler trigger mingguan. Dipanggil oleh trigger masa (syncDigestTrigger_), BUKAN
// client -- tiada token sesi di sini, jadi tiada requireSession_.
// Prasyarat sekali sahaja: master mesti Run fungsi ni SEKALI dari Apps Script Editor
// untuk memberi kebenaran "sambung ke perkhidmatan luar" (UrlFetchApp). Tanpa itu,
// eksekusi trigger gagal SENYAP.
function sendWeeklyDigest_() {
  // adminEmail diselesaikan SEKALI di sini (bukan dalam catch) supaya catch di bawah
  // TIDAK perlu panggil getConfig_() lagi. getConfig_() baca PropertiesService --
  // kalau PUNCA kegagalan asal ialah PropertiesService sendiri (kuota/servis terganggu),
  // panggilan kedua akan gagal juga dan pengecualian KEDUA itu (dinilai sebagai hujah
  // kepada addAudit_ SEBELUM addAudit_ sempat jalan) lepaskan terus keluar dari fungsi
  // ini -- melanggar syarat "trigger handler tak boleh sekali-kali throw keluar".
  // Kalau getConfig_() gagal pada percubaan PERTAMA (baris seterusnya), adminEmail
  // kekal undefined dan addAudit_ tetap selamat (normalizeEmail_ terima undefined).
  let adminEmail;
  try {
    const cfg = getConfig_();
    adminEmail = cfg.ADMIN_EMAIL;
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
    addAudit_('DIGEST_RUN_FAILED', e.message, adminEmail);
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

/* =========================================================
   SELF-TEST (pilihan) -- jalankan dari editor Apps Script.
   Fungsi tulen sahaja, TIDAK sentuh PropertiesService / data sebenar.
   Untuk ujian had/throttle bersifat stateful, guna checklist manual di @HEAD.
   ========================================================= */
function selfTestRegHelpers_() {
  const results = [];
  function ok(name, cond) { results.push((cond ? 'PASS' : 'FAIL') + ' :: ' + name); }
  function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  ok('parseDomainList_ pisah + buang @ + lowercase',
     eq(parseDomainList_(' @MOE-DL.edu.my ,  Sekolahku.Edu.My ;x.com'),
        ['moe-dl.edu.my', 'sekolahku.edu.my', 'x.com']));
  ok('parseDomainList_ kosong -> []', eq(parseDomainList_(''), []) && eq(parseDomainList_(null), []));
  ok('isValidDomain_ terima domain biasa', isValidDomain_('moe-dl.edu.my') && isValidDomain_('a.co'));
  ok('isValidDomain_ tolak tiada titik / ada @ / hujung dash',
     !isValidDomain_('localhost') && !isValidDomain_('@x.com') && !isValidDomain_('x-.com'));
  ok('emailDomain_ ambil bahagian selepas @',
     emailDomain_('guru@moe-dl.edu.my') === 'moe-dl.edu.my' && emailDomain_('rosak') === '');

  // Simulasi keputusan gerbang domain (logik sama macam submitRegistration)
  function domainAllowed(list, email) {
    const allow = parseDomainList_(list);
    return !allow.length || allow.indexOf(emailDomain_(email)) !== -1;
  }
  ok('domain: kosong = benarkan semua', domainAllowed('', 'sesiapa@gmail.com'));
  ok('domain: dalam senarai = lulus', domainAllowed('moe-dl.edu.my', 'guru@moe-dl.edu.my'));
  ok('domain: luar senarai = tolak', !domainAllowed('moe-dl.edu.my', 'orang@gmail.com'));
  ok('domain: subdomain TIDAK auto-lulus (padanan tepat)',
     !domainAllowed('moe-dl.edu.my', 'x@student.moe-dl.edu.my'));

  const summary = results.join('\n');
  Logger.log(summary);
  const failed = results.filter(function (r) { return r.indexOf('FAIL') === 0; }).length;
  if (failed) throw new Error(failed + ' ujian GAGAL:\n' + summary);
  return summary;
}

function selfTestReminderHelpers_() {
  const results = [];
  function ok(name, cond) { results.push((cond ? 'PASS' : 'FAIL') + ' :: ' + name); }
  function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  ok('clampReminderDays_ dalam julat kekal', clampReminderDays_('2') === 2);
  ok('clampReminderDays_ > 3 dipotong ke 3', clampReminderDays_('99') === 3);
  ok('clampReminderDays_ negatif/rosak -> 0', clampReminderDays_('-5') === 0 && clampReminderDays_('abc') === 0);
  ok('clampReminderDays_ kosong/null -> 0', clampReminderDays_('') === 0 && clampReminderDays_(null) === 0);

  ok('clampReminderHour_ dalam julat kekal', clampReminderHour_(6) === 6 && clampReminderHour_('23') === 23);
  ok('clampReminderHour_ > 23 dipotong ke 23', clampReminderHour_(99) === 23);
  ok('clampReminderHour_ negatif/rosak -> default', clampReminderHour_(-1) === DEFAULT_CONFIG.REMINDER_HOUR && clampReminderHour_('abc') === DEFAULT_CONFIG.REMINDER_HOUR);
  ok('clampReminderHour_ 0 KEKAL 0 (bukan default) -- 0 nilai sah, bukan "kosong"', clampReminderHour_(0) === 0);

  const desc = buildDescription_({ description: 'Ceramah motivasi', pic: 'Cikgu Ali', agency: 'JPN', reminderDays: '2' }, 'taklimat');
  ok('buildDescription_ sertakan baris Reminder', desc.indexOf('Reminder: 2') !== -1);
  const meta = parseDescriptionMeta_(desc);
  ok('parseDescriptionMeta_ round-trip reminderDays', meta.reminderDays === 2);
  ok('parseDescriptionMeta_ round-trip pic/agency kekal', meta.pic === 'Cikgu Ali' && meta.agency === 'JPN');

  const descNoReminder = buildDescription_({ pic: 'Cikgu Ali' }, 'program');
  ok('buildDescription_ reminderDays=0 -> tiada baris Reminder', descNoReminder.indexOf('Reminder:') === -1);
  ok('parseDescriptionMeta_ tiada baris Reminder -> 0', parseDescriptionMeta_(descNoReminder).reminderDays === 0);
  ok('cleanDescription_ buang baris Reminder dari paparan', cleanDescription_(desc).indexOf('Reminder') === -1);

  const today = new Date(2026, 8, 6);
  today.setHours(0, 0, 0, 0);
  function dayOffset(n) { const d = new Date(today); d.setDate(d.getDate() + n); return d.toISOString(); }
  ok('isReminderDayMatch_ tepat H-3 padan', isReminderDayMatch_({ start: dayOffset(3), reminderDays: 3 }, today));
  ok('isReminderDayMatch_ H-2 tak padan bila reminderDays=3', !isReminderDayMatch_({ start: dayOffset(2), reminderDays: 3 }, today));
  ok('isReminderDayMatch_ reminderDays=0 -> false', !isReminderDayMatch_({ start: dayOffset(1), reminderDays: 0 }, today));
  ok('isReminderDayMatch_ event dah lepas -> false', !isReminderDayMatch_({ start: dayOffset(-1), reminderDays: 1 }, today));
  ok('isReminderDayMatch_ diff LEBIH BESAR dari reminderDays -> false (padanan TEPAT, bukan >=)',
     !isReminderDayMatch_({ start: dayOffset(5), reminderDays: 3 }, today));

  ok('normalizeRemindToList_ terima array, lowercase + dedupe',
     eq(normalizeRemindToList_(['Ali@Sekolah.edu.my', 'ali@sekolah.edu.my', 'Ali@Sekolah.edu.my ']),
        ['ali@sekolah.edu.my']));
  ok('normalizeRemindToList_ terima string dipisah koma',
     eq(normalizeRemindToList_('a@x.com,b@x.com'), ['a@x.com', 'b@x.com']));
  ok('normalizeRemindToList_ kosong/null -> []', eq(normalizeRemindToList_(''), []) && eq(normalizeRemindToList_(null), []));

  const descRemindTo = buildDescription_({ pic: 'Cikgu Ali', remindTo: ['B@x.com', 'a@x.com'] }, 'mesyuarat');
  ok('buildDescription_ sertakan baris RemindTo', descRemindTo.indexOf('RemindTo: b@x.com,a@x.com') !== -1);
  ok('parseDescriptionMeta_ round-trip remindTo', eq(parseDescriptionMeta_(descRemindTo).remindTo, ['b@x.com', 'a@x.com']));
  ok('parseDescriptionMeta_ tiada baris RemindTo -> []', eq(parseDescriptionMeta_(desc).remindTo, []));
  ok('cleanDescription_ buang baris RemindTo dari paparan', cleanDescription_(descRemindTo).indexOf('RemindTo') === -1);

  const approved = ['a@x.com', 'b@x.com', 'c@x.com', 'admin@x.com'];
  ok('resolveEventRecipients_ Semua Guru (remindTo kosong) -> semua approved + admin',
     eq(resolveEventRecipients_({ remindTo: [] }, approved, 'admin@x.com').recipients.sort(), approved.slice().sort()));
  ok('resolveEventRecipients_ Semua Guru -> allSuspended sentiasa false',
     resolveEventRecipients_({ remindTo: [] }, approved, 'admin@x.com').allSuspended === false);
  ok('resolveEventRecipients_ Guru Tertentu -> HANYA nama tu + admin (bukan semua)',
     eq(resolveEventRecipients_({ remindTo: ['a@x.com'] }, approved, 'admin@x.com').recipients.sort(), ['a@x.com', 'admin@x.com'].sort()));
  ok('resolveEventRecipients_ SEBAHAGIAN guru ditag disuspend -> baki yg approved je (bukan semua ditapis)',
     eq(resolveEventRecipients_({ remindTo: ['a@x.com', 'bekas-guru@x.com'] }, approved, 'admin@x.com').recipients.sort(), ['a@x.com', 'admin@x.com'].sort()));
  ok('resolveEventRecipients_ SEMUA guru ditag disuspend -> allSuspended=true, recipients KOSONG (bukan fallback Semua Guru)',
     (function() {
       const r = resolveEventRecipients_({ remindTo: ['bekas-guru@x.com'] }, approved, 'admin@x.com');
       return r.allSuspended === true && eq(r.recipients, []);
     })());
  ok('resolveEventRecipients_ admin sedia ada dalam approved -> tiada duplicate',
     resolveEventRecipients_({ remindTo: ['admin@x.com'] }, approved, 'admin@x.com').recipients.length === 1);

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

  const summary = results.join('\n');
  Logger.log(summary);
  const failed = results.filter(function (r) { return r.indexOf('FAIL') === 0; }).length;
  if (failed) throw new Error(failed + ' ujian GAGAL:\n' + summary);
  return summary;
}

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
     isoWeekKey_(new Date(2026, 8, 14)) === isoWeekKey_(new Date(2026, 8, 20)));

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

  const summary = results.join('\n');
  Logger.log(summary);
  const failed = results.filter(function (r) { return r.indexOf('FAIL') === 0; }).length;
  if (failed) throw new Error(failed + ' ujian GAGAL:\n' + summary);
  return summary;
}
