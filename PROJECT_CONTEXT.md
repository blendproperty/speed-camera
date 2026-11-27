# Midpoint Speed Monitoring project context

Last updated 2026-11-27 (Africa/Johannesburg).

## 2026-11-27 speed ticket register and printable notices

- **Implementation.** Added an authenticated Speed tickets register, one ticket per eligible approved capture, generated references, a printable A4 site notice, and audited draft, finalize and void actions. The notice uses the approved capture and protected camera image, with recipient and applicable site rule confirmed by an operator. The document is a Midpoint site notice. Municipal statutory wording, payment and delivery are outside the current workflow.
- **Testing.** The production Docker build and unit tests passed. The PostgreSQL smoke test passed for the existing review and CSV flow plus private register access, held capture rejection, duplicate create, draft notice and evidence URL, finalization controls, finalized edit refusal, register filtering, voiding and audit. The test uses synthetic captures. The portal provides a browser print layout; production PDF output and acceptance remain unverified.
- **Commit and push.** The implementation and context are promoted to `main` and staged in the VPS checkout.
- **Merge.** Direct fast-forward promotion to `main`.
- **Deployment and configuration.** Live readback confirmed the previous browser sign-in fix is deployed, with `Referrer-Policy: same-origin`; the operator reports sign-in and CSV export work. The ticketing image requires a privileged build and recreation of the VPS web container. The database adds the new ticket table on initialization.
- **Live production verification.** Live ticketing, genuine camera evidence, production backup and restore, operator acceptance, site enforcement and approved issue, delivery or payment rules remain open.

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
