import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BaseSessionService,
  createSession,
  trimTempState,
  type AppendEventRequest,
  type CreateSessionRequest,
  type DeleteSessionRequest,
  type Event,
  type GetSessionRequest,
  type ListSessionsRequest,
  type ListSessionsResponse,
  type Session,
} from '@google/adk';
import { randomUUID } from 'crypto';
import { MoreThan, Repository } from 'typeorm';
import { APP_NAME, SessionEntity } from '../entities/adk-session.entity';
import { EventEntity } from '../entities/adk-event.entity';

const DEFAULT_RECENT_EVENTS = 30;

/** Sesiones y eventos de ADK en Postgres; la tripleta (appName, userId, sessionId) aísla router y sub-agentes. */
@Injectable()
export class TypeOrmSessionService extends BaseSessionService {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly sessions: Repository<SessionEntity>,
    @InjectRepository(EventEntity)
    private readonly events: Repository<EventEntity>,
  ) {
    super();
  }

  async createSession({
    appName,
    userId,
    state,
    sessionId,
  }: CreateSessionRequest): Promise<Session> {
    // AgentTool copia al sub-agente todo el state del padre, incluidas las claves temp:
    const clean = { ...trimTempState(state ?? {}) };
    const row = await this.sessions.save(
      this.sessions.create({
        appName,
        userId,
        adkSessionId: sessionId ?? randomUUID(),
        state: clean,
        // el sub-agente hereda phone porque el state del padre ya lo trae
        phone: typeof clean.phone === 'string' ? clean.phone : null,
      }),
    );
    return this.toSession(row, []);
  }

  /**
   * AgentTool sólo pasa el state del padre al crear la sesión del sub-agente; si la fila ya
   * existe, se mezcla (el padre manda) para que el sub-agente no vea state viejo.
   */
  async getOrCreateSession(request: CreateSessionRequest): Promise<Session> {
    const { appName, userId, sessionId, state } = request;
    const row = sessionId && (await this.find(appName, userId, sessionId));
    if (!row) return this.createSession(request);
    const merged = { ...row.state, ...trimTempState(state ?? {}) };
    // TypeORM no tipa bien columnas jsonb en update/create.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    await this.sessions.update(row.id, { state: merged as any });
    return (await this.getSession({ appName, userId, sessionId }))!;
  }

  async getSession({
    appName,
    userId,
    sessionId,
    config,
  }: GetSessionRequest): Promise<Session | undefined> {
    const row = await this.find(appName, userId, sessionId);
    if (!row) return undefined;
    const recent = await this.events.find({
      where: {
        sessionId: row.id,
        ...(config?.afterTimestamp && {
          timestamp: MoreThan(config.afterTimestamp),
        }),
      },
      order: { timestamp: 'DESC' },
      take: config?.numRecentEvents ?? DEFAULT_RECENT_EVENTS,
    });
    return this.toSession(
      row,
      recent.reverse().map((e) => e.data as unknown as Event),
    );
  }

  async listSessions({
    appName,
    userId,
    limit,
    offset,
    page,
    order,
  }: ListSessionsRequest): Promise<ListSessionsResponse> {
    const skip = page && limit ? (page - 1) * limit : (offset ?? 0);
    const [rows, totalItems] = await this.sessions.findAndCount({
      where: { appName, ...(userId && { userId }) },
      order: order
        ? { lastUpdateTime: order.toUpperCase() as 'ASC' | 'DESC' }
        : {},
      skip,
      take: limit,
    });
    const pageSize = limit ?? totalItems;
    return {
      sessions: rows.map((r) => this.toSession(r, [])),
      page: page ?? 1,
      limit: pageSize,
      totalItems,
      totalPages: pageSize ? Math.ceil(totalItems / pageSize) : 0,
    };
  }

  async deleteSession({
    appName,
    userId,
    sessionId,
  }: DeleteSessionRequest): Promise<void> {
    // los eventos caen por ON DELETE CASCADE
    await this.sessions.delete({ appName, userId, adkSessionId: sessionId });
  }

  async appendEvent({ session, event }: AppendEventRequest): Promise<Event> {
    // aplica stateDelta (sin claves temp:) y agrega el evento a session.events
    event = await super.appendEvent({ session, event });
    if (event.partial) return event;

    const row = await this.find(session.appName, session.userId, session.id);
    if (!row) return event;

    const last = await this.events.findOne({
      where: { sessionId: row.id },
      order: { timestamp: 'DESC' },
    });
    // ponytail: max(now, último+1) evita empates de ms; sin lock, dos escritores simultáneos de la misma sesión podrían empatar
    const timestamp = Math.max(
      event.timestamp ?? Date.now(),
      (last?.timestamp ?? 0) + 1,
    );
    event.timestamp = timestamp;

    // Sin bytes de adjuntos en la base: la nota de texto del turno queda como placeholder.
    // Se poda una copia; el evento en memoria conserva el inlineData durante la corrida.
    const data = JSON.parse(JSON.stringify(event)) as Event;
    if (data.content?.parts)
      data.content.parts = data.content.parts.filter((p) => !p.inlineData);
    await this.events.insert({
      sessionId: row.id,
      timestamp,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      data: data as any,
    });
    const lastEventRole = (event.content?.role as 'user' | 'model') ?? null;
    // Solo las claves de este evento se mezclan en jsonb: la copia en memoria puede ser vieja y pisaría lo que otro escritor guardó.
    const delta = Object.fromEntries(
      Object.entries(event.actions?.stateDelta ?? {}).filter(
        ([k]) => !k.startsWith('temp:'),
      ),
    );
    if (Object.keys(delta).length) {
      const table = this.sessions.metadata.tablePath;
      await this.sessions.query(
        `UPDATE "${table}" SET state = COALESCE(state, '{}'::jsonb) || $1::jsonb, "lastEventRole" = $2, "lastUpdateTime" = $3, "updatedAt" = now() WHERE id = $4`,
        [JSON.stringify(delta), lastEventRole, timestamp, row.id],
      );
    } else {
      await this.sessions.update(row.id, {
        lastEventRole,
        lastUpdateTime: timestamp,
      });
    }
    session.lastUpdateTime = timestamp;
    return event;
  }

  /** Toma de control humana: con `false` los mensajes se registran sin correr el agente. Sólo la sesión del router manda. */
  async setBotActive(userId: string, sessionId: string, active: boolean) {
    const where = { appName: APP_NAME, userId, adkSessionId: sessionId };
    await this.sessions.update(where, { isBotActive: active });
  }

  /** Pide atención humana: apaga el bot y prende `needsHuman` (sin panel aún, nadie recibe aviso). */
  async requestHuman(userId: string, sessionId: string) {
    const where = { appName: APP_NAME, userId, adkSessionId: sessionId };
    await this.sessions.update(where, { isBotActive: false, needsHuman: true });
  }

  /** Borra la sesión del router y las de sus sub-agentes (mismo userId/sessionId); los eventos caen en cascada. */
  async deleteUserSessions(userId: string): Promise<void> {
    await this.sessions.delete({ userId, adkSessionId: userId });
  }

  private find(appName: string, userId: string, adkSessionId: string) {
    return this.sessions.findOne({ where: { appName, userId, adkSessionId } });
  }

  private toSession(row: SessionEntity, events: Event[]): Session {
    return createSession({
      id: row.adkSessionId,
      appName: row.appName,
      userId: row.userId,
      state: row.state,
      events,
      lastUpdateTime: row.lastUpdateTime,
    });
  }
}
