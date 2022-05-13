import { EventBridgeClient, PutEventsCommand, PutEventsRequestEntry } from '@aws-sdk/client-eventbridge';
import { SSMClient, PutParameterCommand, GetParameterCommand } from '@aws-sdk/client-ssm';
import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { HmacSHA256 } from 'crypto-js';

const stackName = process.env.STACK_NAME;
const eventBusName = process.env.EVENT_BUS_NAME;

const ssm = new SSMClient({});
const eventbridge = new EventBridgeClient({});

const getAsanaSecret = async(gid: string): Promise<string|undefined> => {
  const cmd = new GetParameterCommand({ Name: `/${stackName}/Secret/${gid}` });
  const { Parameter } = await ssm.send(cmd);
  const asanaSecret = Parameter?.Value;
  return asanaSecret;
};

const storeAsanaSecret = async(gid: string, secret: string): Promise<void> => {
  const cmd = new PutParameterCommand({
    Name: `/${stackName}/Secret/${gid}`,
    Value: secret,
    Type: 'String',
  });
  await ssm.send(cmd);
};

interface AsanaEvent {
  user?: {
    gid: string;
    resource_type: string;
  };
  created_at: string;
  action: string;
  resource: {
    gid: string;
    resource_type: string;
    resource_subtype: string;
  };
  parent: {
    gid: string;
    resource_type: string;
    resource_subtype: string;
  };
}

interface AsanaWebhookBody {
  events: AsanaEvent[];
}
export const handler: APIGatewayProxyHandler = async (event, _context) => {
  const body = event.body;
  const gid = event.pathParameters?.gid || '0000000000000000';
  const handshakeSecret = event.headers['X-Hook-Secret'];

  if (typeof handshakeSecret == 'string') {
    await storeAsanaSecret(gid, handshakeSecret);
    return {
      headers: { 'X-Hook-Secret': handshakeSecret },
      statusCode: 204,
      body: '',
    } as APIGatewayProxyResult;
  }

  try {
    const signature = event.headers['X-Hook-Signature'];
    const secret = await getAsanaSecret(gid);
    const hash = HmacSHA256(body!, secret!).toString();
    if (signature == hash) {
      console.log('signature is valid');
    } else {
      throw new Error('signature is not valid');
    }
  } catch (error) {
    console.error(error);
  }

  const obj: AsanaWebhookBody = JSON.parse(event.body || '{}');
  console.log(JSON.stringify(obj.events));
  const entries = obj.events.map((e) => {
    const entry: PutEventsRequestEntry = {
      EventBusName: eventBusName,
      Source: `asana.${e.parent.resource_type}`,
      Time: new Date(e.created_at),
      DetailType: e.action,
      Detail: JSON.stringify(e),
    };
    return entry;
  });
  const putEventsCommand = new PutEventsCommand({ Entries: entries });
  await eventbridge.send(putEventsCommand);
  return { statusCode: 200, body: '' } as APIGatewayProxyResult;

};