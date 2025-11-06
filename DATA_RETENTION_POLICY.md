# ShoutOut Data Retention and Deletion Policy

## Document Information
- **Organization**: ShoutOut
- **Effective Date**: November 6, 2025
- **Version**: 1.0
- **Last Reviewed**: November 6, 2025
- **Next Review Date**: November 6, 2026
- **Policy Owner**: Privacy & Compliance Officer
- **Approval Authority**: Legal Counsel & Executive Management

---

## 1. Purpose and Scope

### 1.1 Purpose
This Data Retention and Deletion Policy establishes guidelines for the collection, retention, and secure deletion of personal data processed by ShoutOut. This policy ensures compliance with applicable data privacy laws including:
- General Data Protection Regulation (GDPR) - EU
- California Consumer Privacy Act (CCPA) - California, USA
- Virginia Consumer Data Protection Act (VCDPA) - Virginia, USA
- Other applicable state and federal privacy regulations

### 1.2 Scope
This policy applies to all personal data collected, processed, and stored by ShoutOut, including:
- Customer data (users ordering video shoutouts)
- Talent data (content creators)
- Administrator data
- Transaction and payment records
- Video content and media files
- System logs and analytics data
- Backup and archived data

---

## 2. Legal Basis for Data Processing

ShoutOut processes personal data under the following legal bases:
- **Contractual Necessity**: To fulfill video shoutout orders and provide platform services
- **Consent**: For marketing communications and optional features
- **Legitimate Interest**: For fraud prevention, security, and platform improvement
- **Legal Obligation**: For tax reporting, financial record-keeping, and compliance

---

## 3. Data Categories and Retention Periods

### 3.1 Active User Account Data

**Data Types:**
- Full name, email address, phone number
- Account credentials (hashed passwords)
- Profile information and preferences
- Avatar/profile photos
- User type designation (User/Talent/Admin)

**Retention Period:** Retained for the lifetime of the active account

**Legal Basis:** Contractual necessity

**Deletion Trigger:** User initiates account deletion OR account remains inactive for 3+ years (see Section 3.2)

---

### 3.2 Inactive Account Data

**Definition:** Accounts with no login activity for 36 consecutive months

**Retention Period:** 
- **Months 0-36**: Account remains fully active
- **Month 36**: Email notification sent warning of pending deletion
- **Month 37**: Second warning email sent
- **Month 38**: Account automatically deactivated and queued for deletion
- **Month 39**: Permanent deletion executed (30-day grace period after deactivation)

**User Rights:** Users can reactivate their account at any time before permanent deletion by logging in

**Exception:** Accounts with active orders, open disputes, or legal holds are exempt from automatic deletion

---

### 3.3 Deleted Account Data

**Retention Period:** 30 days after deletion request

**Reason:** Allows for:
- Account recovery if user changes mind
- Completion of pending transactions
- Resolution of customer service issues
- Fraud investigation

**After 30 Days:** All personally identifiable information (PII) is permanently deleted from production systems

**Retained Data (Anonymized):**
- Transaction amounts and dates (PII removed)
- Aggregated analytics (no user identification possible)
- Legal records as required by law (see Section 3.5)

---

### 3.4 Order and Transaction Data

#### 3.4.1 Completed Orders

**Data Types:**
- Order details (request text, recipient information)
- Order status and fulfillment dates
- Video delivery records
- Customer communications

**Retention Period:** 
- **While Account Active**: Full order history retained
- **After Account Deletion**: 90 days, then permanently deleted
- **Exception**: Transaction financial records retained per Section 3.5

**Legal Basis:** Contractual necessity, customer service, dispute resolution

---

#### 3.4.2 Financial Transaction Records

**Data Types:**
- Payment amounts and dates
- Transaction IDs (Fortis/LunarPay/Moov references)
- Refund records
- Payout records to talent
- Platform fees collected

**Retention Period:** 7 years from transaction date

