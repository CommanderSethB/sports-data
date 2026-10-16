const SEASON = 2026;
const NUM_WEEKS = 18;
const REGSEASON_BASE_URL = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&dates=";

updateGameList();

async function updateGameList() {
    // Create result array
    var result = [];

    // Iterate through each week of the season
    for(var week = 1; week <= NUM_WEEKS; week++) {
        // Set week number
        var weekName = "Week " + week;

        // Set the JSON URL for the current week
        var url = REGSEASON_BASE_URL + SEASON + "&week=" + week;

        // Fetch the JSON data
        try {
            const response = await fetch(url);
            const data = await response.json();

            for(var game = 0; game < data.events.length; game++) {
                // Set current game
                var currentGame = data.events[game];

                // Get current game details
                var gameID = currentGame.id;
                var gameDate = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(currentGame.date));
                var gameTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }).format(new Date(currentGame.date));
                var homeTeam = currentGame.competitions[0].competitors[0].team.id;
                var awayTeam = currentGame.competitions[0].competitors[1].team.id;
                var homeScore = currentGame.competitions[0].competitors[0].score;
                var awayScore = currentGame.competitions[0].competitors[1].score;
                var gameStatus = currentGame.status.type.description;

                // Add the current game details to the result array
                result.push({week: weekName, gameID: gameID, date: gameDate, time: gameTime, homeTeam: homeTeam, awayTeam: awayTeam, status: gameStatus, homeScore: homeScore, awayScore: awayScore});
            }
        } catch (error) {
            console.error("Error fetching data");
        }
    }

    var fs = require('fs');
    fs.writeFile('liveScoring.json', JSON.stringify(result), (err) => {
        if(err) console.log(err);
    });
}