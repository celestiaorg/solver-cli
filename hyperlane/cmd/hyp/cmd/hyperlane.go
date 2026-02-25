package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"cosmossdk.io/math"
	"github.com/bcp-innovations/hyperlane-cosmos/util"
	hooktypes "github.com/bcp-innovations/hyperlane-cosmos/x/core/02_post_dispatch/types"
	coretypes "github.com/bcp-innovations/hyperlane-cosmos/x/core/types"
	warptypes "github.com/bcp-innovations/hyperlane-cosmos/x/warp/types"
)

// setupCoreInfra deploys the shared Hyperlane core infrastructure (IGP, hooks, mailbox).
// Returns mailboxID, hooksID, merkleTreeHookID for use by token-specific setup functions.
func setupCoreInfra(ctx context.Context, broadcaster *Broadcaster, ismID util.HexAddress) (util.HexAddress, util.HexAddress, util.HexAddress) {
	// Create IGP (Interchain Gas Paymaster) for fee quoting
	msgCreateIgp := hooktypes.MsgCreateIgp{
		Owner: broadcaster.address.String(),
		Denom: denom,
	}

	res := broadcaster.BroadcastTx(ctx, &msgCreateIgp)
	igpID := parseIgpIDFromEvents(res.Events)

	// Set destination gas config for anvil1 (domain 131337)
	msgSetDestGasConfigEvolve := hooktypes.MsgSetDestinationGasConfig{
		Owner: broadcaster.address.String(),
		IgpId: igpID,
		DestinationGasConfig: &hooktypes.DestinationGasConfig{
			RemoteDomain: 131337,
			GasOracle: &hooktypes.GasOracle{
				TokenExchangeRate: math.NewInt(1),
				GasPrice:          math.NewInt(1),
			},
			GasOverhead: math.NewInt(100000),
		},
	}
	broadcaster.BroadcastTx(ctx, &msgSetDestGasConfigEvolve)

	// Set destination gas config for anvil2 (domain 31338)
	msgSetDestGasConfigEvolve2 := hooktypes.MsgSetDestinationGasConfig{
		Owner: broadcaster.address.String(),
		IgpId: igpID,
		DestinationGasConfig: &hooktypes.DestinationGasConfig{
			RemoteDomain: 31338,
			GasOracle: &hooktypes.GasOracle{
				TokenExchangeRate: math.NewInt(1),
				GasPrice:          math.NewInt(1),
			},
			GasOverhead: math.NewInt(100000),
		},
	}
	broadcaster.BroadcastTx(ctx, &msgSetDestGasConfigEvolve2)

	msgCreateNoopHooks := hooktypes.MsgCreateNoopHook{
		Owner: broadcaster.address.String(),
	}

	res = broadcaster.BroadcastTx(ctx, &msgCreateNoopHooks)
	hooksID := parseHooksIDFromEvents(res.Events)

	msgCreateMailBox := coretypes.MsgCreateMailbox{
		Owner:        broadcaster.address.String(),
		DefaultIsm:   ismID,
		LocalDomain:  69420,
		DefaultHook:  &hooksID,
		RequiredHook: &hooksID,
	}

	res = broadcaster.BroadcastTx(ctx, &msgCreateMailBox)
	mailboxID := parseMailboxIDFromEvents(res.Events)

	msgCreateMerkleTreeHook := hooktypes.MsgCreateMerkleTreeHook{
		MailboxId: mailboxID,
		Owner:     broadcaster.address.String(),
	}

	res = broadcaster.BroadcastTx(ctx, &msgCreateMerkleTreeHook)
	merkleTreeHookID := parseMerkleTreeHookIDFromEvents(res.Events)

	msgSetMailbox := coretypes.MsgSetMailbox{
		Owner:             broadcaster.address.String(),
		MailboxId:         mailboxID,
		DefaultIsm:        &ismID,
		DefaultHook:       &hooksID,
		RequiredHook:      &merkleTreeHookID,
		RenounceOwnership: false,
	}

	broadcaster.BroadcastTx(ctx, &msgSetMailbox)

	return mailboxID, hooksID, merkleTreeHookID
}

