SOLVER_CLI=target/release/solver-cli
FORCE_FLAG=$(if $(FORCE),--force,)

## help: Show available commands
help: Makefile
	@echo "OIF E2E Solver Commands:"
	@sed -n 's/^##//p' $< | column -t -s ':' | sed -e 's/^/  /'
.PHONY: help

## build: Build the solver-cli (with solver-runtime for in-process solver)
build:
	@cd solver-cli && cargo build --release --features solver-runtime
.PHONY: build

## build-all: Build all service binaries (solver-cli, oracle-operator, oif-aggregator)
build-all: build
	@cd oracle-operator && cargo build --release
	@cargo install --git https://github.com/celestiaorg/oif-aggregator --branch jonas/freeze-v0.2.0 oif-aggregator --root .aggregator --force 2>&1 | tail -1
.PHONY: build-all

## fmt: Format all Rust workspace crates with rustfmt
fmt:
	@cargo fmt --all
.PHONY: fmt

## fmt-check: Check Rust formatting across the workspace
fmt-check:
	@cargo fmt --all --check
.PHONY: fmt-check

## lint: Run clippy across the Rust workspace
lint:
	@cargo clippy --workspace --all-targets --all-features -- -D warnings
.PHONY: lint

## test-rust: Run Rust workspace tests
test-rust:
	@cargo test --workspace --all-targets
.PHONY: test-rust

## ci-rust: Run the full Rust quality suite locally
ci-rust: fmt-check lint test-rust
.PHONY: ci-rust

# ============================================================================
# Docker Image Builds
# ============================================================================

## docker-build-hyperlane: Build hyperlane-init Docker image
docker-build-hyperlane:
	@echo "Building ghcr.io/celestiaorg/hyperlane-init:local..."
	@docker build -t ghcr.io/celestiaorg/hyperlane-init:local -f hyperlane/Dockerfile .
.PHONY: docker-build-hyperlane

## docker-build: Build all required Docker images
## Note: celestia-app uses pre-built ghcr.io/celestiaorg/celestia-app-standalone:v7.0.0-rc0
docker-build: docker-build-hyperlane
	@docker image inspect forwarding-relayer:local > /dev/null 2>&1 || \
		(docker pull ghcr.io/celestiaorg/forwarding-relayer@sha256:0195cd4bd9665cc4105b42fb75a175f234626c678ac5e96ef47043fa96a20010 && \
		 docker tag ghcr.io/celestiaorg/forwarding-relayer@sha256:0195cd4bd9665cc4105b42fb75a175f234626c678ac5e96ef47043fa96a20010 forwarding-relayer:local)
	@echo "All Docker images ready!"
.PHONY: docker-build

# ============================================================================
# Infrastructure (Chains + Hyperlane + Forwarding)
# ============================================================================

## start: Start all infrastructure (Celestia + 2 Anvil chains + Hyperlane + forwarding relayer)
start:
	@echo "Starting infrastructure via Docker Compose..."
	@docker compose up -d
	@echo "Waiting for hyperlane-init to complete deployment..."
	@docker compose wait hyperlane-init 2>/dev/null || \
		(echo "Waiting for hyperlane-init container..." && \
		while docker compose ps hyperlane-init --format '{{.State}}' 2>/dev/null | grep -q running; do sleep 5; done)
	@echo ""
	@echo "Copying Hyperlane addresses to .config/..."
	@mkdir -p .config
	@docker cp hyperlane-init:/home/hyperlane/hyperlane-addresses.json .config/hyperlane-addresses.json 2>/dev/null || \
		cp hyperlane/hyperlane-addresses.json .config/hyperlane-addresses.json 2>/dev/null || \
		echo "Warning: Could not copy hyperlane-addresses.json (may not be ready yet)"
	@echo "All infrastructure ready!"
	@echo "  Anvil1 (31337):     http://127.0.0.1:8545"
	@echo "  Anvil2 (31338):     http://127.0.0.1:8546"
	@echo "  Celestia:           http://127.0.0.1:26657"
	@echo "  Forwarding Backend: http://127.0.0.1:8080"
