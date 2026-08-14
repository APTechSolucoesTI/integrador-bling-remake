import {
  Global,
  Inject,
  Injectable,
  Module,
  type OnModuleDestroy,
} from "@nestjs/common";
import { Queue } from "bullmq";
import {
  INTEGRATION_QUEUE,
  INTEGRATION_QUEUE_CLIENT,
} from "./queue.constants.js";

export {
  INTEGRATION_QUEUE,
  INTEGRATION_QUEUE_CLIENT,
} from "./queue.constants.js";

@Injectable()
class QueueLifecycle implements OnModuleDestroy {
  constructor(
    @Inject(INTEGRATION_QUEUE_CLIENT)
    private readonly queue: Queue,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: INTEGRATION_QUEUE_CLIENT,
      useFactory: (): Queue =>
        new Queue(INTEGRATION_QUEUE, {
          connection: {
            host: process.env["REDIS_HOST"] ?? "localhost",
            port: Number(process.env["REDIS_PORT"] ?? 6379),
          },
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: "exponential", delay: 1_000 },
            removeOnComplete: { count: 1_000 },
            removeOnFail: { count: 5_000 },
          },
        }),
    },
    QueueLifecycle,
  ],
  exports: [INTEGRATION_QUEUE_CLIENT],
})
export class QueueModule {}
