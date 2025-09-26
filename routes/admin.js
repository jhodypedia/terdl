const express = require('express');
const router = express.Router();
const { User, Setting } = require('../models');
const { ensureAdmin } = require('../middlewares/auth');
const bcrypt = require('bcryptjs');
const { listCache, deleteCache } = require('../services/cache');

// login
router.get('/login', (req, res) => {
  res.render('admin/login', { title: 'Admin Login', csrfToken: req.csrfToken(), error: null });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const u = await User.findOne({ where: { email } });
  if (u && u.checkPassword(password)) {
    req.session.user = { id: u.id, email: u.email };
    return res.redirect('/admin');
  }
  return res.render('admin/login', { title: 'Admin Login', csrfToken: req.csrfToken(), error: 'Email atau password salah' });
});

router.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/admin/login')));

// dashboard
router.get('/', ensureAdmin, async (req, res) => {
  res.render('admin/dashboard', { title: 'Dashboard', csrfToken: req.csrfToken() });
});

// settings
router.get('/settings', ensureAdmin, async (req, res) => {
  const rows = await Setting.findAll();
  const s = {}; rows.forEach(r => s[r.key] = r.value || '');
  res.render('admin/settings', { title: 'Settings', csrfToken: req.csrfToken(), s });
});

router.post('/settings', ensureAdmin, async (req, res) => {
  const allowed = ['SITE_NAME', 'THEME', 'WORKER_BASE', 'TERABOX_COOKIE', 'ADSENSE_SNIPPET', 'ADSTERRA_SNIPPET'];
  for (const k of allowed) {
    await Setting.upsert({ key: k, value: String(req.body[k] ?? '') });
  }
  res.redirect('/admin/settings');
});

// change password (AJAX)
router.post('/change-password', ensureAdmin, async (req, res) => {
  try {
    const { current, newpass } = req.body;
    const u = await User.findByPk(req.session.user.id);
    if (!u || !u.checkPassword(current)) return res.json({ error: 'Password sekarang salah' });
    if (!newpass || newpass.length < 6) return res.json({ error: 'Password baru minimal 6 karakter' });
    u.password_hash = bcrypt.hashSync(newpass, 10); await u.save();
    res.json({ ok: true });
  } catch (e) {
    res.json({ error: e.message || 'Error' });
  }
});

// cache manager
router.get('/cache', ensureAdmin, (req, res) => {
  const list = listCache();
  res.render('admin/cache', { title: 'Cache Manager', csrfToken: req.csrfToken(), list });
});

router.post('/cache/delete/:fs_id', ensureAdmin, (req, res) => {
  const ok = deleteCache(req.params.fs_id);
  res.json({ ok });
});

module.exports = router;
