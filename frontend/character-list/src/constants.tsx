import {DateTime} from "luxon";

export const REGIONS = ['eu', 'us', 'kr', 'tw']
export const RAID_ABBREVIATIONS: {[key: number]: string} = {
    1200: 'VOTI',
    1208: 'ATSC',
    1207: 'ATDH',
}

export const DIFFUCULTY_ABBREVIATIONS: {[key: string]: string} = {
    'LFR': 'LFR',
    'NORMAL': 'NHC',
    'HEROIC': 'HC',
    'MYTHIC': 'M',
}

export const WEEKLY_RESET: {[key: string]: DateTime} = {
    "EU": DateTime.utc().startOf('week').set({ weekday: 3, hour: 4, minute: 0, second: 0, millisecond: 0 }),
    "US": DateTime.utc().startOf('week').set({ weekday: 2, hour: 15, minute: 0, second: 0, millisecond: 0 }),
    "KR": DateTime.utc().startOf('week').set({ weekday: 3, hour: 22, minute: 0, second: 0, millisecond: 0 }),
    "TW": DateTime.utc().startOf('week').set({ weekday: 3, hour: 22, minute: 0, second: 0, millisecond: 0 }),
}

for (const REGION in WEEKLY_RESET) {
    if(DateTime.utc() < WEEKLY_RESET[REGION]) {
        WEEKLY_RESET[REGION] = WEEKLY_RESET[REGION].minus({weeks: 1});
    }
}