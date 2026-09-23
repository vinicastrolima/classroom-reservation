# Spec Delta

## Purpose

Permitir que o solicitante receba e escolha configurações completas de ambiente que atendam às suas restrições atuais, sem registrar a busca ou a escolha no sistema.

## ADDED Requirements

### Requirement: Consulta stateless de configurações recomendadas
O sistema SHALL disponibilizar uma consulta autenticada para recomendar configurações de reserva simples a partir de um intervalo, quantidade de participantes e restrições opcionais de tipo de ambiente, localidade, recursos e suporte. A consulta MUST retornar apenas dados calculados a partir do estado atual e MUST NOT criar ou alterar registros persistidos.

#### Scenario: Consulta com alternativas viáveis
- **GIVEN** um solicitante autenticado e pelo menos dois ambientes viáveis para o intervalo informado
- **WHEN** ele solicita recomendações com período e quantidade de participantes válidos
- **THEN** o sistema retorna uma lista limitada de configurações viáveis sem criar uma reserva, busca ou seleção persistida

#### Scenario: Nenhuma configuração atende às restrições
- **GIVEN** um solicitante autenticado cujas restrições não podem ser atendidas por nenhum ambiente
- **WHEN** ele solicita recomendações
- **THEN** o sistema retorna uma lista vazia e uma explicação adequada para a ausência de opções

### Requirement: Elegibilidade consistente com a reserva
O sistema SHALL considerar uma configuração recomendada viável somente quando o ambiente e os recursos selecionados atenderem às restrições obrigatórias vigentes: ambiente ativo, capacidade, sobreposição de reservas, bloqueios e buffers, políticas de antecedência, qualificações, disponibilidade de recursos, manutenção e suporte solicitado. A identidade para avaliar qualificações e políticas MUST ser a do usuário autenticado.

#### Scenario: Ambiente sem qualificação do solicitante é excluído
- **GIVEN** um laboratório que exige uma qualificação não possuída pelo solicitante autenticado
- **WHEN** ele busca recomendações para o horário disponível desse laboratório
- **THEN** o laboratório não aparece entre as configurações recomendadas

#### Scenario: Recurso em conflito é excluído da configuração
- **GIVEN** um recurso necessário que está reservado ou em manutenção no intervalo informado
- **WHEN** uma configuração depende desse recurso para atender ao critério solicitado
- **THEN** o sistema não retorna essa configuração como viável

### Requirement: Estratégias determinísticas e explicáveis
O sistema SHALL oferecer `FIRST_FIT` como estratégia-base e `WEIGHTED_SCORE` como estratégia padrão. Ambas MUST avaliar o mesmo conjunto de restrições obrigatórias e produzir ordenação determinística para os mesmos dados de entrada. Cada configuração retornada MUST informar sua estratégia, pontuação e justificativas da adequação.

#### Scenario: Comparação com a estratégia-base
- **GIVEN** múltiplos ambientes viáveis e a estratégia `FIRST_FIT`
- **WHEN** o solicitante pede recomendações com os mesmos critérios duas vezes, sem alteração dos dados
- **THEN** o sistema retorna as configurações na mesma ordem estável da estratégia-base

#### Scenario: Recomendação por pontuação
- **GIVEN** múltiplos ambientes viáveis com capacidades e recursos diferentes
- **WHEN** o solicitante usa a estratégia padrão `WEIGHTED_SCORE`
- **THEN** o sistema ordena as configurações pela pontuação de adequação e informa as razões da classificação

### Requirement: Seleção sem formulário posterior
O sistema SHALL permitir que a jornada de recomendação reúna todos os dados obrigatórios de uma reserva simples antes da consulta e apresente cada resultado como uma configuração completa. Após selecionar uma configuração, a interface MUST exibir somente o resumo da solicitação e permitir seu envio direto, sem exigir o preenchimento de um formulário adicional de reserva.

#### Scenario: Seleção e envio da solicitação
- **GIVEN** que o solicitante informou finalidade, responsável, aceite dos termos e critérios válidos
- **WHEN** ele seleciona uma configuração recomendada e envia a solicitação
- **THEN** a interface envia uma reserva simples com o ambiente e os recursos da configuração escolhida

### Requirement: Validação definitiva na criação da reserva
O sistema SHALL tratar a recomendação como uma prévia sem garantia de reserva. Ao receber a solicitação escolhida, o sistema MUST reexecutar as validações de reserva e os controles de concorrência antes de persistir a reserva e aplicar a política de aprovação vigente.

#### Scenario: Configuração torna-se indisponível após a recomendação
- **GIVEN** uma configuração que estava viável quando foi recomendada
- **WHEN** outra reserva bloqueia o mesmo ambiente antes de o solicitante enviar sua solicitação
- **THEN** o sistema recusa a nova solicitação por conflito e não persiste uma reserva sobreposta

#### Scenario: Política de aprovação é preservada
- **GIVEN** uma configuração escolhida para um ambiente de criticidade `COMMON` que não exige aprovação
- **WHEN** a solicitação é validada e enviada
- **THEN** o sistema aplica a política atual de autoaprovação em vez de criar um fluxo de aprovação exclusivo para recomendações
