import { SchedulerRegistry } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CronJob } from 'cron';
import { SubstrateService } from '../substrate/substrate.service';
import { JobEvent } from '../common/type';

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly substrateService: SubstrateService,
  ) {}

  // TODO accept rpcs and handle error
  @OnEvent(JobEvent.CREATE)
  async createChainWatcher(name: string, rpc: string) {
    if (this.chainWatcherExists(name)) {
      this.logger.debug(`Watcher for chain ${name} already exist`);
      return;
    }

    const date = new Date(Date.now() + 60 * 1000);
    const time = `${date.getMinutes()} ${date.getHours()} ${date.getDate()} ${date.getMonth()} *`;
    this.logger.debug(`Time: ${time}`);
    const job = new CronJob(
      time,
      async () => {
        this.logger.debug(`Started a watcher for chain ${name}`);
        await this.substrateService.monitorChain(rpc, name);
      },
      () => this.logger.debug('Done'),
    );

    this.schedulerRegistry.addCronJob(name, job);
    job.start();
    this.logger.debug(`Created a watcher for chain ${name}`);
  }

  chainWatcherExists(name: string) {
    return this.schedulerRegistry.doesExist('cron', name);
  }

  @OnEvent(JobEvent.STOP)
  stopChainWatcher(name: string) {
    this.schedulerRegistry.deleteCronJob(name);
    this.logger.debug(`Deleted a watcher for chain ${name}`);
  }
}
