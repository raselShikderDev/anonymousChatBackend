import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "./schema";
import { ConfigService } from "../config/config.service";
import * as path from "path";

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  public db!: ReturnType<typeof drizzle<typeof schema>>;
  private pool!: Pool;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const databaseUrl = this.configService.databaseUrl;

    const isCloud = databaseUrl.includes("sslmode");

    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: isCloud ? { rejectUnauthorized: false } : false,
    });

    this.db = drizzle(this.pool, { schema });

    try {
      await migrate(this.db, {
        migrationsFolder: path.join(process.cwd(), "drizzle"),
      });

      console.log(" Database connected & migrated");
    } catch (err) {
      console.error(" Migration failed:", err);
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
