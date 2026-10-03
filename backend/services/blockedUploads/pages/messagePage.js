const { escapeHtml, page } = require("./layout");

function renderMessagePage(title, message) {
  return page(
    title,
    `<h1>${escapeHtml(title)}</h1><p class="muted">${escapeHtml(message)}</p>`,
    "message",
  );
}

module.exports = { renderMessagePage };
