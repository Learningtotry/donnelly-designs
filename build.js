const fs = require('fs');
const path = require('path');

const PROJECTS_DIR = path.join(__dirname, 'projects');
const PROJECTS_HTML_PATH = path.join(__dirname, 'projects.html');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const HEADER_TEMPLATE_PATH = path.join(TEMPLATES_DIR, 'header.html');
const FOOTER_TEMPLATE_PATH = path.join(TEMPLATES_DIR, 'footer.html');
const BIO_TEMPLATE_PATH = path.join(TEMPLATES_DIR, 'bio.html');
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

function parseFrontMatter(content) {
  const result = { content: content, metadata: {} };
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (match) {
    const yamlSection = match[1];
    result.content = match[2];
    const lines = yamlSection.split('\n');
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim().toLowerCase();
        const value = parts.slice(1).join(':').trim();
        // Strip quotes if any
        result.metadata[key] = value.replace(/^['"]|['"]$/g, '');
      }
    }
  }
  return result;
}

function parseArticleFile(dirPath, filename) {
  const filePath = path.join(dirPath, filename);
  const content = fs.readFileSync(filePath, 'utf8');

  let metadata = {};
  let bodyContent = content;

  if (content.startsWith('---')) {
    const parsed = parseFrontMatter(content);
    metadata = parsed.metadata;
    bodyContent = parsed.content;
  }

  // 1. Extract Title
  let title = metadata.title || '';
  if (!title && filename.endsWith('.html')) {
    const bodyH1Match = bodyContent.match(/<div class="article-body">[\s\S]*?<h1>([\s\S]*?)<\/h1>/);
    if (bodyH1Match) {
      title = cleanHtml(bodyH1Match[1]);
    }

    if (!title) {
      const detailTitleMatch = bodyContent.match(/<h1 class="article-detail-title">([\s\S]*?)<\/h1>/);
      if (detailTitleMatch) {
        const matchText = cleanHtml(detailTitleMatch[1]);
        if (!matchText.toLowerCase().includes('example article title')) {
          title = matchText;
        }
      }
    }

    if (!title) {
      const headTitleMatch = bodyContent.match(/<title>([\s\S]*?)<\/title>/);
      if (headTitleMatch) {
        const matchText = cleanHtml(headTitleMatch[1]);
        if (!matchText.toLowerCase().includes('article title')) {
          title = matchText.replace(/\s*-\s*My Blog/i, '').replace(/\s*-\s*My Portfolio/i, '');
        }
      }
    }
  }

  if (!title) {
    title = formatFilenameToTitle(filename);
  }

  // 2. Extract Date
  let dateStr = metadata.date || '';
  if (!dateStr && filename.endsWith('.html')) {
    const dateMatch = bodyContent.match(/<span class="article-date">([\s\S]*?)<\/span>/);
    if (dateMatch) {
      dateStr = cleanHtml(dateMatch[1]);
    }
  }
  let date = null;
  if (dateStr) {
    date = new Date(dateStr);
  }
  if (!date || isNaN(date.getTime())) {
    const stat = fs.statSync(filePath);
    date = stat.mtime || stat.birthtime;
  }

  // 3. Extract Featured Image
  let image = metadata.image || DEFAULT_IMAGE;
  if (image === DEFAULT_IMAGE && filename.endsWith('.html')) {
    const imageMatch = bodyContent.match(/class="article-featured-image"[\s\S]*?<img[^>]+src="([^"]+)"/) ||
                       bodyContent.match(/<div class="article-featured-image"[\s\S]*?<img[^>]+src="([^"]+)"/);
    if (imageMatch) {
      let src = imageMatch[1];
      if (src.startsWith('../')) {
        src = src.substring(3);
      }
      image = src;
    }
  }

  // 4. Extract Description / Excerpt
  let excerpt = metadata.excerpt || '';
  if (!excerpt && filename.endsWith('.html')) {
    const metaDescMatch = bodyContent.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i) ||
                          bodyContent.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i);
    if (metaDescMatch) {
      excerpt = cleanHtml(metaDescMatch[1]);
    }

    if (!excerpt) {
      const bodyParagraphsMatch = bodyContent.match(/<div class="article-body">([\s\S]*?)<\/div>/);
      if (bodyParagraphsMatch) {
        const bodyText = bodyParagraphsMatch[1];
        const pMatches = bodyText.matchAll(/<p>([\s\S]*?)<\/p>/g);
        for (const pMatch of pMatches) {
          const text = cleanHtml(pMatch[1]);
          if (text.length > 10) {
            excerpt = text;
            break;
          }
        }
      }
    }
  }

  if (!excerpt && !filename.endsWith('.html')) {
    const paragraphs = bodyContent.split(/\r?\n\r?\n/).map(p => cleanHtml(p)).filter(p => p.length > 10);
    if (paragraphs.length > 0) {
      excerpt = paragraphs[0];
    }
  }

  const maxChars = 250;
  if (excerpt.length > maxChars) {
    excerpt = excerpt.substring(0, maxChars).trim() + '...';
  } else if (!excerpt) {
    excerpt = `No ${path.basename(dirPath)} description available.`;
  }

  return {
    filename,
    title,
    image,
    excerpt,
    date
  };
}