**Legal Basis:** Legal obligation (IRS tax requirements, anti-money laundering laws)

**Data Handling:**
- Personal identifiers (names, emails) anonymized after account deletion
- Only transaction metadata retained (amounts, dates, transaction IDs)
- Financial audit trail preserved for compliance

**Note:** This complies with IRS requirements (26 USC § 6001) and state tax laws

---

### 3.5 Payment Instrument Data

#### 3.5.1 Customer Payment Information

**Data Types:**
- Credit card information (NOT STORED - handled by Fortis/LunarPay)
- Payment method tokens
- Billing addresses

**Retention Period:** 
- **Tokens**: Retained while account is active OR until user removes payment method
- **Billing Address**: Same as account data (Section 3.1)

**Security:** ShoutOut never stores full credit card numbers. All payment card data is handled by PCI DSS Level 1 compliant payment processors (Fortis/LunarPay)

---

#### 3.5.2 Talent Bank Account Information

**Data Types:**
- Bank account numbers (encrypted with AES-256-GCM)
- Routing numbers (encrypted with AES-256-GCM)
- Account holder name
- Bank name and account type
- Moov account IDs

**Retention Period:** 
- **Active Account**: Retained in encrypted form while talent account is active
- **Account Deletion**: Immediately deleted upon account closure
- **Grace Period**: NONE - bank information is permanently deleted within 24 hours of account deletion

**Security Measures:**
- AES-256-GCM encryption at rest
- Masked display in all user interfaces
- Decryption only permitted for payout processing
- Encryption keys stored separately from data
- Access logs maintained for all decryption events

**Legal Basis:** Contractual necessity for payment processing

---

### 3.6 Video Content and Media Files

#### 3.6.1 Customer Ordered Videos (Completed)

**Data Types:**
- Personalized video shoutouts created by talent
- Video thumbnails
- Associated metadata

**Retention Period:**
- **Active Order**: Retained indefinitely while customer account is active
- **After Completion**: Customer can download/access for lifetime of account
- **After Account Deletion**: 90 days grace period, then permanently deleted from all storage

**Storage Location:** Wasabi S3 with Cloudflare CDN caching

**Deletion Process:**
1. Remove from Cloudflare CDN cache (immediate)
2. Delete from Wasabi S3 primary storage (within 24 hours)
3. Remove from all backup systems (within 30 days)

---

#### 3.6.2 Talent Sample Videos and Profile Media

**Data Types:**
- Profile videos showcasing talent
- Sample work videos
- Profile photos and banners
- Social media preview images

**Retention Period:**
- **Active Profile**: Retained while talent account is active and profile is public
- **Profile Deactivation**: Retained for 30 days (allow reactivation)
- **Account Deletion**: Deleted within 7 days of account deletion

**Public Display:** Sample videos remain publicly viewable while talent profile is active and set to public

---

#### 3.6.3 Pending/Incomplete Order Videos

**Data Types:**
- Work-in-progress videos
- Draft uploads by talent

**Retention Period:**
- **During Fulfillment Period**: Retained until order is marked complete or rejected
- **Rejected Orders**: Deleted within 7 days of rejection
- **Abandoned Orders**: Deleted 30 days after order expiration

---

### 3.7 Communication Records

#### 3.7.1 Customer Support Messages

**Data Types:**
- Help desk inquiries and responses
- Email communications
- Chat logs (if implemented)
- Support tickets

**Retention Period:** 3 years from ticket closure

**Reason:** Customer service quality assurance, dispute resolution, legal compliance

**After 3 Years:** Permanently deleted or anonymized for training purposes

---

#### 3.7.2 Marketing Communications

**Data Types:**
- Email addresses subscribed to marketing
- Communication preferences
- Email open/click tracking data

**Retention Period:**
- **Active Subscription**: Retained while user is subscribed
- **Unsubscribe**: Email removed from marketing lists immediately
- **Account Deletion**: All marketing data deleted within 7 days

