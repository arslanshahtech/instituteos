import { Router } from 'express';
import { systemRouter } from '../../modules/system/system.routes.js';

export const v1Router = Router();

v1Router.get('/', (_request, response) => {
  response.status(200).json({ status: 'ok', version: 'v1' });
});

v1Router.use(systemRouter);
