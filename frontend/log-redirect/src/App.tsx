import './App.css'
import {
    Card,
    CardContent, CardHeader,
    CircularProgress,
    Container,
    createTheme,
    CssBaseline, Grid, Link, List, ListItem,
    ThemeProvider,
    useMediaQuery
} from "@mui/material";
import React, {useEffect, useState} from "react";

export const REPORT_URL_PREFIX = 'https://www.warcraftlogs.com/reports/';

function App() {

    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
    const theme = React.useMemo(() =>
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
            <Container sx={{
                marginTop: '4em',
                marginBottom: '4em',
            }}>
                <Reports />
            </Container>
        </ThemeProvider>
    )
}

interface Report {
    code: string,
    title: string
}
interface ListApiResponse {
    raid: Report[],
    mythPlus: Report[]
}
function Reports() {
    const [data, setData] = useState<ListApiResponse | undefined>(undefined)

    useEffect(() => {
        fetch("/list")
        .then(response => response.json())
        .then(data => setData(data))
    }, []);

    //Loading indicator
    if(data === undefined) {
        return <div className="loading-indicator">
            <CircularProgress size="10rem"  />
        </div>
    }

    return (
        <Grid container spacing={2}>
            <Grid item xs={6}>
                <ReportList
                    title="Raid"
                    latestPath="raid"
                    reports={data.raid}
                />
            </Grid>
            <Grid item xs={6}>
                <ReportList
                    title="Mythic Plus"
                    latestPath="mythplus"
                    reports={data.mythPlus}
                />
            </Grid>
        </Grid>
    )
}

function ReportList(props: {title: string, latestPath: string, reports: Report[]}) {
    const {title, latestPath, reports} = props;

    return (
        <Card variant="elevation">
            <CardHeader title={title} action={<Link href={`/${latestPath}`}>Latest</Link>}></CardHeader>
            <CardContent>
                <List>
                    {reports.map((report) => (
                        <ListItem key={report.code}>
                            <Link target={"_blank"} href={REPORT_URL_PREFIX + report.code}>{report.title || '(No Report Title available )'}</Link>
                        </ListItem>
                    ))}
                </List>
            </CardContent>
        </Card>
    );
}

export default App
