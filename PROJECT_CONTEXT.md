# Midpoint Speed Monitoring project context

Last updated 2026-11-27 (Africa/Johannesburg).

## 2026-11-27 register TLS deployment readback

- **Implementation.** No application changes. The staged portal-only pinned HTTPS connection was activated by the VPS administrator.
- **Testing.** The administrator's transcript shows the web image built, the web container became healthy, and the in-container register verifier reached HikCentral with pinned TLS and HTTP 200. The transcript ends at the test input prompt. Independent public health checks returned OK for Midpoint and EMS.
- **Commit and push.** Application implementation `1fbaaf0` was staged previously. This documentation-only update records the administrator's deployment evidence.
- **Merge.** No application merge in this follow-up.
- **Deployment and configuration.** The VPS image `26eacea1c519` was built and started. No HikCentral shared listener or EMS configuration change is evidenced.
- **Live production verification.** TLS is verified. The signed plate result and operator verification from a draft ticket are pending. The latest EMS import succeeded before deployment on run `19940`; the next scheduled post-change import remains open.

## 2026-11-27 one-vehicle HikCentral group pilot

- **Implementation.** Created the ordinary **Midpoint Speed Camera Pilot** list and assigned only the approved test vehicle. No application code changed.
- **Testing.** The UI readback showed one member, the same vehicle tested previously. The signed group-list request returned group ID `1`. Signed advanced search returned code 0 and exactly one exact match. The signed vehicle detail call also returned code 0 for the same plate. Both returned owner and colour. Neither returned a make. No vehicle or owner identifiers were copied into this record.
- **Commit and push.** This gateway evidence is promoted directly to `main` and staged in the VPS checkout.
- **Merge.** Documentation-only fast-forward promotion.
- **Deployment and configuration.** Changes were limited to the new HikCentral list and the one vehicle assignment. The list was not applied to a camera. No EMS, shared listener, certificate, partner or VPS web settings changed.
- **Live production verification.** EMS health returned HTTP 200 before and after. Its active daily OpenAPI importer last succeeded on run `19940` at 05:18 SAST, before the list change. The next scheduled post-change import remains unverified. Before enabling the VPS lookup, independently confirm the certificate fingerprint, configure the scoped partner with group ID `1`, and verify the exact portal response. Broader fleet scope, make availability and prior operator/data gates remain open.

## 2026-11-27 ungrouped plate lookup check

- **Implementation.** Read-only diagnosis. The portal continues to require a vehicle group selector.
- **Testing.** Registered Vehicle showed 480 records and List Management showed zero lists. The operator's signed group-list requests returned code 0 with total 0. In the live gateway debugger, a signed plate-filtered search for an existing ungrouped vehicle using an empty `vehicleGroupIndexCode` returned code 2 with a group parameter error. No plate, credential or owner details were recorded here.
- **Commit and push.** Evidence is promoted to `main` and staged in the VPS checkout.
- **Merge.** Direct fast-forward promotion of documentation.
- **Deployment and configuration.** No vehicle, list, partner, certificate or portal configuration changes.
- **Live production verification.** The blank group value is rejected on this installation. A supported ungrouped selector or an approved named-group pilot remains open, along with independent certificate verification and a successful signed portal lookup.

## 2026-11-27 existing HikCentral 443 connection

