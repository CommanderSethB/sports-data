const SEASON = 2026;
const NUM_WEEKS = 18;
const STAT_END_WEEK = 6;
const REGSEASON_BASE_URL = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&dates=";
const TEAMS_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";
const BOXSCORE_BASE_URL = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=";
const INJURY_URL = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/injuries";
const DEPTH_CHART_URL = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/";

//updateGames();
//updateInjuryReport();
//updateTeams();
//updateDepthCharts();
//updateSchedules();
//generateStandings();
updateSBP();

async function updateInjuryReport() {
    // Blank array
    var result = [];

    try {
        // Setup JSON
        var url = INJURY_URL;
        const response = await fetch(url);
        const data = await response.json();

        // Process data
        for(var team = 0; team < data.injuries.length; team++) {
            var teamID = data.injuries[team].id;

            for(var injury = 0; injury < data.injuries[team].injuries.length; injury++) {
                var currentInjury = data.injuries[team].injuries[injury];
                var playerLink = currentInjury.athlete.links[0].href;
                var splitString = playerLink.split("/");
                var playerID = splitString[7];
                var playerName = currentInjury.athlete.displayName;
                var injuryStatus = convertInjuryStatus(currentInjury.type.name);
                var playerScore = convertInjuryStatusToScore(currentInjury.type.name);

                result.push({teamID: teamID, playerID: playerID, playerName: playerName, injuryStatus: injuryStatus, playerScore: playerScore});
            }
        }
    } catch (err) {
        console.error(err);
    }

    var fs = require('fs');
    fs.writeFile('./data/injuryReport.json', JSON.stringify(result), (err) => {
        if(err) console.log(err);
    });
}

function convertInjuryStatus(inj_status){
    switch(inj_status){
      case "INJURY_STATUS_ACTIVE": return "Active";
      case "INJURY_STATUS_OUT": return "Out";
      case "INJURY_STATUS_QUESTIONABLE": return "Questionable";
      case "INJURY_STATUS_IR": return "IR";
      case "INJURY_STATUS_DOUBTFUL": return "Doubtful";
      case "INJURY_STATUS_SUSPENSION": return "Suspended";
      case "INJURY_STATUS_PROBABLE": return "Probable";
      default: return inj_status;
    }
}
  
function convertInjuryStatusToScore(inj_status){
    switch(inj_status){
        case "INJURY_STATUS_ACTIVE": return 1.0;
        case "INJURY_STATUS_OUT": return 0.0;
        case "INJURY_STATUS_QUESTIONABLE": return 0.5;
        case "INJURY_STATUS_IR": return -0.5;
        case "INJURY_STATUS_DOUBTFUL": return 0.25;
        case "INJURY_STATUS_SUSPENSION": return -0.5;
        case "INJURY_STATUS_PROBABLE": return 0.75;
        default: return inj_status;
    }
}

