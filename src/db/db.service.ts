import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { isEmpty, map } from 'lodash';
import { Client } from 'pg';
import { JobEvent, JobName } from '../common/type';

@Injectable()
export class DbService implements OnModuleInit {
  private client: Client;
  private readonly logger = new Logger(DbService.name);

  constructor(
    private readonly configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    this.client = this.createDatabaseClient();
    this.client.connect();
    this.logger.debug('Created a connection to DB');
    this.monitorWorkflows();
  }

  createDatabaseClient(): Client {
    return new Client({
      host: this.configService.get('DB_HOST'),
      port: this.configService.get('DB_PORT'),
      password: this.configService.get('DB_PASSWORD'),
      database: this.configService.get('DB_NAME'),
      user: this.configService.get('DB_USERNAME'),
    });
  }

  @Cron('* * * * *', {
    name: JobName.WORKFLOW_MONITOR,
  })
  async monitorWorkflows() {
    this.logger.debug('Monitoring workflow . . .');
    const {
      rows: chains,
    }: {
      rows: {
        uuid: string;
        rpcs: string[];
        chainId: string;
        version: string;
      }[];
    } = await this.client.query(`
        SELECT DISTINCT c.uuid AS uuid, c."chainId", c.version, c.config -> 'rpcs' AS rpcs
        FROM "workflow_version" wv 
            INNER JOIN "chain" c ON wv."chainUuid" = c.uuid
            INNER JOIN "workflow" w ON wv."workflowId" = w.id
        WHERE w.status='running'`);

    if (!isEmpty(chains)) {
      await Promise.all(
        chains.map((chain) =>
          this.eventEmitter.emit(
            JobEvent.CREATE,
            chain.chainId,
            chain.uuid,
            chain.rpcs[0],
          ),
        ),
      );
    }

    // Delete outdated jobs
    this.logger.debug(`All chains: ${map(chains, 'chainId').join(', ')}`);
    this.eventEmitter.emit(JobEvent.DELETE_OUTDATED, map(chains, 'chainId'));
  }
}
