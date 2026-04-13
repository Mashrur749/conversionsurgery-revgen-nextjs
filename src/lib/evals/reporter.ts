import type { CategoryResult } from './types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateEvalReport(
  categories: CategoryResult[],
  durationMs: number,
  costEstimate: number,
): string {
  const totalPassed = categories.reduce((s, c) => s + c.passed, 0);
  const totalAll = categories.reduce((s, c) => s + c.total, 0);
  const overallRate = totalAll > 0 ? totalPassed / totalAll : 0;
  const overallPct = (overallRate * 100).toFixed(1);
  const overallPass = overallRate >= 0.85;

  const categorySections = categories
    .map((cat) => {
      const pct = cat.total > 0 ? (cat.rate * 100).toFixed(1) : '0.0';
      const isPass = cat.rate >= 0.85;
      const barColor = isPass ? '#3D7A50' : '#C15B2E';
      const barWidth = cat.total > 0 ? Math.round(cat.rate * 100) : 0;

      const failedResults = cat.results.filter((r) => !r.passed);
      const failedHTML = failedResults.length > 0
        ? `<div class="failed-assertions">
            <div class="failed-header">Failed assertions (${failedResults.length})</div>
            ${failedResults
              .map(
                (r) => `
              <div class="failed-item">
                <div class="failed-meta">
                  <span class="test-id">${escapeHtml(r.testId)}</span>
                  <span class="test-desc">${escapeHtml(r.description)}</span>
                </div>
                ${r.error ? `<div class="error-msg">${escapeHtml(r.error)}</div>` : ''}
                ${
                  r.response
                    ? `<div class="response-excerpt">&ldquo;${escapeHtml(r.response.slice(0, 200))}${r.response.length > 200 ? '&hellip;' : ''}&rdquo;</div>`
                    : ''
                }
              </div>`,
              )
              .join('')}
          </div>`
        : '';

      return `
        <div class="category ${isPass ? 'cat-pass' : 'cat-fail'}">
          <div class="cat-header">
            <span class="cat-name">${escapeHtml(cat.name)}</span>
            <span class="cat-counts">${cat.passed} / ${cat.total} passed</span>
            <span class="cat-badge ${isPass ? 'badge-pass' : 'badge-fail'}">${pct}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${barWidth}%; background: ${barColor};"></div>
          </div>
          ${failedHTML}
        </div>`;
    })
    .join('');

  const durationSec = (durationMs / 1000).toFixed(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ConversionSurgery Eval Report &mdash; ${new Date().toISOString().split('T')[0]}</title>
  <style>
    :root {
      --forest: #1B2F26;
      --terracotta: #D4754A;
      --olive: #6B7E54;
      --sienna: #C15B2E;
      --sage-light: #C8D4CC;
      --moss-light: #E3E9E1;
      --pass-bg: #E8F5E9;
      --pass-fg: #3D7A50;
      --fail-bg: #FDEAE4;
      --fail-fg: #C15B2E;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #E3E9E1;
      color: #1a1a1a;
      line-height: 1.5;
    }
    .header {
      background: var(--forest);
      color: white;
      padding: 2rem 2.5rem;
    }
    .header h1 { font-size: 1.4rem; font-weight: 700; margin-bottom: 1rem; letter-spacing: -0.01em; }
    .header-meta { display: flex; flex-wrap: wrap; gap: 2rem; align-items: flex-end; }
    .overall-badge {
      display: inline-block;
      padding: 0.35rem 1rem;
      border-radius: 6px;
      font-weight: 700;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
    }
    .overall-badge.pass { background: var(--pass-bg); color: var(--pass-fg); }
    .overall-badge.fail { background: var(--fail-bg); color: var(--fail-fg); }
    .meta-stats { display: flex; gap: 1.5rem; flex-wrap: wrap; }
    .meta-stat { font-size: 0.85rem; opacity: 0.85; }
    .meta-stat strong { font-weight: 600; }
    .container { max-width: 860px; margin: 0 auto; padding: 2rem 1.5rem; }
    .section-title { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin-bottom: 1rem; }
    .category {
      background: white;
      border-radius: 8px;
      margin-bottom: 1rem;
      overflow: hidden;
      border: 1px solid #ddd;
    }
    .category.cat-fail { border-color: var(--sienna); }
    .cat-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.9rem 1.25rem;
    }
    .cat-name { font-size: 1rem; font-weight: 600; flex: 1; text-transform: capitalize; }
    .cat-counts { font-size: 0.8rem; color: #777; }
    .cat-badge {
      display: inline-block;
      padding: 0.15rem 0.6rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 700;
    }
    .badge-pass { background: var(--pass-bg); color: var(--pass-fg); }
    .badge-fail { background: var(--fail-bg); color: var(--fail-fg); }
    .progress-track {
      height: 6px;
      background: #f0f0f0;
      margin: 0 1.25rem 1rem;
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-fill { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
    .failed-assertions {
      border-top: 1px solid #f0f0f0;
      padding: 0.75rem 1.25rem 1rem;
      background: #fafafa;
    }
    .failed-header {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--sienna);
      margin-bottom: 0.75rem;
    }
    .failed-item {
      padding: 0.6rem 0.75rem;
      background: var(--fail-bg);
      border-radius: 6px;
      margin-bottom: 0.5rem;
      border-left: 3px solid var(--sienna);
    }
    .failed-item:last-child { margin-bottom: 0; }
    .failed-meta { display: flex; gap: 0.75rem; align-items: baseline; margin-bottom: 0.3rem; flex-wrap: wrap; }
    .test-id {
      font-size: 0.75rem;
      font-weight: 700;
      font-family: 'JetBrains Mono', 'Fira Mono', monospace;
      color: var(--forest);
      background: var(--moss-light);
      padding: 0.1rem 0.4rem;
      border-radius: 3px;
    }
    .test-desc { font-size: 0.82rem; color: #444; }
    .error-msg {
      font-size: 0.8rem;
      color: var(--sienna);
      font-weight: 500;
      margin-bottom: 0.25rem;
    }
    .response-excerpt {
      font-size: 0.78rem;
      color: #666;
      font-style: italic;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .no-failures {
      text-align: center;
      padding: 3rem 0;
      color: var(--pass-fg);
      font-weight: 600;
      font-size: 1rem;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>ConversionSurgery &mdash; Eval Suite Report</h1>
    <div class="header-meta">
      <span class="overall-badge ${overallPass ? 'pass' : 'fail'}">${overallPct}% overall</span>
      <div class="meta-stats">
        <div class="meta-stat"><strong>${totalPassed} / ${totalAll}</strong> assertions passed</div>
        <div class="meta-stat"><strong>~$${costEstimate.toFixed(2)}</strong> estimated cost</div>
        <div class="meta-stat"><strong>${durationSec}s</strong> duration</div>
        <div class="meta-stat">Generated ${new Date().toLocaleString()}</div>
      </div>
    </div>
  </div>
  <div class="container">
    <div class="section-title">Categories (${categories.length})</div>
    ${categories.length > 0
      ? categorySections
      : '<div class="no-failures">No categories found.</div>'}
  </div>
</body>
</html>`;
}
