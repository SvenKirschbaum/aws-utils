import './index.css';
import * as ReactDOM from "react-dom";

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import {
    Button,
    Card, CardActions,
    CardContent, CircularProgress,
    Container,
    createTheme,
    CssBaseline, Stack, TextField,
    ThemeProvider,
    Typography,
    useMediaQuery
} from "@mui/material";
import React, {useState} from "react";

const apiURL = "https://api.scout.westerwald-esport.de/scout";

function App() {
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
    const theme = React.useMemo(() =>
        createTheme({
                palette: {
                    mode: prefersDarkMode ? 'dark' : 'light'
                }
            }
        ), [prefersDarkMode]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline/>
            <Container sx={{
                marginTop: '4em',
                marginBottom: '4em',
            }} maxWidth={"sm"}>
                <ScoutComponent />
            </Container>
        </ThemeProvider>
    );
}

function ScoutComponent() {
    const [url, setUrl] = useState("");

    const onSubmit = () => {
        fetch(apiURL, {
            method: 'POST',
            body: JSON.stringify({url}),
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(res => res.json())
        .then(data => {
            window.location = data.searchURL;
        })
        .catch(err => {
            console.error(err);
        });
    };

    return (
        <Card>
            <CardContent sx={{p: 1}}>
                <TextField sx={{width: '100%'}} label="Team or Match Link" variant="filled" required helperText="Input a Prime League Team or Match Link" value={url} onChange={(e) => setUrl(e.target.value)} />
            </CardContent>
            <CardActions sx={{float: 'right'}}>
                <Button variant="contained" onClick={onSubmit}>Submit</Button>
            </CardActions>
        </Card>
    );
}

ReactDOM.render(<App/>, document.getElementById('root'));