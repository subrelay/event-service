import { SchedulerRegistry } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CronJob } from 'cron';
import { SubstrateService } from '../substrate/substrate.service';
import { JobEvent, JobName } from '../common/type';

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly substrateService: SubstrateService,
  ) {}

  // TODO accept rpcs and handle error
  @OnEvent(JobEvent.CREATE)
  async createBlockWatcher(name: string, chainUuid: string, rpc: string) {
    const exist = this.schedulerRegistry.doesExist('cron', name);
    let job: CronJob;
    if (!exist) {
      const date = new Date(Date.now() + 60 * 1000);
      const time = `${date.getMinutes()} ${date.getHours()} ${date.getDate()} ${date.getMonth()} *`;
      this.logger.debug(`Time: ${time}`);
      job = new CronJob(
        time,
        async () => {
          this.logger.debug(`Started a watcher for chain ${name}`);
          await this.substrateService.subscribeNewHeads(rpc, name, chainUuid);
        },
        () => this.logger.debug('Done'),
      );

      this.schedulerRegistry.addCronJob(name, job);
      job.start();
      this.logger.debug(`Created a watcher for chain ${name}`);
    }
  }

  @OnEvent(JobEvent.DELETE_OUTDATED)
  stopOutdatedBlockWatchers(names: string[]) {
    const jobs = this.schedulerRegistry.getCronJobs();
    for (const name of jobs.keys()) {
      if (name !== JobName.WORKFLOW_MONITOR && !names.includes(name)) {
        this.schedulerRegistry.deleteCronJob(name);
        this.logger.debug(`Delete a watcher for chain ${name}`);
      }
    }
  }

  @OnEvent(JobEvent.READ_ALL)
  showAllJobs() {
    const jobs = this.schedulerRegistry.getCronJobs();
    const jobNames = [];
    for (const name of jobs.keys()) {
      jobNames.push(name);
    }

    this.logger.debug(`All jobs: ${jobNames.join(', ')}`);
  }
}
