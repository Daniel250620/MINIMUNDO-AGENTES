/* Runner REAL de ADK con un BaseLlm falso: lo que los mocks de runAsync no ven. */
import {
  BaseLlm,
  InMemoryArtifactService,
  FunctionTool,
  InMemorySessionService,
  LlmAgent,
  type LlmResponse,
} from '@google/adk';
import { z } from 'zod';
import { DirectAgentTool } from '../agents/shared/direct-agent-tool';
import { AgentRunner } from './agent-runner';

class FakeLlm extends BaseLlm {
  calls = 0;
  constructor(private reply: () => LlmResponse) {
    super({ model: 'fake' });
  }

  async *generateContentAsync(): AsyncGenerator<LlmResponse, void> {
    this.calls++;
    yield this.reply();
  }
  connect(): Promise<never> {
    throw new Error('n/a');
  }
}

async function setup(llm: FakeLlm) {
  const sessionService = new InMemorySessionService();
  const agent = new LlmAgent({ name: 'assistant_agent', model: llm });
  const runner = new AgentRunner(
    { agent },
    sessionService as any,
    new InMemoryArtifactService(),
  );
  jest.spyOn((runner as any).logger, 'error').mockImplementation();
  const ids = { appName: 'minimundo-assistant', userId: 'u', sessionId: 'u' };
  await sessionService.createSession(ids);
  return { runner, sessionService, ids };
}
const content = { role: 'user', parts: [{ text: 'hola' }] };

describe('AgentRunner con el Runner real de ADK', () => {
  it('respuesta normal; el mensaje del usuario queda una sola vez en la sesión', async () => {
    const llm = new FakeLlm(() => ({
      content: { role: 'model', parts: [{ text: '¡Hola!' }] },
    }));
    const { runner, sessionService, ids } = await setup(llm);
    const res = await runner.run({
      userId: 'u',
      sessionId: 'u',
      content,
      turn: 't1',
    });
    expect(res).toEqual({ answer: '¡Hola!' });
    expect(llm.calls).toBe(1);
    const s = await sessionService.getSession(ids);
    expect(s!.events.filter((e) => e.author === 'user')).toHaveLength(1);
    expect(s!.state['turn']).toBe('t1');
  });

  it('error del modelo: failed y sin segunda corrida', async () => {
    const llm = new FakeLlm(() => {
      throw new Error('400 bad request');
    });
    const { runner, sessionService, ids } = await setup(llm);
    const res = await runner.run({
      userId: 'u',
      sessionId: 'u',
      content,
      turn: 't1',
    });
    expect(res).toEqual({ answer: '', failed: true });
    expect(llm.calls).toBe(1);
    const s = await sessionService.getSession(ids);
    expect(s!.events.filter((e) => e.author === 'user')).toHaveLength(1);
  });
});

/** Responde en orden lo que se le programa; cada elemento es una llamada a tool o un texto. */
class ScriptedLlm extends BaseLlm {
  private n = 0;
  constructor(private script: LlmResponse[]) {
    super({ model: 'fake' });
  }

  async *generateContentAsync(): AsyncGenerator<LlmResponse, void> {
    yield this.script[this.n++];
  }
  connect(): Promise<never> {
    throw new Error('n/a');
  }
}

const call = (name: string, args: Record<string, unknown>): LlmResponse => ({
  content: { role: 'model', parts: [{ functionCall: { name, args } }] },
});

describe('case_agent dentro del router (seguimiento tras una queja)', () => {
  it('el caseResult de register_case queda en el state de la sesión del router', async () => {
    // Misma escritura que `register_case`: el turno viene del state que copia el AgentTool.
    const registerCase = new FunctionTool({
      name: 'register_case',
      description: 'Registra el caso',
      parameters: z.object({}),
      execute: (_args, ctx) => {
        ctx!.state.set('caseResult', {
          turn: ctx!.state.get('turn'),
          ok: true,
        });
        return { ok: true };
      },
    });
    const caseAgent = new LlmAgent({
      name: 'case_agent',
      description: 'Casos',
      model: new ScriptedLlm([
        call('register_case', {}),
        { content: { role: 'model', parts: [{ text: 'Tu folio es 1' }] } },
      ]),
      tools: [registerCase],
    });
    const router = new LlmAgent({
      name: 'assistant_agent',
      model: new ScriptedLlm([call('case_agent', { request: 'queja' })]),
      tools: [new DirectAgentTool({ agent: caseAgent })],
    });
    const sessionService = new InMemorySessionService();
    const runner = new AgentRunner(
      { agent: router },
      sessionService as any,
      new InMemoryArtifactService(),
    );
    jest.spyOn((runner as any).logger, 'error').mockImplementation();
    const ids = {
      appName: 'minimundo-assistant',
      userId: 'u',
      sessionId: 'u',
    };
    await sessionService.createSession(ids);

    await runner.run({ userId: 'u', sessionId: 'u', content, turn: 't9' });

    const s = await sessionService.getSession(ids);
    expect(s!.state['caseResult']).toEqual({ turn: 't9', ok: true });
  });
});
