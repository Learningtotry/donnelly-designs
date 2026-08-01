const fs = require('fs');
const path = require('path');

const PROJECTS_DIR = path.join(__dirname, 'projects');
const PROJECTS_HTML_PATH = path.join(__dirname, 'projects.html');
const DEFAULT_IMAGE = 'images/project_thumbnail.png';

// Fallback formatting for titles based on filename
function formatFilenameToTitle(filename) {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  return nameWithoutExt
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function cleanHtml(html) {
  // Strip tags and decode simple HTML entities
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
  
  // Try to find an h1 inside the article-body first
  const bodyH1Match = content.match(/<div class="article-body">[\s\S]*?<h1>([\s\S]*?)<\/h1>/);
  if (bodyH1Match) {
    title = cleanHtml(bodyH1Match[1]);
  }

  // If not found in body, check the main article-detail-title
  if (!title) {
    const detailTitleMatch = content.match(/<h1 class="article-detail-title">([\s\S]*?)<\/h1>/);
    if (detailTitleMatch) {
      const matchText = cleanHtml(detailTitleMatch[1]);
      // Avoid the generic template placeholder title
      if (!matchText.toLowerCase().includes('example article title')) {
        title = matchText;
      }
    }
  }

  // If still not found, check head title
  if (!title) {
    const headTitleMatch = content.match(/<title>([\s\S]*?)<\/title>/);
    if (headTitleMatch) {
      const matchText = cleanHtml(headTitleMatch[1]);
      if (!matchText.toLowerCase().includes('article title')) {
        title = matchText.replace(/\s*-\s*My Blog/i, '');
      }
    }
  }

  // Fallback to formatted filename
  if (!title) {
    title = formatFilenameToTitle(filename);
  }

  // 2. Extract Featured Image
  let image = DEFAULT_IMAGE;
  const imageMatch = content.match(/class="article-featured-image"[\s\S]*?<img[^>]+src="([^"]+)"/);
  if (imageMatch) {
    let src = imageMatch[1];
    // Resolve relative paths if they point to parent directory (e.g. ../images/...)
    if (src.startsWith('../')) {
      src = src.substring(3);
    }
    image = src;
  }

  // 3. Extract Description / Excerpt
  let excerpt = '';
  
  // Check for meta description first
  const metaDescMatch = content.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i) ||
                        content.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i);
  if (metaDescMatch) {
    excerpt = cleanHtml(metaDescMatch[1]);
  }

  // If no meta description, get the first paragraph from the article-body
  if (!excerpt) {
    const bodyParagraphsMatch = content.match(/<div class="article-body">([\s\S]*?)<\/div>/);
    if (bodyParagraphsMatch) {
      const bodyContent = bodyParagraphsMatch[1];
      // Find the first paragraph tag that has content
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

  // Truncate excerpt if it is too long (max 250 chars)
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

function generate() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`Error: projects directory not found at ${PROJECTS_DIR}`);
    process.exit(1);
  }

  // Read all files in the projects directory
  const files = fs.readdirSync(PROJECTS_DIR);
  
  // Filter for article files (exclude README.md, hidden files, or subdirectories)
  const projectFiles = files.filter(file => {
    const fullPath = path.join(PROJECTS_DIR, file);
    const stat = fs.statSync(fullPath);
    return stat.isFile() && 
           file !== 'README.md' && 
           !file.startsWith('.');
  });

  console.log(`Found ${projectFiles.length} project file(s).`);

  const projects = projectFiles.map(file => {
    try {
      return parseProjectFile(file);
    } catch (err) {
      console.error(`Error parsing ${file}:`, err);
      return null;
    }
  }).filter(Boolean);

  // Generate HTML for project cards
  // We hide articles starting from index 3 (4th project) to match the view more functionality
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

  // Read projects.html and replace contents between comments
  if (!fs.existsSync(PROJECTS_HTML_PATH)) {
    console.error(`Error: projects.html not found at ${PROJECTS_HTML_PATH}`);
    process.exit(1);
  }

  let projectsHtml = fs.readFileSync(PROJECTS_HTML_PATH, 'utf8');
  
  const startComment = '<!-- PROJECTS_START -->';
  const endComment = '<!-- PROJECTS_END -->';
  
  const startIndex = projectsHtml.indexOf(startComment);
  const endIndex = projectsHtml.indexOf(endComment);

  if (startIndex === -1 || endIndex === -1) {
    console.error(`Error: Could not find placeholders ${startComment} and/or ${endComment} in projects.html`);
    process.exit(1);
  }

  const updatedHtml = 
    projectsHtml.substring(0, startIndex + startComment.length) + 
    '\n' + cardsHtml + '\n      ' + 
    projectsHtml.substring(endIndex);

  fs.writeFileSync(PROJECTS_HTML_PATH, updatedHtml, 'utf8');
  console.log('Successfully updated projects.html with dynamic cards!');
}

generate();
