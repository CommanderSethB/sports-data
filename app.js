async function gameList() {
    // Create result array
    var result = [];

    // Fetch the JSON data from the server/local web server
    try {
        const response = await fetch('./liveScoring.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        for(var game = 0; game < data.length; game++) {
            // Set current game
            var currentGame = data[game];

            // Add the current game details to the result array
            result.push({
                week: currentGame.week, 
                gameID: currentGame.gameID, 
                date: currentGame.date, 
                time: currentGame.time, 
                homeTeam: currentGame.homeTeam, 
                awayTeam: currentGame.awayTeam, 
                status: currentGame.status, 
                homeScore: currentGame.homeScore, 
                awayScore: currentGame.awayScore
            });
        }
    } catch (error) {
        console.error("Could not load JSON:", error);
    }

    return result;
}

function renderTable() {
    const tbody = document.querySelector('#data-table tbody');
    if (!tbody) return; // Safety check if table body doesn't exist
    tbody.innerHTML = ''; // Clear existing rows

    gameList().then(result => { 
        result.forEach(item => {
            const row = document.createElement('tr');

            Object.values(item).forEach(value => {
                const cell = document.createElement('td');

                if (value !== null && typeof value === 'object') {
                    cell.textContent = JSON.stringify(value); 
                } else {
                    cell.textContent = value;
                }

                row.appendChild(cell);
            });

            tbody.appendChild(row);
        });
    });
}

// Run the render function automatically when the HTML page loads
document.addEventListener('DOMContentLoaded', renderTable);