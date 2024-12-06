import './index.css';
import ReactDOM from 'react-dom/client'

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
    CssBaseline, TextField,
    ThemeProvider,
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
    const [loading, setLoading] = useState(false);
    const [url, setUrl] = useState("");
    const [error, setError] = useState(undefined);

    const onSubmit = () => {
        setError(undefined);
        setLoading(true);
        fetch(apiURL, {
            method: 'POST',
            body: JSON.stringify({url}),
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(async res => {
            if (!res.ok) {
                if(res.headers.get('Content-Type') === 'application/json' && parseInt(res.headers.get('Content-Length')) > 0) {
                    const body = await res.json();
                    throw new Error(body.error);
                }
                throw new Error(res.statusText || 'An error occurred while processing your request');
            }
            return res.json();
        })
        .then(data => {
            window.location = data.searchURL;
        })
        .catch(err => {
            setError(err.message);
            setLoading(false);
        });
    };

    return (
        <Card>
            {loading ? <CardContent sx={{textAlign: 'center', p: 4}}><CircularProgress/></CardContent> :
                <>
                    <CardContent sx={{p: 1}}>
                        <TextField
                            sx={{width: '100%'}}
                            label="Team or Match Link"
                            variant="filled"
                            required
                            helperText={error ?? "Input a Prime League Team or Match Link"}
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            error={error !== undefined}
                            onKeyDown={(e) => {e.key === 'Enter' && onSubmit()}}
                        />
                    </CardContent>
                    <CardActions sx={{float: 'right'}}>
                        <Button variant="contained" onClick={onSubmit}>Submit</Button>
                    </CardActions>
                </>
            }
        </Card>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)