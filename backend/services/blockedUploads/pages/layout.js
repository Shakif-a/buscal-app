function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

function readableSize(bytes) {
  if (bytes < 1024) {
    return bytes + " bytes";
  }

  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + " KB";
  }

  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function readableTime(value) {
  return new Date(value).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

const styles = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #f4f6fb; color: #1c2038; font-family: Segoe UI, Helvetica, Arial, sans-serif; line-height: 1.55; }
  main { max-width: 860px; margin: 0 auto; padding: 40px 20px 64px; }
  .eyebrow { margin: 0 0 6px; font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #5b617a; }
  h1 { margin: 0 0 18px; font-size: 28px; word-break: break-word; }
  h2 { margin: 0 0 12px; font-size: 17px; }
  .banner { background: #fdecea; border: 1px solid #f2b8b5; color: #8a1f17; border-radius: 12px; padding: 16px 18px; margin-bottom: 20px; }
  .banner strong { display: block; margin-bottom: 4px; }
  .banner.ok { background: #e8f6ec; border-color: #b6dfc1; color: #17602b; }
  .banner.wait { background: #fff6e0; border-color: #f0d58a; color: #7a5200; }
  .card { background: #fff; border: 1px solid #e3e7f1; border-radius: 14px; padding: 20px 22px; margin-bottom: 16px; }
  dl { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px 24px; }
  dt { font-size: 12px; color: #5b617a; text-transform: uppercase; letter-spacing: .04em; }
  dd { margin: 2px 0 0; word-break: break-word; }
  .warn { color: #8a1f17; font-weight: 600; }
  .muted { color: #5b617a; font-size: 14px; margin: 8px 0 0; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e3e7f1; overflow-wrap: break-word; vertical-align: top; }
  th { white-space: nowrap; }
  .table-box { overflow-x: auto; }
  .table-box table { min-width: 560px; }
  tr.flag td { background: #fdecea; color: #8a1f17; }
  pre { margin: 0; font-family: Consolas, Menlo, monospace; font-size: 13px; white-space: pre-wrap; word-break: break-word; }
  .box { background: #f4f6fb; border-radius: 10px; padding: 14px; overflow: auto; }
  .hex { white-space: pre; overflow: auto; }
  ul { margin: 0; padding-left: 20px; }
  li { margin: 4px 0; }
  .check { display: flex; gap: 10px; align-items: flex-start; margin: 14px 0; }
  .check input { margin-top: 5px; }
  .actions { display: flex; gap: 12px; flex-wrap: wrap; }
  button { font: inherit; font-weight: 600; border-radius: 10px; padding: 10px 20px; border: 1px solid transparent; cursor: pointer; }
  .approve { background: #17602b; color: #fff; }
  .decline { background: #fff; color: #8a1f17; border-color: #f2b8b5; }
  .foot { color: #5b617a; font-size: 13px; margin-top: 20px; }
  .message { max-width: 520px; margin: 15vh auto; padding: 28px; background: #fff; border: 1px solid #e3e7f1; border-radius: 14px; }
  .message h1 { font-size: 22px; margin: 0 0 8px; }
  .message p { margin: 0; }
  .advice { margin: 10px 0 0; padding: 12px 14px; background: #fff6e0; border-radius: 10px; color: #5c3f00; }
  .wide { max-width: 1100px; }
  .chip { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; background: #eceef5; color: #3b4160; }
  .chip.wait { background: #fff1c9; color: #7a5200; }
  .chip.final { background: #fdecea; color: #8a1f17; }
  .chip.ok { background: #e1f3e6; color: #17602b; }
  .filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .filters a { text-decoration: none; padding: 6px 14px; border-radius: 999px; border: 1px solid #d5daea; background: #fff; color: #1c2038; font-size: 14px; }
  .filters a.active { background: #1c2038; border-color: #1c2038; color: #fff; }
  .search { display: flex; gap: 8px; margin-bottom: 16px; }
  .search input[type=search] { flex: 1; font: inherit; padding: 9px 12px; border: 1px solid #d5daea; border-radius: 10px; }
  .search button { background: #1c2038; color: #fff; }
  .pager { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; font-size: 14px; color: #5b617a; }
  .pager a { color: #1b4fd6; }
  td a { color: #1b4fd6; font-weight: 600; text-decoration: none; }
`;

function page(title, body, mainClass = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${escapeHtml(title)}</title>
<style>${styles}</style></head><body><main class="${mainClass}">${body}</main></body></html>`;
}

function card(title, content) {
  return `<section class="card"><h2>${title}</h2>${content}</section>`;
}

function field(label, value, className = "") {
  const attribute = className ? ` class="${className}"` : "";
  return `<div><dt>${escapeHtml(label)}</dt><dd${attribute}>${escapeHtml(value)}</dd></div>`;
}

function fields(list) {
  return `<dl>${list.join("")}</dl>`;
}

module.exports = {
  escapeHtml,
  readableSize,
  readableTime,
  page,
  card,
  field,
  fields,
};
