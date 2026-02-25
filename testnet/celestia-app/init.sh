#!/bin/sh

GENESIS_FILE="/home/celestia/.celestia-app/config/genesis.json"
HOME_DIR="/home/celestia/.celestia-app"
MNEMONIC_DEFAULT="pond please denial auto candy muffin elegant amused hole cinnamon glory desk purity proud elevator rubber gadget embody life custom disorder nuclear ship lock"
MNEMONIC_HYP="sphere exhibit essay fancy okay tuna leaf culture elbow drum trip exchange scorpion excuse parent sun make spot chunk mouse tenant shoe hurt scale"
MNEMONIC_NODE="father remove minimum call daughter fly runway sponsor two exile bean sting address person hidden view want black strong text fashion ethics nephew reform"

if [ ! -f "$GENESIS_FILE" ]; then
    echo "Initializing Celestia App state..."

    celestia-appd init zkevm-test --chain-id celestia-zkevm-testnet --home $HOME_DIR
    celestia-appd config set client chain-id celestia-zkevm-testnet --home $HOME_DIR
    celestia-appd config set client keyring-backend test --home $HOME_DIR

    # Enable app grpc and expose to network
    celestia-appd config set app grpc.enable true --home $HOME_DIR
    celestia-appd config set app grpc.address 0.0.0.0:9090 --home $HOME_DIR

    # Enable app api and expose to network
    celestia-appd config set app api.enable true --home $HOME_DIR
    celestia-appd config set app api.address tcp://0.0.0.0:1317 --home $HOME_DIR

    # Expose core rpc to network
    sed -i 's#laddr = "tcp://127.0.0.1:26657"#laddr = "tcp://0.0.0.0:26657"#' $HOME_DIR/config/config.toml
    # Enable tx indexing
    sed -i 's#indexer = "null"#indexer = "kv"#' $HOME_DIR/config/config.toml
    # Keep abci responses (required by hyperlane relayer for /block_results rpc queries)
    sed -i 's#discard_abci_responses = true#discard_abci_responses = false#' $HOME_DIR/config/config.toml

    celestia-appd keys add validator --home $HOME_DIR

    # Use a deterministic address for the default sender account (used for transfers, etc)
    echo $MNEMONIC_DEFAULT | celestia-appd keys add default --recover --home $HOME_DIR
    # Use a deterministic address for hyperlane operator account (deployment, relayer)
    echo $MNEMONIC_HYP | celestia-appd keys add hyp --recover --home $HOME_DIR
    # Use a deterministic address for celestia-node operator account recovery
    echo $MNEMONIC_NODE | celestia-appd keys add node --recover --home $HOME_DIR

    celestia-appd genesis add-genesis-account "$(celestia-appd keys show default -a --home $HOME_DIR)" 1000000000000utia --home $HOME_DIR
    celestia-appd genesis add-genesis-account "$(celestia-appd keys show hyp -a --home $HOME_DIR)" 1000000000000utia --home $HOME_DIR
    celestia-appd genesis add-genesis-account "$(celestia-appd keys show node -a --home $HOME_DIR)" 1000000000000utia --home $HOME_DIR
    celestia-appd genesis add-genesis-account "$(celestia-appd keys show validator -a --home $HOME_DIR)" 1000000000000utia --home $HOME_DIR
    celestia-appd genesis gentx validator 100000000utia --fees 500utia --home $HOME_DIR
    celestia-appd genesis collect-gentxs --home $HOME_DIR
    celestia-appd genesis validate --home $HOME_DIR

    echo "Successfully initialized chain state."
else
    echo "Skipping init, genesis.json already exists."
fi
