"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const express_1 = require("express");
let AppController = class AppController {
    root(res) {
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
    health() {
        return { status: 'ok' };
    }
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_a = typeof express_1.Response !== "undefined" && express_1.Response) === "function" ? _a : Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "root", null);
__decorate([
    (0, common_1.Get)('/health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "health", null);
exports.AppController = AppController = __decorate([
    (0, common_1.Controller)()
], AppController);
//# sourceMappingURL=app.controller.js.map