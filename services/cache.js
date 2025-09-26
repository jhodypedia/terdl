const fs = require('fs');
const path = require('path');
const axios = require('axios');

const CACHE_DIR = process.env.CACHE_DIR || './cache';
const TTL = parseInt(process.env.CACHE_TTL_HOURS || '6', 10) * 3600 * 1000;

// ensure dir
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

function filePathFor(fs_id) {
  return path.join(CACHE_DIR, `${fs_id}.mp4`);
}

function existsFresh(filePath) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const stat = fs.statSync(filePath);
    return (Date.now() - stat.mtimeMs) <= TTL;
  } catch {
    return false;
  }
}

async function downloadToFile(url, filePath) {
  const tmp = `${filePath}.part`;
  const writer = fs.createWriteStream(tmp);
  const resp = await axios.get(url, { responseType: 'stream', maxRedirects: 5 });
  resp.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
  fs.renameSync(tmp, filePath);
  return filePath;
}

async function getOrDownload(fs_id, url) {
  const file = filePathFor(fs_id);
  if (existsFresh(file)) return file;
  return await downloadToFile(url, file);
}

function cleanCache() {
  try {
    const files = fs.readdirSync(CACHE_DIR);
    files.forEach(f => {
      const full = path.join(CACHE_DIR, f);
      try {
        const stat = fs.statSync(full);
        if ((Date.now() - stat.mtimeMs) > TTL) fs.unlinkSync(full);
      } catch {}
    });
  } catch {}
}

function listCache() {
  const rows = [];
  try {
    const files = fs.readdirSync(CACHE_DIR);
    for (const f of files) {
      const full = path.join(CACHE_DIR, f);
      const stat = fs.statSync(full);
      rows.push({
        name: f,
        fs_id: f.replace(/\.mp4$/i, ''),
        size: stat.size,
        mtime: stat.mtime,
        expired: (Date.now() - stat.mtimeMs) > TTL
      });
    }
  } catch {}
  return rows;
}

function deleteCache(fs_id) {
  const file = filePathFor(fs_id);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    return true;
  }
  return false;
}

module.exports = { getOrDownload, cleanCache, listCache, deleteCache, filePathFor, existsFresh };
