export interface DeploymentEvent {
  time: string;
  message: string;
}

export function DeploymentTimeline({ events = [] }: { events?: DeploymentEvent[] }) {
  return (
    <div>
      {events.map(event => (
        <p key={`${event.time}-${event.message}`}>
          {event.time}: {event.message}
        </p>
      ))}
    </div>
  );
}
