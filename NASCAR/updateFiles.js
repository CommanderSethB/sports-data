const fs = require('fs');
const CUP_SERIES_ID = 1;
const CUP_SERIES_ABBR = "NCS";
const CUP_SERIES_NAME = "Cup Series";
const BUSCH_SERIES_ID = 2;
const BUSCH_SERIES_ABBR = "NOAPS";
const BUSCH_SERIES_NAME = "O'Reilly Auto Parts Series";
const TRUCK_SERIES_ID = 3;
const TRUCK_SERIES_ABBR = "NCTS";
const TRUCK_SERIES_NAME = "Craftsman Truck Series";
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
    console.log("Building results tables...");
    buildResults();
    console.log("All files updated successfully.");
}

// This function hits up NASCAR's API to fetch the schedule json, 
async function fetchSchedule(season = SEASON) {
    let schedule = {};
    let cupSchedule = [];
    let buschSchedule = [];
    let truckSchedule = [];

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

                switch(seriesID){
                    case 1: 
                        cupSchedule.push({
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
                        break;
                    case 2:
                        buschSchedule.push({
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
                        break;
                    case 3:
                        truckSchedule.push({
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
                        break;
                }
            }
        }
    } catch (err) {
        console.error("Failed to fetch schedule data: " + err);
    }

    

    // FIXED: Properly parse dates for comparison
    cupSchedule.sort((a, b) => new Date(a.Date) - new Date(b.Date));
    buschSchedule.sort((a, b) => new Date(a.Date) - new Date(b.Date));
    truckSchedule.sort((a, b) => new Date(a.Date) - new Date(b.Date));

    schedule[`${CUP_SERIES_NAME}`] = cupSchedule;
    schedule[`${BUSCH_SERIES_NAME}`] = buschSchedule;
    schedule[`${TRUCK_SERIES_NAME}`] = truckSchedule;

    // Make sure the target directory exists before writing, or fs.writeFileSync will throw an error if the folder is missing
    fs.writeFileSync('./NASCAR/data/schedules.json', JSON.stringify(schedule, null, 2));
}

async function fetchRaceData(season = SEASON){
    // Get schedule
    let rawData = fs.readFileSync('./NASCAR/data/schedules.json', 'utf-8');
    let schedule = JSON.parse(rawData);

    // Results array
    let cupResults = [], buschResults = [], truckResults = [];
    let results = {};

    // Iterate through schedule
    for(let key in schedule) {
        for(let date in schedule[key]) {
            if(new Date(schedule[key][date]['Date']) < TODAY){
                let url = `${RACE_DATA_URL_START}${season}/${schedule[key][date]['Series ID']}/${schedule[key][date]['Race ID']}${RACE_DATA_URL_END}`;
                let res = await fetch(url);
                let raceData = await res.json();
                let driverList = raceData[0].drivers;

                url = `${STAGE_DATA_URL_START}${season}/${schedule[key][date]['Series ID']}/${schedule[key][date]['Race ID']}${STAGE_DATA_URL_END}`;
                res = await fetch(url);
                let stageData = await res.json();
                let stageDataDriverList = stageData.weekend_race[0].results;

                for(let d = 0; d < driverList.length; d++){
                    let driverID = driverList[d].driver_id ? driverList[d].driver_id : "";
                    let driverName = stageDataDriverList.find(x => x['driver_id'] === driverID)['driver_fullname'] ? stageDataDriverList.find(x => x['driver_id'] === driverID)['driver_fullname'] : "";
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

                    switch(schedule[key][date]['Series ID']){
                        case 1:
                            cupResults.push({
                                'RaceID': schedule[key][date]['Race ID'],
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
                            break;
                        case 2:
                            buschResults.push({
                                'RaceID': schedule[key][date]['Race ID'],
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
                            break;
                        case 3:
                            truckResults.push({
                                'RaceID': schedule[key][date]['Race ID'],
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
                            break;
                    }
                }
            }
        }
    }

    results[`${CUP_SERIES_NAME}`] = cupResults;
    results[`${BUSCH_SERIES_NAME}`] = buschResults;
    results[`${TRUCK_SERIES_NAME}`] = truckResults;

    // Make sure the target directory exists before writing, or fs.writeFileSync will throw an error if the folder is missing
    fs.writeFileSync('./NASCAR/data/raceData.json', JSON.stringify(results, null, 2));
}

function convertSeriesName(seriesID) {
    switch(seriesID){
        case "1": return CUP_SERIES_ABBR;
        case "2": return BUSCH_SERIES_ABBR;
        case "3": return TRUCK_SERIES_ABBR;
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

function buildResults() {
    try {
        // Read the file synchronously
        let rawData = fs.readFileSync('./NASCAR/data/raceData.json', 'utf8');
        const raceData = JSON.parse(rawData);

        rawData = fs.readFileSync('./NASCAR/data/schedules.json', 'utf-8');
        const schedules = JSON.parse(rawData);

        const resultsBySeries = {};

        // Iterate through each series (e.g., "Cup Series")
        for (const [seriesName, entries] of Object.entries(raceData)) {
            const driverMap = {};
            const seriesSchedule = schedules[seriesName] || [];
            
            // Pre-calculate all race keys for completed races
            const allRaceKeys = seriesSchedule.map(raceItem => {
                const raceId = raceItem['Race ID'];
                const trackInitials = raceItem['Track'].split(' ').map(c => c.charAt(0).toUpperCase()).join('');
                return { raceId, key: `${trackInitials}-${raceId}` };
            });

            // Initialize every driver found in entries and ensure all race keys exist
            entries.forEach(entry => {
                const driverName = entry.Name;
                if (!driverMap[driverName]) {
                    driverMap[driverName] = { Name: driverName };
                    // Default all race keys to "" so missing races are included
                    allRaceKeys.forEach(({ key }) => {
                        driverMap[driverName][key] = "";
                    });
                }
            });

            // Populate actual finish positions for races the driver participated in
            entries.forEach(entry => {
                const raceId = entry.RaceID;
                const driverName = entry.Name;
                const finishPosition = entry.Fn;

                const raceInfo = seriesSchedule.find(x => x['Race ID'] === raceId);
                if (raceInfo) {
                    const trackInitials = raceInfo['Track'].split(' ').map(c => c.charAt(0).toUpperCase()).join('');
                    const key = `${trackInitials}-${raceId}`;

                    if (driverMap[driverName]) {
                        driverMap[driverName][key] = finishPosition;
                    }
                }
            });

            // Convert the lookup object into an array of driver objects for this series
            resultsBySeries[seriesName] = Object.values(driverMap);
        }

        // Write the resulting JSON to the output file synchronously
        fs.writeFileSync('./NASCAR/data/results.json', JSON.stringify(resultsBySeries, null, 2), 'utf8');

    } catch (error) {
        console.error('Error processing race data:', error);
    }
}