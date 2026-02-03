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

## deploy: Deploy contracts to both chains (use FORCE=1 to redeploy)
deploy: build
	@$(SOLVER_CLI) deploy $(FORCE_FLAG)
.PHONY: deploy

## configure: Generate solver configuration
configure: build
	@$(SOLVER_CLI) configure
.PHONY: configure

## fund: Fund solver with tokens (10 USDC each chain)
fund: build
	@$(SOLVER_CLI) fund --amount 10000000
.PHONY: fund

## fund-operator: Fund oracle operator with ETH on evolve
fund-operator:
	@echo "Funding oracle operator on evolve..."
	@. ./.env && \
		OPERATOR_ADDR=$$(grep 'operator_address' config/oracle.toml | cut -d'"' -f2) && \
		echo "  Operator address: $$OPERATOR_ADDR" && \
		echo "  Sending 10 ETH..." && \
		cast send --rpc-url $$EVOLVE_RPC --private-key $$EVOLVE_PK --value 10ether $$OPERATOR_ADDR && \
		echo "Funded oracle operator with 10 ETH on evolve"
.PHONY: fund-operator

## solver-start: Start the solver service
solver-start: build
	@$(SOLVER_CLI) solver start
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

## intent: Submit a test intent (1 USDC)
intent: build
	@$(SOLVER_CLI) intent submit --amount 1000000 --direction forward
.PHONY: intent

## verify: Check balances
verify: build
	@$(SOLVER_CLI) verify
.PHONY: verify

## reset: Clean and reinitialize everything
reset: clean
	@$(MAKE) setup FORCE=1
.PHONY: reset

## setup: Full setup (init + deploy + configure + fund)
setup: init deploy configure fund fund-operator
	@echo ""
	@echo "Setup complete! Next steps:"
	@echo "  1. make solver-start - Start solver service (in separate terminal)"
	@echo "  2. make operator-start - Start oracle operator service (in another terminal)"
	@echo "  3. make intent - Submit a test intent"
	@echo "  4. make verify - Check balances"
.PHONY: setup

## clean: Remove generated files
clean:
	@rm -rf .solver config/*.toml config/*.yaml
	@rm -f .anvil.pid .anvil.log
	@echo "Cleaned!"
.PHONY: clean
