document.addEventListener('DOMContentLoaded', () => {
  // --- Quote Generator ---
  const quoteEl = document.getElementById('footer-quote');
  if (quoteEl) {
    const fallbackQuotes = [
      "If it's not broken, mod it until it is. * Anonymous",
      "Hardware is easy to protect: just put it in a box. Software is harder. * Gilad Bracha",
      "There are only two hard things in Computer Science: cache invalidation and naming things. * Phil Karlton",
      "Localization is not just translation; it is adaptation. * Localization Guide",
      "The best error message is the one that never shows up. * Thomas Fuchs",
      "Talk is cheap. Show me the code. * Linus Torvalds"
    ];

    function displayQuote(line) {
      const asteriskIndex = line.lastIndexOf('*');
      let quoteText = line;
      let authorText = '';

      if (asteriskIndex !== -1) {
        quoteText = line.substring(0, asteriskIndex).trim();
        authorText = line.substring(asteriskIndex + 1).trim();
      }

      if (authorText) {
        quoteEl.innerHTML = `“${quoteText}”<div class="quote-author">— ${authorText}</div>`;
      } else {
        quoteEl.innerHTML = `“${quoteText}”`;
      }
    }

    fetch('quotes.txt')
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.text();
      })
      .then(text => {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length === 0) throw new Error('No quotes in file');
        const randomLine = lines[Math.floor(Math.random() * lines.length)];
        displayQuote(randomLine);
      })
      .catch(err => {
        console.warn('Could not load quotes.txt (possibly CORS restrictions on local file:// protocol), using fallback quotes.', err);
        const randomLine = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
        displayQuote(randomLine);
      });
  }

  // --- Footer Photo Animation ---
  const mageImg = document.getElementById('black-mage');
  if (mageImg) {
    const walkFrames = [
      'images/black_mage.png',
      'images/black_mage_flipped.png'
    ];
    let walkInterval = null;
    let currentFrame = 0;

    // Preload walking animation frames
    walkFrames.forEach(src => {
      const img = new Image();
      img.src = src;
    });

    mageImg.addEventListener('mouseenter', () => {
      currentFrame = 0;
      mageImg.src = walkFrames[currentFrame];
      walkInterval = setInterval(() => {
        currentFrame = (currentFrame + 1) % walkFrames.length;  
        mageImg.src = walkFrames[currentFrame];
      }, 150);
    });

    mageImg.addEventListener('mouseleave', () => {
      clearInterval(walkInterval);
      mageImg.src = 'images/black_mage.png';
    });
  }
});
