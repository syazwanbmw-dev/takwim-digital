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
  OTP_EXPIRY_MINUTES: 10,
  OTP_MAX_ATTEMPTS: 5,
  OTP_RESEND_SECONDS: 60,
  SESSION_DAYS: 7,
  MAX_AUDIT_ROWS: 400
};

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
    FOOTER_TEXT: String(input.footerText || '').trim().slice(0, 180)
  };

  if (!cfg.APP_NAME || !cfg.OFFICE_NAME || !cfg.SHORT_NAME || !cfg.CALENDAR_ID || !cfg.ADMIN_EMAIL) {
    throw new Error('Nama sistem, organisasi, nama pendek, email admin dan Calendar ID diperlukan.');
  }
  if (!isValidEmail_(cfg.ADMIN_EMAIL)) throw new Error('Email Super Admin tidak sah.');
  if (!validateHexColor_(cfg.THEME_COLOR)) throw new Error('Warna tema tidak sah.');
  return cfg;
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
      footerText: cfg.FOOTER_TEXT
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
  addAudit_('SYSTEM_INSTALLED', finalCfg.APP_NAME + ' | ' + finalCfg.OFFICE_NAME, finalCfg.ADMIN_EMAIL);

  return {
    success: true,
    message: 'Sistem berjaya dipasang.',
    config: getBootstrapState().config
  };
}

function getSystemSettings(token) {
  requireSession_(token, 'canManageUsers');
  const cfg = getConfig_();
  return {
    appName: cfg.APP_NAME,
    officeName: cfg.OFFICE_NAME,
    shortName: cfg.SHORT_NAME,
    timezone: cfg.TIMEZONE,
    calendarId: cfg.CALENDAR_ID,
    adminEmail: cfg.ADMIN_EMAIL,
    themeColor: cfg.THEME_COLOR,
    allowRegistration: cfg.ALLOW_REGISTRATION,
    footerText: cfg.FOOTER_TEXT
  };
}

function updateSystemSettings(token, input) {
  const admin = requireSession_(token, 'canManageUsers');
  const current = getConfig_();
  const mergedInput = {
    appName: input.appName || current.APP_NAME,
    officeName: input.officeName || current.OFFICE_NAME,
    shortName: input.shortName || current.SHORT_NAME,
    timezone: input.timezone || current.TIMEZONE,
    calendarId: input.calendarId || current.CALENDAR_ID,
    adminEmail: current.ADMIN_EMAIL,
    themeColor: input.themeColor || current.THEME_COLOR,
    allowRegistration: input.allowRegistration !== false,
    footerText: input.footerText !== undefined ? input.footerText : current.FOOTER_TEXT
  };
  const next = Object.assign({}, DEFAULT_CONFIG, validateSetupInput_(mergedInput));

  const cal = CalendarApp.getCalendarById(next.CALENDAR_ID);
  if (!cal) throw new Error('Calendar ID baharu tidak dapat diakses.');

  PropertiesService.getScriptProperties().setProperty('APP_CONFIG_V3', JSON.stringify(next));
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

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(getConfig_().APP_NAME)
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
    otpExpiryMinutes: cfg.OTP_EXPIRY_MINUTES,
    themeColor: cfg.THEME_COLOR,
    allowRegistration: cfg.ALLOW_REGISTRATION,
    footerText: cfg.FOOTER_TEXT
  };
}

/**
 * Registration Step 1:
 * validates profile and emails an OTP.
 */
function requestRegistrationOtp(profile) {
  requireInstalled_();
  if (!getConfig_().ALLOW_REGISTRATION) throw new Error('Pendaftaran staff ditutup oleh Super Admin.');
  profile = sanitizeProfile_(profile);

  if (!profile.name || !profile.email || !profile.position || !profile.unit) {
    throw new Error('Nama, email, jawatan dan unit diperlukan.');
  }

  const users = getUsers_();
  const existing = users[profile.email];

  if (existing && existing.status === 'approved') {
    throw new Error('Email ini sudah mempunyai akaun. Gunakan menu Log Masuk.');
  }

  issueOtp_(profile.email, 'register', profile);

  return {
    success: true,
    message: 'Kod OTP telah dihantar ke ' + maskEmail_(profile.email) + '.',
    expiresMinutes: getConfig_().OTP_EXPIRY_MINUTES
  };
}

/**
 * Registration Step 2:
 * OTP proves control of email, then application becomes PENDING.
 */