.PHONY: start

## stop: Stop all services (infrastructure + solver + oracle + aggregator)
stop:
	@docker compose down -v 2>/dev/null || true
	@$(SOLVER_CLI) solver stop 2>/dev/null || true
	@pkill -9 -f "solver-cli solver start" 2>/dev/null || true
	@pkill -9 -f "solver-cli rebalancer" 2>/dev/null || true
	@pkill -9 -f oracle-operator 2>/dev/null || true
	@pkill -9 -f "oif-aggregator" 2>/dev/null || true
	@pkill -9 -f "tsx.*server/index.ts" 2>/dev/null || true
	@pkill -9 -f "next dev" 2>/dev/null || true
	@# Clean Hyperlane artifacts (Anvil state is wiped by docker down -v, so these are stale)
	@rm -f hyperlane/hyperlane-cosmosnative.json hyperlane/hyperlane-addresses.json
	@rm -f hyperlane/registry/chains/anvil1/addresses.yaml hyperlane/registry/chains/anvil2/addresses.yaml
	@rm -rf hyperlane/registry/deployments/
	@sed -i'' -e 's|token: "0x[a-fA-F0-9]*"|token: "MOCK_USDC_ADDRESS_PLACEHOLDER"|' hyperlane/configs/warp-config.yaml 2>/dev/null || true
	@echo "All services stopped"
.PHONY: stop

## logs: Show logs for a service (use SVC=anvil1, SVC=relayer, etc.)
logs:
	@docker compose logs $(or $(SVC),--tail=50)
.PHONY: logs

## logs-relayer: Show Hyperlane relayer logs
logs-relayer:
	@docker compose logs relayer -f
.PHONY: logs-relayer

## logs-forwarding: Show forwarding relayer logs
logs-forwarding:
	@docker compose logs forwarding-relayer -f
.PHONY: logs-forwarding

# ============================================================================
# Solver CLI Commands
# ============================================================================

## init: Initialize project state (use FORCE=1 to reinitialize)
init: build
	@$(SOLVER_CLI) init $(FORCE_FLAG)
.PHONY: init

