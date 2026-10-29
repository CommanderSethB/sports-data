/**
 * updateFiles.js
 * Automated NFL data fetching, statistical calculation, and ranking generator.
 */

const SEASON = 2026;
const NUM_WEEKS = 18;
const STAT_END_WEEK = 7;
const PE_POWER = 2.37;
const TOF_POWER = 2.37;
const HOME_FIELD = 3;

// Weight distribution for Power Rankings calculation (must add up to 1.0)
const RATING_WEIGHT_REC = 0.3;      // 0.30 - Record weight
const RATING_WEIGHT_PE = 0.1;       // 0.40 - Pythagorean Expectation weight
const RATING_WEIGHT_TOF = 0.05;     // 0.45 - Turnover Factor weight
const RATING_WEIGHT_TDP = 0.1;      // 0.55 - Touchdown Points Percentage weight
const RATING_WEIGHT_SBP = 0.15;     // 0.70 - Strength Based Power weight
const RATING_WEIGHT_SOS = 0.1;      // 0.80 - Strength of Schedule weight
const RATING_WEIGHT_MOM = 0.1;      // 0.90 - Momentum weight
const RATING_WEIGHT_HEALTH = 0.1;   // 1.00 - Team Health weight

// ESPN API Endpoints
const REGSEASON_BASE_URL = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&dates=";
const TEAMS_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";
const BOXSCORE_BASE_URL = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=";
const INJURY_URL = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/injuries";
const DEPTH_CHART_URL = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/";

const fs = require('fs');

// Kick off the main execution pipeline
main();

async function main() {
    try {
        console.log("Updating live scoring data...");
        await updateGames();
        console.log("Updating injury report...");
        await updateInjuryReport();
        console.log("Updating team list...");
        await updateTeams();
        console.log("Updating depth charts...");
        await updateDepthCharts();
        console.log("Updating schedules...");
        await updateSchedules();
        console.log("Updating standings...");
        await generateStandings();
        console.log("Updating prediction percentages...");
        await updateSBP();
        console.log("Updating power rankings...");
        await updatePowerRankings();
        console.log("Building weekly view...");
        buildWeekView();
        console.log("All files updated successfully!");
    } catch (err) {
        console.error("Error in main execution pipeline:", err);
    }
}

/**
 * Fetches and parses the current NFL injury report across all teams.
 */
async function updateInjuryReport() {
    let result = [];

    try {
        const response = await fetch(INJURY_URL);
        const data = await response.json();

        // Loop through each team and their corresponding injuries
        for (let team = 0; team < data.injuries.length; team++) {
            let teamID = data.injuries[team].id;

            for (let injury = 0; injury < data.injuries[team].injuries.length; injury++) {
                let currentInjury = data.injuries[team].injuries[injury];
                let playerLink = currentInjury.athlete.links[0].href;
                let playerID = playerLink.split("/")[7];
                let playerName = currentInjury.athlete.displayName;
                let injuryStatus = convertInjuryStatus(currentInjury.type.name);
                let playerScore = convertInjuryStatusToScore(currentInjury.type.name);

                result.push({ teamID, playerID, playerName, injuryStatus, playerScore });
            }
        }
    } catch (err) {
        console.error("Error fetching injury report:", err);
    }

    // Save injury data to disk with 2-space indentation formatting
    fs.writeFileSync('./NFL/data/injuryReport.json', JSON.stringify(result, null, 2));
}

