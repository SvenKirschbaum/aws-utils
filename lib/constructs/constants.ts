import {Duration} from "aws-cdk-lib";

export const DEFAULT_TTL = Duration.hours(1);
export const LONG_TTL = Duration.days(2);

interface HostProperties {
    V4: string;
    V6: string;
}

export const HOSTS: {[key: string]: HostProperties} = {
    'main-01-nue-nc': {
        V4: "89.58.34.152",
        V6: "2a03:4000:64:95::1"
    },
    'main-02-nue-nc': {
        V4: "159.195.67.176",
        V6: "2a0a:4cc0:c2:18b4::1"
    },
    'obs-01-vie-nc': {
        V4: "152.53.19.135",
        V6: "2a0a:4cc0:1:11b6::1"
    },
    'gw-02-nue-nc': {
        V4: "194.13.83.74",
        V6: "2a03:4000:43:254::1"
    },
    'gw-03-nue-nc': {
        V4: "159.195.69.148",
        V6: "2a0a:4cc0:c2:2330::1"
    },
    // These are technically not Hostnames, but it is convenient to have them here
    'ns1': {
        V4: "205.251.197.240",
        V6: "2600:9000:5305:f000::1",
    },
    'ns2': {
        V4: "205.251.193.155",
        V6: "2600:9000:5301:9b00::1",
    },
    'ns3': {
        V4: "205.251.194.127",
        V6: "2600:9000:5302:7f00::1",
    },
    'ns4': {
        V4: "205.251.199.225",
        V6: "2600:9000:5307:e100::1",
    },
}

interface DomainProperties {
    defaultRecords: boolean;
    domainKeys?: {[key: string]: string}
}

