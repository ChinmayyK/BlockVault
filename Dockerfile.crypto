# ---- Build stage ----
FROM rust:1.84-slim AS builder

WORKDIR /build
COPY blockvault_crypto/Cargo.toml blockvault_crypto/Cargo.lock* ./
COPY blockvault_crypto/src ./src

# Build release binary
RUN cargo build --release

# ---- Runtime stage ----
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/target/release/blockvault_crypto /usr/local/bin/blockvault_crypto

ENV CRYPTO_LISTEN_ADDR=0.0.0.0:9876
EXPOSE 9876

CMD ["blockvault_crypto"]
