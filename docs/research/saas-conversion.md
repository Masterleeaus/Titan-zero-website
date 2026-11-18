# SaaS conversion practice for Titan Zero pages

Date: 2026-11-18
Scope: landing pages, pricing pages, free-tier and trial sign-up, and calls to action for small paid WordPress plugins and business software sold to tradespeople and service businesses in Australia.
Status: research note. It recommends changes; it does not change any live page. Each recommendation has a matching P1 COPY issue in the repository.

## How this was done

- Primary pages read: Jobber, ServiceM8 (pricing and free plan), Square Appointments (Australian pricing), Tradify (via its Capterra listing).
- Regulatory and platform sources: ACCC price display guidance, a law firm summary of Australia's new unfair trading practices Act, and the WordPress.org plugin guideline on trialware.
- Research on pages and forms: Baymard Institute (checkout research), Smashing Magazine and Monetizely (pricing page design), HubSpot (calls to action), web.dev (accessible forms).
- Not reached: Fresha and Calendly pricing pages were not on the fetch allowlist, so they are not used. Some figures below come from secondary articles or vendor blogs. These are marked.
- Titan Zero facts come from the repository files `pricing/index.html` and `frontdesk/index.html`.

## The 10 practices

### 1. Show the full price, including fees you cannot avoid, next to the headline price

- Reason: buyers trust a price more when the total they will pay is visible before they start. Hidden fees that appear late are a common reason to leave.
- Evidence: the ACCC says the total shown should include taxes and fees that cannot be avoided or that are pre-selected. Partial prices, such as a monthly figure, must be shown no less prominently than the total. Source: https://www.accc.gov.au/consumers/pricing/price-displays
- Titan Zero: the Front Desk page shows A$29 and A$99 per month "incl. GST", but says SMS through Twilio is paid to Twilio directly. Put a short line beside each headline price stating what else the buyer pays (Twilio, any hosted AI usage) and what is included.

### 2. Say how billing, renewal and cancellation work before sign-up

- Reason: people hesitate when they do not know how they will be charged or how to stop. Clear terms reduce support questions and refund disputes.
- Evidence: Australia's new unfair trading practices Act (Royal Assent 6 July 2026, starts 1 July 2027) will require subscription terms, renewal and cancellation steps to be clear before signing, and online cancellation for online sign-ups. Source: https://www.claytonutz.com/insights/2026/october/dark-patterns-drip-pricing-and-dodgy-subscriptions-australia-s-new-unfair-trading-practices-act-explained . Jobber's pricing page includes a plain note that the first annual payment cannot be refunded. Source: https://getjobber.com/pricing/
- Titan Zero: add a short "Billing and cancelling" block under each paid plan. It should say the billing period, when renewal happens, whether any payment is refundable, and how to cancel in one step. Write it now so the site is ready before the Act starts.

### 3. Use one plain button label per step, and say what happens next

- Reason: a label that names the outcome and the next step gets more clicks and fewer doubts than a vague word such as "Submit" or "Sign up".
- Evidence: Jobber pairs its free trial button with a note that a plan can be picked later. Source: https://getjobber.com/pricing/ . ServiceM8 uses "Get a 14-day Free Trial". Source: https://www.servicem8.com/pricing . HubSpot's pricing research recommends starting the button with a verb, saying what the buyer gets, and warns that the word "submit" hurt conversions. Source: https://blog.hubspot.com/marketing/best-practices-pricing-page?app=1
- Titan Zero: the Front Desk page uses "Get the free plugin" and "Plan my setup", which are short but do not say what follows. Consider "Download the free Front Desk plugin" with a one-line note such as "Installs on your WordPress site. No licence key." Confirm the wording against the actual download flow before changing it.

### 4. Give the free option real numbers, not vague words

- Reason: a free plan is only a useful first step if buyers can see its limits in units they understand, such as users and jobs per month.
- Evidence: ServiceM8's free plan is for solo operators and lists one user, 30 new quotes or jobs per month, 10 AI assists per day, and a stated SMS cost. Source: https://www.servicem8.com/free-plan . Square Appointments' Australian pricing lists its free plan features one by one, including online booking and invoicing. Source: https://square.com/au/en/appointments/pricing
- Titan Zero: the Front Desk page says "a limited free AI allowance" without a number. Replace it with an exact allowance (for example, "a set number of enquiry replies per day"), once the value is confirmed in the product. This is a copy change with no effect on code.

### 5. Explain when the free plan stops being enough, and what happens then

- Reason: a limit that appears with no warning feels like a trap. A clear grace period and a clear upgrade step build trust and make the upgrade feel like a choice.
- Evidence: ServiceM8 says that once a free user passes the monthly limit they keep working for seven days before being asked to upgrade, and that plans can be changed at any time with unused credit applied pro rata. Source: https://www.servicem8.com/free-plan
- Titan Zero: wherever the free and paid plans are compared, add a short "When you would need to upgrade" line. Name the trigger (for example, wanting a second staff member or a hosted AI service) and say that the free plugin keeps working without a licence key.

### 6. Keep the free plugin genuinely useful, not a timed or capped teaser

