FROM golang:alpine AS go-builder

WORKDIR /home/hyperlane

COPY hyperlane/go.* /home/hyperlane/
COPY hyperlane/cmd /home/hyperlane/cmd

# Build the Go CLI for cosmosnative deployment (with synthetic token support)
ENV GOTOOLCHAIN=auto
ENV CGO_ENABLED=0
ENV GOOS=linux
ENV GOARCH=arm64
RUN go build -tags nomsgpack -o hyp ./cmd/hyp

FROM node:24-slim

# Install the hyperlane CLI (used for EVM deployment)
RUN npm install -g @hyperlane-xyz/cli

# Install system packages and foundry
RUN apt-get update && \
    apt-get install -y curl git build-essential pkg-config libssl-dev

RUN curl -L https://foundry.paradigm.xyz | bash && \
    ~/.foundry/bin/foundryup

ENV PATH="/root/.foundry/bin:$PATH"

COPY --from=go-builder /home/hyperlane/hyp /usr/local/bin/hyp

WORKDIR /home/hyperlane

COPY hyperlane/configs /home/hyperlane/configs
COPY hyperlane/registry /home/hyperlane/registry
COPY hyperlane/scripts /home/hyperlane/scripts
COPY hyperlane/contracts /home/hyperlane/contracts

ENTRYPOINT [ "scripts/docker-entrypoint.sh" ]
