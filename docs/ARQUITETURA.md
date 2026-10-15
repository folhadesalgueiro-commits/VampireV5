# Arquitetura da Crônica V5

Aplicação local com interface React 19, TypeScript e Vite; API Express 5; banco SQLite usando o módulo `node:sqlite` do Node 24. Não usa serviços pagos. Os dados de personagens e campanhas ficam no servidor local, não em um armazenamento volátil da interface.

## Organização

| Pasta                       | Responsabilidade                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `shared/model.ts`           | Contratos Zod, terminologia, personagens, conteúdo e campanhas                                                                  |
| `shared/rules.ts`           | Funções puras: dados, Fome, dano, Humanidade, efeitos e progressão                                                              |
| `shared/alchemy.ts`         | Ciclo puro de preparação/ativação/resolução, capacidade, custos, qualidade e efeitos seguros de fórmulas                        |
| `shared/alchemy-effects.ts` | Concentração por turno e penalidade de Névoa compartilhadas por ficha, rolagem e combate, sem ciclos de importação              |
| `shared/thin-blood.ts`      | Perfil de Sangue-Ralo, características sem custo, projeção de concessões, pré-requisitos de Perdição e elegibilidade de Frenesi |
| `shared/combat.ts`          | Técnicas, defesa, natureza/tipo de dano, equipamentos, reduções, incapacidade e conflito opcional de uma rolagem                |
| `shared/bonds.ts`           | Calendário da ficção, formação, resistência, decadência e exceções de Laços baseadas em dados                                   |
| `shared/blood-mechanics.ts` | Marcadores narrativos, cura, Despertar noturno, Brilho, alimentação vampírica e recuperação de sessão                           |
| `server/db.ts`              | SQLite, transações, controle de versão e histórico                                                                              |
| `server/auth.ts`            | Contas, sessões, autorização e ocultação de informações privadas                                                                |
| `server/app.ts`             | Operações integradas, importação, biblioteca, sessões e conflitos                                                               |
| `server/seed.ts`            | Catálogo inicial com origem, estado de revisão e referências                                                                    |
| `src/components`            | Formulários, controles de pontos, modais e salvamento automático                                                                |
| `src/pages`                 | Fichas, catálogos, Oficina, campanhas, biblioteca, combate e configurações                                                      |
| `scripts`                   | Importação de documentos privados                                                                                               |
| `tests`                     | Testes unitários, integração com SQLite/API e navegador                                                                         |

## Persistência

O SQLite utiliza WAL, chaves estrangeiras, tempo de espera para bloqueios e transações `BEGIN IMMEDIATE`. O banco fica por padrão em `.data/cronica.sqlite`; pode ser substituído com `V5_DB_PATH`. Edições enviam a versão conhecida do registro. Uma versão obsoleta recebe HTTP 409 em vez de sobrescrever alterações. A interface mantém as alterações locais quando um salvamento falha. Contratos normalizam campos novos de fichas antigas na leitura; o catálogo do sistema tem revisão e atualização transacional sem substituir definições personalizadas.

Exclusões são arquivamentos reversíveis. Conteúdos com vínculos ativos não podem ser excluídos. A restauração JSON remapeia IDs e importa cópias em uma transação. Ela preserva os registros existentes e não importa senhas ou sessões. O proprietário das campanhas restauradas é a conta que restaura; jogadores devem ser reassociados.

## Autorização

O primeiro acesso cria o Narrador inicial. O Narrador cadastra contas e adiciona seus jogadores às campanhas. Senhas usam scrypt e sal aleatório. Cookies de sessão são HttpOnly e SameSite=Strict, com validade de sete dias; o banco guarda o hash do token. Requisições de escrita exigem um cabeçalho de proteção. Login limita tentativas por endereço.

A autorização ocorre na API, incluindo histórico, backup e biblioteca. Registros privados não aparecem para jogadores; `privateNotes` é removido das respostas. Narradores administram suas próprias campanhas. Jogadores podem editar suas fichas e usar as ações permitidas; mudanças mecânicas em fichas ativas passam pelas ações do sistema ou pelo Narrador. Definições oficiais não podem ser alteradas nem excluídas pela API.

## Motor de efeitos

