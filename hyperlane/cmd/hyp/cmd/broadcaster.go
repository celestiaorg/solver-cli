package cmd

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/celestiaorg/celestia-app/v7/app/encoding"
	abci "github.com/cometbft/cometbft/abci/types"
	rpcclient "github.com/cometbft/cometbft/rpc/client/http"
	coretypes "github.com/cometbft/cometbft/rpc/core/types"
	"github.com/cosmos/cosmos-sdk/client/tx"
	"github.com/cosmos/cosmos-sdk/crypto/hd"
	"github.com/cosmos/cosmos-sdk/crypto/keyring"
	"github.com/cosmos/cosmos-sdk/crypto/keys/secp256k1"
	sdk "github.com/cosmos/cosmos-sdk/types"
	"github.com/cosmos/cosmos-sdk/types/tx/signing"
	authtypes "github.com/cosmos/cosmos-sdk/x/auth/types"
)

const (
	denom     = "utia"
	feeAmount = 800
	gasLimit  = 200000
)

var (
	mnemonic = getEnvOrDefault("HYP_MNEMONIC", "sphere exhibit essay fancy okay tuna leaf culture elbow drum trip exchange scorpion excuse parent sun make spot chunk mouse tenant shoe hurt scale")
	chainID  = getEnvOrDefault("HYP_CHAIN_ID", "celestia-zkevm-testnet")
)

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

type Broadcaster struct {
	enc encoding.Config

	rpcClient *rpcclient.HTTP

	address sdk.AccAddress

	kr keyring.Keyring

	// Track sequence and account number manually to work around celestia-app v7 gRPC API limitations
	accountNumber uint64
	sequence      uint64
}

func NewBroadcaster(enc encoding.Config, rpcAddr string) *Broadcaster {
	// Recover private key from mnemonic
	secp256k1Derv := hd.Secp256k1.Derive()
	privKey, err := secp256k1Derv(mnemonic, "", hd.CreateHDPath(118, 0, 0).String())
	if err != nil {
		log.Fatalf("failed to derive pk from mnemonic: %v", err)
	}

	pk := secp256k1.PrivKey{Key: privKey}
	signerAddr := sdk.AccAddress(pk.PubKey().Address())

	kr := keyring.NewInMemory(enc.Codec)
	if err := kr.ImportPrivKeyHex(signerAddr.String(), hex.EncodeToString(pk.Bytes()), pk.Type()); err != nil {
		log.Fatalf("key import failed")
	}

	rpcClient, err := rpcclient.New(rpcAddr, "/websocket")
	if err != nil {
		log.Fatalf("failed to create RPC client: %v", err)
	}

	b := &Broadcaster{
		enc:           enc,
		rpcClient:     rpcClient,
		address:       signerAddr,
		kr:            kr,
		accountNumber: 1, // hyp account is account #1 in the genesis (after validator=0)
		sequence:      0,
	}

	// Query the current sequence from the blockchain
	if err := b.refreshSequence(context.Background()); err != nil {
		log.Printf("Warning: failed to query account sequence, using 0: %v", err)
	}

	return b
}

