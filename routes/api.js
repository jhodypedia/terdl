const express = require('express');
const axios = require('axios');
const router = express.Router();
const terabox = require('../services/terabox');
const { getOrDownload } = require('../services/cache');
const fs = require('fs');
const path = require('path');

// helper settings
function cfg(res) {
  const s = res.locals.settings || {};
  return {
    cookie: s.TERABOX_COOKIE || '',
    worker: (s.WORKER_BASE || 'https://terabox.hnn.workers.dev').replace(/\/+$/, '')
  };
}

// LIST
router.get('/list', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ ok: false, message: 'url param required' });

    const { cookie, worker } = cfg(res);
    const short = await terabox.getShortFromUrl(url);
    if (!short) return res.status(400).json({ ok: false, message: 'cannot resolve shorturl' });

    const info = await terabox.getShorturlInfo(short, cookie);
    const packed = await terabox.packList(info.list || [], short, cookie);

    let signres = { ok: false };
    try { signres = await terabox.getSignFromWorker(short, worker); } catch {}

    res.json({
      ok: true,
      short,
      shareid: info.shareid || null,
      uk: info.uk || null,
      sign: signres.sign || null,
      timestamp: signres.timestamp || null,
      list: packed
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// DOWNLOAD INFO (opsional untuk client yg ingin direct)
router.post('/download-info', async (req, res) => {
  try {
    const { shareid, uk, fs_id, sign, timestamp } = req.body;
    if (!shareid || !uk || !fs_id || !sign || !timestamp) {
      return res.status(400).json({ ok: false, message: 'missing params' });
    }
    const { worker } = cfg(res);
    const payload = { shareid: String(shareid), uk: String(uk), sign: String(sign), timestamp: String(timestamp), fs_id: String(fs_id) };

    let url1 = null, url2 = null;
    try { const d1 = await terabox.getDownloadFromWorker(payload, worker); url1 = d1.downloadLink || null; } catch {}
    try { const d2 = await terabox.getDownloadpFromWorker(payload, worker); url2 = d2.downloadLink || null; } catch {}

    if (!url1 && !url2) return res.status(502).json({ ok: false, message: 'no link' });
    res.json({ ok: true, downloadLink: { url_1: url1, url_2: url2 } });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// PROXY STREAM (gunakan cache lokal + Range)
router.get('/proxy/stream', async (req, res) => {
  try {
    const { shareid, uk, fs_id, sign, timestamp } = req.query;
    if (!shareid || !uk || !fs_id || !sign || !timestamp) {
      return res.status(400).send('missing params');
    }
    const { worker } = cfg(res);
    const payload = { shareid: String(shareid), uk: String(uk), sign: String(sign), timestamp: String(timestamp), fs_id: String(fs_id) };

    // dapatkan direct URL sekali, lalu download ke cache jika belum ada
    let direct = null;
    try { const d1 = await terabox.getDownloadFromWorker(payload, worker); direct = d1.downloadLink; } catch {}
    if (!direct) {
      try { const d2 = await terabox.getDownloadpFromWorker(payload, worker); direct = d2.downloadLink; } catch {}
    }
    if (!direct) return res.status(502).send('failed to get download url');

    const localFile = await getOrDownload(fs_id, direct);

    // STREAM dari lokal (Range)
    const stat = fs.statSync(localFile);
    const fileSize = stat.size;
    const range = req.headers.range;
    const contentType = 'video/mp4';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunk = end - start + 1;

      const file = fs.createReadStream(localFile, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunk,
        'Content-Type': contentType
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });
      fs.createReadStream(localFile).pipe(res);
    }
  } catch (e) {
    console.error(e);
    res.status(500).send('internal error');
  }
});

module.exports = router;
