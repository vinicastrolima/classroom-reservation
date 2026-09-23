# Design

## Context

O fluxo de reserva já possui validação de conflitos, qualificações, bloqueios, buffers e concorrência. A proposta adiciona uma consulta para comparar ambientes antes da criação; veja `proposal.md` e a especificação da capacidade para o comportamento externo.

O domínio já modela ambientes, recursos fixos e móveis, reservas, manutenções e escalas de suporte. Esses dados são suficientes para calcular alternativas no instante da requisição. Nenhuma informação da busca precisa sobreviver a essa requisição.

## Goals / Non-Goals

**Goals:**

- Produzir configurações completas e reproduzíveis a partir dos dados atuais.
- Manter a criação de reserva como único ponto de escrita e de garantia contra concorrência.
- Oferecer uma estratégia-base mensurável e uma estratégia de pontuação explicável para a avaliação acadêmica.
- Encerrar a jornada do usuário com seleção, resumo e envio, sem um segundo formulário.

**Non-Goals:**

- Reservar, bloquear ou prometer um ambiente durante a recomendação.
- Rastrear seleções, abandono, expiração, telemetria de buscas ou preferências pessoais.
- Implementar recorrência, composição, realocação ou personalização de ranking nesta mudança.

## Decisions

### ADR-1: Consulta `POST` stateless para recomendações

O endpoint será `POST /api/v1/recomendacoes/ambientes`. Embora não tenha efeito colateral, `POST` comporta um conjunto de critérios estruturado — em especial datas, listas de tipos de recursos e suporte — sem codificá-lo em parâmetros de URL.

O contrato de entrada conterá `start_time`, `end_time`, `participant_count`, `environment_types`, `location_id`, `required_resource_types`, `support_types`, `strategy` e `limit`. A finalidade, responsável e aceite dos termos são coletados pela mesma jornada de UI, mas não são necessários para ranquear ambientes; eles permanecem no estado local até o envio de `POST /reservas`.

A resposta conterá uma lista de configurações com ambiente, recursos concretos escolhidos, tipos de suporte, estratégia, pontuação e justificativas. Nenhum identificador de busca ou seleção será devolvido.

Alternativa descartada: `GET` com parâmetros serializados. Ela tornaria listas e intervalos complexos pouco legíveis e mais frágeis para evoluir.

### ADR-2: Repositório somente de leitura e serviço de elegibilidade

O módulo `recommendations` terá `router.py`, `schemas.py`, `repository.py`, `service.py` e `ranking.py`, sem `models.py` e sem migração. O repositório executará consultas de leitura para carregar ambientes candidatos e recursos ativos; o serviço montará configurações, aplicará as verificações e delegará a ordenação a funções puras.

O serviço reutilizará as regras de conflito da reserva, mas a consulta de recomendação nunca solicitará bloqueio de linhas. A checagem de sobreposição deverá aceitar um modo de leitura para a recomendação; a criação de reserva manterá o bloqueio pessimista e o lock distribuído existentes.

```text
POST /recomendacoes/ambientes
              │
              ▼
     RecommendationService
              │
   ┌──────────┼────────────┐
   ▼          ▼            ▼
Ambientes  Recursos    Regras atuais
   │          │       (conflitos, políticas,
   └────┬─────┘        qualificações, suporte)
        ▼
 configurações viáveis ──► ranking puro ──► resposta
```

Alternativa descartada: armazenar resultados, status de seleção ou uma reserva provisória. Isso adicionaria ciclos de vida e tarefas de expiração sem eliminar a necessidade da validação definitiva.

### ADR-3: Recursos por tipo, com IDs concretos na saída

O critério recebe uma lista de tipos de recurso. Para cada ambiente candidato, o serviço seleciona recursos ativos que satisfaçam todos os tipos: recursos fixos pertencentes ao ambiente e recursos móveis que possam ser alocados no intervalo. Os IDs concretos escolhidos retornam na configuração e são enviados para a reserva final.

Uma configuração somente é viável se os recursos selecionados não tiverem sobreposição, indisponibilidade explícita ou manutenção. A mesma validação será aplicada na criação da reserva para que a recomendação e a persistência não divirjam.

Alternativa descartada: pedir ao usuário IDs de recursos. Isso deslocaria para o solicitante uma decisão de inventário que a recomendação deve resolver.

### ADR-4: Estratégias puras, determinísticas e comparáveis

Primeiro são aplicadas somente restrições rígidas. Depois, as estratégias ordenam exatamente os mesmos candidatos:

- `FIRST_FIT`: ordem estável por menor `environment.id`; retorna os primeiros candidatos até o limite.
- `WEIGHTED_SCORE`: prioriza menor capacidade ociosa e menor quantidade de recursos excedentes. Empates usam `environment.id`.

A pontuação será calculada por funções sem acesso ao banco e acompanhada por justificativas derivadas de seus componentes. Os pesos serão constantes nomeadas no código e documentadas, não configuração persistida. Isso permite cenários reprodutíveis e comparação objetiva para a POC.

Alternativa descartada: usar algoritmo não determinístico ou preferências persistidas por usuário. Ambos dificultariam a comparação acadêmica e introduziriam estado desnecessário.

### ADR-5: Uma jornada de UI e envio convencional da reserva

O diálogo de recomendação coleta critérios e os campos obrigatórios de uma reserva simples. Depois da consulta, a seleção mantém a configuração e o rascunho somente em memória no cliente; a interface apresenta um resumo não editável e o botão de envio.

```text
Critérios + campos obrigatórios
              │
              ▼
      Buscar recomendações
              │
              ▼
       Selecionar configuração
              │
              ▼
Resumo não editável + enviar
              │
              ▼
        POST /reservas
              │
              ▼
Validação concorrente e política de aprovação atual
```

Não haverá endpoint de confirmação de recomendação. O botão de envio cria a reserva pelo contrato já existente; a UI não pode tratar a configuração como reservada antes da resposta.

## Risks / Trade-offs

- [O estado muda entre recomendação e envio] → a interface declara que a opção é uma prévia e a criação repete todas as validações sob controle de concorrência.
- [Avaliar muitos ambientes pode elevar o custo da consulta] → a POC aplicará limite de resultados, filtros de critérios e consultas em lote; benchmark e índices adicionais ficam como hardening de produção.
- [Dados de recursos podem estar incompletos ou inconsistentes] → a configuração só usa recursos ativos e a reserva final revalida disponibilidade, manutenção e conflitos.
- [O endpoint pode ser usado para inferir agenda de ambientes] → exige autenticação e retorna apenas alternativas elegíveis ao solicitante, sem expor detalhes de reservas conflitantes.

## Migration Plan

1. Adicionar os arquivos de domínio, tipos de API e interface sem criar migração.
2. Registrar o endpoint e executar testes do escopo.
3. Fazer deploy junto às versões compatíveis do backend e frontend; o fluxo manual de criação de reservas continua disponível como alternativa.
4. Para rollback, remover a rota e a entrada da interface. Não há dados de recomendação a migrar ou limpar.

## Garantias da POC e Hardening

Como garantia da POC, a recomendação não escreve no banco, respeita as regras de elegibilidade e a reserva final preserva validação e concorrência. Benchmark de grande volume, metas de latência, cache distribuído específico, avaliação em banco populado e testes de concorrência em infraestrutura de produção são hardening explicitamente adiado.
