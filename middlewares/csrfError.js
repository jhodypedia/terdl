module.exports = (err, req, res, next) => {
  if (err.code !== 'EBADCSRFTOKEN') return next(err);
  return res.status(403).send('Invalid CSRF token');
};
