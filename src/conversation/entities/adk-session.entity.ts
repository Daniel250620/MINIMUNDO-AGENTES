import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

/** appName de la sesión de cara al cliente. Los sub-agentes usan el suyo propio. */
export const APP_NAME = 'minimundo-assistant';

/**
 * Una sesión de ADK se identifica por la tripleta (appName, userId, sessionId).
 * Cada sub-agente envuelto en AgentTool crea su propia sesión reusando el
 * sessionId del padre pero con su propio appName, así que la tripleta es lo
 * que mantiene sus eventos aislados de los del router.
 */
@Entity('adk_sessions')
@Unique(['appName', 'userId', 'adkSessionId'])
@Index(['appName', 'phone'])
export class SessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  appName!: string; // ej: 'minimundo-assistant', 'billing_agent'

  @Column({ type: 'varchar', length: 64 })
  userId!: string; // client_number del contacto de WhatsApp

  @Column({ type: 'varchar', length: 128 })
  adkSessionId!: string; // el Session.id que ADK ve

  /** Teléfono del cliente en E.164 (`normalizePhone`). */
  @Column({ type: 'text', nullable: true })
  phone?: string | null;

  @Column({ type: 'jsonb', default: {} })
  state!: Record<string, unknown>;

  @Column({ default: true })
  isBotActive!: boolean;

  /** El cliente pidió atención humana; la prende `requestHuman` junto con el bot apagado. */
  @Column({ default: false })
  needsHuman!: boolean;

  @Column({
    type: 'bigint',
    default: () => 'extract(epoch from now()) * 1000',
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v == null ? v : Number(v)),
    },
  })
  lastUpdateTime!: number;

  @Column({ type: 'varchar', length: 16, nullable: true })
  lastEventRole?: 'user' | 'model' | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}
