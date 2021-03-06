import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { SSMClient, PutParameterCommand, GetParameterCommand } from '@aws-sdk/client-ssm';
import { fromUtf8 } from '@aws-sdk/util-utf8-node';
import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { HmacSHA256 } from 'crypto-js';
import { AsanaPayload } from '../schema';

const parameterPrefix = process.env.PARAMETER_PREFIX;
const processPayloadFunctionName = process.env.PROCESS_PAYLOAD_FUNCTION_NAME;

const logger = new Logger({ serviceName: 'ReceiveWebhook' });
const tracer = new Tracer({ serviceName: 'ReceiveWebhook' });
const ssm = tracer.captureAWSv3Client(new SSMClient({}));
const lambda = tracer.captureAWSv3Client(new LambdaClient({}));

const getParameter = async(parameterName: string): Promise<string|undefined> => {
  const cmd = new GetParameterCommand({ Name: parameterName });
  const { Parameter } = await ssm.send(cmd);
  return Parameter?.Value;
};

const putParameter = async(parameterName: string, value: string, overwrite: boolean = false): Promise<void> => {
  const cmd = new PutParameterCommand({
    Name: parameterName,
    Value: value,
    Type: 'String',
    Description: 'Secret to verify signature from Asana webhook',
    Overwrite: overwrite,
  });
  await ssm.send(cmd);
};

const verifySignature = (signature: string, secret: string, body: string): boolean => {
  const hash = HmacSHA256(body, secret).toString();
  if (signature == hash) {
    logger.info('signature is valid');
    return true;
  } else {
    logger.error('signature is not valid');
    return false;
  }
};

const processPayload = async(payload: string) => {
  const cmd = new InvokeCommand({
    FunctionName: processPayloadFunctionName,
    Payload: fromUtf8(payload),
    InvocationType: 'Event',
  });
  await lambda.send(cmd);
};


export const handler: APIGatewayProxyHandler = async (event, _context) => {
  const { body, pathParameters } = event;
  const signature = event.headers['X-Hook-Signature'];
  const handshakeSecret = event.headers['X-Hook-Secret'];

  const secretParameterName = `${parameterPrefix}/${pathParameters?.identity}`;

  if (typeof handshakeSecret == 'string') {
    await putParameter(secretParameterName, handshakeSecret);
    logger.info(`Handshake successfully. secret:${secretParameterName}`);
    return {
      headers: { 'X-Hook-Secret': handshakeSecret },
      statusCode: 204,
      body: '',
    } as APIGatewayProxyResult;
  }

  if (typeof signature == 'undefined' || body == null) {
    return { statusCode: 400 } as APIGatewayProxyResult;
  }

  const secret = await getParameter(secretParameterName);
  if (typeof secret == 'undefined') {
    return { statusCode: 400, body: 'Handshake is not completed yet.' } as APIGatewayProxyResult;
  }

  if (!verifySignature(signature, secret, body)) {
    return { statusCode: 400, body: 'Signature is not valid.' } as APIGatewayProxyResult;
  }

  try {
    const payload: AsanaPayload = JSON.parse(body);
    if (payload.events.length > 0) {
      await processPayload(JSON.stringify(payload));
    }
  } catch (error) {
    logger.error(JSON.stringify(error));
  }
  return { statusCode: 200 } as APIGatewayProxyResult;
};