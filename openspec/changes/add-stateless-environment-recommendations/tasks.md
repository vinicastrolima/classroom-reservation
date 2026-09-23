# Tasks

## 1. BACKEND — Contrato e consulta stateless

- [x] 1.1 Definir os schemas de critérios, estratégia, recursos selecionados e configuração recomendada, incluindo validação de intervalo, limite e campos obrigatórios; verificar com testes de schema.
- [x] 1.2 Criar o repositório de leitura de candidatos e recursos ativos, sem modelos ORM ou métodos de escrita; verificar que a consulta não chama `commit`, `add`, `save` ou `delete`.
- [x] 1.3 Implementar a elegibilidade de ambientes e recursos reutilizando regras de conflitos, bloqueios, buffers, qualificações, políticas de antecedência, manutenção e suporte, com modo de leitura sem bloqueio pessimista; verificar com testes unitários de cada critério eliminatório.
- [x] 1.4 Implementar `FIRST_FIT` e `WEIGHTED_SCORE` como funções puras, determinísticas, com desempate estável, pontuação e justificativas; verificar com testes de ordenação e repetibilidade.
- [x] 1.5 Expor e registrar `POST /api/v1/recomendacoes/ambientes`, usando a identidade autenticada para elegibilidade e sem aceitar identidade de solicitante do cliente; verificar respostas autenticadas, lista vazia e ausência de escrita no banco.
- [x] 1.6 Garantir que a criação convencional de reserva revalida recursos selecionados, conflitos e concorrência antes de persistir e preserva a política atual de aprovação; verificar o caso em que uma opção fica indisponível entre consulta e envio.

## 2. FRONTEND — Jornada única de seleção

- [x] 2.1 Adicionar tipos e cliente de API para a consulta de recomendações sem introduzir `any`; verificar a serialização de critérios e a desserialização de configurações em testes de unidade.
- [x] 2.2 Implementar a entrada da jornada de recomendação com todos os critérios e campos obrigatórios da reserva simples, incluindo finalidade, responsável e aceite dos termos; verificar validações e mensagens em pt-BR.
- [x] 2.3 Exibir alternativas com ambiente, recursos, pontuação e justificativas, além de estado vazio e falha de consulta; verificar que os resultados não expõem detalhes de reservas conflitantes.
- [x] 2.4 Implementar seleção, resumo não editável e envio direto para `POST /reservas` com a configuração escolhida, sem abrir ou preencher um segundo formulário; verificar a requisição gerada e os estados de sucesso e conflito.
- [x] 2.5 Manter a criação manual de reserva disponível e isolada da nova jornada; verificar que o fluxo existente continua renderizando e enviando a reserva simples.

## 3. VERIFICAÇÃO — Gates da POC

- [x] 3.1 Executar a suíte de testes backend afetada e adicionar cobertura para endpoint, elegibilidade, ranking e corrida entre recomendação e criação; verificar que todos os testes do escopo passam.
- [x] 3.2 Executar testes e checagem de tipos/lint do frontend afetado, incluindo a jornada de critérios, seleção e envio; verificar que não há `any` explícito nem erro novo no escopo.
- [x] 3.3 Executar `git diff --check` e a validação estrita do OpenSpec; verificar que não há erro de whitespace nem inconsistência nos artefatos.

## 4. VERIFICAÇÃO — Hardening de produção adiado

- [x] 4.1 Registrar no resultado da implementação que benchmark de alto volume, metas de latência, cache específico e testes em banco populado são hardening de produção não executado e não bloqueiam o aceite da POC; verificar a transparência desse registro.
- [x] 4.2 Registrar que teste de concorrência em infraestrutura de produção é hardening adiado; a POC verifica a revalidação e a proteção concorrente já existente com testes locais do escopo.
