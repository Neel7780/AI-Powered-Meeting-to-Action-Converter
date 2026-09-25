Admin, Security, Legal & Privacy
Stakeholders


- Workspace Admin
- IT & Security
- Legal / DPO
- External Participants
- People Named in Meetings

1\. Key Elicitation Findings
Authentication and Identity


- Users must authenticate before accessing protected workspaces and meeting data.
- The system should support role-based access.
- SSO may be required depending on organizational requirements.

Roles, Permissions and Workspace Management


- Roles considered include **Workspace Admin, Team Lead, and Member**.
- Workspace Admins need to manage workspace members and their access.
- Access to meetings, transcripts, and action items must depend on permissions.

Meeting Data Protection


- Meeting transcripts may contain confidential or personal information.
- Recordings, transcripts, participant information, action items, owners, deadlines, and decisions require appropriate protection.
- The same security controls should apply if meeting-bot/ASR functionality is introduced in the future.

Privacy and Transparency


- Participants may need to be informed when meetings are recorded, transcribed, or AI-processed.
- Consent requirements must be determined according to the applicable context and policy.
- The system should avoid unnecessary collection and retention of personal information.

Retention and Deletion


- Meeting recordings and transcripts should not be retained indefinitely.
- Retention periods need to be defined.
- Deletion requirements may also apply to AI-generated summaries, action items, and other derived data.

External Participants and People Mentioned


- External participants such as clients, vendors, consultants, and guests need appropriate privacy information.
- People mentioned in meetings may not be participants but can still have personal information processed by the system.
- Appropriate access, retention, deletion, and possible redaction requirements need to be considered.

Third-Party Processing


- Meeting data may be sent to external AI/LLM or notification services.
- Only approved services should process meeting data.
- Unnecessary personal or meeting information should not be shared with external services.

Auditability


- Relevant authentication, permission, administrative, privacy, consent, and deletion activities should be traceable.

2\. Functional Requirements (FR)


- **FR-SEC-01:** The system shall authenticate users before granting access to protected workspaces, meetings, transcripts, and tasks.
- **FR-SEC-02:** The system shall implement role-based access for Workspace Admin, Team Lead, and Member roles.
- **FR-SEC-03:** The Workspace Admin shall be able to add, remove, and manage workspace members and their access.
- **FR-SEC-04:** The system shall restrict access to meeting recordings, transcripts, and action items according to user permissions.
- **FR-SEC-05:** The system shall control creation, modification, assignment, and deletion of action items according to permissions.
- **FR-SEC-06:** The system shall support secure password recovery when password-based authentication is enabled.
- **FR-SEC-07:** The system shall support Single Sign-On (SSO) where required by the organization.
- **FR-SEC-08:** The system shall record relevant authentication, administrative, permission, consent, and privacy-sensitive activities for auditing.
- **FR-SEC-09:** The system shall provide appropriate privacy information when meeting data is recorded, transcribed, or processed using AI, where required.
- **FR-SEC-10:** The system shall support obtaining and recording participant consent for recording or transcription where consent is required.
- **FR-SEC-11:** The system shall support configurable retention periods for recordings, transcripts, and applicable derived meeting data.
- **FR-SEC-12:** The system shall allow authorized users to delete recordings, transcripts, and applicable associated data according to retention and privacy policies.
- **FR-SEC-13:** The system shall provide mechanisms for applicable access, correction, and deletion requests concerning personal data.
- **FR-SEC-14:** The system shall apply appropriate privacy controls to meetings involving external participants.
- **FR-SEC-15:** The system shall associate AI-generated summaries, action items, task owners, and deadlines with their source meeting data.
- **FR-SEC-16:** The system shall control the transfer of meeting data to approved external AI, transcription, notification, or other processing services.
- **FR-SEC-17:** The system shall provide mechanisms to restrict or redact unnecessary personal information where required. 

3\. Non-Functional Requirements (NFR)


