import { Response } from 'express';
export declare class AppController {
    root(res: Response): any;
    health(): {
        status: string;
    };
}
