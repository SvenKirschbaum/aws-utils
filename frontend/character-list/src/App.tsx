import {createContext, Dispatch, SetStateAction, useCallback, useContext, useEffect, useMemo, useState} from 'react'
import './App.css'
import {Outlet, useLoaderData, useNavigate, useNavigation, useParams} from "react-router";
import {
    Box,
    Button,
    CircularProgress,
    Container,
    createTheme,
    CssBaseline,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    FormGroup, FormLabel,
    Link,
    MenuItem,
    Select,
    Stack,
    Switch,
    ThemeProvider,
    Tooltip,
    useMediaQuery
} from "@mui/material";
import {
    DataGrid,
    GridColDef,
    GridFooter,
    GridFooterContainer,
    GridRowModel,
    useGridApiRef,
    GridInitialState
} from "@mui/x-data-grid";
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import RaiderIOIcon from './assets/raider-io-icon.svg?react'
import WoWIcon from './assets/wow-icon.svg?react'
import wclLogoUrl from './assets/wcl-icon.png'
import {createBrowserRouter, redirect, redirectDocument, RouterProvider} from "react-router-dom";
import {ErrorBoundary} from "react-error-boundary";
import {
    CLASSES, CURRENT_SETS,
    DIFFUCULTY_ABBREVIATIONS,
    FACTIONS, GENDERS, LATEST_RAID,
    RACES,
    RAID_ABBREVIATIONS,
    REGIONS, SPECS,
    WEEKLY_RESET
} from "./constants.tsx";
import {DateTime} from "luxon";

const router = createBrowserRouter([
    {
        Component: LoadingWrapper,
        hydrateFallbackElement: <LoadingIndicator />,
        children: [
            {
                path: '/:region?',
                loader: async ({params}) => {
                    if (!params.region || !REGIONS.includes(params.region)) {
                        return redirect('/eu')
                    }

                    const response = await fetch(`/api/characters/${params.region}`)

                    if(response.status === 401) {
                        return redirectDocument('/api/auth/start')
                    }

                    if(!response.ok) {
                        throw response;
                    }

                    return response;
                },
                Component: CharacterList,
            }
        ]
    },
])

declare interface Settings {
    showOnlyLatestRaid: boolean
    showLFR: boolean
    showNormal: boolean
    showHeroic: boolean
    showMythic: boolean
}

declare interface SettingsContextType extends Settings {
    updateSettings: Dispatch<SetStateAction<Settings>>
}

const SettingsContext = createContext({} as SettingsContextType);

function App() {
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)') || true; // Light mode doesn't work well with class colors.

    const theme = useMemo(() =>
            createTheme({
                    palette: {
                        mode: prefersDarkMode ? 'dark' : 'light'
                    }
                }
            ),
        [prefersDarkMode]
    );

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline/>
            <Container maxWidth={"xl"} sx={{
                marginTop: '2.5vh',
                marginBottom: '2.5vh',
                height: '95vh',
            }}>
                <RouterProvider
                    router={router}
                />
            </Container>
        </ThemeProvider>
    );
}

// Increment this number to discard all existing saved grid configurations
const GRID_CONFIG_VERSION = 3;

