import { createEvent, createEventActions } from '@google/adk';
import { APP_NAME } from '../entities/adk-session.entity';
import { TypeOrmSessionService } from './typeorm-session.service';

/** Repos en memoria mínimos: sólo lo que el servicio usa. */
function setup() {
  const sessionRows: any[] = [];
  const eventRows: any[] = [];
  const sessions: any = {
    create: (v: any) => ({
      id: `s${sessionRows.length + 1}`,
      lastUpdateTime: 0,
      needsHuman: false,
      ...v,
    }),
    save: async (r: any) => (sessionRows.push(r), r),
    findOne: async ({ where }: any) =>
      sessionRows.find((r) =>
        Object.entries(where).every(([k, v]) => r[k] === v),
      ),
    update: async (where: string | Record<string, unknown>, patch: any) => {
      const match = (r: any) =>
        typeof where === 'string'
          ? r.id === where
          : Object.entries(where).every(([k, v]) => r[k] === v);
      const rows = sessionRows.filter(match);
      rows.forEach((r) => Object.assign(r, patch));
      return { affected: rows.length };
    },
    delete: async (where: Record<string, unknown>) => {
      const keep = sessionRows.filter(
        (r) => !Object.entries(where).every(([k, v]) => r[k] === v),
      );
      sessionRows.splice(0, sessionRows.length, ...keep);
    },
    metadata: { tablePath: 'adk_sessions' },
    // Imita el UPDATE de appendEvent: `state || delta` de primer nivel sobre la fila almacenada.
    query: async (
      _sql: string,
      [delta, lastEventRole, lastUpdateTime, id]: any,
    ) => {
      const row = sessionRows.find((r) => r.id === id);
      row.state = { ...row.state, ...JSON.parse(delta) };
      Object.assign(row, { lastEventRole, lastUpdateTime });
    },
  };
  const events: any = {
    insert: async (r: any) => eventRows.push(r),
    findOne: async ({ where }: any) =>
      eventRows
        .filter((e) => e.sessionId === where.sessionId)
        .sort((a, b) => b.timestamp - a.timestamp)[0],
    find: async ({ where, take }: any) =>
      eventRows
        .filter((e) => e.sessionId === where.sessionId)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, take),
  };
  return {
    svc: new TypeOrmSessionService(sessions, events),
    eventRows,
    sessionRows,
  };
}

const ev = (text: string, timestamp = 1000) =>
  createEvent({
    author: 'user',
    content: { role: 'user', parts: [{ text }] },
    timestamp,
  });