Conteúdo cadastra operações de uma lista fechada. Não há eval, expressões executáveis ou scripts fornecidos pelo usuário. Efeitos passivos de Clãs e Vantagens modificam Atributos, paradas e máximos de recursos. Poderes podem testar, pagar Despertar, causar/recuperar dano, impor condições e manter modificadores temporários. Condições usam comparação de Fome, Humanidade, Potência, Clã, Perícia, etiquetas ou condições narrativas. Efeitos que não cabem nesse contrato ficam narrativos.

`COBERTURA_REGRAS.md` distingue o motor operacional de regras oficiais ainda não revisadas. Um cadastro de consulta não equivale a automação da regra. Marcadores de noite/cena/turno são alterados por operações autorizadas, com expiração de efeitos de toda a campanha na mesma transação. O backup remapeia os identificadores dos marcadores e preserva limites já utilizados; os controles não dependem do relógio do computador. Laços são parte do contrato da ficha, protegidos contra edições diretas, com referências de reinante e limites remapeados no backup. O encerramento por excesso de servos acompanha datas da ficção; decadência exige confirmação narrativa do afastamento.

## Confrontos e natureza

As fichas têm natureza `vampire` ou `mortal`, com padrão vampiro para dados antigos. Recursos e criação mortais usam contratos próprios. Equipamentos têm tipo, índice, fonte, armadura e penalidade de Destreza, sem código executável. O módulo de combate aplica arma e uma armadura do inventário equipado; a ordem de dano misto é um critério explícito armazenado no histórico.

Confrontos são registros persistentes com campanha, participantes e apostas. Agarramentos ficam nas fichas, com referência ao agarrador e marcadores do turno, protegidos contra edição direta e remapeados no backup. Exclusão não pode quebrar um vínculo ativo. Os endpoints validam acesso do Narrador, campanha e participantes e atualizam fichas/histórico/rolagens atomicamente. O conflito de uma rolagem encerra seu registro e não permite Surto ou rerrolagem de Vontade.

## Escolhas de Sangue-Ralo

O contrato `thinBlood` mantém Afinidade/Poder inicial, Perdição, método inicial e fórmula inicial. As concessões são projetadas para validar pré-requisitos e aplicadas somente ao concluir. Pontos comuns e características sem custo usam orçamentos separados. A progressão de Alquimia concede uma fórmula por ponto, valida pesquisa e mantém um método fixo por ficha nesta versão; a preparação/ativação não é simulada pelo contrato de aquisição.

As escolhas são remapeadas no backup. O Narrador pode registrar escolhas em fichas antigas sem perder experiência; trocar um método aprendido é bloqueado. Mudanças de escolhas ficam no histórico. Jogadores podem configurar o perfil no rascunho, com referências/permissões validadas; fichas ativas protegem perfil, escolhas, características e Poderes contra alteração direta.

## Fontes privadas

Os 736 registros de página foram indexados em FTS5 a partir dos PDFs fornecidos. O banco guarda texto, identificação e caminho do PDF, mas os PDFs e sua transcrição integral não são incluídos no código-fonte. A biblioteca exige autenticação e pode mostrar a página original para preservar símbolos e diagramação. Os PDFs continuam fora do checkout, em `/workspace/attachments`; a extração fica em `/workspace/reference-text` nesta máquina.

Importar os documentos é necessário em uma instalação nova fora do snapshot. `docs/FONTES.md` e `docs/INDICE_DOCUMENTAL.csv` registram a paginação e a integridade dos textos, sem reproduzir os livros.

## Preparações e ativações de Alquimia

`alchemy` recebe padrões vazios ao ler fichas anteriores. Preparações guardam método/local, receptáculo, ingredientes, modificador, equipamento, dados e concentração. Ativações guardam dados imutáveis, alvos, etiquetas, qualidade pendente/efeito ativo/encerramento e resolução. `POST /api/characters/:id/alchemy` valida acesso a cada alvo, executa o motor e salva todos os participantes, custos e auditoria na mesma transação. Edição genérica e cadastro não fornecem preparações gratuitas. Exclusão é bloqueada enquanto houver vínculos vivos.

