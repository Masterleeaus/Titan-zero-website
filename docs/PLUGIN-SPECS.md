# Titan Zero plugin build specification

Agent-facing specification for the nine plugins on /plugins/. Generated from the same data as the page, so the two always match. Edit the data, then regenerate.

## Global rules (apply to every plugin)

- Every plugin works fully on its own. Local features are never locked behind a paid AI upgrade or a licence key.
- AI upgrades are hosted subscriptions activated inside the plugin: the AI Assistant and the AI Agent Team. They are never separate plugins.
- Deterministic code owns money, dates, permissions, consent and status. AI drafts, suggests and summarises. A person approves any change that affects a customer, a payment or pay.
- Consent and suppression for marketing and SMS are enforced in code. AI cannot override them.
- SMS and voice use the owner's own Twilio account. Twilio is the only SMS provider until others are built.
- Roles: Worker (field staff) and Manager (admin-type). Use WordPress capabilities; check every write.
- Store personal data in the WordPress database. Send data to a hosted AI service only after the owner connects and allows it.
- Australian dollars, GST inclusive, for all displayed prices. Rounding is set once in Quotes & Pricing and reused everywhere.
- Every feature below needs an automated test, and the release checklist must pass before a plugin ships.

## Build order

1. **Workspace & Customers** (Planned). Depends on: none.
2. **Scheduling & Enquiries** (Available from support). Depends on: Workspace & Customers (shared customer model, once released).
3. **Quotes & Pricing** (Planned). Depends on: Workspace & Customers, Scheduling & Enquiries (enquiry source).
4. **Invoices & Payments** (Planned). Depends on: Quotes & Pricing, Workspace & Customers, Finance Manager (export).
5. **Teams & Payroll** (Planned). Depends on: Workspace & Customers (roles), Jobs & Operations (job time).
6. **Jobs & Operations** (Planned). Depends on: Workspace & Customers, Scheduling & Enquiries, Teams & Payroll (staff).
7. **Finance Manager** (Planned). Depends on: Invoices & Payments, Teams & Payroll, Quotes & Pricing (optional).
8. **Marketing & Promotions** (Planned). Depends on: Workspace & Customers, Quotes & Pricing (promotions), Jobs & Operations (review trigger).
9. **Social Media Manager** (Planned). Depends on: Workspace & Customers (contacts only if inbox is added), Marketing & Promotions (shared campaigns).

## Pricing basis

| Workload | AI Assistant | AI Agent Team | Meaning |
|---|---|---|---|
| Light | A$19/mo | A$79/mo | Mostly rules and data work, with occasional AI for summaries, search and drafting. |
| Standard | A$29/mo | A$99/mo | Regular conversational help, drafting and suggestions for people using the plugin every day. |
| Heavy | A$39/mo | A$129/mo | High-volume generation, many agent runs or content produced at scale. |

Scheduling & Enquiries is Standard (approved). Other plugin prices are proposals until the owner confirms them.

App starting price, BYO AI and API keys, incl. GST: A$49 per app per month for SoloAt.Work, SortedAt.Work and SyncedAt.Work, as shown on the homepage and in the calculator. Approved 2026-11-18 (issue 99). This is an app price, not a plugin price, so it is not in the plugin table above.


## Scheduling & Enquiries

**Status:** Available from support  
**AI workload:** Standard  
**Summary:** Bookings, calendars, customers and enquiry handling for service businesses, with a limited free AI allowance.

**Features** (each one needs a test):

- [ ] Booking form with calendars, working hours, service durations and capacity limits
- [ ] Booking page and client portal to view, change or cancel bookings
- [ ] Admin calendar, appointment list, status changes and CSV export
- [ ] Email notifications, customer reminders and follow-ups
- [ ] Rules-based enquiry handling
- [ ] Text-back to missed calls through your own Twilio account

**AI upgrades:**

- Enquiry assistant answers questions about your services and availability (Assistant)
- Guided booking that hands the booking to your calendar rules (Assistant)
- Agent team handles enquiries, booking and calendar changes with approvals (Agent Team)

**Core entities:** Calendar, Service, Booking, Customer, Reminder, Enquiry  
**Depends on:** Workspace & Customers (shared customer model, once released)  
**Build notes:** Released. Maintain and extend. Keep the free plugin fully working without AI.


## Quotes & Pricing

**Status:** Planned  
**AI workload:** Standard  
**Summary:** Build, price and send accurate quotes for jobs, with consistent tax, margins and approvals.

**Features** (each one needs a test):

