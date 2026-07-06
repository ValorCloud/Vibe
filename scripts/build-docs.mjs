#!/usr/bin/env node
/**
 * Build the documentation site published on GitHub Pages.
 *
 * Converts every Markdown file under docs/ into a static HTML page
 * (preserving the folder structure), copies non-Markdown assets as-is,
 * and injects the Microsoft Clarity tracking snippet when the
 * CLARITY_PROJECT_ID environment variable is set.
 *
 * Usage: node scripts/build-docs.mjs [outputDir]   (default: dist/docs)
 */
import { marked } from 'marked';
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const OUT_DIR = path.resolve(ROOT, process.argv[2] ?? 'dist/docs');
const CLARITY_PROJECT_ID = (process.env.CLARITY_PROJECT_ID ?? '').trim();

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const claritySnippet = () => {
  if (!CLARITY_PROJECT_ID) return '';
  if (!/^[a-z0-9]+$/i.test(CLARITY_PROJECT_ID)) {
    throw new Error('[build-docs] CLARITY_PROJECT_ID must be alphanumeric.');
  }
  return `
    <!-- Microsoft Clarity -->
    <script type="text/javascript">
      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
    </script>`;
};

const pageTemplate = (title, body, depth) => {
  const home = `${'../'.repeat(depth)}index.html`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)} — VIBE Docs</title>
    <meta name="description" content="VIBE documentation — ${escapeHtml(title)}" />
    <style>
      :root { color-scheme: dark; }
      body { margin: 0 auto; max-width: 60rem; padding: 2rem 1.25rem 4rem;
        background: #0a0a1a; color: #e8e8f0;
        font-family: "Segoe UI", system-ui, -apple-system, sans-serif; line-height: 1.6; }
      a { color: #ff9c00; }
      h1, h2, h3 { color: #ffcc66; line-height: 1.25; }
      code { background: #1a1a30; border-radius: 4px; padding: 0.1em 0.35em; }
      pre { background: #1a1a30; border-radius: 8px; padding: 1rem; overflow-x: auto; }
      pre code { background: transparent; padding: 0; }
      img { max-width: 100%; }
      table { border-collapse: collapse; }
      th, td { border: 1px solid #33335a; padding: 0.35rem 0.6rem; }
      nav.docs-nav { border-bottom: 1px solid #33335a; margin-bottom: 2rem; padding-bottom: 0.75rem; }
    </style>${claritySnippet()}
  </head>
  <body>
    <nav class="docs-nav"><a href="${home}">VIBE Documentation</a></nav>
    <main>${body}</main>
  </body>
</html>
`;
};

/** Rewrite relative .md links to their generated .html counterparts. */
const rewriteMarkdownLinks = (html) =>
  html.replace(/href="([^"]+)\.md(#[^"]*)?"/gi, (match, href, anchor = '') =>
    /^[a-z][a-z0-9+.-]*:/i.test(href) ? match : `href="${href}.html${anchor}"`,
  );

const titleFromMarkdown = (markdown, fallback) =>
  markdown.match(/^#\s+(.+)$/m)?.[1].trim() ?? fallback;

async function collectMarkdownFiles(dir, base = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relPath = path.join(base, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(path.join(dir, entry.name), relPath)));
    } else if (entry.name.toLowerCase().endsWith('.md')) {
      files.push(relPath);
    }
  }
  return files.sort();
}

const markdownFiles = await collectMarkdownFiles(DOCS_DIR);

// Copy every asset (images, etc.) so relative references keep working.
await mkdir(OUT_DIR, { recursive: true });
await cp(DOCS_DIR, OUT_DIR, {
  recursive: true,
  filter: (src) => !src.toLowerCase().endsWith('.md'),
});

const pages = [];
for (const relPath of markdownFiles) {
  const markdown = await readFile(path.join(DOCS_DIR, relPath), 'utf8');
  const title = titleFromMarkdown(markdown, path.basename(relPath, '.md'));
  const depth = relPath.split(path.sep).length - 1;
  const html = rewriteMarkdownLinks(await marked.parse(markdown));
  const outRelPath = relPath.replace(/\.md$/i, '.html');
  const outPath = path.join(OUT_DIR, outRelPath);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, pageTemplate(title, html, depth));
  pages.push({ title, href: outRelPath.split(path.sep).join('/') });
}

// Index page listing every generated document.
const indexList = pages
  .map(({ title, href }) => `      <li><a href="${href}">${escapeHtml(title)}</a></li>`)
  .join('\n');
await writeFile(
  path.join(OUT_DIR, 'index.html'),
  pageTemplate('Documentation', `<h1>VIBE Documentation</h1>\n    <ul>\n${indexList}\n    </ul>`, 0),
);

console.log(
  `[build-docs] Generated ${pages.length} pages in ${path.relative(ROOT, OUT_DIR)}` +
    (CLARITY_PROJECT_ID ? ' (Microsoft Clarity enabled)' : ' (Microsoft Clarity disabled: CLARITY_PROJECT_ID not set)'),
);
