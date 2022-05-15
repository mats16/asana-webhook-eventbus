const { awscdk } = require('projen');
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.24.1',
  defaultReleaseBranch: 'main',
  name: 'asana-webhook-eventbus',

  deps: [
    'crypto-js@4.1.1',
    '@aws-lambda-powertools/logger',
    '@aws-lambda-powertools/tracer',
    '@aws-sdk/client-eventbridge',
    '@aws-sdk/client-lambda',
    '@aws-sdk/client-ssm',
    '@aws-sdk/util-utf8-node',
    '@types/aws-lambda',
  ],
  devDeps: [
    '@types/crypto-js',
  ],
  // packageName: undefined,  /* The "name" in package.json. */
});
project.synth();