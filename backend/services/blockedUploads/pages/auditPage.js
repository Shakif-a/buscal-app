const { escapeHtml, readableTime, page } = require("./layout");
const { chip } = require("./status");

function renderAuditRow(row) {
  const decidedBy =
    row.decidedByName && row.status !== "blocked"
      ? `<br><span class="muted">by ${escapeHtml(row.decidedByName)}</span>`
      : "";

  return `<tr>
<td>${escapeHtml(readableTime(row.createdAt))}</td>
<td><a href="${escapeHtml(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.filename)}</a></td>
<td>${escapeHtml(row.senderName)}<br><span class="muted">${escapeHtml(row.senderEmail)}</span></td>
<td>${escapeHtml(row.threat)}</td>
<td>${chip(row)}${decidedBy}</td>
<td>${escapeHtml(row.attempts || 1)}</td>
</tr>`;
}

function renderAuditPage(view) {
  const filters = view.filters
    .map(
      (item) =>
        `<a href="${escapeHtml(item.url)}"${item.active ? ' class="active"' : ""}>${escapeHtml(item.label)} (${escapeHtml(item.count)})</a>`,
    )
    .join("");

  const table =
    view.rows.length === 0
      ? '<p class="muted">No blocked uploads match.</p>'
      : `<div class="table-box"><table><thead><tr><th>Received</th><th>File</th><th>Sender</th><th>Reason</th><th>Outcome</th><th>Attempts</th></tr></thead><tbody>${view.rows.map(renderAuditRow).join("")}</tbody></table></div>`;

  const previous = view.previousUrl
    ? `<a href="${escapeHtml(view.previousUrl)}">Newer</a>`
    : "<span></span>";
  const next = view.nextUrl
    ? `<a href="${escapeHtml(view.nextUrl)}">Older</a>`
    : "<span></span>";

  return page(
    "Blocked uploads",
    `<p class="eyebrow">Security audit</p>
<h1>Blocked uploads</h1>
<div class="filters">${filters}</div>
<form class="search" method="get">
<input type="hidden" name="token" value="${escapeHtml(view.token)}">
<input type="hidden" name="status" value="${escapeHtml(view.status)}">
<input type="search" name="q" value="${escapeHtml(view.query)}" placeholder="Search by file, sender or reason" maxlength="80">
<button type="submit">Search</button>
</form>
<section class="card">${table}
<div class="pager">${previous}<span>Page ${escapeHtml(view.pageNumber)} of ${escapeHtml(view.pageCount)}</span>${next}</div></section>
<p class="foot">Reports are kept for 14 days, or 90 days once a manager has decided. You only see uploads you are allowed to review.</p>`,
    "wide",
  );
}

module.exports = { renderAuditPage };
