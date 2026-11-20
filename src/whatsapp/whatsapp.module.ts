import { forwardRef, Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { ConversationModule } from '../conversation/conversation.module';

@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService],
  imports: [forwardRef(() => ConversationModule)],
  exports: [WhatsappService],
})
export class WhatsappModule {}
