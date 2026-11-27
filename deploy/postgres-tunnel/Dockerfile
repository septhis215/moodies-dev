FROM alpine:3.23

RUN apk add --no-cache openssh-client
COPY --chmod=755 start-tunnel.sh /usr/local/bin/start-tunnel

ENTRYPOINT ["/usr/local/bin/start-tunnel"]
