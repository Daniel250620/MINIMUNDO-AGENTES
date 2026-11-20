import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SessionEntity } from './adk-session.entity';

@Entity('adk_events')
@Index(['session', 'timestamp']) // CRÍTICO: Índice compuesto
export class EventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => SessionEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'sessionId' })
  session!: SessionEntity;

  @Column({ type: 'uuid' })
  sessionId!: string; // FK a SessionEntity.id (PK subrogada, no el sessionId de ADK)

  @Column({
    type: 'bigint',
    transformer: {
      // ponytail: bigint de PG llega como string, number si el epoch-ms lo justifica con precisión nativa
      to: (v: number | null) => v,
      from: (v: string | null) => (v == null ? v : Number(v)),
    },
  })
  timestamp!: number;

  @Column({ type: 'jsonb' })
  data!: Record<string, unknown>; // Evento crudo de ADK
}
