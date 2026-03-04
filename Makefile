SOLVER_CLI=solver-cli/target/release/solver-cli
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
	@pkill -9 -f oracle-operator 2>/dev/null || true
	@pkill -9 -f oif-aggregator 2>/dev/null || true
	@pkill -9 -f "node server.js" 2>/dev/null || true
	@pkill -9 -f "vite" 2>/dev/null || true
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
		OPERATOR_ADDR=$$(grep 'operator_address' .config/oracle.toml | cut -d'"' -f2) && \
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
			cast send --rpc-url $$ANVIL2_RPC --private-key $$ANVIL2_PK --value 10ether $$USER_ADDR 2>/dev/null; \
		fi && \
		echo "User funded"
.PHONY: fund-user

## mint: Mint tokens on a chain (SYMBOL=USDC, CHAIN=anvil1, TO=user, AMOUNT=10000000)
mint: build
	@$(SOLVER_CLI) token mint \
		--chain $(or $(CHAIN),anvil1) \
		--symbol $(or $(SYMBOL),USDC) \
		--to $(or $(TO),user) \
		--amount $(or $(AMOUNT),10000000)
.PHONY: mint

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
	cd oracle-operator && ORACLE_CONFIG=../.config/oracle.toml RUST_LOG=info cargo run --release
.PHONY: operator-start

# Alias for convenience
operator: operator-start
.PHONY: operator

## rebalancer-start: Start the rebalancer service
rebalancer-start: build
	@$(SOLVER_CLI) rebalancer start
.PHONY: rebalancer-start

# Alias for convenience
rebalancer: rebalancer-start
.PHONY: rebalancer

## aggregator-start: Start the OIF aggregator service
aggregator-start:
	@echo "Starting OIF aggregator on port 4000..."
	@cd oif/oif-aggregator && RUST_LOG=info cargo run --release
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
# Bridge Test (Hyperlane warp route e2e)
# ============================================================================

## rebalance: Move solver USDC from anvil1 -> Celestia -> anvil2 via Hyperlane + forwarding
FORWARDING_BACKEND ?= http://127.0.0.1:8080
REBALANCE_AMOUNT ?= 10000000

