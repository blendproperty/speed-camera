# Connect the Midpoint vehicle register

## Certificate

The EMS feed and Midpoint use the same listener. The existing certificate is self-signed, names `127.0.0.1`, and has no Subject Alternative Name for the VPS-facing address. The certificate needs replacement on the HikCentral listener used by Artemis. Plan the change with the HikCentral administrator since the platform can restart and sign out active users.

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
