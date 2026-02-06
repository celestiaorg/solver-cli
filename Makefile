SOLVER_CLI=solver-cli/target/release/solver-cli
FORCE_FLAG=$(if $(FORCE),--force,)

## help: Show available commands
help: Makefile
	@echo "OIF E2E Solver Commands:"
	@sed -n 's/^##//p' $< | column -t -s ':' | sed -e 's/^/  /'
.PHONY: help

## build: Build the solver-cli
build:
	@cd solver-cli && cargo build --release
.PHONY: build

## start: Start local Evolve chain (Anvil)
start:
	@if [ -f .anvil.pid ] && kill -0 $$(cat .anvil.pid) 2>/dev/null; then \
		echo "Anvil already running (PID: $$(cat .anvil.pid))"; \
	else \
		echo "Starting Anvil..."; \
		anvil --chain-id 1234 --block-time 1 > .anvil.log 2>&1 & \
		echo $$! > .anvil.pid; \
		sleep 2; \
		echo "Anvil started (PID: $$(cat .anvil.pid))"; \
	fi
.PHONY: start

## stop: Stop local Evolve chain, solver, and oracle operator
stop:
	@if [ -f .anvil.pid ]; then \
		kill $$(cat .anvil.pid) 2>/dev/null || true; \
		rm .anvil.pid; \
		echo "Anvil stopped"; \
	fi
	@pkill -f solver-runner 2>/dev/null || true
	@pkill -f oracle-operator 2>/dev/null || true
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

## fund-operator: Fund oracle operator with ETH on evolve
fund-operator:
	@echo "Funding oracle operator on all chains..."
	@. ./.env && \
		OPERATOR_ADDR=$$(grep 'operator_address' config/oracle.toml | cut -d'"' -f2) && \
		echo "  Operator address: $$OPERATOR_ADDR" && \
		echo "  Funding on Evolve (10 ETH)..." && \
		cast send --rpc-url $$EVOLVE_RPC --private-key $$EVOLVE_PK --value 10ether $$OPERATOR_ADDR 2>/dev/null && \
		echo "  Funding on Sepolia (0.01 ETH)..." && \
		cast send --rpc-url $$SEPOLIA_RPC --private-key $$SEPOLIA_PK --value 0.01ether $$OPERATOR_ADDR 2>/dev/null || \
		echo "  Warning: Could not fund on Sepolia (may need testnet ETH)" && \
		echo "Oracle operator funded"
.PHONY: fund-operator

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
	@cd oracle-operator && ORACLE_CONFIG=../config/oracle.toml RUST_LOG=info cargo run --release
.PHONY: operator-start

# Alias for convenience
operator: operator-start
.PHONY: operator

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
setup: init deploy configure fund fund-operator mint-user
	@echo ""
	@echo "Setup complete! Next steps:"
	@echo "  1. make solver - Start solver service (in separate terminal)"
	@echo "  2. make operator - Start oracle operator service (in another terminal)"
	@echo "  3. make intent - Submit a test intent"
	@echo "  4. make balances - Check balances"
.PHONY: setup

## clean: Remove generated files
clean:
	@rm -rf .solver config/*.toml config/*.yaml
	@rm -f .anvil.pid .anvil.log
	@echo "Cleaned!"
.PHONY: clean
