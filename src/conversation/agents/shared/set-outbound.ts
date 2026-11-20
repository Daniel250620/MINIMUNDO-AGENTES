import type { Context } from '@google/adk';
import type { OutboundMessage } from '../../outbound/outbound-message';

/**
 * Entrega de un sub-agente: sus eventos no llegan al stream del router, así que el mensaje viaja por state.
 * `turnId` copia el `turn` de la corrida actual, de modo que AgentRunner ignora valores de turnos anteriores.
 */
export function setOutbound(ctx: Context, message: OutboundMessage) {
  ctx.state.set('outbound', { turnId: ctx.state.get('turn'), message });
}
