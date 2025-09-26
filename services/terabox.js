const axios = require('axios');
const { URLSearchParams } = require('url');

function normalizeCookie(cookie) {
  if (!cookie) return '';
  if (typeof cookie === 'string') return cookie;
  if (typeof cookie === 'object') {
    return Object.entries(cookie).map(([k, v]) => `${k}=${v}`).join('; ');
  }
  return '';
}

async function getShortFromUrl(url) {
  try {
    const r = await axios.get(url, { maxRedirects: 5, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const final = r.request?.res?.responseUrl || r.config.url || url;
    const m = /surl=([^&]+)/.exec(final);
    if (m) return m[1];
    const q = /surl=([^&]+)/.exec(url);
    return q ? q[1] : null;
  } catch {
    const mm = /surl=([^&]+)/.exec(url);
    return mm ? mm[1] : null;
  }
}

async function getShorturlInfo(shorturl, cookieStr = '') {
  const url = `https://www.terabox.com/api/shorturlinfo?app_id=250528&shorturl=1${shorturl}&root=1`;
  const resp = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': normalizeCookie(cookieStr) } });
  return resp.data;
}

async function getShareList(shorturl, dir = '', root = '0', cookieStr = '') {
  const params = new URLSearchParams({ app_id: '250528', shorturl, root, dir });
  const url = `https://www.terabox.com/share/list?${params.toString()}`;
  const resp = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': normalizeCookie(cookieStr) } });
  return resp.data;
}

async function getSignFromWorker(shorturl, workerBase) {
  const base = workerBase.replace(/\/+$/, '');
  const url = `${base}/api/get-info?shorturl=${shorturl}&pwd=`;
  const resp = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': base } });
  return resp.data; // { ok, sign, timestamp }
}

async function getDownloadFromWorker(payload = {}, workerBase) {
  const base = workerBase.replace(/\/+$/, '');
  const url = `${base}/api/get-download`;
  const resp = await axios.post(url, payload, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': base } });
  return resp.data; // { downloadLink }
}

async function getDownloadpFromWorker(payload = {}, workerBase) {
  const base = workerBase.replace(/\/+$/, '');
  const url = `${base}/api/get-downloadp`;
  const resp = await axios.post(url, payload, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': base } });
  return resp.data; // { downloadLink }
}

function checkFileType(filename = '') {
  const n = (filename || '').toLowerCase();
  if (n.match(/\.(mp4|mov|m4v|mkv|asf|avi|wmv|m2ts|3g2)$/)) return 'video';
  if (n.match(/\.(jpe?g|png|gif|webp|svg)$/)) return 'image';
  if (n.match(/\.(pdf|docx|zip|rar|7z)$/)) return 'file';
  return 'other';
}

async function packList(reqList = [], shorturl = '', cookieStr = '') {
  const out = [];
  for (const item of reqList) {
    const isDir = !!item.isdir;
    const node = {
      is_dir: item.isdir,
      path: item.path,
      fs_id: item.fs_id,
      name: item.server_filename,
      type: !isDir ? checkFileType(item.server_filename) : 'other',
      size: !isDir ? item.size : '',
      image: !isDir ? (item.thumbs?.url3 || '') : '',
      list: []
    };
    if (isDir) {
      try {
        const child = await getShareList(shorturl, item.path, '0', cookieStr);
        node.list = await packList(child.list || [], shorturl, cookieStr);
      } catch {
        node.list = [];
      }
    }
    out.push(node);
  }
  return out;
}

module.exports = {
  normalizeCookie,
  getShortFromUrl,
  getShorturlInfo,
  getShareList,
  getSignFromWorker,
  getDownloadFromWorker,
  getDownloadpFromWorker,
  packList
};