rebalance:
	@echo ""
	@echo "═══════════════════════════════════════════════════════════════"
	@echo "  Rebalance: anvil1 -> Celestia -> anvil2"
	@echo "═══════════════════════════════════════════════════════════════"
	@echo ""
	@. ./.env && \
		ADDRESSES=$$(cat .config/hyperlane-addresses.json) && \
		MOCK_USDC=$$(echo $$ADDRESSES | jq -r '.anvil1.mock_usdc') && \
		ANVIL1_WARP=$$(echo $$ADDRESSES | jq -r '.anvil1.warp_token') && \
		ANVIL2_WARP=$$(echo $$ADDRESSES | jq -r '.anvil2.warp_token') && \
		SOLVER_ADDR=$$(cast wallet address --private-key $$SOLVER_PRIVATE_KEY) && \
		SOLVER_ADDR_PADDED=$$(printf '0x000000000000000000000000%s' $${SOLVER_ADDR#0x}) && \
		echo "  Solver address:          $$SOLVER_ADDR" && \
		echo "  MockERC20 (anvil1):      $$MOCK_USDC" && \
		echo "  HypCollateral (anvil1):  $$ANVIL1_WARP" && \
		echo "  HypSynthetic (anvil2):   $$ANVIL2_WARP" && \
		echo "  Amount:                  $(REBALANCE_AMOUNT) (raw)" && \
		echo "" && \
		echo "Step 1: Check initial balances..." && \
		ANVIL1_BAL=$$(cast call $$MOCK_USDC "balanceOf(address)" $$SOLVER_ADDR --rpc-url $$ANVIL1_RPC 2>/dev/null | cast to-dec 2>/dev/null || echo "0") && \
		ANVIL2_BAL=$$(cast call $$ANVIL2_WARP "balanceOf(address)" $$SOLVER_ADDR --rpc-url $$ANVIL2_RPC 2>/dev/null | cast to-dec 2>/dev/null || echo "0") && \
		echo "  Anvil1 USDC:  $$ANVIL1_BAL" && \
		echo "  Anvil2 USDC: $$ANVIL2_BAL" && \
		echo "" && \
		echo "Step 2: Derive Celestia forwarding address (dest: anvil2)..." && \
		FORWARD_ADDR=$$(docker exec forwarding-relayer forwarding-relayer derive-address \
			--dest-domain 31338 \
			--dest-recipient $$SOLVER_ADDR_PADDED) && \
		echo "  Forwarding address: $$FORWARD_ADDR" && \
		echo "" && \
		echo "Step 3: Register forwarding request with backend..." && \
		REGISTER_RESP=$$(curl -sf -X POST $(FORWARDING_BACKEND)/forwarding-requests \
			-H "Content-Type: application/json" \
			-d "{\"forward_addr\": \"$$FORWARD_ADDR\", \"dest_domain\": 31338, \"dest_recipient\": \"$$SOLVER_ADDR_PADDED\"}") && \
		echo "  Response: $$REGISTER_RESP" && \
		echo "" && \
		echo "Step 4: Approve HypCollateral to spend solver USDC..." && \
		cast send $$MOCK_USDC "approve(address,uint256)" $$ANVIL1_WARP $(REBALANCE_AMOUNT) \
			--rpc-url $$ANVIL1_RPC --private-key $$SOLVER_PRIVATE_KEY > /dev/null && \
		echo "  Done" && \
		echo "" && \
		echo "Step 5: Send USDC to Celestia via HypCollateral.transferRemote(69420, ...)..." && \
		FORWARD_ADDR_HEX=$$(python3 scripts/bech32_to_bytes32.py "$$FORWARD_ADDR") && \
		echo "  Forwarding addr (bytes32): $$FORWARD_ADDR_HEX" && \
		cast send $$ANVIL1_WARP "transferRemote(uint32,bytes32,uint256)" \
			69420 $$FORWARD_ADDR_HEX $(REBALANCE_AMOUNT) \
			--rpc-url $$ANVIL1_RPC --private-key $$SOLVER_PRIVATE_KEY --value 0 > /dev/null && \
		echo "  Sent! anvil1 -> Celestia -> anvil2" && \
		echo "" && \
		echo "Step 6: Waiting for Hyperlane relayer + Celestia forwarding (60s)..." && \
		for i in $$(seq 1 12); do \
			sleep 5; \
			BAL=$$(cast call $$ANVIL2_WARP "balanceOf(address)" $$SOLVER_ADDR --rpc-url $$ANVIL2_RPC 2>/dev/null | cast to-dec 2>/dev/null || echo "0"); \
			printf "  [%2ds] Anvil2 USDC balance: %s\n" $$((i * 5)) "$$BAL"; \
			if [ "$$BAL" != "$$ANVIL2_BAL" ] && [ "$$BAL" != "0" ]; then \
				echo ""; \
				echo "  Tokens arrived!"; \
				break; \
			fi; \
		done && \
		echo "" && \
		echo "Step 7: Final balances..." && \
		ANVIL1_BAL_AFTER=$$(cast call $$MOCK_USDC "balanceOf(address)" $$SOLVER_ADDR --rpc-url $$ANVIL1_RPC | cast to-dec) && \
		ANVIL2_BAL_AFTER=$$(cast call $$ANVIL2_WARP "balanceOf(address)" $$SOLVER_ADDR --rpc-url $$ANVIL2_RPC | cast to-dec) && \
		echo "  Anvil1 USDC:  $$ANVIL1_BAL -> $$ANVIL1_BAL_AFTER" && \
		echo "  Anvil2 USDC: $$ANVIL2_BAL -> $$ANVIL2_BAL_AFTER" && \
		echo "" && \
		if [ "$$ANVIL2_BAL_AFTER" != "$$ANVIL2_BAL" ]; then \
			echo "  Rebalance complete — tokens moved anvil1 -> Celestia -> anvil2"; \
		else \
			echo "  Rebalance failed — tokens did not arrive on anvil2"; \
			echo "     Check logs: make logs SVC=relayer"; \
			echo "                 make logs SVC=forwarding-relayer"; \
		fi && \
		echo ""
.PHONY: rebalance

## rebalance-back: Move solver USDC from anvil2 -> Celestia -> anvil1 via Hyperlane + forwarding
rebalance-back:
	@echo ""
	@echo "═══════════════════════════════════════════════════════════════"
	@echo "  Rebalance Back: anvil2 -> Celestia -> anvil1"
	@echo "═══════════════════════════════════════════════════════════════"
	@echo ""
	@. ./.env && \
		ADDRESSES=$$(cat .config/hyperlane-addresses.json) && \
		MOCK_USDC=$$(echo $$ADDRESSES | jq -r '.anvil1.mock_usdc') && \
		ANVIL1_WARP=$$(echo $$ADDRESSES | jq -r '.anvil1.warp_token') && \
		ANVIL2_WARP=$$(echo $$ADDRESSES | jq -r '.anvil2.warp_token') && \
		SOLVER_ADDR=$$(cast wallet address --private-key $$SOLVER_PRIVATE_KEY) && \
		SOLVER_ADDR_PADDED=$$(printf '0x000000000000000000000000%s' $${SOLVER_ADDR#0x}) && \
		echo "  Solver address:          $$SOLVER_ADDR" && \
		echo "  MockERC20 (anvil1):      $$MOCK_USDC" && \
		echo "  HypCollateral (anvil1):  $$ANVIL1_WARP" && \
		echo "  HypSynthetic (anvil2):   $$ANVIL2_WARP" && \
		echo "  Amount:                  $(REBALANCE_AMOUNT) (raw)" && \
		echo "" && \
		echo "Step 1: Check initial balances..." && \
		ANVIL1_BAL=$$(cast call $$MOCK_USDC "balanceOf(address)" $$SOLVER_ADDR --rpc-url $$ANVIL1_RPC 2>/dev/null | cast to-dec 2>/dev/null || echo "0") && \
		ANVIL2_BAL=$$(cast call $$ANVIL2_WARP "balanceOf(address)" $$SOLVER_ADDR --rpc-url $$ANVIL2_RPC 2>/dev/null | cast to-dec 2>/dev/null || echo "0") && \
		echo "  Anvil1 USDC:  $$ANVIL1_BAL" && \
		echo "  Anvil2 USDC: $$ANVIL2_BAL" && \
		echo "" && \
		echo "Step 2: Derive Celestia forwarding address (dest: anvil1)..." && \
		FORWARD_ADDR=$$(docker exec forwarding-relayer forwarding-relayer derive-address \
			--dest-domain 131337 \
			--dest-recipient $$SOLVER_ADDR_PADDED) && \
		echo "  Forwarding address: $$FORWARD_ADDR" && \
		echo "" && \
		echo "Step 3: Register forwarding request with backend..." && \
		REGISTER_RESP=$$(curl -sf -X POST $(FORWARDING_BACKEND)/forwarding-requests \
			-H "Content-Type: application/json" \
			-d "{\"forward_addr\": \"$$FORWARD_ADDR\", \"dest_domain\": 131337, \"dest_recipient\": \"$$SOLVER_ADDR_PADDED\"}") && \
		echo "  Response: $$REGISTER_RESP" && \
		echo "" && \
		echo "Step 4: Send USDC to Celestia via HypSynthetic.transferRemote(69420, ...)..." && \
		FORWARD_ADDR_HEX=$$(python3 scripts/bech32_to_bytes32.py "$$FORWARD_ADDR") && \
		echo "  Forwarding addr (bytes32): $$FORWARD_ADDR_HEX" && \
		cast send $$ANVIL2_WARP "transferRemote(uint32,bytes32,uint256)" \
			69420 $$FORWARD_ADDR_HEX $(REBALANCE_AMOUNT) \
			--rpc-url $$ANVIL2_RPC --private-key $$SOLVER_PRIVATE_KEY --value 0 > /dev/null && \
		echo "  Sent! anvil2 -> Celestia -> anvil1" && \
		echo "" && \
		echo "Step 5: Waiting for Hyperlane relayer + Celestia forwarding (60s)..." && \
		for i in $$(seq 1 12); do \
			sleep 5; \
			BAL=$$(cast call $$MOCK_USDC "balanceOf(address)" $$SOLVER_ADDR --rpc-url $$ANVIL1_RPC 2>/dev/null | cast to-dec 2>/dev/null || echo "0"); \
			printf "  [%2ds] Anvil1 USDC balance: %s\n" $$((i * 5)) "$$BAL"; \
			if [ "$$BAL" != "$$ANVIL1_BAL" ] && [ "$$BAL" != "0" ]; then \
				echo ""; \
				echo "  Tokens arrived!"; \
				break; \
			fi; \
		done && \
		echo "" && \
		echo "Step 6: Final balances..." && \
		ANVIL1_BAL_AFTER=$$(cast call $$MOCK_USDC "balanceOf(address)" $$SOLVER_ADDR --rpc-url $$ANVIL1_RPC | cast to-dec) && \
		ANVIL2_BAL_AFTER=$$(cast call $$ANVIL2_WARP "balanceOf(address)" $$SOLVER_ADDR --rpc-url $$ANVIL2_RPC | cast to-dec) && \
		echo "  Anvil1 USDC:  $$ANVIL1_BAL -> $$ANVIL1_BAL_AFTER" && \
		echo "  Anvil2 USDC: $$ANVIL2_BAL -> $$ANVIL2_BAL_AFTER" && \
		echo "" && \
		if [ "$$ANVIL1_BAL_AFTER" != "$$ANVIL1_BAL" ]; then \
			echo "  Rebalance complete — tokens moved anvil2 -> Celestia -> anvil1"; \
		else \
			echo "  Rebalance failed — tokens did not arrive on anvil1"; \
			echo "     Check logs: make logs SVC=relayer"; \
			echo "                 make logs SVC=forwarding-relayer"; \
		fi && \
		echo ""
.PHONY: rebalance-back

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

## frontend: Start the frontend (backend API + Vite dev server)
frontend:
	@echo "Installing frontend dependencies..."
	@cd frontend && npm install --silent 2>/dev/null
	@echo "Starting frontend backend (port 3001)..."
	@cd frontend && node server.js &
	@sleep 2
	@echo "Starting Vite dev server (port 5173)..."
	@cd frontend && npx vite --host
.PHONY: frontend

## mvp: Run the full MVP demo (all services + frontend)
mvp:
	@./mvp.sh
.PHONY: mvp

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
