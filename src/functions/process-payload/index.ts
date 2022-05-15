import { EventBridgeClient, PutEventsCommand, PutEventsRequestEntry } from '@aws-sdk/client-eventbridge';
import { Handler } from 'aws-lambda';
import { AsanaPayload, AsanaEvent } from './schema';

const eventBusName = process.env.EVENT_BUS_NAME;

const eventbridge = new EventBridgeClient({});

const capitalizeInitial = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const asanaEventToEntry = (event: AsanaEvent): PutEventsRequestEntry => {
  const entry: PutEventsRequestEntry = {
    EventBusName: eventBusName,
    Source: 'asana',
    Time: new Date(event.created_at),
    DetailType: 'Webhook',
    Detail: JSON.stringify(event),
  };
  return entry;
};

const putEvents = async(events: AsanaEvent[], entries: PutEventsRequestEntry[] =[], i: number = 0) => {
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
  await putEvents(payload.events);
};