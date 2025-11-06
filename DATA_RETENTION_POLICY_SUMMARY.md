# ShoutOut Data Retention and Deletion Policy - Summary for Onboarding

**Version:** 1.0  
**Effective Date:** November 6, 2025  
**Last Reviewed:** November 6, 2025  
**Next Review:** November 6, 2026  
**Full Policy:** [DATA_RETENTION_POLICY.md](./DATA_RETENTION_POLICY.md)

---

## Copy-Paste Summary for Questionnaires

### Does your organization have a defined and enforced data deletion and retention policy?

**YES**

ShoutOut maintains a comprehensive Data Retention and Deletion Policy that:
- Defines specific retention periods for all data categories
- Complies with GDPR, CCPA, VCDPA, and other applicable privacy laws
- Is reviewed annually (every November)
- Is enforced through automated deletion processes and manual verification

---

## Key Retention Periods

| Data Category | Retention Period | Deletion Trigger |
|---------------|------------------|------------------|
| **Active User Accounts** | Lifetime of active account | User-initiated deletion or 3 years inactivity |
| **Deleted Account Data** | 30 days (recovery grace period) | Permanent deletion after 30 days |
| **Financial Transaction Records** | 7 years | IRS/tax compliance requirements |
| **Bank Account Information** | While account is active | Deleted within 24 hours of account closure |
| **Video Content** | While account is active + 90 days | Deleted from all systems after 90 days |
| **Order Data** | While account is active + 90 days | Anonymized after account deletion |
| **System Logs** | 90 days | Rolling deletion |
| **Backup Data** | 30 days (rolling backups) | Automatic expiration |
| **Communication Records** | 3 years from closure | Permanent deletion or anonymization |

---

## Compliance Framework

**This policy ensures compliance with:**

✅ **GDPR (EU)** - General Data Protection Regulation  
✅ **CCPA (California)** - California Consumer Privacy Act  
✅ **VCDPA (Virginia)** - Virginia Consumer Data Protection Act  
✅ **CPA (Colorado)** - Colorado Privacy Act  
✅ **CTDPA (Connecticut)** - Connecticut Data Privacy Act  
✅ **UCPA (Utah)** - Utah Consumer Privacy Act  
✅ **IRS 26 USC § 6001** - Tax record retention (7 years)  
✅ **PCI DSS** - Payment Card Industry Data Security Standard  
✅ **FinCEN** - Financial Crimes Enforcement Network requirements

---

## User Rights Honored

Under this policy, users have the right to:

1. **Access** - Request a copy of their personal data (30-day response)
2. **Rectification** - Correct inaccurate data (immediate via account settings)
3. **Erasure** - Delete their account and data (37-day process with grace period)
4. **Portability** - Export data in machine-readable format (JSON/CSV)
5. **Object** - Opt-out of marketing and certain processing activities
6. **Restrict** - Temporarily limit processing during disputes
7. **Withdraw Consent** - Revoke consent for optional features

**Contact for Requests:** privacy@shoutout.us

---

## Periodic Review Process

**Annual Review Schedule:**
- **When:** Every November
- **Who:** Privacy Officer, Legal Counsel, Executive Management
- **What:** Review policy against current laws, operational practices, and user feedback

**Triggered Reviews (Ad-Hoc):**
- New privacy legislation enacted
- Significant platform changes
- Data breach or security incident
- User complaints or regulatory guidance
- Corporate restructuring

**Update Process:**
1. Legal review for compliance
2. Privacy officer assesses operational alignment
3. Executive approval
4. User notification (30-day notice for material changes)
5. Policy published with version history

**Documentation:**
- All policy versions archived for 10 years
- Review meeting minutes retained
- Change log maintained

---

## Enforcement Mechanisms

**Automated Processes:**
- Daily scheduled job deletes data exceeding retention periods
- Weekly job anonymizes transaction records for deleted accounts
- Monthly job purges expired backups
- Automated inactive account detection (36-month threshold)

**Manual Verification:**
- Quarterly audits of deletion procedures
- Annual compliance reviews
- Employee access logs monitored
- Vendor compliance assessments

**Accountability:**
- Data Protection Officer designated: privacy@shoutout.us
- Records of Processing Activities (ROPA) maintained
- Data Protection Impact Assessments (DPIA) conducted for high-risk processing
- Audit trail retained for 3 years

---

## Third-Party Compliance

All vendors are required to:
- Sign Data Processing Agreements (DPAs)
- Align retention policies with ShoutOut's policies
- Demonstrate adequate security measures
- Submit to annual compliance reviews

**Current Vendors:**
- Supabase (database) - GDPR compliant, DPA ✅
- Wasabi (storage) - Data deleted within 24 hours, DPA ✅
- LunarPay/Fortis (payments) - PCI DSS Level 1, DPA ✅
- Moov (bank verification) - Financial institution standards, DPA ✅
- Cloudflare (CDN) - GDPR compliant, DPA ✅

---

## Copy-Paste Statement for "Is this policy reviewed periodically?"

**YES - Annual Review**

ShoutOut's Data Retention and Deletion Policy is reviewed annually every November by our Privacy Officer, Legal Counsel, and Executive Management. The policy is also reviewed on an ad-hoc basis when:
- New privacy legislation is enacted
- Significant changes are made to platform functionality
- Data breaches or security incidents occur
- User feedback or regulatory guidance requires updates

The last review was completed on November 6, 2025, and the next scheduled review is November 6, 2026. All policy versions and review documentation are archived for 10 years. Users are notified of material changes with 30-day advance notice via email.

---

## Quick Reference: Data Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ USER CREATES ACCOUNT                                         │
│ ↓                                                            │
│ DATA COLLECTED & STORED (encrypted, access-controlled)      │
│ ↓                                                            │
│ ACTIVE USE (full access while account active)               │
│ ↓                                                            │
│ INACTIVITY (36 months) → Warnings sent → Auto-deactivation  │
│   OR                                                         │
│ USER REQUESTS DELETION                                       │
│ ↓                                                            │
│ 7-DAY COOLING OFF PERIOD (can cancel)                       │
│ ↓                                                            │
│ 30-DAY GRACE PERIOD (account can be recovered)              │
│ ↓                                                            │
│ PERMANENT DELETION (all systems + backups)                  │
│ ↓                                                            │
│ EXCEPTION: Financial records anonymized & retained 7 years  │
└─────────────────────────────────────────────────────────────┘
```

---

## Contact Information

**For Privacy Requests:**  
Email: privacy@shoutout.us  
Response Time: Acknowledged within 5 business days, resolved within 30 days

**For General Inquiries:**  
Email: support@shoutout.us  
Website: https://shoutout.us/data-retention-policy

**For Legal Matters:**  
Email: legal@shoutout.us

---

## Attestation for Onboarding Forms

> "ShoutOut Inc. maintains a comprehensive Data Retention and Deletion Policy effective November 6, 2025, that defines specific retention periods for all data categories and ensures compliance with GDPR, CCPA, and other applicable privacy laws. This policy is reviewed annually (next review: November 6, 2026) and enforced through automated deletion processes, manual audits, and third-party vendor compliance requirements. The full policy is available at [link] and documented in DATA_RETENTION_POLICY.md."

---

**Document Owner:** Privacy & Compliance Officer  
**Approved By:** Legal Counsel & Executive Management  
**Effective Date:** November 6, 2025