async function updateGames() {
    // Create result array
    var gameList = [];
    var statList = [];

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
                var homeTeamName = currentGame.competitions[0].competitors[0].team.displayName;
                var awayTeam = currentGame.competitions[0].competitors[1].team.id;
                var awayTeamName = currentGame.competitions[0].competitors[1].team.displayName;
                var homeScore = currentGame.competitions[0].competitors[0].score;
                var awayScore = currentGame.competitions[0].competitors[1].score;
                var gameStatus = currentGame.status.type.description;
                try {
                    var homeOdds = currentGame.competitions[0].odds[0].moneyline.home.close.odds;
                    var awayOdds = currentGame.competitions[0].odds[0].moneyline.away.close.odds;
                    var spread = currentGame.competitions[0].odds[0].details;
                    var overUnder = currentGame.competitions[0].odds[0].overUnder;
                } catch (error) {
                    var homeOdds = null;
                    var awayOdds = null;
                    var spread = null;
                    var overUnder = null;
                }

                // Get Winning team
                if(currentGame.competitions[0].competitors[0].winner) { 
                    var winningTeam = homeTeam; 
                } else if(currentGame.competitions[0].competitors[1].winner) {
                    var winningTeam = awayTeam;
                } else if(currentGame.competitions[0].competitors[0].score === currentGame.competitions[0].competitors[1].score && gameStatus === "Final") {
                    var winningTeam = "Tie";
                } else {
                    var winningTeam = null;
                }
                

                // Add the current game details to the result array
                gameList.push({
                    "Week": weekName, 
                    "Game ID": gameID, 
                    "Game Date": gameDate, 
                    "Game Time": gameTime, 
                    "Home Team": homeTeamName, 
                    "Home ID": homeTeam, 
                    "Away Team": awayTeamName, 
                    "Away ID": awayTeam, 
                    "Status": gameStatus, 
                    "Home Score": homeScore, 
                    "Away Score": awayScore,
                    "Winner": winningTeam, 
                    "Home ML": homeOdds, 
                    "Away ML": awayOdds, 
                    "Spread": spread, 
                    "Over/Under": overUnder
                });

                // If game status is Final, record the game stats
                if(week <= STAT_END_WEEK) {
                    // Set url to current game
                    var boxscoreURL = BOXSCORE_BASE_URL + gameID;

                    try {
                        // Grab JSON and setup data element
                        const boxscoreResponse = await fetch(boxscoreURL);
                        const boxscoreData = await boxscoreResponse.json();

                        // Shortcut to player list
                        var boxScoreTeams = boxscoreData.boxscore.players;

                        for(var boxScoreTeam = 0; boxScoreTeam < boxScoreTeams.length; boxScoreTeam++) {
                            // JSON is formatted to separate by teams, so this section goes through each team in the current game
                            var currentBoxScoreTeam = boxScoreTeams[boxScoreTeam];

                            var boxScorePlayerList = [];
                            var teamID = currentBoxScoreTeam.team.id;
                            var oppID = boxScoreTeams[1-boxScoreTeam].team.id;

                            // Iterate through stats for team to get all player IDs
                            for(var stat = 0; stat < currentBoxScoreTeam.statistics.length; stat++) {
                                var currentStat = currentBoxScoreTeam.statistics[stat];

                                // Iterate through players for current stat to get all player IDs
                                for(var boxScorePlayer = 0; boxScorePlayer < currentStat.athletes.length; boxScorePlayer++) {
                                    var currentPlayer = currentStat.athletes[boxScorePlayer];

                                    // Check if player is in the boxScorePlayerList array, if not add them
                                    if(!boxScorePlayerList.includes(currentPlayer.athlete.id)) {
                                        boxScorePlayerList.push(currentPlayer.athlete.id);
                                    }
                                }
                            }

                            // Iterate through the boxScorePlayerList to get each player's stats
                            for(var boxScorePlayer = 0; boxScorePlayer < boxScorePlayerList.length; boxScorePlayer++) {
                                // Setup stats
                                var passCompletions = 0;
                                var passAttempts = 0;
                                var passYards = 0;
                                var passYardsPerAttempt = 0;
                                var passTouchdowns = 0;
                                var passInterceptions = 0;
                                var passSacks = 0;
                                var passSackYards = 0;
                                var adjustedQBR = 0;
                                var passerRating = 0;
                                var rushAttempts = 0;
                                var rushYards = 0;
                                var rushYardsPerAttempt = 0;
                                var rushTouchdowns = 0;
                                var longestRush = 0;
                                var receptions = 0;
                                var receivingYards = 0;
                                var receivingYardsPerReception = 0;
                                var receivingTouchdowns = 0;
                                var longestReception = 0;
                                var receivingTargets = 0;
                                var fumbles = 0;
                                var fumblesLost = 0;
                                var fumblesRecovered = 0;
                                var tackles = 0;
                                var tacklesSolo = 0;
                                var sacks = 0;
                                var tacklesForLoss = 0;
                                var passesDefended = 0;
                                var quarterbackHits = 0;
                                var defensiveTouchdowns = 0;
                                var interceptions = 0;
                                var interceptionReturnYards = 0;
                                var interceptionReturnTouchdowns = 0;
                                var kickoffReturns = 0;
                                var kickoffReturnYards = 0;
                                var kickoffReturnYardsPerAttempt = 0;
                                var longestKickoffReturn = 0;
                                var kickoffReturnTouchdowns = 0;
                                var puntReturns = 0;
                                var puntReturnYards = 0;
                                var puntReturnYardsPerAttempt = 0;
                                var longestPuntReturn = 0;
                                var puntReturnTouchdowns = 0;
                                var fieldGoalsMade = 0;
                                var fieldGoalsAttempted = 0;
                                var fieldGoalPercentage = 0;
                                var longestFieldGoal = 0;
                                var extraPointsAttempted = 0;
                                var extraPointsMade = 0;
                                var kickingPoints = 0;
                                var punts = 0;
                                var puntYards = 0;
                                var puntYardsPerAttempt = 0;
                                var puntTouchbacks = 0;
                                var puntsInside20 = 0;
                                var longestPunt = 0;

                                var currentPlayerID = boxScorePlayerList[boxScorePlayer];

                                // Iterate through stats to get stats for the current player
                                for(var stat = 0; stat < currentBoxScoreTeam.statistics.length; stat++) {
                                    var currentStat = currentBoxScoreTeam.statistics[stat].athletes;

                                    for(var player = 0; player < currentStat.length; player++) {
                                        var currentPlayer = currentStat[player];

                                        // If the current player ID matches the current player, add their stats to the statList
                                        if(currentPlayer.athlete.id === currentPlayerID) {
                                            switch(stat) {
                                                case 0:
                                                    var splitString = currentPlayer.stats[0].split("/");
                                                    passCompletions = parseInt(splitString[0]);
                                                    passAttempts = parseInt(splitString[1]);
                                                    passYards = parseInt(currentPlayer.stats[1]);
                                                    passYardsPerAttempt = parseFloat(currentPlayer.stats[2]);
                                                    passTouchdowns = parseInt(currentPlayer.stats[3]);
                                                    passInterceptions = parseInt(currentPlayer.stats[4]);
                                                    splitString = currentPlayer.stats[5].split("-");
                                                    passSacks = parseInt(splitString[0]);
                                                    passSackYards = parseInt(splitString[1]);
                                                    adjustedQBR = parseFloat(currentPlayer.stats[6]);
                                                    passerRating = parseFloat(currentPlayer.stats[7]);
                                                    break;
                                                case 1:
                                                    rushAttempts = parseInt(currentPlayer.stats[0]);
                                                    rushYards = parseInt(currentPlayer.stats[1]);
                                                    rushYardsPerAttempt = parseFloat(currentPlayer.stats[2]);
                                                    rushTouchdowns = parseInt(currentPlayer.stats[3]);
                                                    longestRush = parseInt(currentPlayer.stats[4]);
                                                    break;
                                                case 2:
                                                    receptions = parseInt(currentPlayer.stats[0]);
                                                    receivingYards = parseInt(currentPlayer.stats[1]);
                                                    receivingYardsPerReception = parseFloat(currentPlayer.stats[2]);
                                                    receivingTouchdowns = parseInt(currentPlayer.stats[3]);
                                                    longestReception = parseInt(currentPlayer.stats[4]);
                                                    receivingTargets = parseInt(currentPlayer.stats[5]);
                                                    break;
                                                case 3:
                                                    fumbles = parseInt(currentPlayer.stats[0]);
                                                    fumblesLost = parseInt(currentPlayer.stats[1]);
                                                    fumblesRecovered = parseInt(currentPlayer.stats[2]);
                                                    break;
                                                case 4:
                                                    tackles = parseInt(currentPlayer.stats[0]);
                                                    tacklesSolo = parseInt(currentPlayer.stats[1]);
                                                    sacks = parseInt(currentPlayer.stats[2]);
                                                    tacklesForLoss = parseInt(currentPlayer.stats[3]);
                                                    passesDefended = parseInt(currentPlayer.stats[4]);
                                                    quarterbackHits = parseInt(currentPlayer.stats[5]);
                                                    defensiveTouchdowns = parseInt(currentPlayer.stats[6]);
                                                    break;
                                                case 5:
                                                    interceptions = parseInt(currentPlayer.stats[0]);
                                                    interceptionReturnYards = parseInt(currentPlayer.stats[1]);
                                                    interceptionReturnTouchdowns = parseInt(currentPlayer.stats[2]);
                                                    break;
                                                case 6:
                                                    kickoffReturns = parseInt(currentPlayer.stats[0]);
                                                    kickoffReturnYards = parseInt(currentPlayer.stats[1]);
                                                    kickoffReturnYardsPerAttempt = parseFloat(currentPlayer.stats[2]);
                                                    longestKickoffReturn = parseInt(currentPlayer.stats[3]);
                                                    kickoffReturnTouchdowns = parseInt(currentPlayer.stats[4]);
                                                    break;
                                                case 7:
                                                    puntReturns = parseInt(currentPlayer.stats[0]);
                                                    puntReturnYards = parseInt(currentPlayer.stats[1]);
                                                    puntReturnYardsPerAttempt = parseFloat(currentPlayer.stats[2]);
                                                    longestPuntReturn = parseInt(currentPlayer.stats[3]);
                                                    puntReturnTouchdowns = parseInt(currentPlayer.stats[4]);
                                                    break;
                                                case 8:
                                                    var splitString = currentPlayer.stats[0].split("/");
                                                    fieldGoalsMade = parseInt(splitString[0]);
                                                    fieldGoalsAttempted = parseInt(splitString[1]);
                                                    fieldGoalPercentage = parseFloat(currentPlayer.stats[1]);
                                                    longestFieldGoal = parseInt(currentPlayer.stats[2]);
                                                    splitString = currentPlayer.stats[3].split("/");
                                                    extraPointsMade = parseInt(splitString[0]);
                                                    extraPointsAttempted = parseInt(splitString[1]);
                                                    kickingPoints = parseInt(currentPlayer.stats[4]);
                                                    break;
                                                case 9:
                                                    punts = parseInt(currentPlayer.stats[0]);
                                                    puntYards = parseInt(currentPlayer.stats[1]);
                                                    puntYardsPerAttempt = parseFloat(currentPlayer.stats[2]);
                                                    puntTouchbacks = parseInt(currentPlayer.stats[3]);
                                                    puntsInside20 = parseInt(currentPlayer.stats[4]);
                                                    longestPunt = parseInt(currentPlayer.stats[5]);
                                                    break;
                                            }
                                        }
                                    }
                                }

                                statList.push({
                                    playerID: currentPlayerID,
                                    teamID: teamID,
                                    oppID: oppID, 
                                    passCompletions: passCompletions,
                                    passAttempts: passAttempts,
                                    passYards: passYards,
                                    passYardsPerAttempt: passYardsPerAttempt,
                                    passTouchdowns: passTouchdowns,
                                    passInterceptions: passInterceptions,
                                    passSacks: passSacks,
                                    passSackYards: passSackYards,
                                    adjustedQBR: adjustedQBR,
                                    passerRating: passerRating,
                                    rushAttempts: rushAttempts,
                                    rushYards: rushYards,
                                    rushYardsPerAttempt: rushYardsPerAttempt,
                                    rushTouchdowns: rushTouchdowns,
                                    longestRush: longestRush,
                                    receptions: receptions,
                                    receivingYards: receivingYards,
                                    receivingYardsPerReception: receivingYardsPerReception,
                                    receivingTouchdowns: receivingTouchdowns,
                                    longestReception: longestReception,
                                    receivingTargets: receivingTargets,
                                    fumbles: fumbles,
                                    fumblesLost: fumblesLost,
                                    fumblesRecovered: fumblesRecovered,
                                    tackles: tackles,
                                    tacklesSolo: tacklesSolo,
                                    sacks: sacks,
                                    tacklesForLoss: tacklesForLoss,
                                    passesDefended: passesDefended,
                                    quarterbackHits: quarterbackHits,
                                    defensiveTouchdowns: defensiveTouchdowns,
                                    interceptions: interceptions,
                                    interceptionReturnYards: interceptionReturnYards,
                                    interceptionReturnTouchdowns: interceptionReturnTouchdowns,
                                    kickoffReturns: kickoffReturns,
                                    kickoffReturnYards: kickoffReturnYards,
                                    kickoffReturnYardsPerAttempt: kickoffReturnYardsPerAttempt,
                                    longestKickoffReturn: longestKickoffReturn,
                                    kickoffReturnTouchdowns: kickoffReturnTouchdowns,
                                    puntReturns: puntReturns,
                                    puntReturnYards: puntReturnYards,
                                    puntReturnYardsPerAttempt: puntReturnYardsPerAttempt,
                                    longestPuntReturn: longestPuntReturn,
                                    puntReturnTouchdowns: puntReturnTouchdowns,
                                    fieldGoalsMade: fieldGoalsMade,
                                    fieldGoalsAttempted: fieldGoalsAttempted,
                                    fieldGoalPercentage: fieldGoalPercentage,
                                    longestFieldGoal: longestFieldGoal,
                                    extraPointsMade: extraPointsMade,
                                    extraPointsAttempted: extraPointsAttempted,
                                    kickingPoints: kickingPoints,
                                    punts: punts,
                                    puntYards: puntYards,
                                    puntYardsPerAttempt: puntYardsPerAttempt,
                                    puntTouchbacks: puntTouchbacks,
                                    puntsInside20: puntsInside20,
                                    longestPunt: longestPunt
                                });
                            }
                        }
                    } catch (error){
                        console.error("Error fetching data");
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching data");
        }
    }

    // Write live scoring data to file
    var fs = require('fs');
    fs.writeFile('./data/liveScoring.json', JSON.stringify(gameList), (err) => {
        if(err) console.log(err);
    });

    // Sort stats
    statList.sort((a, b) => a.playerID - b.playerID);

    // Write box score stat data
    fs.writeFile('./data/boxScores.json', JSON.stringify(statList), (err) => {
        if(err) console.log(err);
    });

    // Combine stats by team/player and update data pages
    updatePlayerStats(statList);
    updateTeamStats(statList, gameList);
    updateTeamAllowedStats(statList, gameList);
}