O custo de destilação não é repetido na ativação. Athanor/Calcinatio preservam os dados da preparação; Fixatio rola no consumo e remove o frasco. Ativação pendente já foi paga. A rerrolagem usa as operações dedicadas `rerollDistillation` e `acceptDistillation`, sem passar pelo endpoint de rerrolagem genérico e sem repetir consumo. A resolução do Narrador não gera outro consumo. Fórmulas de extração/transformação/Torpor são bloqueadas pelo ciclo padrão até possuírem procedimentos próprios.

Efeitos usam identificador da ativação no `effectKey`; encerrar remove apenas os efeitos daquela operação em todos os alvos. Avançar cena/noite encerra durações e atualiza o registro da ativação quando todos os efeitos terminam. Concentração só reduz em avanços de turno ou confirmação fundamentada do Narrador. Os dados do catálogo limitam valores de efeito a ±30; o estado calculado aceita multiplicação por nível/margem, até ±3000, mantendo padrão zero para compatibilidade. Dano continua sujeito ao limite validado pelo motor. O resumo conserva entradas recentes e todas as ativações pendentes/ativas; a auditoria completa continua no banco e no backup. Ativações ainda pendentes/ativas não são descartadas por esse resumo.

Backup gera novos IDs de preparações/ativações, remapeia fórmulas, receptáculos, alvos, chaves de efeitos e marcadores temporais. A validação rejeita IDs repetidos e referências incompatíveis e desfaz a restauração inteira na falha. React e Zod são compilados em chunks próprios para permitir reaproveitamento de arquivos de dependências entre builds.

## Revisão dos dados e Vontade na destilação

Preparações e ativações incluem `review` com estado aberto/fechado, indicação de rerrolagem e dados originais. O padrão legado é fechado. A camada de validação exige que os Dados de Fome e o número de dados normais coincidam antes/depois, que a indicação de rerrolagem tenha um original e que uma ativação aberta seja Fixatio ainda pendente. O nível de Alquimia usado é capturado em `alchemyLevel`; zero identifica um registro legado sem essa informação, mantendo a resolução anterior.

Novas preparações Athanor/Calcinatio abrem a revisão ao rolar. Ativar fecha a preparação e copia seu histórico para a ativação. Fixatio abre a revisão somente com `reviewDistillation: true`; o frontend envia esse campo por padrão. A ausência do campo conserva a API anterior, com aplicação direta quando elegível. Cada revisão aceita uma operação de até três índices normais, preservando dados não selecionados/Fome. O motor calcula o resultado com os dados salvos, não com uma nova parada ou Fome atual, e paga uma Vontade sem metade. Requisições duplicadas são rejeitadas com o estado já salvo, na mesma transação.

Rerrolar não aplica efeitos. Aceitar fecha a revisão e aplica o resultado automático elegível ou deixa a decisão narrativa pendente. A aceitação valida de novo o acesso a cada alvo e não cobra os custos anteriores. Resolver, encerrar e avanços de tempo fecham revisões de ativação. Avançar tempo não presume um resultado aceito nem cria efeitos passados. O histórico guarda a operação original e o evento de rerrolagem, com os dois resultados e o gasto. Backup/restauração conserva estado, nível e originais sem reabrir uma revisão fechada.

## Testes próprios de Longo Alcance

`shared/alchemy-formulas.ts` recebe operações `formulaTest`, `rerollFormulaTest` e `acceptFormulaTest`. O estado da ativação inclui `formulaTests` e `longReach`; defaults preservam registros legados sem testes ou sustentação presumidos. Paradas são calculadas no início do uso, com nível de Alquimia capturado na ativação; aceitar avalia os dados salvos, sem sorteio nem nova parada. Ator e resistência têm originais/revisões independentes. Movimentar objeto sem resistência conserva um registro sem dados. Dano usa `receiveDamage` e seus controles de mitigação, conversão e incapacidade.

A API verifica acesso ao alvo informado e ao alvo salvo antes de sortear/rerrolar/resolver. As atualizações de todos os envolvidos, Vontade, condições, resultado, histórico e auditoria são transacionais. Cada parada admite uma rerrolagem; requisições repetidas encontram o registro fechado. O endpoint genérico de dados não altera testes de Alquimia. Conteúdo/estado não executam código.

