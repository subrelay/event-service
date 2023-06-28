import { Module } from '@nestjs/common';
import { SubstrateModule } from '../substrate/substrate.module';
import { ChainService } from './chain.service';
import { JobService } from './job.service';

@Module({
  imports: [SubstrateModule],
  providers: [ChainService, JobService],
  exports: [JobService],
})
export class JobModule {}
