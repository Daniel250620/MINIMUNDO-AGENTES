import { Injectable, Logger } from '@nestjs/common';
import {
  InMemoryArtifactService,
  isFinalResponse,
  ReflectAndRetryModelPlugin,
  Runner,
  stringifyContent,
} from '@google/adk';
import type { Content } from '@google/genai';
import { AssistantAgent } from '../agents/assistant/assistant.agent';
import { APP_NAME } from '../entities/adk-session.entity';
import {
  isOutboundMessage,
  type OutboundMessage,
} from '../outbound/outbound-message';
import { TypeOrmSessionService } from '../session/typeorm-session.service';

export interface RunParams {
  userId: string;
  sessionId: string;
  content: Content;
  /** Id único de la corrida; sólo un `state.outbound` con este `turnId` cuenta como mensaje nuevo. */
  turn: string;
  /** Adjuntos del turno; facturación los usa para el aviso de lectura. */
  files?: number;
}

export interface RunResult {
  answer: string;
  outbound?: OutboundMessage;
  /** El turno falló (modelo o tool); quien llama decide cómo retomar con el cliente. */
  failed?: true;
}

/** Corre un turno del agente raíz y extrae la respuesta; no conoce WhatsApp ni el log. */
@Injectable()
export class AgentRunner {
  private readonly logger = new Logger(AgentRunner.name);
  private readonly runner: Runner;

  constructor(
    assistant: AssistantAgent,
    private readonly sessionService: TypeOrmSessionService,
    artifactService: InMemoryArtifactService,
  ) {
    this.runner = new Runner({
      appName: APP_NAME,
      agent: assistant.agent,
      sessionService,
      artifactService,
      // Un MALFORMED_FUNCTION_CALL se corrige con reflexión del modelo en vez de tumbar el turno.
      plugins: [new ReflectAndRetryModelPlugin({ maxRetries: 2 })],
    });
  }

  /** Un solo runAsync: los reintentos ante 503/429 los hace el cliente del modelo (agents/shared/model-retry.ts). */
  async run(p: RunParams): Promise<RunResult> {
    try {
      let answer = '';
      let toolOutbound: OutboundMessage | undefined;
      const events = this.runner.runAsync({
        userId: p.userId,
        sessionId: p.sessionId,
        newMessage: p.content,
        stateDelta: { turn: p.turn, files: p.files ?? 0 },
      });
      for await (const event of events) {
        // ADK marca como error un STOP sin parts (respuesta vacía tras una tool); no lo es.
        if (event.errorCode && event.errorCode !== 'STOP') {
          throw new Error(event.errorMessage ?? event.errorCode);
        }
        if (!isFinalResponse(event)) continue;
        const response = event.content?.parts?.find(
          (part) => part.functionResponse,
        )?.functionResponse?.response;
        // Se identifica por la forma (`kind`), no por el nombre de la tool.
        const fromTool = [response, response?.result].find(isOutboundMessage);
        if (fromTool && !toolOutbound) toolOutbound = fromTool;
        const result = response?.result;
        const found =
          stringifyContent(event) || (typeof result === 'string' ? result : '');
        if (found) answer = found;
      }
      const outbound = toolOutbound ?? (await this.stateOutbound(p));
      return { answer, ...(outbound && { outbound }) };
    } catch (err) {
      this.logger.error(
        `Agente falló para ${p.userId}: ${(err as Error).message}`,
      );
      return { answer: '', failed: true };
    }
  }

  /** Mensaje que un sub-agente dejó en el state; un valor de otra corrida se ignora. */
  private async stateOutbound(p: RunParams) {
    const session = await this.sessionService.getSession({
      appName: APP_NAME,
      userId: p.userId,
      sessionId: p.sessionId,
      config: { numRecentEvents: 1 },
    });
    const stored = session?.state['outbound'] as
      { turnId?: string; message?: unknown } | undefined;
    return stored?.turnId === p.turn && isOutboundMessage(stored.message)
      ? stored.message
      : undefined;
  }
}
