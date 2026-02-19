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

## start: Start local EVM chains (Anvil)
start:
	@if [ -f .anvil1.pid ] && kill -0 $$(cat .anvil1.pid) 2>/dev/null; then \
		echo "Anvil 1 (evolve) already running (PID: $$(cat .anvil1.pid))"; \
	else \
		echo "Starting Anvil 1 (evolve) on port 8545, chain-id 31337..."; \
		anvil --chain-id 31337 --block-time 1 --port 8545 > .anvil1.log 2>&1 & \
		echo $$! > .anvil1.pid; \
		sleep 2; \
		echo "Anvil 1 started (PID: $$(cat .anvil1.pid))"; \
	fi
	@if [ -f .anvil2.pid ] && kill -0 $$(cat .anvil2.pid) 2>/dev/null; then \
		echo "Anvil 2 (evolve2) already running (PID: $$(cat .anvil2.pid))"; \
	else \
		echo "Starting Anvil 2 (evolve2) on port 8546, chain-id 31338..."; \
		anvil --chain-id 31338 --block-time 1 --port 8546 > .anvil2.log 2>&1 & \
		echo $$! > .anvil2.pid; \
		sleep 2; \
		echo "Anvil 2 started (PID: $$(cat .anvil2.pid))"; \
	fi
	@echo "Local chains ready!"
.PHONY: start

## stop: Stop local chains, solver, oracle operator, and aggregator
stop:
	@if [ -f .anvil1.pid ]; then \
		kill $$(cat .anvil1.pid) 2>/dev/null || true; \
		rm .anvil1.pid; \
		echo "Anvil 1 (evolve) stopped"; \
	fi
	@if [ -f .anvil2.pid ]; then \
		kill $$(cat .anvil2.pid) 2>/dev/null || true; \
		rm .anvil2.pid; \
		echo "Anvil 2 (evolve2) stopped"; \
	fi
	@$(SOLVER_CLI) solver stop 2>/dev/null || true
	@pkill -9 -f "solver-cli solver start" 2>/dev/null || true
	@pkill -9 -f oracle-operator 2>/dev/null || true
	@pkill -9 -f oif-aggregator 2>/dev/null || true
	@pkill -9 -f "node server.js" 2>/dev/null || true
	@pkill -9 -f "vite" 2>/dev/null || true
	@echo "All services stopped"
.PHONY: stop

## init: Initialize project state (use FORCE=1 to reinitialize)
init: build
	@$(SOLVER_CLI) init $(FORCE_FLAG)
.PHONY: init

## deploy: Deploy contracts to all configured chains (use FORCE=1 to redeploy, CHAINS=a,b to limit)
deploy: build
	@$(SOLVER_CLI) deploy $(FORCE_FLAG) $(if $(CHAINS),--chains $(CHAINS),)
.PHONY: deploy

## configure: Generate solver configuration
configure: build
	@$(SOLVER_CLI) configure
.PHONY: configure

## fund: Fund solver with tokens on all chains (use CHAIN=name to limit to one)
fund: build
	@$(SOLVER_CLI) fund --amount 10000000 $(if $(CHAIN),--chain $(CHAIN),)
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
		echo "  Funding on Evolve (10 ETH)..." && \
		cast send --rpc-url $$EVOLVE_RPC --private-key $$EVOLVE_PK --value 10ether $$OPERATOR_ADDR 2>/dev/null && \
		if [ ! -z "$$EVOLVE2_RPC" ]; then \
			echo "  Funding on Evolve2 (10 ETH)..." && \
			cast send --rpc-url $$EVOLVE2_RPC --private-key $$EVOLVE2_PK --value 10ether $$OPERATOR_ADDR 2>/dev/null; \
		fi && \
		echo "  Funding on Sepolia (0.01 ETH)..." && \
		cast send --rpc-url $$SEPOLIA_RPC --private-key $$SEPOLIA_PK --value 0.01ether $$OPERATOR_ADDR 2>/dev/null || \
		echo "  Warning: Could not fund on Sepolia (may need testnet ETH)" && \
		echo "Oracle operator funded"
.PHONY: fund-operator

