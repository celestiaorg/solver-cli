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

## stop: Stop local Evolve chain and solver
stop:
	@if [ -f .anvil.pid ]; then \
		kill $$(cat .anvil.pid) 2>/dev/null || true; \
		rm .anvil.pid; \
		echo "Anvil stopped"; \
	fi
	@pkill -f solver-runner 2>/dev/null || true
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

## solver: Start the solver
solver: build
	@$(SOLVER_CLI) solver start
.PHONY: solver

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
setup: init deploy configure fund
	@echo ""
	@echo "Setup complete! Next steps:"
	@echo "  1. make solver  - Start solver (in separate terminal)"
	@echo "  2. make intent  - Submit a test intent"
	@echo "  3. make verify  - Check balances"
.PHONY: setup

## clean: Remove generated files
clean:
	@rm -rf .solver config/*.toml config/*.yaml
	@rm -f .anvil.pid .anvil.log
	@echo "Cleaned!"
.PHONY: clean
