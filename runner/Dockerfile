# ---------- Stage 1: build runner ----------
FROM golang:1.26-alpine AS builder
WORKDIR /app/runner

ARG APP_VERSION=dev

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    CGO_ENABLED=0 GOOS=linux go build \
    -ldflags "-X main.Version=${APP_VERSION}" \
    -o /out/notomate-runner .

# ---------- Stage 2: runtime ----------
FROM alpine:3.21
WORKDIR /usr/local/runner

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /out/notomate-runner ./notomate-runner

# Registration state lives in /data (mount a volume to survive restarts).
RUN mkdir -p /data
ENV NM_RUNNER_STATE_FILE=/data/.runner
VOLUME /data

ENTRYPOINT ["./notomate-runner"]
