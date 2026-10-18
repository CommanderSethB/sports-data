const SEASON = 2026;
const NUM_WEEKS = 18;
const REGSEASON_BASE_URL = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&dates=";
const TEAMS_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";
const BOXSCORE_BASE_URL = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=";

updateGames();


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
                gameList.push({week: weekName, gameID: gameID, date: gameDate, time: gameTime, homeTeam: homeTeam, homeTeamName: homeTeamName, awayTeam: awayTeam, awayTeamName: awayTeamName, status: gameStatus, homeScore: homeScore, awayScore: awayScore, homeOdds: homeOdds, awayOdds: awayOdds, spread: spread, overUnder: overUnder});

                // If game status is Final, record the game stats
                if(gameStatus === "Final") {
                    var boxscoreURL = BOXSCORE_BASE_URL + gameID;

                    try {
                        const boxscoreResponse = await fetch(boxscoreURL);
                        const boxscoreData = await boxscoreResponse.json();

                        var boxScoreTeams = boxscoreData.boxscore.players;

                        for(var boxScoreTeam = 0; boxScoreTeam < boxScoreTeams.length; boxScoreTeam++) {
                            var currentBoxScoreTeam = boxScoreTeams[boxScoreTeam];

                            var boxScorePlayerList = [];
                            var teamID = currentBoxScoreTeam.team.id;

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

    var fs = require('fs');
    fs.writeFile('liveScoring.json', JSON.stringify(gameList), (err) => {
        if(err) console.log(err);
    });

    statList.sort((a, b) => a.playerID - b.playerID);

    var newStatList = combinePlayerStats(statList);

    fs.writeFile('playerStats.json', JSON.stringify(newStatList), (err) => {
        if(err) console.log(err);
    });
}

function combinePlayerStats(statList) {
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
            playerID: playerList[i],
            teamID: teamID, 
            passCompletions: passCompletions,
            passAttempts: passAttempts,
            passYards: passYards,
            passYardsPerAttempt: passYardsPerAttempt.toFixed(1),
            passTouchdowns: passTouchdowns,
            passInterceptions: passInterceptions,
            passSacks: passSacks,
            passSackYards: passSackYards,
            passerRating: passerRating,
            rushAttempts: rushAttempts,
            rushYards: rushYards,
            rushYardsPerAttempt: rushYardsPerAttempt.toFixed(1),
            rushTouchdowns: rushTouchdowns,
            longestRush: longestRush,
            receptions: receptions,
            receivingYards: receivingYards,
            receivingYardsPerReception: receivingYardsPerReception.toFixed(1),
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
            kickoffReturnYardsPerAttempt: kickoffReturnYardsPerAttempt.toFixed(1),
            longestKickoffReturn: longestKickoffReturn,
            kickoffReturnTouchdowns: kickoffReturnTouchdowns,
            puntReturns: puntReturns,
            puntReturnYards: puntReturnYards,
            puntReturnYardsPerAttempt: puntReturnYardsPerAttempt.toFixed(1),
            longestPuntReturn: longestPuntReturn,
            puntReturnTouchdowns: puntReturnTouchdowns,
            fieldGoalsMade: fieldGoalsMade,
            fieldGoalsAttempted: fieldGoalsAttempted,
            fieldGoalPercentage: fieldGoalPercentage.toFixed(4),
            longestFieldGoal: longestFieldGoal,
            extraPointsMade: extraPointsMade,
            extraPointsAttempted: extraPointsAttempted,
            kickingPoints: kickingPoints,
            punts: punts,
            puntYards: puntYards,
            puntYardsPerAttempt: puntYardsPerAttempt.toFixed(1),
            puntTouchbacks: puntTouchbacks,
            puntsInside20: puntsInside20,
            longestPunt: longestPunt
        });
    }

    return newStatList;
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
            var teamColor = currentTeam.color;
            var teamLogo = currentTeam.logos[0].href;

            // Add the current team details to the result array
            teamList.push({teamID: teamID, teamAbbreviation: teamAbbreviation, teamName: teamName, teamColor: teamColor, teamLogo: teamLogo});
        }
    } catch (error) {
        console.error("Error fetching data");
    }

    var fs = require('fs');
    fs.writeFile('teamList.json', JSON.stringify(teamList), (err) => {
        if(err) console.log(err);
    });
}