- **Implementation.** Added portal-only certificate pinning for the existing Artemis HTTPS listener and an interactive VPS setup script. The setup requires an independently verified SHA-256 fingerprint, then saves the dedicated partner credentials and exact public leaf certificate in a mode-600 file inside the portal's read-only operator mount. Standard TLS trust remains available for a named gateway.
- **Testing.** The unit suite, Next.js build, Compose validation and isolated Docker smoke passed. HTTPS fixtures verified that a pinned peer works, wrong destination, redirect and replacement certificate are rejected, and the replacement server receives no HTTP data. An unsigned VPS diagnostic reached HTTP 200 on the existing listener and Artemis search path. The listener closes HEAD requests, so the readiness verifier uses an unsigned GET for TLS preflight.
- **Commit and push.** Setup, application change and evidence are promoted to `main` and staged in the VPS checkout.
- **Merge.** Direct fast-forward promotion to `main`.
- **Deployment and configuration.** No EMS, HikCentral, DNS or live portal runtime changes. VPS setup requires the fingerprint confirmed independently from the HikCentral host, the scoped partner key and secret, group ID, and the privileged web rebuild.
- **Live production verification.** Unsigned protocol compatibility on 443 is confirmed. The trusted fingerprint, credentials, real signed vehicle lookup, make availability, operator acceptance and EMS source-import verification remain open.

## 2026-11-27 Speed-Cameras partner permission readback

- **Implementation.** Read-only inspection of the new HikCentral partner. No code changes were required.
- **Testing.** The live partner editor showed `Speed-Cameras` linked to `admin`, with 230 authorized APIs. The two vehicle lookup operations are already checked. Add, update and delete vehicle permissions were also checked, so this is broader than the requested read-only integration. The form was closed without saving.
- **Commit and push.** This evidence-only update is promoted to `main` and staged in the VPS checkout.
- **Merge.** Direct fast-forward of documentation.
- **Deployment and configuration.** No partner, credential or portal settings changed. The VPS still timed out connecting to the proposed port 4443.
- **Live production verification.** Read-only partner scope, the separate certificate and listener, the vehicle group ID and signed lookup remain open. All existing EMS, capture and acceptance gates remain in place.

## 2026-11-27 approved HikCentral DNS name

- **Implementation.** Updated the administrator handoff with the approved hostname, proposed separate Artemis listener, existing EMS origin, VPS source address and exact read paths.
- **Testing.** Both authoritative Hostinger nameservers returned the new A record, `41.169.72.97` at TTL 300. The existing EMS DNS record still resolves to its VPS and its public health returned HTTP 200. Midpoint health returned OK.
- **Commit and push.** This handoff and evidence are promoted to `main` and staged on the VPS checkout.
- **Merge.** Direct fast-forward promotion of the documentation.
- **Deployment and configuration.** Added only the new `hikcentral` A record in the Hostinger zone. No DNS replacement, HikCentral server change, EMS configuration change or portal rebuild took place. Listener port 4443 is proposed pending platform administrator confirmation.
- **Live production verification.** DNS is live. The separate TLS listener, certificate, network restriction, partner scope, signed lookup and EMS source-import verification remain open. Existing ticket, capture, evidence and acceptance gates remain open.

## 2026-11-27 EMS-safe hostname preparation and demonstration notice

- **Implementation.** Updated the HikCentral runbook to verify a separate Artemis HTTPS endpoint first, with a scheduled shared-listener fallback and EMS import verification. Produced a local A4 showcase notice with fictional data and a generated camera image. No demonstration records were written to the portal.
- **Testing.** Verified the sample PDF rendered as one A4 page with the demonstration banner, illustrative owner, measurements and generated evidence. The proposed hostname had no DNS answer in the lookup. The EMS and Midpoint public health endpoints returned HTTP 200 before any change.
- **Commit and push.** The connection guidance and context are promoted to `main`. The showcase PDF is a local handoff artifact, not a deployed feature.
- **Merge.** Direct fast-forward promotion of the documentation.
- **Deployment and configuration.** No DNS, certificate, EMS configuration or live portal changes. The HikCentral host administrator and DNS access for the selected name remain required to verify and configure the separate endpoint.
- **Live production verification.** New hostname, certificate trust, scoped partner and group ID, real lookup and EMS post-change source ingestion remain open. Prior camera, evidence, operator acceptance, backup and policy gates remain open.

## 2026-11-27 HikCentral live connection preflight