const CATEGORIES = {
  projects: {
    dir: path.join(__dirname, 'projects'),
    htmlPath: path.join(__dirname, 'projects.html'),
    startComment: '<!-- PROJECTS_START -->',
    endComment: '<!-- PROJECTS_END -->',
    name: 'Projects',
    linkPrefix: 'projects/'
  },
  translations: {
    dir: path.join(__dirname, 'translations'),
    htmlPath: path.join(__dirname, 'translations.html'),
    startComment: '<!-- TRANSLATIONS_START -->',
    endComment: '<!-- TRANSLATIONS_END -->',
    name: 'Translations',
    linkPrefix: 'translations/'
  },
  blog: {
    dir: path.join(__dirname, 'blog'),
    htmlPath: path.join(__dirname, 'blog.html'),
    startComment: '<!-- BLOG_START -->',
    endComment: '<!-- BLOG_END -->',
    name: 'Blog',
    linkPrefix: 'blog/'
  },
  repairs: {
    dir: path.join(__dirname, 'repairs'),
    htmlPath: path.join(__dirname, 'repairs.html'),
    startComment: '<!-- REPAIRS_START -->',
    endComment: '<!-- REPAIRS_END -->',
    name: 'Tech Repairs',
    linkPrefix: 'repairs/'
  }
};

function generateCards() {
  const INDEX_HTML_PATH = path.join(__dirname, 'index.html');
  if (!fs.existsSync(INDEX_HTML_PATH)) {
    console.error(`Error: index.html not found at ${INDEX_HTML_PATH}`);
    return;
  }
  let indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

  for (const [key, cat] of Object.entries(CATEGORIES)) {
    if (!fs.existsSync(cat.dir)) {
      fs.mkdirSync(cat.dir, { recursive: true });
    }

    const files = fs.readdirSync(cat.dir).filter(file => {
      const fullPath = path.join(cat.dir, file);
      const stat = fs.statSync(fullPath);
      return stat.isFile() && file !== 'README.md' && !file.startsWith('.');
    });

    console.log(`[Cards] Found ${files.length} file(s) for ${cat.name}.`);

    const articles = files.map(file => {
      try {
        return parseArticleFile(cat.dir, file);
      } catch (err) {
        console.error(`Error parsing ${cat.name} file ${file}:`, err);
        return null;
      }
    }).filter(Boolean);

    // Sort chronologically (newest first)
    articles.sort((a, b) => b.date - a.date);

    // Generate section page cards
    const sectionCardsHtml = articles.map((art, idx) => {
      const isHidden = idx >= 3;
      const cardClass = isHidden ? 'article-card hidden' : 'article-card';
      return `      <!-- ${cat.name}: ${art.title} -->
      <article class="${cardClass}">
        <div class="article-image-container">
          <a href="${cat.linkPrefix}${art.filename}">
            <img src="${art.image}" alt="${art.title}" class="article-image">
          </a>
        </div>
        <div class="article-text">
          <h2 class="article-title">
            <a href="${cat.linkPrefix}${art.filename}">${art.title}</a>
          </h2>
          <p class="article-excerpt">
            ${art.excerpt}
          </p>
        </div>
      </article>`;
    }).join('\n\n');

    if (fs.existsSync(cat.htmlPath)) {
      let pageHtml = fs.readFileSync(cat.htmlPath, 'utf8');
      const startIdx = pageHtml.indexOf(cat.startComment);
      const endIdx = pageHtml.indexOf(cat.endComment);

      if (startIdx !== -1 && endIdx !== -1) {
        const updatedPageHtml = 
          pageHtml.substring(0, startIdx + cat.startComment.length) + 
          '\n' + sectionCardsHtml + '\n      ' + 
          pageHtml.substring(endIdx);
        fs.writeFileSync(cat.htmlPath, updatedPageHtml, 'utf8');
        console.log(`[Cards] Updated ${path.basename(cat.htmlPath)} with cards!`);
      } else {
        console.warn(`[Cards] Warning: Placeholders not found in ${path.basename(cat.htmlPath)}`);
      }
    }

    // Generate homepage cards (up to 2 latest items)
    const homeArticles = articles.slice(0, 2);
    const homeCardsHtml = homeArticles.map(art => {
      return `        <article class="card clickable-card" onclick="window.location.href='${cat.linkPrefix}${art.filename}'">
          <h3>${art.title}</h3>
          <p>${art.excerpt}</p>
        </article>`;
    }).join('\n');

    const homeStartIdx = indexHtml.indexOf(cat.startComment);
    const homeEndIdx = indexHtml.indexOf(cat.endComment);
    if (homeStartIdx !== -1 && homeEndIdx !== -1) {
      indexHtml = 
        indexHtml.substring(0, homeStartIdx + cat.startComment.length) + 
        '\n' + homeCardsHtml + '\n        ' + 
        indexHtml.substring(homeEndIdx);
    } else {
      console.warn(`[Cards] Warning: Placeholders not found in index.html for category ${cat.name}`);
    }
  }

  fs.writeFileSync(INDEX_HTML_PATH, indexHtml, 'utf8');
  console.log('[Cards] Successfully updated index.html with homepage preview cards!');
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

  // Step 1: Regenerate cards for all categories
  generateCards();

  // Step 2: Read canonical header, footer, and bio templates
  if (!fs.existsSync(HEADER_TEMPLATE_PATH) || !fs.existsSync(FOOTER_TEMPLATE_PATH) || !fs.existsSync(BIO_TEMPLATE_PATH)) {
    console.error('Error: Canonical header/footer/bio templates not found inside templates/');
    process.exit(1);
  }

  const canonicalHeader = fs.readFileSync(HEADER_TEMPLATE_PATH, 'utf8');
  const canonicalFooter = fs.readFileSync(FOOTER_TEMPLATE_PATH, 'utf8');
  const canonicalBio = fs.readFileSync(BIO_TEMPLATE_PATH, 'utf8');

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

    // Replace bio block
    let bioHtml = canonicalBio.replace(/\{\{PATH_PREFIX\}\}/g, pathPrefix);
    const bioRegex = /<div class="author-card">[\s\S]*?<\/div>\s*<\/div>/i;
    if (bioRegex.test(content)) {
      content = content.replace(bioRegex, bioHtml);
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
