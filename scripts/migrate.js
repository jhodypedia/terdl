const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config();

const { sequelize, User, Setting } = require('../models');

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });

    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const pass = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = bcrypt.hashSync(pass, 10);
    await User.findOrCreate({ where: { email }, defaults: { password_hash: hash } });

    const defaults = [
      { key: 'TERABOX_COOKIE', value: process.env.DEFAULT_TB_COOKIE || '' },
      { key: 'WORKER_BASE', value: process.env.DEFAULT_WORKER_BASE || 'https://terabox.hnn.workers.dev' },
      { key: 'ADSENSE_SNIPPET', value: '' },
      { key: 'ADSTERRA_SNIPPET', value: '' },
      { key: 'SITE_NAME', value: 'TeraBox Streaming' },
      { key: 'THEME', value: 'auto' } // auto | light | dark
    ];
    for (const s of defaults) {
      await Setting.findOrCreate({ where: { key: s.key }, defaults: { value: s.value } });
    }

    console.log('Migration done on MySQL.');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