**Legal Basis:** Consent (CAN-SPAM Act, GDPR consent requirements)

**Opt-Out:** Users can unsubscribe at any time via email links or account settings

---

### 3.8 System Logs and Analytics

#### 3.8.1 Application and Security Logs

**Data Types:**
- Authentication logs (login/logout events)
- Failed login attempts
- Session activity
- API access logs
- Error logs and system events

**Retention Period:** 90 days

**Reason:** Security monitoring, troubleshooting, fraud detection, intrusion detection

**After 90 Days:** 
- Logs are permanently deleted
- Summary statistics may be retained in anonymized form

---

#### 3.8.2 Analytics and Usage Data

**Data Types:**
- Page views and click events
- Feature usage statistics
- Performance metrics
- A/B test results

**Retention Period:** 
- **Raw Data**: 12 months
- **Aggregated/Anonymized Data**: Retained indefinitely

**Privacy Protection:**
- Analytics data is anonymized after 12 months
- No personal identifiers in aggregated reports
- Compliance with cookie consent preferences

---

### 3.9 Review and Rating Data

**Data Types:**
- Customer reviews of talent
- Star ratings
- Review timestamps
- Reviewer information

**Retention Period:**
- **While Accounts Active**: Retained and publicly displayed
- **Reviewer Account Deleted**: Review remains but is anonymized ("Anonymous User")
- **Talent Account Deleted**: All reviews associated with talent are deleted within 30 days

**Reason:** Reviews are considered public contributions to the platform community

**User Rights:** Users can delete their own reviews at any time via their account dashboard

---

### 3.10 Employment and Contractor Records (Internal)

**Data Types:**
- Employee/contractor personal information
- Employment contracts
- Background checks
- Performance records
- Access logs for admin users

**Retention Period:** 
- **Current Employees**: Retained during employment
- **Former Employees**: 7 years after termination
- **Contractors**: 7 years after contract end

**Legal Basis:** Legal obligation (employment law, tax law)

**Access:** Restricted to HR and authorized management only

---

### 3.11 Backup and Disaster Recovery Data

**Data Types:**
- Complete database backups
- File storage backups
- System configuration backups

**Retention Period:** Rolling 30-day backup window

**Backup Schedule:**
- Daily incremental backups (retained 7 days)
- Weekly full backups (retained 4 weeks)
- Monthly backups (retained 12 months for compliance purposes only)

**Deletion Policy:**
- Backups older than 30 days are permanently deleted
- Exception: Monthly compliance backups for financial records (7 years)

**Data in Backups:**
- Deleted user data remains in backups until backup expires
- Users are informed that deleted data persists in backups for up to 30 days
- Backup data is encrypted and access-controlled

---

## 4. Data Subject Rights

### 4.1 Right to Access
Users can request a copy of all personal data ShoutOut holds about them.

**Process:**
1. User submits request via email to privacy@shoutout.us or account settings
2. Identity verification required (email confirmation + account login)
3. Data provided within 30 days in structured, machine-readable format (JSON/CSV)

**No Fee:** Free for first request; reasonable fee may apply for excessive or repetitive requests

---

### 4.2 Right to Deletion (Right to be Forgotten)

Users can request immediate deletion of their account and personal data.

**Process:**
1. User initiates deletion via account settings or email request
2. Confirmation email sent with 7-day cooling-off period
3. After 7 days, account enters 30-day grace period (can be recovered)
4. After 37 days total, permanent deletion executed

**Exceptions (Deletion Cannot Be Completed):**
- Active orders in progress (must complete or refund first)
- Open disputes or chargebacks
- Legal holds or law enforcement requests
- Tax/financial records (retained 7 years, but PII anonymized)

**Notification:** User receives confirmation email when deletion is complete

---

### 4.3 Right to Rectification

Users can update or correct inaccurate personal data.

**Process:**
- Self-service via account settings for most data
- Contact support@shoutout.us for data not editable in settings
- Updates processed immediately

---

