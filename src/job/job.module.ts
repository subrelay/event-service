import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SubstrateModule } from '../substrate/substrate.module';
import { JobService } from './job.service';

@Module({
  imports: [ScheduleModule.forRoot(), SubstrateModule],
  providers: [JobService],
})
export class JobModule {}
