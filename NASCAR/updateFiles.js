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

main();

async function main(){
    await fetchSchedule();
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
                let seriesName = convertSeriesName(String(raceItem.series_id));
                let raceID = raceItem.race_id;
                let raceDate = raceItem.race_date ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(raceItem.race_date)) : "";
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