func (b *Broadcaster) BroadcastTx(ctx context.Context, msgs ...sdk.Msg) *sdk.TxResponse {
	// Using manually tracked account number and sequence for celestia-app v7 compatibility
	log.Printf("Broadcasting tx with account_number=%d sequence=%d", b.accountNumber, b.sequence)

	txBuilder := b.enc.TxConfig.NewTxBuilder()
	if err := txBuilder.SetMsgs(msgs...); err != nil {
		log.Fatalf("set msgs: %v", err)
	}

	txBuilder.SetGasLimit(gasLimit)
	txBuilder.SetFeeAmount(sdk.NewCoins(sdk.NewInt64Coin(denom, feeAmount)))

	factory := tx.Factory{}.
		WithKeybase(b.kr).
		WithSignMode(signing.SignMode_SIGN_MODE_DIRECT).
		WithTxConfig(b.enc.TxConfig).
		WithChainID(chainID).
		WithAccountNumber(b.accountNumber).
		WithSequence(b.sequence)

	if err := tx.Sign(ctx, factory, b.address.String(), txBuilder, false); err != nil {
		log.Fatalf("failed to sign tx: %v", err)
	}

	txBytes, err := b.enc.TxConfig.TxEncoder()(txBuilder.GetTx())
	if err != nil {
		log.Fatalf("encode tx: %v", err)
	}

	// Broadcast via CometBFT RPC instead of Cosmos gRPC
	res, err := b.rpcClient.BroadcastTxSync(ctx, txBytes)
	if err != nil {
		log.Fatalf("broadcast tx failed: %v", err)
	}
	if res.Code != abci.CodeTypeOK {
		log.Printf("failed response: code=%d log=%s", res.Code, res.Log)
		log.Fatalf("broadcast tx failed with code %d", res.Code)
	}

	txHash := fmt.Sprintf("%X", res.Hash)
	log.Printf("Transaction broadcast successful, hash: %s", txHash)

	txResp, err := b.waitForTxResponse(ctx, txHash)
	if err != nil {
		log.Fatalf("broadcast tx failed: %v", err)
	}

	// Increment sequence after successful broadcast
	b.sequence++
	log.Printf("Transaction successful, sequence incremented to %d", b.sequence)

	return txResp
}

func (b *Broadcaster) waitForTxResponse(ctx context.Context, hash string) (*sdk.TxResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	hashBytes, err := hex.DecodeString(hash)
	if err != nil {
		return nil, fmt.Errorf("invalid tx hash: %w", err)
	}

	for {
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("timeout exceeded while waiting for tx confirmation: %w", ctx.Err())
		case <-ticker.C:
			res, err := b.rpcClient.Tx(ctx, hashBytes, false)
			if err != nil {
				// Tx not found yet; continue waiting
				continue
			}

			if res != nil && res.Height > 0 {
				return b.parseTxResponse(res), nil
			}
		}
	}
}

func (b *Broadcaster) parseTxResponse(res *coretypes.ResultTx) *sdk.TxResponse {
	return &sdk.TxResponse{
		Height:    res.Height,
		TxHash:    fmt.Sprintf("%X", res.Hash),
		Code:      res.TxResult.Code,
		Data:      base64.StdEncoding.EncodeToString(res.TxResult.Data),
		RawLog:    res.TxResult.Log,
		GasWanted: res.TxResult.GasWanted,
		GasUsed:   res.TxResult.GasUsed,
		Events:    res.TxResult.Events,
	}
}

func (b *Broadcaster) refreshSequence(ctx context.Context) error {
	// Query account info via ABCI query
	path := "/cosmos.auth.v1beta1.Query/Account"

	// Create the query request
	queryReq := &authtypes.QueryAccountRequest{
		Address: b.address.String(),
	}

	reqBytes, err := b.enc.Codec.Marshal(queryReq)
	if err != nil {
		return fmt.Errorf("failed to marshal query request: %w", err)
	}

	result, err := b.rpcClient.ABCIQuery(ctx, path, reqBytes)
	if err != nil {
		return fmt.Errorf("failed to query account: %w", err)
	}

	if result.Response.Code != 0 {
		return fmt.Errorf("query failed with code %d: %s", result.Response.Code, result.Response.Log)
	}

	var queryResp authtypes.QueryAccountResponse
	if err := b.enc.Codec.Unmarshal(result.Response.Value, &queryResp); err != nil {
		return fmt.Errorf("failed to unmarshal query response: %w", err)
	}

	var acc authtypes.AccountI
	if err := b.enc.InterfaceRegistry.UnpackAny(queryResp.Account, &acc); err != nil {
		return fmt.Errorf("failed to unpack account: %w", err)
	}

	b.accountNumber = acc.GetAccountNumber()
	b.sequence = acc.GetSequence()
	log.Printf("Queried account sequence: account_number=%d sequence=%d", b.accountNumber, b.sequence)

	return nil
}
