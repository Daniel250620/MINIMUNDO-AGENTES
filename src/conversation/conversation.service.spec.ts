import type { BatchHandler } from './batcher/message-batcher';
import { ConversationService } from './conversation.service';
import type { WhatsappWebhookBody } from './inbound/whatsapp-payload';
import { ERROR_REPLY } from './replies';
import type { RunResult } from './runner/agent-runner';

const textBody = (text: string, wamid = 'wamid.1') =>
  ({
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ wa_id: '5215512345678', profile: { name: 'Ana' } }],
              messages: [
                {
                  from: '5215512345678',
                  id: wamid,
                  timestamp: '1',
                  type: 'text',
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  }) as unknown as WhatsappWebhookBody;

const statusBody = {
  object: 'whatsapp_business_account',
  entry: [
    { changes: [{ value: { statuses: [{ id: 'x', status: 'read' }] } }] },
  ],
} as unknown as WhatsappWebhookBody;

function setup() {
  let handler: BatchHandler | undefined;
  const pending: Promise<void>[] = [];
  const batcher = {
    onBatch: (h: BatchHandler) => (handler = h),
    // Sin ventana de silencio: el lote corre al momento; `flush` espera a que termine.
    submit: jest.fn((userId: string, item) => {
      pending.push(handler!(userId, [item]));
    }),
  };
  const flush = () => Promise.all(pending.splice(0));
  const session = { isBotActive: true };
  const messages = {
    create: (x: unknown) => x,
    save: jest.fn(async () => undefined),
    update: jest.fn(async () => undefined),
  };
  const sessions = { findOne: jest.fn(async () => session) };
  const inbound = {
    downloadAttachment: jest.fn(),
    resolveReplyContext: jest.fn(async () => null),
  };
  const runner = {
    run: jest.fn(async (): Promise<RunResult> => ({ answer: 'hola Ana' })),
  };
  const dispatcher = {
    send: jest.fn(async () => undefined),
    typing: jest.fn(async () => undefined),
  };
  const artifacts = { saveArtifact: jest.fn() };
  const svc = new ConversationService(
    messages as never,
    sessions as never,
    { createSession: jest.fn(), deleteUserSessions: jest.fn() } as never,
    inbound as never,
    batcher,
    runner as never,
    dispatcher as never,
    artifacts as never,
  );
  const handle = async (body: WhatsappWebhookBody) => {
    await svc.handleWebhook(body);
    await flush();
  };
  return { svc: { handleWebhook: handle }, batcher, runner, dispatcher };
}

describe('ConversationService', () => {
  it('un turno de texto corre el agente y envía su respuesta', async () => {
    const { svc, runner, dispatcher } = setup();
    await svc.handleWebhook(textBody('hola'));
    expect(runner.run).toHaveBeenCalledTimes(1);
    expect(dispatcher.send).toHaveBeenCalledWith('5215512345678', {
      kind: 'text',
      text: 'hola Ana',
    });
  });

  it('usa el mensaje saliente de una tool cuando lo hay', async () => {
    const { svc, runner, dispatcher } = setup();
    const outbound: RunResult['outbound'] = {
      kind: 'text',
      text: 'mensaje fijo de una tool',
    };
    runner.run.mockResolvedValueOnce({ answer: '', outbound });
    await svc.handleWebhook(textBody('menú'));
    expect(dispatcher.send).toHaveBeenCalledWith('5215512345678', outbound);
  });

  it('un webhook solo de estados no corre el agente', async () => {
    const { svc, batcher, runner } = setup();
    await svc.handleWebhook(statusBody);
    expect(batcher.submit).not.toHaveBeenCalled();
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('si el runner falla envía ERROR_REPLY y libera el lock', async () => {
    const { svc, runner, dispatcher } = setup();
    runner.run.mockRejectedValueOnce(new Error('modelo caído'));
    await svc.handleWebhook(textBody('hola', 'wamid.a'));
    expect(dispatcher.send).toHaveBeenLastCalledWith('5215512345678', {
      kind: 'text',
      text: ERROR_REPLY,
    });
    // El siguiente mensaje del mismo usuario se procesa normalmente.
    await svc.handleWebhook(textBody('¿sigues?', 'wamid.b'));
    expect(runner.run).toHaveBeenCalledTimes(2);
    expect(dispatcher.send).toHaveBeenLastCalledWith('5215512345678', {
      kind: 'text',
      text: 'hola Ana',
    });
  });
});
