import {Construct} from "constructs";
import {
    AaaaRecord,
    ARecord,
    CaaRecord,
    CaaTag,
    IHostedZone,
    MxRecord,
    RecordTarget,
    TxtRecord
} from "aws-cdk-lib/aws-route53";
import {Duration} from "aws-cdk-lib";

export const DEFAULT_TTL = Duration.hours(1);

/**
 * @Deprecated
 */
export const E12_OLD_SERVER_IPV4 = "89.58.11.239";
/**
 * @Deprecated
 */
export const E12_OLD_SERVER_IPV6 = "2a03:4000:5f:ba0::1";

export const MAIN_01_NUE_NC_IPV4 = "89.58.34.152";

export const MAIN_01_NUE_NC_IPV6 = "2a03:4000:64:95::1";
export const E12_MONITORING_IPV4 = "152.53.19.135";
export const E12_MONITORING_IPV6 = "2a0a:4cc0:1:11b6::1";

export interface CommonRecordProps {
    zone: IHostedZone,
}

export interface NameableCommonRecordProps extends CommonRecordProps {
    name?: string
}
export class E12MainRecord extends Construct {

    constructor(scope: Construct, id: string, props: NameableCommonRecordProps) {
        super(scope, id);

        new ARecord(this, 'ARecord', {
            zone: props.zone,
            ttl: DEFAULT_TTL,
            recordName: props.name,
            target: RecordTarget.fromIpAddresses(MAIN_01_NUE_NC_IPV4),
        });
        new AaaaRecord(this, 'AAAARecord', {
            zone: props.zone,
            ttl: DEFAULT_TTL,
            recordName: props.name,
            target: RecordTarget.fromIpAddresses(MAIN_01_NUE_NC_IPV6),
        });
    }
}

export class E12MonitoringRecord extends Construct {

    constructor(scope: Construct, id: string, props: NameableCommonRecordProps) {
        super(scope, id);

        new ARecord(this, 'ARecord', {
            zone: props.zone,
            ttl: DEFAULT_TTL,
            recordName: props.name,
            target: RecordTarget.fromIpAddresses(E12_MONITORING_IPV4),
        });
        new AaaaRecord(this, 'AAAARecord', {
            zone: props.zone,
            ttl: DEFAULT_TTL,
            recordName: props.name,
            target: RecordTarget.fromIpAddresses(E12_MONITORING_IPV6),
        });
    }
}

export class LetsencryptCAARecord extends Construct {

    constructor(scope: Construct, id: string, props: NameableCommonRecordProps) {
        super(scope, id);

        new CaaRecord(this, 'CAA', {
            zone: props.zone,
            ttl: DEFAULT_TTL,
            recordName: props.name,
            values: [
                {
                    tag: CaaTag.IODEF,
                    flag: 0,
                    value: 'mailto:caa@kirschbaum.me'
                },
                {
                    tag: CaaTag.ISSUE,
                    flag: 0,
                    value: 'letsencrypt.org'
                },
                {
                    tag: CaaTag.ISSUEWILD,
                    flag: 0,
                    value: 'letsencrypt.org'
                }
            ]
        });
    }
}

export interface GoogleMailRecordProps extends CommonRecordProps {
    domainKeys?: {[key: string]: string}
}
export class GoogleMailRecords extends Construct {

    constructor(scope: Construct, id: string, props: GoogleMailRecordProps) {
        super(scope, id);

        new MxRecord(this, 'MXRecord', {
            zone: props.zone,
            ttl: DEFAULT_TTL,
            values: [
                {
                    priority: 1,
                    hostName: "ASPMX.L.GOOGLE.COM"
                },
                {
                    priority: 5,
                    hostName: "ALT1.ASPMX.L.GOOGLE.COM"
                },
                {
                    priority: 5,
                    hostName: "ALT2.ASPMX.L.GOOGLE.COM"
                },
                {
                    priority: 10,
                    hostName: "ASPMX2.GOOGLEMAIL.COM"
                },
                {
                    priority: 10,
                    hostName: "ASPMX3.GOOGLEMAIL.COM"
                }
            ]
        });

        if(props.domainKeys) {
            for (let domainKeyName in props.domainKeys) {
                new TxtRecord(this, `DomainKey-${domainKeyName}`, {
                    zone: props.zone,
                    ttl: DEFAULT_TTL,
                    recordName: `${domainKeyName}._domainkey`,
                    values: [
                        props.domainKeys[domainKeyName]
                    ]
                });
            }
        }

        new TxtRecord(this, `SPFRecord`, {
            zone: props.zone,
            ttl: DEFAULT_TTL,
            values: [
                `v=spf1 include:_spf.google.com ~all`
            ]
        });

        new TxtRecord(this, `DMARCRecord`, {
            zone: props.zone,
            ttl: DEFAULT_TTL,
            recordName: '_dmarc',
            values: [
                'v=DMARC1; p=reject; adkim=s; aspf=s; rua=mailto:mailauth-reports-rua@elite12.de'
            ]
        });
    }
}
