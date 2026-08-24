# Node 24 for one reason: `node:sqlite` is built in, so the whole server runs
# with zero npm dependencies. Nothing to install, nothing to audit, and the
# image builds the same whether or not this box has network.
FROM node:24-alpine
WORKDIR /app
COPY src ./src
EXPOSE 8080
CMD ["node", "src/server.js"]
