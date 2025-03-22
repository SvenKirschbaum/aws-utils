import {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react'
import './App.css'
import {Outlet, useLoaderData, useNavigate, useNavigation, useParams} from "react-router";
import {
    Box,
    Button,
    CircularProgress,
    Container,
    createTheme,
    CssBaseline, FormControlLabel, Link, MenuItem,
    Select, Stack, Switch,
    ThemeProvider, Tooltip,
    useMediaQuery
} from "@mui/material";
import {
    DataGrid,
    GridColDef,
    GridFooter,
    GridFooterContainer,
    GridRowModel,
    useGridApiRef
} from "@mui/x-data-grid";
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import RaiderIOIcon from './assets/raider-io-icon.svg?react'
import WoWIcon from './assets/wow-icon.svg?react'
import wclLogoUrl from './assets/wcl-icon.png'
import {createBrowserRouter, redirect, redirectDocument, RouterProvider} from "react-router-dom";
import {ErrorBoundary} from "react-error-boundary";
import {
    CLASSES,
    DIFFUCULTY_ABBREVIATIONS,
    FACTIONS, GENDERS, LATEST_RAID,
    RACES,
    RAID_ABBREVIATIONS,
    REGIONS, SPECS,
    WEEKLY_RESET
} from "./constants.tsx";
import {DateTime} from "luxon";
import {GridInitialStateCommunity} from "@mui/x-data-grid/models/gridStateCommunity";

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

declare interface SettingsContextType {
    showOnlyLatestRaid: boolean,
    setShowOnlyLatestRaid: (show: boolean) => void
}

const SettingsContext = createContext(undefined as unknown as SettingsContextType);

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

const defaultState: GridInitialStateCommunity = {
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

function CharacterList() {
    const data: {
        profile: any,
        raids: {[char: string]: any[]},
        characterProfile: {[char: string]: any},
        mythicKeystoneProfile: {[char: string]: any},
        raiderIOProfile: {[char: string]: any},
    } = useLoaderData() as any;
    const apiRef = useGridApiRef();
    const [key, setKey] = useState(0);
    const [showOnlyLatestRaid, setShowOnlyLatestRaid] = useState(true);

    //Restore saved state
    useEffect(() => {
        const storedStateString = localStorage.getItem('gridState');
        if(storedStateString) {
            const storedState = JSON.parse(storedStateString);

            if(storedState.version !== GRID_CONFIG_VERSION) {
                localStorage.removeItem('gridState');
            } else {
                apiRef.current.restoreState(storedState);
            }
        }
    }, []);

    //Save state on unload
    const saveState = useCallback(() => {
        localStorage.setItem('gridState', JSON.stringify({...apiRef.current.exportState(), version: GRID_CONFIG_VERSION}));
    }, []);

    useEffect(() => {
        window.addEventListener('beforeunload', saveState);
        return () => {
            window.removeEventListener('beforeunload', saveState);
        };
    }, []);

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
            showOnlyLatestRaid,
            setShowOnlyLatestRaid
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

    return (
        <div className={'raid-status'}>
            {
                props.value.filter(
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
    const settings = useContext(SettingsContext);

    const onChange = (event: any) => {
        navigate(`/${event.target.value}`);
    };

    const resetState = useCallback(() => {
        localStorage.removeItem('gridState');
        props.setKey((prev: number) => prev+1);
    }, []);

    return (
        <GridFooterContainer>
            <Stack direction={"row"} justifyContent={"space-between"} width={"100%"}>
                <Select className="region-selection" value={region} onChange={onChange} variant={"outlined"}>
                    {REGIONS.map((region) => (
                        <MenuItem key={region} value={region}>{region.toUpperCase()}</MenuItem>
                    ))}
                </Select>
                <Button className="reset-button" variant={"outlined"} onClick={resetState}>
                    Reset Grid Configuration
                </Button>
                <FormControlLabel
                    value={false}
                    control={<Switch color="primary" checked={settings.showOnlyLatestRaid} onChange={(e) => settings.setShowOnlyLatestRaid(e.target.checked)} />}
                    label="Show only latest Raid"
                    labelPlacement="end"
                />
                <GridFooter sx={{
                    border: 'none', // To delete double border.
                }} >
                </GridFooter>
            </Stack>
        </GridFooterContainer>
    )
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

export default App
