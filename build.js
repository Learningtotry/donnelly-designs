const fs = require('fs');
const path = require('path');

const PROJECTS_DIR = path.join(__dirname, 'projects');
const PROJECTS_HTML_PATH = path.join(__dirname, 'projects.html');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const HEADER_TEMPLATE_PATH = path.join(TEMPLATES_DIR, 'header.html');
const FOOTER_TEMPLATE_PATH = path.join(TEMPLATES_DIR, 'footer.html');
const DEFAULT_IMAGE = 'images/project_thumbnail.png';

// Fallback formatting for titles based on filename
function formatFilenameToTitle(filename) {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  return nameWithoutExt
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function cleanHtml(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseProjectFile(filename) {
  const filePath = path.join(PROJECTS_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf8');

  // 1. Extract Title
  let title = '';
  const bodyH1Match = content.match(/<div class="article-body">[\s\S]*?<h1>([\s\S]*?)<\/h1>/);
  if (bodyH1Match) {
    title = cleanHtml(bodyH1Match[1]);
  }

  if (!title) {
    const detailTitleMatch = content.match(/<h1 class="article-detail-title">([\s\S]*?)<\/h1>/);
    if (detailTitleMatch) {
      const matchText = cleanHtml(detailTitleMatch[1]);
      if (!matchText.toLowerCase().includes('example article title')) {
        title = matchText;
      }
    }
  }

  if (!title) {
    const headTitleMatch = content.match(/<title>([\s\S]*?)<\/title>/);
    if (headTitleMatch) {
      const matchText = cleanHtml(headTitleMatch[1]);
      if (!matchText.toLowerCase().includes('article title')) {
        title = matchText.replace(/\s*-\s*My Blog/i, '');
      }
    }
  }

  if (!title) {
    title = formatFilenameToTitle(filename);
  }

  // 2. Extract Featured Image
  let image = DEFAULT_IMAGE;
  const imageMatch = content.match(/class="article-featured-image"[\s\S]*?<img[^>]+src="([^"]+)"/);
  if (imageMatch) {
    let src = imageMatch[1];
    if (src.startsWith('../')) {
      src = src.substring(3);
    }
    image = src;
  }

  // 3. Extract Description / Excerpt
  let excerpt = '';
  const metaDescMatch = content.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i) ||
                        content.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i);
  if (metaDescMatch) {
    excerpt = cleanHtml(metaDescMatch[1]);
  }

  if (!excerpt) {
    const bodyParagraphsMatch = content.match(/<div class="article-body">([\s\S]*?)<\/div>/);
    if (bodyParagraphsMatch) {
      const bodyContent = bodyParagraphsMatch[1];
      const pMatches = bodyContent.matchAll(/<p>([\s\S]*?)<\/p>/g);
      for (const pMatch of pMatches) {
        const text = cleanHtml(pMatch[1]);
        if (text.length > 10) {
          excerpt = text;
          break;
        }
      }
    }
  }

  const maxChars = 250;
  if (excerpt.length > maxChars) {
    excerpt = excerpt.substring(0, maxChars).trim() + '...';
  } else if (!excerpt) {
    excerpt = 'No project description available.';
  }

  return {
    filename,
    title,
    image,
    excerpt
  };
}