- Reason: WordPress.org removes plugins that cap usage to push people toward a paid upgrade, and it removes "sandbox" plugins that only promote a fully working paid version. A free plugin that is useful on its own is also easier to recommend and to review.
- Evidence: the WordPress.org guideline on trialware says plugins that cap usage to push upgrades are not allowed, while free services with limits are allowed. It also says that a sandbox-only plugin promoting a full paid version counts as trialware. Source: https://make.wordpress.org/plugins/2018/08/23/guideline-update-clarifications-to-trialware-and-human-readability/
- Titan Zero: the Front Desk page already says booking, calendars, customers, reminders and reports work with no licence key. Keep that promise visible and do not add copy that implies the free plugin is a trial.

### 7. Start with a no-card trial or free plan, and remind people before anything renews

- Reason: a no-card start gets more sign-ups. A trial that charges automatically can show a higher trial-to-paid rate, but that rate can partly reflect people forgetting to cancel, which tends to lower how many stay.
- Evidence: a vendor blog with example funnels reports that no-card opt-in trials had the lowest trial-to-paid rate (25%) but kept the most customers after 90 days, compared with an opt-out card trial (60% trial-to-paid, 60% retained). Source: https://www.innertrends.com/blog/saas-free-trial-benchmarks . The figures are the author's "ideal" benchmarks, not measured results, so treat them as a direction, not a target. The Australian Act will require reminders before a free trial ends, so building them in early avoids a rush later. Source: https://www.claytonutz.com/insights/2026/october/dark-patterns-drip-pricing-and-dodgy-subscriptions-australia-s-new-unfair-trading-practices-act-explained
- Titan Zero: keep the free plugin no-card. If a paid Assistant or Agent Team trial is added, it must send a reminder before the trial ends. Write the reminder into the sign-up flow issue, not as a later task.

### 8. Offer fewer plan choices, name who each plan is for, and mark one recommended plan

- Reason: too many options slow the decision. Naming the buyer for each plan helps people pick without comparing every feature.
- Evidence: Smashing Magazine advises keeping pricing simple, grouping or limiting plans when there are many, and naming plans by who they suit. Source: https://smashingmagazine.com/2022/07/designing-better-pricing-page . It also advises showing billing options and savings clearly, and keeping plan headers and the billing toggle visible while scrolling. Monetizely summarises the common advice to highlight one plan and keep to three or four tiers, but its stats come from secondary sources and are not checked here. Source: https://www.getmonetizely.com/articles/building-a-high-converting-pricing-page-best-practices-for-packages-and-layout . Tradify lists three per-user tiers and a free trial without a card. Source: https://www.capterra.com/p/152413/Tradify/pricing/
- Titan Zero: the pricing page has many prices (for example A$49, A$59, A$89, A$99, A$129, A$179, A$299) across a calculator. Put a three-line summary at the top: Free, Assistant, Agent Team, each with the buyer it suits. Keep the calculator below it. Mark one option as recommended.

### 9. Keep sign-up and enquiry forms short, and do not force an account too early

- Reason: each extra field and each early barrier loses people. Asking for an account before someone has what they came for is a common reason to leave.
- Evidence: Baymard's checkout research (ecommerce, so apply with care) says the average checkout has about 20 form fields, while an optimised one can be about 12. It also reports that 18% of surveyed US adults abandoned an order in the previous three months because they had to create an account, and advises delaying account creation until after the main step. Source: https://baymard.com/learn/checkout-flow-ux-optimization
- Titan Zero: the free plugin and the sign-up flow should ask only for what is needed to send the download or book a visit. Ask for a phone number and address only where a job needs them. Let people send an enquiry without creating an account, and offer the account after the enquiry is sent.

### 10. Make forms accessible, with visible labels and clear error messages

- Reason: clear forms work better for everyone, including people using a phone outdoors, a screen reader, a keyboard, or large text. Clear errors stop people giving up.
- Evidence: web.dev's accessibility guide advises keeping labels visible and linked to their fields, marking required fields in the label text, and giving error messages that name the field, describe the problem in words and suggest a fix. Source: https://web.dev/learn/accessibility/forms
- Titan Zero: check the booking, enquiry and sign-up forms on the site against this list. Each field needs a visible label, required fields need "(required)" in the label text, and each error should name the field and give a fix in words. Do not rely on colour alone.

## Summary of what changes

1. Full price and fees beside each headline price.
2. Billing, renewal and cancellation steps stated before sign-up.
3. Plain, outcome-led button labels.
4. Exact free-plan limits.
5. Clear upgrade trigger and grace period.
6. Free plugin kept fully useful, with no trial framing.
7. No-card start, and reminders before any trial ends.
8. Three plan summary at the top of pricing, with a recommended plan.
9. Shorter forms, account creation after the first step.
10. Accessible forms and specific error messages.

## Limits of this research

- Several sources are vendor blogs or secondary articles. Those figures are marked and should not be quoted as measured results.
- The Baymard figures are for ecommerce checkout, not for SaaS sign-up.
- The Australian Act is described by a law firm summary. This note is not legal advice, and the wording of the Act should be checked before any compliance claim is made.
- The Fresha and Calendly pricing pages could not be fetched, so they are not used.