function verifyRegistrationOtp(profile, otp) {
  requireInstalled_();
  if (!getConfig_().ALLOW_REGISTRATION) throw new Error('Pendaftaran staff ditutup oleh Super Admin.');
  profile = sanitizeProfile_(profile);
  verifyOtp_(profile.email, String(otp || '').trim(), 'register');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const users = getUsers_();

    if (users[profile.email] && users[profile.email].status === 'approved') {
      throw new Error('Akaun ini sudah diluluskan.');
    }

    users[profile.email] = {
      email: profile.email,
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
  } finally {
    lock.releaseLock();
  }

  addAudit_('REGISTRATION_SUBMITTED', profile.email + ' | ' + profile.name, profile.email);

  return {
    success: true,
    status: 'pending',
    message: 'Pendaftaran berjaya. Permohonan sedang menunggu kelulusan Super Admin.'
  };
}

/**
 * Login Step 1.
 * OTP is only sent to approved users (or admin).
 */
function requestLoginOtp(email) {
  requireInstalled_();
  email = normalizeEmail_(email);
  if (!isValidEmail_(email)) throw new Error('Email tidak sah.');

  ensureAdminRecord_();
  const users = getUsers_();
  const user = users[email];

  if (!user) {
    throw new Error('Email belum berdaftar. Sila daftar dahulu.');
  }

  if (user.status === 'pending') {
    throw new Error('Permohonan masih menunggu kelulusan Super Admin.');
  }

  if (user.status === 'rejected') {
    throw new Error('Permohonan akses tidak diluluskan.');
  }

  if (user.status === 'suspended') {
    throw new Error('Akaun ini telah digantung. Hubungi Super Admin.');
  }

  if (user.status !== 'approved') {
    throw new Error('Akaun belum aktif.');
  }

  issueOtp_(email, 'login', null);

  return {
    success: true,
    message: 'Kod OTP login dihantar ke ' + maskEmail_(email) + '.'
  };
}

/**
 * Login Step 2.
 * Returns a bearer-style session token to store in browser localStorage.
 */
