package cmd

import (
	"log"
	"strconv"

	"github.com/bcp-innovations/hyperlane-cosmos/util"
	ismtypes "github.com/bcp-innovations/hyperlane-cosmos/x/core/01_interchain_security/types"
	"github.com/celestiaorg/celestia-app/v7/app"
	"github.com/celestiaorg/celestia-app/v7/app/encoding"
	"github.com/spf13/cobra"
)

type HyperlaneConfig struct {
	IsmID          util.HexAddress `json:"ism_id"`
	MailboxID      util.HexAddress `json:"mailbox_id"`
	DefaultHookID  util.HexAddress `json:"default_hook_id"`
	RequiredHookID util.HexAddress `json:"required_hook_id"`
	// For collateral deployments
	TokenID util.HexAddress `json:"collateral_token_id,omitempty"`
	// For synthetic deployments
	SyntheticTokenID util.HexAddress `json:"synthetic_token_id,omitempty"`
}

func NewRootCmd() *cobra.Command {
	rootCmd := &cobra.Command{
		Use:   "hyp",
		Short: "A CLI for deploying hyperlane cosmosnative infrastructure",
		Long: `This CLI provides deployment functionality for hyperlane cosmosnative modules.
		It deploys basic core components and warp route tokens for testing purposes.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return cmd.Help()
		},
	}

	rootCmd.AddCommand(getDeployNoopIsmStackCmd())
	rootCmd.AddCommand(getDeploySyntheticIsmStackCmd())
	rootCmd.AddCommand(getEnrollRouterCmd())
	return rootCmd
}

func getDeployNoopIsmStackCmd() *cobra.Command {
	deployCmd := &cobra.Command{
		Use:   "deploy-noopism [celestia-rpc]",
		Short: "Deploy cosmosnative hyperlane components with collateral token using a NoopIsm",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			ctx := cmd.Context()
			enc := encoding.MakeConfig(app.ModuleEncodingRegisters...)

			rpcAddr := args[0]
			broadcaster := NewBroadcaster(enc, rpcAddr)
			msgCreateNoopISM := ismtypes.MsgCreateNoopIsm{
				Creator: broadcaster.address.String(),
			}

			res := broadcaster.BroadcastTx(ctx, &msgCreateNoopISM)
			ismID := parseIsmIDFromNoopISMEvents(res.Events)

			SetupCollateralWithIsm(ctx, broadcaster, ismID)
		},
	}
	return deployCmd
}

func getDeploySyntheticIsmStackCmd() *cobra.Command {
	deployCmd := &cobra.Command{
		Use:   "deploy-syntheticism [celestia-rpc]",
		Short: "Deploy cosmosnative hyperlane components with synthetic token using a NoopIsm",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			ctx := cmd.Context()
			enc := encoding.MakeConfig(app.ModuleEncodingRegisters...)

			rpcAddr := args[0]
			broadcaster := NewBroadcaster(enc, rpcAddr)
			msgCreateNoopISM := ismtypes.MsgCreateNoopIsm{
				Creator: broadcaster.address.String(),
			}

			res := broadcaster.BroadcastTx(ctx, &msgCreateNoopISM)
			ismID := parseIsmIDFromNoopISMEvents(res.Events)

			SetupSyntheticWithIsm(ctx, broadcaster, ismID)
		},
	}
	return deployCmd
}

func getEnrollRouterCmd() *cobra.Command {
	enrollRouterCmd := &cobra.Command{
		Use:   "enroll-remote-router [rpc-addr] [token-id] [remote-domain] [remote-contract]",
		Short: "Enroll the remote router contract address for a cosmosnative hyperlane warp route",
		Args:  cobra.ExactArgs(4),
		Run: func(cmd *cobra.Command, args []string) {
			ctx := cmd.Context()
			enc := encoding.MakeConfig(app.ModuleEncodingRegisters...)

			rpcAddr := args[0]
			broadcaster := NewBroadcaster(enc, rpcAddr)

			tokenID, err := util.DecodeHexAddress(args[1])
			if err != nil {
				log.Fatalf("failed to parse token id: %v", err)
			}

			domain, err := strconv.ParseUint(args[2], 10, 32)
			if err != nil {
				log.Fatalf("failed to parse remote domain: %v", err)
			}

			receiverContract := args[3]

			SetupRemoteRouter(ctx, broadcaster, tokenID, uint32(domain), receiverContract)
		},
	}
	return enrollRouterCmd
}
