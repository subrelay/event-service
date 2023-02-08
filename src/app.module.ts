import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SubstrateModule } from './substrate/substrate.module';
import { DbModule } from './db/db.module';
import { JobModule } from './job/job.module';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/monitoring-error.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST'),
          port: 6379,
        },
      }),
    }),
    EventEmitterModule.forRoot(),
    SubstrateModule,
    DbModule,
    JobModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