function updatePlayerStats(statList) {
    // Create new list to store combined stats
    var newStatList = [];   

    // Iterate through statList to get unique playerIDs
    var playerList = [];
    for(var i = 0; i < statList.length; i++) {
        if(!playerList.includes(statList[i].playerID)) {
            playerList.push(statList[i].playerID);
        }
    }

    // Total stats for each player
    for(var i = 0; i < playerList.length; i++) {
        var teamID = null;
        var gamesPlayed = 0;
        var passCompletions = 0;
        var passAttempts = 0;
        var passYards = 0;
        var passYardsPerAttempt = 0;
        var passTouchdowns = 0;
        var passInterceptions = 0;
        var passSacks = 0;
        var passSackYards = 0;
        var passerRating = 0;
        var rushAttempts = 0;
        var rushYards = 0;
        var rushYardsPerAttempt = 0;
        var rushTouchdowns = 0;
        var longestRush = 0;
        var receptions = 0;
        var receivingYards = 0;
        var receivingYardsPerReception = 0;
        var receivingTouchdowns = 0;
        var longestReception = 0;
        var receivingTargets = 0;
        var fumbles = 0;
        var fumblesLost = 0;
        var fumblesRecovered = 0;
        var tackles = 0;
        var tacklesSolo = 0;
        var sacks = 0;
        var tacklesForLoss = 0;
        var passesDefended = 0;
        var quarterbackHits = 0;
        var defensiveTouchdowns = 0;
        var interceptions = 0;
        var interceptionReturnYards = 0;
        var interceptionReturnTouchdowns = 0;
        var kickoffReturns = 0;
        var kickoffReturnYards = 0;
        var kickoffReturnYardsPerAttempt = 0;
        var longestKickoffReturn = 0;
        var kickoffReturnTouchdowns = 0;
        var puntReturns = 0;
        var puntReturnYards = 0;
        var puntReturnYardsPerAttempt = 0;
        var longestPuntReturn = 0;
        var puntReturnTouchdowns = 0;
        var fieldGoalsMade = 0;
        var fieldGoalsAttempted = 0;
        var fieldGoalPercentage = 0;
        var longestFieldGoal = 0;
        var extraPointsAttempted = 0;
        var extraPointsMade = 0;
        var kickingPoints = 0;
        var punts = 0;
        var puntYards = 0;
        var puntYardsPerAttempt = 0;
        var puntTouchbacks = 0;
        var puntsInside20 = 0;
        var longestPunt = 0;

        // Iterate through statList
        for(var j = 0; j < statList.length; j++) {
            if(statList[j].playerID === playerList[i]) {
                teamID = statList[j].teamID;
                gamesPlayed += 1;
                passCompletions += parseInt(statList[j].passCompletions);
                passAttempts += parseInt(statList[j].passAttempts);
                passYards += parseInt(statList[j].passYards);
                passTouchdowns += parseInt(statList[j].passTouchdowns);
                passInterceptions += parseInt(statList[j].passInterceptions);
                passSacks += parseInt(statList[j].passSacks);
                passSackYards += parseInt(statList[j].passSackYards);
                rushAttempts += parseInt(statList[j].rushAttempts);
                rushYards += parseInt(statList[j].rushYards);
                rushTouchdowns += parseInt(statList[j].rushTouchdowns);
                if(parseInt(statList[j].longestRush) > parseInt(longestRush)) longestRush = statList[j].longestRush;
                receptions += parseInt(statList[j].receptions);
                receivingYards += parseInt(statList[j].receivingYards);
                receivingTouchdowns += parseInt(statList[j].receivingTouchdowns);
                receivingTargets += parseInt(statList[j].receivingTargets);
                if(parseInt(statList[j].longestReception) > parseInt(longestReception)) longestReception = statList[j].longestReception;
                fumbles += parseInt(statList[j].fumbles);
                fumblesLost += parseInt(statList[j].fumblesLost);
                fumblesRecovered += parseInt(statList[j].fumblesRecovered);
                tackles += parseInt(statList[j].tackles);
                tacklesSolo += parseInt(statList[j].tacklesSolo);
                sacks += parseInt(statList[j].sacks);
                tacklesForLoss += parseInt(statList[j].tacklesForLoss);
                passesDefended += parseInt(statList[j].passesDefended);
                quarterbackHits += parseInt(statList[j].quarterbackHits);
                defensiveTouchdowns += parseInt(statList[j].defensiveTouchdowns);
                interceptions += parseInt(statList[j].interceptions);
                interceptionReturnYards += parseInt(statList[j].interceptionReturnYards);
                interceptionReturnTouchdowns += parseInt(statList[j].interceptionReturnTouchdowns);
                kickoffReturns += parseInt(statList[j].kickoffReturns);
                kickoffReturnYards += parseInt(statList[j].kickoffReturnYards);
                kickoffReturnTouchdowns += parseInt(statList[j].kickoffReturnTouchdowns);
                if(parseInt(statList[j].longestKickoffReturn) > parseInt(longestKickoffReturn)) longestKickoffReturn = statList[j].longestKickoffReturn;
                puntReturns += parseInt(statList[j].puntReturns);
                puntReturnYards += parseInt(statList[j].puntReturnYards);
                puntReturnTouchdowns += parseInt(statList[j].puntReturnTouchdowns);
                if(parseInt(statList[j].longestPuntReturn) > parseInt(longestPuntReturn)) longestPuntReturn = statList[j].longestPuntReturn;
                fieldGoalsMade += parseInt(statList[j].fieldGoalsMade);
                fieldGoalsAttempted += parseInt(statList[j].fieldGoalsAttempted);
                if(parseInt(statList[j].longestFieldGoal) > parseInt(longestFieldGoal)) longestFieldGoal = statList[j].longestFieldGoal;
                extraPointsMade += parseInt(statList[j].extraPointsMade);
                extraPointsAttempted += parseInt(statList[j].extraPointsAttempted);
                kickingPoints += parseInt(statList[j].kickingPoints);
                punts += parseInt(statList[j].punts);
                puntYards += parseInt(statList[j].puntYards);
                puntTouchbacks += parseInt(statList[j].puntTouchbacks);
                puntsInside20 += parseInt(statList[j].puntsInside20);
                if(parseInt(statList[j].longestPunt) > parseInt(longestPunt)) longestPunt = statList[j].longestPunt;
            }
        }

        passerRating = calculatePasserRating(parseInt(passCompletions), parseInt(passAttempts), parseInt(passYards), parseInt(passTouchdowns), parseInt(passInterceptions));

        if(passAttempts === 0) { passYardsPerAttempt = 0.0; } else { passYardsPerAttempt = parseInt(passYards)/parseInt(passAttempts); }
        if(rushAttempts === 0) { rushYardsPerAttempt = 0.0; } else { rushYardsPerAttempt = parseInt(rushYards)/parseInt(rushAttempts); }
        if(receptions === 0) { receivingYardsPerReception = 0.0; } else { receivingYardsPerReception = parseInt(receivingYards)/parseInt(receptions); }
        if(kickoffReturns === 0) { kickoffReturnYardsPerAttempt = 0.0; } else { kickoffReturnYardsPerAttempt = parseInt(kickoffReturnYards)/parseInt(kickoffReturns); }
        if(puntReturns === 0) { puntReturnYardsPerAttempt = 0.0; } else { puntReturnYardsPerAttempt = parseInt(puntReturnYards)/parseInt(puntReturns); }
        if(fieldGoalsAttempted === 0) { fieldGoalPercentage = 0.0; } else { fieldGoalPercentage = parseInt(fieldGoalsMade)/parseInt(fieldGoalsAttempted); }
        if(punts === 0) { puntYardsPerAttempt = 0.0; } else { puntYardsPerAttempt = parseInt(puntYards)/parseInt(punts); }

        newStatList.push({
            "Player ID": playerList[i],
            "Team ID": teamID,
            "GP": gamesPlayed, 
            "Com": passCompletions,
            "Att": passAttempts,
            "Pass Yds": passYards,
            "Pass Yds/Att": passYardsPerAttempt.toFixed(1),
            "Pass TD": passTouchdowns,
            "Int Pass": passInterceptions,
            "Sacked": passSacks,
            "Yards Lost": passSackYards,
            "Rating": passerRating,
            "Rsh": rushAttempts,
            "Rsh Yds": rushYards,
            "Rsh Yds/Att": rushYardsPerAttempt.toFixed(1),
            "Rsh TD": rushTouchdowns,
            "Rsh Long": longestRush,
            "Rec": receptions,
            "Tgt": receivingTargets,
            "Rec Yds": receivingYards,
            "YPC": receivingYardsPerReception.toFixed(1),
            "Rec TD": receivingTouchdowns,
            "Rec Long": longestReception,
            "Fumble": fumbles,
            "Lost": fumblesLost,
            "Recovered": fumblesRecovered,
            "Tkl": tackles,
            "Solo Tkl": tacklesSolo,
            "Sacks": sacks,
            "TFL": tacklesForLoss,
            "PD": passesDefended,
            "QB Hit": quarterbackHits,
            "Def TD": defensiveTouchdowns,
            "Int": interceptions,
            "Int Yds": interceptionReturnYards,
            "Int TD": interceptionReturnTouchdowns,
            "KO Ret": kickoffReturns,
            "KO Ret Yds": kickoffReturnYards,
            "KO Ret Yds/Att": kickoffReturnYardsPerAttempt.toFixed(1),
            "KO Ret Long": longestKickoffReturn,
            "KO Ret TD": kickoffReturnTouchdowns,
            "Pt Ret": puntReturns,
            "Pt Ret Yds": puntReturnYards,
            "Pt Ret Yds/Att": puntReturnYardsPerAttempt.toFixed(1),
            "Pt Ret Long": longestPuntReturn,
            "Pt Ret TD": puntReturnTouchdowns,
            "FGM": fieldGoalsMade,
            "FGA": fieldGoalsAttempted,
            "FG%": fieldGoalPercentage.toFixed(4),
            "FG Long": longestFieldGoal,
            "XPM": extraPointsMade,
            "XPA": extraPointsAttempted,
            "Kick Points": kickingPoints,
            "Punts": punts,
            "Pt Yds": puntYards,
            "Pt Yds/Att": puntYardsPerAttempt.toFixed(1),
            "Touchbacks": puntTouchbacks,
            "In20": puntsInside20,
            "Pt Long": longestPunt
        });
    }

    // Write total season player stats
    var fs = require('fs');
    fs.writeFile('./data/playerStats.json', JSON.stringify(newStatList), (err) => {
        if(err) console.log(err);
    });
}

function calculatePasserRating(cmp, att, yds, tds, int)
{
    if(att === 0) return 0.0;
    var a = passerRatingBound(5.0 * ((cmp / att) - 0.3));
    var b = passerRatingBound(0.25 * ((yds / att) - 3.0));
    var c = passerRatingBound(20.0 * (tds / att));
    var d = 2.375 - passerRatingBound(25.0 * (int / att));
    var rating = 100.0 * ((a + b + c + d) / 6.0);
    return rating.toFixed(1);
}

function passerRatingBound(num) {
    var max = 2.375;
    var min = 0.0;
    
    if(parseFloat(num) > parseFloat(max)) return max;
    if(parseFloat(num) < parseFloat(min)) return min;
    return num;
}

async function updateTeams() {
    // Create result array
    var teamList = [];

    // Set the JSON URL for the current week
    var url = TEAMS_URL;

    // Fetch the JSON data
    try {
        const response = await fetch(url);
        const data = await response.json();
        var teams = data.sports[0].leagues[0].teams;

        for(var team = 0; team < teams.length; team++) {
            // Set current team
            var currentTeam = teams[team].team;

            // Get current team details
            var teamID = currentTeam.id;
            var teamName = currentTeam.displayName;
            var teamAbbreviation = currentTeam.abbreviation;
            var teamColor = "#" + currentTeam.color;
            var teamLogo = currentTeam.logos[0].href;
            var division = getDivision(teamID);

            // Add the current team details to the result array
            teamList.push({"ID": teamID, "Abbr": teamAbbreviation, "Name": teamName, "Color": teamColor, "Logo": teamLogo, "Division": division});
        }
    } catch (error) {
        console.error("Error fetching data");
    }

    // Sort team list
    teamList.sort((a, b) => a.teamID - b.teamID);

    // Write list to file
    var fs = require('fs');
    fs.writeFile('./data/teamList.json', JSON.stringify(teamList), (err) => {
        if(err) console.log(err);
    });
}

