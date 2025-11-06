# Quick Answers for Security Questionnaires and Onboarding Forms

This document contains copy-paste ready answers for common security and compliance questions.

---

## Question: "Does your organization have a defined and enforced data deletion and retention policy that is in compliance with applicable data privacy laws?"

**Answer:** YES

**Detailed Response:**

ShoutOut maintains a comprehensive Data Retention and Deletion Policy (Version 1.0, effective November 6, 2025) that defines specific retention periods for all data categories and ensures compliance with GDPR, CCPA, VCDPA, and other applicable privacy laws. 

Key features:
- Specific retention periods defined for all data types (user accounts, financial records, video content, logs, etc.)
- Automated enforcement through scheduled deletion jobs (daily, weekly, monthly)
- User rights fully supported (access, deletion, portability, rectification)
- Financial transaction records retained 7 years per IRS requirements
- Bank account data deleted within 24 hours of account closure
- Active account data deleted 37 days after user request (7-day cooling off + 30-day grace period)

The full policy document is available in our repository at DATA_RETENTION_POLICY.md.

---

## Question: "Is this policy reviewed periodically?"

**Answer:** YES - Annually

**Detailed Response:**

ShoutOut's Data Retention and Deletion Policy is reviewed annually every November by our Privacy Officer, Legal Counsel, and Executive Management team. 

Review process includes:
- Assessment of compliance with current privacy laws
- Evaluation of operational effectiveness
- Incorporation of user feedback and regulatory guidance
- Updates to reflect platform changes
- Documentation of all changes with version history

The policy is also reviewed on an ad-hoc basis when:
- New privacy legislation is enacted
- Significant platform functionality changes occur
- Data breaches or security incidents happen
- Regulatory guidance or user feedback requires updates

**Last Review:** November 6, 2025  
**Next Scheduled Review:** November 6, 2026  
**Documentation:** All policy versions and review records archived for 10 years

Users are notified of material policy changes with 30-day advance notice via email, ensuring transparency and compliance with notice requirements under GDPR and CCPA.

---

## Question: "Does your organization encrypt data in-transit between clients and servers using TLS 1.2 or better?"

**Answer:** YES

**Detailed Response:**

ShoutOut encrypts all data in transit using TLS 1.2 or higher:

- **Web Application:** HTTPS enforced on all connections via Railway deployment platform with automatic SSL certificate management
- **Database:** Supabase PostgreSQL connections use TLS 1.3
- **Object Storage:** Wasabi S3 connections require TLS 1.2+
- **CDN:** Cloudflare CDN enforces TLS 1.2+ for all content delivery
- **Payment Processing:** LunarPay/Fortis APIs require TLS 1.2+ (PCI DSS compliant)
- **Bank Verification:** Moov API uses TLS 1.3

All third-party integrations are required to support TLS 1.2 or higher, and legacy SSL protocols (SSL 2.0, SSL 3.0, TLS 1.0, TLS 1.1) are explicitly disabled.

---

## Question: "Does your organization encrypt consumer data at-rest?"

**Answer:** YES

**Detailed Response:**

ShoutOut implements multiple layers of encryption for data at rest:

**Database Encryption:**
- Supabase PostgreSQL: AES-256 encryption at rest (managed by Supabase/AWS)
- Row Level Security (RLS) policies enforce access controls at database level

**Sensitive Financial Data:**
- Bank account numbers: AES-256-GCM encryption with unique IV per record
- Routing numbers: AES-256-GCM encryption with unique IV per record
- Encryption keys stored separately from encrypted data in secure environment variables
- Decryption only permitted for payout processing operations
- All bank data displayed with masking (e.g., ****1234)

**File Storage:**
- Wasabi S3: Server-side encryption enabled for all video and media files
- Video content encrypted at rest using AES-256

**Payment Card Data:**
- NOT STORED - All payment card information is processed by PCI DSS Level 1 compliant payment processors (Fortis/LunarPay)
- ShoutOut never receives or stores full credit card numbers

**Backups:**
- Database backups encrypted using AES-256
- 30-day rolling backup retention with encrypted storage

---

## Question: "What access controls does your organization have in place?"

**Answer:** Multiple layers

**Detailed Response:**

