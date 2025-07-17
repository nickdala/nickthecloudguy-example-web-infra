#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { WebCdkStack } from '../lib/web-stack';
import { GitHubCredsStack } from '../lib/github-creds';

const app = new cdk.App();

const DOMAIN_NAME = 'nickthecloudguy.com';
const SITE_DOMAIN = 'example' + '.' + DOMAIN_NAME;

const GITHUB_REPO = 'nickdala/nickthecloudguy-example-web';

const web = new WebCdkStack(app, 'WebCdkStack', {
    domainName: DOMAIN_NAME,
    siteDomain: SITE_DOMAIN,
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION
    }
});

new GitHubCredsStack(app, 'GitHubCredsStack', {
    cfd: web.distribution,
    bucketName: SITE_DOMAIN,
    githubRepo: GITHUB_REPO,
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION
    }
});
