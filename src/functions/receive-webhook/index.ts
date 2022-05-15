import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { SSMClient, PutParameterCommand, GetParameterCommand } from '@aws-sdk/client-ssm';
import { fromUtf8 } from '@aws-sdk/util-utf8-node';
import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { HmacSHA256 } from 'crypto-js';

const parameterPrefix = process.env.PARAMETER_PREFIX;
const processPayloadFunctionName = process.env.PROCESS_PAYLOAD_FUNCTION_NAME;

const ssm = new SSMClient({});
const lambda = new LambdaClient({});

const getParameter = async(parameterName: string): Promise<string|undefined> => {
  const cmd = new GetParameterCommand({ Name: parameterName });
  const { Parameter } = await ssm.send(cmd);
  return Parameter?.Value;
};

const putParameter = async(parameterName: string, value: string): Promise<void> => {
  const cmd = new PutParameterCommand({
    Name: parameterName,
    Value: value,
    Type: 'String',
    Description: 'Secret to verify signature from Asana webhook',
  });
  await ssm.send(cmd);
};

const verifySignature = (signature: string, secret: string, body: string): boolean => {
  const hash = HmacSHA256(body, secret).toString();
  if (signature == hash) {
    console.log('signature is valid');
    return true;
  } else {
    console.error('signature is not valid');
    return false;
  }
};

const processPayload = async(body: string) => {
  const cmd = new InvokeCommand({
    FunctionName: processPayloadFunctionName,
    Payload: fromUtf8(body),
    InvocationType: 'Event',
  });
  await lambda.send(cmd);
};


export const handler: APIGatewayProxyHandler = async (event, _context) => {
  const { path, body } = event;
  const signature = event.headers['X-Hook-Signature'];
  const handshakeSecret = event.headers['X-Hook-Secret'];

  const secretParameterName = `${parameterPrefix}${path}`;

  if (typeof handshakeSecret == 'string') {
    await putParameter(secretParameterName, handshakeSecret);
    console.log(`Handshake successfully. secret:${secretParameterName}`);
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

  await processPayload(body);
  return { statusCode: 204 } as APIGatewayProxyResult;
};