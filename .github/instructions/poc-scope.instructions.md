---
description: "Política global de escopo e aceite desta prova de conceito (POC)."
applyTo: "**"
---
# Escopo e aceite da POC

## Fase do projeto

Este projeto é uma prova de conceito acadêmica. O objetivo padrão é obter um
fluxo demonstrável, coerente e funcional em ambiente local; nenhuma mudança deve
ser apresentada como pronta para produção sem uma solicitação explícita nesse
sentido.

## Gates obrigatórios

- Preservar autenticação, autorização, privacidade e invariantes de integridade
  diretamente relacionadas ao fluxo alterado.
- Executar testes e análise estática proporcionais ao escopo e ao risco da
  mudança.
- Manter os arquivos alterados livres de novos erros de lint e tipos.
- Validar artefatos OpenSpec modificados.
- Para mudanças de banco, validar a cadeia de migrações e o SQL gerado quando um
  banco representativo não estiver disponível.
- Não introduzir `typing.Any` em Python nem `any` explícito em TypeScript.

## Itens não bloqueantes por padrão

- Falhas preexistentes e não relacionadas em verificações globais.
- Benchmark, teste de carga, stress test, SLO e `EXPLAIN ANALYZE`.
- Testes concorrentes dependentes de infraestrutura equivalente à produção.
- Ensaio de upgrade/downgrade em cópia populada do banco.
- Telemetria avançada, runbooks completos, rollout, rollback operacional e
  homologação manual exaustiva em múltiplos dispositivos.

Esses itens são hardening de produção. Eles se tornam obrigatórios somente quando
o usuário ou o escopo de uma mudança os promover explicitamente a critério de
aceite.

## Transparência

Um gate dispensado pode ser encerrado como decisão de escopo, mas nunca deve ser
descrito como executado. Propostas, tarefas e entregas devem distinguir claramente
entre “validado”, “não aplicável à POC” e “adiado para produção”. Requisitos
funcionais diretamente alterados continuam válidos mesmo quando uma validação
operacional é adiada.
