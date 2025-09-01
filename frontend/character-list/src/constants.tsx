import {DateTime} from "luxon";

export const REGIONS = ['eu', 'us', 'kr', 'tw'];

export const CLASSES = ['Death Knight', 'Demon Hunter', 'Druid', 'Evoker', 'Hunter', 'Mage', 'Monk', 'Paladin', 'Priest', 'Rogue', 'Shaman', 'Warlock', 'Warrior'];

export const FACTIONS = ['Alliance', 'Horde'];

export const GENDERS = ['Female', 'Male'];

export const RACES = ['Blood Elf', 'Dark Iron Dwarf', 'Dracthyr', 'Draenei', 'Dwarf', 'Earthen', 'Gnome', 'Goblin', 'Highmountain Tauren', 'Human', 'Kul Tiran', 'Lightforged Draenei', "Mag'har Orc", 'Mechagnome', 'Night Elf', 'Nightborne', 'Orc', 'Pandaren', 'Tauren', 'Troll', 'Undead', 'Void Elf', 'Vulpera', 'Worgen', 'Zandalari Troll'];

export const SPECS = ['Affliction', 'Arcane', 'Arms', 'Assassination', 'Augmentation', 'Balance', 'Beast Mastery', 'Blood', 'Brewmaster', 'Demonology', 'Destruction', 'Devastation', 'Discipline', 'Elemental', 'Enhancement', 'Feral', 'Fire', 'Frost', 'Fury', 'Guardian', 'Havoc', 'Holy', 'Marksmanship', 'Mistweaver', 'Outlaw', 'Preservation', 'Protection', 'Restoration', 'Retribution', 'Shadow', 'Subtlety', 'Survival', 'Unholy', 'Vengeance', 'Windwalker'];

export const RAID_ABBREVIATIONS: {[key: number]: string} = {
    1273: 'NP',
    1296: 'LoU',
    1302: 'MfO',
};

export const LATEST_RAID = 1302;

export const CURRENT_SETS = new Set([1926, 1930, 1929, 1960, 1921, 1923, 1931, 1920, 1927, 1924, 1919, 1928, 1925, 1922/*,  Test  1875*/]);

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