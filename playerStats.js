async function statList() {
    // Create result array
    var result = [];

    // Fetch the JSON data from the server/local web server
    try {
        const response = await fetch('./playerStats.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        for(var game = 0; game < data.length; game++) {
            // Set current game
            var currentPlayer = data[game];

            // Add the current game details to the result array
            result.push({
                playerID: currentPlayer.playerID,
                teamID: currentPlayer.teamID, 
                passCompletions: currentPlayer.passCompletions,
                passAttempts: currentPlayer.passAttempts,
                passYards: currentPlayer.passYards,
                passYardsPerAttempt: currentPlayer.passYardsPerAttempt,
                passTouchdowns: currentPlayer.passTouchdowns,
                passInterceptions: currentPlayer.passInterceptions,
                passSacks: currentPlayer.passSacks,
                passSackYards: currentPlayer.passSackYards,
                passerRating: currentPlayer.passerRating,
                rushAttempts: currentPlayer.rushAttempts,
                rushYards: currentPlayer.rushYards,
                rushYardsPerAttempt: currentPlayer.rushYardsPerAttempt,
                rushTouchdowns: currentPlayer.rushTouchdowns,
                longestRush: currentPlayer.longestRush,
                receptions: currentPlayer.receptions,
                receivingYards: currentPlayer.receivingYards,
                receivingYardsPerReception: currentPlayer.receivingYardsPerReception,
                receivingTouchdowns: currentPlayer.receivingTouchdowns,
                longestReception: currentPlayer.longestReception,
                receivingTargets: currentPlayer.receivingTargets,
                fumbles: currentPlayer.fumbles,
                fumblesLost: currentPlayer.fumblesLost,
                fumblesRecovered: currentPlayer.fumblesRecovered,
                tackles: currentPlayer.tackles,
                tacklesSolo: currentPlayer.tacklesSolo,
                sacks: currentPlayer.sacks,
                tacklesForLoss: currentPlayer.tacklesForLoss,
                passesDefended: currentPlayer.passesDefended,
                quarterbackHits: currentPlayer.quarterbackHits,
                defensiveTouchdowns: currentPlayer.defensiveTouchdowns,
                interceptions: currentPlayer.interceptions,
                interceptionReturnYards: currentPlayer.interceptionReturnYards,
                interceptionReturnTouchdowns: currentPlayer.interceptionReturnTouchdowns,
                kickoffReturns: currentPlayer.kickoffReturns,
                kickoffReturnYards: currentPlayer.kickoffReturnYards,
                kickoffReturnYardsPerAttempt: currentPlayer.kickoffReturnYardsPerAttempt,
                longestKickoffReturn: currentPlayer.longestKickoffReturn,
                kickoffReturnTouchdowns: currentPlayer.kickoffReturnTouchdowns,
                puntReturns: currentPlayer.puntReturns,
                puntReturnYards: currentPlayer.puntReturnYards,
                puntReturnYardsPerAttempt: currentPlayer.puntReturnYardsPerAttempt,
                longestPuntReturn: currentPlayer.longestPuntReturn,
                puntReturnTouchdowns: currentPlayer.puntReturnTouchdowns,
                fieldGoalsMade: currentPlayer.fieldGoalsMade,
                fieldGoalsAttempted: currentPlayer.fieldGoalsAttempted,
                fieldGoalPercentage: currentPlayer.fieldGoalPercentage,
                longestFieldGoal: currentPlayer.longestFieldGoal,
                extraPointsMade: currentPlayer.extraPointsMade,
                extraPointsAttempted: currentPlayer.extraPointsAttempted,
                kickingPoints: currentPlayer.kickingPoints,
                punts: currentPlayer.punts,
                puntYards: currentPlayer.puntYards,
                puntYardsPerAttempt: currentPlayer.puntYardsPerAttempt,
                puntTouchbacks: currentPlayer.puntTouchbacks,
                puntsInside20: currentPlayer.puntsInside20,
                longestPunt: currentPlayer.longestPunt
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

    statList().then(result => { 
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