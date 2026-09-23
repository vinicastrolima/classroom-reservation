# Escopo e critérios de aceite da POC

Este repositório implementa uma prova de conceito acadêmica do sistema de reserva
de ambientes. O aceite padrão comprova que o fluxo alterado funciona localmente e
preserva suas invariantes essenciais; ele não certifica prontidão operacional para
produção.

## O que bloqueia uma entrega

- Regressão funcional causada pela mudança.
- Falha de autenticação, autorização, privacidade ou integridade diretamente
  relacionada ao fluxo alterado.
- Novo erro de lint ou tipos em arquivo alterado.
- Falha nos testes relevantes ao comportamento implementado.
- Artefato OpenSpec inválido.
- Uso novo de `typing.Any` em Python ou `any` explícito em TypeScript.

Sempre que viável, as suítes completas continuam sendo executadas porque oferecem
um sinal útil. Uma falha global preexistente e não relacionada deve ser registrada,
mas não bloqueia a POC quando as verificações direcionadas do escopo passam.

## O que fica para hardening de produção

- Testes de carga, stress, concorrência em infraestrutura real e benchmarks.
- Metas formais de latência, contagem de queries e análise com `EXPLAIN ANALYZE`.
- Ensaio de migração e rollback com cópia populada do banco.
- Observabilidade e telemetria avançadas, SLOs e alertas operacionais.
- Runbooks completos, rollout gradual e plano operacional de rollback.
- Homologação manual exaustiva de todos os cenários e dispositivos.

Uma mudança pode tornar qualquer item acima obrigatório quando isso for solicitado
explicitamente. Nesse caso, a proposta e as tarefas devem promovê-lo a gate de
aceite e registrar a evidência correspondente.

## Como registrar o resultado

Os artefatos e o resumo de entrega devem usar uma destas classificações:

- **Validado:** a verificação foi realmente executada e passou.
- **Não aplicável à POC:** a verificação não é necessária para o objetivo atual.
- **Adiado para produção:** a verificação é relevante para uma futura implantação,
  mas não foi executada nesta entrega.

Marcar uma decisão de escopo como concluída significa que o adiamento foi aceito e
documentado; não significa que o gate técnico correspondente tenha sido executado.