### 4.4 Right to Data Portability

Users can receive their data in portable format and request transfer to another service.

**Process:**
1. Request via privacy@shoutout.us
2. Data provided in JSON or CSV format within 30 days
3. Includes: Profile data, order history, reviews, uploaded content

---

### 4.5 Right to Object / Withdraw Consent

Users can object to certain data processing or withdraw consent.

**Examples:**
- Opt out of marketing emails (instant via unsubscribe link)
- Object to analytics tracking (via cookie preferences)
- Withdraw consent for optional features

**Effect:** Processing stops immediately upon request (except where legal obligation requires retention)

---

### 4.6 Right to Restrict Processing

Users can request temporary restriction of data processing in certain circumstances.

**Examples:**
- While disputing data accuracy
- During legal proceedings
- When challenging lawfulness of processing

**Process:** Submit request to privacy@shoutout.us with explanation

---

## 5. Data Deletion Procedures

### 5.1 Standard Deletion Process

**Automated Deletion (Scheduled Jobs):**
- Daily job removes data that has exceeded retention periods
- Weekly job anonymizes transaction records for deleted accounts
- Monthly job purges expired backups

**Manual Deletion (User-Initiated):**
1. User requests account deletion
2. System validates no active orders or open disputes
3. 7-day cooling off period begins
4. Confirmation email sent with cancellation option
5. 30-day grace period for account recovery
6. After 37 total days: Permanent deletion executed

---

### 5.2 Deletion Verification

**Steps:**
1. Remove from primary database (Supabase PostgreSQL)
2. Delete files from object storage (Wasabi S3)
3. Clear CDN cache (Cloudflare)
4. Invalidate all authentication tokens
5. Remove from search indexes
6. Notify third-party processors (Moov, LunarPay) to delete associated records

**Verification Log:**
- All deletions logged with timestamp and data types removed
- Deletion logs retained for 3 years for compliance purposes
- Regular audits verify deletion procedures are followed

---

### 5.3 Secure Deletion Standards

**Digital Data:**
- Database records: DELETE statement followed by VACUUM operation
- File storage: Overwrite with random data before deletion (per NIST SP 800-88)
- Encrypted data: Destroy encryption keys (cryptographic erasure)

**Backup Data:**
- Cannot be individually deleted from backups
- Backups expire per retention schedule (Section 3.11)
- Encryption keys for old backups are destroyed after backup expires

---

### 5.4 Third-Party Data Deletion

**Partners Required to Delete Data:**
- Moov (bank account verification) - deleted within 30 days of request
- LunarPay/Fortis (payment processing) - per their retention policies
- Wasabi (file storage) - deleted within 24 hours
- Cloudflare (CDN) - cache purged immediately

**Process:**
1. ShoutOut sends deletion request to partner via API
2. Partner confirms deletion within their retention windows
3. Confirmation logged in ShoutOut systems

---

## 6. Special Circumstances

### 6.1 Legal Holds and Litigation

**When Legal Hold Applies:**
- Active litigation involving ShoutOut
- Government investigation or subpoena
- Regulatory audit
- Law enforcement request with valid legal process

**Effect:**
- Normal deletion schedules are suspended for affected data
- Data is preserved in secure, immutable format
- Legal hold takes precedence over user deletion requests
- User is notified when legally permissible

**Duration:** Until legal matter is resolved and hold is lifted by legal counsel

---

### 6.2 Minor Users (Users Under 18)

**Special Protections:**
- Users under 13: Not permitted to create accounts (COPPA compliance)
- Users 13-17: Parental consent required (if implemented)
- Enhanced deletion rights for minor data

**Parental Rights:**
- Parents can request deletion of minor's data at any time
- Expedited deletion process (7 days total, no grace period)

---

### 6.3 Deceased Users

**Process:**
- Next of kin or estate executor can request account closure
- Verification required (death certificate, legal documentation)
- Account memorialized or deleted per family preference
- Data handling per normal deletion procedures

