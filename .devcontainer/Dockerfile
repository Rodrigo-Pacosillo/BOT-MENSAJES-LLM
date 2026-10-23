FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# 1. Utilidades base + psql para inspeccionar Neon desde la terminal
RUN apt-get update && apt-get install -y \
    curl \
    git \
    sudo \
    ca-certificates \
    postgresql-client \
    httpie \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 2. Usuario "vscode" (nombre exacto que Codespaces requiere)
RUN useradd -m -s /bin/bash vscode \
    && echo "vscode ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# 3. Lazygit (versión fijada: evita el rate-limit de la API anónima de GitHub)
RUN LAZYGIT_VERSION="0.44.1" \
    && curl -Lo lazygit.tar.gz \
       "https://github.com/jesseduffield/lazygit/releases/download/v${LAZYGIT_VERSION}/lazygit_${LAZYGIT_VERSION}_Linux_x86_64.tar.gz" \
    && tar -xf lazygit.tar.gz lazygit \
    && install lazygit /usr/local/bin \
    && rm lazygit.tar.gz lazygit

# 4. OpenCode: instalado como vscode para que los archivos le pertenezcan
RUN mkdir -p /home/vscode/.opencode/bin \
    && chown -R vscode:vscode /home/vscode/.opencode/bin \
    && HOME=/home/vscode su -s /bin/bash vscode \
       -c 'curl -fsSL https://opencode.ai/install | bash -s -- --no-modify-path' \
    && ln -sf /home/vscode/.opencode/bin/opencode /usr/local/bin/opencode

# 5. gentle-ai: instalado como vscode. Su script no documenta una ruta fija,
#    así que localizamos el binario sin asumir el destino y lo enlazamos.
RUN HOME=/home/vscode su -s /bin/bash vscode \
       -c 'curl -fsSL https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.sh | bash' \
    && GENTLE_BIN="$(find /home/vscode -maxdepth 4 -type f -name 'gentle*' | head -n1)" \
    && if [ -n "$GENTLE_BIN" ]; then \
         ln -sf "$GENTLE_BIN" /usr/local/bin/gentle-ai; \
       else echo "WARN: binario gentle-ai no encontrado, revisá su ruta"; fi
