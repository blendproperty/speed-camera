import { audit, transaction } from './db.mjs';
import { InputError, validId } from './operations.mjs';

export const ticketStatuses = { draft: 'Draft', finalized: 'Finalized', void: 'Voided' };

export function ticketReference(id) {
  return 'MP-S-' + String(id).padStart(6, '0');
}

function field(form, name, max) {
  const value = form.get(name) ?? '';
  if (typeof value !== 'string' || value.trim().length > max) {
    throw new InputError('Check the length of the notice fields.');
  }
  return value.trim();
}

export async function createTicket(capture, actor) {
  if (!validId(capture)) throw new InputError('Select an approved capture.');
  return transaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO speed_tickets(capture_id, created_by, camera_name)
       SELECT c.id,$2,m.name FROM captures c JOIN cameras m ON m.code=c.camera_code
       WHERE c.id=$1 AND c.status='approved' AND c.speed_kmh>c.limit_kmh
         AND length(trim(c.plate))>0 AND c.image_bytes IS NOT NULL AND c.image_sha256 IS NOT NULL
       ON CONFLICT(capture_id) DO NOTHING RETURNING id`,
      [capture, actor]
    );
    if (inserted.rowCount) {
      const { id } = inserted.rows[0];
      await audit(client, actor, 'speed_ticket_created', ticketReference(id), { capture });
      return id;
    }
    const existing = await client.query('SELECT id FROM speed_tickets WHERE capture_id=$1', [capture]);
    if (existing.rowCount) return existing.rows[0].id;
    throw new InputError('A notice requires an approved capture with a registration, speed and evidence photo.');
  });
}

export async function updateTicket(id, form, actor) {
  const operation = form.get('operation');
  if (!validId(id) || !['save', 'finalize', 'void'].includes(operation)) {
    throw new InputError('Select a valid ticket action.');
  }
  let result;
  return transaction(async (client) => {
    if (operation === 'void') {
      const reason = field(form, 'reason', 300);
      if (!reason) throw new InputError('Enter a reason to void this notice.');
      result = await client.query(
        `UPDATE speed_tickets SET status='void',voided_by=$2,voided_at=now(),void_reason=$3
         WHERE id=$1 AND status IN ('draft','finalized') RETURNING id`, [id, actor, reason]
      );
      if (result.rowCount) await audit(client, actor, 'speed_ticket_voided', ticketReference(id), { reason });
    } else {
      const recipient = field(form, 'recipient', 120);
      const rule = field(form, 'rule', 120);
      const note = field(form, 'noticeNote', 350);
      const finalize = operation === 'finalize';
      if (finalize && (!recipient || !rule || form.get('verified') !== 'on')) {
        throw new InputError('Add the recipient and site rule, then confirm both against the evidence.');
      }
      result = await client.query(
        `UPDATE speed_tickets SET recipient=$2,rule_reference=$3,notice_note=$4,
         status=CASE WHEN $5 THEN 'finalized' ELSE status END,
         finalized_by=CASE WHEN $5 THEN $6 ELSE finalized_by END,
         finalized_at=CASE WHEN $5 THEN now() ELSE finalized_at END
         WHERE id=$1 AND status='draft' RETURNING id`, [id, recipient, rule, note, finalize, actor]
      );
      if (result.rowCount) await audit(client, actor, finalize ? 'speed_ticket_finalized' : 'speed_ticket_saved', ticketReference(id));
    }
    if (!result.rowCount) throw new InputError('The ticket status changed. Reopen the ticket and check its current state.');
    return id;
  });
}
