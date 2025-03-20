// Function to check if all pieces are present
    function checkAllPieces(pieces) {
        let missingPieces = [];

        pieces.forEach(piece => {
            // Use a regex to check for any square-0 to square-100 class
            const div = document.querySelector(`.piece.${piece.type}[class*="square-"]`);

            if (div) {
                // Check if it actually has a square between 0 and 100
                const classList = Array.from(div.classList);
                const hasValidSquare = classList.some(cls => {
                    const match = cls.match(/^square-(\d+)$/);
                    return match && parseInt(match[1]) >= 0 && parseInt(match[1]) <= 100;
                });

                if (!hasValidSquare) {
                    missingPieces.push(`${piece.type} does not have a valid square (0-100)`);
                }
            } else {
                missingPieces.push(`${piece.type} is missing entirely`);
            }
        });

        if (missingPieces.length === 0) {
            console.log("All pieces found with valid squares");
        } else {
            console.log("Missing pieces:", missingPieces.join(", "));
        }
    }

  
  // Fetch the pieces data from the JSON file
  fetch(chrome.runtime.getURL('pieces.json'))
    .then(response => response.json())
    .then(data => {
      // Call the function to check for the pieces when the page is loaded
      document.addEventListener("DOMContentLoaded", () => {
        checkAllPieces(data.pieces);
        
        // Use MutationObserver to keep checking if pieces change
        const observer = new MutationObserver(() => {
            checkAllPieces(data.pieces); // Re-check the pieces on the page when the DOM changes
        });
  
        // Start observing the DOM for changes (child elements and subtree)
        observer.observe(document.body, {
          childList: true,  // Observe added/removed child elements
          subtree: true     // Observe all descendants of the body
        });
      });
    })
    .catch(error => {
      console.error("Error loading pieces data:", error);
    });
  