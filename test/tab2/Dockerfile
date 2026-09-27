# Throwaway: runs 2018-era browsers headless, to see the tablet page as a Galaxy Tab 2 would.
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends socat bzip2 libxt6 libx11-6 libxcb1 libxcb-shm0 ca-certificates fonts-noto-core fonts-dejavu-core \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxkbcommon0 \
    libpango-1.0-0 libasound2 libgtk-3-0 libx11-xcb1 libxss1 libxtst6 libdbus-glib-1-2 libgconf-2-4 libnspr4 \
    libxcursor1 libxi6 libxext6 libxfixes3 libxrender1 libcairo2 libdrm2 libexpat1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