---

### 6.4 Data Breaches

**In Case of Data Breach:**
- Affected data retention period may be extended for forensic investigation
- Users notified per applicable breach notification laws
- Retention extension documented and time-limited
- Normal retention resumes after investigation concludes

---

## 7. Data Transfer and Storage Locations

### 7.1 Data Storage Locations

**Primary Systems:**
- **Database**: Supabase (AWS US-East-1 region, Virginia)
- **File Storage**: Wasabi S3 (US-Central-1 region)
- **CDN**: Cloudflare (global edge network)
- **Application**: Railway (US region)

**International Transfers:**
- Data may be accessed from EU/international locations via CDN
- Standard Contractual Clauses (SCCs) in place with all processors
- GDPR-compliant data transfer mechanisms utilized

---

### 7.2 Third-Party Processors

**Payment Processing:**
- LunarPay/Fortis: US-based, PCI DSS Level 1 compliant
- Data shared: Transaction amounts, customer name, email (minimum necessary)

**Bank Account Verification:**
- Moov: US-based, financial institution security standards
- Data shared: Bank account details (encrypted), talent identity information

**Email Communications:**
- Mailgun: US-based, GDPR compliant
- Data shared: Email addresses, message content

**Each processor has own retention policies; ShoutOut ensures compliance via Data Processing Agreements (DPAs)**

---

## 8. Compliance and Regulatory Framework

### 8.1 GDPR Compliance (EU Users)

**Lawful Basis:** Documented for each data processing activity

**Data Protection Officer (DPO):** privacy@shoutout.us

**EU Representative:** [To be appointed if processing significant EU data]

**Rights Honored:**
- Right to access, rectification, erasure, portability
- Right to object and restrict processing
- Right to withdraw consent
- Right to lodge complaint with supervisory authority

**Response Time:** 30 days for all requests (may extend to 60 days for complex requests)

---

### 8.2 CCPA Compliance (California Users)

**Consumer Rights:**
- Right to know what personal information is collected
- Right to know if personal information is sold or disclosed
- Right to opt-out of sale (Note: ShoutOut does NOT sell personal information)
- Right to deletion
- Right to non-discrimination for exercising rights

**Disclosure:** Annual privacy policy updates disclose data practices

**Verification:** Two-step verification for deletion requests

**Response Time:** 45 days (may extend to 90 days for complex requests)

---

### 8.3 Other State Privacy Laws

**Applicable Laws:**
- Virginia Consumer Data Protection Act (VCDPA)
- Colorado Privacy Act (CPA)
- Connecticut Data Privacy Act (CTDPA)
- Utah Consumer Privacy Act (UCPA)

**Compliance:** ShoutOut honors all applicable state privacy rights as outlined in this policy

---

### 8.4 Tax and Financial Compliance

**IRS Requirements (26 USC § 6001):**
- Transaction records retained 7 years
- Applies to all payments and payouts
- Includes Form 1099 reporting for talent earnings

**Anti-Money Laundering (AML):**
- Identity verification records retained per FinCEN requirements
- Suspicious activity reports (SARs) filed when required
- Records retained 5 years minimum

---

### 8.5 PCI DSS Compliance

**Payment Card Industry Standards:**
- ShoutOut is PCI DSS compliant by NOT storing payment card data
- All card data handled by Level 1 PCI compliant processors (Fortis/LunarPay)
- Annual Self-Assessment Questionnaire (SAQ-A) completed
- Network security and access controls maintained

---

## 9. Employee and Contractor Access

### 9.1 Access Controls

**Principle of Least Privilege:**
- Employees granted minimum access necessary for job function
- Role-based access control (RBAC) enforced
- Admin access requires multi-factor authentication (MFA)

**Access Levels:**
- **Customer Support**: View customer data, cannot delete
- **Talent Management**: View talent profiles, moderate content
- **Finance**: Access transaction records, process payouts
- **Engineering**: Database access for maintenance (logged and audited)
- **Executive**: Full access with oversight responsibilities

