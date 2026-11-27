import { hikcentral } from '../../../lib/hikcentral.mjs';
import { registerConfig } from '../../../lib/register-config.mjs';

const messages = {
  none: 'No exact plate match was returned for the configured vehicle group.',
  'outside-period': 'The plate was found, but its registration was not effective at the capture time.',
  undated: 'HikCentral returned an incomplete registration period. Verify the record in the register.',
  ambiguous: 'More than one registration was effective for this plate. Verify the recipient manually.',
  unavailable: 'The vehicle register is unavailable. Check the gateway connection and permissions, then retry.'
};

export default async function VehicleRegister({ ticket, lookup }) {
  let configured = false;
  let result;
  try {
    const config = await registerConfig();
    configured = Boolean(config.origin && config.key && config.secret && config.group);
    if (lookup && configured) {
      result = await hikcentral(config).registeredVehicle(ticket.plate, ticket.captured_at, config.group);
    }
  } catch {
    result = { status: 'unavailable' };
  }
  return <section className="panel section no-print">
    <header className="heading vehicle-register-heading">
      <div><h2>HikCentral vehicle register</h2><p>Check the registered details for {ticket.plate} before setting the recipient.</p></div>
      {configured && <form action={'/tickets/' + ticket.id} method="get">
        <input type="hidden" name="vehicle" value="1" />
        <button className="secondary">{lookup ? 'Check again' : 'Look up plate'}</button>
      </form>}
    </header>
    {!configured && !result && <p className="notice">Vehicle register connection is awaiting configuration.</p>}
    {result?.status === 'match' && <>
      <dl className="camera-status">
        <div><dt>Registered owner</dt><dd>{result.owner ?? 'Not supplied'}</dd></div>
        <div><dt>Make</dt><dd>{result.make ?? 'Not supplied'}</dd></div>
        <div><dt>Colour</dt><dd>{result.colour ?? 'Not supplied'}</dd></div>
      </dl>
      <p>The registration was effective at the capture time. Confirm the recipient against the evidence and site rule.</p>
    </>}
    {result && result.status !== 'match' && <p className="notice" role="status">{messages[result.status]}</p>}
  </section>;
}
