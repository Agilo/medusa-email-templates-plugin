FROM mcr.microsoft.com/devcontainers/base:bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates gh git zsh \
  && mkdir -p /usr/local/share/zsh-plugins \
  && git clone --depth=1 https://github.com/zsh-users/zsh-autosuggestions.git /usr/local/share/zsh-plugins/zsh-autosuggestions \
  && git clone --depth=1 https://github.com/zsh-users/zsh-syntax-highlighting.git /usr/local/share/zsh-plugins/zsh-syntax-highlighting \
  && rm -rf /var/lib/apt/lists/*