---

### 9.2 Employee Training

**Required Training:**
- Data privacy and security training for all employees (annually)
- GDPR/CCPA compliance training for customer-facing roles
- Incident response training for security team
- Secure data handling procedures

**Documentation:** Training completion records retained for 3 years

---

### 9.3 Access Termination

**Process When Employee Leaves:**
- All access credentials revoked within 24 hours of termination
- Multi-factor authentication tokens invalidated
- Personal devices wiped of company data
- Access logs reviewed for any suspicious activity during final 30 days

---

## 10. Policy Review and Updates

### 10.1 Review Schedule

**Annual Review:** November of each year

**Triggered Reviews:**
- Changes in applicable privacy laws
- Significant changes to platform functionality
- Data breaches or security incidents
- Corporate restructuring or acquisitions
- User feedback or regulatory guidance

---

### 10.2 Update Process

**Steps:**
1. Legal counsel reviews policy for compliance with current laws
2. Privacy officer assesses operational alignment
3. Executive management approves changes
4. Users notified of material changes via email
5. Updated policy posted with "Last Updated" date
6. 30-day notice period for material changes (where required by law)

**Version Control:** All policy versions archived for 10 years

---

### 10.3 Stakeholder Communication

**Internal:**
- All employees notified of policy changes
- Department-specific training updated
- Compliance checklists updated

**External:**
- Users notified via email of material changes
- Privacy policy page updated on website
- Partners/processors notified of relevant changes

---

## 11. User Notification and Transparency

### 11.1 Privacy Policy Publication

**Location:** 
- Website: shoutout.us/privacy-policy
- Mobile app: Settings > Privacy Policy
- During signup: Link provided and acceptance required

**Accessibility:**
- Plain language summary provided
- Available in multiple languages (if significant non-English user base)
- Contact information for questions prominently displayed

---

### 11.2 Data Collection Notice

**Just-in-Time Notice:**
- When collecting sensitive data (e.g., bank account), specific notice provided
- Explains: What data, why needed, how long retained, user rights

**Cookie Notice:**
- Cookie banner on first visit explains tracking technologies
- Opt-out options provided for non-essential cookies

---

### 11.3 Breach Notification

**Timeline:**
- Users notified within 72 hours of discovering breach (GDPR requirement)
- State breach notification laws followed (varies by state)

**Content:**
- What data was affected
- When breach occurred and was discovered
- Steps ShoutOut is taking
- Steps users should take
- Contact information for questions

---

## 12. Accountability and Recordkeeping

### 12.1 Records of Processing Activities (ROPA)

**Maintained Records:**
- Categories of data processed
- Purposes of processing
- Data sources and recipients
- Retention periods and deletion schedules
- Security measures in place
- International data transfers

**Review Frequency:** Quarterly updates to ROPA

---

### 12.2 Data Protection Impact Assessments (DPIA)

**When Required:**
- New features involving automated decision-making
- Large-scale processing of sensitive data
- Systematic monitoring of publicly accessible areas
- Processing that may result in high risk to user rights

**Process:**
1. Identify risks to user privacy
2. Assess necessity and proportionality
3. Identify mitigation measures
4. Document assessment and conclusions
5. Consult with DPO or legal counsel

---

### 12.3 Audit Trail

**Logged Activities:**
- User data access by employees
- Data deletion events
- Privacy request processing (access, deletion, etc.)
- Policy changes and updates
- Security incidents

**Audit Log Retention:** 3 years

**Access to Logs:** Privacy officer, legal counsel, authorized auditors only

---

## 13. Vendor and Third-Party Management

### 13.1 Data Processing Agreements (DPAs)

**Required for All Vendors:**
- Data Processing Agreement per GDPR Article 28
- Vendor must demonstrate adequate security measures
- Vendor retention policies must align with ShoutOut's policies
- Right to audit vendor compliance

