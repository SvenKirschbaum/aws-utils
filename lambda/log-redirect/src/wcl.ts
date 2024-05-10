//Cross invocation cache
import {gql, GraphQLClient} from "graphql-request";
import {jwtDecode} from "jwt-decode";
import {DateTime} from "luxon";
import {getSecret} from "./secret";

let reports: Report[];
export let reportsAge: DateTime;

//Static values
const gqlEndpoint = 'https://www.warcraftlogs.com/api/v2/user';
const gqlQuery = gql`
    query getLatestLog($userId: Int!) {
        reportData {
            reports(userID: $userId, limit: 25) {
                data {
                    code
                    visibility
                    fights {
                        difficulty
                        keystoneLevel
                    }
                }
            }
        }
    }
`;

interface Report {
    code: string,
    visibility: 'public' | 'private' | 'unlisted',
    fights: {
        difficulty: number
        keystoneLevel: number | null
    }[]
}
interface ReportList {
    reportData: {
        reports: {
            data: Report[]
        }
    }
}

export async function getReports() {
    if(reports && DateTime.now().diff(reportsAge).as('second') < 300) return reports;

    const secret = await getSecret();
    const token = secret.user_access_token;

    if(!token) throw new Error('No User Access token available');

    const parsedToken = jwtDecode(token) as {sub: string};
    const userId = parseInt(parsedToken.sub);

    const gqlClient = new GraphQLClient(gqlEndpoint, {
        headers: {
            authorization: `Bearer ${token}`,
        }
    });

    const response = await gqlClient.request<ReportList>(gqlQuery, {
        userId
    });

    reports = response.reportData.reports.data.filter(value => value.visibility != 'private');
    reportsAge = DateTime.now();
    return reports;
}

export async function getRaidReports() {
    let reports = await getReports();

    reports = reports.filter(report => {
        return report.fights.reduce((p, c) => p || (c.difficulty >= 3 && c.difficulty <= 5), false);
    });

    return reports;
}
export async function getLatestRaidReport() {
    return (await getRaidReports())?.[0].code;
}

export async function getMythPlusReports() {
    let reports = await getReports();

    reports = reports.filter(report => {
        return report.fights.reduce((p, c) => p || c.keystoneLevel != null, false);
    });

    return reports;
}

export async function getLatestMythPlusReport() {
    return (await getMythPlusReports())?.[0].code;
}

export const REPORT_URL_PREFIX = 'https://www.warcraftlogs.com/reports/';