async function updateDepthCharts() {
    // Get teamID list
    var fs = require('fs');
    const rawData = await fs.readFileSync('./data/teamList.json', 'utf-8');
    const teamList = JSON.parse(rawData);     

    // Setup depth chart array
    var depthCharts = [];

    // Iterate through team ids
    for(const team in teamList) {
        // Setup URL
        var teamID = teamList[team].ID;
        var url = DEPTH_CHART_URL + SEASON + "/teams/" + teamID + "/depthcharts";

        // Fetch the JSON
        const response = await fetch(url);
        const data = await response.json();

        // Iterate through units (Currently 0 = defense, 1 = special teams, 2 = offense)
        for(var i = 0; i < data.items.length; i++){
            // Shortcut to positions in unit
            var unit = data.items[i].positions;

            // Iterate through each position
            for(const pos in unit) {
                // Get position name
                var position = unit[pos].position.abbreviation;

                // Initialize JSON object for row
                var row = { 'Team': teamID, 'Position': position, 'First': null, 'Second': null, 'Third': null, 'Fourth': null, 'Fifth': null };

                for(var ath = 0; ath < unit[pos].athletes.length; ath++){
                    // Grab reference link, parse to get ID from link
                    var currentAthleteLink = unit[pos].athletes[ath].athlete['$ref'];
                    var playerID = currentAthleteLink.split("/")[11].split('?')[0];

                    // Set rank header
                    switch(ath) {
                        case 0: var rank = "First"; break;
                        case 1: var rank = "Second"; break;
                        case 2: var rank = "Third"; break;
                        case 3: var rank = "Fourth"; break;
                        case 4: var rank = "Fifth"; break;
                        default: var rank = "X";
                    }

                    // Players should be sorted by rank. Add JSON key for current rank with value of playerID
                    row[rank] = playerID;
                }

                depthCharts.push(row);
            }
        }
    }

    await fs.writeFile('./data/depthCharts.json', JSON.stringify(depthCharts), (err) => {
        if(err) console.log(err);
    });
}

function updateTeamStats(statList, gameData) {
    // Create new list to store combined stats
    var newStatList = [];   

    // Iterate through statList to get unique teamIDs
    var teamList = [];
    for(var i = 0; i < statList.length; i++) {
        if(!teamList.includes(statList[i].teamID)) {
            teamList.push(statList[i].teamID);
        }
    }

    // Total stats for each team
    for(var i = 0; i < teamList.length; i++) {
        var gamesPlayed = 0;
        var pointsFor = 0;
        var pointsAgainst = 0;
        var passCompletions = 0;
        var passAttempts = 0;
        var passYards = 0;
        var passYardsPerAttempt = 0;
        var passTouchdowns = 0;
        var passInterceptions = 0;
        var passSacks = 0;
        var passSackYards = 0;
        var passerRating = 0;
        var rushAttempts = 0;
        var rushYards = 0;
        var rushYardsPerAttempt = 0;
        var rushTouchdowns = 0;
        var longestRush = 0;
        var receptions = 0;
        var receivingYards = 0;
        var receivingYardsPerReception = 0;
        var receivingTouchdowns = 0;
        var longestReception = 0;
        var receivingTargets = 0;
        var fumbles = 0;
        var fumblesLost = 0;
        var fumblesRecovered = 0;
        var tackles = 0;
        var tacklesSolo = 0;
        var sacks = 0;
        var tacklesForLoss = 0;
        var passesDefended = 0;
        var quarterbackHits = 0;
        var defensiveTouchdowns = 0;
        var interceptions = 0;
        var interceptionReturnYards = 0;
        var interceptionReturnTouchdowns = 0;
        var kickoffReturns = 0;
        var kickoffReturnYards = 0;
        var kickoffReturnYardsPerAttempt = 0;
        var longestKickoffReturn = 0;
        var kickoffReturnTouchdowns = 0;
        var puntReturns = 0;
        var puntReturnYards = 0;
        var puntReturnYardsPerAttempt = 0;
        var longestPuntReturn = 0;
        var puntReturnTouchdowns = 0;
        var fieldGoalsMade = 0;
        var fieldGoalsAttempted = 0;
        var fieldGoalPercentage = 0;
        var longestFieldGoal = 0;
        var extraPointsAttempted = 0;
        var extraPointsMade = 0;
        var kickingPoints = 0;
        var punts = 0;
        var puntYards = 0;
        var puntYardsPerAttempt = 0;
        var puntTouchbacks = 0;
        var puntsInside20 = 0;
        var longestPunt = 0;

        // Iterate through statList
        for(var j = 0; j < statList.length; j++) {
            if(statList[j].teamID === teamList[i]) {
                passCompletions += parseInt(statList[j].passCompletions);
                passAttempts += parseInt(statList[j].passAttempts);
                passYards += parseInt(statList[j].passYards);
                passTouchdowns += parseInt(statList[j].passTouchdowns);
                passInterceptions += parseInt(statList[j].passInterceptions);
                passSacks += parseInt(statList[j].passSacks);
                passSackYards += parseInt(statList[j].passSackYards);
                rushAttempts += parseInt(statList[j].rushAttempts);
                rushYards += parseInt(statList[j].rushYards);
                rushTouchdowns += parseInt(statList[j].rushTouchdowns);
                if(parseInt(statList[j].longestRush) > parseInt(longestRush)) longestRush = statList[j].longestRush;
                receptions += parseInt(statList[j].receptions);
                receivingYards += parseInt(statList[j].receivingYards);
                receivingTouchdowns += parseInt(statList[j].receivingTouchdowns);
                receivingTargets += parseInt(statList[j].receivingTargets);
                if(parseInt(statList[j].longestReception) > parseInt(longestReception)) longestReception = statList[j].longestReception;
                fumbles += parseInt(statList[j].fumbles);
                fumblesLost += parseInt(statList[j].fumblesLost);
                fumblesRecovered += parseInt(statList[j].fumblesRecovered);
                tackles += parseInt(statList[j].tackles);
                tacklesSolo += parseInt(statList[j].tacklesSolo);
                sacks += parseInt(statList[j].sacks);
                tacklesForLoss += parseInt(statList[j].tacklesForLoss);
                passesDefended += parseInt(statList[j].passesDefended);
                quarterbackHits += parseInt(statList[j].quarterbackHits);
                defensiveTouchdowns += parseInt(statList[j].defensiveTouchdowns);
                interceptions += parseInt(statList[j].interceptions);
                interceptionReturnYards += parseInt(statList[j].interceptionReturnYards);
                interceptionReturnTouchdowns += parseInt(statList[j].interceptionReturnTouchdowns);
                kickoffReturns += parseInt(statList[j].kickoffReturns);
                kickoffReturnYards += parseInt(statList[j].kickoffReturnYards);
                kickoffReturnTouchdowns += parseInt(statList[j].kickoffReturnTouchdowns);
                if(parseInt(statList[j].longestKickoffReturn) > parseInt(longestKickoffReturn)) longestKickoffReturn = statList[j].longestKickoffReturn;
                puntReturns += parseInt(statList[j].puntReturns);
                puntReturnYards += parseInt(statList[j].puntReturnYards);
                puntReturnTouchdowns += parseInt(statList[j].puntReturnTouchdowns);
                if(parseInt(statList[j].longestPuntReturn) > parseInt(longestPuntReturn)) longestPuntReturn = statList[j].longestPuntReturn;
                fieldGoalsMade += parseInt(statList[j].fieldGoalsMade);
                fieldGoalsAttempted += parseInt(statList[j].fieldGoalsAttempted);
                if(parseInt(statList[j].longestFieldGoal) > parseInt(longestFieldGoal)) longestFieldGoal = statList[j].longestFieldGoal;
                extraPointsMade += parseInt(statList[j].extraPointsMade);
                extraPointsAttempted += parseInt(statList[j].extraPointsAttempted);
                kickingPoints += parseInt(statList[j].kickingPoints);
                punts += parseInt(statList[j].punts);
                puntYards += parseInt(statList[j].puntYards);
                puntTouchbacks += parseInt(statList[j].puntTouchbacks);
                puntsInside20 += parseInt(statList[j].puntsInside20);
                if(parseInt(statList[j].longestPunt) > parseInt(longestPunt)) longestPunt = statList[j].longestPunt;
            }
        }

        passerRating = calculatePasserRating(parseInt(passCompletions), parseInt(passAttempts), parseInt(passYards), parseInt(passTouchdowns), parseInt(passInterceptions));

        if(passAttempts === 0) { passYardsPerAttempt = 0.0; } else { passYardsPerAttempt = parseInt(passYards)/parseInt(passAttempts); }
        if(rushAttempts === 0) { rushYardsPerAttempt = 0.0; } else { rushYardsPerAttempt = parseInt(rushYards)/parseInt(rushAttempts); }
        if(receptions === 0) { receivingYardsPerReception = 0.0; } else { receivingYardsPerReception = parseInt(receivingYards)/parseInt(receptions); }
        if(kickoffReturns === 0) { kickoffReturnYardsPerAttempt = 0.0; } else { kickoffReturnYardsPerAttempt = parseInt(kickoffReturnYards)/parseInt(kickoffReturns); }
        if(puntReturns === 0) { puntReturnYardsPerAttempt = 0.0; } else { puntReturnYardsPerAttempt = parseInt(puntReturnYards)/parseInt(puntReturns); }
        if(fieldGoalsAttempted === 0) { fieldGoalPercentage = 0.0; } else { fieldGoalPercentage = parseInt(fieldGoalsMade)/parseInt(fieldGoalsAttempted); }
        if(punts === 0) { puntYardsPerAttempt = 0.0; } else { puntYardsPerAttempt = parseInt(puntYards)/parseInt(punts); }

        // Iterate through games
        for(var j = 0; j < gameData.length; j++){
            // Create week string for splitting and evaluating week number
            var weekString = new String(gameData[j]['Week']);

            // If week is in the range of weeks to record stats for && current team is the home team:
            // Increment gamesPlayed, add home score to pointsFor, add away score to pointsAgainst
            if( parseInt(weekString.split(' ')[1]) <= STAT_END_WEEK && gameData[j]['Home ID'] === teamList[i]) {
                gamesPlayed += 1;
                pointsFor += parseInt(gameData[j]['Home Score']);
                pointsAgainst += parseInt(gameData[j]['Away Score']);
            // Else if week is in range && current team is the away team:
            // Increment gamesPlayed, add away score to pointsFor, add home score to pointsAgainst
            } else if ( parseInt(weekString.split(' ')[1]) <= STAT_END_WEEK && gameData[j]['Away ID'] === teamList[i]) {
                gamesPlayed += 1;
                pointsFor += parseInt(gameData[j]['Away Score']);
                pointsAgainst += parseInt(gameData[j]['Home Score']);
            }
        }

        // Push stats to array
        newStatList.push({
            "Team ID": teamList[i],
            "GP": gamesPlayed,
            "PF": pointsFor,
            "PA": pointsAgainst,
            "Com": passCompletions,
            "Att": passAttempts,
            "Pass Yds": passYards,
            "Pass Yds/Att": passYardsPerAttempt.toFixed(1),
            "Pass TD": passTouchdowns,
            "Int Pass": passInterceptions,
            "Sacked": passSacks,
            "Yards Lost": passSackYards,
            "Rating": passerRating,
            "Rsh": rushAttempts,
            "Rsh Yds": rushYards,
            "Rsh Yds/Att": rushYardsPerAttempt.toFixed(1),
            "Rsh TD": rushTouchdowns,
            "Rsh Long": longestRush,
            "Rec": receptions,
            "Tgt": receivingTargets,
            "Rec Yds": receivingYards,
            "YPC": receivingYardsPerReception.toFixed(1),
            "Rec TD": receivingTouchdowns,
            "Rec Long": longestReception,
            "Fumble": fumbles,
            "Lost": fumblesLost,
            "Recovered": fumblesRecovered,
            "Tkl": tackles,
            "Solo Tkl": tacklesSolo,
            "Sacks": sacks,
            "TFL": tacklesForLoss,
            "PD": passesDefended,
            "QB Hit": quarterbackHits,
            "Def TD": defensiveTouchdowns,
            "Int": interceptions,
            "Int Yds": interceptionReturnYards,
            "Int TD": interceptionReturnTouchdowns,
            "KO Ret": kickoffReturns,
            "KO Ret Yds": kickoffReturnYards,
            "KO Ret Yds/Att": kickoffReturnYardsPerAttempt.toFixed(1),
            "KO Ret Long": longestKickoffReturn,
            "KO Ret TD": kickoffReturnTouchdowns,
            "Pt Ret": puntReturns,
            "Pt Ret Yds": puntReturnYards,
            "Pt Ret Yds/Att": puntReturnYardsPerAttempt.toFixed(1),
            "Pt Ret Long": longestPuntReturn,
            "Pt Ret TD": puntReturnTouchdowns,
            "FGM": fieldGoalsMade,
            "FGA": fieldGoalsAttempted,
            "FG%": fieldGoalPercentage.toFixed(4),
            "FG Long": longestFieldGoal,
            "XPM": extraPointsMade,
            "XPA": extraPointsAttempted,
            "Kick Points": kickingPoints,
            "Punts": punts,
            "Pt Yds": puntYards,
            "Pt Yds/Att": puntYardsPerAttempt.toFixed(1),
            "Touchbacks": puntTouchbacks,
            "In20": puntsInside20,
            "Pt Long": longestPunt
        });
    }

    // Sort by team ID
    newStatList.sort((a, b) => a['Team ID'] - b['Team ID']);

    // Write team stats to file
    var fs = require('fs');
    fs.writeFile('./data/teamStats.json', JSON.stringify(newStatList), (err) => {
        if(err) console.log(err);
    });
}

