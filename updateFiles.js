const SEASON = 2026;
const NUM_WEEKS = 18;
const STAT_END_WEEK = 6;
const REGSEASON_BASE_URL = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&dates=";
const TEAMS_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";
const BOXSCORE_BASE_URL = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=";
const INJURY_URL = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/injuries";
const DEPTH_CHART_URL = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/";

updateGames();
updateInjuryReport();
updateTeams();
updateDepthCharts();

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
            var division = getDivsion(teamID);

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

function getDivsion(teamID) {
    // Setup and load divisions json
    var fs = require('fs');
    const rawData = fs.readFileSync('./data/divisions.json', 'utf-8');
    const divisions = JSON.parse(rawData);

    var team = divisions.find(x => x['ID'] === teamID);

    return team['Conference'] + " " + team['Division'];
}