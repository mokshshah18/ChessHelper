function checkAllPieces(pieces) {
  let missingPieces = [];
  let remainingPieces = {};
  
  // Count how many of each piece type we expect
  let expectedPieceCounts = {};
  pieces.forEach(piece => {
      expectedPieceCounts[piece.type] = (expectedPieceCounts[piece.type] || 0) + 1;
  });
  
  // Count how many of each piece type we actually have on the board
  let actualPieceCounts = {};
  
  // Try multiple selectors to find pieces
  const pieceElements = Array.from(document.querySelectorAll([
      // New chess.com selectors
      'div[data-piece]',
      'div.piece',
      // Piece squares
      '.piece-square',
      // Backup selectors
      '[class*="piece_"]',
      '[class*="chess-piece"]'
  ].join(',')));

  console.log(`Found ${pieceElements.length} piece elements`);
  
  pieceElements.forEach(element => {
      let pieceType = null;
      let square = null;
      
      // 1. Try data-piece attribute (new chess.com format)
      const dataPiece = element.getAttribute('data-piece');
      if (dataPiece) {
          const [color, piece] = dataPiece.split('-');
          pieceType = (color === 'white' ? 'w' : 'b') + piece[0].toLowerCase();
      }
      
      // 2. Try class-based detection
      if (!pieceType) {
          const classList = Array.from(element.classList);
          // Check for standard piece classes
          const standardPiece = classList.find(cls => /^[wb][prnbqk]$/.test(cls));
          if (standardPiece) {
              pieceType = standardPiece;
          } else {
              // Check for new format classes
              const newFormatPiece = classList.find(cls => /piece_[wb][prnbqk]/.test(cls));
              if (newFormatPiece) {
                  pieceType = newFormatPiece.replace('piece_', '');
              }
          }
      }

      // Get square position
      if (pieceType) {
          // Try different methods to get the square
          // 1. Try data-square attribute
          square = element.getAttribute('data-square');
          
          // 2. Try square class
          if (!square) {
              const squareClass = Array.from(element.classList).find(cls => /square-[a-h][1-8]/.test(cls));
              if (squareClass) {
                  square = squareClass.replace('square-', '');
              }
          }
          
          // 3. Try parent element's data-square
          if (!square && element.parentElement) {
              square = element.parentElement.getAttribute('data-square');
          }
          
          // 4. Try coordinate calculation from position
          if (!square) {
              const board = document.querySelector('.board');
              if (board && element.getBoundingClientRect) {
                  const boardRect = board.getBoundingClientRect();
                  const pieceRect = element.getBoundingClientRect();
                  const relX = pieceRect.left - boardRect.left;
                  const relY = boardRect.bottom - pieceRect.bottom;
                  const file = String.fromCharCode(97 + Math.floor((8 * relX) / boardRect.width));
                  const rank = 1 + Math.floor((8 * relY) / boardRect.height);
                  if (file >= 'a' && file <= 'h' && rank >= 1 && rank <= 8) {
                      square = file + rank;
                  }
              }
          }

          actualPieceCounts[pieceType] = (actualPieceCounts[pieceType] || 0) + 1;
          
          // Store the piece and its position
          if (!remainingPieces[pieceType]) {
              remainingPieces[pieceType] = [];
          }
          remainingPieces[pieceType].push(square || 'unknown');
          
          console.log(`Found ${pieceType} on square ${square || 'unknown'}`);
      }
  });
  
  console.log('Expected counts:', expectedPieceCounts);
  console.log('Actual counts:', actualPieceCounts);
  console.log('Remaining pieces and their positions:', remainingPieces);
  
  // Check if we have all the expected pieces
  for (const [pieceType, expectedCount] of Object.entries(expectedPieceCounts)) {
      const actualCount = actualPieceCounts[pieceType] || 0;
      
      if (actualCount < expectedCount) {
          const remaining = remainingPieces[pieceType] || [];
          missingPieces.push(`${pieceType}: missing ${expectedCount - actualCount} of ${expectedCount}. Remaining on squares: ${remaining.join(', ')}`);
      }
  }
  
  // Log results
  if (missingPieces.length === 0) {
      console.log("All expected pieces are present on the board");
      console.log("Piece positions:", remainingPieces);
      return true;
  } else {
      console.log("Missing pieces:", missingPieces);
      console.log("Remaining piece positions:", remainingPieces);
      return false;
  }
}

// Fetch and observe changes
function initChessPieceChecker() {
  fetch(chrome.runtime.getURL('pieces.json'))
      .then(response => response.json())
      .then(data => {
          // Initial check
          const result = checkAllPieces(data.pieces);
          console.log(`Initial check: ${result ? 'All pieces present' : 'Some pieces missing'}`);
          
          // Setup observer for changes
          const observer = new MutationObserver((mutations) => {
              // Check if any relevant mutations occurred
              const relevantMutation = mutations.some(mutation => {
                  return (
                      mutation.type === 'childList' ||
                      (mutation.type === 'attributes' && 
                       (mutation.attributeName === 'class' || 
                        mutation.attributeName === 'data-piece')) ||
                      mutation.type === 'characterData'
                  );
              });

              if (relevantMutation) {
                  console.log('Detected board change');
                  const result = checkAllPieces(data.pieces);
                  console.log(`Check after change: ${result ? 'All pieces present' : 'Some pieces missing'}`);
              }
          });
          
          // Find and observe the chess board and its container
          function startObserving() {
              const possibleContainers = [
                  // Main board container
                  document.querySelector('.board-layout-main'),
                  document.querySelector('.board'),
                  document.querySelector('.board-container'),
                  // Game area
                  document.querySelector('.game-board'),
                  document.querySelector('.board-player'),
                  // Specific chess.com elements
                  document.querySelector('chess-board'),
                  document.querySelector('wc-chess-board'),
                  // Fallback
                  document.querySelector('[class*="board"]')
              ].filter(Boolean); // Remove null elements

              if (possibleContainers.length > 0) {
                  console.log(`Found ${possibleContainers.length} possible board containers`);
                  possibleContainers.forEach(container => {
                      observer.observe(container, {
                          childList: true,
                          subtree: true,
                          attributes: true,
                          attributeFilter: ['class', 'data-piece'],
                          characterData: true
                      });
                      console.log('Observing container:', container);
                  });
                  return true;
              }
              return false;
          }

          // Try to start observing, retry if failed
          if (!startObserving()) {
              console.log('Board not found initially, waiting to retry...');
              // Retry a few times with increasing delays
              [500, 1000, 2000, 5000].forEach(delay => {
                  setTimeout(() => {
                      if (startObserving()) {
                          console.log(`Successfully started observer after ${delay}ms`);
                      }
                  }, delay);
              });
          }
      })
      .catch(error => console.error("Error loading pieces data:", error));
}

// Run on page load and retry if board is not immediately available
function tryInit() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChessPieceChecker);
    } else {
        initChessPieceChecker();
    }
}

// Initial load
tryInit();

// Also try when URL changes (for single-page app navigation)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log('URL changed, reinitializing...');
        initChessPieceChecker();
    }
}).observe(document, { subtree: true, childList: true });