function updateTeamAllowedStats(statList, gameData) {
    // Create new list to store combined stats
    var newStatList = [];   

    // Iterate through statList to get unique teamIDs
    var teamList = [];
    for(var i = 0; i < statList.length; i++) {
        if(!teamList.includes(statList[i].oppID)) {
            teamList.push(statList[i].oppID);
        }
    }

    // Total stats for each team. For the sake of this function, all of these are stats allowed
    for(var i = 0; i < teamList.length; i++) {
        var gamesPlayed = 0;
        var pointsFor = 0;
        var pointsAgainst = 0;
        var passCompletions = 0;
        var passAttempts = 0;
        var passYards = 0;
        var passYardsPerAttempt = 0;
        var passTouchdowns = 0;
        var passInterceptions = 0;
        var passSacks = 0;
        var passSackYards = 0;
        var passerRating = 0;
        var rushAttempts = 0;
        var rushYards = 0;
        var rushYardsPerAttempt = 0;
        var rushTouchdowns = 0;
        var longestRush = 0;
        var receptions = 0;
        var receivingYards = 0;
        var receivingYardsPerReception = 0;
        var receivingTouchdowns = 0;
        var longestReception = 0;
        var receivingTargets = 0;
        var fumbles = 0;
        var fumblesLost = 0;
        var fumblesRecovered = 0;
        var tackles = 0;
        var tacklesSolo = 0;
        var sacks = 0;
        var tacklesForLoss = 0;
        var passesDefended = 0;
        var quarterbackHits = 0;
        var defensiveTouchdowns = 0;
        var interceptions = 0;
        var interceptionReturnYards = 0;
        var interceptionReturnTouchdowns = 0;
        var kickoffReturns = 0;
        var kickoffReturnYards = 0;
        var kickoffReturnYardsPerAttempt = 0;
        var longestKickoffReturn = 0;
        var kickoffReturnTouchdowns = 0;
        var puntReturns = 0;
        var puntReturnYards = 0;
        var puntReturnYardsPerAttempt = 0;
        var longestPuntReturn = 0;
        var puntReturnTouchdowns = 0;
        var fieldGoalsMade = 0;
        var fieldGoalsAttempted = 0;
        var fieldGoalPercentage = 0;
        var longestFieldGoal = 0;
        var extraPointsAttempted = 0;
        var extraPointsMade = 0;
        var kickingPoints = 0;
        var punts = 0;
        var puntYards = 0;
        var puntYardsPerAttempt = 0;
        var puntTouchbacks = 0;
        var puntsInside20 = 0;
        var longestPunt = 0;

        // Iterate through statList
        for(var j = 0; j < statList.length; j++) {
            if(statList[j].oppID === teamList[i]) {
                passCompletions += parseInt(statList[j].passCompletions);
                passAttempts += parseInt(statList[j].passAttempts);
                passYards += parseInt(statList[j].passYards);
                passTouchdowns += parseInt(statList[j].passTouchdowns);
                passInterceptions += parseInt(statList[j].passInterceptions);
                passSacks += parseInt(statList[j].passSacks);
                passSackYards += parseInt(statList[j].passSackYards);
                rushAttempts += parseInt(statList[j].rushAttempts);
                rushYards += parseInt(statList[j].rushYards);
                rushTouchdowns += parseInt(statList[j].rushTouchdowns);
                if(parseInt(statList[j].longestRush) > parseInt(longestRush)) longestRush = statList[j].longestRush;
                receptions += parseInt(statList[j].receptions);
                receivingYards += parseInt(statList[j].receivingYards);
                receivingTouchdowns += parseInt(statList[j].receivingTouchdowns);
                receivingTargets += parseInt(statList[j].receivingTargets);
                if(parseInt(statList[j].longestReception) > parseInt(longestReception)) longestReception = statList[j].longestReception;
                fumbles += parseInt(statList[j].fumbles);
                fumblesLost += parseInt(statList[j].fumblesLost);
                fumblesRecovered += parseInt(statList[j].fumblesRecovered);
                tackles += parseInt(statList[j].tackles);
                tacklesSolo += parseInt(statList[j].tacklesSolo);
                sacks += parseInt(statList[j].sacks);
                tacklesForLoss += parseInt(statList[j].tacklesForLoss);
                passesDefended += parseInt(statList[j].passesDefended);
                quarterbackHits += parseInt(statList[j].quarterbackHits);
                defensiveTouchdowns += parseInt(statList[j].defensiveTouchdowns);
                interceptions += parseInt(statList[j].interceptions);
                interceptionReturnYards += parseInt(statList[j].interceptionReturnYards);
                interceptionReturnTouchdowns += parseInt(statList[j].interceptionReturnTouchdowns);
                kickoffReturns += parseInt(statList[j].kickoffReturns);
                kickoffReturnYards += parseInt(statList[j].kickoffReturnYards);
                kickoffReturnTouchdowns += parseInt(statList[j].kickoffReturnTouchdowns);
                if(parseInt(statList[j].longestKickoffReturn) > parseInt(longestKickoffReturn)) longestKickoffReturn = statList[j].longestKickoffReturn;
                puntReturns += parseInt(statList[j].puntReturns);
                puntReturnYards += parseInt(statList[j].puntReturnYards);
                puntReturnTouchdowns += parseInt(statList[j].puntReturnTouchdowns);
                if(parseInt(statList[j].longestPuntReturn) > parseInt(longestPuntReturn)) longestPuntReturn = statList[j].longestPuntReturn;
                fieldGoalsMade += parseInt(statList[j].fieldGoalsMade);
                fieldGoalsAttempted += parseInt(statList[j].fieldGoalsAttempted);
                if(parseInt(statList[j].longestFieldGoal) > parseInt(longestFieldGoal)) longestFieldGoal = statList[j].longestFieldGoal;
                extraPointsMade += parseInt(statList[j].extraPointsMade);
                extraPointsAttempted += parseInt(statList[j].extraPointsAttempted);
                kickingPoints += parseInt(statList[j].kickingPoints);
                punts += parseInt(statList[j].punts);
                puntYards += parseInt(statList[j].puntYards);
                puntTouchbacks += parseInt(statList[j].puntTouchbacks);
                puntsInside20 += parseInt(statList[j].puntsInside20);
                if(parseInt(statList[j].longestPunt) > parseInt(longestPunt)) longestPunt = statList[j].longestPunt;
            }
        }

        passerRating = calculatePasserRating(parseInt(passCompletions), parseInt(passAttempts), parseInt(passYards), parseInt(passTouchdowns), parseInt(passInterceptions));

        if(passAttempts === 0) { passYardsPerAttempt = 0.0; } else { passYardsPerAttempt = parseInt(passYards)/parseInt(passAttempts); }
        if(rushAttempts === 0) { rushYardsPerAttempt = 0.0; } else { rushYardsPerAttempt = parseInt(rushYards)/parseInt(rushAttempts); }
        if(receptions === 0) { receivingYardsPerReception = 0.0; } else { receivingYardsPerReception = parseInt(receivingYards)/parseInt(receptions); }
        if(kickoffReturns === 0) { kickoffReturnYardsPerAttempt = 0.0; } else { kickoffReturnYardsPerAttempt = parseInt(kickoffReturnYards)/parseInt(kickoffReturns); }
        if(puntReturns === 0) { puntReturnYardsPerAttempt = 0.0; } else { puntReturnYardsPerAttempt = parseInt(puntReturnYards)/parseInt(puntReturns); }
        if(fieldGoalsAttempted === 0) { fieldGoalPercentage = 0.0; } else { fieldGoalPercentage = parseInt(fieldGoalsMade)/parseInt(fieldGoalsAttempted); }
        if(punts === 0) { puntYardsPerAttempt = 0.0; } else { puntYardsPerAttempt = parseInt(puntYards)/parseInt(punts); }

        // Iterate through games
        for(var j = 0; j < gameData.length; j++){
            // Create week string for splitting and evaluating week number
            var weekString = new String(gameData[j]['Week']);

            // If week is in the range of weeks to record stats for && current team is the home team:
            // Increment gamesPlayed, add home score to pointsFor, add away score to pointsAgainst
            if( parseInt(weekString.split(' ')[1]) <= STAT_END_WEEK && gameData[j]['Home ID'] === teamList[i]) {
                gamesPlayed += 1;
                pointsFor += parseInt(gameData[j]['Away Score']);
                pointsAgainst += parseInt(gameData[j]['Home Score']);
            // Else if week is in range && current team is the away team:
            // Increment gamesPlayed, add away score to pointsFor, add home score to pointsAgainst
            } else if ( parseInt(weekString.split(' ')[1]) <= STAT_END_WEEK && gameData[j]['Away ID'] === teamList[i]) {
                gamesPlayed += 1;
                pointsFor += parseInt(gameData[j]['Home Score']);
                pointsAgainst += parseInt(gameData[j]['Away Score']);
            }
        }

        // Push stats to array
        newStatList.push({
            "Team ID": teamList[i],
            "GP": gamesPlayed,
            "PF": pointsFor,
            "PA": pointsAgainst,
            "Com": passCompletions,
            "Att": passAttempts,
            "Pass Yds": passYards,
            "Pass Yds/Att": passYardsPerAttempt.toFixed(1),
            "Pass TD": passTouchdowns,
            "Int Pass": passInterceptions,
            "Sacked": passSacks,
            "Yards Lost": passSackYards,
            "Rating": passerRating,
            "Rsh": rushAttempts,
            "Rsh Yds": rushYards,
            "Rsh Yds/Att": rushYardsPerAttempt.toFixed(1),
            "Rsh TD": rushTouchdowns,
            "Rsh Long": longestRush,
            "Rec": receptions,
            "Tgt": receivingTargets,
            "Rec Yds": receivingYards,
            "YPC": receivingYardsPerReception.toFixed(1),
            "Rec TD": receivingTouchdowns,
            "Rec Long": longestReception,
            "Fumble": fumbles,
            "Lost": fumblesLost,
            "Recovered": fumblesRecovered,
            "Tkl": tackles,
            "Solo Tkl": tacklesSolo,
            "Sacks": sacks,
            "TFL": tacklesForLoss,
            "PD": passesDefended,
            "QB Hit": quarterbackHits,
            "Def TD": defensiveTouchdowns,
            "Int": interceptions,
            "Int Yds": interceptionReturnYards,
            "Int TD": interceptionReturnTouchdowns,
            "KO Ret": kickoffReturns,
            "KO Ret Yds": kickoffReturnYards,
            "KO Ret Yds/Att": kickoffReturnYardsPerAttempt.toFixed(1),
            "KO Ret Long": longestKickoffReturn,
            "KO Ret TD": kickoffReturnTouchdowns,
            "Pt Ret": puntReturns,
            "Pt Ret Yds": puntReturnYards,
            "Pt Ret Yds/Att": puntReturnYardsPerAttempt.toFixed(1),
            "Pt Ret Long": longestPuntReturn,
            "Pt Ret TD": puntReturnTouchdowns,
            "FGM": fieldGoalsMade,
            "FGA": fieldGoalsAttempted,
            "FG%": fieldGoalPercentage.toFixed(4),
            "FG Long": longestFieldGoal,
            "XPM": extraPointsMade,
            "XPA": extraPointsAttempted,
            "Kick Points": kickingPoints,
            "Punts": punts,
            "Pt Yds": puntYards,
            "Pt Yds/Att": puntYardsPerAttempt.toFixed(1),
            "Touchbacks": puntTouchbacks,
            "In20": puntsInside20,
            "Pt Long": longestPunt
        });
    }

    // Sort by team ID
    newStatList.sort((a, b) => a['Team ID'] - b['Team ID']);

    // Write team stats to file
    var fs = require('fs');
    fs.writeFile('./data/teamAllowedStats.json', JSON.stringify(newStatList), (err) => {
        if(err) console.log(err);
    });
}