- **NFR-SEC-01 — Security:** Credentials, authentication information, and sensitive system information shall be securely protected.
- **NFR-SEC-02 — Confidentiality:** Meeting recordings, transcripts, participant information, action items, owners, deadlines, and personal information shall be protected from unauthorized access.
- **NFR-SEC-03 — Secure Communication:** Data exchanged between the application, database, and external services shall use secure communication mechanisms.
- **NFR-SEC-04 — Session Security:** User sessions and authentication tokens shall be protected against unauthorized use.
- **NFR-SEC-05 — Data Minimization:** The system shall process and retain only personal and meeting data necessary for the defined purpose.
- **NFR-SEC-06 — Privacy Compliance:** The system shall support applicable data-protection laws and organizational privacy policies.
- **NFR-SEC-07 — Retention:** Meeting data shall not be retained beyond its defined retention period unless otherwise permitted or required.
- **NFR-SEC-08 — Transparency:** Information about data collection, processing, storage, and third-party sharing shall be communicated clearly to relevant users.
- **NFR-SEC-09 — Auditability:** Security and privacy-sensitive operations shall be appropriately traceable through audit records.
- **NFR-SEC-10 — Integration Security:** External AI, transcription, notification, and other processing services shall be accessed through approved, secure, and authenticated mechanisms.
- **NFR-SEC-11 — Availability:** Authentication and access-control mechanisms shall remain available during normal system operation.
- **NFR-SEC-12 — Scalability:** Security, access-control, and privacy mechanisms shall support increasing numbers of users, workspaces, meetings, and tasks. 

4\. Data Requirements (DR)


- **DR-SEC-01:** The system shall securely store user identity and authentication information required for access control.
- **DR-SEC-02:** The system shall maintain relationships between users, workspaces, teams, and roles.
- **DR-SEC-03:** The system shall maintain permission and access-control information for workspaces, meetings, transcripts, and action items.
- **DR-SEC-04:** The system shall store meeting data including transcripts, participants, action items, task owners, deadlines, decisions, and discussion points.
- **DR-SEC-05:** The system shall maintain meeting metadata including meeting owner, participants, workspace, creation date, retention period, access permissions, and deletion status.
- **DR-SEC-06:** Where applicable, the system shall store participant consent and notification status related to recording and transcription.
- **DR-SEC-07:** The system shall maintain relationships between source transcripts and derived summaries, action items, task owners, and deadlines.
- **DR-SEC-08:** The system shall store retention information required to determine when meeting data should be deleted.
- **DR-SEC-09:** The system shall maintain information required to process applicable privacy access, correction, and deletion requests.
- **DR-SEC-10:** The system shall store relevant authentication, permission, administrative, consent, access, and deletion audit records.
- **DR-SEC-11:** Where external AI or processing services are used, the system shall maintain information necessary to identify the relevant data transfer or processing relationship. 

5\. User Stories


- **US-SEC-01:** **As a Workspace Admin,** I want to manage users, roles, and permissions so that workspace and meeting data is accessible only to authorized people.
- **US-SEC-02:** **As a Team Member,** I want to securely log in so that I can access only the workspaces, meetings, and tasks I am authorized to use.
- **US-SEC-03:** **As a Workspace Admin,** I want to control transcript and action-item access so that confidential meeting information remains protected.
- **US-SEC-04:** **As an IT/Security Administrator,** I want security and administrative activities to be logged so that suspicious or unauthorized activity can be investigated.
- **US-SEC-05:** **As a Meeting Participant,** I want to know when my meeting is recorded, transcribed, or AI-processed so that I understand how my information is being used.
- **US-SEC-06:** **As a Meeting Organizer,** I want to control recording or transcription where permitted so that meeting processing follows applicable requirements.
- **US-SEC-07:** **As an Authorized User,** I want to access meeting transcripts according to my permissions so that sensitive information is not exposed to unauthorized users.
- **US-SEC-08:** **As a Workspace Admin,** I want to configure retention and deletion rules so that meeting data is not retained longer than required.
- **US-SEC-09:** **As a Data Subject,** I want applicable access, correction, or deletion requests to be handled so that I can exercise my relevant data rights.
- **US-SEC-10:** **As an External Participant,** I want clear information about how my meeting data is processed so that I understand how my information is handled.
- **US-SEC-11:** **As a Workspace Admin,** I want to control which external services can process meeting data so that unauthorized services cannot access it.
- **US-SEC-12:** **As a System Administrator,** I want privacy-sensitive operations to be auditable so that access, consent, and deletion activities can be reviewed.
