import { Module } from '@nestjs/common';
import { SubstrateModule } from '../substrate/substrate.module';
import { JobService } from './job.service';
import { ChainService } from './chain.service';

@Module({
  imports: [SubstrateModule],
  providers: [JobService, ChainService],
})
export class JobModule {}
