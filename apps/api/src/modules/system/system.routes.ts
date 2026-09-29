import { Router } from 'express';
import { healthController, readinessController } from './system.controller.js';

export const systemRouter = Router();

systemRouter.get('/health', healthController);
systemRouter.get('/ready', readinessController);
