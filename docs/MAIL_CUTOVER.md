# Mail Domain Cutover Plan: @houseworks.app

## Objective
Migrate all production communication and identity references from the old domain (or local placeholders) to the official `@houseworks.app` domain.

## Pre-Cutover Checklist
- [ ] Verify DNS records (MX, SPF, DKIM, DMARC) for `houseworks.app` are correctly configured.
- [ ] Confirm access to the mail provider admin console (e.g., Google Workspace, Microsoft 365, or Postmark).
- [ ] Audit all environment variables for any hardcoded domain references.
- [ ] Ensure `NEXTAUTH_URL` or equivalent auth base URLs are updated in production.

## Cutover Steps
1. **Update Environment Variables**: Update `MAIL_FROM`, `SUPPORT_EMAIL`, etc., in the production environment.
2. **Database Migration**: (If applicable) Update production user emails if they use the old domain.
3. **External Services**: Update Reply-To addresses in CRM, Helpdesk, and Transactional Mail services.
4. **Auth Configuration**: Update OAuth redirect URIs in Google/GitHub/etc. developer consoles to match the new domain.

## Validation Checklist
- [ ] **Transactional Mail**: Send a test "Sign In" email. Verify it arrives from `@houseworks.app`.
- [ ] **Email Authentication**: Check headers of received email for SPF/DKIM/DMARC pass status.
- [ ] **Password Reset**: Verify password reset flow works with the new domain.
- [ ] **Inbound Routing**: Verify that emails sent to `support@houseworks.app` are correctly routed/received.
- [ ] **Brand Consistency**: Check that footer links and "from" names are updated in all templates.

## Rollback Plan
- Revert environment variables to previous domain.
- Keep old domain MX records active as secondary/alias if possible during transition.

---

## Readiness State (as of 2026-02-15)

| Item | Status | Notes |
|------|--------|-------|
| `houseworks.app` DNS | ❌ NXDOMAIN | Domain not registered / no DNS records |
| SPF/DKIM/DMARC | ❌ Not configured | Blocked by domain status |
| `RESEND_API_KEY` | ❌ Placeholder | `.env` contains `re_replace_me` |
| Code sender address | ✅ Ready | `src/server/auth.ts` has graceful `resendEnabled` check |
| Cutover plan documented | ✅ Complete | This file |
| Dev credential migration | ✅ Complete | All `@houseworks.local` references migrated |

**Overall: ❌ NOT READY for cutover.** Blocked on domain registration and API key provisioning.
