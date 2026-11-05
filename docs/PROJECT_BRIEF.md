# SchoolPass Project Brief

## Problem
A fictional school processes student absence permission requests in scattered chat messages. Parents cannot easily track decisions; homeroom teachers cannot reliably organize requests and supporting documents.

## Goal
Deliver a demonstrable web app that enables a parent to submit a one-day request for their child, a teacher to approve or reject it, and the parent to see the current status.

## Users
- PARENT: logs in, sees own children, submits and views own requests, accesses own attachments and notifications.
- TEACHER: logs in, sees requests for assigned classes, makes one final decision, sees class-level dashboard.

## MVP (P0)
Parent and Teacher self-registration, JWT login, role + ownership authorization, teacher-created classes with join codes, parent enrollment of their own children into multiple classes, create/list/detail leave request, teacher decision with reason for reject, parent-visible status, basic responsive React UI.

## Enhancements (P1)
Private document upload to MinIO, decision notification with BullMQ worker + PostgreSQL, Redis cache for teacher summary, Docker Compose for services, stronger automated tests and demo.

## Non-goals
Complex guardianship, semester enrollment history, real school integration, payments, grades, WhatsApp/email/SMS, mobile native app, microservices, Kubernetes, AI features, full production readiness.

## Classroom flow
Parent and Teacher can register without a class code. A Teacher creates multiple classes and shares each generated join code. A Parent enters a class code and a child name after login; the server links that child to the authenticated Parent and the selected class. One Parent may have children in multiple classes. Each Student record belongs to one Parent and one class in this MVP. Join codes are reusable and should only be shared with intended families.

## Success criteria
1. PARENT can submit only for own child; duplicate student/date request is rejected.
2. TEACHER can decide only requests from assigned class, exactly once.
3. PARENT can see status after decision.
4. Critical negative authorization cases have repeatable tests.
5. A new developer can reproduce the demo from README and seed data.

This is a learning/demo project; use fictional identities only.
