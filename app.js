const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');
const expressLayouts = require('express-ejs-layouts');
const csrf = require('csurf');
const csrfError = require('./middlewares/csrfError');
const cron = require('node-cron');

dotenv.config();

const { sequelize, Setting } = require('./models');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const { cleanCache } = require('./services/cache');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout'); // default layout untuk semua EJS

const store = new SequelizeStore({ db: sequelize });
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false,
  store,
  cookie: { httpOnly: true, sameSite: 'lax' }
}));
store.sync();

// inject settings ke res.locals
app.use(async (req, res, next) => {
  try {
    const rows = await Setting.findAll();
    const s = {};
    rows.forEach(r => s[r.key] = r.value || '');
    s.TERABOX_COOKIE = s.TERABOX_COOKIE || '';
    s.WORKER_BASE = s.WORKER_BASE || 'https://terabox.hnn.workers.dev';
    s.SITE_NAME = s.SITE_NAME || 'TeraBox Streaming';
    s.THEME = s.THEME || 'auto';
    res.locals.settings = s;
    res.locals.user = req.session.user || null;
    next();
  } catch (e) { next(e); }
});

const csrfProtection = csrf();

// Halaman publik
app.get('/', (req, res) => res.render('home', { title: res.locals.settings.SITE_NAME }));
app.get('/player', (req, res) => res.render('player', { title: 'Player' }));

// Routes
app.use('/admin', csrfProtection, adminRoutes);
app.use('/api', apiRoutes);
app.use(csrfError);

// Scheduler: bersihkan cache tiap jam
cron.schedule('0 * * * *', () => {
  cleanCache();
  console.log('[CRON] Cache cleaned');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on http://localhost:' + PORT));