function getDivision(teamID) {
    // Setup and load divisions json
    var fs = require('fs');
    const rawData = fs.readFileSync('./data/divisions.json', 'utf-8');
    const divisions = JSON.parse(rawData);

    var team = divisions.find(x => x['ID'] === teamID);

    return team['Conference'] + " " + team['Division'];
}

function getConference(teamID) {
    // Setup and load divisions json
    var fs = require('fs');
    const rawData = fs.readFileSync('./data/divisions.json', 'utf-8');
    const divisions = JSON.parse(rawData);

    var team = divisions.find(x => x['ID'] === teamID);

    return team['Conference'];
}

async function updateSchedules(){
    // Result array
    var schedules = [];

    // Setup file system, get gameData file
    var fs = require('fs');
    var rawData = fs.readFileSync('./data/liveScoring.json', 'utf-8');
    var gameData = JSON.parse(rawData);

    // Get teamList
    rawData = fs.readFileSync('./data/teamList.json');
    var teamList = JSON.parse(rawData);

    // Iterate through teamList to initialize json array
    for (var team in teamList) { 
        schedules.push({
            "Team ID": teamList[team].ID,
            "Week 1": null,
            "Week 2": null,
            "Week 3": null,
            "Week 4": null,
            "Week 5": null,
            "Week 6": null,
            "Week 7": null,
            "Week 8": null,
            "Week 9": null,
            "Week 10": null,
            "Week 11": null,
            "Week 12": null,
            "Week 13": null,
            "Week 14": null,
            "Week 15": null,
            "Week 16": null,
            "Week 17": null,
            "Week 18": null
        }); 
    }

    // Iterate through gameList, push game data to each included teams schedule
    for(const game in gameData){
        homeTeam = schedules.find(x => x['Team ID'] === gameData[game]['Home ID']);
        awayTeam = schedules.find(x => x['Team ID'] === gameData[game]['Away ID']);
        homeTeam[gameData[game]['Week']] = gameData[game];
        awayTeam[gameData[game]['Week']] = gameData[game];
    }

    // Write to schedule file
    fs.writeFile('./data/schedules.json', JSON.stringify(schedules), (err) => {
        if(err) console.log(err);
    });
}

function getStreak(teamID) {
    // Load schedule file
    var fs = require('fs');
    var rawData = fs.readFileSync('./data/schedules.json', 'utf-8');
    var schedules = JSON.parse(rawData);

    // Variables
    var streakType = 'W';
    var streakLength = 0;

    // Get team schedule
    var teamIndex = schedules.find(x => x['Team ID'] === teamID);

    // Iterate through schedule
    for(var week in teamIndex) {
        // Week string
        var weekNum = parseInt(week.split(' ')[1]);

        try{
            if(weekNum <= STAT_END_WEEK) {
                if(teamIndex[week]['Winner'] === teamID) {
                    if(streakType === "W") { 
                        streakLength += 1; 
                    } else {
                        streakType = "W";
                        streakLength = 1;
                    }
                } else if(teamIndex[week]['Winner'] === "Tie") {
                    if(streakType === "T") { 
                        streakLength += 1; 
                    } else {
                        streakType = "T";
                        streakLength = 1;
                    }
                } else if(teamIndex[week]['Winner'] === null) {

                } else {
                    if(streakType === "L") { 
                        streakLength += 1;
                    } else {
                        streakType = "L";
                        streakLength = 1;
                    }
                }
            }
        } catch (err) {

        }    
    }

    // Return streak in a W/L/T# format
    return streakType + streakLength;
}

async function generateStandings() {
    // Result standings array
    var standings = [];

    // Setup file system and retrieve team list
    var fs = require('fs');
    var rawData = fs.readFileSync('./data/teamList.json', 'utf-8');
    var teamList = JSON.parse(rawData);

    // Set standings data
    for(var team in teamList) {
        // Create overall record variables
        var win = getLiveScoringItem(teamList[team]['ID'], "wins", "all");
        var los = getLiveScoringItem(teamList[team]['ID'], "loss", "all");
        var tie = getLiveScoringItem(teamList[team]['ID'], "ties", "all");
        var rec = win + "-" + los + "-" + tie;
        if(!(win + los + tie === 0)) {
            var recDec = (win + tie/2)/(win + los + tie);
        } else { var recDec = 0; }
        var gp = win + los + tie;

        // Home record variables
        win = getLiveScoringItem(teamList[team]['ID'], "wins", "home");
        los = getLiveScoringItem(teamList[team]['ID'], "loss", "home");
        tie = getLiveScoringItem(teamList[team]['ID'], "ties", "home");
        var recHome = win + "-" + los + "-" + tie;
        if(!(win + los + tie === 0)) {
            var recDecHome = (win + tie/2)/(win + los + tie);
        } else { var recDecHome = 0; }

        // Away record variables
        win = getLiveScoringItem(teamList[team]['ID'], "wins", "away");
        los = getLiveScoringItem(teamList[team]['ID'], "loss", "away");
        tie = getLiveScoringItem(teamList[team]['ID'], "ties", "away");
        var recAway = win + "-" + los + "-" + tie;
        if(!(win + los + tie === 0)) {
            var recDecAway = (win + tie/2)/(win + los + tie);
        } else { var recDecAway = 0; }

        // Division record variables
        win = getLiveScoringItem(teamList[team]['ID'], "wins", "div");
        los = getLiveScoringItem(teamList[team]['ID'], "loss", "div");
        tie = getLiveScoringItem(teamList[team]['ID'], "ties", "div");
        var recDiv = win + "-" + los + "-" + tie;
        if(!(win + los + tie === 0)) {
            var recDecDiv = (win + tie/2)/(win + los + tie);
        } else { var recDecDiv = 0; }

        // Conference record variables
        win = getLiveScoringItem(teamList[team]['ID'], "wins", "conf");
        los = getLiveScoringItem(teamList[team]['ID'], "loss", "conf");
        tie = getLiveScoringItem(teamList[team]['ID'], "ties", "conf");
        var recConf = win + "-" + los + "-" + tie;
        if(!(win + los + tie === 0)) {
            var recDecConf = (win + tie/2)/(win + los + tie);
        } else { var recDecConf = 0; }

        // Points variables
        var pf = getLiveScoringItem(teamList[team]['ID'], "pf", "all");
        var pa = getLiveScoringItem(teamList[team]['ID'], "pa", "all");
        var diff = pf - pa;

        // Push data
        standings.push({
            "Team ID": teamList[team]['ID'],
            "Team Name": teamList[team]['Name'],
            "Division": teamList[team]['Division'],
            "GP": gp,
            "Record": rec,
            "Rec%": recDec.toFixed(4),
            "Home": recHome,
            "Home%": recDecHome.toFixed(4),
            "Away": recAway, 
            "Away%": recDecAway.toFixed(4),
            "Div": recDiv,
            "Div%": recDecDiv.toFixed(4),
            "Conf": recConf,
            "Conf%": recDecConf.toFixed(4),
            "PF": pf,
            "PA": pa,
            "Diff": diff.toFixed(0),
            "Streak": getStreak(teamList[team]['ID'])
        });
    }

    // Sort teamList by division then teamID for now. Eventually by division, then tiebreaker function
    standings.sort((a, b) => a['Division'].localeCompare(b['Division']) || tieBreak(a, b));

    // Write to schedule file
    fs.writeFile('./data/standings.json', JSON.stringify(standings), (err) => {
        if(err) console.log(err);
    });
}