describe('TypeOrmSessionService', () => {
  it('guarda timestamps estrictamente crecientes y getSession los devuelve en orden', async () => {
    const { svc } = setup();
    const s = await svc.createSession({
      appName: 'a',
      userId: 'u',
      sessionId: 'x',
    });
    for (const t of ['uno', 'dos', 'tres'])
      await svc.appendEvent({ session: s, event: ev(t) });

    const loaded = await svc.getSession({
      appName: 'a',
      userId: 'u',
      sessionId: 'x',
    });
    const ts = loaded!.events.map((e) => e.timestamp);
    expect(ts).toEqual([1000, 1001, 1002]);
    expect(loaded!.events.map((e) => e.content!.parts![0].text)).toEqual([
      'uno',
      'dos',
      'tres',
    ]);
  });

  it('aísla sesiones por appName con el mismo userId y sessionId', async () => {
    const { svc } = setup();
    const router = await svc.createSession({
      appName: 'router',
      userId: 'u',
      sessionId: 'x',
    });
    await svc.createSession({
      appName: 'billing',
      userId: 'u',
      sessionId: 'x',
    });
    await svc.appendEvent({ session: router, event: ev('hola') });

    const billing = await svc.getSession({
      appName: 'billing',
      userId: 'u',
      sessionId: 'x',
    });
    expect(billing!.events).toHaveLength(0);
    expect(
      await svc.getSession({ appName: 'otra', userId: 'u', sessionId: 'x' }),
    ).toBeUndefined();
  });

  it('createSession no guarda claves temp:', async () => {
    const { svc, sessionRows } = setup();
    await svc.createSession({
      appName: 'a',
      userId: 'u',
      sessionId: 'x',
      state: { 'temp:x': 1, keep: 2 },
    });
    expect(sessionRows[0].state).toEqual({ keep: 2 });
  });

  it('createSession siembra phone en columna y state', async () => {
    const { svc, sessionRows } = setup();
    await svc.createSession({
      appName: 'a',
      userId: 'u',
      sessionId: 'x',
      state: { phone: 'c1' },
    });
    expect(sessionRows[0].phone).toBe('c1');
    expect(sessionRows[0].state.phone).toBe('c1');
  });

  describe('getOrCreateSession', () => {
    it('sesión nueva: delega en createSession', async () => {
      const { svc, sessionRows } = setup();
      const s = await svc.getOrCreateSession({
        appName: 'a',
        userId: 'u',
        sessionId: 'x',
        state: { phone: 'c1', 'temp:t': 1 },
      });
      expect(s.state['phone']).toBe('c1');
      expect(sessionRows).toHaveLength(1);
      expect(sessionRows[0].state).toEqual({ phone: 'c1' });
    });

    it('sesión existente: el state del padre manda y se persiste el merge', async () => {
      const { svc, sessionRows } = setup();
      await svc.createSession({
        appName: 'a',
        userId: 'u',
        sessionId: 'x',
        state: { k: 'viejo', solo: 'hijo' },
      });
      const s = await svc.getOrCreateSession({
        appName: 'a',
        userId: 'u',
        sessionId: 'x',
        state: { k: 'nuevo', 'temp:t': 1 },
      });
      expect(s.state['k']).toBe('nuevo');
      expect(sessionRows).toHaveLength(1);
      expect(sessionRows[0].state).toEqual({ k: 'nuevo', solo: 'hijo' });
    });

    it('conserva un valor que sólo tiene el sub-agente', async () => {
      const { svc } = setup();
      await svc.createSession({
        appName: 'a',
        userId: 'u',
        sessionId: 'x',
        state: { solo: 'hijo' },
      });
      const s = await svc.getOrCreateSession({
        appName: 'a',
        userId: 'u',
        sessionId: 'x',
        state: { otro: 1 },
      });
      expect(s.state).toMatchObject({ solo: 'hijo', otro: 1 });
    });
  });

  describe('appendEvent state', () => {
    const stateEv = (stateDelta: Record<string, unknown>) =>
      createEvent({
        author: 'system',
        actions: createEventActions({ stateDelta }),
        timestamp: 1000,
      });
    const ids = { appName: 'a', userId: 'u', sessionId: 'x' };

    it('dos escritores con copias previas conservan ambas claves', async () => {
      const { svc } = setup();
      await svc.createSession(ids);
      const turn = (await svc.getSession(ids))!;
      const other = (await svc.getSession(ids))!;
      await svc.appendEvent({
        session: other,
        event: stateEv({ feedback: { stage: 'comment' } }),
      });
      await svc.appendEvent({
        session: turn,
        event: stateEv({ billing: { ok: true } }),
      });
      const loaded = await svc.getSession(ids);
      expect(loaded!.state).toEqual({
        feedback: { stage: 'comment' },
        billing: { ok: true },
      });
    });

    it('un evento sin delta no cambia el state', async () => {
      const { svc, sessionRows } = setup();
      await svc.createSession({ ...ids, state: { k: 1 } });
      const s = (await svc.getSession(ids))!;
      s.state = { k: 99 }; // copia en memoria alterada, no debe persistirse
      await svc.appendEvent({ session: s, event: ev('hola') });
      expect(sessionRows[0].state).toEqual({ k: 1 });
      expect(sessionRows[0].lastEventRole).toBe('user');
    });

    it('no guarda claves temp:', async () => {
      const { svc, sessionRows } = setup();
      const s = await svc.createSession(ids);
      await svc.appendEvent({
        session: s,
        event: stateEv({ 'temp:x': 1, keep: 2 }),
      });
      expect(sessionRows[0].state).toEqual({ keep: 2 });
    });
  });

  it('appendEvent poda inlineData de lo persistido y conserva el evento en memoria', async () => {
    const { svc, eventRows } = setup();
    const s = await svc.createSession({
      appName: 'a',
      userId: 'u',
      sessionId: 'x',
    });
    const event = createEvent({
      author: 'user',
      content: {
        role: 'user',
        parts: [
          { text: '[Archivo adjunto: wa_X.jpg (image/jpeg)]' },
          { inlineData: { data: 'QUJD', mimeType: 'image/jpeg' } },
        ],
      },
      timestamp: 1000,
    });
    await svc.appendEvent({ session: s, event });

    const stored = eventRows[0].data.content.parts;
    expect(stored).toEqual([
      { text: '[Archivo adjunto: wa_X.jpg (image/jpeg)]' },
    ]);
    expect(s.events[0].content!.parts).toHaveLength(2);
    expect(s.events[0].content!.parts![1].inlineData).toBeDefined();
  });

  it('setBotActive desactiva sólo la fila del router', async () => {
    const { svc, sessionRows } = setup();
    for (const appName of ['minimundo-assistant', 'billing_agent'])
      await svc.createSession({
        appName,
        userId: 'u',
        sessionId: 'u',
        state: { phone: '+5215512345678' },
      });
    sessionRows.forEach((r) => (r.isBotActive = true));
    await svc.setBotActive('u', 'u', false);
    expect(sessionRows.map((r) => [r.appName, r.isBotActive])).toEqual([
      ['minimundo-assistant', false],
      ['billing_agent', true],
    ]);
  });

  it('requestHuman apaga el bot y prende needsHuman sólo en la fila del router', async () => {
    const { svc, sessionRows } = setup();
    for (const appName of ['minimundo-assistant', 'billing_agent'])
      await svc.createSession({ appName, userId: 'u', sessionId: 'u' });
    sessionRows.forEach((r) =>
      Object.assign(r, { isBotActive: true, needsHuman: false }),
    );
    await svc.requestHuman('u', 'u');
    expect(
      sessionRows.map((r) => [r.appName, r.isBotActive, r.needsHuman]),
    ).toEqual([
      ['minimundo-assistant', false, true],
      ['billing_agent', true, false],
    ]);
  });

  it('deleteUserSessions borra router y sub-agentes del usuario y respeta a los demás', async () => {
    const { svc, sessionRows } = setup();
    for (const userId of ['u', 'otro'])
      for (const appName of ['minimundo-assistant', 'billing_agent'])
        await svc.createSession({ appName, userId, sessionId: userId });
    await svc.deleteUserSessions('u');
    expect(sessionRows.map((r) => r.userId)).toEqual(['otro', 'otro']);
  });
});
