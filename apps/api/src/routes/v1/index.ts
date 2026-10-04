import { Router } from 'express';
import { systemRouter } from '../../modules/system/system.routes.js';
import { authRouter } from '../../modules/auth/auth.controller.js';
import { tenancyRouter } from '../../modules/tenancy/tenancy.routes.js';
import {
  organizationRouter,
  platformOrganizationRouter,
} from '../../modules/organizations/organizations.routes.js';
import { peopleRouter } from '../../modules/people/people.routes.js';

export const v1Router = Router();

v1Router.get('/', (_request, response) => {
  response.status(200).json({ status: 'ok', version: 'v1' });
});

v1Router.use(systemRouter);
v1Router.use('/auth', authRouter);
v1Router.use('/organizations', tenancyRouter);
v1Router.use('/organizations', organizationRouter);
v1Router.use('/organizations', peopleRouter);
v1Router.use('/platform/organizations', platformOrganizationRouter);
