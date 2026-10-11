import { Router } from 'express';
import { systemRouter } from '../../modules/system/system.routes.js';
import { authRouter } from '../../modules/auth/auth.controller.js';
import { tenancyRouter } from '../../modules/tenancy/tenancy.routes.js';
import {
  organizationRouter,
  platformOrganizationRouter,
} from '../../modules/organizations/organizations.routes.js';
import { peopleRouter } from '../../modules/people/people.routes.js';
import { academicsRouter } from '../../modules/academics/academics.routes.js';
import { attendanceRouter } from '../../modules/attendance/attendance.routes.js';
import { examinationsRouter } from '../../modules/examinations/examinations.routes.js';
import { financeRouter } from '../../modules/finance/finance.routes.js';

export const v1Router = Router();

v1Router.get('/', (_request, response) => {
  response.status(200).json({ status: 'ok', version: 'v1' });
});

v1Router.use(systemRouter);
v1Router.use('/auth', authRouter);
v1Router.use('/organizations', tenancyRouter);
v1Router.use('/organizations', organizationRouter);
v1Router.use('/organizations', peopleRouter);
v1Router.use('/organizations', academicsRouter);
v1Router.use('/organizations', attendanceRouter);
v1Router.use('/organizations', examinationsRouter);
v1Router.use('/organizations', financeRouter);
v1Router.use('/platform/organizations', platformOrganizationRouter);
