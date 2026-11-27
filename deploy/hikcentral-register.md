# Connect the Midpoint vehicle register

## Reuse existing port 443 without changing EMS

For this HikCentral listener only, the portal can authenticate the existing certificate by its SHA-256 fingerprint. Ask the HikCentral server admin for the fingerprint of the actual HTTPS leaf certificate bound to port 443, obtained from the server or its certificate store. Treat the expected fingerprint as an independent check. A fingerprint copied from the same untrusted network response would not establish trust.

After the administrator confirms it, run this interactively on the VPS. The setup compares the expected fingerprint with the currently presented certificate before it asks for credentials.

```sh
cd ~/speed-camera
sudo python3 deploy/configure-register-443.py
sudo docker compose -f compose.yaml -f compose.traefik.yaml up -d --build --no-deps --wait web
sudo docker compose -f compose.yaml -f compose.traefik.yaml exec web node scripts/verify-register.mjs lookup
```

Enter the **Integration Partner Key** as AppKey, the **Integration Partner Secret** as AppSecret, and the actual vehicle group ID. The key and secret prompts hide input. The script writes the configuration to `secrets/operators/hikcentral-register.json`, mode 600, readable by the portal service through its read-only mount. No change to the HikCentral listener or EMS configuration is needed. The portal verifies the exact certificate on every new connection. If the certificate rotates, independently confirm the replacement fingerprint and rerun the setup.

## Certificate

The EMS feed and Midpoint currently reach the same listener. The existing certificate is self-signed, names `127.0.0.1`, and has no Subject Alternative Name for the VPS-facing address.

Start by asking the HikCentral host administrator whether the installed deployment supports a separate HTTPS endpoint for Artemis. If it does, dedicate the new hostname and certificate to the additional endpoint while keeping the existing EMS connection intact. Restrict the new endpoint to the VPS source address or private network if the site firewall supports it. Verify that the new endpoint reaches the HikCentral service with authenticated transport on any network hop. Confirm an EMS import and report status before and after the change.

The approved DNS name is `hikcentral.sensibledesigns.online`. Hostinger DNS points it to `41.169.72.97` with a 300-second TTL. The proposed new origin is `https://hikcentral.sensibledesigns.online:4443`, subject to the administrator confirming the separate listener and firewall/NAT mapping. The Midpoint VPS observed source IP is `93.127.186.194`. The existing EMS listener is `41.169.72.97:443`.

Ask the administrator to provide the new HTTPS origin, the public issuer chain or private CA PEM if required, and confirmation that the original listener and certificate remain in place. For a separate proxy, preserve the HTTP method, Artemis path, request body and signing headers. The required path is `/artemis/api/resource/v1/vehicle/advance/vehicleList`. The optional detail path is `/artemis/api/resource/v1/vehicle/indexCode/vehicleInfo`. The VPS can verify TLS and run a signed read after configuration. The private key remains on the HikCentral host or its HTTPS frontend.

If the HikCentral installation has a single shared certificate and listener, publishing a DNS alias alone still presents that certificate. Plan a shared certificate replacement in a maintenance window, with the current certificate configuration recorded, an administrator able to restore it, and EMS import and report checks ready. Changing the shared transport configuration can restart HikCentral and sign out active users.

1. Choose a DNS name under a domain you control and point it to the HikCentral listener. Obtain a server certificate whose SAN covers that exact name. A private CA is suitable if the VPS trusts its public CA certificate.
2. In HikCentral, go to **System → Security → Transport Protocol**. Keep **HTTPS** selected and choose **New Certificate**. The server PEM must include the certificate and its private key in HikCentral's required format. Use **Upper-Level Certificate** for any required issuer chain. Keep the server private key with the HikCentral administrator.
3. If **Dual-Service Deployment** is enabled under OpenAPI Gateway, verify the certificate presented by the actual Artemis host and port too. The certificate needs to match the origin used by the portal.
4. From the VPS, verify the new name and TLS trust before sending a signed request. With a public CA, `curl -I https://<gateway-host>/` should reach HTTP without a certificate error. With a private CA, run the same check using the approved PEM with `--cacert`. If the portal uses a private CA, mount only its public PEM per the README.

[HikCentral Transport Protocol guide](https://enpinfo.hikvision.com/hkwsen/unzip/20250423135944_00464_doc/GUID-63CCD6BB-BB68-4ADC-90EC-5EF34914F316.html)

## Read-only partner

1. In **Account and Security → Roles**, add a role for the vehicle-register service and scope it to the relevant Midpoint resources. **Permission Settings → User Permission** has a **Vehicle Search** permission. Grant the read/search permissions needed for this scope. In **Users**, assign the role to a dedicated service user.
2. Open **System → Third-Party Integration → OpenAPI Gateway → Basic Configuration → Add** under **Integration Partner**. Enter a name such as **Midpoint Speed Camera Register** and choose the service user under **Linked User**. The form defaults to **admin** and the linked user determines the user's operational scope.
3. Under **Authorized API**, expand **Logical Resources API → Vehicle Information**. Select **Search for vehicles**. Select **Get a vehicle information by vehicle ID** if the portal should try the optional detail fallback. The individual permissions are sufficient at the partner level. Keep the add, update and delete permissions clear.
4. Save with **Add**. Store the generated key and secret in the private VPS `.env` using the administrator's approved credential channel. Set the effective vehicle group ID for Midpoint. If the vehicles are displayed as **None** in HikCentral, ask the HikCentral administrator to confirm how its gateway addresses ungrouped vehicles. **Get vehicle group list** is a read operation that can help an administrator identify named group codes.

[HikCentral integration partner guide](https://enpinfo.hikvision.com/hkwsen/unzip/20250423135944_00464_doc/GUID-79C820F6-333B-4E72-98EF-97CBAA7BA007.html)

## VPS configuration and check

In the VPS checkout's private `.env`, set `HIK_REGISTER_ORIGIN` to the verified HTTPS origin, `HIK_REGISTER_APP_KEY`, `HIK_REGISTER_APP_SECRET`, and `HIK_REGISTER_GROUP_ID`. If using a private CA, set `HIK_REGISTER_CA` to the public CA path inside the container as described in the README.

```sh
cd ~/speed-camera
sudo docker compose -f compose.yaml -f compose.traefik.yaml up -d --build --no-deps --wait web
sudo docker compose -f compose.yaml -f compose.traefik.yaml exec web node scripts/verify-register.mjs lookup
```

Use an approved plate and its capture time for the check. It reports match status and field availability without printing owner data. Then open the same draft in the portal and verify the candidate against the register. The documented search response includes owner and colour. Verify whether the installed gateway returns the make in either response before relying on it.
