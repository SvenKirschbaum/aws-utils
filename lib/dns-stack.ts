import {CfnResource, Duration, RemovalPolicy, Stack, StackProps} from "aws-cdk-lib";
import {Construct} from "constructs";
import {
    CaaAmazonRecord,
    CfnDNSSEC,
    CfnKeySigningKey,
    IPublicHostedZone,
    PublicHostedZone,
    RecordType,
    SrvRecord,
    TxtRecord,
} from "aws-cdk-lib/aws-route53";
import {AccountPrincipal, Effect, PolicyStatement, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {
    DefaultDomainRecords, GoogleMailRecords,
    HostRecord,
} from "./constructs/CommonRecords";
import {CrossAccountRoute53Role, Route53User} from "@fallobst22/cdk-cross-account-route53";
import {Key, KeySpec, KeyUsage} from "aws-cdk-lib/aws-kms";
import {
    DEFAULT_TTL, DOMAINS, HOSTS, LONG_TTL,
} from "./constructs/constants";

class DnsStackUSEast1ResourcesStack extends Stack {
    public cmk: Key;

    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props);

        this.cmk = new Key(this, 'Route53CMK', {
            removalPolicy: RemovalPolicy.DESTROY,
            keySpec: KeySpec.ECC_NIST_P256,
            keyUsage: KeyUsage.SIGN_VERIFY,
        });

        this.cmk.addToResourcePolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            principals: [
                new ServicePrincipal('dnssec-route53.amazonaws.com')
            ],
            actions: [
                "kms:DescribeKey",
                "kms:GetPublicKey",
                "kms:Sign"
            ],
            resources: ["*"]
        }));

        this.cmk.addToResourcePolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            principals: [
                new ServicePrincipal('dnssec-route53.amazonaws.com')
            ],
            actions: [
                "kms:CreateGrant"
            ],
            resources: ["*"],
            conditions: {
                Bool: {
                    "kms:GrantIsForAWSResource": true
                }
            }
        }));
    }
}

