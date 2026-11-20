import { AgentTool } from '@google/adk';

/** ADK JS 2.2 guarda `skipSummarization` en AgentTool pero no lo aplica (Python sí): sin esto el agente raíz vuelve a llamar al modelo y la respuesta del sub-agente se pierde. */
export class DirectAgentTool extends AgentTool {
  override runAsync(req: Parameters<AgentTool['runAsync']>[0]) {
    req.toolContext.actions.skipSummarization = true;
    return super.runAsync(req);
  }
}