- **Implementation.** Added a runbook with the verified HikCentral 3.0.1 certificate and partner controls, and a verifier that checks TLS before signed lookup and reports field availability without printing owner details.
- **Testing.** Reviewed the EMS main source at `087dfcb`. Its saved importer targets the same HikCentral listener and the EMS browser bridge permits TLS errors. A VPS handshake reached that listener and found a self-signed platform certificate for `127.0.0.1` with no SAN. The verifier accepted trusted HTTPS, rejected the HikCentral listener, and reported missing partner configuration correctly. All seven unit tests passed. In the live HikCentral UI, confirmed **Transport Protocol**, **Add Integration Partner**, **Linked User**, and the individual registered-vehicle read permissions. No changes were saved in HikCentral.
- **Commit and push.** The verifier, runbook and context are promoted to `main` and staged on the VPS.
- **Merge.** Direct fast-forward promotion to `main`.
- **Deployment and configuration.** The existing portal is available. Live register activation needs a HikCentral administrator to install a hostname-matched certificate, a dedicated read-only partner, the actual vehicle group code including the ungrouped scope if needed, and privileged VPS configuration and rebuild.
- **Live production verification.** The gateway TLS failure is confirmed from the VPS. The replacement certificate, scoped partner, real record lookup and make coverage remain unverified. All previous capture, evidence, acceptance and policy gates remain open.

## 2026-11-27 HikCentral vehicle register lookup

- **Implementation.** Draft tickets can query the HikCentral advanced vehicle search on demand. The portal requires an exact normalized plate match and one effective registration at the capture time. It displays registered owner, colour and a readable make if the search or corroborating detail response provides one. It discards owner IDs and phone numbers, and leaves recipient confirmation to the operator. Register credentials are scoped separately from capture polling.
- **Testing.** Seven unit tests passed, including HTTP signing, exact match, date constraints, ambiguous and incomplete response handling, and missing or mismatched make. Docker build and the existing PostgreSQL workflow passed. A second Docker smoke test used a controlled HTTPS HikCentral fixture and verified owner, make and colour appeared on a draft while the private fixture value stayed out of the HTML.
- **Commit and push.** Lookup and evidence are promoted to `main` and staged in the VPS checkout.
- **Merge.** Direct fast-forward promotion to `main`.
- **Deployment and configuration.** The earlier ticketing deployment responds at `/tickets` with the expected anonymous redirect. Live lookup requires a verified HTTPS HikCentral origin, read-only application credentials, the effective vehicle group ID and a privileged rebuild of the portal container. Store credentials in the private VPS environment.
- **Live production verification.** No live registered vehicle has been queried for this change. Midpoint's exact API payload, group scope, make availability and an operator's real plate lookup remain open. Preserve the capture, evidence, backup, site policy and operator acceptance gates.

## 2026-11-27 speed ticket register and printable notices