**Current Vendors:**
- Supabase (database) - DPA in place
- Wasabi (storage) - DPA in place
- LunarPay/Fortis (payments) - PCI compliant, DPA in place
- Moov (bank verification) - Financial institution standards, DPA in place
- Mailgun (email) - DPA in place
- Cloudflare (CDN) - DPA in place

---

### 13.2 Vendor Due Diligence

**Before Engaging New Vendor:**
1. Security and privacy assessment
2. Review of vendor's data retention policies
3. Verification of certifications (ISO 27001, SOC 2, etc.)
4. DPA negotiation and execution
5. Approval by privacy officer and legal counsel

**Annual Review:** All vendor relationships reviewed for continued compliance

---

## 14. Contact Information and Requests

### 14.1 Privacy and Data Requests

**Email:** privacy@shoutout.us

**Mailing Address:**
ShoutOut Data Privacy Office
[Insert Physical Address]

**Response Time:** 
- Initial acknowledgment within 5 business days
- Full response within 30 days (may extend to 60 days for complex requests)

---

### 14.2 Types of Requests

**Supported Requests:**
- Access to personal data
- Correction of inaccurate data
- Deletion of personal data
- Data portability (export)
- Objection to processing
- Restriction of processing
- Withdrawal of consent
- Opt-out of marketing communications

**Verification Required:** Email confirmation and account login (or government ID for deceased user requests)

---

### 14.3 Complaints and Disputes

**Internal:**
- Contact privacy@shoutout.us to resolve concerns
- Escalation to Privacy Officer if not resolved

**External:**
- **GDPR (EU)**: Right to lodge complaint with supervisory authority in EU member state
- **CCPA (California)**: Right to contact California Attorney General
- **Other States**: Contact relevant state consumer protection office

---

## 15. Policy Enforcement

### 15.1 Internal Enforcement

**Employee Violations:**
- First violation: Written warning and additional training
- Second violation: Suspension pending investigation
- Serious violations: Termination and potential legal action

**Monitoring:**
- Regular audits of data access logs
- Automated alerts for unusual data access patterns
- Annual compliance reviews

---

### 15.2 Vendor Non-Compliance

**Process:**
1. Vendor notified of non-compliance
2. 30-day cure period (unless immediate risk)
3. If not cured: Service termination and data retrieval
4. Legal action if data breach or significant harm

---

## 16. Definitions

**Personal Data / Personal Information:** Any information relating to an identified or identifiable individual.

**Processing:** Any operation performed on personal data (collection, storage, use, disclosure, deletion).

**Data Subject:** The individual to whom personal data relates (user, talent, etc.).

**Data Controller:** ShoutOut (determines purposes and means of processing).

**Data Processor:** Third-party vendors who process data on ShoutOut's behalf.

**Anonymization:** Process of removing personal identifiers so individual cannot be re-identified.

**Pseudonymization:** Replacing identifiers with pseudonyms, reversible with key.

---

## 17. Document History

| Version | Date | Changes | Approved By |
|---------|------|---------|-------------|
| 1.0 | November 6, 2025 | Initial policy creation | Legal Counsel |

---

## 18. Acknowledgment

By using ShoutOut, users acknowledge they have read and understand this Data Retention and Deletion Policy. Users agree that ShoutOut will process their personal data in accordance with this policy and applicable privacy laws.

This policy supplements, and should be read in conjunction with, ShoutOut's Privacy Policy and Terms of Service.

---

## 19. Questions and Further Information

For questions about this policy or ShoutOut's data practices:

- **Privacy Inquiries:** privacy@shoutout.us
- **General Support:** support@shoutout.us
- **Legal Matters:** legal@shoutout.us

**Policy Location:** This policy is available at https://shoutout.us/data-retention-policy

---

**Last Updated:** November 6, 2025  
**Effective Date:** November 6, 2025  
**Next Review Date:** November 6, 2026

---

© 2025 ShoutOut. All rights reserved.