ShoutOut implements comprehensive access controls:

**1. Authentication:**
- Email/password authentication via Supabase Auth
- Multi-Factor Authentication (MFA) REQUIRED for all talent accounts using TOTP
- JWT token-based session management
- Session timeout after inactivity

**2. Role-Based Access Control (RBAC):**
- Three distinct roles: User (customer), Talent (creator), Admin
- Role-specific dashboards and permissions
- Enforced at application and database levels

**3. Database Row Level Security (RLS):**
- PostgreSQL RLS policies on all tables
- Users can only access their own data (auth.uid() = user_id)
- Talent can only view assigned orders
- Admins have full access with audit logging

**4. API Authentication:**
- OAuth tokens for third-party integrations
- API keys stored in environment variables (never in code)
- TLS certificates for all external communications

**5. Documented Access Control Policy:**
- Formal policy defines roles, responsibilities, and procedures
- Available in ACCESS_CONTROL_POLICY.md

**6. Centralized Identity Management:**
- Supabase Auth as centralized identity provider
- Single authentication context across application

---

## Question: "Does your organization have a privacy policy?"

**Answer:** YES

**Location:** Available at `/privacy-policy` route in the application

**Detailed Response:**

ShoutOut maintains a comprehensive Privacy Policy that covers:
- Information collection practices
- How data is used and processed
- Data sharing with third parties (talent, payment processors, service providers)
- Security measures implemented
- User rights (access, deletion, correction, portability, opt-out)
- Cookie and tracking technologies
- Contact information for privacy inquiries (privacy@shoutout.us)

The privacy policy is:
- Displayed during signup process with required acceptance
- Accessible at all times via footer link
- Written in plain language for user comprehension
- Updated with user notification when material changes occur
- Compliant with GDPR, CCPA, and other applicable privacy laws

---

## Question: "Does your organization obtain consent from consumers for data collection?"

**Answer:** YES

**Detailed Response:**

ShoutOut obtains user consent through multiple mechanisms:

**Account Creation:**
- Users must accept Terms of Service and Privacy Policy during signup
- Explicit checkbox required (not pre-checked)
- Clear language explaining what data is collected and why

**Specific Consents:**
- Bank account information: Explicit consent during talent onboarding with purpose explanation
- Marketing communications: Opt-in required, can unsubscribe anytime
- Video content use: Talent consent to public profile display
- Social media integration: OAuth consent flow for Instagram/Facebook connections

**Consent Management:**
- Consent timestamps recorded in database
- Users can withdraw consent at any time via account settings
- Consent withdrawal processed immediately
- Granular consent controls for different data processing purposes

**Compliance:**
- GDPR consent requirements: Freely given, specific, informed, unambiguous
- CCPA notice at collection requirements met
- Cookie consent banner for tracking technologies (when implemented)

---

## Question: "Do you actively perform vulnerability scans?"

**Answer:** PARTIAL - Managed Infrastructure with Dependency Scanning

**Detailed Response:**

ShoutOut's security posture includes:

**What We Have:**
- Dependency vulnerability scanning via npm audit (can be automated via GitHub Dependabot)
- Railway platform handles infrastructure security patches automatically
- Supabase manages database security and patching
- Code security through TypeScript type checking and linting
- Third-party security handled by PCI-compliant payment processors

**Infrastructure Security:**
- Railway: Automatic OS and container security updates
- Supabase: Managed database with automatic security patches
- Cloudflare: DDoS protection and Web Application Firewall (WAF)

**Recommendations for Full Compliance:**
- Implement automated dependency scanning (GitHub Dependabot or Snyk)
- Schedule quarterly penetration testing
- Add endpoint detection and response (EDR) for employee devices
- Implement automated SAST/DAST scanning in CI/CD pipeline

**Current Status:** Infrastructure security managed by trusted vendors; application-level scanning can be enhanced with automated tools.

---

## Question: "Who can access production data?"

**Answer:** Restricted by Role

**Detailed Response:**

Access to production data is strictly controlled:

**Customer Support:**
- View customer profiles and order details for support purposes
- Cannot modify or delete data
- MFA required for access

**Talent Management:**
- View talent profiles for moderation
- Can activate/deactivate profiles
- Cannot access customer financial data

