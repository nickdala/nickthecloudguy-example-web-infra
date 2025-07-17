import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { get } from 'http';

interface GithubCredsStackProps extends cdk.StackProps {
    cfd: cloudfront.Distribution;
    bucketName: string;
    githubRepo: string;
}

// https://aws.amazon.com/blogs/security/use-iam-roles-to-connect-github-actions-to-actions-in-aws/
export class GithubCredsStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: GithubCredsStackProps) {
    super(scope, id, props);

    // Get account id
    const accountId = props?.env?.account;
    const OIDC_PROVIDER_ARN=`arn:aws:iam::${accountId}:oidc-provider/token.actions.githubusercontent.com`;

    // Get the OIDC provider from the ARN
    // check if the provider already exists
    // If it exists, use the existing provider instead of creating a new one
    // This is useful if you are running the stack multiple times or if the provider already exists
    let githubProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(this, 'GitHubOIDC', OIDC_PROVIDER_ARN);
    if (githubProvider) {
       console.log('Using existing GitHub OIDC provider:', githubProvider.openIdConnectProviderArn);
    } else {
       console.log('Creating new GitHub OIDC provider');
       githubProvider = new iam.OpenIdConnectProvider(this, 'GitHubOIDC', {
           url: 'https://token.actions.githubusercontent.com',
           clientIds: ['sts.amazonaws.com'],
       });
    }

    // IAM Role for GitHub Actions
    const githubRole = new iam.Role(this, 'GitHubActionsRole', {
        assumedBy: new iam.WebIdentityPrincipal(githubProvider.openIdConnectProviderArn, {
            StringEquals: {
                'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com'
            },
            StringLike: {
                'token.actions.githubusercontent.com:sub': `repo:${props.githubRepo}:*`,
            }
        }),
        description: 'Role for GitHub Actions to assume',
        roleName: 'GitHubActionsRole',
        inlinePolicies: {
            GitHubActionsPolicy: new iam.PolicyDocument({
                statements: [
                    new iam.PolicyStatement({
                        actions: [
                            's3:PutObject',
                            's3:GetObject',
                            's3:ListBucket',
                            's3:DeleteObject'
                        ],
                        resources: [
                            'arn:aws:s3:::' + props.bucketName,
                            'arn:aws:s3:::' + props.bucketName + '/*'],
                    }),
                    // Add permissions for CloudFront invalidation
                    new iam.PolicyStatement({
                        actions: [
                            'cloudfront:CreateInvalidation',
                            'cloudfront:GetInvalidation',
                            'cloudfront:ListInvalidations'
                        ],
                        resources: [props.cfd.distributionArn],
                    })
                ],
            })
        }
    });

    // Output the role ARN
    new cdk.CfnOutput(this, 'GitHubActionsRoleArn', {
        value: githubRole.roleArn,
        description: 'The ARN of the GitHub Actions role',
        exportName: 'GitHubActionsRoleArn',
    });
  }
}