function tieBreak(teamA, teamB) {
    return teamA['Team ID'] - teamB['Team ID'];
}

function getLiveScoringItem(teamID, item, type = "all") {
    // Setup game data file
    var fs = require('fs');
    var rawData = fs.readFileSync('./data/liveScoring.json', 'utf-8');
    var gameData = JSON.parse(rawData);
    var dataPoint = 0;

    // Iterate through game data
    for(var game in gameData) {
        // Get game week, split to just number
        var weekString = new String(gameData[game]['Week']);
        var week = weekString.split(' ')[1];

        // Check if game is in stat range
        if(parseInt(week) <= STAT_END_WEEK) {

            // Check if team played in game
            if(gameData[game]['Home ID'] === teamID || gameData[game]['Away ID'] === teamID) {
                if(item === "wins" && type === "all") {                             // Total wins
                    if(gameData[game]['Winner'] === teamID) { dataPoint += 1; }
                } else if (item === "loss" && type === "all") {                     // Total losses
                    if(!(gameData[game]['Winner'] === teamID)) { dataPoint += 1; }
                } else if (item === "ties" && type === "all") {                     // Total ties
                    if(gameData[game]['Winner'] === "Tie") { dataPoint += 1; }
                } else if (item === "pf" && type === "all") {                       // Total points for
                    if(gameData[game]['Home ID'] === teamID) {
                        dataPoint += parseInt(gameData[game]['Home Score']);
                    } else {
                        dataPoint += parseInt(gameData[game]['Away Score']);
                    }
                } else if (item === "pa" && type === "all") {                       // Total points against
                    if(gameData[game]['Home ID'] === teamID) {
                        dataPoint += parseInt(gameData[game]['Away Score']);
                    } else {
                        dataPoint += parseInt(gameData[game]['Home Score']);
                    }
                } else if (item === "wins" && type === "home") {                    // Home wins
                    if(gameData[game]['Winner'] === teamID && gameData[game]['Home ID'] === teamID) {
                        dataPoint += 1;
                    }
                } else if (item === "loss" && type === "home") {                    // Home losses
                    if(!(gameData[game]['Winner'] === teamID) && gameData[game]['Home ID'] === teamID) {
                        dataPoint += 1;
                    }
                } else if (item === "ties" && type === "home") {                    // Home ties
                    if(gameData[game]['Winner'] === "Tie" && gameData[game]['Home ID'] === teamID) {
                        dataPoint += 1;
                    }
                } else if (item === "pf" && type === "home") {                      // Home points for
                    if(gameData[game]['Home ID'] === teamID) {
                        dataPoint += parseInt(gameData[game]['Home Score']);
                    }
                } else if (item === "pa" && type === "home") {                      // Home points against
                    if(gameData[game]['Home ID'] === teamID) {
                        dataPoint += parseInt(gameData[game]['Away Score']);
                    }
                } else if (item === "wins" && type === "away") {                    // Away wins
                    if(gameData[game]['Winner'] === teamID && gameData[game]['Away ID'] === teamID) {
                        dataPoint += 1;
                    }
                } else if (item === "loss" && type === "away") {                    // Away losses
                    if(!(gameData[game]['Winner'] === teamID) && gameData[game]['Away ID'] === teamID) {
                        dataPoint += 1;
                    }
                } else if (item === "ties" && type === "away") {                    // Away ties
                    if(gameData[game]['Winner'] === "Tie" && gameData[game]['Away ID'] === teamID) {
                        dataPoint += 1;
                    }
                } else if (item === "pf" && type === "away") {                      // Away points for
                    if(gameData[game]['Away ID'] === teamID) {
                        dataPoint += parseInt(gameData[game]['Away Score']);
                    }
                } else if (item === "pa" && type === "away") {                      // Away points against
                    if(gameData[game]['Away ID'] === teamID) {
                        dataPoint += parseInt(gameData[game]['Home Score']);
                    }
                } else if (item === "wins" && type === "conf") {                    // Conference wins
                    if(gameData[game]['Winner'] === teamID && getConference(gameData[game]['Away ID']) === getConference(gameData[game]['Home ID'])) {
                        dataPoint += 1;
                    }
                } else if (item === "loss" && type === "conf") {                    // Conference losses
                    if(!(gameData[game]['Winner'] === teamID) && getConference(gameData[game]['Away ID']) === getConference(gameData[game]['Home ID'])) {
                        dataPoint += 1;
                    }
                } else if (item === "ties" && type === "conf") {                    // Conference ties
                    if(gameData[game]['Winner'] === "Tie" && getConference(gameData[game]['Away ID']) === getConference(gameData[game]['Home ID'])) {
                        dataPoint += 1;
                    }
                } else if (item === "pf" && type === "conf") {                      // Conference points for
                    if(gameData[game]['Home ID'] === teamID && getConference(gameData[game]['Away ID']) === getConference(gameData[game]['Home ID'])) {
                        dataPoint += parseInt(gameData[game]['Home Score']);
                    } else if(gameData[game]['Away ID'] === teamID && getConference(gameData[game]['Away ID']) === getConference(gameData[game]['Home ID'])) {
                        dataPoint += parseInt(gameData[game]['Away Score']);
                    }
                } else if (item === "pa" && type === "conf") {                      // Conference points against
                    if(gameData[game]['Away ID'] === teamID && getConference(gameData[game]['Away ID']) === getConference(gameData[game]['Home ID'])) {
                        dataPoint += parseInt(gameData[game]['Home Score']);
                    } else if(gameData[game]['Home ID'] === teamID && getConference(gameData[game]['Away ID']) === getConference(gameData[game]['Home ID'])) {
                        dataPoint += parseInt(gameData[game]['Away Score']);
                    }
                } else if (item === "wins" && type === "div") {                     // Division wins
                    if(gameData[game]['Winner'] === teamID && getDivision(gameData[game]['Away ID']) === getDivision(gameData[game]['Home ID'])) {
                        dataPoint += 1;
                    }
                } else if (item === "loss" && type === "div") {                     // Division losses
                    if(!(gameData[game]['Winner'] === teamID) && getDivision(gameData[game]['Away ID']) === getDivision(gameData[game]['Home ID'])) {
                        dataPoint += 1;
                    }
                } else if (item === "ties" && type === "div") {                     // Division ties
                    if(gameData[game]['Winner'] === "Tie" && getDivision(gameData[game]['Away ID']) === getDivision(gameData[game]['Home ID'])) {
                        dataPoint += 1;
                    }
                } else if (item === "pf" && type === "div") {                       // Division points for
                    if(gameData[game]['Home ID'] === teamID && getDivision(gameData[game]['Away ID']) === getDivision(gameData[game]['Home ID'])) {
                        dataPoint += parseInt(gameData[game]['Home Score']);
                    } else if(gameData[game]['Away ID'] === teamID && getDivision(gameData[game]['Away ID']) === getDivision(gameData[game]['Home ID'])) {
                        dataPoint += parseInt(gameData[game]['Away Score']);
                    }
                } else if (item === "pa" && type === "div") {                       // Division points against
                    if(gameData[game]['Away ID'] === teamID && getDivision(gameData[game]['Away ID']) === getDivision(gameData[game]['Home ID'])) {
                        dataPoint += parseInt(gameData[game]['Home Score']);
                    } else if(gameData[game]['Home ID'] === teamID && getDivision(gameData[game]['Away ID']) === getDivision(gameData[game]['Home ID'])) {
                        dataPoint += parseInt(gameData[game]['Away Score']);
                    }
                }
            }
        }
    }

    return dataPoint;
}

