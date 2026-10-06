# Everything the organizer deck needs to build and be checked: pptxgenjs to
# write it, LibreOffice + poppler to render each slide for visual QA.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-impress fonts-crosextra-carlito fonts-crosextra-caladea fonts-liberation fonts-dejavu \
      poppler-utils python3 python3-lxml python3-defusedxml ffmpeg \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /tools
RUN npm init -y >/dev/null && npm install pptxgenjs@3.12.0 sharp@0.33.5 >/dev/null
ENV NODE_PATH=/tools/node_modules
WORKDIR /w