function generateProjectCards() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`Error: projects directory not found at ${PROJECTS_DIR}`);
    return;
  }

  const files = fs.readdirSync(PROJECTS_DIR);
  const projectFiles = files.filter(file => {
    const fullPath = path.join(PROJECTS_DIR, file);
    const stat = fs.statSync(fullPath);
    return stat.isFile() && file !== 'README.md' && !file.startsWith('.');
  });

  console.log(`[Cards] Found ${projectFiles.length} project file(s).`);

  const projects = projectFiles.map(file => {
    try {
      return parseProjectFile(file);
    } catch (err) {
      console.error(`Error parsing project ${file}:`, err);
      return null;
    }
  }).filter(Boolean);

  const cardsHtml = projects.map((proj, idx) => {
    const isHidden = idx >= 3;
    const cardClass = isHidden ? 'article-card hidden' : 'article-card';
    return `      <!-- Project: ${proj.title} -->
      <article class="${cardClass}">
        <div class="article-image-container">
          <a href="projects/${proj.filename}">
            <img src="${proj.image}" alt="${proj.title}" class="article-image">
          </a>
        </div>
        <div class="article-text">
          <h2 class="article-title">
            <a href="projects/${proj.filename}">${proj.title}</a>
          </h2>
          <p class="article-excerpt">
            ${proj.excerpt}
          </p>
        </div>
      </article>`;
  }).join('\n\n');

  if (!fs.existsSync(PROJECTS_HTML_PATH)) {
    console.error(`Error: projects.html not found at ${PROJECTS_HTML_PATH}`);
    return;
  }

  let projectsHtml = fs.readFileSync(PROJECTS_HTML_PATH, 'utf8');
  const startComment = '<!-- PROJECTS_START -->';
  const endComment = '<!-- PROJECTS_END -->';
  const startIndex = projectsHtml.indexOf(startComment);
  const endIndex = projectsHtml.indexOf(endComment);

  if (startIndex === -1 || endIndex === -1) {
    console.error(`Error: Could not find placeholders ${startComment} and/or ${endComment} in projects.html`);
    return;
  }

  const updatedHtml = 
    projectsHtml.substring(0, startIndex + startComment.length) + 
    '\n' + cardsHtml + '\n      ' + 
    projectsHtml.substring(endIndex);

  fs.writeFileSync(PROJECTS_HTML_PATH, updatedHtml, 'utf8');
  console.log('[Cards] Successfully updated projects.html with dynamic cards!');
}

function getHtmlFiles(dir, filesList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const relativePath = path.relative(__dirname, fullPath);
    
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== '.git' && file !== 'templates' && file !== 'node_modules') {
        getHtmlFiles(fullPath, filesList);
      }
    } else if (file.endsWith('.html') && file !== 'article-template.html') {
      filesList.push(relativePath);
    }
  }
  return filesList;
}

function syncQuotes() {
  const quotesTxtPath = path.join(__dirname, 'quotes.txt');
  const quotesJsPath = path.join(__dirname, 'quotes.js');

  if (!fs.existsSync(quotesTxtPath) || !fs.existsSync(quotesJsPath)) {
    console.warn('[Quotes] quotes.txt or quotes.js not found, skipping quotes sync.');
    return;
  }

  const quotesContent = fs.readFileSync(quotesTxtPath, 'utf8');
  const quotes = quotesContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  let quotesJs = fs.readFileSync(quotesJsPath, 'utf8');
  
  const startComment = '// QUOTES_START';
  const endComment = '// QUOTES_END';
  
  const startIndex = quotesJs.indexOf(startComment);
  const endIndex = quotesJs.indexOf(endComment);

  if (startIndex === -1 || endIndex === -1) {
    console.error('[Quotes] Could not find placeholders // QUOTES_START and/or // QUOTES_END in quotes.js');
    return;
  }

  const quotesJsonList = quotes.map(q => `      ${JSON.stringify(q)}`).join(',\n');

  const updatedJs = 
    quotesJs.substring(0, startIndex + startComment.length) + 
    '\n' + quotesJsonList + '\n      ' + 
    quotesJs.substring(endIndex);

  fs.writeFileSync(quotesJsPath, updatedJs, 'utf8');
  console.log('[Quotes] Successfully synced quotes.txt quotes into quotes.js!');
}

