import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { CfnOutput, RemovalPolicy, aws_s3_deployment as s3deploy } from 'aws-cdk-lib';

import { BlockPublicAccess, BucketAccessControl } from 'aws-cdk-lib/aws-s3';

interface WebCdkStackProps extends cdk.StackProps {
  domainName: string;
  siteDomain: string;
}

export class WebCdkStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;
  public readonly examplebucket: s3.Bucket;
  constructor(scope: Construct, id: string, props: WebCdkStackProps) {
    super(scope, id, props);

    // Find the current hosted zone in Route 53
    const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: props.domainName });

    // Create a TLS/SSL certificate for HTTPS
    const certificate = new acm.Certificate(this, 'SiteCertificate', {
      domainName: props.domainName,
      subjectAlternativeNames: [props.siteDomain],
      validation: acm.CertificateValidation.fromDns(zone),
    });

    certificate.applyRemovalPolicy(RemovalPolicy.DESTROY)

    this.examplebucket = new s3.Bucket(this, 'ExampleSiteBucket', {
      bucketName: props.siteDomain,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: true,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: '200.html',
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
      accessControl: BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
    })
    new CfnOutput(this, 'Bucket', { value: this.examplebucket.bucketName });;

    // deploy the website to the bucket
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('./website')],
      destinationBucket: this.examplebucket,
      retainOnDelete: false
    });

    // Create a CloudFront distribution for the bucket
    this.distribution = new cloudfront.Distribution(this, 'ExampleDistribution', {
      certificate: certificate,
      defaultRootObject: "index.html",
      domainNames: [props.siteDomain],
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: new cloudfront_origins.S3StaticWebsiteOrigin(this.examplebucket),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      }
    });

    // Create a Route 53 alias record for the CloudFront distribution
    new route53.ARecord(this, 'WWWSiteAliasRecord', {
      zone,
      recordName: props.siteDomain,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution))
    });

    //Uncomment below if you want an 'A' record to Route 53 for the main domain name 'example.com'
    /*new route53.ARecord(this, 'SiteAliasRecord', {
      zone,
      recordName: props.domainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution))
    });
    */

    new CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId });

  }
}