import {Duration, Stack, StackProps} from "aws-cdk-lib";
import {Construct} from "constructs";
import {
    AaaaRecord,
    ARecord,
    PublicHostedZone,
    RecordSet,
    RecordTarget,
    ZoneDelegationRecord
} from "aws-cdk-lib/aws-route53";

export class RootDnsStack extends Stack {

    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props);

        // WARNING: The Zone has been manually created with a reusable delegation set.
        // Further zones should follow the same procedure, to use the same white-label nameservers.
        const zone = new PublicHostedZone(this, 'kirschbaum.cloud', {
            zoneName: 'kirschbaum.cloud',
            caaAmazon: true,
        });

        this.createRootNameserverRecords(zone);
    }

    private createRootNameserverRecords(zone: PublicHostedZone) {
        new ARecord(this, 'Ns1ARecord', {
            zone,
            ttl: Duration.days(2),
            recordName: 'ns1',
            target: RecordTarget.fromIpAddresses('205.251.198.244')
        });
        new AaaaRecord(this, 'Ns1AAAARecord', {
            zone,
            ttl: Duration.days(2),
            recordName: 'ns1',
            target: RecordTarget.fromIpAddresses('2600:9000:5306:f400::1')
        });

        new ARecord(this, 'Ns2ARecord', {
            zone,
            ttl: Duration.days(2),
            recordName: 'ns2',
            target: RecordTarget.fromIpAddresses('205.251.192.163')
        });
        new AaaaRecord(this, 'Ns2AAAARecord', {
            zone,
            ttl: Duration.days(2),
            recordName: 'ns2',
            target: RecordTarget.fromIpAddresses('2600:9000:5300:a300::1')
        });

        new ARecord(this, 'Ns3ARecord', {
            zone,
            ttl: Duration.days(2),
            recordName: 'ns3',
            target: RecordTarget.fromIpAddresses('205.251.195.25')
        });
        new AaaaRecord(this, 'Ns3AAAARecord', {
            zone,
            ttl: Duration.days(2),
            recordName: 'ns3',
            target: RecordTarget.fromIpAddresses('2600:9000:5303:1900::1')
        });

        new ARecord(this, 'Ns4ARecord', {
            zone,
            ttl: Duration.days(2),
            recordName: 'ns4',
            target: RecordTarget.fromIpAddresses('205.251.197.99')
        });
        new AaaaRecord(this, 'Ns4AAAARecord', {
            zone,
            ttl: Duration.days(2),
            recordName: 'ns4',
            target: RecordTarget.fromIpAddresses('2600:9000:5305:6300::1')
        });
    }
}