- [ ] Service and price catalogue with materials, labour, travel and minimum charges
- [ ] Quote builder with line items, options and optional items
- [ ] Tax (GST) rules and rounding set once and applied everywhere
- [ ] Discounts and coupons, with limits and expiry
- [ ] Branded quote templates and PDF output
- [ ] Quote versions and revision history
- [ ] Online acceptance by the customer, recorded with time and name
- [ ] Expiry dates and reminders for unanswered quotes
- [ ] Approval rules when the margin falls below a set threshold
- [ ] One-click conversion of an accepted quote into a job and an invoice

**AI upgrades:**

- Draft a quote from an enquiry, notes or photos (Assistant)
- Suggest line items and prices from past quotes (Assistant)
- Explain price differences against similar past jobs (Assistant)
- Agent team builds quotes end to end and queues them for approval (Agent Team)

**Core entities:** Catalogue item, Price rule, Quote, Quote version, Option, Discount, Approval  
**Depends on:** Workspace & Customers, Scheduling & Enquiries (enquiry source)  
**Build notes:** Deterministic pricing engine first (no AI in price calculation). AI only drafts and suggests; every price is reviewable.


## Invoices & Payments

**Status:** Planned  
**AI workload:** Standard  
**Summary:** Invoices, deposits, payment collection and follow-up for everything you are owed.

**Features** (each one needs a test):

- [ ] Invoices from accepted quotes, jobs or manual entry
- [ ] Deposits and progress claims tied to a quote
- [ ] Tax handling consistent with Quotes & Pricing
- [ ] Payment links and receipts through your payment provider
- [ ] Payment status, partial payments and balance tracking
- [ ] Credit notes and refund records
- [ ] Receivables ageing report
- [ ] Automatic reminder schedule, with approval before the first reminder
- [ ] Export to Finance Manager and accounting packages

**AI upgrades:**

- Write polite, firm or final follow-up messages (Assistant)
- Summarise overdue invoices and the next steps (Assistant)
- Agent team chases payment on the agreed schedule and escalates to you (Agent Team)

**Core entities:** Invoice, Invoice line, Deposit, Payment, Credit note, Reminder schedule  
**Depends on:** Quotes & Pricing, Workspace & Customers, Finance Manager (export)  
**Build notes:** Invoice maths and payment status are deterministic. AI writes messages only; it never changes an amount.


## Workspace & Customers

**Status:** Planned  
**AI workload:** Light  
**Summary:** The shared customer records, sites and team workspace that every other plugin uses.

**Features** (each one needs a test):

- [ ] Customer and contact records, with multiple contacts per customer
- [ ] Sites and properties with addresses, access notes and photos
- [ ] Customer timeline of every booking, quote, job, invoice and message
- [ ] Tags and segments for grouping customers
- [ ] Consent records for marketing and SMS, with the date and source
- [ ] Duplicate detection with a review step before merging
- [ ] CSV import and export with field mapping
- [ ] Roles and permissions, including Worker and Manager
- [ ] Activity log of changes made by each user
- [ ] Shared notes and attachments on any record

**AI upgrades:**

- Summarise a customer's history before a call or visit (Assistant)
- Suggest duplicate matches and tidy messy data, for your approval (Assistant)
- Agent team keeps records current from emails and forms (Agent Team)

**Core entities:** Customer, Contact, Site, Tag, Consent, Timeline event, Role, Activity log  
**Depends on:** none  
**Build notes:** Core model shared by all plugins. Build first. Customer records and consent must be correct before any marketing work.


## Jobs & Operations

**Status:** Planned  
**AI workload:** Standard  
**Summary:** Plan, dispatch and track jobs from booking to completion, with the daily schedule in one place.

**Features** (each one needs a test):

- [ ] Job records linked to a booking, quote and customer
- [ ] Job templates with checklists and required photos
- [ ] Staff assignment and a daily dispatch board
- [ ] Route ordering for each day
- [ ] Job status pipeline from scheduled to completed
- [ ] Photos, notes and signatures captured on site
- [ ] Time and materials recorded against each job
- [ ] Completion sign-off and customer notification
- [ ] Recurring jobs with schedules and exceptions
- [ ] Capacity view showing free hours by staff member

**AI upgrades:**

- Suggest the next job for each staff member and explain why (Assistant)
- Estimate job duration from history (Assistant)
- Agent team reschedules around cancellations and flags jobs at risk (Agent Team)

**Core entities:** Job, Job template, Checklist item, Assignment, Route, Time entry, Material use, Recurrence  
**Depends on:** Workspace & Customers, Scheduling & Enquiries, Teams & Payroll (staff)  
**Build notes:** Dispatch rules and status are deterministic. AI suggests changes; a manager approves any change to a confirmed job.


## Marketing & Promotions

**Status:** Planned  
**AI workload:** Heavy  
**Summary:** Campaigns, promotions, review requests and lead follow-up that respect customer consent.

**Features** (each one needs a test):