O relógio calcula quais ativações tiveram manutenção aceita no turno anterior e preserva seus efeitos na transição ao próximo; nesse turno é necessária outra manutenção antes do avanço seguinte. Teste pendente é cancelado e não sustenta por si só. Falha, término ou troca de alvo remove efeitos daquela ativação. Para ficha avulsa, expiração do marcador do usuário também limpa efeitos externos mesmo sem avançar o relógio independente do alvo. Não há dano de queda automático. Registros encerrados e paradas antigas continuam na auditoria; o resumo mostra os oito usos recentes, e o histórico completo fica no banco/backup.

Restauração remapeia IDs de testes, alvos e marcadores de ação/manutenção, além dos vínculos existentes. Validação exige revisão coerente, Fome preservada, dificuldade 3 na sustentação, teste pendente apenas em ativação ativa, histórico válido de manutenção e IDs únicos. Qualquer falha desfaz a importação inteira.

## Envolver e asfixia

`formulaOperation` em `shared/alchemy-formulas.ts` também recebe o modo `suffocate`. O mesmo registro tipado/revisões de `formulaTests` é reutilizado, com peso nulo, alvo da ativação e paradas próprias; modo/fórmula são validados sem misturar usos de Longo Alcance. Ativar Envolver exige um único alvo confirmado à vista. O efeito normal aplica um marcador de cena no usuário e obstrução no alvo, permitindo expirar alvos externos de ficha avulsa pelo relógio do usuário. Substituir Envolver encerra sua ativação anterior, além do limite próprio de Athanor.

`envelopPenalty` é chamado por `pool`, com contexto explícito/Armas de Fogo; confrontos passam a etiqueta de ataque à distância ao calcular ambas as paradas. A proteção de Névoa usa o alvo como antes. `envelopActionBlocked` consulta os efeitos ativos para asfixia e uma condição persistente para inconsciência, impedindo contorno por edição cosmética. Os bloqueios se integram a rolagens, ações, rerrolagens genéricas, conflitos e defesa estática. A API protege efeitos/condições geridas e recuperação de consciência inclusive em rascunhos; GM conserva os ajustes autorizados.

Aceitar uma disputa lê os dados salvos, verifica que a névoa ainda existe no mesmo alvo mortal e aplica a condição de asfixia. Vitória crítica também registra inconsciência narrativa independente da duração da névoa. Limpar efeitos daquela ativação não presume recuperação da consciência. Não há consumo, sorteio adicional ou dano periódico no aceite. Backup remapeia os vínculos e mantém revisões; registros pendentes legados sem alvo são restauráveis, mas não recebem o novo efeito sem alvo válido.

## Preparação de nível 4 e voo

`alchemyCraftingSchema` adiciona `crafting` a preparações e ativações, com noites concluídas, confirmação de pesquisa/vitae e registro. Padrões vazios preservam o legado sem presumir trabalho. `completeCrafting` é exclusivo do Narrador e não paga novamente; valida provas e método. Preparação de Impulso deixa Athanor/Calcinatio sem dados até concluir; o validador de restauração reconhece esse estado pendente. Ativar exige confirmação completa, alvo somente próprio e ausência de outro voo aberto, e copia a prova para a ativação antes de remover o frasco.

`shared/alchemy-flight.ts` resolve usos e suas revisões com operações existentes `formulaTest`, `rerollFormulaTest`, `acceptFormulaTest`. Estado `flight` mantém ar/chão, passageiro e carga. Movimentos sem resistência conservam registro sem dados; disputas usam nível de Alquimia capturado. No modo `ground`, o oponente é agente e vence empate; a UI identifica seu papel. Aceitar reconstrói os efeitos daquela ativação, preservando outras fontes, e mantém só os participantes dos efeitos atuais. Não cria posição geométrica, dano de queda ou agarramento comum.

Permissões são verificadas sobre participante informado, alvo salvo da disputa e passageiro atual antes de sortear/aplicar. Efeitos/condições são protegidos inclusive em rascunhos. Expiração da cena, encerramento e substituição Athanor limpam marcadores e estado de voo; relógio avulso também limpa efeitos externos. Backup remapeia passageiro, efeitos e testes; a validação rejeita prova incompleta/voo encerrado ainda no ar/referências inválidas com rollback. Pendências legadas permanecem encerráveis, mas não recebem voo automático com requisito desconhecido.