const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', headerAlign: 'center', cellClassName: (params) => `color-class-${params.row.classId}`},
    { field: 'level', headerName: 'Level', headerAlign: 'center', type: 'number'},
    { field: 'guild', headerName: 'Guild', headerAlign: 'center', cellClassName: (params) => `color-faction-${params.row.guildFactionType}`},
    { field: 'className', headerName: 'Class', headerAlign: 'center', type: 'singleSelect', valueOptions: CLASSES, cellClassName: (params) => `color-class-${params.row.classId}`},
    { field: 'equippedItemLevel', headerName: 'Item Level', headerAlign: 'center', type: 'number' },
    { field: 'averageItemLevel', headerName: 'Item Level (Average)', headerAlign: 'center', type: 'number' },
    { field: 'set', headerName: 'Set', headerAlign: 'center', filterable: false, sortable: false, renderCell: (params) => <SetWrapper {...params} />},
    { field: 'mythicRating', headerName: 'M+ Rating', headerAlign: 'center', type: 'number', renderCell: (params) => <MythicRating rating={params.row.mythicRating} color={params.row.mythicRatingColor}></MythicRating>},
    { field: 'realm', headerName: 'Realm', headerAlign: 'center' },
    { field: 'factionName', headerName: 'Faction', headerAlign: 'center', type: 'singleSelect', valueOptions: FACTIONS, cellClassName: (params) => `color-faction-${params.row.factionType}`},
    { field: 'race', headerName: 'Race', headerAlign: 'center', type: 'singleSelect', valueOptions: RACES},
    { field: 'gender', headerName: 'Gender', headerAlign: 'center', type: 'singleSelect', valueOptions: GENDERS},
    { field: 'account', headerName: 'Account', headerAlign: 'center', type: 'number'},
    { field: 'spec', headerName: 'Spec', headerAlign: 'center', type: 'singleSelect', valueOptions: SPECS},
    { field: 'achievementPoints', headerName: 'Achievement Points', headerAlign: 'center', type: 'number'},
    { field: 'lastLogin', headerName: 'Last Login', headerAlign: 'center', type: 'dateTime', valueGetter: (v) => v && new Date(v)},
    { field: 'mythicPlusHighestRuns', headerName: 'M+ Vault', headerAlign: 'center', filterable: false, sortable: false, renderCell: (params) => <MPlusStatusWrapper runs={params.value} />},
    { field: 'raids', headerName: 'Raid IDs', headerAlign: 'center', filterable: false, sortable: false, renderCell: (params) => <RaidStatusWrapper {...params} />},
    { field: 'false', headerName: 'Links', headerAlign: 'center', filterable: false, sortable: false, renderCell: (params) => <CharacterLinks name={params.row.name.toLowerCase()} realmSlug={params.row.realmSlug} />},
];

const defaultState: GridInitialState = {
    pagination: { paginationModel: { pageSize: 15 } },
    columns: {
        columnVisibilityModel: {
            account: false,
            gender: false,
            spec: false,
            achievementPoints: false,
            lastLogin: false,
            averageItemLevel: false
        }
    },
}

const defaultSettings: Settings = {
    showOnlyLatestRaid: true,
    showLFR: false,
    showNormal: true,
    showHeroic: true,
    showMythic: true,
}

