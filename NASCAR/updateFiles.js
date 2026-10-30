const fs = require('fs');
const CUP_SERIES_ID = 1;
const CUP_SERIES_NAME = "NCS";
const BUSCH_SERIES_ID = 2;
const BUSCH_SERIES_NAME = "NOAPS";
const TRUCK_SERIES_ID = 3;
const TRUCK_SERIES_NAME = "NCTS";
const SEASON = 2026;
const SCHEDULE_URL_BASE = "https://cf.nascar.com/cacher/";
const SCHEDULE_URL_END = "/race_list_basic.json";
const RACE_DATA_URL_START = "https://cf.nascar.com/loopstats/prod/";
const RACE_DATA_URL_END = ".json";
const STAGE_DATA_URL_START = "https://cf.nascar.com/cacher/";
const STAGE_DATA_URL_END = "/weekend-feed.json";
const TODAY = new Date();

main();

async function main(){
    console.log("Fetching new schedule...");
    await fetchSchedule();
    console.log("Fetching race data...");
    await fetchRaceData();
}

// This function hits up NASCAR's API to fetch the schedule json, 
async function fetchSchedule(season = SEASON) {
    let schedule = [];

    // Try: Fetch the json and record information
    try {
        for(let series = 1; series <= 3; series++){
            let url = `${SCHEDULE_URL_BASE}${season}/${series}${SCHEDULE_URL_END}`;
            let res = await fetch(url);
            let data = await res.json(); // FIXED: Added await here

            // Depending on NASCAR's structure, data might be an array or an object of races.
            // If data is an array, standard for...of or .forEach is cleaner:
            for(let raceItem of data) {
                let seriesID = raceItem.series_id;
                let seriesName = convertSeriesName(String(raceItem.series_id));
                let raceID = raceItem.race_id;
                let raceDate = raceItem.race_date ? new Date(raceItem.race_date) : "";
                let raceName = raceItem.race_name;
                let raceType = convertRaceType(String(raceItem.race_type_id));
                let trackName = raceItem.track_name;
                let schedDist = raceItem.scheduled_distance;
                let actDist = raceItem.actual_distance;
                let schedLaps = raceItem.scheduled_laps;
                let actLaps = raceItem.actual_laps;
                let s1Laps = raceItem.stage_1_laps;
                let s2Laps = raceItem.stage_2_laps;
                let s3Laps = raceItem.stage_3_laps;
                let numEntries = raceItem.number_of_cars_in_field;
                let poleWinnerID = raceItem.pole_winner_driver_id;
                let poleSpeed = raceItem.pole_winner_speed;
                let leadChanges = raceItem.number_of_lead_changes;
                let numLeaders = raceItem.number_of_leaders;
                let numCautions = raceItem.number_of_cautions;
                let cautionLaps = raceItem.number_of_caution_laps;

                schedule.push({
                    'Series ID': seriesID,
                    'Series': seriesName,
                    'Race ID': raceID,
                    'Date': raceDate,
                    'Type': raceType,
                    'Race Name': raceName,
                    'Track': trackName,
                    'Scheduled Distance': schedDist,
                    'Actual Distance': actDist,
                    'Scheduled Laps': schedLaps,
                    'Actual Laps': actLaps,
                    'Stg 1': s1Laps,
                    'Stg 2': s2Laps,
                    'Stg 3': s3Laps,
                    'Entries': numEntries,
                    'Pole': poleWinnerID,
                    'Pole Spd': poleSpeed,
                    'Lead Chg': leadChanges,
                    'Leaders': numLeaders,
                    'Caut': numCautions,
                    'Caut Laps': cautionLaps
                });
            }
        }
    } catch (err) {
        console.error("Failed to fetch schedule data: " + err);
    }

    // FIXED: Properly parse dates for comparison
    schedule.sort((a, b) => new Date(a.Date) - new Date(b.Date));

    // Make sure the target directory exists before writing, or fs.writeFileSync will throw an error if the folder is missing
    fs.writeFileSync('./NASCAR/data/schedules.json', JSON.stringify(schedule, null, 2));
}

