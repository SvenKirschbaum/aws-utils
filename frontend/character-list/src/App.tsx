import {useMemo} from 'react'
import './App.css'
import {Outlet, useLoaderData, useNavigate, useNavigation, useParams} from "react-router";
import {
    CircularProgress,
    Container,
    createTheme,
    CssBaseline, MenuItem,
    Select, Stack,
    ThemeProvider,
    useMediaQuery
} from "@mui/material";
import {DataGrid, GridColDef, GridFooter, GridFooterContainer, GridRowModel} from "@mui/x-data-grid";
import {createBrowserRouter, redirect, redirectDocument, RouterProvider} from "react-router-dom";

const REGIONS = ['eu', 'us', 'kr', 'tw']
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
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

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

function CharacterList() {
    const data: any = useLoaderData();

    const rows: GridRowModel[] = [];

    const columns: GridColDef[] = [
        { field: 'name', headerName: 'Name', width: 150 },
        { field: 'level', headerName: 'Level', width: 150 },
        { field: 'class', headerName: 'Class', width: 150 },
        { field: 'realm', headerName: 'Realm', width: 150 },
        { field: 'faction', headerName: 'Faction', width: 150 },
        { field: 'race', headerName: 'Race', width: 150 },
        { field: 'gender', headerName: 'Gender', width: 150 },
        { field: 'account', headerName: 'Account Index'},
    ];

    data.wow_accounts.forEach((account: any, accountIndex: number) => {
        account.characters.forEach((character: any) => {
            rows.push({
                id: character.id,
                account: accountIndex+1,
                name: character.name,
                level: character.level,
                class: character.playable_class.name,
                realm: character.realm.name,
                faction: character.faction.name,
                race: character.playable_race.name,
                gender: character.gender.name,
            });
        });
    });

    return (
        <DataGrid
            rows={rows}
            columns={columns}
            initialState={{
                sorting: {
                    sortModel: [{ field: 'level', sort: 'desc' }],
                },
            }}
            autosizeOnMount={true}
            autosizeOptions={{
                expand: true
            }}
            autoPageSize={true}
            slots={{
                footer: Footer
            }}
        />
    );
}

function Footer() {
    const {region} = useParams();
    const navigate = useNavigate();

    const onChange = (event: any) => {
        navigate(`/${event.target.value}`);
    };

    return (
        <GridFooterContainer>
            <Stack direction={"row"} justifyContent={"space-between"} width={"100%"}>
                <Select className="region-selection" value={region} onChange={onChange}>
                    {REGIONS.map((region) => (
                        <MenuItem key={region} value={region}>{region.toUpperCase()}</MenuItem>
                    ))}
                </Select>
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
