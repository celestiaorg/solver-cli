# Import Existing EVM Key into AWS KMS

This guide shows how to:
1. import an existing EVM private key into AWS KMS, and
2. configure your signer to use that solver key via KMS (e.g. `type = "aws_kms"` in rebalancer/oracle services).

It is written for this repo's AWS KMS signer configuration, which supports:
- `type = "aws_kms"`
- `key_id`
- `region`

## Prerequisites

- `aws` CLI v2 configured for the target account.
- `openssl`.
- `cast` (Foundry), used to derive the expected EVM address.
- An existing 32-byte EVM private key.

## Important behavior in this repo

At startup, the rebalancer enforces signer/account match:
- signer address from KMS
- `account` in `[[chains]]` config

If they differ, startup fails with `Signer/account mismatch`.

At startup, the oracle operator enforces signer/operator match:
- signer address from KMS
- `operator_address` in `oracle.toml`

## 1) Prepare key and expected address

Set your existing private key:

```bash
export EVM_PK=0x<64-hex-chars>
```

Derive the expected EVM address (this must match `account` in your service config):

```bash
export SOLVER_ADDR=$(cast wallet address --private-key "$EVM_PK")
echo "$SOLVER_ADDR"
```

## 2) Create an external KMS key (secp256k1)

Create key:

```bash
export AWS_REGION=us-east-1
export KEY_ARN=$(aws kms create-key \
  --region "$AWS_REGION" \
  --description "Solver signer (imported EVM key)" \
  --key-usage SIGN_VERIFY \
  --key-spec ECC_SECG_P256K1 \
  --origin EXTERNAL \
  --query 'KeyMetadata.Arn' \
  --output text)

echo "$KEY_ARN"
```

Optional alias:

```bash
aws kms create-alias \
  --region "$AWS_REGION" \
  --alias-name alias/solver-eden \
  --target-key-id "$KEY_ARN"
```

## 3) Get import parameters from KMS

```bash
# Optional precheck: key should be EXTERNAL + PendingImport
aws kms describe-key \
  --region "$AWS_REGION" \
  --key-id "$KEY_ARN" \
  --query 'KeyMetadata.[Origin,KeySpec,KeyUsage,KeyState]'

aws kms get-parameters-for-import \
  --region "$AWS_REGION" \
  --key-id "$KEY_ARN" \
  --wrapping-algorithm RSAES_OAEP_SHA_256 \
  --wrapping-key-spec RSA_4096 \
  > import-params.json

jq -r '.PublicKey' import-params.json | base64 --decode > WrappingPublicKey.bin
jq -r '.ImportToken' import-params.json | base64 --decode > ImportToken.bin
```

## 4) Convert EVM private key to DER key material

KMS expects secp256k1 private key material in DER format.
For this flow, use PKCS#8 DER (via SEC1 -> PEM -> PKCS#8 DER conversion).

```bash
PK_HEX=$(echo "$EVM_PK" | sed 's/^0x//')
if [ ${#PK_HEX} -ne 64 ]; then
  echo "Expected 32-byte private key (64 hex chars)"
  exit 1
fi

# Build SEC1 DER ECPrivateKey
printf "302e0201010420%sA00706052B8104000A" "$PK_HEX" | xxd -r -p > sec1.der

# Convert to PEM, then PKCS#8 DER
openssl ec -inform DER -in sec1.der -out sec1.pem
openssl pkcs8 -topk8 -nocrypt -in sec1.pem -outform DER -out KeyMaterial.der

# Optional sanity checks
openssl ec -in sec1.pem -noout -text >/dev/null
openssl pkcs8 -inform DER -in KeyMaterial.der -nocrypt -out /dev/null
```

## 5) Encrypt key material for import

```bash
openssl pkeyutl -encrypt \
  -pubin \
  -inkey WrappingPublicKey.bin \
  -keyform DER \
  -in KeyMaterial.der \
  -out EncryptedKeyMaterial.bin \
  -pkeyopt rsa_padding_mode:oaep \
  -pkeyopt rsa_oaep_md:sha256 \
  -pkeyopt rsa_mgf1_md:sha256
```

## 6) Import key material into KMS

```bash
aws kms import-key-material \
  --region "$AWS_REGION" \
  --key-id "$KEY_ARN" \
  --import-token fileb://ImportToken.bin \
  --encrypted-key-material fileb://EncryptedKeyMaterial.bin \
  --expiration-model KEY_MATERIAL_DOES_NOT_EXPIRE
```

## 7) Configure signer to use the solver key via KMS

### Rebalancer (`.config/rebalancer.toml`)

In rebalancer config, for each chain that should use KMS:

```toml
[[chains]]
name = "eden"
chain_id = 3735928814
domain_id = 2147483647
rpc_url = "https://ev-reth-eden-testnet.binarybuilders.services:8545/"
account = "0x<must-match-derived-address>"

[chains.signer]
type = "aws_kms"
key_id = "arn:aws:kms:us-east-1:123456789012:key/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
region = "us-east-1"
```

You can also use an alias for `key_id` (for example `alias/solver-eden`).

### Oracle Operator (`.config/oracle.toml`)

Oracle operator uses a single top-level signer across all chains:

```toml
operator_address = "0x<must-match-derived-address>"

[signer]
type = "aws_kms"
key_id = "arn:aws:kms:us-east-1:123456789012:key/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
region = "us-east-1"

[[chains]]
name = "eden"
chain_id = 3735928814
rpc_url = "https://ev-reth-eden-testnet.binarybuilders.services:8545/"
oracle_address = "0x..."
output_settler_address = "0x..."
input_settler_address = "0x..."
```

If you use `type = "env"` in oracle config, it loads `ORACLE_OPERATOR_PK`.

## 8) AWS credentials at runtime

The signer uses AWS SDK default credential resolution. Common options:

```bash
export AWS_PROFILE=<profile-name>
# or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN
```

Then start your service with the updated signer config.

## 9) Required IAM permissions

For runtime signer usage, the principal running the service needs at least:
- `kms:Sign`
- `kms:GetPublicKey`
- `kms:DescribeKey`

For import-time setup, you also need:
- `kms:CreateKey`
- `kms:GetParametersForImport`
- `kms:ImportKeyMaterial`

Scope these permissions to the specific KMS key where possible.

## 10) Troubleshooting

- `Signer/account mismatch ...`
  - `account` in your service config does not match the imported key's address.
  - Recompute with `cast wallet address --private-key "$EVM_PK"` and update `account`.

- `Failed to initialize aws_kms signer for chain ...`
  - wrong `key_id`/`region`
  - missing AWS credentials
  - missing KMS permissions

- `AccessDeniedException` from KMS
  - principal lacks key policy or IAM allow for `kms:Sign`/`kms:GetPublicKey`.

- import fails with key material errors
  - verify key is secp256k1 and DER encoding is correct (PKCS#8 DER in this guide).
  - regenerate `WrappingPublicKey.bin` + `ImportToken.bin` and re-encrypt; they must match the same key/region request.
  - ensure `--region` is consistent across `create-key`, `get-parameters-for-import`, and `import-key-material`.

## Security notes

- Do not commit private keys or generated key material files.
- Remove local artifacts when done:

```bash
rm -f import-params.json WrappingPublicKey.bin ImportToken.bin sec1.der sec1.pem KeyMaterial.der EncryptedKeyMaterial.bin
```

- Prefer separate KMS keys per environment (and optionally per chain).
