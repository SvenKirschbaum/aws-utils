import {CfnResource, Duration, Stack, StackProps} from "aws-cdk-lib";
import {Construct} from "constructs";
import {
    AaaaRecord,
    ARecord, CaaAmazonRecord, CaaRecord, CaaTag, CfnDNSSEC, CfnKeySigningKey, IPublicHostedZone,
    PublicHostedZone,
    RecordTarget, RecordType, SrvRecord, TxtRecord,
} from "aws-cdk-lib/aws-route53";
import {AccountPrincipal} from "aws-cdk-lib/aws-iam";
import {
    DEFAULT_TTL,
    E12_SERVER_IPV4, E12_SERVER_IPV6, E12MonitoringRecord,
    E12ServerRecord,
    GoogleMailRecords,
    LetsencryptCAARecord
} from "./constructs/CommonRecords";
import {CrossAccountRoute53Role, Route53User} from "@fallobst22/cdk-cross-account-route53";

export interface RootDnsProps extends StackProps {
    domains: string[],
    route53CMKarn: string
}

export class RootDnsStack extends Stack {

    constructor(scope: Construct, id: string, props: RootDnsProps) {
        super(scope, id, props);

        const hostedZones = Object.fromEntries(
            props.domains.map((domain) => [
                domain,
                this.createHostedZone(domain, props.route53CMKarn)
            ])
        );

        this.createNameserverRecords(hostedZones['elite12.de']);
        this.createElite12Records(hostedZones['elite12.de']);
        this.createKirschbaumMeRecords(hostedZones['kirschbaum.me']);
        this.createKirschbaumCloudRecords(hostedZones['kirschbaum.cloud']);
        this.createBundvonTeramoreDeRecords(hostedZones['bund-von-theramore.de']);
        this.createTheramoReRecords(hostedZones['theramo.re']);
        this.createMarkusDopeRecords(hostedZones['markus-dope.de']);
        this.createGrillteller42DeRecords(hostedZones['grillteller42.de']);
        this.createTrigardonRgDeRecords(hostedZones['trigardon-rg.de']);
        this.createWesterwaldEsportDeRecords(hostedZones['westerwald-esport.de']);

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

    private createHostedZone(domain: string, cmkArn: string) {
        const hostedZone = new PublicHostedZone(this, domain, {
            zoneName: domain,
        });

        const ksk = new CfnKeySigningKey(this, `${domain}-ksk`, {
            hostedZoneId: hostedZone.hostedZoneId,
            keyManagementServiceArn: cmkArn,
            name: 'ksk01',
            status: 'ACTIVE',
        });
        ksk.addDependency(hostedZone.node.defaultChild as CfnResource);

        const dnssec = new CfnDNSSEC(this, `${domain}-dnssec`, {
            hostedZoneId: hostedZone.hostedZoneId
        });
        dnssec.addDependency(ksk);

        return hostedZone;
    }

    private createNameserverRecords(zone: PublicHostedZone) {
        new ARecord(zone, 'Ns1ARecord', {
            zone,
            ttl: Duration.days(2),
            recordName: 'ns1',
            target: RecordTarget.fromIpAddresses('205.251.198.244')
        });
        new AaaaRecord(zone, 'Ns1AAAARecord', {
            zone,
            ttl: Duration.days(2),
            recordName: 'ns1',
            target: RecordTarget.fromIpAddresses('2600:9000:5306:f400::1')
        });

        new ARecord(zone, 'Ns2ARecord', {
            zone,
            ttl: Duration.days(2),
            recordName: 'ns2',
            target: RecordTarget.fromIpAddresses('205.251.192.163')
        });
        new AaaaRecord(zone, 'Ns2AAAARecord', {
            zone,
            ttl: Duration.days(2),
            recordName: 'ns2',
            target: RecordTarget.fromIpAddresses('2600:9000:5300:a300::1')
        });

        new ARecord(zone, 'Ns3ARecord', {
            zone,
            ttl: Duration.days(2),
            recordName: 'ns3',
            target: RecordTarget.fromIpAddresses('205.251.195.25')
        });
        new AaaaRecord(zone, 'Ns3AAAARecord', {
            zone,
            ttl: Duration.days(2),
            recordName: 'ns3',
            target: RecordTarget.fromIpAddresses('2600:9000:5303:1900::1')
        });

        new ARecord(zone, 'Ns4ARecord', {
            zone,
            ttl: Duration.days(2),
            recordName: 'ns4',
            target: RecordTarget.fromIpAddresses('205.251.197.99')
        });
        new AaaaRecord(zone, 'Ns4AAAARecord', {
            zone,
            ttl: Duration.days(2),
            recordName: 'ns4',
            target: RecordTarget.fromIpAddresses('2600:9000:5305:6300::1')
        });
    }

    private createElite12Records(zone: IPublicHostedZone) {
        new E12ServerRecord(zone, 'E12Root', {
            zone
        });
        new E12ServerRecord(zone, 'E12Wild', {
            zone,
            name: '*'
        });
        new E12MonitoringRecord(zone, 'E12MonitoringRoot', {
            zone,
            name: 'monitoring'
        });
        new E12MonitoringRecord(zone, 'E12MonitoringWild', {
            zone,
            name: '*.monitoring'
        });
        new ARecord(zone, 'Ipv4Record', {
            zone,
            ttl: DEFAULT_TTL,
            recordName: 'ipv4',
            target: RecordTarget.fromIpAddresses(E12_SERVER_IPV4),
        });
        new AaaaRecord(zone, 'Ipv6Record', {
            zone,
            ttl: DEFAULT_TTL,
            recordName: 'ipv6',
            target: RecordTarget.fromIpAddresses(E12_SERVER_IPV6),
        });
        new LetsencryptCAARecord(zone, 'CAA', {
            zone
        });
        new GoogleMailRecords(zone, 'MailRecords', {
            zone,
            domainKeys: {
                '18102016': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxFZEoeJve+IS0GMc0p2G n2rf3HAi9TayBciz04Xx2j/anys/HxCHiw48Sz36BkQqxE83dh5OR7PGLhwHjY5T HlxtOdY3bIdsO2exKyHz38A/Eu2xHDKqCo3fGdAa+3FHoiMeigbZ/9++gBZmXiFs 9h0b7T/qzP4W3jKdlGbZ2zk8kuu8sZQjcwSSPlpnyHckV0XDzl6RzOlilXsIZtoH bxa6Nwj+ool5ygFwpTdMLnpuxvYV23PiJUos4LKN7O50iiScTGlb8MiF6EIeXi58 ZAsq4Bhu0Zf69tn2vsEaEr8GuG1twSRcB7h3Kqy1ZRprNStIUYCpbY7IHOkHozMK zQIDAQAB',
                'g18102016': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAgA2tuBVL5JhYkCqF0Qh4Z97GyDnvt5uQefZx6hXycGMCXfZaCI5XpFo0ey0+H/Uqc19woo53PWxrTxsXAK6N0mK2vRHMI9eHsAS3ZK6KSy/PzK2QDObZl2E+lrYtwSss6IZBMOhgRHglw0ZOtmzfabBV2KJGepIDUvBAtFqC3lPBAuNXC5kxUj6IArMp6T8OWoirJ3gpE1DRi8YcyNnHx8ZpbcQ9hQRq1h3njcZsBwKRUprSYobkiX/LMaxHHpI4YrLyhT59vy8R/THNSU7Me61UB1prcjMb+ohfAyHpyJuSX3RX/T0AvZQV2XCUSpQPfk1h4mMGHCtw6FzC63hYZwIDAQAB'
            }
        });
        new TxtRecord(this, `DmarcAllowMailBundRecord`, {
            zone,
            ttl: DEFAULT_TTL,
            recordName: 'bund-von-theramore.de._report._dmarc',
            values: [
                'v=DMARC1'
            ]
        });
        new TxtRecord(this, `DmarcAllowMailKirschbaumRecord`, {
            zone,
            ttl: DEFAULT_TTL,
            recordName: 'kirschbaum.me._report._dmarc',
            values: [
                'v=DMARC1'
            ]
        });
        new TxtRecord(this, `DmarcAllowMailTrigardonRecord`, {
            zone,
            ttl: DEFAULT_TTL,
            recordName: 'trigardon-rg.de._report._dmarc',
            values: [
                'v=DMARC1'
            ]
        });
    }
    private createKirschbaumCloudRecords(zone: IPublicHostedZone) {
        new CaaAmazonRecord(zone, 'CaaAmazon', {
            zone
        });
    }
    private createKirschbaumMeRecords(zone: IPublicHostedZone) {
        new E12ServerRecord(zone, 'E12Root', {
            zone
        });
        new E12ServerRecord(zone, 'E12Wild', {
            zone,
            name: '*'
        });
        new LetsencryptCAARecord(zone, 'CAA', {
            zone
        });
        new GoogleMailRecords(zone, 'MailRecords', {
            zone,
            domainKeys: {
                '18102016': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwepCfXq8h3A9BALXUmj0 7xUvr7jsSDkAxuX8y30jJ9NzzcQkuAHVlg6OJ8VCFIcWXsWTfPbp79msag8TndRT jaCH4+nFpUoRBtrHhDmQ1CCTaXDB97tvNshk63x+5qnn9X221OTgg3TA0PL6lJjK 7Nyyra72emnC1NGNA15Jbh9WBHU+ZFWJL6mgS2aCQISabfR4YZE9wCI73e4D9BCu NnANjmJbQcY37BgR+FWyjNIXUT6lDAebJeLqffbU9cYmjtuCTWZMs/2lTxDcmHAt /Gcwg3NWw9IaKVSCyAlPn03keuGNN18NUSyeXm8MbSISoRbf7hrU1qvQJh8E0TgB RwIDAQAB',
                'g18102016': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvXDuLMb7IB4eLodktPplslADR7WfUSt1Q/aLAATiAqdsT9rcVOIFkdTYNq6pUS0gnGvUrgzKxiN44ggqn7J5k0WcX6sCOeHkPhv2T9BXJOYeA0wv14XKaePCGopmLCbVh/18aZah065xFhF9Ohp1KCzVM211ZNtpCcgDqXaQadsfCbSXKBM7dcplYnp9HR1xm0Y8H5vv3hXdwLTFMmIeJXPHs3LD+3opY836HprDcR9fEA5TT20832J227cYD6ZzQCmO3YSgHpxZ9VVX+xU8LtkUjvfr+6xzvx148h6zKwRCZOvvicOdOqpNy+X7XJVzGLMJVUmY55U57Q8W7WWRawIDAQAB'
            }
        });
        new ARecord(zone, 'ExtGWARecord', {
            zone,
            ttl: DEFAULT_TTL,
            recordName: 'ext-gw',
            target: RecordTarget.fromIpAddresses('188.68.49.21'),
        });
        new AaaaRecord(zone, 'ExtGWAAAARecord', {
            zone,
            ttl: DEFAULT_TTL,
            recordName: 'ext-gw',
            target: RecordTarget.fromIpAddresses('2a03:4000:6:d0e1::1'),
        });

    }
    private createBundvonTeramoreDeRecords(zone: IPublicHostedZone) {
        new E12ServerRecord(zone, 'E12Root', {
            zone
        });
        new E12ServerRecord(zone, 'E12Wild', {
            zone,
            name: '*'
        });
        new LetsencryptCAARecord(zone, 'CAA', {
            zone
        });
        new GoogleMailRecords(zone, 'MailRecords', {
            zone,
            domainKeys: {
                '18102016': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAx/ngPRGO8bFfZt7UlOOiw40M2PCOLg1zadL+oYrzSh7WO9an8jRf2FOdp1hWC+/n7Gd2vvHRfzvuBA/XublIWafo1j2v/7GkfmIDwiYiXPKYMziI0ddrNib7AKOOEOmBCFUP+UsI4Z1iuL60F/k4UI/+W6VpfFkZKKQNezBS7Qcdv5ejum5eSafqEHyUhVjODdc/darzxgNKu3Q22dcxqu1q2N96n1sL6sdlzDxXd6kO4cEBdLkTWujOK7A7SeUulpXYHBkVFnexRSQmu9DHpz/qrRwcrJFVepzIIr5DpIOGYw5/ChLnsiI7lVaAr29wdrr5v0Yz+99FzdHHSziE9wIDAQAB',
                'g18102016': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjS+3U6bERFAUDhJ+yfafjwEELCERab3MLCVF8+FCz46qBkUsoQlim68MSL37ShUT34FsYSMAsTdRKJVCtdbk79Za2yuzh/0uZ3jsC/+QCpC06VAZKdWzZB4Myept0fPUjmseCjZfSVOvPN0fNrngxUmXxKNHuqSLA9UQS5ex8MB4UJl7m7/ixUsvjHQdJdi2usO6TdGnadKlS+2gYl+VYrzf+R/z9eEy8edhp+BkBlSlGVmzCSPYAV5Ykp9iC7fJz7p2w9etYytTG8U7Jh4jh75KzSojGgWz6miU9DXdroczEdsYATJyTE5O981er89Tzm0mFdbTuKPbSHMFZXncmQIDAQAB'
            }
        });
        new SrvRecord(zone, 'TS3SRV', {
            zone,
            ttl: DEFAULT_TTL,
            recordName: '_ts3._udp',
            values: [
                {
                    port: 5732,
                    weight: 2,
                    priority: 1,
                    hostName: 'server.elite12.de'
                }
            ]
        });
    }
    private createTheramoReRecords(zone: IPublicHostedZone) {
        new E12ServerRecord(zone, 'E12Root', {
            zone
        });
        new E12ServerRecord(zone, 'E12Wild', {
            zone,
            name: '*'
        });
        new CaaRecord(this, 'CAA', {
            zone,
            ttl: DEFAULT_TTL,
            values: [
                {
                    tag: CaaTag.IODEF,
                    flag: 0,
                    value: 'mailto:caa@kirschbaum.me'
                },
                {
                    tag: CaaTag.ISSUE,
                    flag: 0,
                    value: 'amazon.com'
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
        new GoogleMailRecords(zone, 'MailRecords', {
            zone,
            domainKeys: {
                '18102016': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzvYhbJ58gS+fxyUgcIOr 0sUvJfw4e38ly7CQ1AzJ2mZqYzU2x6DmzgHfN3rhr3ReUqiF+n5v8x2VEE5N0M3H KRMwHdUG2rOMG8w6+uSBnzeyT21Wu6/Qivc+0N9SV2SmY1jRuvqsQ9i06MQ1Qo60 k9vn6BL1TXZREpcEbIzABb/88G0zj7yWhBYAYgmZmZAnKT8EoDkH8MFTdeI0RCi/ VjfL+QvW0tC1YNlLN5s2xthINpbozUzKo2CZ9GxnXh5cxiLLxwuGTTV4g90rZGEA C4L+vh2hME0BmICjTLPOJb0yvviYhsUcMVO6OTK7xn41TjG3riumCGV6J002Drja uwIDAQAB',
                'g18102016': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsCxnyi5zDkB3iDdXvh2hl5Facm4bokGQvILLpmKxHq7ti3YWJHJUfyQ02tQVvfjMKEP7DK7UOAmN9bexUJsq9GBAHP10fx66D2FHjuu5vfwm3xp65vN27t5iM8HEfqKX7dTG+oRKM1eO0fGKhliwyJlHQti9trFnzUKlkxU+7N1m/B/5EGu53fxpGQu1UQY2Jas/UOEU+YLVoogSyZTM8htB5efUF8d0f6Ggbpb4CJN6ZPIcUg5Qr+K/sipJsiUyk4Xdoi3I/FZhNptK/dDglpB8UCUTtIfyH0ms4qXRKjQvnqbj9m+H2XKkC65LcIiT7OxKNyEqejnvs2fSLaViFwIDAQAB'
            }
        });
        new SrvRecord(zone, 'TS3SRV', {
            zone,
            ttl: DEFAULT_TTL,
            recordName: '_ts3._udp',
            values: [
                {
                    port: 5732,
                    weight: 2,
                    priority: 1,
                    hostName: 'server.elite12.de'
                }
            ]
        });
    }
    private createMarkusDopeRecords(zone: IPublicHostedZone) {
        new E12ServerRecord(zone, 'E12Root', {
            zone
        });
        new E12ServerRecord(zone, 'E12Wild', {
            zone,
            name: '*'
        });
        new LetsencryptCAARecord(zone, 'CAA', {
            zone
        });
        new GoogleMailRecords(zone, 'MailRecords', {
            zone,
            domainKeys: {
                '18102016': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3Xc8E00/FDJ6l1u1TeoGXGD8+aibm8SGKSuoNEYiLE0pfpUokWwzQEIFoR9NHvAqaJgjVYpJJ7azecXOqfNzYMEe5RiEsZ7vFRinozaIpliGCkDtYL3lTYsMuLcF45fW9Vdxuxk59JVSy4gvavgiqtdhSwCfg/Fut6mhwlXXcVJ5opB0vCk62lt5NwyVLA/TyIvA7hPffjgx1mw6798JlLHVoJcq7LEDfgguHmsEgTmxSGteU/U/+so6OJtIfIaNsxvy9hEcoiAWL00JAER7WKNN0jaTF8CgtpS5QDdewQ78XLouanyUp3okaK5ojHpBX6VFq6UOWbXdYoH1kgZGhQIDAQAB',
                'g18102016': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqgcZiSEkHo/0X/CziEz8eEklImh1mN5x7PXrNTGiahujwWzTiBLfpDjgacvsHIMpXUShi3Tl+e7X52m0DsBSK6DMkgzIFnQvJ2PbJ8giCh5k3iTaxGd6WuqcCQHg5ARrqmvgZyQegLWxLMXfgQi3SaVTsez+0OGhYDsdcdHEMpI9fud3XRN8QvNumlPz3SuNJ0VvDvFCY9GglQhi5z8K1MT6DBJQgK05BHCeXc9ltoBD4/GzXR+/zZ5v1jBmMONvoYbQgrt1jZ84WCucR54YmdpGlgMXFCqfaW72ZFKtpaJbeseR3ycVv0iKU5+BbXYlVMjeGKXcJewWmLH2gl2lhQIDAQAB'
            }
        });
    }
    private createGrillteller42DeRecords(zone: IPublicHostedZone) {
        new E12ServerRecord(zone, 'E12Root', {
            zone
        });
        new E12ServerRecord(zone, 'E12Wild', {
            zone,
            name: '*'
        });
        new LetsencryptCAARecord(zone, 'CAA', {
            zone
        });
    }
    private createTrigardonRgDeRecords(zone: IPublicHostedZone) {
        new E12ServerRecord(zone, 'E12Root', {
            zone
        });
        new E12ServerRecord(zone, 'E12Wild', {
            zone,
            name: '*'
        });
        new LetsencryptCAARecord(zone, 'CAA', {
            zone
        });
        new GoogleMailRecords(zone, 'MailRecords', {
            zone,
            domainKeys: {
                '18102016': 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDWnLdm+Hsg2DoceRpEKHV9zvAQEMwORGaOEc3BoNUaItQ/lg07AjWlaH+afEaf1G9QTVxodWBVwx2euV+yxuVdqmU43cPty3YzdHQv/GBLXafrAY4TqGWo8qCKpPazvmxv1R5hIYnXKa+jKNxqcEDzDOtZzT4jMFmh4CoGnpUQ3QIDAQAB',
                'g18102016': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw8ldG7q9BR5mgn1IevBpxKT7OBWBd6T209+C7SXXHIJH4lUqSyRnLxq4MHFKUARxABZUV3K8sZ3GQvJI1/HLD9LEGXpCxVvdUJMv//TuKdzRug+awIW4t9fl1yovoC4w1zQN0pIGvwafrhtniZYAJrvOZVhF5ngTDUvqjo8ue4dAvRyfD6cxWZb70t4m4gOD3pnAsM4OuONOy06joCuNQosV4XQ/aR0iCXlli8LcaZSwihY6tx8eZkqprjgKmx1/pPcdePzmx9NOOi9iAGiGfC6qesFUBq8eMy3Qk5oyGijxh75S2MRkmRwEVZy/aXwnUI0OLRoWyZgMd4z6w5uVdQIDAQAB'
            }
        });
        new SrvRecord(zone, 'TS3SRV', {
            zone,
            ttl: DEFAULT_TTL,
            recordName: '_ts3._udp',
            values: [
                {
                    port: 3955,
                    weight: 2,
                    priority: 1,
                    hostName: 'server.elite12.de'
                }
            ]
        });
    }

    private createWesterwaldEsportDeRecords(zone: PublicHostedZone) {
        new E12ServerRecord(zone, 'E12Root', {
            zone
        });
        new E12ServerRecord(zone, 'E12Wild', {
            zone,
            name: '*'
        });
        new LetsencryptCAARecord(zone, 'CAA', {
            zone
        });
    }
}
