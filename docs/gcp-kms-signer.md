# Configure Rebalancer with GCP KMS Signer

This guide shows how to configure the rebalancer to use Google Cloud KMS with:
- `type = "gcp_kms"`
- `project_id`
- `location`
- `keyring`
- `key_name`
- `key_version`

It matches the current implementation in `rebalancer/src/signer.rs` and uses ADC (Application Default Credentials).

## Prerequisites

- `gcloud` CLI authenticated to the target project.
- A GCP project with Cloud KMS API enabled.
- A secp256k1 asymmetric signing key version in Cloud KMS.

Enable API if needed:

```bash
gcloud services enable cloudkms.googleapis.com --project <PROJECT_ID>
```

## 1) Create key ring and secp256k1 key (if you do not already have one)

```bash
export PROJECT_ID=<your-project>
export LOCATION=us-central1
export KEYRING=solver-keyring
export KEY_NAME=solver-key

gcloud kms keyrings create "$KEYRING" \
  --location "$LOCATION" \
  --project "$PROJECT_ID"

gcloud kms keys create "$KEY_NAME" \
  --location "$LOCATION" \
  --keyring "$KEYRING" \
  --purpose "asymmetric-signing" \
  --default-algorithm "ec-sign-secp256k1-sha256" \
  --project "$PROJECT_ID"
```

List versions (pick an enabled version, usually `1` initially):

```bash
gcloud kms keys versions list \
  --location "$LOCATION" \
  --keyring "$KEYRING" \
  --key "$KEY_NAME" \
  --project "$PROJECT_ID"
```

## 2) Set up runtime credentials (ADC)

The service uses Google ADC. Common options:

1. Local/service account JSON:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

2. Workload Identity / GCE / GKE metadata credentials:
- no env var needed, ADC resolves from environment metadata.

## 3) Grant minimal IAM permissions

Grant the runtime identity permissions on the target key version/key:

- `cloudkms.cryptoKeyVersions.useToSign`
- `cloudkms.cryptoKeyVersions.viewPublicKey`

These are included by roles such as `roles/cloudkms.signerVerifier`.

Example binding:

```bash
gcloud kms keys add-iam-policy-binding "$KEY_NAME" \
  --location "$LOCATION" \
  --keyring "$KEYRING" \
  --member "serviceAccount:<SERVICE_ACCOUNT_EMAIL>" \
  --role "roles/cloudkms.signerVerifier" \
  --project "$PROJECT_ID"
```

## 4) Configure `rebalancer.toml`

```toml
[[chains]]
name = "sepolia"
chain_id = 11155111
domain_id = 11155111
rpc_url = "https://ethereum-sepolia-rpc.publicnode.com"
account = "0x<rebalancer-account>"

  [chains.signer]
  type = "gcp_kms"
  project_id = "my-gcp-project"
  location = "us-central1"
  keyring = "solver-keyring"
  key_name = "solver-key"
  key_version = 1
```

Important runtime behavior:
- Startup enforces signer/account match.
- If `chains.account` does not match the KMS-derived address, startup fails with `Signer/account mismatch`.

## 5) Optional key checks

Fetch the KMS public key for inspection:

```bash
gcloud kms keys versions get-public-key 1 \
  --location "$LOCATION" \
  --keyring "$KEYRING" \
  --key "$KEY_NAME" \
  --project "$PROJECT_ID"
```

## 6) Troubleshooting

- `Failed to initialize gcp_kms signer for chain ...`
  - ADC credentials not available
  - wrong `project_id` / `location` / `keyring` / `key_name` / `key_version`
  - missing KMS IAM permissions

- `Signer/account mismatch ...`
  - configured `account` does not match KMS key address used by signer

- permission denied from KMS
  - ensure the runtime identity has signing and public key permissions on that key

## Security notes

- Prefer a dedicated KMS key per environment.
- Restrict IAM bindings to least privilege and only required key resources.
- Do not commit service-account credential files.
