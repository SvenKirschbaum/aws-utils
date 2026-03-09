import {tracer} from "./util";
import {DecryptCommand, EncryptCommand, KMSClient} from "@aws-sdk/client-kms";

const kms = tracer.captureAWSv3Client(new KMSClient())

enum KEY_USAGE {
    ROSTER_SHARE = "ROSTER_SHARE",
}

export type RosterShareTokenData = {
    PK: string,
    SK: string
}

export async function getShareToken(data: RosterShareTokenData): Promise<string> {
    const bytes = new TextEncoder().encode(JSON.stringify({v: 1, ...data}))

    const r = await kms.send(new EncryptCommand({
        KeyId: process.env.ENCRYPTION_KEY_ARN,
        Plaintext: bytes,
        EncryptionContext: {
            CTX: KEY_USAGE.ROSTER_SHARE
        }
    }))

    if(!r.CiphertextBlob) throw new Error('Encryption failed');

    return Buffer.from(r.CiphertextBlob || '').toString('base64url')
}

export async function decryptShareToken(token: string): Promise<RosterShareTokenData> {
    const ciphertextBlob = Buffer.from(token, 'base64url')

    const r = await kms.send(new DecryptCommand({
        KeyId: process.env.ENCRYPTION_KEY_ARN,
        CiphertextBlob: ciphertextBlob,
        EncryptionContext: {
            CTX: KEY_USAGE.ROSTER_SHARE
        }
    }));

    if(!r.Plaintext) throw new Error('Decryption failed');

    const result = JSON.parse(new TextDecoder().decode(r.Plaintext))

    if(result.v !== 1) throw new Error('Unsupported token version');

    return result
}
