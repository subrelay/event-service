import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { SubstrateService } from './substrate.service';
import { ChainProcessor } from './chain.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'block',
    }),
    BullModule.registerQueue({
      name: 'chain',
    }),
  ],
  providers: [SubstrateService, ChainProcessor],
  exports: [SubstrateService],
})
export class SubstrateModule {}