function CharacterList() {
    const data: {
        profile: any,
        raids: {[char: string]: any[]},
        characterProfile: {[char: string]: any},
        characterEquipment: {[char: string]: any},
        mythicKeystoneProfile: {[char: string]: any},
        raiderIOProfile: {[char: string]: any},
    } = useLoaderData() as any;
    const apiRef = useGridApiRef();
    const [key, setKey] = useState(0);
    const [settings, updateSettings] = useState<Settings>(defaultSettings);

    //Restore saved state
    useEffect(() => {
        if(apiRef.current === null) return;
        const storedStateString = localStorage.getItem('gridState');
        const storedSettingString = localStorage.getItem('settings');
        if(storedStateString) {
            const storedState = JSON.parse(storedStateString);

            if(storedState.version !== GRID_CONFIG_VERSION) {
                localStorage.removeItem('gridState');
            } else {
                apiRef.current.restoreState(storedState);
            }
        }
        if(storedSettingString) {
            const storedSettings = JSON.parse(storedSettingString);
            updateSettings((s) => ({
                ...s,
                ...storedSettings
            }));
        }
    }, []);

    //Save state on unload
    const saveState = useCallback(() => {
        if(apiRef.current === null) return;
        localStorage.setItem('gridState', JSON.stringify({...apiRef.current.exportState(), version: GRID_CONFIG_VERSION}));
        localStorage.setItem('settings', JSON.stringify(settings));
    }, [settings]);

    useEffect(() => {
        window.addEventListener('beforeunload', saveState);
        return () => {
            window.removeEventListener('beforeunload', saveState);
        };
    }, [settings]);

    const rows: GridRowModel[] = useMemo(() => {
        const r: GridRowModel[] = [];

        data.profile.wow_accounts.forEach((account: any, accountIndex: number) => {
            account.characters.forEach((character: any) => {
                r.push({
                    // Account profile data
                    id: character.id,
                    account: accountIndex+1,
                    name: character.name,
                    level: character.level,
                    classId: character.playable_class.id,
                    className: character.playable_class.name,
                    realm: character.realm.name,
                    realmSlug: character.realm.slug,
                    factionName: character.faction.name,
                    factionType: character.faction.type,
                    race: character.playable_race.name,
                    gender: character.gender.name,
                    // Raid Encounter data
                    raids: data.raids?.[`${character.name.toLowerCase()}-${character.realm.slug}`],
                    // Character Profile data
                    spec: data.characterProfile?.[`${character.name.toLowerCase()}-${character.realm.slug}`]?.active_spec.name,
                    guild: data.characterProfile?.[`${character.name.toLowerCase()}-${character.realm.slug}`]?.guild?.name,
                    guildFactionType: data.characterProfile?.[`${character.name.toLowerCase()}-${character.realm.slug}`]?.guild?.faction?.type,
                    achievementPoints: data.characterProfile?.[`${character.name.toLowerCase()}-${character.realm.slug}`]?.achievement_points,
                    lastLogin: data.characterProfile?.[`${character.name.toLowerCase()}-${character.realm.slug}`]?.last_login_timestamp,
                    equippedItemLevel: data.characterProfile?.[`${character.name.toLowerCase()}-${character.realm.slug}`]?.equipped_item_level,
                    averageItemLevel: data.characterProfile?.[`${character.name.toLowerCase()}-${character.realm.slug}`]?.average_item_level,
                    // Character Equipment data
                    set: data.characterEquipment?.[`${character.name.toLowerCase()}-${character.realm.slug}`],
                    // Mythic Keystone Profile data
                    mythicRating: data.mythicKeystoneProfile?.[`${character.name.toLowerCase()}-${character.realm.slug}`]?.current_mythic_rating?.rating,
                    mythicRatingColor: data.mythicKeystoneProfile?.[`${character.name.toLowerCase()}-${character.realm.slug}`]?.current_mythic_rating?.color,
                    // RaiderIO Profile data
                    mythicPlusHighestRuns: data.raiderIOProfile?.[`${character.name.toLowerCase()}-${character.realm.slug}`]?.mythic_plus_weekly_highest_level_runs,
                    // Calculated Data
                    sort: character.level*10000 + (data.characterProfile?.[`${character.name.toLowerCase()}-${character.realm.slug}`]?.equipped_item_level || 0)
                });
            });
        });

        r.sort((a: any, b: any) => b.sort - a.sort);

        return r;
    }, [data]);

    return (
        <SettingsContext value={{
            ...settings,
            updateSettings
        }}>
            <DataGrid
                key={key}
                apiRef={apiRef}
                sx={{
                    '& .MuiDataGrid-cell': {
                        padding: '0.5em',
                        textAlign: 'center',
                    },
                }}
                disableColumnSelector={false}
                rows={rows}
                columns={columns}
                initialState={defaultState}
                autosizeOnMount={true}
                autosizeOptions={{
                    expand: true,
                    includeHeaders: false,
                    includeOutliers: true
                }}
                autoPageSize={false}
                autoHeight={true}
                getRowHeight={() => 'auto'}
                pageSizeOptions={[15]}
                slots={{
                    footer: Footer
                }}
                slotProps={{
                    footer: {
                        setKey,
                    } as any
                }}
            />
        </SettingsContext>
    );
}

function RaidStatusWrapper(props: any) {
    return (
        <ErrorBoundary fallback={<span>Error</span>}>
            <RaidStatus {...props} />
        </ErrorBoundary>
    )
}

function RaidStatus(props: {value: any}) {
    const settings = useContext(SettingsContext);

    if(!props.value) {
        return "";
    }

    const instances = props.value.map((instance: any) => {
        const modes = instance.modes
            .filter((mode: any) => mode.difficulty.type != "LFR" || settings.showLFR)
            .filter((mode: any) => mode.difficulty.type != "NORMAL" || settings.showNormal)
            .filter((mode: any) => mode.difficulty.type != "HEROIC" || settings.showHeroic)
            .filter((mode: any) => mode.difficulty.type != "MYTHIC" || settings.showMythic)

        return {
            ...instance,
            modes
        }
    }).filter((instance: any) => instance.modes.length > 0);

    return (
        <div className={'raid-status'}>
            {
                instances.filter(
                    (instance: any) => instance.instance.id === LATEST_RAID || !settings.showOnlyLatestRaid
                ).map(
                    (instance: any) => <InstanceStatus key={instance.instance.id} {...instance} />
                )
            }
        </div>
    );
}

function InstanceStatus(props: {instance: any, modes: any}) {
    return (
        <div className={'instance-status'}>
            {RAID_ABBREVIATIONS[props.instance.id] || props.instance.name}: {props.modes.map((mode: any) => <ModeStatus key={mode.difficulty.type} {...mode} />)}
        </div>
    )
}

