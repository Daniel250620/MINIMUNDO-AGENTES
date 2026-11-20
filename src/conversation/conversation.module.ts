import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InMemoryArtifactService } from '@google/adk';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AssistantAgent } from './agents/assistant/assistant.agent';
import { InMemoryMessageBatcher } from './batcher/in-memory-message-batcher';
import { MessageBatcher } from './batcher/message-batcher';
import { ConversationService } from './conversation.service';
import { EventEntity } from './entities/adk-event.entity';
import { SessionEntity } from './entities/adk-session.entity';
import { ConversationMessage } from './entities/conversation-message.entity';
import { InboundService } from './inbound/inbound.service';
import { OutboundDispatcher } from './outbound/outbound.dispatcher';
import { AgentRunner } from './runner/agent-runner';
import { TypeOrmSessionService } from './session/typeorm-session.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SessionEntity, EventEntity, ConversationMessage]),
    // Circular: el controller del webhook usa ConversationService y el envío usa WhatsappService.
    forwardRef(() => WhatsappModule),
  ],
  providers: [
    ConversationService,
    TypeOrmSessionService,
    InboundService,
    OutboundDispatcher,
    AgentRunner,
    AssistantAgent,
    { provide: MessageBatcher, useClass: InMemoryMessageBatcher },
    // shortcut: artifacts en memoria (adjuntos del turno); se pierden al reiniciar, usar GCS/S3 si se necesitan después.
    {
      provide: InMemoryArtifactService,
      useFactory: () => new InMemoryArtifactService(),
    },
  ],
  exports: [ConversationService, TypeOrmSessionService],
})
export class ConversationModule {}
