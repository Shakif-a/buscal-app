const { escapeHtml, readableSize } = require("./layout");

function renderArchive(preview) {
  const rows = (preview.entries || [])
    .map(
      (entry) =>
        `<tr class="${entry.flagged ? "flag" : ""}"><td>${escapeHtml(entry.name)}</td><td>${escapeHtml(readableSize(entry.size))}</td><td>${escapeHtml(entry.reason || "")}</td></tr>`,
    )
    .join("");
  const problem = preview.problem
    ? `<p class="muted">${escapeHtml(preview.problem)}</p>`
    : "";
  const more = preview.truncated
    ? `<p class="muted">Showing the first ${escapeHtml((preview.entries || []).length)} of ${escapeHtml(preview.total)} files.</p>`
    : "";

  return `${problem}<div class="table-box"><table><thead><tr><th>File inside</th><th>Size</th><th>Concern</th></tr></thead><tbody>${rows}</tbody></table></div>${more}`;
}

const noPreview = '<p class="muted">There is no preview for this type of file.</p>';

function renderPreview(preview) {
  if (!preview) {
    return noPreview;
  }

  if (preview.kind === "archive") {
    return renderArchive(preview);
  }

  if (preview.kind === "text") {
    const more = preview.truncated
      ? '<p class="muted">Only the first part of the file is shown.</p>'
      : "";
    return `<pre class="box">${escapeHtml(preview.text)}</pre>${more}`;
  }

  if (preview.kind === "indicators") {
    if (!preview.items || preview.items.length === 0) {
      return '<p class="muted">No further details were found for this file.</p>';
    }

    const items = preview.items
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  }

  return noPreview;
}

module.exports = { renderPreview };
