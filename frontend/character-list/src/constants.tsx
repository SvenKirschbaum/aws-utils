import {DateTime} from "luxon";

export const REGIONS = ['eu', 'us', 'kr', 'tw'];

export const CLASSES = ['Death Knight', 'Demon Hunter', 'Druid', 'Evoker', 'Hunter', 'Mage', 'Monk', 'Paladin', 'Priest', 'Rogue', 'Shaman', 'Warlock', 'Warrior'];

export const FACTIONS = ['Alliance', 'Horde'];

export const GENDERS = ['Female', 'Male'];

export const RACES = ['Blood Elf', 'Dark Iron Dwarf', 'Dracthyr', 'Draenei', 'Dwarf', 'Earthen', 'Gnome', 'Goblin', 'Highmountain Tauren', 'Human', 'Kul Tiran', 'Lightforged Draenei', "Mag'har Orc", 'Mechagnome', 'Night Elf', 'Nightborne', 'Orc', 'Pandaren', 'Tauren', 'Troll', 'Undead', 'Void Elf', 'Vulpera', 'Worgen', 'Zandalari Troll'];

export const RAID_ABBREVIATIONS: {[key: number]: string} = {
    // 1273: 'Nerub-ar Palace'
};

export const DIFFUCULTY_ABBREVIATIONS: {[key: string]: string} = {
    'LFR': 'LFR',
    'NORMAL': 'NHC',
    'HEROIC': 'HC',
    'MYTHIC': 'M',
};

export const WEEKLY_RESET: {[key: string]: DateTime} = {
    "EU": DateTime.utc().startOf('week').set({ weekday: 3, hour: 4, minute: 0, second: 0, millisecond: 0 }),
    "US": DateTime.utc().startOf('week').set({ weekday: 2, hour: 15, minute: 0, second: 0, millisecond: 0 }),
    "KR": DateTime.utc().startOf('week').set({ weekday: 3, hour: 22, minute: 0, second: 0, millisecond: 0 }),
    "TW": DateTime.utc().startOf('week').set({ weekday: 3, hour: 22, minute: 0, second: 0, millisecond: 0 }),
};

//Update Reset times if they are in the future
for (const REGION in WEEKLY_RESET) {
    if(DateTime.utc() < WEEKLY_RESET[REGION]) {
        WEEKLY_RESET[REGION] = WEEKLY_RESET[REGION].minus({weeks: 1});
    }
}