# Proposal

## Why

Hoje o solicitante precisa escolher manualmente o ambiente antes de saber se a combinação de horário, capacidade, recursos e regras operacionais é viável. O projeto precisa oferecer configurações recomendadas e comparáveis, sem transformar uma consulta efêmera em uma entidade persistida.

## What Changes

- Adicionar uma consulta autenticada e sem efeitos colaterais para recomendar configurações de ambiente a partir de período, participantes e restrições opcionais.
- Retornar configurações completas, compostas por ambiente e recursos selecionados, apenas quando atenderem às regras atuais de disponibilidade e elegibilidade.
- Implementar duas ordenações determinísticas: `FIRST_FIT` como linha de base e `WEIGHTED_SCORE` como estratégia padrão de recomendação.
- Permitir que a tela de recomendação colete todos os dados obrigatórios da solicitação e envie diretamente a reserva escolhida, sem abrir ou preencher um segundo formulário.
- Revalidar a configuração na criação da reserva e preservar o fluxo de aprovação atual, incluindo a autoaprovação aplicável a ambientes `COMMON`.

## Escopo

- Recomendação de ambiente para reservas simples em um único intervalo.
- Restrições de capacidade, tipo de ambiente, localidade, recursos, suporte, qualificações, políticas de antecedência, conflitos, bloqueios e manutenção já existentes.
- Apresentação de até um limite configurado de alternativas, com pontuação e justificativas compreensíveis.
- Testes unitários da elegibilidade e ordenação, testes de integração do endpoint e teste da jornada de seleção e envio da reserva.

## Não-Escopo

- Persistir buscas, opções recomendadas, seleções, tokens, estados de ciclo de vida ou dados analíticos de recomendação.
- Criar migração, tabela, scheduler, cache ou processo de expiração específico para recomendações.
- Recomendação de reservas recorrentes, compostas ou realocação de uma reserva existente nesta mudança.
- Alterar a política atual de aprovação de reservas.
- Executar benchmark, carga ou concorrência em infraestrutura de produção; esses itens permanecem como hardening posterior à POC.

## Capabilities

### New Capabilities

- `environment-recommendations`: consulta stateless, elegibilidade, ordenação e seleção de uma configuração recomendada para criar uma reserva simples.

### Modified Capabilities

- Nenhuma.

## Impacto Arquitetural

- Novo endpoint `POST /api/v1/recomendacoes/ambientes`, protegido por autenticação, sem escrita no banco.
- Novo módulo de domínio para orquestrar consultas existentes e aplicar estratégias puras de ranking; não haverá modelo ORM nem repositório de persistência próprio.
- A criação continuará em `POST /api/v1/reservas`, que reexecutará as validações e os mecanismos de concorrência antes de persistir a reserva.
- A interface de reservas ganhará uma jornada única de critérios, resultados, seleção e envio.

## Impact

- Afeta os módulos de reservas, ambientes, recursos e qualificações somente por meio das regras e consultas que já expõem.
- Afeta o cliente React, seus tipos de API e a tela de reservas.
- Não exige dependências, alterações de esquema, migrações ou mudanças em dados persistidos.
- Nível de aceite: POC; a mudança preserva autorização e validação final, enquanto avaliação de desempenho em carga fica explicitamente adiada.
