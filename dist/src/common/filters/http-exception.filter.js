"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
let HttpExceptionFilter = class HttpExceptionFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        if (!(exception instanceof common_1.HttpException)) {
            console.error('[Unhandled]', exception);
            return response.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Internal server error',
                },
            });
        }
        const status = exception.getStatus();
        const exceptionResponse = exception.getResponse();
        if (typeof exceptionResponse === 'object' &&
            typeof exceptionResponse.code === 'string' &&
            typeof exceptionResponse.message === 'string') {
            return response.status(status).json({
                success: false,
                error: {
                    code: exceptionResponse.code,
                    message: exceptionResponse.message,
                },
            });
        }
        let code;
        let message;
        switch (status) {
            case common_1.HttpStatus.UNAUTHORIZED:
                code = 'UNAUTHORIZED';
                message = 'Missing or expired session token';
                break;
            case common_1.HttpStatus.FORBIDDEN:
                code = 'FORBIDDEN';
                message =
                    typeof exceptionResponse === 'object'
                        ? exceptionResponse.message ?? 'Forbidden'
                        : String(exceptionResponse);
                break;
            case common_1.HttpStatus.NOT_FOUND:
                code = 'NOT_FOUND';
                message =
                    typeof exceptionResponse === 'object'
                        ? exceptionResponse.message ?? 'Not found'
                        : String(exceptionResponse);
                console.warn('[HttpExceptionFilter] Generic NOT_FOUND — missing structured code in service:', exceptionResponse);
                break;
            case common_1.HttpStatus.CONFLICT:
                code = 'CONFLICT';
                message =
                    typeof exceptionResponse === 'object'
                        ? exceptionResponse.message ?? 'Conflict'
                        : String(exceptionResponse);
                break;
            case common_1.HttpStatus.UNPROCESSABLE_ENTITY:
                code = 'UNPROCESSABLE_ENTITY';
                message =
                    typeof exceptionResponse === 'object'
                        ? exceptionResponse.message ?? 'Unprocessable entity'
                        : String(exceptionResponse);
                break;
            case common_1.HttpStatus.BAD_REQUEST:
            default:
                code = 'VALIDATION_ERROR';
                if (typeof exceptionResponse === 'object') {
                    message = Array.isArray(exceptionResponse.message)
                        ? exceptionResponse.message[0]
                        : exceptionResponse.message ?? 'Validation error';
                }
                else {
                    message = String(exceptionResponse);
                }
                break;
        }
        return response.status(status).json({
            success: false,
            error: { code, message },
        });
    }
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = __decorate([
    (0, common_1.Catch)()
], HttpExceptionFilter);
//# sourceMappingURL=http-exception.filter.js.map