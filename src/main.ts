import { App, Stack, StackProps } from 'aws-cdk-lib';
import { AuthorizationType } from 'aws-cdk-lib/aws-apigateway';
//import { AuthorizationType, RequestAuthorizer, IdentitySource } from 'aws-cdk-lib/aws-apigateway';
//import { HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha';
//import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { EventBus } from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { ApiEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
//import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const eventBus = new EventBus(this, 'EventBus');

    const parameterStatement = new iam.PolicyStatement({
      actions: [
        'ssm:GetParameter',
        'ssm:PutParameter',
      ],
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/${this.stackName}/*`],
    });

    const receiveWebhookFunction = new NodejsFunction(this, 'ReceiveWebhook', {
      entry: './src/functions/receive-webhook/index.ts',
      runtime: lambda.Runtime.NODEJS_16_X,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        STACK_NAME: this.stackName,
        EVENT_BUS_NAME: eventBus.eventBusName,
      },
      events: [
        new ApiEventSource('POST', '/projects/{gid}', { authorizationType: AuthorizationType.NONE }),
      ],
    });
    receiveWebhookFunction.addToRolePolicy(parameterStatement);
    eventBus.grantPutEventsTo(receiveWebhookFunction);

  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new MyStack(app, 'AsanaWebhook', { env: devEnv });
// new MyStack(app, 'asana-webhook-eventbus-prod', { env: prodEnv });

app.synth();