function build() {
  // Step 0: Sync quotes from quotes.txt to quotes.js
  syncQuotes();

  // Step 1: Regenerate projects.html cards first
  generateProjectCards();

  // Step 2: Read canonical header and footer templates
  if (!fs.existsSync(HEADER_TEMPLATE_PATH) || !fs.existsSync(FOOTER_TEMPLATE_PATH)) {
    console.error('Error: Canonical header/footer templates not found inside templates/');
    process.exit(1);
  }

  const canonicalHeader = fs.readFileSync(HEADER_TEMPLATE_PATH, 'utf8');
  const canonicalFooter = fs.readFileSync(FOOTER_TEMPLATE_PATH, 'utf8');

  // Step 3: Find all HTML files to process
  const htmlFiles = getHtmlFiles(__dirname);
  console.log(`[Build] Found ${htmlFiles.length} HTML file(s) to process.`);

  // CSS files to automatically fix in subdirectories
  const cssFiles = ['style.css', 'blog.css', 'projects.css', 'translations.css', 'repairs.css'];

  htmlFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    let content = fs.readFileSync(fullPath, 'utf8');

    // Calculate directory depth
    const depth = file.split(path.sep).length - 1;
    const pathPrefix = depth > 0 ? '../'.repeat(depth) : '';

    // Adjust templates with the pathPrefix
    let headerHtml = canonicalHeader.replace(/\{\{PATH_PREFIX\}\}/g, pathPrefix);
    let footerHtml = canonicalFooter.replace(/\{\{PATH_PREFIX\}\}/g, pathPrefix);

    // Apply "active" class to current navigation link
    let activeClass = '';
    const normalizedFile = file.replace(/\\/g, '/'); // Normalize windows paths
    if (normalizedFile === 'index.html') {
      activeClass = 'nav-home';
    } else if (normalizedFile === 'projects.html' || normalizedFile.startsWith('projects/')) {
      activeClass = 'nav-projects';
    } else if (normalizedFile === 'translations.html' || normalizedFile.startsWith('translations/')) {
      activeClass = 'nav-translations';
    } else if (normalizedFile === 'blog.html' || normalizedFile === 'contentment.html' || normalizedFile.startsWith('blog/')) {
      activeClass = 'nav-blog';
    } else if (normalizedFile === 'repairs.html' || normalizedFile.startsWith('repairs/')) {
      activeClass = 'nav-repairs';
    }

    if (activeClass) {
      headerHtml = headerHtml.replace(`class="${activeClass}"`, `class="${activeClass} active"`);
    }

    // Replace header block
    const headerRegex = /<header>[\s\S]*?<\/header>/i;
    if (headerRegex.test(content)) {
      content = content.replace(headerRegex, headerHtml);
    }

    // Replace footer block
    const footerRegex = /<footer>[\s\S]*?<\/footer>/i;
    if (footerRegex.test(content)) {
      content = content.replace(footerRegex, footerHtml);
    }

    // Fix stylesheet paths for subdirectory files (e.g. href="style.css" -> href="../style.css")
    cssFiles.forEach(cssName => {
      const cssRegex = new RegExp(`href="([^"]*/)?${cssName}"`, 'gi');
      content = content.replace(cssRegex, `href="${pathPrefix}${cssName}"`);
    });

    // Fix script path for quotes.js and pass data-root attribute
    const scriptRegex = /<script\s+src="([^"]*)quotes\.js"\s*(data-root="[^"]*")?\s*><\/script>/gi;
    content = content.replace(scriptRegex, `<script src="${pathPrefix}quotes.js" data-root="${pathPrefix}"></script>`);

    // Fix standard images in subdirectory files (e.g. src="images/..." -> src="../images/...")
    const imgRegex = /src="([^"]*)images\/([^"]*)"/gi;
    content = content.replace(imgRegex, `src="${pathPrefix}images/$2"`);

    // Fix links to root HTML pages in subdirectory files (e.g. href="blog.html" -> href="../blog.html")
    const rootHtmlFiles = ['index.html', 'projects.html', 'translations.html', 'blog.html', 'repairs.html'];
    rootHtmlFiles.forEach(htmlName => {
      const hrefRegex = new RegExp(`href="([^"\\/]*\\/)?${htmlName}(#[^"]*)?"`, 'gi');
      content = content.replace(hrefRegex, (match, folder, hash) => {
        return `href="${pathPrefix}${htmlName}${hash || ''}"`;
      });
    });

    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`[Build] Successfully updated: ${file} (depth: ${depth})`);
  });

  console.log('[Build] Finished page rebuilds!');
}

build();
