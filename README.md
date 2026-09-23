# Classroom Reservation

Sistema de reserva de salas e ambientes acadêmicos.

> **Fase do projeto:** prova de conceito acadêmica para desenvolvimento local e
> demonstração. Os critérios de aceite e os controles deliberadamente adiados para
> uma eventual produção estão documentados em
> [Escopo e critérios de aceite da POC](docs/ESCOPO-POC.md).

## Tecnologias

| Camada | Stack |
|---|---|
| Backend | Python 3.14+, FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL 16 |
| Frontend | React 19, React Router 7, TypeScript, Material-UI v9, TailwindCSS v4 |
| Orquestração | Docker Compose |

---

## Rodando localmente

### Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/install/)
- `git`

> **WSL (Windows Subsystem for Linux)**
>
> - Instale o [Docker Desktop para Windows](https://www.docker.com/products/docker-desktop/) e ative a integração com WSL2 em **Settings → Resources → WSL Integration**.
> - Clone e execute o projeto **dentro do sistema de arquivos WSL** (ex: `~/code/`), não em `/mnt/c/`. Usar o filesystem do Windows (`/mnt/c/...`) causa lentidão severa nos volumes do Docker.
> - As URLs `http://localhost:3000` e `http://localhost:8000` funcionam diretamente no navegador do Windows graças ao port-forwarding automático do WSL2.

### 1. Clone o repositório

```bash
git clone https://github.com/GersonMJL/classroom-reservation.git
cd classroom-reservation
```

### 2. Gere o `.env` com seu UID/GID

O backend roda com o mesmo usuário do host para evitar conflitos de permissão nos volumes:

```bash
sh set-user-id.sh
```

Isso cria um arquivo `.env` com `UID` e `GID` usados pelo Docker Compose.

### 3. Suba os serviços

```bash
docker compose up
```

Na primeira execução, o Docker fará o build das imagens e instalará as dependências automaticamente.

| Serviço | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend (API) | http://localhost:8000 |
| Documentação da API (Swagger) | http://localhost:8000/docs |
| Banco de dados (PostgreSQL) | `localhost:5433` |

Para rodar em background:

```bash
docker compose up -d
```

Para parar:

```bash
docker compose down
```

### 4. Executar as migrations (se necessário)

```bash
docker compose exec backend uv run alembic upgrade head
```

---

## Desenvolvimento sem Docker

### Backend

> Requer Python 3.14+ e [`uv`](https://docs.astral.sh/uv/).

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

Configure a variável de ambiente antes de subir:

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5433/app
```

Outros comandos úteis:

```bash
uv run ruff check .           # linter
uv run ruff format .          # formatação
uv run alembic upgrade head   # migrations
```

### Frontend

> Requer Node.js 20+.

```bash
cd frontend
npm install
npm run dev
```

Outros comandos úteis:

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm run build       # build de produção
```

---

## Como contribuir

### 1. Fork e clone

```bash
git clone https://github.com/GersonMJL/classroom-reservation.git
cd classroom-reservation
```

### 2. Crie uma branch a partir da `main`

Use o prefixo adequado ao tipo de mudança:

| Tipo | Prefixo | Exemplo |
|---|---|---|
| Nova funcionalidade | `feat/` | `feat/reserva-recorrente` |
| Correção de bug | `fix/` | `fix/conflito-horario` |
| Documentação | `docs/` | `docs/atualiza-readme` |
| Refatoração | `refactor/` | `refactor/servico-ambientes` |

```bash
git checkout -b feat/minha-feature
```

### 3. Faça as alterações e commite

Siga o padrão [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git add <arquivos>
git commit -m "feat: adiciona suporte a reservas recorrentes"
```

### 4. Envie a branch para o GitHub

```bash
git push origin feat/minha-feature
```

### 5. Abra um Pull Request

1. Acesse o repositório em https://github.com/GersonMJL/classroom-reservation
2. Clique em **Compare & pull request** (ou vá em **Pull requests → New pull request**)
3. Selecione `main` como base e sua branch como compare
4. Preencha o título e a descrição explicando **o que** foi feito e **por que**
5. Submeta o PR e aguarde a revisão

### Boas práticas

- Mantenha a branch atualizada com a `main` antes de abrir o PR:
  ```bash
  git fetch origin
  git rebase origin/main
  ```
- Um PR deve ter escopo pequeno e focado — facilita a revisão e reduz conflitos.
- Textos exibidos na UI devem estar em **pt-BR**.
- Novos módulos de backend devem seguir a estrutura `router → service → repository → schema/model` descrita em `CLAUDE.md`.