function ModeStatus(props: any) {
    const routeParams = useParams() as {region: string};
    const region = routeParams.region.toUpperCase();

    const name = DIFFUCULTY_ABBREVIATIONS[props.difficulty.type] || props.difficulty.name;
    const killsThisWeek = props.progress.encounters.filter((encounter: any) => DateTime.fromMillis(encounter.last_kill_timestamp) > WEEKLY_RESET[region]).length;

    //Variant is either none, partial or full
    const variant = killsThisWeek === props.progress.total_count ? 'full' : killsThisWeek > 0 ? 'partial' : 'none';

    return (
        <Tooltip title={<RaidTooltip encounters={props.progress.encounters} />} placement={"right"} arrow={true}>
            <span className={"completion-"+variant}>{`${killsThisWeek}/${props.progress.total_count} ${name}`} </span>
        </Tooltip>
    );
}

function RaidTooltip(props: any) {
    const routeParams = useParams() as {region: string};
    const region = routeParams.region.toUpperCase();
    const encounters = props.encounters.map((encounter: any) => ({
        name: encounter.encounter.name,
        done: DateTime.fromMillis(encounter.last_kill_timestamp) > WEEKLY_RESET[region],
    }));

    return (
        <div className={"encounter-tooltip"}>
            {encounters.map((encounter: any) =>
                <div className={"encounter"} key={encounter.name}>
                    <div>{encounter.name}</div>
                    <>{encounter.done ? <CheckIcon className={"encounter-done"} />: <CloseIcon className={"encounter-not-done"} />}</>
                </div>
            )}
        </div>
    );
}

interface RIOProps {
    runs: MPlusRun[]
}

interface MPlusRun {
    mythic_level: number
    dungeon: string
    short_name: string
}

function MPlusStatusWrapper(props: RIOProps) {
    return (
        <ErrorBoundary fallback={<span>Error</span>}>
            <MPlusStatus {...props} />
        </ErrorBoundary>
    )
}

const mPlusLevelToVariant = (level: number) => {
    if(level >= 10) {
        return 'color-item-Legendary';
    } else if (level >= 2) {
        return 'color-item-Epic';
    }

    return 'color-item-Poor';
}

function MPlusStatus(props: RIOProps) {
    if(!props.runs) {
        return null;
    }

    const sorted_runs = props.runs.sort((a, b) => b.mythic_level - a.mythic_level);

    const vaultSlots = [
        sorted_runs[0]?.mythic_level ?? 'X',
        sorted_runs[3]?.mythic_level ?? 'X',
        sorted_runs[7]?.mythic_level ?? 'X',
    ].filter(e => e !== undefined);

    return (
        <Tooltip title={sorted_runs.length > 0 ? <MPlusStatusTooltip runs={sorted_runs} /> : null} placement={"right"} arrow={true}>
            <div className={"mplus-status"}>
                {vaultSlots.map((c,i) => <div key={i} className={mPlusLevelToVariant(c)}>{c}</div>)}
            </div>
        </Tooltip>
    );
}

function MPlusStatusTooltip(props: RIOProps) {
    return (
        <div className={"encounter-tooltip"}>
            {props.runs.map((run,i) =>
                <div className={"encounter"} key={i}>
                    <div>{run.dungeon}</div>
                    <div className={mPlusLevelToVariant(run.mythic_level)}>+{run.mythic_level}</div>
                </div>
            )}
        </div>
    );
}

function Footer(props: any) {
    const {region} = useParams();
    const navigate = useNavigate();

    const onChange = (event: any) => {
        navigate(`/${event.target.value}`);
    };

    return (
        <GridFooterContainer>
            <Stack direction={"row"} justifyContent={"space-between"} width={"100%"}>
                <Select className="region-selection" value={region} onChange={onChange} variant={"outlined"}>
                    {REGIONS.map((region) => (
                        <MenuItem key={region} value={region}>{region.toUpperCase()}</MenuItem>
                    ))}
                </Select>
                <SettingsDialog setKey={props.setKey}></SettingsDialog>
                <GridFooter sx={{
                    border: 'none', // To delete double border.
                }} >
                </GridFooter>
            </Stack>
        </GridFooterContainer>
    )
}

