FROM golang:1.24-bookworm AS build
RUN CGO_ENABLED=0 go install -trimpath github.com/minio/minio@7aac2a2c5b7c882e68c1ce017d8256be2feea27f

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 minio \
    && useradd --system --uid 10001 --gid minio --home-dir /data minio \
    && mkdir /data \
    && chown minio:minio /data
COPY --from=build /go/bin/minio /usr/local/bin/minio
USER minio
WORKDIR /data
ENTRYPOINT ["minio"]