function getHealthScore(teamID) {
    // Setup file
    var fs = require('fs');

    // Get depth charts
    rawData = fs.readFileSync('./data/depthCharts.json', 'utf-8');
    var depthCharts = JSON.parse(rawData);

    // player list to store players as we come across them
    var playerList = [];

    // Iterate through depth charts
    for(var position in depthCharts) {
        // if current position line is in our team
        if(depthCharts[position]['Team'] === teamID) {
            var positionWeight = getPositionWeight(depthCharts[position]['Position']);

            // First string
            // If player position is not empty
            if(!(depthCharts[position]['First'] === null)) {
                // Player variables
                var player = playerList.find(x => x['Player ID'] === depthCharts[position]['First']);

                // If player is not in playerList, add them
                if(player === undefined) {
                    playerList.push({
                        "Player ID": depthCharts[position]['First'],
                        "Impact Score": positionWeight,
                        "Injury Score": getPlayerInjuryScore(depthCharts[position]['First'])                        
                    });
                // Else if play is already in list, add position weight to impact score
                } else {
                    player['Impact Score'] += positionWeight;
                }
            }

            // Second string
            // If player position is not empty
            if(!(depthCharts[position]['Second'] === null)) {
                // Player variables
                var player = playerList.find(x => x['Player ID'] === depthCharts[position]['Second']);

                // If player is not in playerList, add them
                if(player === undefined) {
                    playerList.push({
                        "Player ID": depthCharts[position]['Second'],
                        "Impact Score": positionWeight * 0.8,
                        "Injury Score": getPlayerInjuryScore(depthCharts[position]['First'])
                    });
                // Else if play is already in list, add position weight to impact score
                } else {
                    player['Impact Score'] += (positionWeight * 0.8);
                }
            }

            // Third string
            // If player position is not empty
            if(!(depthCharts[position]['Third'] === null)) {
                // Player variables
                var player = playerList.find(x => x['Player ID'] === depthCharts[position]['Third']);

                // If player is not in playerList, add them
                if(player === undefined) {
                    playerList.push({
                        "Player ID": depthCharts[position]['Third'],
                        "Impact Score": positionWeight * 0.6,
                        "Injury Score": getPlayerInjuryScore(depthCharts[position]['First'])
                    });
                // Else if play is already in list, add position weight to impact score
                } else {
                    player['Impact Score'] += (positionWeight * 0.6);
                }
            }

            // Fourth string
            // If player position is not empty
            if(!(depthCharts[position]['Fourth'] === null)) {
                // Player variables
                var player = playerList.find(x => x['Player ID'] === depthCharts[position]['Fourth']);

                // If player is not in playerList, add them
                if(player === undefined) {
                    playerList.push({
                        "Player ID": depthCharts[position]['Fourth'],
                        "Impact Score": positionWeight * 0.4,
                        "Injury Score": getPlayerInjuryScore(depthCharts[position]['First'])
                    });
                // Else if play is already in list, add position weight to impact score
                } else {
                    player['Impact Score'] += (positionWeight * 0.4);
                }
            }

            // Fifth string
            // If player position is not empty
            if(!(depthCharts[position]['Fifth'] === null)) {
                // Player variables
                var player = playerList.find(x => x['Player ID'] === depthCharts[position]['Fifth']);

                // If player is not in playerList, add them
                if(player === undefined) {
                    playerList.push({
                        "Player ID": depthCharts[position]['Fifth'],
                        "Impact Score": positionWeight * 0.2,
                        "Injury Score": getPlayerInjuryScore(depthCharts[position]['First'])
                    });
                // Else if play is already in list, add position weight to impact score
                } else {
                    player['Impact Score'] += (positionWeight * 0.2);
                }
            }
        }
    }

    // Iterate through player list, get injury scores, calculate health scores, keep running total for team
    var teamImpactScore = 0.0;
    var teamInjuryScore = 0.0;

    for(var player in playerList) {
        teamImpactScore += playerList[player]['Impact Score'];
        teamInjuryScore += (playerList[player]['Impact Score'] * playerList[player]['Injury Score']);
    }

    return (teamInjuryScore / teamImpactScore).toFixed(4);
}

function getPositionWeight(pos) {  
    switch(pos){
        case "LDE":  return 0.80; // LDE
        case "NT:":  return 0.85; // NT
        case "RDE":  return 0.95; // RDE
        case "WLB":  return 0.90; // WLB
        case "MLB":  return 1.00; // MLB
        case "SLB":  return 0.85; // SLB
        case "LCB":  return 0.90; // LCB
        case "SS":  return 0.80; // SS
        case "FS":  return 0.85; // FS
        case "RCB":  return 0.85; // RCB
        case "NB": return 0.75; // NB
        case "K": return 0.50; // PK
        case "P": return 0.50;  // P
        case "H": return 0.25;  // H
        case "PR": return 0.65; // PR
        case "KR": return 0.70; // KR
        case "LS": return 0.50; // LS
        case "WR": return 0.85; // WR
        case "LT": return 0.95; // LT
        case "LG": return 0.80; // LG
        case "C": return 0.85; // C
        case "RG": return 0.80; // RG
        case "RT": return 0.90; // RT
        case "QB": return 1.00; // QB
        case "TE": return 0.75; // TE
        case "RB": return 0.80; // RB
        default: return 0.5;
  }
}

function getPlayerInjuryScore(playerID) {
    // Setup file
    var fs = require('fs');
    
    // Get injury report
    var rawData = fs.readFileSync('./data/injuryReport.json', 'utf-8');
    var injuryReport = JSON.parse(rawData);

    // Get injury score
    var injuryScoreIndex = injuryReport.find(x => x.playerID === playerID);

    // If undefined, return 1.0 (healthy)
    if(injuryScoreIndex === undefined) { 
        return 1.0;
    } else {
        return parseFloat(injuryScoreIndex.playerScore).toFixed(1);
    }
}

function aPercentB(a, b) {
    // Returns what percentage a is of the combined a+b    
    var sum = parseFloat(a) + parseFloat(b);
    
    if(sum === 0) return 0.0;
    return (a/sum).toFixed(4);
}

function predictionPercentage(teamA, teamB) {
    // If teamA is the same as teamB, no need to do calculations. return null
    if(teamA === teamB) return 0.0;
    
    // Load team stats file
    var fs = require('fs');
    var rawData = fs.readFileSync('./data/teamStats.json', 'utf-8');
    var teamStats = JSON.parse(rawData);
    
    // Team for stats
    var teamADict = teamStats.find(x => x['Team ID'] === teamA);
    var teamAGamesPlayed = parseInt(teamADict['GP']);
    var teamAPointsFor = parseInt(teamADict['PF']) / teamAGamesPlayed;
    var teamAFG = parseInt(teamADict['FGM']);
    var teamATDPts = (teamAPointsFor - (teamAFG * 3)) / teamAGamesPlayed;
    var teamATA = (parseInt(teamADict['Int']) + (parseInt(teamADict['Recovered']) - (parseInt(teamADict['Fumble']) - parseInt(teamADict['Lost']))))/teamAGamesPlayed;
    var teamAMom = getMomentum(getStreak(teamA), teamAGamesPlayed);
    var teamAHealthScore = getHealthScore(teamA);

    var teamBDict = teamStats.find(x => x['Team ID'] === teamB);
    var teamBGamesPlayed = parseInt(teamBDict['GP']);
    var teamBPointsFor = parseInt(teamBDict['PF']) / teamBGamesPlayed;
    var teamBFG = parseInt(teamBDict['FGM']);
    var teamBTDPts = (teamBPointsFor - (teamBFG * 3)) / teamBGamesPlayed;
    var teamBTA = (parseInt(teamBDict['Int']) + (parseInt(teamBDict['Recovered']) - (parseInt(teamBDict['Fumble']) - parseInt(teamBDict['Lost']))))/teamBGamesPlayed;
    var teamBMom = getMomentum(getStreak(teamB), teamBGamesPlayed);
    var teamBHealthScore = getHealthScore(teamB);

    // Load team allowed stats file
    rawData = fs.readFileSync('./data/teamAllowedStats.json', 'utf-8');
    teamStats = JSON.parse(rawData);

    // Team allowed stats
    teamADict = teamStats.find(x => x['Team ID'] === teamA);
    var teamAPointsAll = parseInt(teamADict['PF']) / teamAGamesPlayed;
    var teamAFGAll = parseInt(teamADict['FGM']);
    var teamATDPtsAll = (teamAPointsAll - (teamAFGAll * 3)) / teamAGamesPlayed;
    var teamATAAll = (parseInt(teamADict['Int']) + (parseInt(teamADict['Recovered']) - (parseInt(teamADict['Fumble']) - parseInt(teamADict['Lost']))))/teamAGamesPlayed;

    teamBDict = teamStats.find(x => x['Team ID'] === teamA);
    var teamBPointsAll = parseInt(teamBDict['PF']) / teamBGamesPlayed;
    var teamBFGAll = parseInt(teamBDict['FGM']);
    var teamBTDPtsAll = (teamBPointsAll - (teamBFGAll * 3)) / teamBGamesPlayed;
    var teamBTAAll = (parseInt(teamBDict['Int']) + (parseInt(teamBDict['Recovered']) - (parseInt(teamBDict['Fumble']) - parseInt(teamBDict['Lost']))))/teamBGamesPlayed;

    // Percentages
    var pointsForPercent = aPercentB(teamAPointsFor, teamBPointsFor);
    var pointsAllPercent = 1.0 - aPercentB(teamAPointsAll, teamBPointsAll);
    var takeawayPercent = aPercentB(teamATA, teamBTA);
    var turnoverPercent = 1.0 - aPercentB(teamATAAll, teamBTAAll);
    var touchdownPercent = aPercentB(teamATDPts, teamBTDPts);
    var touchdownAllPercent = 1.0 - aPercentB(teamATDPtsAll, teamBTDPtsAll);
    var momentumPercent = aPercentB(teamAMom, teamBMom);
    var healthPercent = aPercentB(teamAHealthScore, teamBHealthScore);  

    // Final variables
    var percentSum = parseFloat(pointsForPercent) + parseFloat(pointsAllPercent) + parseFloat(takeawayPercent) + parseFloat(touchdownPercent) + parseFloat(turnoverPercent) + parseFloat(touchdownAllPercent) + parseFloat(momentumPercent) + parseFloat(healthPercent);

    // Return average of percentages
    return (percentSum/8).toFixed(4);
}

function getMomentum(winStreak, gp) {    
    // Start with baseline 0.5
    var base = 0.5;

    // If Win streak => Positive multiple, if Loss => negative multiplier, tie is 0
    if(winStreak.substring(0, 1) === "W") { var multiplier = 0.5; }
    else if(winStreak.substring(0, 1) === "L") { var multiplier = -0.5; }
    else {var multiplier = 0.0; }

    // Percentage of games played that streak is
    var value = parseInt(winStreak.substring(1)) / gp;

    return base + (multiplier * value);
}

function updateSBP() {
    // Load team list
    var fs = require('fs');
    var rawData = fs.readFileSync('./data/teamList.json', 'utf-8');
    var teamList = JSON.parse(rawData);

    // Result array
    var sbp = [];
    var max = 0.0;

    // Iterate both directions through teamList
    for(var teamY in teamList) {
        // Insert teamY to start results
        sbp.push({"Team ID": teamList[teamY]['ID']});

        // Sum variable for total score
        var sum = 0.0;

        for(var teamX in teamList) {
            var pct = parseFloat(predictionPercentage(teamList[teamY]['ID'], teamList[teamX]['ID']));
            sbp[teamY][teamList[teamX]['ID']] = pct;
            sum += pct;
        }

        // Set total in array, and check for and update max for later use
        sbp[teamY]['Total'] = sum;
        if(sum > max) max = sum;
    }

    for(var team in sbp){
        sbp[team]['SBP'] = (parseFloat(sbp[team]['Total']) / parseFloat(max)).toFixed(4);
    }

    // Write to schedule file
    fs.writeFile('./data/sbp.json', JSON.stringify(sbp), (err) => {
        if(err) console.log(err);
    });
}