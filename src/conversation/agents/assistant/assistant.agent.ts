import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmAgent } from '@google/adk';
import { ThinkingLevel } from '@google/genai';
import { logModelCall, startModelTimer } from '../shared/model-metrics';
import { modelRetryHttpOptions } from '../shared/model-retry';
import { renderStateBlock } from '../shared/render-state-block';
import { trimDanglingHistory } from '../shared/trim-dangling-history';
import { ASSISTANT_PROMPT } from './assistant.prompt';
import { currentTimeTool } from './tools/current-time.tool';

/**
 * Agente raíz de ejemplo. Para crear otro: copia esta carpeta, cambia prompt y tools,
 * y regístralo como provider. Sub-agentes: `new DirectAgentTool({ agent })` (agents/shared).
 * El `name` se persiste en las sesiones: no lo renombres con conversaciones vivas.
 */
@Injectable()
export class AssistantAgent {
  readonly agent: LlmAgent;

  constructor(config: ConfigService) {
    this.agent = new LlmAgent({
      name: 'assistant_agent',
      description: 'Asistente de WhatsApp de Minimundo.',
      model: config.get<string>('GEMINI_MODEL'),
      // Función: el state se lee en cada llamada al modelo, no al construir el agente.
      instruction: (ctx) =>
        ASSISTANT_PROMPT + renderStateBlock(ctx.state.toRecord()),
      tools: [currentTimeTool],
      disallowTransferToParent: true,
      disallowTransferToPeers: true,
      generateContentConfig: {
        temperature: 0.3,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        httpOptions: modelRetryHttpOptions(),
      },
      beforeModelCallback: [startModelTimer, trimDanglingHistory],
      afterModelCallback: logModelCall,
    });
  }
}
