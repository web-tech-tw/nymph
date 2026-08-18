FROM oven/bun:alpine

WORKDIR /app
RUN chown 3000:3000 /app

USER 3000

COPY --chown=3000:3000 package.json ./
RUN bun install

COPY --chown=3000:3000 . .

EXPOSE 3000
CMD ["bun", "start"]
