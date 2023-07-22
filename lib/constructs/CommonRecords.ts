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

export const E12_SERVER_IPV4 = "89.58.11.239";
export const E12_SERVER_IPV6 = "2a03:4000:5f:ba0::1";

export interface CommonRecordProps {
    zone: IHostedZone,
}

export interface NameableCommonRecordProps extends CommonRecordProps {
    name?: string
}
export class E12ServerRecord extends Construct {

    constructor(scope: Construct, id: string, props: NameableCommonRecordProps) {
        super(scope, id);

        new ARecord(this, 'ARecord', {
            zone: props.zone,
            ttl: DEFAULT_TTL,
            recordName: props.name,
            target: RecordTarget.fromIpAddresses(E12_SERVER_IPV4),
        });
        new AaaaRecord(this, 'AAAARecord', {
            zone: props.zone,
            ttl: DEFAULT_TTL,
            recordName: props.name,
            target: RecordTarget.fromIpAddresses(E12_SERVER_IPV6),
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
                `v=spf1 include:_spf.google.com ip4:${E12_SERVER_IPV4}/32 ip6:${E12_SERVER_IPV6}/64 ~all`
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
