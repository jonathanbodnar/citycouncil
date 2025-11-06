# ShoutOut Compliance Quick Reference

**One-Page Overview for Security Questionnaires**

---

## ✅ Data Retention & Deletion Policy

| Status | Details |
|--------|---------|
| **Documented** | ✅ YES - Comprehensive 19-section policy |
| **Enforced** | ✅ YES - Automated + manual processes |
| **Compliant** | ✅ GDPR, CCPA, VCDPA, IRS, PCI DSS |
| **Reviewed** | ✅ Annually (November) + ad-hoc triggers |
| **Last Review** | November 6, 2025 |
| **Next Review** | November 6, 2026 |
| **Document** | [DATA_RETENTION_POLICY.md](./DATA_RETENTION_POLICY.md) |

---

## 📊 Key Retention Periods

| Data Type | Period | Reason |
|-----------|--------|--------|
| Active accounts | Account lifetime | Service delivery |
| Deleted accounts | 30 days | Grace period |
| Financial records | 7 years | IRS/tax law |
| Bank accounts | Until closure + 0 days | Security |
| Videos | Account lifetime + 90 days | Service delivery |
| System logs | 90 days | Security monitoring |
| Backups | 30 days (rolling) | Disaster recovery |

---

## 🔐 Encryption Standards

| Layer | Standard | Status |
|-------|----------|--------|
| **In Transit** | TLS 1.2+ | ✅ Enforced |
| **At Rest (DB)** | AES-256 | ✅ Supabase managed |
| **Bank Data** | AES-256-GCM | ✅ Custom encryption |
| **Files** | AES-256 | ✅ Wasabi S3 |
| **Backups** | AES-256 | ✅ Encrypted |
| **Payment Cards** | N/A | ✅ Never stored |

---

## 👥 Access Controls

| Control Type | Implementation | Status |
|--------------|----------------|--------|
| Authentication | Supabase Auth + JWT | ✅ |
| MFA | TOTP (required for talent) | ✅ |
| RBAC | User/Talent/Admin roles | ✅ |
| Database RLS | PostgreSQL policies | ✅ |
| API Auth | OAuth + API keys | ✅ |
| Policy Doc | Formal access policy | ✅ |

---

## 📜 User Rights Supported

| Right | Response Time | Method |
|-------|---------------|--------|
| Access | 30 days | privacy@shoutout.us |
| Deletion | 37 days | Account settings |
| Rectification | Immediate | Account settings |
| Portability | 30 days | JSON/CSV export |
| Objection | Immediate | Opt-out links |
| Restrict | 30 days | privacy@shoutout.us |

---

## ⚖️ Compliance Framework

### Laws & Regulations
✅ GDPR (EU)  
✅ CCPA (California)  
✅ VCDPA (Virginia)  
✅ CPA (Colorado)  
✅ CTDPA (Connecticut)  
✅ UCPA (Utah)  
✅ IRS 26 USC § 6001  
✅ PCI DSS  
✅ FinCEN/AML

### Standards
✅ ISO 27001 principles  
✅ SOC 2 Type II principles  
✅ NIST SP 800-88 (data deletion)  
✅ OWASP security practices

---

## 🔄 Policy Review Process

**Annual Review (Every November)**
1. Legal counsel reviews compliance
2. Privacy officer assesses operations
3. Executive management approves
4. Users notified (30-day notice)
5. Version archived (10-year retention)

**Triggered Reviews**
- New privacy laws
- Platform changes
- Security incidents
- User feedback
- Regulatory guidance

---

## 🛡️ Security Measures

### Technical Controls
- TLS 1.2+ encryption
- AES-256-GCM encryption
- Row Level Security (RLS)
- Multi-Factor Authentication
- Automated security logging
- Intrusion detection

### Administrative Controls
- Access control policy
- Data classification
- Employee training
- Vendor management
- Incident response plan
- Business continuity plan

