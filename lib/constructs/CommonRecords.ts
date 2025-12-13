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
import {
    DEFAULT_TTL, HOSTS, LONG_TTL,
} from "./constants";
import {Duration} from "aws-cdk-lib";

export interface CommonRecordProps {
    zone: IHostedZone,
    ttl?: Duration
}

export interface NameableCommonRecordProps extends CommonRecordProps {
    name?: string
}

export interface HostRecordProps extends NameableCommonRecordProps {
    host: string
}

export class HostRecord extends Construct {

    constructor(scope: Construct, id: string, props: HostRecordProps) {
        super(scope, id);

        new ARecord(this, 'ARecord', {
            zone: props.zone,
            ttl: props.ttl ?? DEFAULT_TTL,
            recordName: props.name,
            target: RecordTarget.fromIpAddresses(HOSTS[props.host].V4),
        });
        new AaaaRecord(this, 'AAAARecord', {
            zone: props.zone,
            ttl: props.ttl ?? DEFAULT_TTL,
            recordName: props.name,
            target: RecordTarget.fromIpAddresses(HOSTS[props.host].V6),
        });
    }
}

export class DefaultCAARecord extends Construct {

    constructor(scope: Construct, id: string, props: NameableCommonRecordProps) {
        super(scope, id);

        new CaaRecord(this, 'CAA', {
            zone: props.zone,
            ttl: props.ttl ?? LONG_TTL,
            recordName: props.name,
            values: [
                {
                    tag: CaaTag.IODEF,
                    flag: 0,
                    value: 'mailto:caa@elite12.de'
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
                },
                {
                    tag: CaaTag.ISSUE,
                    flag: 0,
                    value: 'amazonaws.com'
                },
                {
                    tag: CaaTag.ISSUEWILD,
                    flag: 0,
                    value: 'amazonaws.com'
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
            ttl: props.ttl ?? DEFAULT_TTL,
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
                    ttl: props.ttl ?? DEFAULT_TTL,
                    recordName: `${domainKeyName}._domainkey`,
                    values: [
                        props.domainKeys[domainKeyName]
                    ]
                });
            }
        }

        new TxtRecord(this, `SPFRecord`, {
            zone: props.zone,
            ttl: props.ttl ?? DEFAULT_TTL,
            values: [
                `v=spf1 include:_spf.google.com ~all`
            ]
        });

        new TxtRecord(this, `DMARCRecord`, {
            zone: props.zone,
            ttl: props.ttl ?? DEFAULT_TTL,
            recordName: '_dmarc',
            values: [
                'v=DMARC1; p=reject; adkim=s; aspf=s; rua=mailto:mailauth-reports-rua@elite12.de'
            ]
        });
    }
}

interface DefaultDomainRecordsProps extends CommonRecordProps, GoogleMailRecordProps {

}

export class DefaultDomainRecords extends Construct {

    constructor(scope: Construct, id: string, props: DefaultDomainRecordsProps) {
        super(scope, id);

        new HostRecord(this, 'Root', {
            zone: props.zone,
            host: 'main-02-nue-nc'
        });

        new HostRecord(this, 'Wildcard', {
            zone: props.zone,
            host: 'main-02-nue-nc',
            name: '*'
        });

        new DefaultCAARecord(this, 'CAA', {
            zone: props.zone
        });

        if(props.domainKeys) {
            new GoogleMailRecords(this, 'Mail', {
                zone: props.zone,
                domainKeys: props.domainKeys
            });
        }
    }
}