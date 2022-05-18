import { App, Stack, StackProps, Duration, CfnOutput, CfnParameter } from 'aws-cdk-lib';
import { RestApi, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    this.templateOptions.transforms = ['AWS::Serverless-2016-10-31'];
    this.templateOptions.metadata = {
      'AWS::ServerlessRepo::Application': {
        Name: 'AsanaEventBus',
        Description: 'EventBus for Asana Webhook',
        Author: 'mats',
        SpdxLicenseId: 'Apache-2.0',
        LicenseUrl: 'LICENSE.txt',
        ReadmeUrl: 'README.md',
        HomePageUrl: 'https://github.com/mats16/asana-webhook-eventbus',
        SourceCodeUrl: 'https://github.com/mats16/asana-webhook-eventbus',
        SemanticVersion: '0.0.3',
      },
    };

    const eventBusExportName = new CfnParameter(this, 'EventBusExportName', {
      description: 'Export name of EventBus',
      type: 'String',
      allowedPattern: '^[\\w]+$',
      default: 'AsanaEventBusName',
    });

    const parameterStorePrefix = new CfnParameter(this, 'ParameterStorePrefix', {
      description: 'Namespace to store secrets received from Asana at the handshake',
      type: 'String',
      allowedPattern: '^(/[\\w]+)+[^/]$',
      default: '/Asana/Webhook/Secrets',
    });

    const eventBus = new EventBus(this, 'EventBus');

    const parameterStatement = new PolicyStatement({
      actions: [
        'ssm:GetParameter',
        'ssm:PutParameter',
      ],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter${parameterStorePrefix.valueAsString}/*`,
      ],
    });

    const processPayloadFunction = new NodejsFunction(this, 'ProcessPayloadFunction', {
      entry: './src/functions/process-payload/index.ts',
      runtime: lambda.Runtime.NODEJS_16_X,
      architecture: lambda.Architecture.ARM_64,
      tracing: lambda.Tracing.ACTIVE,
      timeout: Duration.seconds(60),
      environment: {
        EVENT_BUS_NAME: eventBus.eventBusName,
      },
    });
    eventBus.grantPutEventsTo(processPayloadFunction);

    const receiveWebhookFunction = new NodejsFunction(this, 'ReceiveWebhookFunction', {
      entry: './src/functions/receive-webhook/index.ts',
      runtime: lambda.Runtime.NODEJS_16_X,
      architecture: lambda.Architecture.ARM_64,
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        PARAMETER_PREFIX: parameterStorePrefix.valueAsString,
        PROCESS_PAYLOAD_FUNCTION_NAME: processPayloadFunction.functionName,
      },
      initialPolicy: [parameterStatement],
    });
    processPayloadFunction.grantInvoke(receiveWebhookFunction);

    const api = new RestApi(this, 'API', {
      restApiName: 'AsanaEventBus-ReceiveWebhookApi',
      deployOptions: {
        stageName: 'v1',
        throttlingRateLimit: 40,
        throttlingBurstLimit: 20,
        tracingEnabled: true,
      },
    });
    api.root.addResource('webhook').addResource('{identity}').addMethod('POST', new LambdaIntegration(receiveWebhookFunction));

    new CfnOutput(this, 'EventBusName', { value: eventBus.eventBusName, exportName: eventBusExportName.valueAsString });
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new MyStack(app, 'AsanaEventBus', { env: devEnv });
// new MyStack(app, 'asana-webhook-eventbus-prod', { env: prodEnv });

app.synth();