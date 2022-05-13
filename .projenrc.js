const { awscdk } = require('projen');
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.24.0',
  defaultReleaseBranch: 'main',
  name: 'asana-webhook-eventbus',

  deps: [
    'crypto-js@4.1.1',
    '@aws-sdk/client-eventbridge',
    '@aws-sdk/client-ssm',
    '@types/aws-lambda',
  ],
  devDeps: [
    '@types/crypto-js',
  ],
  // packageName: undefined,  /* The "name" in package.json. */
});
project.synth();