- [ ] Audiences built from customer segments, respecting consent
- [ ] Email campaigns with reusable templates
- [ ] SMS campaigns through your own Twilio account, opt-in only
- [ ] Promotions and discount codes shared with Quotes & Pricing
- [ ] Automated review requests after a completed job
- [ ] Lead nurture sequences with stop rules
- [ ] Campaign reports for opens, clicks and bookings
- [ ] Subject line and message testing
- [ ] Unsubscribe and suppression handling in every message
- [ ] Seasonal campaign calendar

**AI upgrades:**

- Write campaign copy and subject lines for your approval (Assistant)
- Suggest audiences and send times from past results (Assistant)
- Agent team runs full campaigns, drafts and sends within your approved limits (Agent Team)

**Core entities:** Audience, Campaign, Template, Promotion, Sequence, Message, Suppression  
**Depends on:** Workspace & Customers, Quotes & Pricing (promotions), Jobs & Operations (review trigger)  
**Build notes:** Consent and suppression are enforced in code, not by AI. Every AI-written message is reviewed before its first send.


## Social Media Manager

**Status:** Planned  
**AI workload:** Heavy  
**Summary:** Plan, write and schedule social posts across your channels, with approval before anything goes live.

**Features** (each one needs a test):

- [ ] Connected social accounts, with reconnect and removal
- [ ] Content calendar with drag-and-drop planning
- [ ] Post composer with a variant for each channel
- [ ] Scheduling and publishing queue with time-zone handling
- [ ] Approval step before publishing, by role
- [ ] Caption and hashtag library
- [ ] Brand voice and tone settings
- [ ] Evergreen post recycling on a set schedule
- [ ] Link tracking and basic performance reports
- [ ] Drafts for replies to comments, held for approval

**AI upgrades:**

- Generate post ideas and captions for each channel (Assistant)
- Adapt one idea for several channels (Assistant)
- Agent team builds a weekly content plan and queues posts for approval (Agent Team)

**Core entities:** Account, Channel, Post, Variant, Calendar slot, Approval, Brand voice, Library item  
**Depends on:** Workspace & Customers (contacts only if inbox is added), Marketing & Promotions (shared campaigns)  
**Build notes:** Publishing is deterministic and approval-gated. Confirm channel API rules before build; cover channels only where the platform permits automated posting.


## Teams & Payroll

**Status:** Planned  
**AI workload:** Light  
**Summary:** Staff, rosters, timesheets, leave and pay for service teams, with rules you can check.

**Features** (each one needs a test):

- [ ] Staff profiles with roles, skills and licence or certificate expiry
- [ ] Rosters and shifts with conflict checks
- [ ] Leave requests with approval
- [ ] Clock in and out from a phone, with job linking
- [ ] Overtime, allowance and penalty rules per role
- [ ] Pay rates by role and by job
- [ ] Pay period close with a summary for review
- [ ] Payslip records in PDF
- [ ] Payroll export for your payroll provider
- [ ] Expiry reminders for licences and certificates

**AI upgrades:**

- Explain timesheet differences and missing clock-outs (Assistant)
- Answer staff questions about leave, rosters and pay (Assistant)
- Agent team suggests rosters that meet skills and hours rules, for approval (Agent Team)

**Core entities:** Staff, Role, Skill, Roster, Shift, Leave, Timesheet, Pay rule, Pay run, Payslip  
**Depends on:** Workspace & Customers (roles), Jobs & Operations (job time)  
**Build notes:** Pay calculation is a deterministic rules engine with tests per jurisdiction. AI never calculates pay. Payroll tax and reporting rules are out of scope until confirmed per country.


## Finance Manager

**Status:** Planned  
**AI workload:** Standard  
**Summary:** Cash flow forecasting, accounting and financial reports, so you can see where the money is going.

**Features** (each one needs a test):

- [ ] Chart of accounts with sensible defaults
- [ ] Bank transaction import (CSV, with a bank feed provider later)
- [ ] Categorisation rules, with review of unmatched items
- [ ] Bank reconciliation
- [ ] Profit and loss and balance sheet
- [ ] Cash flow statement
- [ ] Thirteen-week cash flow forecast from invoices, bills and payroll
- [ ] Budgets against actuals
- [ ] Expense claims with receipts
- [ ] Export to accountants (CSV and standard accounting formats)

**AI upgrades:**

- Suggest categories for new transactions (Assistant)
- Explain changes in profit or cash flow (Assistant)
- Agent team runs forecast scenarios and flags anomalies for review (Agent Team)

**Core entities:** Account, Transaction, Rule, Reconciliation, Budget, Forecast, Expense, Report  
**Depends on:** Invoices & Payments, Teams & Payroll, Quotes & Pricing (optional)  
**Build notes:** Ledger, reconciliation and reports are deterministic and must tie out. AI suggests categories and commentary only; it never posts an entry without approval.

