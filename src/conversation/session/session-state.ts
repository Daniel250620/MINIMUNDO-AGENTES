import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';
import { createEvent, createEventActions } from '@google/adk';
import { APP_NAME } from '../entities/adk-session.entity';
import type { TypeOrmSessionService } from './typeorm-session.service';

const logger = new Logger('SessionState');

/** Resumen del state sin datos personales: solo qué casillas tienen valor. */
export const stateSummary = (s?: Record<string, unknown>) => {
  const stampError = s?.stampError as
    { kind?: string; field?: string } | undefined;
  return s
    ? JSON.stringify({
        billing: !!s.billing,
        ticketCode: !!s.ticketCode,
        fiscalData: !!s.fiscalData,
        regimen: (s.receptor as { regimen?: string } | undefined)?.regimen,
        uso: (s.receptor as { uso?: string } | undefined)?.uso,
        proformaSent: s.proformaSent,
        tokenFactura: !!s.tokenFactura,
        confirmed: s.confirmed,
        stampUuid: !!s.stampUuid,
        stampError: stampError && {
          kind: stampError.kind,
          field: stampError.field,
        },
        proformaRejected: !!s.proformaRejected,
        attentionRequested: !!s.attentionRequested,
      })
    : 'sin state';
};

const ids = (userId: string) => ({
  appName: APP_NAME,
  userId,
  sessionId: userId,
  config: { numRecentEvents: 1 },
});

/** State de la sesión del router fuera del Runner (mismo patrón que la entrega de la factura). */
export async function readState(
  sessions: TypeOrmSessionService,
  userId: string,
): Promise<Record<string, unknown> | undefined> {
  const state = (await sessions.getSession(ids(userId)))?.state;
  logger.log(`readState ${userId}: ${stateSummary(state)}`);
  return state;
}

/** Persiste claves del state con un evento sin contenido (el agente no lo ve como historial). */
export async function setState(
  sessions: TypeOrmSessionService,
  userId: string,
  stateDelta: Record<string, unknown>,
) {
  const session = await sessions.getSession(ids(userId));
  if (!session) {
    logger.warn(
      `setState ${userId}: sesión no encontrada, no se escribió ${Object.keys(stateDelta).join(',')}`,
    );
    return;
  }
  logger.log(`setState ${userId}: ${Object.keys(stateDelta).join(',')}`);
  await sessions.appendEvent({
    session,
    event: createEvent({
      invocationId: randomUUID(),
      author: 'system',
      actions: createEventActions({ stateDelta }),
    }),
  });
}
