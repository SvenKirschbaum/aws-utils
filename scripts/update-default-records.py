import boto3

client = boto3.client('route53')

response = client.list_hosted_zones()
if response['IsTruncated']:
    raise Exception('Requires pagination')

zones = response['HostedZones']

for zone in zones:
    client.change_resource_record_sets(
        HostedZoneId=zone['Id'],
        ChangeBatch={
            'Changes': [
                {
                    'Action': 'UPSERT',
                    'ResourceRecordSet': {
                        'Name': zone['Name'],
                        'Type': 'SOA',
                        'TTL': 3600,
                        'ResourceRecords': [
                            {
                                'Value': 'ns1.elite12.de. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400'
                            },
                        ],
                    }
                },
                {
                    'Action': 'UPSERT',
                    'ResourceRecordSet': {
                        'Name': zone['Name'],
                        'Type': 'NS',
                        'TTL': 172800,
                        'ResourceRecords': [
                            {'Value': 'ns1.elite12.de.'},
                            {'Value': 'ns2.elite12.de.'},
                            {'Value': 'ns3.elite12.de.'},
                            {'Value': 'ns4.elite12.de.'}
                        ],
                    },
                }
            ]
        }
    )
