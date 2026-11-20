import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { File } from 'src/files/entities/file.entity';

export type MessageDirection = 'in' | 'out';

/** Referencia al adjunto para mostrarlo en el panel: `mediaId` de Meta o `url` pública/presignada. */
export interface MessageMedia {
  kind: 'image' | 'document';
  mediaId?: string;
  url?: string;
  filename?: string;
}

@Entity('conversation_message')
export class ConversationMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Teléfono del cliente en E.164 (`normalizePhone`). */
  @Index()
  @Column({ type: 'text', nullable: false })
  phone!: string;

  @Column({ type: 'varchar', length: 8 })
  direction!: MessageDirection;

  @Column({ type: 'text', nullable: true })
  content?: string | null;

  @ManyToOne(() => File, { nullable: true })
  @JoinColumn({ name: 'file_id' })
  file?: File | null;

  @Column({
    name: 'file_id',
    type: 'uuid',
    nullable: true,
    insert: false,
    update: false,
  })
  fileId?: string | null;

  /** id de WhatsApp; único para deduplicar reenvíos de Meta. */
  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  wamid?: string | null;

  /** Nombre del artifact (`wa_<wamid>.<ext>`) del adjunto entrante. */
  @Column({ type: 'varchar', nullable: true })
  attachmentName?: string | null;

  @Column({ type: 'varchar', nullable: true })
  attachmentMime?: string | null;

  /** ponytail: solo la referencia; Meta expira entrantes a 7 días. Persistir el archivo (S3) si se necesita más. */
  @Column({ type: 'jsonb', nullable: true })
  media?: MessageMedia | null;

  @Column({ type: 'jsonb', nullable: true })
  rawPayload?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;
}
