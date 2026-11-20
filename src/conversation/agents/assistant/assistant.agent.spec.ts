import type { ConfigService } from '@nestjs/config';
import { AssistantAgent } from './assistant.agent';
import { currentTimeTool } from './tools/current-time.tool';

describe('AssistantAgent', () => {
  it('se construye con su nombre, modelo y la tool de ejemplo', () => {
    const config = { get: () => 'gemini-test' } as unknown as ConfigService;
    const { agent } = new AssistantAgent(config);
    expect(agent.name).toBe('assistant_agent');
    expect(agent.model).toBe('gemini-test');
    expect(agent.tools).toContain(currentTimeTool);
  });
});

describe('get_current_time', () => {
  it('regresa datos (zona y hora), no texto final', async () => {
    const result = (await currentTimeTool.runAsync({
      args: {},
      toolContext: {} as never,
    })) as { timeZone: string; now: string };
    expect(result.timeZone).toBe('America/Mexico_City');
    expect(result.now).toMatch(/\d/);
  });
});
