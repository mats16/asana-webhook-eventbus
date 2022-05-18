import { Tracer } from '@aws-lambda-powertools/tracer';
import { EventBridgeClient, PutEventsCommand, PutEventsRequestEntry } from '@aws-sdk/client-eventbridge';
import { Handler } from 'aws-lambda';
import { AsanaPayload, AsanaEvent } from '../schema';

const eventBusName = process.env.EVENT_BUS_NAME;

const tracer = new Tracer({ serviceName: 'ProcessPayload' });
const eventbridge = tracer.captureAWSv3Client(new EventBridgeClient({}));

const capitalizeInitial = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const asanaEventToEntry = (event: AsanaEvent): PutEventsRequestEntry => {
  const { created_at, action, resource } = event;
  const entry: PutEventsRequestEntry = {
    EventBusName: eventBusName,
    Source: 'asana',
    Time: new Date(created_at),
    DetailType: capitalizeInitial(resource.resource_type) + capitalizeInitial(action),
    Detail: JSON.stringify(event),
  };
  return entry;
};

const putEvents = async(events: AsanaEvent[], entries: PutEventsRequestEntry[] = [], i: number = 0) => {
  const event = events[i];
  console.log(JSON.stringify(event));
  const entry = asanaEventToEntry(event);
  entries.push(entry);
  if (i+1 == events.length || entries.length == 10) {
    const cmd = new PutEventsCommand({ Entries: entries });
    await eventbridge.send(cmd);
    if (i+1 == events.length) {
      return;
    } else {
      entries.length = 0;
    }
  }
  await putEvents(events, entries, i+1);
  return;
};

export const handler: Handler<AsanaPayload, void> = async (payload, _context) => {
  const asanaEvents = payload.events;
  await putEvents(asanaEvents);
};