function verifyLoginOtp(email, otp) {
  requireInstalled_();
  email = normalizeEmail_(email);
  verifyOtp_(email, String(otp || '').trim(), 'login');

  const users = getUsers_();
  const user = users[email];

  if (!user || user.status !== 'approved') {
    throw new Error('Akaun tidak aktif.');
  }

  const token = createSession_(user);
  addAudit_('LOGIN_SUCCESS', user.name || user.email, email);

  return {
    success: true,
    token: token,
    user: publicUser_(user),
    message: 'Log masuk berjaya.'
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
  applyReminder_(event, payload.reminderMinutes);

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
  applyReminder_(event, payload.reminderMinutes);

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

  try {
    const popup = source.getPopupReminders() || [];
    popup.forEach(function(minutes) {
      if (minutes >= 5 && minutes <= 40320) clone.addPopupReminder(minutes);
    });
  } catch (e) {}

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
   OTP + SESSION INTERNALS
========================================================= */

function issueOtp_(email, purpose, profile) {
  email = normalizeEmail_(email);
  if (!isValidEmail_(email)) throw new Error('Email tidak sah.');

  const props = PropertiesService.getScriptProperties();
  const key = otpKey_(email, purpose);
  const existingRaw = props.getProperty(key);
  const now = Date.now();

  if (existingRaw) {
    try {
      const existing = JSON.parse(existingRaw);
      if (existing.lastSentAt && (now - existing.lastSentAt) < getConfig_().OTP_RESEND_SECONDS * 1000) {
        const wait = Math.ceil((getConfig_().OTP_RESEND_SECONDS * 1000 - (now - existing.lastSentAt)) / 1000);
        throw new Error('Tunggu ' + wait + ' saat sebelum minta OTP baharu.');
      }
    } catch (e) {
      if (String(e.message || '').indexOf('Tunggu ') === 0) throw e;
    }
  }

  const quota = MailApp.getRemainingDailyQuota();
  if (quota < 1) throw new Error('Kuota penghantaran email hari ini telah habis.');

  const otp = generateOtp_();
  const record = {
    hash: hashOtp_(email, purpose, otp),
    expiresAt: now + getConfig_().OTP_EXPIRY_MINUTES * 60 * 1000,
    attempts: 0,
    lastSentAt: now,
    profile: profile || null
  };

  props.setProperty(key, JSON.stringify(record));

  const cfg = getConfig_();
  const subject = purpose === 'register'
    ? 'Kod OTP Pendaftaran - ' + cfg.SHORT_NAME
    : 'Kod OTP Log Masuk - ' + cfg.SHORT_NAME;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
      <h2 style="color:${cfg.THEME_COLOR}">${escapeHtmlServer_(cfg.APP_NAME)}</h2>
      <p>Kod OTP anda:</p>
      <div style="font-size:34px;font-weight:700;letter-spacing:8px;padding:16px;background:#f3f7fc;border-radius:12px;text-align:center">${otp}</div>
      <p>Kod ini sah selama <strong>${getConfig_().OTP_EXPIRY_MINUTES} minit</strong>.</p>
      <p style="color:#666;font-size:12px">Jika anda tidak membuat permintaan ini, abaikan email ini.</p>
    </div>`;

  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody: html,
    body: 'Kod OTP anda ialah ' + otp + '. Sah selama ' + getConfig_().OTP_EXPIRY_MINUTES + ' minit.',
    name: getConfig_().SHORT_NAME + ' Calendar'
  });
}

function verifyOtp_(email, otp, purpose) {
  email = normalizeEmail_(email);
  if (!/^\d{6}$/.test(otp)) throw new Error('OTP mesti 6 digit.');

  const props = PropertiesService.getScriptProperties();
  const key = otpKey_(email, purpose);
  const raw = props.getProperty(key);

  if (!raw) throw new Error('Tiada OTP aktif. Minta kod baharu.');

  let record;
  try { record = JSON.parse(raw); } catch (e) { throw new Error('Rekod OTP rosak. Minta kod baharu.'); }

  if (Date.now() > record.expiresAt) {
    props.deleteProperty(key);
    throw new Error('OTP telah tamat tempoh. Minta kod baharu.');
  }

  record.attempts = Number(record.attempts || 0) + 1;
  if (record.attempts > getConfig_().OTP_MAX_ATTEMPTS) {
    props.deleteProperty(key);
    throw new Error('Terlalu banyak cubaan. Minta OTP baharu.');
  }

  const expected = hashOtp_(email, purpose, otp);
  if (record.hash !== expected) {
    props.setProperty(key, JSON.stringify(record));
    throw new Error('Kod OTP tidak betul.');
  }

  props.deleteProperty(key);
  return true;
}

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
  if (Date.now() > s.expiresAt) {
    delete sessions[key];
    saveSessions_(sessions);
    throw new Error('Sesi telah tamat. Sila login semula.');
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
    reminderMinutes: 0,
    pic: '',
    agency: '',
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

  let popup = [];
  let email = [];
  try { popup = event.getPopupReminders() || []; } catch (e) {}
  try { email = event.getEmailReminders() || []; } catch (e) {}

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
    hasReminder: popup.length > 0 || email.length > 0,
    reminderMinutes: popup.length ? popup[0] : 0,
    pic: meta.pic,
    agency: meta.agency
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
  parts.push('[PPD_CATEGORY:' + category + ']');
  return parts.join('\n');
}

function parseDescriptionMeta_(description) {
  const pic = (description.match(/(?:^|\n)PIC:\s*(.+)/i) || [,''])[1].trim();
  const agency = (description.match(/(?:^|\n)Agensi:\s*(.+)/i) || [,''])[1].trim();
  return { pic: pic, agency: agency };
}

function cleanDescription_(description) {
  return description
    .replace(/\n?\[PPD_CATEGORY:[a-z]+\]/ig, '')
    .replace(/\n?PIC:\s*.+/ig, '')
    .replace(/\n?Agensi:\s*.+/ig, '')
    .trim();
}

function applyReminder_(event, reminderMinutes) {
  const minutes = parseInt(reminderMinutes || 0, 10);
  event.removeAllReminders();
  if (minutes >= 5 && minutes <= 40320) event.addPopupReminder(minutes);
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

function generateOtp_() {
  const hex = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  const num = parseInt(hex, 16) % 1000000;
  return String(num).padStart(6, '0');
}

function otpKey_(email, purpose) {
  return 'OTP_V23_' + hashText_(purpose + '|' + normalizeEmail_(email)).slice(0, 40);
}

function hashOtp_(email, purpose, otp) {
  const salt = PropertiesService.getScriptProperties().getProperty('PPD_SECURITY_SALT') || '';
  return hashText_(normalizeEmail_(email) + '|' + purpose + '|' + otp + '|' + salt);
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
        '<p>Anda kini boleh buka link dashboard dan log masuk menggunakan OTP email.</p>' +
        '</div>',
      body: 'Akses ' + cfg.APP_NAME + ' anda telah diluluskan sebagai ' + ROLE_CONFIG[user.role].label + '.'
    });
  } catch (e) {
    addAudit_('APPROVAL_EMAIL_FAILED', user.email + ' | ' + e.message, getConfig_().ADMIN_EMAIL);
  }
}

function escapeHtmlServer_(s) {
  return String(s || '').replace(/[&<>"']/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

function maskEmail_(email) {
  const p = String(email).split('@');
  if (p.length !== 2) return email;
  const name = p[0];
  return (name.length <= 2 ? name[0] + '*' : name.slice(0,2) + '***' + name.slice(-1)) + '@' + p[1];
}

function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sortByStart_(a,b) { return new Date(a.start) - new Date(b.start); }
function startOfDay_(d) { const x=new Date(d);x.setHours(0,0,0,0);return x; }
function endOfDay_(d) { const x=new Date(d);x.setHours(23,59,59,999);return x; }
function formatDate_(d,p) { return Utilities.formatDate(d, getConfig_().TIMEZONE, p); }