- **Implementation.** Added an authenticated Speed tickets register, one ticket per eligible approved capture, generated references, a printable A4 site notice, and audited draft, finalize and void actions. The notice uses the approved capture and protected camera image, with recipient and applicable site rule confirmed by an operator. The document is a Midpoint site notice. Municipal statutory wording, payment and delivery are outside the current workflow.
- **Testing.** The production Docker build, unit tests and [GitHub validation](https://github.com/blendproperty/speed-camera/actions/runs/45984187893) passed. The PostgreSQL smoke test passed for the existing review and CSV flow plus private register access, held capture rejection, duplicate create, draft notice and evidence URL, finalization controls, finalized edit refusal, register filtering, voiding and audit. The test uses synthetic captures. The portal provides a browser print layout; production PDF output and acceptance remain unverified.
- **Commit and push.** Implementation `a4a2016` was promoted to `main` and staged in the VPS checkout. This follow-up records validation and the vehicle-data example.
- **Merge.** Direct fast-forward promotion to `main`.
- **Deployment and configuration.** Live readback confirmed the previous browser sign-in fix is deployed, with `Referrer-Policy: same-origin`; the operator reports sign-in and CSV export work. The ticketing image requires a privileged build and recreation of the VPS web container. The database adds the new ticket table on initialization.
- **Live production verification.** Live ticketing, genuine camera evidence, production backup and restore, operator acceptance, site enforcement and approved issue, delivery or payment rules remain open.
- **Vehicle register evidence.** The supplied example shows registration, vehicle descriptors, registered owner and effective period. Hikvision documents a read-only advanced vehicle search supporting a plate filter and effective dates. Its live availability, response mapping, authorization and exact matching behavior on Midpoint remain unverified. The example was not imported. Tickets currently require operator-entered recipient verification. An effective vehicle record is a candidate match and does not establish who was driving.

## 2026-11-27 browser sign-in origin fix

- **Implementation.** Use the `same-origin` referrer policy so a native form POST to this app includes its own origin. The previous `no-referrer` policy caused the browser to send a null origin. The app continues to require the exact configured origin and CSRF tokens on authenticated actions.
- **Testing.** Reproduced the public error by clicking Sign in in Chromium. After rebuilding the isolated Docker stack, a native browser form signed in with a disposable account and opened Capture review. The native sign-out form returned to login. Unit tests and the Docker smoke test passed, including rejection of foreign and null Origins.
- **Commit and push.** The fix and context are promoted to `main` and staged in the VPS source checkout.
- **Merge.** Direct fast-forward promotion to `main`.
- **Deployment and configuration.** The existing public Traefik web container needs a privileged rebuild and recreation. The available SSH session requires interactive sudo for Docker.
- **Live production verification.** The pre-fix browser failure is verified. Public native sign-in with the corrected image and operator acceptance remain pending. The prior HikCentral, capture and evidence, backup and policy gates remain open.

## 2026-11-27 public HTTPS verified

- **Implementation and testing.** No application code changed during verification. The public sign-in page rendered successfully. A same-origin form submission with empty credentials returned the expected HTTP 303 to the login error page, and anonymous CSV export returned HTTP 401.
- **Commit and push.** The VPS cutover ran from `main` at `d8ea251`. This follow-up records live results and changes documentation only.
- **Merge.** No application merge was needed for the cutover.
- **Deployment and configuration.** The administrator started the Traefik cutover. The shell was interrupted during the early certificate checks, after the public web container had started. Subsequent independent checks confirmed the public route stayed active and the previous VPS loopback listener was no longer accepting connections.
- **Live production verification.** `https://speed-camera.srv938083.hstgr.cloud` presents a trusted Let's Encrypt certificate for the correct name, health returns HTTP 200 with `{"status":"ok"}`, and HTTP redirects to HTTPS. Successful sign-in with a named operator and operator acceptance remain unverified. HikCentral polling, genuine capture and evidence verification, production backup restore, and the evidence policy remain open.

## 2026-11-27 public HTTPS cutover preparation

- **Implementation.** Added a VPS administrator cutover script for the existing Traefik configuration. It switches the web origin to HTTPS and checks the public certificate, health, sign-in origin and unauthenticated export restriction. The existing private configuration is restored if verification fails.
- **Testing.** Shell syntax and Compose configuration checked. VPS checkpoint confirmed private health and host DNS. The proposed public hostname did not yet present a trusted certificate.
- **Commit, push and merge.** Cutover preparation is promoted directly to `main` with this context. No pull request or runtime application build is needed for the configuration change.
- **Deployment and configuration.** Public cutover requires interactive sudo on the VPS because the available SSH account has no Docker socket access. The private pilot is running. The cutover does not activate HikCentral polling.
- **Live production verification.** Public HTTPS and real operator sign-in are pending. Camera capture validation and the existing operator acceptance, backup and evidence policy gates remain open.

## 2026-11-27 VPS pilot activation

- **Implementation.** No application changes. The pilot uses the previously validated implementation at `66a223ce0242ede374312127bbef8ed7ba1cfdf8`.
- **Testing.** The administrator's activation transcript shows a successful image build, creation of the pilot operator, and healthy PostgreSQL and web containers. An independent SSH check confirmed health HTTP 200 with `{"status":"ok"}`, login HTTP 200 and anonymous CSV export HTTP 401 on the VPS loopback address.
- **Commit and push.** Activation used the verified VPS `main` checkout at `57da7e4380410e235609934982a3e6bbfd8e1633`. The activation evidence is recorded in this documentation-only follow-up.
- **Merge.** No application merge or promotion was needed for activation.
- **Deployment and configuration.** The VPS administrator ran the pilot installer with sudo. The web service is available through VPS loopback on port 3189. The private pilot uses PostgreSQL and starts with HikCentral sync disabled. The production Traefik route remains pending.
- **Live pilot verification and open gates.** Loopback availability and the anonymous access restriction were verified. A named operator sign-in, operator acceptance, production backup and restore, approved HTTPS access, evidence policy, and the signed HikCentral connection with a trusted certificate and a genuine Midpoint camera capture remain pending.

## 2026-11-27 internal pilot implementation

- **Implementation.** Next.js operator console, separate PostgreSQL schema and volume, Docker web and HikCentral worker, and Traefik override following the EMS Entry Tracking deployment pattern. Includes named operator authentication, camera setup and sync status, bounded Artemis polling with per-camera checkpoints and stable IDs, evidence retrieval and hashing, held and review states, reasoned internal decisions, audit history and an approved-only CSV. The EMS reference repository was read at `087dfcb7345e1bc4068f1d49e87485643df6483e`. No EMS changes were needed.
- **Testing.** Four local unit checks passed. Next.js production build passed on the host and in Docker. An isolated PostgreSQL 17 and Docker smoke test passed for sign-in, CSRF, camera creation, repeated ingestion, four evidence/classification states, authenticated evidence retrieval, held and duplicate decision prevention, approval, CSV, audit and sign-out. A PostgreSQL custom-format dump restored to a separate disposable database with all four expected capture states. Local Traefik v3 returned HTTP-to-HTTPS redirect, health 200 and protected export 401 using its local test certificate. Sign-in layout was inspected in a browser. The npm production dependency audit reported zero known vulnerabilities. [GitHub validation run 45978877100](https://github.com/blendproperty/speed-camera/actions/runs/45978877100) passed on the implementation commit.
- **Commit and push.** Initial implementation and context at `66a223ce0242ede374312127bbef8ed7ba1cfdf8` were pushed directly to the previously empty `main` branch. The VPS stage cloned that exact commit and verified the tracked project context. This evidence entry is a documentation-only follow-up.
- **Merge.** Initial branch publication. A pull request merge is unnecessary for the empty repository.
- **Deployment and configuration.** Local validation uses disposable fixtures. A clean source checkout was staged in `~/speed-camera` on the VPS and the pilot installer passed its shell syntax check. Docker Compose is installed, but the SSH account cannot access Docker and sudo requires an interactive password. Rootless Docker is unavailable because `newuidmap` is absent. The pilot installer is designed to bind the app to loopback and start with HikCentral polling disabled. It has not been run on the VPS.
- **Live production verification.** The live gateway catalogue lists vehicle records and image retrieval, and Hikvision documents optional `vehicleSpeed`. The VPS connects to the gateway, but the presented certificate is self-signed and fails address validation. No authenticated provider request or actual Midpoint infringement has been verified. Live web deployment and TLS routing remain pending.
- **Open gates.** Privileged VPS deployment, signed gateway requests with a trusted matching TLS certificate, authorized read-only credentials, exact camera IDs, a genuine capture with speed and its unit and matching picture, camera and applicable speed-limit verification, operator acceptance, production backup and restore, and approval of evidence access, retention and ticketing handoff. The application keeps ticket issuance and notifications outside its internal review workflow.