// SetupCollateralWithIsm deploys the cosmosnative Hyperlane components with a COLLATERAL token.
// This is used when Celestia is the origin chain (locks native tokens like utia).
func SetupCollateralWithIsm(ctx context.Context, broadcaster *Broadcaster, ismID util.HexAddress) {
	mailboxID, hooksID, merkleTreeHookID := setupCoreInfra(ctx, broadcaster, ismID)

	msgCreateCollateralToken := warptypes.MsgCreateCollateralToken{
		Owner:         broadcaster.address.String(),
		OriginMailbox: mailboxID,
		OriginDenom:   denom,
	}

	res := broadcaster.BroadcastTx(ctx, &msgCreateCollateralToken)
	tokenID := parseCollateralTokenIDFromEvents(res.Events)

	// Set ISM on collateral token
	msgSetToken := warptypes.MsgSetToken{
		Owner:    broadcaster.address.String(),
		TokenId:  tokenID,
		IsmId:    &ismID,
		NewOwner: broadcaster.address.String(),
	}

	broadcaster.BroadcastTx(ctx, &msgSetToken)

	cfg := &HyperlaneConfig{
		IsmID:          ismID,
		DefaultHookID:  hooksID,
		RequiredHookID: merkleTreeHookID,
		MailboxID:      mailboxID,
		TokenID:        tokenID,
	}

	writeConfig(cfg)
}

// SetupSyntheticWithIsm deploys the cosmosnative Hyperlane components with a SYNTHETIC token.
// This is used when Celestia is NOT the origin chain — it receives minted synthetic tokens
// from an EVM chain where the collateral/native token lives.
func SetupSyntheticWithIsm(ctx context.Context, broadcaster *Broadcaster, ismID util.HexAddress) {
	mailboxID, hooksID, merkleTreeHookID := setupCoreInfra(ctx, broadcaster, ismID)

	msgCreateSyntheticToken := warptypes.MsgCreateSyntheticToken{
		Owner:         broadcaster.address.String(),
		OriginMailbox: mailboxID,
	}

	res := broadcaster.BroadcastTx(ctx, &msgCreateSyntheticToken)
	tokenID := parseSyntheticTokenIDFromEvents(res.Events)

	// Set ISM on synthetic token
	msgSetToken := warptypes.MsgSetToken{
		Owner:    broadcaster.address.String(),
		TokenId:  tokenID,
		IsmId:    &ismID,
		NewOwner: broadcaster.address.String(),
	}

	broadcaster.BroadcastTx(ctx, &msgSetToken)

	cfg := &HyperlaneConfig{
		IsmID:            ismID,
		DefaultHookID:    hooksID,
		RequiredHookID:   merkleTreeHookID,
		MailboxID:        mailboxID,
		SyntheticTokenID: tokenID,
	}

	writeConfig(cfg)
}

// SetupRemoteRouter links the provided token identifier on the cosmosnative deployment with the receiver contract on the counterparty.
func SetupRemoteRouter(ctx context.Context, broadcaster *Broadcaster, tokenID util.HexAddress, domain uint32, receiverContract string) {
	msgEnrollRemoteRouter := warptypes.MsgEnrollRemoteRouter{
		Owner:   broadcaster.address.String(),
		TokenId: tokenID,
		RemoteRouter: &warptypes.RemoteRouter{
			ReceiverDomain:   domain,
			ReceiverContract: receiverContract,
			Gas:              math.ZeroInt(),
		},
	}

	res := broadcaster.BroadcastTx(ctx, &msgEnrollRemoteRouter)
	recvContract := parseReceiverContractFromEvents(res.Events)

	fmt.Printf("successfully registered remote router on Hyperlane cosmosnative: \n%s", recvContract)
}

// CreateSyntheticToken creates a new synthetic token on an existing Celestia Hyperlane deployment.
// Unlike SetupSyntheticWithIsm, this does NOT redeploy core infrastructure — it reuses an existing mailbox.
func CreateSyntheticToken(ctx context.Context, broadcaster *Broadcaster, mailboxID util.HexAddress, ismID util.HexAddress) util.HexAddress {
	msgCreateSyntheticToken := warptypes.MsgCreateSyntheticToken{
		Owner:         broadcaster.address.String(),
		OriginMailbox: mailboxID,
	}

	res := broadcaster.BroadcastTx(ctx, &msgCreateSyntheticToken)
	tokenID := parseSyntheticTokenIDFromEvents(res.Events)

	// Set ISM on synthetic token
	msgSetToken := warptypes.MsgSetToken{
		Owner:    broadcaster.address.String(),
		TokenId:  tokenID,
		IsmId:    &ismID,
		NewOwner: broadcaster.address.String(),
	}

	broadcaster.BroadcastTx(ctx, &msgSetToken)

	fmt.Printf("Created synthetic token: %s (mailbox: %s, ism: %s)\n", tokenID, mailboxID, ismID)
	return tokenID
}

func writeConfig(cfg *HyperlaneConfig) {
	out, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		log.Fatalf("failed to marshal config: %v", err)
	}

	outputPath := "hyperlane-cosmosnative.json"
	if err := os.WriteFile(outputPath, out, 0o644); err != nil {
		log.Fatalf("failed to write JSON file: %v", err)
	}

	fmt.Printf("successfully deployed Hyperlane: \n%s\n", string(out))
}
