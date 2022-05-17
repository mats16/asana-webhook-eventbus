import { App, Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { RestApi, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    this.templateOptions.metadata = {
      'AWS::ServerlessRepo::Application': {
        Name: 'AsanaEventBus',
        Description: 'EventBus for Asana Webhook',
        Author: 'mats',
        SpdxLicenseId: 'Apache-2.0',
      },
    };

    const eventBus = new EventBus(this, 'EventBus');

    const parameterPrefix = `/${this.stackName}/Webhook/Secrets`;

    const parameterStatement = new PolicyStatement({
      actions: [
        'ssm:GetParameter',
        'ssm:PutParameter',
      ],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter${parameterPrefix}/*`,
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
        PARAMETER_PREFIX: parameterPrefix,
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

    new CfnOutput(this, 'EventBusName', { value: eventBus.eventBusName, exportName: 'AsanaEventBusName' });
    new CfnOutput(this, 'EventBusArn', { value: eventBus.eventBusArn, exportName: 'AsanaEventBusArn' });
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