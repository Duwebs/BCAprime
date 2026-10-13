// ============================================================
// BCAPrime — api/_lib/cors.js
// Tiny CORS helper for Vercel serverless functions so the
// static site (on another origin/domain) can call them.
// ============================================================
'use strict';

function applyCors(res, methods = 'POST, GET, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-client-info');
  res.setHeader('Access-Control-Allow-Methods', methods);
}

function send(res, status, payload) {
  res.statusCode = status;
  // charset=utf-8: accented/special characters (usernames, titles) kabhi
  // mojibake na banein — client hamesha UTF-8 maane.
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// Shared handler wrapper: answers the OPTIONS pre-flight, then runs the real handler.
function withCors(handler) {
  return async (req, res) => {
    applyCors(res);
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    try {
      await handler(req, res);
    } catch (error) {
      console.error('[BCAPrime api]', error && error.stack ? error.stack : error);
      send(res, 500, { error: 'Internal server error', detail: String(error && error.message ? error.message : error) });
    }
  };
}

module.exports = { applyCors, send, withCors };