function SettingsDialog(props: any) {
    const [open, setOpen] = useState(false);

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    const settings = useContext(SettingsContext);
    const resetState = useCallback(() => {
        localStorage.removeItem('gridState');
        localStorage.removeItem('settings');
        settings.updateSettings(defaultSettings);
        props.setKey((prev: number) => prev+1);
    }, []);

    return <>
        <Button className="settings-button" variant="outlined" onClick={handleClickOpen}>
            Settings
        </Button>
        <Dialog
            open={open}
            onClose={handleClose}
        >
            <DialogTitle>
                {"Settings"}
            </DialogTitle>
            <DialogContent>
                <FormLabel component="legend">General</FormLabel>
                <FormGroup>
                    <FormControlLabel
                        value={false}
                        control={<Switch color="primary" checked={settings.showOnlyLatestRaid} onChange={(e) => settings.updateSettings(s => ({...s, showOnlyLatestRaid: e.target.checked}))} />}
                        label="Show only latest Raid"
                    />
                </FormGroup>
                <FormLabel component="legend">Raid Difficulties</FormLabel>
                <FormGroup>
                    <FormControlLabel
                        control={<Switch checked={settings.showLFR} onChange={(e) => settings.updateSettings(s => ({...s, showLFR: e.target.checked}))} />}
                        label="Show LFR"
                    />
                </FormGroup>
                <FormGroup>
                    <FormControlLabel
                        control={<Switch checked={settings.showNormal} onChange={(e) => settings.updateSettings(s => ({...s, showNormal: e.target.checked}))} />}
                        label="Show Normal"
                    />
                </FormGroup>
                <FormGroup>
                    <FormControlLabel
                        control={<Switch checked={settings.showHeroic} onChange={(e) => settings.updateSettings(s => ({...s, showHeroic: e.target.checked}))} />}
                        label="Show Heroic"
                    />
                </FormGroup>
                <FormGroup>
                    <FormControlLabel
                        control={<Switch checked={settings.showMythic} onChange={(e) => settings.updateSettings(s => ({...s, showMythic: e.target.checked}))} />}
                        label="Show Mythic"
                    />
                </FormGroup>
            </DialogContent>
            <DialogActions>
                <Button variant={"outlined"} color={"error"} onClick={resetState}>
                    Reset Settings
                </Button>
                <Button onClick={handleClose} autoFocus>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    </>
}

function LoadingWrapper() {
    const navigation = useNavigation();

    if(navigation.state != 'idle') {
        return <LoadingIndicator></LoadingIndicator>
    }

    return <Outlet />;
}

function LoadingIndicator() {
    return (
        <div className="loading-indicator">
            <CircularProgress size="10rem"/>
        </div>
    );
}

function MythicRating(props: {rating: number, color: {r: number, g: number, b: number}}) {
    if(!props.rating) return null;

    return (
        <div style={{color: `rgb(${props.color.r},${props.color.g},${props.color.b})`}}>
            {Math.round(props.rating)}
        </div>
    );
}

function CharacterLinks(props: {name: string, realmSlug: string}) {
    const routeParams = useParams() as {region: string};
    return (
        <Box display={"flex"} justifyContent={"center"} alignItems={"center"} height={"100%"} gap={"0.5rem"}>
            <Link display={"contents"} href={`https://worldofwarcraft.com/character/${routeParams.region}/${props.realmSlug}/${props.name}`}><WoWIcon className={"link-logo"} /></Link>
            <Link display={"contents"} href={`https://raider.io/characters/${routeParams.region}/${props.realmSlug}/${props.name}`}><RaiderIOIcon className={"link-logo"} /></Link>
            <Link display={"contents"} href={`https://www.warcraftlogs.com/character/${routeParams.region}/${props.realmSlug}/${props.name}`}><img className={"link-logo"} alt={"WCL"} src={wclLogoUrl} /></Link>
        </Box>
    );
}

function SetWrapper(props: any) {
    return (
        <ErrorBoundary fallback={<span>Error</span>}>
            <SetDisplay {...props} />
        </ErrorBoundary>
    )
}

function SetDisplay(props: any) {
    const equipment = props.value;

    if (equipment) {
        const currentSets = (equipment?.equipped_item_sets ?? []).filter((set: any) => CURRENT_SETS.has(set.item_set.id));

        if(currentSets.length > 0) {
            return (
                <div className={'sets'}>
                    {currentSets.map((set: any) => <Set key={set.item_set.id} {...set} equipment={equipment} />)}
                </div>
            );
        }

        return <div className={'sets'}><div className={"set-count-0"}>0</div></div>;
    }

    return "";
}

function Set(props: any) {
    const equipped = props.items.filter((item: any) => item.is_equipped);
    const items = equipped.map((item: any) => props.equipment.equipped_items.find((ei: any) => ei.item.id === item.item.id));

    console.log(items);

    return (
        <div>
            <span className={"set-count-"+equipped.length}>{equipped.length}</span>
        </div>
    );
}

export default App
