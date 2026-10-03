const { renderMessagePage } = require("./pages");

function sendPage(res, status, html) {
  res.set({
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex",
  });
  res.status(status).send(html);
}

function sendMessage(res, status, title, message) {
  sendPage(res, status, renderMessagePage(title, message));
}

function refuse(res) {
  sendMessage(
    res,
    403,
    "This link can't be used",
    "It may have expired, or it was not meant for you. Ask for a new alert if you still need to see the report.",
  );
}

function notFound(res) {
  sendMessage(
    res,
    404,
    "Report not found",
    "Reports are deleted after 14 days, or this one no longer exists.",
  );
}

module.exports = { sendPage, sendMessage, refuse, notFound };
