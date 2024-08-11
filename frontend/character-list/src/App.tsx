import {useCallback, useEffect, useMemo, useState} from 'react'
import './App.css'
import {Outlet, useLoaderData, useNavigate, useNavigation, useParams} from "react-router";
import {
    Button,
    CircularProgress,
    Container,
    createTheme,
    CssBaseline, MenuItem,
    Select, Stack,
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
import {createBrowserRouter, redirect, redirectDocument, RouterProvider} from "react-router-dom";
import {ErrorBoundary} from "react-error-boundary";
import {
    CLASSES,
    DIFFUCULTY_ABBREVIATIONS,
    FACTIONS, GENDERS,
    RACES,
    RAID_ABBREVIATIONS,
    REGIONS,
    WEEKLY_RESET
} from "./constants.tsx";
import {DateTime} from "luxon";

const router = createBrowserRouter([
    {
        Component: LoadingWrapper,
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
                    fallbackElement={
                        <LoadingIndicator />
                    }
                />
            </Container>
        </ThemeProvider>
    );
}

const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', headerAlign: 'center', cellClassName: (params) => `color-class-${params.row.classId}`},
    { field: 'level', headerName: 'Level', headerAlign: 'center', type: 'number'},
    { field: 'className', headerName: 'Class', headerAlign: 'center', type: 'singleSelect', valueOptions: CLASSES, cellClassName: (params) => `color-class-${params.row.classId}`},
    { field: 'realm', headerName: 'Realm', headerAlign: 'center' },
    { field: 'factionName', headerName: 'Faction', headerAlign: 'center', type: 'singleSelect', valueOptions: FACTIONS, cellClassName: (params) => `color-faction-${params.row.factionType}`},
    { field: 'race', headerName: 'Race', headerAlign: 'center', type: 'singleSelect', valueOptions: RACES},
    { field: 'gender', headerName: 'Gender', headerAlign: 'center', type: 'singleSelect', valueOptions: GENDERS},
    { field: 'account', headerName: 'Account', headerAlign: 'center', type: 'number'},
    { field: 'raids', headerName: 'Raid IDs', headerAlign: 'center', renderCell: (params) => <RaidStatusWrapper {...params} />},
];

function CharacterList() {
    const data: any = useLoaderData();
    const apiRef = useGridApiRef();
    const [key, setKey] = useState(0);

    //Restore saved state
    useEffect(() => {
        const storedState = localStorage.getItem('gridState');

        if(storedState) {
            apiRef.current.restoreState(JSON.parse(storedState));
        }
    }, []);

    //Save state on unload
    const saveState = useCallback(() => {
        localStorage.setItem('gridState', JSON.stringify(apiRef.current.exportState()));
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
                    id: character.id,
                    account: accountIndex+1,
                    name: character.name,
                    level: character.level,
                    classId: character.playable_class.id,
                    className: character.playable_class.name,
                    realm: character.realm.name,
                    factionName: character.faction.name,
                    factionType: character.faction.type,
                    race: character.playable_race.name,
                    gender: character.gender.name,
                    raids: data.raids[`${character.name.toLowerCase()}-${character.realm.slug}`],
                    sort: (data.raids[`${character.name.toLowerCase()}-${character.realm.slug}`]?.reduce((totalKills: any, instance: any) => {
                        instance.modes.forEach((mode: any) => {
                            mode.progress.encounters.forEach((encounter: any) => {
                                totalKills += encounter.completed_count;
                            });
                        });
                        return totalKills;
                    }, 0) || 0) + character.level*1000
                });
            });
        });

        r.sort((a: any, b: any) => b.sort - a.sort);

        return r;
    }, [data]);

    return (
        <DataGrid
            key={key}
            apiRef={apiRef}
            sx={{
                '& .MuiDataGrid-cell': {
                    padding: '0.5em',
                    textAlign: 'center',
                },
            }}
            disableColumnSelector={true}
            rows={rows}
            columns={columns}
            initialState={{
                pagination: { paginationModel: { pageSize: 15 } }
            }}
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
                    setKey
                } as any
            }}
        />
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
    if(!props.value) {
        return "";
    }

    return (
        <div className={'raid-status'}>
            {props.value.map((instance: any) => <InstanceStatus key={instance.instance.id} {...instance} />)}
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

function Footer(props: any) {
    const {region} = useParams();
    const navigate = useNavigate();

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
                    Reset Sorting and Filters
                </Button>
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

export default App