## deploy-permit2: Deploy Permit2 contract to local Anvil chains (fetches bytecode from mainnet)
deploy-permit2:
	@echo "Deploying Permit2 to local Anvil chains..."
	@PERMIT2_CODE=$$(cast code 0x000000000022D473030F116dDEE9F6B43aC78BA3 --rpc-url https://eth.llamarpc.com 2>/dev/null) && \
		cast rpc anvil_setCode 0x000000000022D473030F116dDEE9F6B43aC78BA3 "$$PERMIT2_CODE" --rpc-url http://127.0.0.1:8545 > /dev/null && \
		cast rpc anvil_setCode 0x000000000022D473030F116dDEE9F6B43aC78BA3 "$$PERMIT2_CODE" --rpc-url http://127.0.0.1:8546 > /dev/null && \
		echo "  Permit2 deployed at 0x000000000022D473030F116dDEE9F6B43aC78BA3 on anvil1 + anvil2"
.PHONY: deploy-permit2

## deploy: Deploy OIF contracts to all configured chains (use FORCE=1 to redeploy, CHAINS=a,b to limit)
deploy: build
	@$(SOLVER_CLI) deploy $(FORCE_FLAG) $(if $(CHAINS),--chains $(CHAINS),)
.PHONY: deploy

## configure: Generate solver configuration
configure: build
	@$(SOLVER_CLI) configure
	@./scripts/generate-frontend-config.sh
.PHONY: configure

## fund: Fund solver with tokens on anvil1 (anvil2 gets tokens via 'make rebalance')
fund: build
	@$(SOLVER_CLI) fund --amount 100000000 --chain anvil1
.PHONY: fund

## chain-add: Add a chain with existing contracts (use make chain-add NAME=arbitrum RPC=... INPUT_SETTLER=... OUTPUT_SETTLER=... ORACLE=...)
chain-add: build
	@$(SOLVER_CLI) chain add \
		--name $(NAME) \
		--rpc "$(RPC)" \
		$(if $(CHAIN_ID),--chain-id $(CHAIN_ID),) \
		--input-settler $(INPUT_SETTLER) \
		--output-settler $(OUTPUT_SETTLER) \
		--oracle $(ORACLE) \
		$(if $(TOKEN_ADDR),--token $(TOKEN_SYMBOL)=$(TOKEN_ADDR),)
.PHONY: chain-add

## chain-list: List all configured chains
chain-list: build
	@$(SOLVER_CLI) chain list
.PHONY: chain-list

## chain-remove: Remove a chain (use CHAIN=name or CHAIN=id)
chain-remove: build
	@$(SOLVER_CLI) chain remove --chain $(CHAIN)
.PHONY: chain-remove

## token-add: Add a token to a chain (use CHAIN=name SYMBOL=USDC ADDRESS=0x... DECIMALS=6)
token-add: build
	@$(SOLVER_CLI) token add --chain $(CHAIN) --symbol $(SYMBOL) --address $(ADDRESS) $(if $(DECIMALS),--decimals $(DECIMALS),)
.PHONY: token-add

## token-list: List all tokens across chains (use CHAIN=name to filter)
token-list: build
	@$(SOLVER_CLI) token list $(if $(CHAIN),--chain $(CHAIN),)
.PHONY: token-list

## token-remove: Remove a token from a chain (use CHAIN=name SYMBOL=USDC)
token-remove: build
	@$(SOLVER_CLI) token remove --chain $(CHAIN) --symbol $(SYMBOL)
.PHONY: token-remove

## fund-operator: Fund oracle operator with ETH on all chains
fund-operator:
	@echo "Funding oracle operator on all chains..."
	@. ./.env && \
		OPERATOR_ADDR=$$(python3 -c "import json; print(json.load(open('.config/state.json'))['solver']['operator_address'])") && \
		echo "  Operator address: $$OPERATOR_ADDR" && \
		echo "  Funding on Anvil1 (10 ETH)..." && \
		cast send --rpc-url $$ANVIL1_RPC --private-key $$ANVIL1_PK --value 10ether $$OPERATOR_ADDR 2>/dev/null && \
		if [ ! -z "$$ANVIL2_RPC" ]; then \
			echo "  Funding on Anvil2 (10 ETH)..." && \
			cast send --rpc-url $$ANVIL2_RPC --private-key $$ANVIL2_PK --value 10ether $$OPERATOR_ADDR 2>/dev/null; \
		fi && \
		echo "Oracle operator funded"
.PHONY: fund-operator

## fund-user: Fund user with ETH on all chains for gas
fund-user:
	@echo "Funding user with ETH on all chains..."
	@. ./.env && \
		USER_ADDR=$$(cast wallet address --private-key $$USER_PK) && \
		echo "  User address: $$USER_ADDR" && \
		echo "  Funding on Anvil1 (10 ETH)..." && \
		cast send --rpc-url $$ANVIL1_RPC --private-key $$ANVIL1_PK --value 10ether $$USER_ADDR 2>/dev/null && \
		if [ ! -z "$$ANVIL2_RPC" ]; then \
			echo "  Funding on Anvil2 (10 ETH)..." && \
			cast send --rpc-url $$ANVIL2_RPC --private-key $$ANVIL2_PK --value 10ether $$USER_ADDR; \
		fi && \
		echo "User funded"
.PHONY: fund-user

## mint: Mint tokens on a chain (SYMBOL=USDC, CHAIN=anvil1, TO=user, AMOUNT=10000000)
mint: build
	@unset CHAIN; $(SOLVER_CLI) token mint \
		--chain $(or $(CHAIN),anvil1) \
		--symbol $(or $(SYMBOL),USDC) \
		--to $(or $(TO),user) \
		--amount $(or $(AMOUNT),10000000)
.PHONY: mint

## fund-address: Fund any address with ETH and USDC on anvil1
## Usage: make fund-address ADDR=0x... ETH=10 USDC=100000000
## Uses anvil account 1 (not the solver/deployer) to avoid nonce conflicts
FUNDER_PK := 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
fund-address:
	@[ -n "$(ADDR)" ] || (echo "Error: ADDR is required. Usage: make fund-address ADDR=0x..."; exit 1)
	@. ./.env && \
		echo "Funding $(ADDR) on anvil1..." && \
		cast send --rpc-url $$ANVIL1_RPC --private-key $(FUNDER_PK) --value $(or $(ETH),10)ether $(ADDR) && \
		echo "  Sent $(or $(ETH),10) ETH" && \
		cast send --rpc-url $$ANVIL1_RPC --private-key $(FUNDER_PK) \
			$$(cat .config/state.json | python3 -c "import sys,json; chains=json.load(sys.stdin)['chains']; print(next(c['tokens']['USDC']['address'] for c in chains.values() if c['name']=='anvil1'))") \
			"mint(address,uint256)" $(ADDR) $(or $(USDC),100000000) && \
		echo "  Minted $(or $(USDC),100000000) USDC (raw units)" && \
		echo "Done."
.PHONY: fund-address

# ============================================================================
# Services
# ============================================================================

## solver-start: Start the solver service (with retry for nonce issues)
solver-start: build
	@for i in 1 2 3; do \
		$(SOLVER_CLI) solver start && break || \
		(echo "Solver failed to start, retrying in 5s... ($$i/3)" && sleep 5); \
	done
.PHONY: solver-start

# Alias for convenience
solver: solver-start
.PHONY: solver

## operator-start: Start the oracle operator service
operator-start:
	@set -a && . ./.env && set +a && cd oracle-operator && ORACLE_CONFIG=../.config/oracle.toml RUST_LOG=info cargo run --release
.PHONY: operator-start

# Alias for convenience
operator: operator-start
.PHONY: operator

## rebalancer-start: Start the rebalancer service
rebalancer-start: build
	@$(SOLVER_CLI) rebalancer start
.PHONY: rebalancer-start

## rebalancer-once: Run a single rebalance cycle (used during setup to seed inventory)
rebalancer-once: build
	@$(SOLVER_CLI) rebalancer start --once
.PHONY: rebalancer-once

# Alias for convenience
rebalancer: rebalancer-start
.PHONY: rebalancer

## aggregator-start: Start the OIF aggregator service
aggregator-start:
	@echo "Starting OIF aggregator on port 4000..."
	@test -x .aggregator/bin/oif-aggregator || \
		cargo install --git https://github.com/celestiaorg/oif-aggregator --branch jonas/freeze-v0.2.0 oif-aggregator --root .aggregator --force
	@RUST_LOG=info .aggregator/bin/oif-aggregator
.PHONY: aggregator-start

# Alias for convenience
aggregator: aggregator-start
.PHONY: aggregator

# ============================================================================
# Intents & Balances
# ============================================================================

## intent: Submit a test intent. Use FROM=, TO=, AMOUNT=, ASSET= to customize
intent: build
	@$(SOLVER_CLI) intent submit \
		--amount $(or $(AMOUNT),1000000) \
		$(if $(ASSET),--asset $(ASSET),) \
		$(if $(FROM),--from $(FROM),) \
		$(if $(TO),--to $(TO),)
.PHONY: intent

## intent-back: Submit intent in reverse direction (anvil2 -> anvil1)
intent-back: build
	@$(SOLVER_CLI) intent submit \
		--amount $(or $(AMOUNT),1000000) \
		$(if $(ASSET),--asset $(ASSET),) \
		--from anvil2 --to anvil1
.PHONY: intent-back

## balances: Check balances on all chains (use CHAIN=name to limit to one)
balances: build
	@$(SOLVER_CLI) balances $(if $(CHAIN),--chain $(CHAIN),)
.PHONY: balances

# ============================================================================
# Full Setup & Lifecycle
# ============================================================================

## setup: Full setup (init + deploy + configure + fund)
setup: init deploy-permit2 deploy configure fund fund-operator fund-user
	@echo ""
	@echo "Setup complete! Next steps:"
	@echo "  1. make aggregator - Start OIF aggregator (in separate terminal)"
	@echo "  2. make solver - Start solver service (in another terminal)"
	@echo "  3. make operator - Start oracle operator service (in another terminal)"
	@echo "  4. make rebalancer - Start rebalancer service (in another terminal)"
	@echo "  5. make intent - Submit a test intent"
	@echo "  6. make balances - Check balances"
.PHONY: setup

## reset: Clean and reinitialize everything
reset: clean
	@$(MAKE) setup FORCE=1
.PHONY: reset

## frontend: Start the frontend (backend API + Next.js dev server)
frontend:
	@echo "Installing frontend dependencies..."
	@cd frontend && pnpm install --silent 2>/dev/null
	@echo "Starting eden-portal (server + Next.js on port 3000)..."
	@cd frontend && pnpm dev
.PHONY: frontend

## mvp: Run the full MVP demo (all services + frontend)
mvp:
	@./mvp.sh
.PHONY: mvp

OIF_SERVICES=oif-aggregator oif-solver oif-oracle oif-rebalancer oif-frontend-api oif-frontend

## service-install: Install all OIF systemd units (requires root). Re-run after repo moves.
service-install:
	@REPO=$(shell pwd); \
	for f in scripts/systemd/oif*.service scripts/systemd/oif.target; do \
		dest=/etc/systemd/system/$$(basename $$f); \
		sed "s|/root/solver-cli|$$REPO|g" $$f > $$dest; \
		echo "  Installed $$dest"; \
	done
	@systemctl daemon-reload
	@systemctl enable $(OIF_SERVICES) oif.target
	@echo "All units installed. Run: make service-start"
.PHONY: service-install

## service-start: Start all OIF services
service-start:
	@systemctl start oif.target
.PHONY: service-start

## service-stop: Stop all OIF services
service-stop:
	@systemctl stop oif.target
.PHONY: service-stop

## service-restart: Restart all or one service (SVC=oif-solver to target one)
service-restart:
	@systemctl restart $(or $(SVC),oif.target)
.PHONY: service-restart

## service-status: Show status of all OIF services
service-status:
	@systemctl status $(OIF_SERVICES) --no-pager || true
.PHONY: service-status

## service-logs: Follow logs (SVC=oif-solver for one service, default shows all)
service-logs:
	@journalctl -u $(or $(SVC),"oif-*") -f
.PHONY: service-logs

## clean: Remove generated files and Docker volumes
clean:
	@rm -rf .config
	@rm -rf logs
	@rm -f .anvil1.pid .anvil2.pid
	@docker compose down -v 2>/dev/null || true
	@# Clean Hyperlane deployment artifacts so hyperlane-init redeploys on next start
	@rm -f hyperlane/hyperlane-cosmosnative.json hyperlane/hyperlane-addresses.json
	@rm -f hyperlane/registry/chains/anvil1/addresses.yaml hyperlane/registry/chains/anvil2/addresses.yaml
	@rm -rf hyperlane/registry/deployments/
	@# Clean forge broadcast cache (stale nonces cause contract overwrites on fresh chains)
	@rm -rf oif/oif-contracts/broadcast/Deploy.s.sol/31337 oif/oif-contracts/broadcast/Deploy.s.sol/31338
	@# Reset warp-config.yaml placeholder (sed replaced it during deploy)
	@sed -i'' -e 's|token: "0x[a-fA-F0-9]*"|token: "MOCK_USDC_ADDRESS_PLACEHOLDER"|' hyperlane/configs/warp-config.yaml 2>/dev/null || true
	@echo "Cleaned!"
.PHONY: clean
