// Indexing is a discovery preference, never an authorization mechanism.
function searchPolicy(path) {
  return path === '/' || path === '/terms' || path === '/terms/'
    ? 'index, follow'
    : 'noindex, nofollow, nosnippet';
}
function searchVisibility(req, res, next) {
  res.set('X-Robots-Tag', searchPolicy(req.path));
  if (/^\/(?:\.env(?:[./]|$)|\.git(?:\/|$)|backend(?:\/|$)|src(?:\/|$)|node_modules(?:\/|$))/.test(req.path) || /\.map$/i.test(req.path)) return res.status(404).end();
  next();
}
module.exports = { searchPolicy, searchVisibility };