## fund-user: Fund user with ETH on all chains for gas
fund-user:
	@echo "Funding user with ETH on all chains..."
	@. ./.env && \
		USER_ADDR=$$(cast wallet address --private-key $$USER_PK) && \
		echo "  User address: $$USER_ADDR" && \
		echo "  Funding on Evolve (10 ETH)..." && \
		cast send --rpc-url $$EVOLVE_RPC --private-key $$EVOLVE_PK --value 10ether $$USER_ADDR 2>/dev/null && \
		if [ ! -z "$$EVOLVE2_RPC" ]; then \
			echo "  Funding on Evolve2 (10 ETH)..." && \
			cast send --rpc-url $$EVOLVE2_RPC --private-key $$EVOLVE2_PK --value 10ether $$USER_ADDR 2>/dev/null; \
		fi && \
		echo "  Funding on Sepolia (0.01 ETH)..." && \
		cast send --rpc-url $$SEPOLIA_RPC --private-key $$SEPOLIA_PK --value 0.01ether $$USER_ADDR 2>/dev/null || \
		echo "  Warning: Could not fund on Sepolia (may need testnet ETH)" && \
		echo "User funded"
.PHONY: fund-user

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
	@cd oracle-operator && ORACLE_CONFIG=../.config/oracle.toml RUST_LOG=info cargo run --release
.PHONY: operator-start

# Alias for convenience
operator: operator-start
.PHONY: operator

## aggregator-start: Start the OIF aggregator service
aggregator-start:
	@echo "Starting OIF aggregator on port 4000..."
	@cd oif/oif-aggregator && RUST_LOG=info cargo run --release
.PHONY: aggregator-start

# Alias for convenience
aggregator: aggregator-start
.PHONY: aggregator

## intent: Submit a test intent. Use FROM=, TO=, AMOUNT=, ASSET= to customize
intent: build
	@$(SOLVER_CLI) intent submit \
		--amount $(or $(AMOUNT),1000000) \
		$(if $(ASSET),--asset $(ASSET),) \
		$(if $(FROM),--from $(FROM),) \
		$(if $(TO),--to $(TO),)
.PHONY: intent

## intent-back: Submit intent in reverse direction (sepolia -> evolve)
intent-back: build
	@$(SOLVER_CLI) intent submit \
		--amount $(or $(AMOUNT),1000000) \
		$(if $(ASSET),--asset $(ASSET),) \
		--from sepolia --to evolve
.PHONY: intent-back

## balances: Check balances on all chains (use CHAIN=name to limit to one)
balances: build
	@$(SOLVER_CLI) balances $(if $(CHAIN),--chain $(CHAIN),)
.PHONY: balances

## mint: Mint mock tokens (CHAIN=, SYMBOL=, TO=, AMOUNT=)
mint: build
	@$(SOLVER_CLI) token mint \
		--chain $(or $(CHAIN),evolve) \
		--symbol $(or $(SYMBOL),USDC) \
		--to $(or $(TO),user) \
		--amount $(or $(AMOUNT),10000000)
.PHONY: mint

## mint-user: Mint 10 USDC to user on evolve (for testing)
mint-user: build
	@echo "Minting 10 USDC to user on evolve..."
	@$(SOLVER_CLI) token mint --chain evolve --symbol USDC --to user --amount 10000000
	@echo "Minting 10 USDC to user on sepolia..."
	@$(SOLVER_CLI) token mint --chain sepolia --symbol USDC --to user --amount 10000000 || true
.PHONY: mint-user

## reset: Clean and reinitialize everything
reset: clean
	@$(MAKE) setup FORCE=1
.PHONY: reset

## setup: Full setup (init + deploy + configure + fund + mint tokens to user)
setup: init deploy configure fund fund-operator fund-user mint-user
	@echo ""
	@echo "IMPORTANT: Stop all running services before setup!"
	@echo "    Run 'make stop' first if services are running"
	@echo ""
	@echo "Setup complete! Next steps:"
	@echo "  1. make aggregator - Start OIF aggregator (in separate terminal)"
	@echo "  2. make solver - Start solver service (in another terminal)"
	@echo "  3. make operator - Start oracle operator service (in another terminal)"
	@echo "  4. make intent - Submit a test intent"
	@echo "  5. make balances - Check balances"
.PHONY: setup

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

## clean: Remove generated files
clean:
	@rm -rf .config
	@rm -f .anvil1.pid .anvil1.log .anvil2.pid .anvil2.log
	@echo "Cleaned!"
.PHONY: clean