**Finance Team:**
- Access transaction records for reconciliation
- Process payouts to talent
- Cannot access customer passwords or full payment card data

**Engineering:**
- Database access for maintenance (read-only production)
- All access logged and audited
- MFA required

**Executive/Admin:**
- Full platform access for oversight
- All actions logged
- MFA required

**Access Revocation:**
- All credentials revoked within 24 hours of employee termination
- Quarterly access reviews conducted
- Principle of least privilege enforced

---

## Question: "What is your incident response process?"

**Answer:** Defined Five-Step Process

**Detailed Response:**

ShoutOut follows a structured incident response process:

**1. Detection:**
- Automated alerts for suspicious activity
- Employee training to recognize security incidents
- User reports via security@shoutout.us

**2. Containment:**
- Immediate account suspension if compromise suspected
- Isolation of affected systems
- Access revocation for compromised credentials

**3. Investigation:**
- Review of access logs and activity patterns
- Forensic analysis of affected data
- Root cause identification

**4. Remediation:**
- Password resets for affected accounts
- Encryption key rotation if necessary
- Security patch deployment
- Access control updates

**5. Communication:**
- Users notified within 72 hours per GDPR requirements
- Breach notification to state authorities per CCPA and state laws
- Transparent communication about incident and remediation steps

**Post-Incident:**
- Incident report documented with timeline
- Policy and procedure updates
- Additional training for staff
- Security enhancements implemented

---

## Question: "Are you PCI DSS compliant?"

**Answer:** YES - Via Qualified Service Providers

**Detailed Response:**

ShoutOut achieves PCI DSS compliance through qualified payment processors:

**Payment Processing:**
- LunarPay/Fortis: PCI DSS Level 1 Service Provider
- All payment card data processed through PCI-compliant iframe (Commerce.js)
- ShoutOut NEVER receives or stores full credit card numbers

**ShoutOut's Role:**
- SAQ-A (Self-Assessment Questionnaire A) applicable
- Minimal PCI scope - card data never touches our servers
- HTTPS/TLS enforced for all connections
- Secure tokenization for stored payment methods

**Compliance Evidence:**
- Data Processing Agreements (DPAs) with all payment processors
- Annual SAQ-A completion
- Network security controls documented
- Access control policies enforced

**Bank Account Data:**
- Stored with AES-256-GCM encryption
- Not subject to PCI DSS (different compliance requirements)
- Handled per FinCEN and banking regulations

---

## Contact Information for Verification

**Privacy & Data Protection:**  
Email: privacy@shoutout.us

**Security Incidents:**  
Email: security@shoutout.us

**Legal & Compliance:**  
Email: legal@shoutout.us

**General Support:**  
Email: support@shoutout.us

---

## Policy Documentation Links

All policies are available in our GitHub repository:

- **Data Retention Policy:** [DATA_RETENTION_POLICY.md](./DATA_RETENTION_POLICY.md)
- **Data Retention Summary:** [DATA_RETENTION_POLICY_SUMMARY.md](./DATA_RETENTION_POLICY_SUMMARY.md)
- **Access Control Policy:** [ACCESS_CONTROL_POLICY.md](./ACCESS_CONTROL_POLICY.md) *(previously provided)*
- **Bank Security:** [BANK_SECURITY.md](./BANK_SECURITY.md)
- **MFA Implementation:** [MFA_IMPLEMENTATION.md](./MFA_IMPLEMENTATION.md)
- **Payment Flow:** [PAYMENT_FLOW.md](./PAYMENT_FLOW.md)

---

**Last Updated:** November 6, 2025  
**Document Version:** 1.0

---

## Attestation Statement (Copy-Paste for Forms)

> ShoutOut Inc. maintains comprehensive security, privacy, and data protection policies that comply with GDPR, CCPA, PCI DSS, and other applicable regulations. Our data retention policy defines specific retention periods for all data types and is reviewed annually. We implement industry-standard encryption (TLS 1.2+ for data in transit, AES-256 for data at rest), role-based access controls, multi-factor authentication for privileged accounts, and automated security monitoring. All policies are documented, enforced through technical controls, and regularly audited. Full policy documentation is available upon request.

---