function convertInjuryStatus(inj_status) {
    switch (inj_status) {
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
  
function convertInjuryStatusToScore(inj_status) {
    switch (inj_status) {
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

/**
 * Fetches game schedules and boxscores week-by-week.
 * Uses Promise.all to fetch boxscores concurrently for maximum speedup.
 */
async function updateGames() {
    let gameList = [];
    let statList = [];
    let boxscorePromises = [];

    // Iterate through each week of the regular season
    for (let week = 1; week <= NUM_WEEKS; week++) {
        let weekName = `Week ${week}`;
        let url = `${REGSEASON_BASE_URL}${SEASON}&week=${week}`;

        try {
            let response = await fetch(url);
            let data = await response.json();

            // Iterate through every game in the current week's scoreboard
            for (let game = 0; game < data.events.length; game++) {
                let currentGame = data.events[game];
                let gameID = currentGame.id;
                let gameDate = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(currentGame.date));
                let gameTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }).format(new Date(currentGame.date));
                
                let competition = currentGame.competitions[0];
                let homeCompetitor = competition.competitors[0];
                let awayCompetitor = competition.competitors[1];

                let homeTeam = homeCompetitor.team.id;
                let homeTeamName = homeCompetitor.team.displayName;
                let awayTeam = awayCompetitor.team.id;
                let awayTeamName = awayCompetitor.team.displayName;
                let homeScore = homeCompetitor.score;
                let awayScore = awayCompetitor.score;
                let gameStatus = currentGame.status.type.description;

                // Safely extract betting odds if available
                let homeOdds = null, awayOdds = null, spread = null, overUnder = null;
                try {
                    let odds = competition.odds[0];
                    homeOdds = odds.moneyline.home.close.odds;
                    awayOdds = odds.moneyline.away.close.odds;
                    spread = odds.details;
                    overUnder = odds.overUnder;
                } catch (error) {
                    // Odds unavailable for this game
                }

                // Determine game outcome/winner
                let winningTeam = null;
                if (homeCompetitor.winner) {
                    winningTeam = homeTeam;
                } else if (awayCompetitor.winner) {
                    winningTeam = awayTeam;
                } else if (homeScore === awayScore && gameStatus === "Final") {
                    winningTeam = "Tie";
                }

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

                // If the game falls within the valid statistical range, queue its boxscore fetch
                if (week <= STAT_END_WEEK) {
                    let boxscoreURL = `${BOXSCORE_BASE_URL}${gameID}`;
                    boxscorePromises.push(
                        fetch(boxscoreURL)
                            .then(res => res.json())
                            .then(boxscoreData => {
                                processBoxscore(boxscoreData, statList);
                            })
                            .catch(err => console.error(`Error fetching boxscore for game ${gameID}:`, err))
                    );
                }
            }
        } catch (error) {
            console.error(`Error fetching data for week ${week}:`, error);
        }
    }

    // Await all queued boxscore requests to run and complete concurrently
    await Promise.all(boxscorePromises);

    fs.writeFileSync('./NFL/data/liveScoring.json', JSON.stringify(gameList, null, 2));

    // Sort stats by player ID before writing
    statList.sort((a, b) => a.playerID - b.playerID);
    fs.writeFileSync('./NFL/data/boxScores.json', JSON.stringify(statList, null, 2));

    // Aggregate statistics downstream
    updatePlayerStats(statList);
    updateTeamStats(statList, gameList);
    updateTeamAllowedStats(statList, gameList);
}

/**
 * Helper function to parse individual player performance lines from a game's boxscore summary.
 */
function processBoxscore(boxscoreData, statList) {
    if (!boxscoreData || !boxscoreData.boxscore || !boxscoreData.boxscore.players) return;
    let boxScoreTeams = boxscoreData.boxscore.players;

    for (let boxScoreTeam = 0; boxScoreTeam < boxScoreTeams.length; boxScoreTeam++) {
        let currentBoxScoreTeam = boxScoreTeams[boxScoreTeam];
        let boxScorePlayerList = [];
        let teamID = currentBoxScoreTeam.team.id;
        let oppID = boxScoreTeams[1 - boxScoreTeam].team.id;

        // Collect unique player IDs from team statistics categories
        for (let stat = 0; stat < currentBoxScoreTeam.statistics.length; stat++) {
            let currentStat = currentBoxScoreTeam.statistics[stat];
            for (let boxScorePlayer = 0; boxScorePlayer < currentStat.athletes.length; boxScorePlayer++) {
                let currentPlayer = currentStat.athletes[boxScorePlayer];
                if (!boxScorePlayerList.includes(currentPlayer.athlete.id)) {
                    boxScorePlayerList.push(currentPlayer.athlete.id);
                }
            }
        }

        // Map and extract statistical categories for each player
        for (let boxScorePlayer = 0; boxScorePlayer < boxScorePlayerList.length; boxScorePlayer++) {
            let passCompletions = 0, passAttempts = 0, passYards = 0, passYardsPerAttempt = 0;
            let passTouchdowns = 0, passInterceptions = 0, passSacks = 0, passSackYards = 0;
            let adjustedQBR = 0, passerRating = 0, rushAttempts = 0, rushYards = 0;
            let rushYardsPerAttempt = 0, rushTouchdowns = 0, longestRush = 0;
            let receptions = 0, receivingYards = 0, receivingYardsPerReception = 0;
            let receivingTouchdowns = 0, longestReception = 0, receivingTargets = 0;
            let fumbles = 0, fumblesLost = 0, fumblesRecovered = 0;
            let tackles = 0, tacklesSolo = 0, sacks = 0, tacklesForLoss = 0;
            let passesDefended = 0, quarterbackHits = 0, defensiveTouchdowns = 0;
            let interceptions = 0, interceptionReturnYards = 0, interceptionReturnTouchdowns = 0;
            let kickoffReturns = 0, kickoffReturnYards = 0, kickoffReturnYardsPerAttempt = 0;
            let longestKickoffReturn = 0, kickoffReturnTouchdowns = 0;
            let puntReturns = 0, puntReturnYards = 0, puntReturnYardsPerAttempt = 0;
            let longestPuntReturn = 0, puntReturnTouchdowns = 0;
            let fieldGoalsMade = 0, fieldGoalsAttempted = 0, fieldGoalPercentage = 0, longestFieldGoal = 0;
            let extraPointsAttempted = 0, extraPointsMade = 0, kickingPoints = 0;
            let punts = 0, puntYards = 0, puntYardsPerAttempt = 0, puntTouchbacks = 0;
            let puntsInside20 = 0, longestPunt = 0;

            let currentPlayerID = boxScorePlayerList[boxScorePlayer];
            let splitString;

            for (let stat = 0; stat < currentBoxScoreTeam.statistics.length; stat++) {
                let currentStat = currentBoxScoreTeam.statistics[stat].athletes;
                for (let player = 0; player < currentStat.length; player++) {
                    let currentPlayer = currentStat[player];

                    if (currentPlayer.athlete.id === currentPlayerID) {
                        switch (stat) {
                            case 0: // Passing stats
                                splitString = currentPlayer.stats[0].split("/");
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
                            case 1: // Rushing stats
                                rushAttempts = parseInt(currentPlayer.stats[0]);
                                rushYards = parseInt(currentPlayer.stats[1]);
                                rushYardsPerAttempt = parseFloat(currentPlayer.stats[2]);
                                rushTouchdowns = parseInt(currentPlayer.stats[3]);
                                longestRush = parseInt(currentPlayer.stats[4]);
                                break;
                            case 2: // Receiving stats
                                receptions = parseInt(currentPlayer.stats[0]);
                                receivingYards = parseInt(currentPlayer.stats[1]);
                                receivingYardsPerReception = parseFloat(currentPlayer.stats[2]);
                                receivingTouchdowns = parseInt(currentPlayer.stats[3]);
                                longestReception = parseInt(currentPlayer.stats[4]);
                                receivingTargets = parseInt(currentPlayer.stats[5]);
                                break;
                            case 3: // Fumbles
                                fumbles = parseInt(currentPlayer.stats[0]);
                                fumblesLost = parseInt(currentPlayer.stats[1]);
                                fumblesRecovered = parseInt(currentPlayer.stats[2]);
                                break;
                            case 4: // Defense/Tackles
                                tackles = parseInt(currentPlayer.stats[0]);
                                tacklesSolo = parseInt(currentPlayer.stats[1]);
                                sacks = parseInt(currentPlayer.stats[2]);
                                tacklesForLoss = parseInt(currentPlayer.stats[3]);
                                passesDefended = parseInt(currentPlayer.stats[4]);
                                quarterbackHits = parseInt(currentPlayer.stats[5]);
                                defensiveTouchdowns = parseInt(currentPlayer.stats[6]);
                                break;
                            case 5: // Interceptions Defense
                                interceptions = parseInt(currentPlayer.stats[0]);
                                interceptionReturnYards = parseInt(currentPlayer.stats[1]);
                                interceptionReturnTouchdowns = parseInt(currentPlayer.stats[2]);
                                break;
                            case 6: // Kickoff Returns
                                kickoffReturns = parseInt(currentPlayer.stats[0]);
                                kickoffReturnYards = parseInt(currentPlayer.stats[1]);
                                kickoffReturnYardsPerAttempt = parseFloat(currentPlayer.stats[2]);
                                longestKickoffReturn = parseInt(currentPlayer.stats[3]);
                                kickoffReturnTouchdowns = parseInt(currentPlayer.stats[4]);
                                break;
                            case 7: // Punt Returns
                                puntReturns = parseInt(currentPlayer.stats[0]);
                                puntReturnYards = parseInt(currentPlayer.stats[1]);
                                puntReturnYardsPerAttempt = parseFloat(currentPlayer.stats[2]);
                                longestPuntReturn = parseInt(currentPlayer.stats[3]);
                                puntReturnTouchdowns = parseInt(currentPlayer.stats[4]);
                                break;
                            case 8: // Kicking / Field Goals
                                splitString = currentPlayer.stats[0].split("/");
                                fieldGoalsMade = parseInt(splitString[0]);
                                fieldGoalsAttempted = parseInt(splitString[1]);
                                fieldGoalPercentage = parseFloat(currentPlayer.stats[1]);
                                longestFieldGoal = parseInt(currentPlayer.stats[2]);
                                splitString = currentPlayer.stats[3].split("/");
                                extraPointsMade = parseInt(splitString[0]);
                                extraPointsAttempted = parseInt(splitString[1]);
                                kickingPoints = parseInt(currentPlayer.stats[4]);
                                break;
                            case 9: // Punting
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
                teamID,
                oppID, 
                passCompletions, passAttempts, passYards, passYardsPerAttempt,
                passTouchdowns, passInterceptions, passSacks, passSackYards,
                adjustedQBR, passerRating, rushAttempts, rushYards,
                rushYardsPerAttempt, rushTouchdowns, longestRush,
                receptions, receivingYards, receivingYardsPerReception,
                receivingTouchdowns, longestReception, receivingTargets,
                fumbles, fumblesLost, fumblesRecovered, tackles,
                tacklesSolo, sacks, tacklesForLoss, passesDefended,
                quarterbackHits, defensiveTouchdowns, interceptions,
                interceptionReturnYards, interceptionReturnTouchdowns,
                kickoffReturns, kickoffReturnYards, kickoffReturnYardsPerAttempt,
                longestKickoffReturn, kickoffReturnTouchdowns, puntReturns,
                puntReturnYards, puntReturnYardsPerAttempt, longestPuntReturn,
                puntReturnTouchdowns, fieldGoalsMade, fieldGoalsAttempted,
                fieldGoalPercentage, longestFieldGoal, extraPointsMade,
                extraPointsAttempted, kickingPoints, punts, puntYards,
                puntYardsPerAttempt, puntTouchbacks, puntsInside20, longestPunt
            });
        }
    }
}

/**
 * Aggregates individual player stats across the season.
 */
function updatePlayerStats(statList) {
    let newStatList = [];   
    let playerList = [];

    for (let i = 0; i < statList.length; i++) {
        if (!playerList.includes(statList[i].playerID)) {
            playerList.push(statList[i].playerID);
        }
    }

    for (let i = 0; i < playerList.length; i++) {
        let teamID = null;
        let gamesPlayed = 0;
        let passCompletions = 0, passAttempts = 0, passYards = 0, passYardsPerAttempt = 0;
        let passTouchdowns = 0, passInterceptions = 0, passSacks = 0, passSackYards = 0;
        let passerRating = 0, rushAttempts = 0, rushYards = 0, rushYardsPerAttempt = 0;
        let rushTouchdowns = 0, longestRush = 0, receptions = 0, receivingYards = 0;
        let receivingYardsPerReception = 0, receivingTouchdowns = 0, longestReception = 0;
        let receivingTargets = 0, fumbles = 0, fumblesLost = 0, fumblesRecovered = 0;
        let tackles = 0, tacklesSolo = 0, sacks = 0, tacklesForLoss = 0, passesDefended = 0;
        let quarterbackHits = 0, defensiveTouchdowns = 0, interceptions = 0;
        let interceptionReturnYards = 0, interceptionReturnTouchdowns = 0;
        let kickoffReturns = 0, kickoffReturnYards = 0, kickoffReturnYardsPerAttempt = 0;
        let longestKickoffReturn = 0, kickoffReturnTouchdowns = 0;
        let puntReturns = 0, puntReturnYards = 0, puntReturnYardsPerAttempt = 0;
        let longestPuntReturn = 0, puntReturnTouchdowns = 0;
        let fieldGoalsMade = 0, fieldGoalsAttempted = 0, fieldGoalPercentage = 0, longestFieldGoal = 0;
        let extraPointsAttempted = 0, extraPointsMade = 0, kickingPoints = 0;
        let punts = 0, puntYards = 0, puntYardsPerAttempt = 0, puntTouchbacks = 0;
        let puntsInside20 = 0, longestPunt = 0;

        for (let j = 0; j < statList.length; j++) {
            if (statList[j].playerID === playerList[i]) {
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
                if (parseInt(statList[j].longestRush) > longestRush) longestRush = parseInt(statList[j].longestRush);
                receptions += parseInt(statList[j].receptions);
                receivingYards += parseInt(statList[j].receivingYards);
                receivingTouchdowns += parseInt(statList[j].receivingTouchdowns);
                receivingTargets += parseInt(statList[j].receivingTargets);
                if (parseInt(statList[j].longestReception) > longestReception) longestReception = parseInt(statList[j].longestReception);
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
                if (parseInt(statList[j].longestKickoffReturn) > longestKickoffReturn) longestKickoffReturn = parseInt(statList[j].longestKickoffReturn);
                puntReturns += parseInt(statList[j].puntReturns);
                puntReturnYards += parseInt(statList[j].puntReturnYards);
                puntReturnTouchdowns += parseInt(statList[j].puntReturnTouchdowns);
                if (parseInt(statList[j].longestPuntReturn) > longestPuntReturn) longestPuntReturn = parseInt(statList[j].longestPuntReturn);
                fieldGoalsMade += parseInt(statList[j].fieldGoalsMade);
                fieldGoalsAttempted += parseInt(statList[j].fieldGoalsAttempted);
                if (parseInt(statList[j].longestFieldGoal) > longestFieldGoal) longestFieldGoal = parseInt(statList[j].longestFieldGoal);
                extraPointsMade += parseInt(statList[j].extraPointsMade);
                extraPointsAttempted += parseInt(statList[j].extraPointsAttempted);
                kickingPoints += parseInt(statList[j].kickingPoints);
                punts += parseInt(statList[j].punts);
                puntYards += parseInt(statList[j].puntYards);
                puntTouchbacks += parseInt(statList[j].puntTouchbacks);
                puntsInside20 += parseInt(statList[j].puntsInside20);
                if (parseInt(statList[j].longestPunt) > longestPunt) longestPunt = parseInt(statList[j].longestPunt);
            }
        }

        passerRating = calculatePasserRating(passCompletions, passAttempts, passYards, passTouchdowns, passInterceptions);

        passYardsPerAttempt = passAttempts === 0 ? 0.0 : passYards / passAttempts;
        rushYardsPerAttempt = rushAttempts === 0 ? 0.0 : rushYards / rushAttempts;
        receivingYardsPerReception = receptions === 0 ? 0.0 : receivingYards / receptions;
        kickoffReturnYardsPerAttempt = kickoffReturns === 0 ? 0.0 : kickoffReturnYards / kickoffReturns;
        puntReturnYardsPerAttempt = puntReturns === 0 ? 0.0 : puntReturnYards / puntReturns;
        fieldGoalPercentage = fieldGoalsAttempted === 0 ? 0.0 : fieldGoalsMade / fieldGoalsAttempted;
        puntYardsPerAttempt = punts === 0 ? 0.0 : puntYards / punts;

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

    fs.writeFileSync('./NFL/data/playerStats.json', JSON.stringify(newStatList, null, 2));
}

function calculatePasserRating(cmp, att, yds, tds, int) {
    if (att === 0) return "0.0";
    let a = passerRatingBound(5.0 * ((cmp / att) - 0.3));
    let b = passerRatingBound(0.25 * ((yds / att) - 3.0));
    let c = passerRatingBound(20.0 * (tds / att));
    let d = 2.375 - passerRatingBound(25.0 * (int / att));
    let rating = 100.0 * ((a + b + c + d) / 6.0);
    return rating.toFixed(1);
}

function passerRatingBound(num) {
    let max = 2.375;
    let min = 0.0;
    
    if (num > max) return max;
    if (num < min) return min;
    return num;
}

/**
 * Fetches current team profiles and metadata from the NFL teams endpoint.
 */
async function updateTeams() {
    let teamList = [];

    try {
        const response = await fetch(TEAMS_URL);
        const data = await response.json();
        let teams = data.sports[0].leagues[0].teams;

        for (let team = 0; team < teams.length; team++) {
            let currentTeam = teams[team].team;
            let teamID = currentTeam.id;
            let teamName = currentTeam.displayName;
            let teamAbbreviation = currentTeam.abbreviation;
            let teamColor = `#${currentTeam.color}`;
            let teamLogo = currentTeam.logos[0].href;
            let division = getDivision(teamID);

            teamList.push({ "ID": teamID, "Abbr": teamAbbreviation, "Name": teamName, "Color": teamColor, "Logo": teamLogo, "Division": division });
        }
    } catch (error) {
        console.error("Error fetching teams data:", error);
    }

    teamList.sort((a, b) => a.ID - b.ID);
    fs.writeFileSync('./NFL/data/teamList.json', JSON.stringify(teamList, null, 2));
}

/**
 * Fetches depth charts concurrently for all teams.
 */
async function updateDepthCharts() {
    let rawData = fs.readFileSync('./NFL/data/teamList.json', 'utf-8');
    let teamList = JSON.parse(rawData);     

    let depthCharts = [];

    // Concurrent fetch using Promise.all mapping over the team list
    const promises = teamList.map(async (team) => {
        let teamID = team.ID;
        let url = `${DEPTH_CHART_URL}${SEASON}/teams/${teamID}/depthcharts`;

        try {
            let response = await fetch(url);
            let data = await response.json();

            for (let i = 0; i < data.items.length; i++) {
                let unit = data.items[i].positions;

                for (let pos in unit) {
                    let position = unit[pos].position.abbreviation;
                    let row = { 'Team': teamID, 'Position': position, 'First': null, 'Second': null, 'Third': null, 'Fourth': null, 'Fifth': null };

                    for (let ath = 0; ath < unit[pos].athletes.length; ath++) {
                        let currentAthleteLink = unit[pos].athletes[ath].athlete['$ref'];
                        let playerID = currentAthleteLink.split("/")[11].split('?')[0];

                        let rank = "X";
                        switch (ath) {
                            case 0: rank = "First"; break;
                            case 1: rank = "Second"; break;
                            case 2: rank = "Third"; break;
                            case 3: rank = "Fourth"; break;
                            case 4: rank = "Fifth"; break;
                        }
                        row[rank] = playerID;
                    }
                    depthCharts.push(row);
                }
            }
        } catch (error) {
            console.error(`Error fetching depth chart for team ${teamID}:`, error);
        }
    });

    await Promise.all(promises);
    fs.writeFileSync('./NFL/data/depthCharts.json', JSON.stringify(depthCharts, null, 2));
}

/**
 * Summarizes seasonal statistics for teams.
 */
function updateTeamStats(statList, gameData) {
    let newStatList = [];   
    let teamList = [];

    for (let i = 0; i < statList.length; i++) {
        if (!teamList.includes(statList[i].teamID)) {
            teamList.push(statList[i].teamID);
        }
    }

    for (let i = 0; i < teamList.length; i++) {
        let gamesPlayed = 0, pointsFor = 0, pointsAgainst = 0;
        let passCompletions = 0, passAttempts = 0, passYards = 0, passYardsPerAttempt = 0;
        let passTouchdowns = 0, passInterceptions = 0, passSacks = 0, passSackYards = 0;
        let passerRating = 0, rushAttempts = 0, rushYards = 0, rushYardsPerAttempt = 0;
        let rushTouchdowns = 0, longestRush = 0, receptions = 0, receivingYards = 0;
        let receivingYardsPerReception = 0, receivingTouchdowns = 0, longestReception = 0;
        let receivingTargets = 0, fumbles = 0, fumblesLost = 0, fumblesRecovered = 0;
        let tackles = 0, tacklesSolo = 0, sacks = 0, tacklesForLoss = 0, passesDefended = 0;
        let quarterbackHits = 0, defensiveTouchdowns = 0, interceptions = 0;
        let interceptionReturnYards = 0, interceptionReturnTouchdowns = 0;
        let kickoffReturns = 0, kickoffReturnYards = 0, kickoffReturnYardsPerAttempt = 0;
        let longestKickoffReturn = 0, kickoffReturnTouchdowns = 0;
        let puntReturns = 0, puntReturnYards = 0, puntReturnYardsPerAttempt = 0;
        let longestPuntReturn = 0, puntReturnTouchdowns = 0;
        let fieldGoalsMade = 0, fieldGoalsAttempted = 0, fieldGoalPercentage = 0, longestFieldGoal = 0;
        let extraPointsAttempted = 0, extraPointsMade = 0, kickingPoints = 0;
        let punts = 0, puntYards = 0, puntYardsPerAttempt = 0, puntTouchbacks = 0;
        let puntsInside20 = 0, longestPunt = 0;

        for (let j = 0; j < statList.length; j++) {
            if (statList[j].teamID === teamList[i]) {
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
                if (parseInt(statList[j].longestRush) > longestRush) longestRush = parseInt(statList[j].longestRush);
                receptions += parseInt(statList[j].receptions);
                receivingYards += parseInt(statList[j].receivingYards);
                receivingTouchdowns += parseInt(statList[j].receivingTouchdowns);
                receivingTargets += parseInt(statList[j].receivingTargets);
                if (parseInt(statList[j].longestReception) > longestReception) longestReception = parseInt(statList[j].longestReception);
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
                if (parseInt(statList[j].longestKickoffReturn) > longestKickoffReturn) longestKickoffReturn = parseInt(statList[j].longestKickoffReturn);
                puntReturns += parseInt(statList[j].puntReturns);
                puntReturnYards += parseInt(statList[j].puntReturnYards);
                puntReturnTouchdowns += parseInt(statList[j].puntReturnTouchdowns);
                if (parseInt(statList[j].longestPuntReturn) > longestPuntReturn) longestPuntReturn = parseInt(statList[j].longestPuntReturn);
                fieldGoalsMade += parseInt(statList[j].fieldGoalsMade);
                fieldGoalsAttempted += parseInt(statList[j].fieldGoalsAttempted);
                if (parseInt(statList[j].longestFieldGoal) > longestFieldGoal) longestFieldGoal = parseInt(statList[j].longestFieldGoal);
                extraPointsMade += parseInt(statList[j].extraPointsMade);
                extraPointsAttempted += parseInt(statList[j].extraPointsAttempted);
                kickingPoints += parseInt(statList[j].kickingPoints);
                punts += parseInt(statList[j].punts);
                puntYards += parseInt(statList[j].puntYards);
                puntTouchbacks += parseInt(statList[j].puntTouchbacks);
                puntsInside20 += parseInt(statList[j].puntsInside20);
                if (parseInt(statList[j].longestPunt) > longestPunt) longestPunt = parseInt(statList[j].longestPunt);
            }
        }

        passerRating = calculatePasserRating(passCompletions, passAttempts, passYards, passTouchdowns, passInterceptions);
        passYardsPerAttempt = passAttempts === 0 ? 0.0 : passYards / passAttempts;
        rushYardsPerAttempt = rushAttempts === 0 ? 0.0 : rushYards / rushAttempts;
        receivingYardsPerReception = receptions === 0 ? 0.0 : receivingYards / receptions;
        kickoffReturnYardsPerAttempt = kickoffReturns === 0 ? 0.0 : kickoffReturnYards / kickoffReturns;
        puntReturnYardsPerAttempt = puntReturns === 0 ? 0.0 : puntReturnYards / puntReturns;
        fieldGoalPercentage = fieldGoalsAttempted === 0 ? 0.0 : fieldGoalsMade / fieldGoalsAttempted;
        puntYardsPerAttempt = punts === 0 ? 0.0 : puntYards / punts;

        for (let j = 0; j < gameData.length; j++) {
            let weekString = String(gameData[j]['Week']);
            let weekNum = parseInt(weekString.split(' ')[1]);

            if (weekNum <= STAT_END_WEEK && gameData[j]['Home ID'] === teamList[i]) {
                gamesPlayed += 1;
                pointsFor += parseInt(gameData[j]['Home Score']);
                pointsAgainst += parseInt(gameData[j]['Away Score']);
            } else if (weekNum <= STAT_END_WEEK && gameData[j]['Away ID'] === teamList[i]) {
                gamesPlayed += 1;
                pointsFor += parseInt(gameData[j]['Away Score']);
                pointsAgainst += parseInt(gameData[j]['Home Score']);
            }
        }

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

    newStatList.sort((a, b) => a['Team ID'] - b['Team ID']);
    fs.writeFileSync('./NFL/data/teamStats.json', JSON.stringify(newStatList, null, 2));
}

/**
 * Summarizes statistics allowed by opposing teams.
 */
function updateTeamAllowedStats(statList, gameData) {
    let newStatList = [];   
    let teamList = [];

    for (let i = 0; i < statList.length; i++) {
        if (!teamList.includes(statList[i].oppID)) {
            teamList.push(statList[i].oppID);
        }
    }

    for (let i = 0; i < teamList.length; i++) {
        let gamesPlayed = 0, pointsFor = 0, pointsAgainst = 0;
        let passCompletions = 0, passAttempts = 0, passYards = 0, passYardsPerAttempt = 0;
        let passTouchdowns = 0, passInterceptions = 0, passSacks = 0, passSackYards = 0;
        let passerRating = 0, rushAttempts = 0, rushYards = 0, rushYardsPerAttempt = 0;
        let rushTouchdowns = 0, longestRush = 0, receptions = 0, receivingYards = 0;
        let receivingYardsPerReception = 0, receivingTouchdowns = 0, longestReception = 0;
        let receivingTargets = 0, fumbles = 0, fumblesLost = 0, fumblesRecovered = 0;
        let tackles = 0, tacklesSolo = 0, sacks = 0, tacklesForLoss = 0, passesDefended = 0;
        let quarterbackHits = 0, defensiveTouchdowns = 0, interceptions = 0;
        let interceptionReturnYards = 0, interceptionReturnTouchdowns = 0;
        let kickoffReturns = 0, kickoffReturnYards = 0, kickoffReturnYardsPerAttempt = 0;
        let longestKickoffReturn = 0, kickoffReturnTouchdowns = 0;
        let puntReturns = 0, puntReturnYards = 0, puntReturnYardsPerAttempt = 0;
        let longestPuntReturn = 0, puntReturnTouchdowns = 0;
        let fieldGoalsMade = 0, fieldGoalsAttempted = 0, fieldGoalPercentage = 0, longestFieldGoal = 0;
        let extraPointsAttempted = 0, extraPointsMade = 0, kickingPoints = 0;
        let punts = 0, puntYards = 0, puntYardsPerAttempt = 0, puntTouchbacks = 0;
        let puntsInside20 = 0, longestPunt = 0;

        for (let j = 0; j < statList.length; j++) {
            if (statList[j].oppID === teamList[i]) {
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
                if (parseInt(statList[j].longestRush) > longestRush) longestRush = parseInt(statList[j].longestRush);
                receptions += parseInt(statList[j].receptions);
                receivingYards += parseInt(statList[j].receivingYards);
                receivingTouchdowns += parseInt(statList[j].receivingTouchdowns);
                receivingTargets += parseInt(statList[j].receivingTargets);
                if (parseInt(statList[j].longestReception) > longestReception) longestReception = parseInt(statList[j].longestReception);
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
                if (parseInt(statList[j].longestKickoffReturn) > longestKickoffReturn) longestKickoffReturn = parseInt(statList[j].longestKickoffReturn);
                puntReturns += parseInt(statList[j].puntReturns);
                puntReturnYards += parseInt(statList[j].puntReturnYards);
                puntReturnTouchdowns += parseInt(statList[j].puntReturnTouchdowns);
                if (parseInt(statList[j].longestPuntReturn) > longestPuntReturn) longestPuntReturn = parseInt(statList[j].longestPuntReturn);
                fieldGoalsMade += parseInt(statList[j].fieldGoalsMade);
                fieldGoalsAttempted += parseInt(statList[j].fieldGoalsAttempted);
                if (parseInt(statList[j].longestFieldGoal) > longestFieldGoal) longestFieldGoal = parseInt(statList[j].longestFieldGoal);
                extraPointsMade += parseInt(statList[j].extraPointsMade);
                extraPointsAttempted += parseInt(statList[j].extraPointsAttempted);
                kickingPoints += parseInt(statList[j].kickingPoints);
                punts += parseInt(statList[j].punts);
                puntYards += parseInt(statList[j].puntYards);
                puntTouchbacks += parseInt(statList[j].puntTouchbacks);
                puntsInside20 += parseInt(statList[j].puntsInside20);
                if (parseInt(statList[j].longestPunt) > longestPunt) longestPunt = parseInt(statList[j].longestPunt);
            }
        }

        passerRating = calculatePasserRating(passCompletions, passAttempts, passYards, passTouchdowns, passInterceptions);
        passYardsPerAttempt = passAttempts === 0 ? 0.0 : passYards / passAttempts;
        rushYardsPerAttempt = rushAttempts === 0 ? 0.0 : rushYards / rushAttempts;
        receivingYardsPerReception = receptions === 0 ? 0.0 : receivingYards / receptions;
        kickoffReturnYardsPerAttempt = kickoffReturns === 0 ? 0.0 : kickoffReturnYards / kickoffReturns;
        puntReturnYardsPerAttempt = puntReturns === 0 ? 0.0 : puntReturnYards / puntReturns;
        fieldGoalPercentage = fieldGoalsAttempted === 0 ? 0.0 : fieldGoalsMade / fieldGoalsAttempted;
        puntYardsPerAttempt = punts === 0 ? 0.0 : puntYards / punts;

        for (let j = 0; j < gameData.length; j++) {
            let weekString = String(gameData[j]['Week']);
            let weekNum = parseInt(weekString.split(' ')[1]);

            if (weekNum <= STAT_END_WEEK && gameData[j]['Home ID'] === teamList[i]) {
                gamesPlayed += 1;
                pointsFor += parseInt(gameData[j]['Away Score']);
                pointsAgainst += parseInt(gameData[j]['Home Score']);
            } else if (weekNum <= STAT_END_WEEK && gameData[j]['Away ID'] === teamList[i]) {
                gamesPlayed += 1;
                pointsFor += parseInt(gameData[j]['Home Score']);
                pointsAgainst += parseInt(gameData[j]['Away Score']);
            }
        }

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

    newStatList.sort((a, b) => a['Team ID'] - b['Team ID']);
    fs.writeFileSync('./NFL/data/teamAllowedStats.json', JSON.stringify(newStatList, null, 2));
}

function getDivision(teamID) {
    let rawData = fs.readFileSync('./NFL/data/divisions.json', 'utf-8');
    let divisions = JSON.parse(rawData);
    let team = divisions.find(x => x['ID'] === teamID);
    return `${team['Conference']} ${team['Division']}`;
}

function getConference(teamID) {
    let rawData = fs.readFileSync('./NFL/data/divisions.json', 'utf-8');
    let divisions = JSON.parse(rawData);
    let team = divisions.find(x => x['ID'] === teamID);
    return team['Conference'];
}

/**
 * Maps game outcomes across team schedules.
 */
async function updateSchedules() {
    let rawData = fs.readFileSync('./NFL/data/liveScoring.json', 'utf-8');
    let gameData = JSON.parse(rawData);

    rawData = fs.readFileSync('./NFL/data/teamList.json', 'utf-8');
    let teamList = JSON.parse(rawData);

    let schedules = [];
    for (let team in teamList) { 
        schedules.push({
            "Team ID": teamList[team].ID,
            "Week 1": null, "Week 2": null, "Week 3": null, "Week 4": null,
            "Week 5": null, "Week 6": null, "Week 7": null, "Week 8": null,
            "Week 9": null, "Week 10": null, "Week 11": null, "Week 12": null,
            "Week 13": null, "Week 14": null, "Week 15": null, "Week 16": null,
            "Week 17": null, "Week 18": null
        }); 
    }

    for (let game in gameData) {
        let homeTeam = schedules.find(x => x['Team ID'] === gameData[game]['Home ID']);
        let awayTeam = schedules.find(x => x['Team ID'] === gameData[game]['Away ID']);
        if (homeTeam) homeTeam[gameData[game]['Week']] = gameData[game];
        if (awayTeam) awayTeam[gameData[game]['Week']] = gameData[game];
    }

    fs.writeFileSync('./NFL/data/schedules.json', JSON.stringify(schedules, null, 2));
}

function getStreak(teamID) {
    let rawData = fs.readFileSync('./NFL/data/schedules.json', 'utf-8');
    let schedules = JSON.parse(rawData);

    let streakType = 'W';
    let streakLength = 0;
    let teamIndex = schedules.find(x => x['Team ID'] === teamID);
    if (!teamIndex) return "W0";

    for (let week in teamIndex) {
        if (!week.startsWith('Week ')) continue;
        let weekNum = parseInt(week.split(' ')[1]);

        try {
            if (weekNum <= STAT_END_WEEK && teamIndex[week] !== null) {
                let winner = teamIndex[week]['Winner'];
                if (winner === teamID) {
                    if (streakType === "W") { streakLength += 1; } 
                    else { streakType = "W"; streakLength = 1; }
                } else if (winner === "Tie") {
                    if (streakType === "T") { streakLength += 1; } 
                    else { streakType = "T"; streakLength = 1; }
                } else if (winner !== null) {
                    if (streakType === "L") { streakLength += 1; } 
                    else { streakType = "L"; streakLength = 1; }
                }
            }
        } catch (err) {
            // Ignore missing weeks
        }    
    }

    return `${streakType}${streakLength}`;
}

/**
 * Compiles team win/loss records and standings.
 */
async function generateStandings() {
    let standings = [];
    let rawData = fs.readFileSync('./NFL/data/teamList.json', 'utf-8');
    let teamList = JSON.parse(rawData);

    for (let team in teamList) {
        let teamID = teamList[team]['ID'];
        let win = getLiveScoringItem(teamID, "wins", "all");
        let los = getLiveScoringItem(teamID, "loss", "all");
        let tie = getLiveScoringItem(teamID, "ties", "all");
        let rec = `${win}-${los}-${tie}`;
        let gp = win + los + tie;
        let recDec = gp === 0 ? 0 : (win + tie / 2) / gp;

        win = getLiveScoringItem(teamID, "wins", "home");
        los = getLiveScoringItem(teamID, "loss", "home");
        tie = getLiveScoringItem(teamID, "ties", "home");
        let recHome = `${win}-${los}-${tie}`;
        let gpHome = win + los + tie;
        let recDecHome = gpHome === 0 ? 0 : (win + tie / 2) / gpHome;

        win = getLiveScoringItem(teamID, "wins", "away");
        los = getLiveScoringItem(teamID, "loss", "away");
        tie = getLiveScoringItem(teamID, "ties", "away");
        let recAway = `${win}-${los}-${tie}`;
        let gpAway = win + los + tie;
        let recDecAway = gpAway === 0 ? 0 : (win + tie / 2) / gpAway;

        win = getLiveScoringItem(teamID, "wins", "div");
        los = getLiveScoringItem(teamID, "loss", "div");
        tie = getLiveScoringItem(teamID, "ties", "div");
        let recDiv = `${win}-${los}-${tie}`;
        let gpDiv = win + los + tie;
        let recDecDiv = gpDiv === 0 ? 0 : (win + tie / 2) / gpDiv;

        win = getLiveScoringItem(teamID, "wins", "conf");
        los = getLiveScoringItem(teamID, "loss", "conf");
        tie = getLiveScoringItem(teamID, "ties", "conf");
        let recConf = `${win}-${los}-${tie}`;
        let gpConf = win + los + tie;
        let recDecConf = gpConf === 0 ? 0 : (win + tie / 2) / gpConf;

        let pf = getLiveScoringItem(teamID, "pf", "all");
        let pa = getLiveScoringItem(teamID, "pa", "all");
        let diff = pf - pa;

        standings.push({
            "Team ID": teamID,
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
            "Streak": getStreak(teamID)
        });
    }

    standings.sort((a, b) => a['Division'].localeCompare(b['Division']) || tieBreak(a, b));
    fs.writeFileSync('./NFL/data/standings.json', JSON.stringify(standings, null, 2));
}

function tieBreak(teamA, teamB) {
    return teamA['Team ID'] - teamB['Team ID'];
}

function getLiveScoringItem(teamID, item, type = "all") {
    let rawData = fs.readFileSync('./NFL/data/liveScoring.json', 'utf-8');
    let gameData = JSON.parse(rawData);
    let dataPoint = 0;

    for (let game in gameData) {
        let weekString = String(gameData[game]['Week']);
        let week = parseInt(weekString.split(' ')[1]);

        if (week <= STAT_END_WEEK) {
            if (gameData[game]['Home ID'] === teamID || gameData[game]['Away ID'] === teamID) {
                let isHome = gameData[game]['Home ID'] === teamID;
                let winner = gameData[game]['Winner'];

                if (item === "wins" && type === "all" && winner === teamID) dataPoint += 1;
                else if (item === "loss" && type === "all" && winner !== teamID && winner !== "Tie") dataPoint += 1;
                else if (item === "ties" && type === "all" && winner === "Tie") dataPoint += 1;
                else if (item === "pf" && type === "all") dataPoint += parseInt(isHome ? gameData[game]['Home Score'] : gameData[game]['Away Score']);
                else if (item === "pa" && type === "all") dataPoint += parseInt(isHome ? gameData[game]['Away Score'] : gameData[game]['Home Score']);
                
                else if (item === "wins" && type === "home" && isHome && winner === teamID) dataPoint += 1;
                else if (item === "loss" && type === "home" && isHome && winner !== teamID && winner !== "Tie") dataPoint += 1;
                else if (item === "ties" && type === "home" && isHome && winner === "Tie") dataPoint += 1;
                else if (item === "pf" && type === "home" && isHome) dataPoint += parseInt(gameData[game]['Home Score']);
                else if (item === "pa" && type === "home" && isHome) dataPoint += parseInt(gameData[game]['Away Score']);

                else if (item === "wins" && type === "away" && !isHome && winner === teamID) dataPoint += 1;
                else if (item === "loss" && type === "away" && !isHome && winner !== teamID && winner !== "Tie") dataPoint += 1;
                else if (item === "ties" && type === "away" && !isHome && winner === "Tie") dataPoint += 1;
                else if (item === "pf" && type === "away" && !isHome) dataPoint += parseInt(gameData[game]['Away Score']);
                else if (item === "pa" && type === "away" && !isHome) dataPoint += parseInt(gameData[game]['Home Score']);

                else {
                    let sameConf = getConference(gameData[game]['Away ID']) === getConference(gameData[game]['Home ID']);
                    let sameDiv = getDivision(gameData[game]['Away ID']) === getDivision(gameData[game]['Home ID']);

                    if (item === "wins" && type === "conf" && sameConf && winner === teamID) dataPoint += 1;
                    else if (item === "loss" && type === "conf" && sameConf && winner !== teamID && winner !== "Tie") dataPoint += 1;
                    else if (item === "ties" && type === "conf" && sameConf && winner === "Tie") dataPoint += 1;
                    else if (item === "pf" && type === "conf" && sameConf) dataPoint += parseInt(isHome ? gameData[game]['Home Score'] : gameData[game]['Away Score']);
                    else if (item === "pa" && type === "conf" && sameConf) dataPoint += parseInt(isHome ? gameData[game]['Away Score'] : gameData[game]['Home Score']);

                    else if (item === "wins" && type === "div" && sameDiv && winner === teamID) dataPoint += 1;
                    else if (item === "loss" && type === "div" && sameDiv && winner !== teamID && winner !== "Tie") dataPoint += 1;
                    else if (item === "ties" && type === "div" && sameDiv && winner === "Tie") dataPoint += 1;
                    else if (item === "pf" && type === "div" && sameDiv) dataPoint += parseInt(isHome ? gameData[game]['Home Score'] : gameData[game]['Away Score']);
                    else if (item === "pa" && type === "div" && sameDiv) dataPoint += parseInt(isHome ? gameData[game]['Away Score'] : gameData[game]['Home Score']);
                }
            }
        }
    }

    return dataPoint;
}

/**
 * Calculates team health scores based on depth chart positions and player injury reports.
 */
function getHealthScore(teamID) {
    let rawData = fs.readFileSync('./NFL/data/depthCharts.json', 'utf-8');
    let depthCharts = JSON.parse(rawData);
    let playerList = [];

    for (let position in depthCharts) {
        if (depthCharts[position]['Team'] === teamID) {
            let positionWeight = getPositionWeight(depthCharts[position]['Position']);
            let strings = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];
            let multipliers = [1.0, 0.8, 0.6, 0.4, 0.2];

            for (let idx = 0; idx < strings.length; idx++) {
                let playerID = depthCharts[position][strings[idx]];
                if (playerID !== null) {
                    let player = playerList.find(x => x['Player ID'] === playerID);
                    let weightedImpact = positionWeight * multipliers[idx];

                    if (player === undefined) {
                        playerList.push({
                            "Player ID": playerID,
                            "Impact Score": weightedImpact,
                            "Injury Score": getPlayerInjuryScore(playerID)                        
                        });
                    } else {
                        player['Impact Score'] += weightedImpact;
                    }
                }
            }
        }
    }

    let teamImpactScore = 0.0;
    let teamInjuryScore = 0.0;

    for (let player in playerList) {
        teamImpactScore += playerList[player]['Impact Score'];
        teamInjuryScore += (playerList[player]['Impact Score'] * playerList[player]['Injury Score']);
    }

    if (teamImpactScore === 0) return (1.0).toFixed(4);
    return (teamInjuryScore / teamImpactScore).toFixed(4);
}

function getPositionWeight(pos) {  
    switch (pos) {
        case "LDE": return 0.80;
        case "NT":  return 0.85;
        case "RDE": return 0.95;
        case "WLB": return 0.90;
        case "MLB": return 1.00;
        case "SLB": return 0.85;
        case "LCB": return 0.90;
        case "SS":  return 0.80;
        case "FS":  return 0.85;
        case "RCB": return 0.85;
        case "NB":  return 0.75;
        case "K":   return 0.50;
        case "P":   return 0.50;
        case "H":   return 0.25;
        case "PR":  return 0.65;
        case "KR":  return 0.70;
        case "LS":  return 0.50;
        case "WR":  return 0.85;
        case "LT":  return 0.95;
        case "LG":  return 0.80;
        case "C":   return 0.85;
        case "RG":  return 0.80;
        case "RT":  return 0.90;
        case "QB":  return 1.00;
        case "TE":  return 0.75;
        case "RB":  return 0.80;
        default: return 0.5;
    }
}

function getPlayerInjuryScore(playerID) {
    let rawData = fs.readFileSync('./NFL/data/injuryReport.json', 'utf-8');
    let injuryReport = JSON.parse(rawData);
    let injuryScoreIndex = injuryReport.find(x => x.playerID === playerID);

    if (injuryScoreIndex === undefined) { 
        return 1.0;
    } else {
        return parseFloat(injuryScoreIndex.playerScore);
    }
}

function aPercentB(a, b, power = 1) {
    let sum = Math.pow(parseFloat(a), power) + Math.pow(parseFloat(b), power);
    if (sum === 0) return 0.0;
    return (Math.pow(a, power) / sum).toFixed(4);
}

function predictionPercentage(teamA, teamB) {
    if (teamA === teamB) return 0.0;
    
    let rawData = fs.readFileSync('./NFL/data/teamStats.json', 'utf-8');
    let teamStats = JSON.parse(rawData);
    
    let teamADict = teamStats.find(x => x['Team ID'] === teamA);
    let teamAGamesPlayed = parseInt(teamADict['GP']);
    let teamAPointsFor = parseInt(teamADict['PF']) / teamAGamesPlayed;
    let teamATDPts = getTeamTDPtsPercentage(teamA, "for");
    let teamATA = (parseInt(teamADict['Int']) + (parseInt(teamADict['Recovered']) - (parseInt(teamADict['Fumble']) - parseInt(teamADict['Lost'])))) / teamAGamesPlayed;
    let teamAMom = getMomentum(getStreak(teamA), teamAGamesPlayed);
    let teamAHealthScore = getHealthScore(teamA);

    let teamBDict = teamStats.find(x => x['Team ID'] === teamB);
    let teamBGamesPlayed = parseInt(teamBDict['GP']);
    let teamBPointsFor = parseInt(teamBDict['PF']) / teamBGamesPlayed;
    let teamBTDPts = getTeamTDPtsPercentage(teamB, "for");
    let teamBTA = (parseInt(teamBDict['Int']) + (parseInt(teamBDict['Recovered']) - (parseInt(teamBDict['Fumble']) - parseInt(teamBDict['Lost'])))) / teamBGamesPlayed;
    let teamBMom = getMomentum(getStreak(teamB), teamBGamesPlayed);
    let teamBHealthScore = getHealthScore(teamB);

    rawData = fs.readFileSync('./NFL/data/teamAllowedStats.json', 'utf-8');
    teamStats = JSON.parse(rawData);

    teamADict = teamStats.find(x => x['Team ID'] === teamA);
    let teamAPointsAll = parseInt(teamADict['PF']) / teamAGamesPlayed;
    let teamATDPtsAll = getTeamTDPtsPercentage(teamA, "allowed");
    let teamATAAll = (parseInt(teamADict['Int']) + (parseInt(teamADict['Recovered']) - (parseInt(teamADict['Fumble']) - parseInt(teamADict['Lost'])))) / teamAGamesPlayed;

    teamBDict = teamStats.find(x => x['Team ID'] === teamB);
    let teamBPointsAll = parseInt(teamBDict['PF']) / teamBGamesPlayed;
    let teamBTDPtsAll = getTeamTDPtsPercentage(teamB, "allowed");
    let teamBTAAll = (parseInt(teamBDict['Int']) + (parseInt(teamBDict['Recovered']) - (parseInt(teamBDict['Fumble']) - parseInt(teamBDict['Lost'])))) / teamBGamesPlayed;

    let pointsForPercent = aPercentB(teamAPointsFor, teamBPointsFor);
    let pointsAllPercent = 1.0 - aPercentB(teamAPointsAll, teamBPointsAll);
    let takeawayPercent = aPercentB(teamATA, teamBTA);
    let turnoverPercent = 1.0 - aPercentB(teamATAAll, teamBTAAll);
    let touchdownPercent = aPercentB(teamATDPts, teamBTDPts);
    let touchdownAllPercent = 1.0 - aPercentB(teamATDPtsAll, teamBTDPtsAll);
    let momentumPercent = aPercentB(teamAMom, teamBMom);
    let healthPercent = aPercentB(teamAHealthScore, teamBHealthScore);  

    let percentSum = parseFloat(pointsForPercent) + parseFloat(pointsAllPercent) + parseFloat(takeawayPercent) + parseFloat(touchdownPercent) + parseFloat(turnoverPercent) + parseFloat(touchdownAllPercent) + parseFloat(momentumPercent) + parseFloat(healthPercent);
    let finalPercent = percentSum / 8;

    return finalPercent.toFixed(4);
}

function getMomentum(winStreak, gp) {    
    let base = 0.5;
    let multiplier = 0.0;
    
    if (winStreak.startsWith("W")) multiplier = 0.5;
    else if (winStreak.startsWith("L")) multiplier = -0.5;

    let value = gp === 0 ? 0 : parseInt(winStreak.substring(1)) / gp;
    return base + (multiplier * value);
}

/**
 * Generates Strength Based Power (SBP) ratings for teams based on match predictor percentages.
 */
function updateSBP() {
    let rawData = fs.readFileSync('./NFL/data/teamList.json', 'utf-8');
    let teamList = JSON.parse(rawData);

    let sbp = [];
    let max = 0.0;

    for (let teamY in teamList) {
        sbp.push({ "Team ID": teamList[teamY]['ID'] });
        let sum = 0.0;

        for (let teamX in teamList) {
            let pct = parseFloat(predictionPercentage(teamList[teamY]['ID'], teamList[teamX]['ID']));
            sbp[teamY][teamList[teamX]['ID']] = pct.toFixed(4);
            sum += pct;
        }

        sbp[teamY]['Total'] = sum.toFixed(4);
        if (sum > max) max = sum;
    }

    for (let team in sbp) {
        sbp[team]['SBP'] = max === 0 ? (0.0).toFixed(4) : (parseFloat(sbp[team]['Total']) / max).toFixed(4);
    }

    fs.writeFileSync('./NFL/data/sbp.json', JSON.stringify(sbp, null, 2));
}

function getTeamSBP(team) {
    let rawData = fs.readFileSync('./NFL/data/sbp.json', 'utf-8');
    let sbp = JSON.parse(rawData);
    let teamDict = sbp.find(x => x['Team ID'] === team);
    return teamDict ? teamDict['SBP'] : 0.0;
}

function getTeamTDPtsPercentage(team, type = "for") {
    let rawData;
    if (type === "for") {
        rawData = fs.readFileSync('./NFL/data/teamStats.json', 'utf-8');
    } else {
        rawData = fs.readFileSync('./NFL/data/teamAllowedStats.json', 'utf-8');
    }
    
    let stats = JSON.parse(rawData);
    let teamDict = stats.find(x => x['Team ID'] === team);
    if (!teamDict) return (0.0).toFixed(4);

    let pointsFor = parseInt(teamDict['PF']);
    let fieldGoals = parseInt(teamDict['FGM']);

    if (pointsFor === 0) return (0.0).toFixed(4);
    let pct = (pointsFor - (fieldGoals * 3)) / pointsFor;
    return pct.toFixed(4);
}

function pythagoreanExpectation(team) {
    let rawData = fs.readFileSync('./NFL/data/teamStats.json', 'utf-8');
    let stats = JSON.parse(rawData);
    let teamDict = stats.find(x => x['Team ID'] === team);
    if (!teamDict) return (0.0).toFixed(4);

    let pointsFor = parseInt(teamDict['PF']);
    let pointsAllowed = parseInt(teamDict['PA']);

    return aPercentB(pointsFor, pointsAllowed, PE_POWER);
}

function getTeamStrengthOfSchedule(team) {
    let rawData = fs.readFileSync('./NFL/data/schedules.json', 'utf-8');
    let schedules = JSON.parse(rawData);

    let sum = 0.0;
    let count = 0;
    let teamDict = schedules.find(x => x['Team ID'] === team);
    if (!teamDict) return (0.0).toFixed(4);

    for (let week in teamDict) {
        if (!week.startsWith('Week ')) continue;
        if (teamDict[week] !== null) {
            if (teamDict[week]['Status'] === "Final") {
                let opp = teamDict[week]['Home ID'] === team ? teamDict[week]['Away ID'] : teamDict[week]['Home ID'];
                count++;
                sum += parseFloat(getTeamSBP(opp));            
            }
        }
    }

    if (count === 0) return (0.0).toFixed(4);
    let avg = sum / count;
    return avg.toFixed(4);
}

/**
 * Calculates comprehensive power rankings using weighted team metrics.
 */
function updatePowerRankings() {
    let rawData = fs.readFileSync('./NFL/data/standings.json', 'utf-8');
    let standings = JSON.parse(rawData);
    let powerRankings = [];

    for (let currentTeam in standings) {
        let teamID = standings[currentTeam]['Team ID'];
        let record = parseFloat(standings[currentTeam]['Rec%']);
        let pyth = parseFloat(pythagoreanExpectation(teamID));
        let turnoverFactor = parseFloat(getTeamTurnoverFactor ? getTeamTurnoverFactor(teamID) : 0);
        let touchdownFactor = parseFloat(getTeamTDPtsPercentage(teamID));
        let sbp = parseFloat(getTeamSBP(teamID));
        let sos = parseFloat(getTeamStrengthOfSchedule(teamID));
        let momentum = parseFloat(getMomentum(standings[currentTeam]['Streak'], standings[currentTeam]['GP']));
        let health = parseFloat(getHealthScore(teamID));

        let rating = 
            record * RATING_WEIGHT_REC + 
            pyth * RATING_WEIGHT_PE + 
            turnoverFactor * RATING_WEIGHT_TOF + 
            touchdownFactor * RATING_WEIGHT_TDP + 
            sbp * RATING_WEIGHT_SBP + 
            sos * RATING_WEIGHT_SOS + 
            momentum * RATING_WEIGHT_MOM + 
            health * RATING_WEIGHT_HEALTH;

        powerRankings.push({
            'Rk': null,
            'Mv': null,
            'Team Name': standings[currentTeam]['Team Name'],
            'Record': record.toFixed(4),
            'Pyth%': pyth.toFixed(4),
            'SBP': sbp.toFixed(4),
            'TO Fact': turnoverFactor.toFixed(4),
            'TD Fact': touchdownFactor.toFixed(4),
            'SOS': sos.toFixed(4),
            'Mom': momentum.toFixed(4),
            'Health': health.toFixed(4),
            'Rating': rating.toFixed(4)            
        });
    }

    powerRankings.sort((a, b) => b['Rating'] - a['Rating']);

    // Assign ranking numbers, handling ties properly
    for (let t = 0; t < powerRankings.length; t++) {
        let currentRk = 0;
        
        if (t === 0) {
            currentRk = 1;

        } else if (powerRankings[t]['Rating'] === powerRankings[t-1]['Rating']) {
            currentRk = powerRankings[t-1]['Rk'];
        } else {
            currentRk = t + 1;
        }

        powerRankings[t]['Rk'] = currentRk;
        powerRankings[t]['Mv'] = updateTeamWeeklyRankingFile(powerRankings[t]['Team Name'], currentRk);
    }

    fs.writeFileSync('./NFL/data/powerRankings.json', JSON.stringify(powerRankings, null, 2));
}

function updateTeamWeeklyRankingFile(teamName, currentRk) {
    let rawData = fs.readFileSync('./NFL/data/weeklyRankings.json', 'utf-8');
    let weeklyRankings = JSON.parse(rawData);

    let team = weeklyRankings.find(x => x['Team Name'] === teamName);
    team[STAT_END_WEEK] = currentRk;

    let movement = 0;

    try {
        movement = parseInt(team[STAT_END_WEEK-1]) - parseInt(currentRk);
    } catch (err) {
        movement = 0;
    }

    let finalMovement = movement > 0 ? "+" + movement : movement < 0 ? movement : "---";

    fs.writeFileSync('./NFL/data/weeklyRankings.json', JSON.stringify(weeklyRankings, null, 2));

    return finalMovement;
}

function getTeamTurnoverFactor(team) {
    let rawData = fs.readFileSync('./NFL/data/teamStats.json', 'utf-8');
    let stats = JSON.parse(rawData);
    let teamDict = stats.find(x => x['Team ID'] === team);
    if (!teamDict) return 0.5;

    let takeaways = parseInt(teamDict['Int']) + (parseInt(teamDict['Recovered']) - (parseInt(teamDict['Fumble']) - parseInt(teamDict['Lost'])));
    let turnovers = parseInt(teamDict['Int Pass']) + parseInt(teamDict['Lost']);

    return aPercentB(takeaways, turnovers, TOF_POWER);
}

function predictedScore(teamA, teamB) {
    let rawData = fs.readFileSync('./NFL/data/teamStats.json', 'utf-8');
    let stats = JSON.parse(rawData);
    let teamDict = stats.find(x => x['Team ID'] === teamA);
    let pointsForA = parseInt(teamDict['PF']);
    let gamesPlayedA = parseInt(teamDict['GP']);
    let ppgA = parseFloat(pointsForA / gamesPlayedA);

    rawData = fs.readFileSync('./NFL/data/teamAllowedStats.json', 'utf-8');
    stats = JSON.parse(rawData);
    teamDict = stats.find(x => x['Team ID'] === teamB);
    let pointsAllB = parseInt(teamDict['PF']);
    let gamesPlayedB = parseInt(teamDict['GP']);
    let ppgAllB = parseFloat(pointsAllB / gamesPlayedB);

    let predPct = parseFloat(predictionPercentage(teamA, teamB));

    let healthScore = parseFloat(getHealthScore(teamA));

    let predictedPoints = ((ppgA + ppgAllB)/2) * predPct * healthScore * 2;

    return predictedPoints.toFixed(0);
}

/**
 * Builds the game view layout and prediction matrix for a given match week.
 */
function buildWeekView(weekNum = STAT_END_WEEK + 1) {
    let rawData = fs.readFileSync('./NFL/data/liveScoring.json', 'utf-8');
    let gameData = JSON.parse(rawData);
    let weekName = `Week ${weekNum}`;
    let count = 0;
    let weekSchedule = [];

    for (let game in gameData) {
        if (gameData[game]['Week'] === weekName) {
            count++; 

            let awayWinPct = parseFloat(predictionPercentage(gameData[game]['Away ID'], gameData[game]['Home ID']));
            let homeWinPct = 1.0 - awayWinPct;
            let predictedWinner = "Tie";
            if (awayWinPct > homeWinPct) predictedWinner = gameData[game]['Away Team'];
            else if (awayWinPct < homeWinPct) predictedWinner = gameData[game]['Home Team'];

            let awayScore = gameData[game]['Status'] === "Final" ? parseInt(gameData[game]['Away Score']) : null;
            let homeScore = gameData[game]['Status'] === "Final" ? parseInt(gameData[game]['Home Score']) : null
            let actualWinner = null;
            if (gameData[game]['Status'] === "Final") {
                if (awayScore > homeScore) actualWinner = gameData[game]['Away Team'];
                else if (awayScore < homeScore) actualWinner = gameData[game]['Home Team'];
                else actualWinner = "Tie";
            }

            let predCorrect = null;
            if (actualWinner !== null) {
                predCorrect = (actualWinner === predictedWinner) ? "WIN" : "LOSE";
            }

            weekSchedule.push({
                'Team': gameData[game]['Away Team'],
                'Win%': awayWinPct.toFixed(4),
                'PredScore': predictedScore(gameData[game]['Away ID'], gameData[game]['Home ID']),
                'FinalScore': awayScore,
                'Winner': actualWinner,
                'ML': gameData[game]['Away ML'],
                'Spread': teamSpread(gameData[game]['Away Team'], gameData[game]['Spread']),
                'Over/Under': "O/U"
            });

            weekSchedule.push({
                'Team': gameData[game]['Home Team'],
                'Win%': homeWinPct.toFixed(4),
                'PredScore': parseInt(predictedScore(gameData[game]['Home ID'], gameData[game]['Away ID'])) + HOME_FIELD,
                'FinalScore': homeScore,
                'Winner': predCorrect,
                'ML': gameData[game]['Home ML'],
                'Spread': teamSpread(gameData[game]['Home Team'], gameData[game]['Spread']),
                'Over/Under': gameData[game]['Over/Under']
            });
        }
    }

    fs.writeFileSync('./NFL/data/weekSchedule.json', JSON.stringify(weekSchedule, null, 2));
}

function getTeamAbbreviation(teamName) {
    let rawData = fs.readFileSync('./NFL/data/teamList.json', 'utf-8');
    let teamList = JSON.parse(rawData);

    return teamList.find(x => x['Name'] === teamName)['Abbr'];
}

function teamSpread(team, spread) {
    if(spread === null) return null;

    let splitSpread = spread.split(" ");

    if(splitSpread[0] === getTeamAbbreviation(team)) return spread;
    return getTeamAbbreviation(team) + " " + splitSpread[1].replace("-", "+");
}