# PROMPT 04 — MULTI-TENANCY & RBAC

This is a critical security phase.

Read `AGENTS.md`.

## Objective

Implement secure organization/tenant isolation and role/permission authorization.

## Implement

- Organization model
- Campus foundation
- Membership model
- Role model
- Permission model
- user-organization membership
- tenant resolution middleware
- server-side authorization middleware
- permission utilities
- tenant-aware query helpers
- tenant-aware indexes where needed
- authorization tests
- cross-tenant tests

## Roles

Platform Super Admin
Organization Owner
Organization Admin
Campus Admin
Principal/Director
Academic Coordinator
Teacher
Accountant/Finance Officer
Admissions/Reception
Student
Parent/Guardian

Do not hardcode business logic against role names when a permission model is more appropriate.

## Example permissions

organization.read
organization.update
campus.read
campus.manage
student.read
student.create
attendance.write
finance.read
finance.manage
reports.read

## Critical security requirements

A user authenticated in Organization A must not access Organization B resources.

Changing an ID in a URL/body must not permit cross-tenant access.

Test:
- cross-tenant read
- cross-tenant update
- cross-tenant delete
- privilege escalation
- unauthorized campus access

Frontend permission hiding is not security.

## Acceptance criteria

- tenant context is established server-side
- permissions are enforced server-side
- cross-tenant requests fail
- role permissions are testable
- object-level authorization is enforced where relevant
- security tests pass
