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
    this.pool = new Pool({
      connectionString: this.configService.databaseUrl,
    });

    this.db = drizzle(this.pool, { schema });

    await migrate(this.db, {
      // migrationsFolder: path.join(__dirname, '../../drizzle'),
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });

    console.log("✅ Database connected & migrated");
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}

// import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// import { drizzle } from 'drizzle-orm/node-postgres';
// import { migrate } from 'drizzle-orm/node-postgres/migrator';
// import { Pool } from 'pg';
// import * as schema from './schema';
// import { ConfigService } from '../config/config.service';
// import * as path from 'path';

// @Injectable()
// export class DatabaseService implements OnModuleInit, OnModuleDestroy {
//   public db: ReturnType<typeof drizzle<typeof schema>> |;
//   private pool: Pool;

//   constructor(private readonly configService: ConfigService) {}

//   async onModuleInit() {
//     this.pool = new Pool({
//       connectionString: this.configService.databaseUrl,
//     });
//     this.db = drizzle(this.pool, { schema });

//     await migrate(this.db, {
//       migrationsFolder: path.join(__dirname, '../../drizzle'),
//     });
//   }

//   async onModuleDestroy() {
//     await this.pool.end();
//   }
// }
