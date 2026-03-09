import {useEffect, useState} from 'react'
import {IconButton, Tooltip} from '@mui/material'
import ShareIcon from '@mui/icons-material/Share'

function ShareButton(props: any) {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if(!copied) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setCopied(false);
        }, 2000);

        return () => window.clearTimeout(timeoutId);
    }, [copied]);

    if(!props.shareToken) {
        return null;
    }

    const copyShareUrl = async () => {
        await navigator.clipboard.writeText(new URL(`/s/${props.shareToken}`, window.location.origin).toString());
        setCopied(true);
    };

    return (
        <Tooltip title={copied ? 'Share link copied' : 'Copy share link'} arrow>
            <IconButton
                aria-label={'Copy share link'}
                color={copied ? 'primary' : 'default'}
                onClick={() => void copyShareUrl()}
            >
                <ShareIcon />
            </IconButton>
        </Tooltip>
    );
}

export default ShareButton