// WARNING: The Zones have been manually created with a reusable delegation set before being imported into CDK management.
// Further zones should follow the same procedure, to use the same white-label nameservers.
// The create-hosted-zone script can be used to create a new zone, and the update-default-records
// script can be used to update the SOA and NS records.
export const DOMAINS: {[key: string]: DomainProperties} = {
    'elite12.de': {
        defaultRecords: true,
        domainKeys: {
            'g18102016': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAgA2tuBVL5JhYkCqF0Qh4Z97GyDnvt5uQefZx6hXycGMCXfZaCI5XpFo0ey0+H/Uqc19woo53PWxrTxsXAK6N0mK2vRHMI9eHsAS3ZK6KSy/PzK2QDObZl2E+lrYtwSss6IZBMOhgRHglw0ZOtmzfabBV2KJGepIDUvBAtFqC3lPBAuNXC5kxUj6IArMp6T8OWoirJ3gpE1DRi8YcyNnHx8ZpbcQ9hQRq1h3njcZsBwKRUprSYobkiX/LMaxHHpI4YrLyhT59vy8R/THNSU7Me61UB1prcjMb+ohfAyHpyJuSX3RX/T0AvZQV2XCUSpQPfk1h4mMGHCtw6FzC63hYZwIDAQAB'
        }
    },
    'kirschbaum.me': {
        defaultRecords: true,
        domainKeys: {
            'g18102016': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvXDuLMb7IB4eLodktPplslADR7WfUSt1Q/aLAATiAqdsT9rcVOIFkdTYNq6pUS0gnGvUrgzKxiN44ggqn7J5k0WcX6sCOeHkPhv2T9BXJOYeA0wv14XKaePCGopmLCbVh/18aZah065xFhF9Ohp1KCzVM211ZNtpCcgDqXaQadsfCbSXKBM7dcplYnp9HR1xm0Y8H5vv3hXdwLTFMmIeJXPHs3LD+3opY836HprDcR9fEA5TT20832J227cYD6ZzQCmO3YSgHpxZ9VVX+xU8LtkUjvfr+6xzvx148h6zKwRCZOvvicOdOqpNy+X7XJVzGLMJVUmY55U57Q8W7WWRawIDAQAB'
        }
    },
    'kirschbaum.cloud': {
        defaultRecords: false,
        domainKeys: {
            'g27072024': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtw2x1ArPmOjOiH3eBJpRKfY4Om18pT7yKU6UPZnzeHSXZjbHdA4WRA9QYXrb/08u8jAlhwBm4EI2SLdOzSUB+HuxB3HXkncincXM/PvegWlELgtwhgVjXYr8nMbnPE3Lqu67kHKagzz7nnX8re0DSQSO92WaoSzTORu4UXFS/WKTcyAtuF+bAty/R6LxtIjwy1i6UNaob+ElVqi6abHT2hYpLieUZpaGHIYHlQFWfdnk4e4qI9cfClzaMKNNmZVsW4HBJoql3WAg78f6OXh44wjDE7XXwj+tfE84unRi/lmHR8PVIKcNuLfDKPqOkuEOZcvGBvi6gqfX0sxR9FAmZwIDAQAB'
        }
    },
    'bund-von-theramore.de': {
        defaultRecords: true,
        domainKeys: {
            'g18102016': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjS+3U6bERFAUDhJ+yfafjwEELCERab3MLCVF8+FCz46qBkUsoQlim68MSL37ShUT34FsYSMAsTdRKJVCtdbk79Za2yuzh/0uZ3jsC/+QCpC06VAZKdWzZB4Myept0fPUjmseCjZfSVOvPN0fNrngxUmXxKNHuqSLA9UQS5ex8MB4UJl7m7/ixUsvjHQdJdi2usO6TdGnadKlS+2gYl+VYrzf+R/z9eEy8edhp+BkBlSlGVmzCSPYAV5Ykp9iC7fJz7p2w9etYytTG8U7Jh4jh75KzSojGgWz6miU9DXdroczEdsYATJyTE5O981er89Tzm0mFdbTuKPbSHMFZXncmQIDAQAB'
        }
    },
    'theramo.re': {
        defaultRecords: true,
        domainKeys: {
            'g18102016': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsCxnyi5zDkB3iDdXvh2hl5Facm4bokGQvILLpmKxHq7ti3YWJHJUfyQ02tQVvfjMKEP7DK7UOAmN9bexUJsq9GBAHP10fx66D2FHjuu5vfwm3xp65vN27t5iM8HEfqKX7dTG+oRKM1eO0fGKhliwyJlHQti9trFnzUKlkxU+7N1m/B/5EGu53fxpGQu1UQY2Jas/UOEU+YLVoogSyZTM8htB5efUF8d0f6Ggbpb4CJN6ZPIcUg5Qr+K/sipJsiUyk4Xdoi3I/FZhNptK/dDglpB8UCUTtIfyH0ms4qXRKjQvnqbj9m+H2XKkC65LcIiT7OxKNyEqejnvs2fSLaViFwIDAQAB'
        }
    },
    'markus-dope.de': {
        defaultRecords: true,
        domainKeys: {
            'g18102016': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqgcZiSEkHo/0X/CziEz8eEklImh1mN5x7PXrNTGiahujwWzTiBLfpDjgacvsHIMpXUShi3Tl+e7X52m0DsBSK6DMkgzIFnQvJ2PbJ8giCh5k3iTaxGd6WuqcCQHg5ARrqmvgZyQegLWxLMXfgQi3SaVTsez+0OGhYDsdcdHEMpI9fud3XRN8QvNumlPz3SuNJ0VvDvFCY9GglQhi5z8K1MT6DBJQgK05BHCeXc9ltoBD4/GzXR+/zZ5v1jBmMONvoYbQgrt1jZ84WCucR54YmdpGlgMXFCqfaW72ZFKtpaJbeseR3ycVv0iKU5+BbXYlVMjeGKXcJewWmLH2gl2lhQIDAQAB'
        }
    },
    'grillteller42.de': {
        defaultRecords: true,
        domainKeys: {
            'g27072024': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjsmiMpaLsyGE6RRRELoUE6+wlZWYI7acYi3Sgs0xyRYgcubkH8WG1Vf/xf2NltOocIJL7Hf7MjCC0AQD+Q7QnZMictqGsjxl1VG6ZY9UzMdgP4TZMVg5lRA8lcecC/1ZpmldWHasgT2E+TW4xrgtax1lPqR93N0C1y38kEa9McfXiayp5NLD0uygYDCyc44QS3fo8hnsS2TBrCqSFY5fKjGBGs7UMt9sgWoQU1yQJL4aX4Ad2eU8kUDq1scdJhjCllfUxpCaabqa3Gb1yZxnWShznbIVYrigfnjAEztL3hxqXb2+lMwoEuCh8Py4FcpjCgJSr315RGnR1vJrxkrLHwIDAQAB'
        }
    },
    'trigardon-rg.de': {
        defaultRecords: true,
        domainKeys: {
            'g18102016': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw8ldG7q9BR5mgn1IevBpxKT7OBWBd6T209+C7SXXHIJH4lUqSyRnLxq4MHFKUARxABZUV3K8sZ3GQvJI1/HLD9LEGXpCxVvdUJMv//TuKdzRug+awIW4t9fl1yovoC4w1zQN0pIGvwafrhtniZYAJrvOZVhF5ngTDUvqjo8ue4dAvRyfD6cxWZb70t4m4gOD3pnAsM4OuONOy06joCuNQosV4XQ/aR0iCXlli8LcaZSwihY6tx8eZkqprjgKmx1/pPcdePzmx9NOOi9iAGiGfC6qesFUBq8eMy3Qk5oyGijxh75S2MRkmRwEVZy/aXwnUI0OLRoWyZgMd4z6w5uVdQIDAQAB'
        }
    },
    'westerwald-esport.de': {
        defaultRecords: true,
        domainKeys: {
            'g18102016': 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApsvZT6MOvasdtSnTz38y1Zwxcaq/FYV5zP789JyoUHuLktY9lRgYGIXeJrxaSjo+RlCrqN3g4cfHX/MGkwxwpp3Qal7zDvRBERWyyj169s8N8UWi8AIsMzFqAymJPkCDU3nW99WXafJrFZvmX1lVpY1cctA/G4pjx1RCT7Ixcv72hWR8lRgUWlc2lEIykZQ9s4tUd3+NbsreUnxgkvN4PD0M7w9ORU7b7iIAR2N5DAwgD5FiTQ84JiqZILzQ69y6CS/FCdlLSxPcq7yYO+OsQ8zj/RAAvfG4CrRykxMHAi3GTo8RHWyxgt8MHmZpcgtJQU0Vz+MZiaM0Dx6KdWRpmwIDAQAB'
        }
    },
};