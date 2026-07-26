# Email sender authentication audit

Date: 2026-07-26
Domain: `thelabgroup.com`
Method: public DNS lookups against `8.8.8.8` (Google) and `1.1.1.1` (Cloudflare).
Everything here is readable by anyone; nothing below required account access.

---

## Headline

- Outbound mail from the domain is **fine** — DKIM is valid, so legitimate mail
  authenticates despite the broken SPF.
- Spoofing protection is **doing nothing**. SPF is inert (points at a record
  that no longer exists), and DMARC is set to monitor-only. Anyone can send mail
  as `@thelabgroup.com` today with no obstacle from either mechanism.
- The fix is one DNS record. Evidence says it is safe to apply; the DMARC
  reports (see step 1) would make it certain.

---

## Background: the three mechanisms

Email lets any sender declare any "From" address, unverified — this is the flaw
all three mechanisms below exist to patch.

| | Purpose |
|---|---|
| **SPF** | Publishes which *servers* may send as the domain. Receivers check incoming mail against the list. |
| **DKIM** | Cryptographically *signs* each message, so tampering is detectable and the sending domain is provable. |
| **DMARC** | Ties the two together: tells receivers what to do when SPF and DKIM fail, and emails reports on who is sending as the domain. |

They layer. DMARC is the one that actually stops spoofing — but it only acts
when set to do so, and it depends on SPF and DKIM being sound first.

---

## What was found

### DNS is managed at Cloudflare

Nameservers: `bruce.ns.cloudflare.com`, `gracie.ns.cloudflare.com`.
All record changes below are made in the Cloudflare dashboard.

### SPF (apex) — broken

```
thelabgroup.com.  TXT  "v=spf1 include:dc-aa8e722993._spfm.thelabgroup.com ~all"
```

The record does not contain the list of allowed servers — it *points* at another
address (`include:`) where the list is supposed to live. That target does not
exist: NXDOMAIN from both `8.8.8.8` and `1.1.1.1`. Its parent
`_spfm.thelabgroup.com` is gone too.

Under [RFC 7208 §5.2](https://datatracker.ietf.org/doc/html/rfc7208#section-5.2)
an unresolvable `include:` is a **permerror** — a permanent failure. The record
authorises nothing.

The `_spfm` prefix is the signature of a hosted SPF-flattening service (the kind
that maintains the real list on their own subdomain so you never edit your DNS).
When such a subscription lapses, their subdomain disappears and the apex record
is left pointing into a void. That is the most likely cause here.

### SPF (mail subdomain) — working, and shows the intended fix

```
mail.thelabgroup.com.  TXT  "v=spf1 include:_spf.google.com ~all"
```

This subdomain publishes exactly the record the apex domain needs. Someone
configured `mail.` correctly; the apex went through the flattening service that
has since lapsed.

### DKIM — working

```
google._domainkey.thelabgroup.com  TXT  "v=DKIM1; k=rsa; p=MIIBIjAN...(410 chars, valid)"
```

Valid Google Workspace signing key. This is why outbound mail still
authenticates — DMARC can pass on DKIM alone even with SPF broken.

A scan of 28 provider selectors (Microsoft 365, Mailchimp, SendGrid, Klaviyo,
HubSpot, Mailgun, Postmark, Brevo, Zoho, Freshdesk, Resend and others) found
**only the Google selector**.

### DMARC — present, monitor-only

```
_dmarc.thelabgroup.com  TXT  "v=DMARC1; p=none; rua=mailto:postmaster@thelabgroup.com"
```

- `p=none` — take no action against mail that fails checks (monitor only).
- `rua=mailto:postmaster@thelabgroup.com` — aggregate reports are sent here.
  If that mailbox exists and has been collecting, it is a definitive record of
  every system sending as the domain (see step 1 below).

### MX — Google Workspace

All five MX records are Google (`aspmx.l.google.com` and four `alt*`). Confirms
the domain receives mail through Google Workspace.

---

## Sender inventory

**Conclusion: Google Workspace is the only system sending as `@thelabgroup.com`.**

Basis:
- Only one DKIM selector exists, and it is Google's.
- No email-service-provider subdomains resolve (probed 30 common names).
- No third-party sender records in the apex TXT (the two
  `google-site-verification=...` entries are Search Console tokens, not senders).

This inventory is what makes the SPF fix safe: the replacement record authorises
Google, and nothing else needs authorising. It should be confirmed against the
DMARC reports before tightening DMARC to an enforcing policy.

---

## Why mail is not being junked today

- **Legitimate mail** is DKIM-signed; the signature validates and aligns, so
  DMARC passes on DKIM alone. The broken SPF does not sink it.
- **Spoofed mail** has no valid DKIM signature and hits the SPF permerror, so
  DMARC fails — but `p=none` tells receivers to deliver it anyway.

Net: outbound is fine; spoofing protection is inert.

---

## Fix — in order

### Step 1 — check for DMARC reports (before changing anything)

Look in `postmaster@thelabgroup.com` for XML report attachments from Google,
Microsoft and others. If present, they confirm the sender inventory outright.
Raw XML is not human-readable — use a free viewer (e.g. dmarcian) or hand one to
the assistant to summarise.

### Step 2 — repair SPF

Cloudflare → DNS → the `thelabgroup.com` TXT record beginning `v=spf1`. Replace
its contents with:

```
v=spf1 include:_spf.google.com ~all
```

Leave everything else untouched — in particular the two
`google-site-verification` TXT records, which are unrelated. Propagation on
Cloudflare is minutes. `~all` (softfail) is correct while confirming; do not use
`-all` (hardfail) yet.

### Step 3 — later, tighten DMARC

After SPF has been clean for a few weeks and reports show only Google, raise the
policy in stages: `p=none` -> `p=quarantine` -> `p=reject`. This is the step
that actually stops spoofing. It needs report data behind it and must not be
rushed.

---

## What the assistant cannot do here

DNS changes require Cloudflare account access, which the assistant does not have,
and this is a change worth watching mail flow after. The exact record to publish
is in step 2. To confirm the sender inventory beyond the DNS evidence above,
forward a DMARC report and the assistant will read it.

Note: the domain's public site DNS is a separate question from this — see
[domain-cutover.md](domain-cutover.md) section 3, which references this audit.
