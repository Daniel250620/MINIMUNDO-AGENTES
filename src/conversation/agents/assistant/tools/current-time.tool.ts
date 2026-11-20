import { FunctionTool } from '@google/adk';

const TIME_ZONE = 'America/Mexico_City';

/** Tool de ejemplo: regresa datos y el modelo redacta la respuesta con ellos. */
export const currentTimeTool = new FunctionTool({
  name: 'get_current_time',
  description:
    'Regresa la fecha y hora actuales en Ciudad de México. Úsala cuando el cliente pregunte la hora o la fecha.',
  execute: () => ({
    timeZone: TIME_ZONE,
    now: new Date().toLocaleString('es-MX', { timeZone: TIME_ZONE }),
  }),
});
