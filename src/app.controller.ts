import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class AppController {
  @Get()
  root(@Res() res: Response) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Anonymous Chat API</title>
        <style>
          body {
            font-family: Arial;
            text-align: center;
            padding: 50px;
            background: #0f172a;
            color: #f1f5f9;
          }
          h1 { color: #38bdf8; }
          .box {
            margin-top: 30px;
            padding: 20px;
            border-radius: 10px;
            background: #1e293b;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <h1>🚀 Anonymous Chat API</h1>
        <div class="box">
          <p>Backend is running successfully</p>
          <p>WebSocket + Redis + PostgreSQL</p>
          <p>Version: v1</p>
        </div>
      </body>
      </html>
    `);
  }

  @Get('/health')
health() {
  return { status: 'ok' };
}
}