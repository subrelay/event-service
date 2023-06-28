import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { SubstrateService } from './substrate.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'block',
    }),
  ],
  providers: [SubstrateService],
  exports: [SubstrateService],
})
export class SubstrateModule {}