### Physical Controls
- Managed by trusted vendors:
  - Railway (application hosting)
  - Supabase (database)
  - Wasabi (file storage)
  - Cloudflare (CDN)

---

## 📞 Contact Information

| Purpose | Email | Response Time |
|---------|-------|---------------|
| Privacy Requests | privacy@shoutout.us | 5 business days |
| Security Incidents | security@shoutout.us | Immediate |
| General Support | support@shoutout.us | 24-48 hours |
| Legal Matters | legal@shoutout.us | 5 business days |

---

## 📁 Documentation Index

| Document | Purpose | Location |
|----------|---------|----------|
| Data Retention Policy | Full policy details | [DATA_RETENTION_POLICY.md](./DATA_RETENTION_POLICY.md) |
| Retention Summary | Quick reference | [DATA_RETENTION_POLICY_SUMMARY.md](./DATA_RETENTION_POLICY_SUMMARY.md) |
| Onboarding Answers | Copy-paste responses | [ONBOARDING_ANSWERS.md](./ONBOARDING_ANSWERS.md) |
| Access Control Policy | Access management | Previously provided document |
| Bank Security | Encryption details | [BANK_SECURITY.md](./BANK_SECURITY.md) |
| MFA Implementation | Authentication | [MFA_IMPLEMENTATION.md](./MFA_IMPLEMENTATION.md) |
| Payment Flow | Payment security | [PAYMENT_FLOW.md](./PAYMENT_FLOW.md) |

---

## ✅ Quick Answers for Common Questions

### Does your org have a data retention policy?
**YES** - Comprehensive policy reviewed annually, enforced through automated processes, compliant with GDPR/CCPA/VCDPA and IRS requirements. See DATA_RETENTION_POLICY.md.

### Is it reviewed periodically?
**YES** - Annually every November by Privacy Officer, Legal Counsel, and Executive Management. Last review: Nov 6, 2025. Next: Nov 6, 2026.

### Do you encrypt data in transit?
**YES** - TLS 1.2+ enforced on all connections (web, API, database, storage, CDN). Legacy SSL protocols disabled.

### Do you encrypt data at rest?
**YES** - AES-256 encryption for database, files, and backups. Bank account data uses AES-256-GCM with unique IVs.

### Do you use Plaid API?
**NO** - We use Moov for bank account verification and LunarPay/Fortis for payments. No Plaid integration.

### Are you PCI DSS compliant?
**YES** - Via Level 1 payment processors (Fortis/LunarPay). SAQ-A applicable. Card data never touches our servers.

### Do you have vulnerability scanning?
**PARTIAL** - npm audit for dependencies, managed infrastructure security (Railway/Supabase), can add Dependabot/Snyk.

### Do you have a privacy policy?
**YES** - Available at /privacy-policy route, covers GDPR/CCPA requirements, includes user rights and contact info.

### Do you obtain user consent?
**YES** - Explicit consent during signup, granular controls for marketing/tracking, consent timestamps recorded.

### What access controls do you have?
**MULTIPLE** - Supabase Auth, MFA for talent, RBAC (3 roles), Database RLS, OAuth/API keys, documented policy.

---

## 🎯 For Onboarding Forms (Copy-Paste)

**Attestation:**
> ShoutOut Inc. maintains comprehensive security, privacy, and data protection policies compliant with GDPR, CCPA, PCI DSS, and applicable regulations. Our data retention policy defines specific retention periods for all data types, is reviewed annually (last: Nov 6, 2025; next: Nov 6, 2026), and enforced through automated deletion processes. We implement TLS 1.2+ encryption in transit, AES-256 at rest, role-based access controls, and multi-factor authentication. Full documentation available upon request.

---

**Version:** 1.0  
**Last Updated:** November 6, 2025  
**Valid Until:** November 6, 2026

---

*This document provides quick answers for security questionnaires and compliance verification. For detailed information, refer to the full policy documents listed above.*

