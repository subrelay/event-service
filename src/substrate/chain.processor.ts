import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bull';
import { ChainInfo, JobEvent } from '../common/type';
import { SchedulerRegistry } from '@nestjs/schedule';
import { find } from 'lodash';

@Processor('chain')
export class ChainProcessor {
  private readonly logger = new Logger(ChainProcessor.name);

  constructor(
    private eventEmitter: EventEmitter2,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  @Process({ concurrency: 10 })
  async processChainQueue(job: Job) {
    const chains: ChainInfo[] = job.data;

    this.logger.debug(
      `[Chain Queue] Receive a job: ${chains
        .map((c) => c.chainId)
        .join(' | ')}`,
    );

    const jobNames = [];
    for (const [name] of this.schedulerRegistry.getCronJobs()) {
      const chain = find(chains, { chainId: name });
      if (!chain) {
        this.eventEmitter.emit(JobEvent.STOP, name);
      } else {
        jobNames.push(name);
      }
    }

    chains.forEach((chain) => {
      if (!jobNames.includes(chain.chainId)) {
        this.eventEmitter.emit(
          JobEvent.CREATE,
          chain.chainId,
          chain.config.rpcs[0],
        );
      }
    });
  }
}
