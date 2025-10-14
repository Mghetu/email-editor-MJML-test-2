# Use a standard Node.js dev container as the base
FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:18

# Install Xvfb for Cypress
RUN apt-get update \
    && apt-get install -y xvfb \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# You can add other system packages if needed
