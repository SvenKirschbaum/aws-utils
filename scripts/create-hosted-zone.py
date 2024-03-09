from datetime import datetime

import boto3
from mypy_boto3_route53 import Route53Client

client: Route53Client = boto3.client('route53')

domain = input("Enter domain name: ")

client.create_hosted_zone(
    Name=domain,
    CallerReference="create-hosted-zone-" + datetime.now().strftime("%H:%M:%S"),
    DelegationSetId="/delegationset/N0365425235J8SMER5KZ1",
)