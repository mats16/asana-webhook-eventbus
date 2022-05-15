import { App, Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { EventBus } from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { ApiEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const eventBus = new EventBus(this, 'EventBus');

    const parameterPrefix = `/${this.stackName}/HookSecret`;

    const parameterStatement = new iam.PolicyStatement({
      actions: [
        'ssm:GetParameter',
        'ssm:PutParameter',
      ],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter${parameterPrefix}/*`,
      ],
    });

    const processPayloadFunction = new NodejsFunction(this, 'ProcessPayload', {
      entry: './src/functions/process-payload/index.ts',
      runtime: lambda.Runtime.NODEJS_16_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: Duration.seconds(60),
      environment: {
        EVENT_BUS_NAME: eventBus.eventBusName,
      },
    });
    eventBus.grantPutEventsTo(processPayloadFunction);

    const receiveWebhookFunction = new NodejsFunction(this, 'ReceiveWebhook', {
      entry: './src/functions/receive-webhook/index.ts',
      runtime: lambda.Runtime.NODEJS_16_X,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        PARAMETER_PREFIX: parameterPrefix,
        PROCESS_PAYLOAD_FUNCTION_NAME: processPayloadFunction.functionName,
      },
      initialPolicy: [parameterStatement],
      events: [new ApiEventSource('POST', '/{proxy+}')],
    });
    processPayloadFunction.grantInvoke(receiveWebhookFunction);

    new CfnOutput(this, 'EventBusName', { value: eventBus.eventBusName, exportName: `${this.stackName}Name` });
    new CfnOutput(this, 'EventBusArn', { value: eventBus.eventBusArn, exportName: `${this.stackName}Arn` });
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