async function fetchRaceData(season = SEASON){
    // Get schedule
    let rawData = fs.readFileSync('./NASCAR/data/schedules.json', 'utf-8');
    let schedule = JSON.parse(rawData);

    // Results array
    let results = [];

    // Iterate through schedule
    for(let date in schedule) {
        if(new Date(schedule[date]['Date']) < TODAY){
            let url = `${RACE_DATA_URL_START}${season}/${schedule[date]['Series ID']}/${schedule[date]['Race ID']}${RACE_DATA_URL_END}`;
            let res = await fetch(url);
            let raceData = await res.json();
            let driverList = raceData[0].drivers;

            url = `${STAGE_DATA_URL_START}${season}/${schedule[date]['Series ID']}/${schedule[date]['Race ID']}${STAGE_DATA_URL_END}`;
            res = await fetch(url);
            let stageData = await res.json();
            let stageDataDriverList = stageData.weekend_race[0].results;

            for(let d = 0; d < driverList.length; d++){
                let driverID = stageDataDriverList[d].driver_id ? stageDataDriverList[d].driver_id : "";
                let driverName = stageDataDriverList[d].driver_fullname ? stageDataDriverList[d].driver_fullname : "";
                let pointsEarned = stageDataDriverList[d].points_earned ? stageDataDriverList[d].points_earned : "";
                let startPOS = driverList[d]['start_ps'] ? driverList[d]['start_ps'] : "";
                let finishPOS = driverList[d]['ps'] ? driverList[d]['ps'] : "";
                let hiPOS = driverList[d]['best_ps'] ? driverList[d]['best_ps'] : "";
                let loPOS = driverList[d]['worst_ps'] ? driverList[d]['worst_ps'] : "";
                let avgPOS = driverList[d]['avg_ps'] ? driverList[d]['avg_ps'] : "";
                let gfPasses = driverList[d]['passes_gf'] ? driverList[d]['passes_gf'] : "";
                let gfPassed = driverList[d]['passed_gf'] ? driverList[d]['passed_gf'] : "";
                let diffGFPass = driverList[d]['passing_diff'] ? driverList[d]['passing_diff'] : "";
                let qPasses = driverList[d]['quality_passes'] ? driverList[d]['quality_passes'] : "";
                let closeDiff = driverList[d]['closing_laps_diff'] ? driverList[d]['closing_laps_diff'] : "";
                let lapsRun = driverList[d]['laps'] ? driverList[d]['laps'] : "";
                let t15Laps = driverList[d]['top15_laps'] ? driverList[d]['top15_laps'] : "";
                let leadLaps = driverList[d]['lead_laps'] ? driverList[d]['lead_laps'] : "";
                let fastLaps = driverList[d]['fast_laps'] ? driverList[d]['fast_laps'] : "";
                let closePOS = driverList[d]['closing_ps'] ? driverList[d]['closing_ps'] : "";
                let midPOS = driverList[d]['mid_ps'] ? driverList[d]['mid_ps'] : "";

                results.push({
                    'RaceID': schedule[date]['Race ID'],
                    'ID': driverID,
                    'Name': driverName,
                    'Pts': pointsEarned,
                    'St': startPOS,
                    'Fn': finishPOS,
                    'Laps': lapsRun,
                    'T15': t15Laps,
                    'Lead': leadLaps,
                    'Fast': fastLaps,
                    'Best': hiPOS,
                    'Worst': loPOS,
                    'Avg': avgPOS,
                    'GF Passes': gfPasses,
                    'GF Passed': gfPassed,
                    'PassDiff': diffGFPass,
                    'Quality': qPasses,
                    'Close Diff': closeDiff,
                    'Close POS': closePOS,
                    'Mid POS': midPOS
                });
            }
        }
    }

    // Make sure the target directory exists before writing, or fs.writeFileSync will throw an error if the folder is missing
    fs.writeFileSync('./NASCAR/data/raceData.json', JSON.stringify(results, null, 2));
}

function convertSeriesName(seriesID) {
    switch(seriesID){
        case "1": return CUP_SERIES_NAME;
        case "2": return BUSCH_SERIES_NAME;
        case "3": return TRUCK_SERIES_NAME;
        default: return "INVALID_SERIES_ID";
    }
}

function convertRaceType(raceTypeID) {
    switch(raceTypeID) {
        case "1": return "Pts";
        case "2": return "Exb";
        default: return "INVALID_RACE_TYPE";
    }
}