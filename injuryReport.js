async function injuryList() {
    // Create result array
    var result = [];

    // Fetch the JSON data from the server/local web server
    try {
        const response = await fetch('./injuryReport.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        for(var injury = 0; injury < data.length; injury++) {
            // Set current game
            var currentInjury = data[injury];

            // Add the current game details to the result array
            result.push({
                teamID: currentInjury.teamID,
                playerID: currentInjury.playerID,
                playerName: currentInjury.playerName,
                injuryStatus: currentInjury.injuryStatus,
                injuryScore: currentInjury.playerScore
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

    injuryList().then(result => { 
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