export class DNSStack extends Stack {

    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, {
            ...props,
            crossRegionReferences: true
        });

        const usEast1Resources = new DnsStackUSEast1ResourcesStack(this, 'USEast1Resources', {
            ...props,
            crossRegionReferences: true,
            env: {
                account: props.env?.account,
                region: 'us-east-1'
            }
        });

        const hostedZones = Object.fromEntries(
            Object.keys(DOMAINS).map((domain) => [
                domain,
                this.createHostedZone(domain, usEast1Resources.cmk)
            ])
        );

        Object.entries(hostedZones)
            .filter(([domain, _]) => DOMAINS[domain].defaultRecords)
            .forEach(([domain, zone]) => {
                new DefaultDomainRecords(zone, 'DefaultRecords', {
                    ...DOMAINS[domain],
                    zone,
                });
            });

        this.createHostnameRecords(hostedZones['elite12.de']);

        this.createElite12Records(hostedZones['elite12.de']);
        this.createKirschbaumMeRecords(hostedZones['kirschbaum.me']);
        this.createKirschbaumCloudRecords(hostedZones['kirschbaum.cloud']);
        this.createBundvonTeramoreDeRecords(hostedZones['bund-von-theramore.de']);
        this.createTheramoReRecords(hostedZones['theramo.re']);
        this.createTrigardonRgDeRecords(hostedZones['trigardon-rg.de']);

        this.createDelegations(hostedZones);
    }

    private createHostedZone(domain: string, cmk: Key) {
        const hostedZone = new PublicHostedZone(this, domain, {
            zoneName: domain,
        });

        const ksk = new CfnKeySigningKey(this, `${domain}-ksk`, {
            hostedZoneId: hostedZone.hostedZoneId,
            keyManagementServiceArn: cmk.keyArn,
            name: 'ksk01',
            status: 'ACTIVE',
        });
        ksk.addDependency(hostedZone.node.defaultChild as CfnResource);
        ksk.addDependency(cmk.node.defaultChild as CfnResource);

        const dnssec = new CfnDNSSEC(this, `${domain}-dnssec`, {
            hostedZoneId: hostedZone.hostedZoneId
        });
        dnssec.addDependency(ksk);

        return hostedZone;
    }

    private createHostnameRecords(zone: IPublicHostedZone) {
        for (let hostname in HOSTS) {
            new HostRecord(zone, hostname+"HostnameRecord", {
                zone,
                ttl: LONG_TTL,
                name: hostname,
                host: hostname
            });
        }
    }

    private createElite12Records(zone: IPublicHostedZone) {
        new HostRecord(zone, 'MonitoringRoot', {
            zone,
            host: 'obs-01-vie-nc',
            name: 'monitoring'
        });

        new HostRecord(zone, 'MonitoringWildcard', {
            zone,
            host: 'obs-01-vie-nc',
            name: '*.monitoring'
        });

        Object.keys(DOMAINS).filter((domain) => domain !== 'elite12.de').forEach((domain) => {
            new TxtRecord(zone, `${domain}DmarcAllowReports`, {
                zone,
                ttl: LONG_TTL,
                recordName: `${domain}._report._dmarc`,
                values: [
                    'v=DMARC1'
                ]
            });
        });
    }
    private createKirschbaumMeRecords(zone: IPublicHostedZone) {
        new HostRecord(zone, 'ExtGW', {
            zone,
            host: 'gw-03-nue-nc',
            name: 'ext-gw',
            ttl: Duration.seconds(60)
        });

        new HostRecord(zone, 'FluxWebhookHome', {
            zone,
            host: 'gw-03-nue-nc',
            name: '*.home',
            ttl: Duration.seconds(60)
        });

        new TxtRecord(zone, 'BlueSkyRecord', {
            zone,
            ttl: LONG_TTL,
            recordName: '_atproto.sven',
            values: ['did=did:plc:toe6ckmva32ms4niq2tpoubd']
        })
    }

    private createKirschbaumCloudRecords(zone: IPublicHostedZone) {
        new CaaAmazonRecord(zone, 'CaaAmazon', {
            zone
        });

        new GoogleMailRecords(this, 'Mail', {
            zone,
            domainKeys: DOMAINS["kirschbaum.cloud"].domainKeys
        });
    }

    private createBundvonTeramoreDeRecords(zone: IPublicHostedZone) {
        new SrvRecord(zone, 'TS3SRV', {
            zone,
            ttl: DEFAULT_TTL,
            recordName: '_ts3._udp',
            values: [
                {
                    port: 5732,
                    weight: 2,
                    priority: 1,
                    hostName: 'main-02-nue-nc.elite12.de'
                }
            ]
        });
    }
    private createTheramoReRecords(zone: IPublicHostedZone) {
        new SrvRecord(zone, 'TS3SRV', {
            zone,
            ttl: DEFAULT_TTL,
            recordName: '_ts3._udp',
            values: [
                {
                    port: 5732,
                    weight: 2,
                    priority: 1,
                    hostName: 'main-02-nue-nc.elite12.de'
                }
            ]
        });
    }
    private createTrigardonRgDeRecords(zone: IPublicHostedZone) {
        new SrvRecord(zone, 'TS3SRV', {
            zone,
            ttl: DEFAULT_TTL,
            recordName: '_ts3._udp',
            values: [
                {
                    port: 3955,
                    weight: 2,
                    priority: 1,
                    hostName: 'main-02-nue-nc.elite12.de'
                }
            ]
        });
    }

    private createDelegations(hostedZones: { [key: string]: IPublicHostedZone }) {
        new CrossAccountRoute53Role(this, 'DomainPlaceholderDnsDelegation', {
            zone: hostedZones['kirschbaum.cloud'],
            assumedBy: new AccountPrincipal('362408963076'),
            roleName: 'DomainPlaceholderDnsDelegationRole',
            records: [
                {
                    types: [RecordType.A, RecordType.AAAA],
                    domains: ['kirschbaum.cloud']
                },
                {
                    types: [RecordType.CNAME],
                    domains: ['_*.kirschbaum.cloud']
                }
            ]
        });

        new CrossAccountRoute53Role(this, 'LogsDnsDelegation', {
            zone: hostedZones['theramo.re'],
            assumedBy: new AccountPrincipal('362408963076'),
            roleName: 'LogsDnsDelegationRole',
            records: [
                {
                    types: [RecordType.A, RecordType.AAAA],
                    domains: ['logs.theramo.re']
                },
                {
                    types: [RecordType.CNAME],
                    domains: ['_*.logs.theramo.re']
                }
            ]
        });

        new CrossAccountRoute53Role(this, 'CharsDnsDelegation', {
            zone: hostedZones['theramo.re'],
            assumedBy: new AccountPrincipal('362408963076'),
            roleName: 'CharsDnsDelegationRole',
            records: [
                {
                    types: [RecordType.A, RecordType.AAAA],
                    domains: ['chars.theramo.re']
                },
                {
                    types: [RecordType.CNAME],
                    domains: ['_*.chars.theramo.re']
                }
            ]
        });

        new CrossAccountRoute53Role(this, 'PrimeScoutDnsDelegation', {
            zone: hostedZones['westerwald-esport.de'],
            assumedBy: new AccountPrincipal('362408963076'),
            roleName: 'PrimeScoutDnsDelegationRole',
            records: [
                {
                    types: [RecordType.A, RecordType.AAAA],
                    domains: ['scout.westerwald-esport.de', '*.scout.westerwald-esport.de']
                },
                {
                    types: [RecordType.CNAME],
                    domains: ['*.scout.westerwald-esport.de']
                }
            ]
        });

        new CrossAccountRoute53Role(this, 'CloudshareStagingDNSDelegation', {
            zone: hostedZones['kirschbaum.cloud'],
            assumedBy: new AccountPrincipal('276098254089'),
            roleName: 'CloudshareStagingDnsDelegationRole',
            records: [
                {
                    types: [RecordType.A, RecordType.AAAA, RecordType.NS, RecordType.CNAME, RecordType.TXT],
                    domains: ['share-staging.kirschbaum.cloud', '*.share-staging.kirschbaum.cloud']
                }
            ]
        });

        new CrossAccountRoute53Role(this, 'CloudshareProdDNSDelegation', {
            zone: hostedZones['kirschbaum.cloud'],
            assumedBy: new AccountPrincipal('743848950232'),
            roleName: 'CloudshareProdDnsDelegationRole',
            records: [
                {
                    types: [RecordType.A, RecordType.AAAA, RecordType.NS, RecordType.CNAME, RecordType.TXT],
                    domains: ['share.kirschbaum.cloud', '*.share.kirschbaum.cloud']
                }
            ]
        });

        new Route53User(this, 'extGWDelegation', {
            zone: hostedZones['kirschbaum.me'],
            secretName: 'extGw-Accesskey',
            records: [
                {
                    types: [RecordType.TXT],
                    domains: ['_acme-challenge.ext-gw.home.kirschbaum.me','_acme-challenge.ext-gw.kirschbaum.me']
                }
            ]
        });

        new Route53User(this, 'homeDelegation', {
            zone: hostedZones['kirschbaum.me'],
            secretName: 'home-Accesskey',
            records: [
                {
                    types: [RecordType.TXT],
                    domains: ['_acme-challenge.home.kirschbaum.me','_acme-challenge.*.home.kirschbaum.me']
                }
            ]
        });
    }
}
