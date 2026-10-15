# Progresso do projeto

Versão atual: **0.10.0 — Impulso Suspenso no Ar e destilação de nível 4**, com cobertura oficial parcial. O objetivo de um sistema integral de todos os livros ainda **não está concluído**. Consulte `COBERTURA_REGRAS.md` para os limites de cada módulo.

## Fases

| Fase                       | Resultado atual                                                                                                                                                    | Estado                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| 1 — Análise documental     | Sete PDFs extraídos, 736 páginas indexadas/inventariadas, seções do núcleo revistas, conflitos registrados                                                         | Parcial; leitura analítica integral e revisão de todas as entradas pendentes                  |
| 2 — Estrutura              | React/TypeScript/Vite, API Express, SQLite, navegação, autorização e contratos                                                                                     | Implementada e testada                                                                        |
| 3 — Fichas                 | Ficha persistente, atributos/perícias, recursos derivados, narrativa, imagens, criação guiada e validações                                                         | Operacional; criação de Sangue-Ralo testada, carniçais e algumas exceções pendentes           |
| 4 — Mecânicas              | Dados/Fome, Despertar noturno, cura superficial/agravada, Brilho de Vida, alimentação vampírica, Remorso, Potência, Poderes, Laços, calendário e ciclo de Alquimia | Núcleo testado; catálogo/automação oficial completos pendentes                                |
| 5 — Combate/progressão     | Disputas físicas/sociais, agarramento/mordida/estaca, blindagem, uma rolagem e histórico; XP integrado                                                             | Técnicas, blindagem e opção de uma rolagem testadas; demais procedimentos avançados pendentes |
| 6 — Conteúdo personalizado | Clãs/Linhagens, Disciplinas/Poderes, Qualidades/Defeitos e demais editores, requisitos, efeitos, imagens e JSON                                                    | Funcional e integrado; efeitos não representáveis ficam narrativos                            |
| 7 — Campanhas/Narrador     | Campanhas, contas, Coteries/Domínios, registros, privacidade e início/fim de sessão                                                                                | Operacional; algumas ferramentas usam registros narrativos genéricos                          |
| 8 — Biblioteca/integração  | Busca FTS5, páginas e PDFs locais, referências, sincronização de Coteries, efeitos e persistência                                                                  | Implementada; interpretação/revisão de todo o conteúdo não concluída                          |
| 9 — Testes/finalização     | Testes unitários, API/SQLite e fluxo real de navegador; build de produção e manuais                                                                                | Núcleo validado; aceitação integral depende das pendências de regras                          |

## Funcionalidades implementadas

- Interface pt-BR escura e responsiva; todas as 15 áreas de navegação.
- Cadastro inicial de Narrador, contas de jogadores, campanhas com membros e controle de acesso no servidor.
- Fichas de personagens/NPCs, retratos, especializações, Convicções/Pilares, recursos, história, notas e notas privadas.
- Salvamento automático, versão por registro, erros visíveis e proteção contra sobrescrita concorrente.
- Criação guiada com bloqueios de distribuição, requisitos e exceções fundamentadas do Narrador.
- Rolagens reais com aleatoriedade criptográfica, Fome, críticos, Falhas Bestiais, Surto e histórico.
- Rerrolagem de até três dados normais com gasto de Força de Vontade. Na Alquimia, revisão antes dos efeitos, dados originais preservados e sem repetir Despertar, alimentação ou consumo.
- Dano superficial/agravado, conversão no excesso, comprometimento e recuperação superficial limitada a uma por turno.
- Cura agravada após a noite seguinte e o Despertar regular: três testes, um ponto por noite e Torpor nas falhas acima de Fome 5. Ferimentos novos não bloqueiam a cura de ferimentos anteriores elegíveis.
- Marcadores persistentes de noite, cena e turno, compartilhados pela campanha e avançados pelo Narrador; durações menores encerradas automaticamente.
- Cura de Sangues-Ralos como vampiros, exceto Fragilidade Mortal; Brilho natural sem Despertar. A criação especializada continua parcial.
- Brilho de Vida, dois dados em Humanidade 8, aparência humana sem custo em 9/10 e término ao fim da noite.
- Máculas com evento, degeneração, Remorso e alteração de Humanidade.
- Geração, Potência e duas versões de tabela selecionáveis por campanha.
- Alimentação humana/animal/bolsa e entre vampiros: relações de saciedade por Potência, atualização atômica das duas Fomes e integração do consumo direto aos Laços.
- Disciplinas e Poderes vinculados; uso configurável com alvos, resistência, custo e efeitos seguros; uma ativação por turno e dois dados nos custos elegíveis por Potência.
- Bônus condicionais avaliados no teste correspondente, vários efeitos do mesmo Poder preservados e modificadores permanentes com custo aplicados após ativação.
- XP recebido/gasto, progressão e compra atômica com requisitos.
- Oficinas de Clãs, Linhagens, Disciplinas, Poderes, Qualidades/Defeitos e demais tipos; imagens, referências, duplicação e preservação dos oficiais.
- Importação/exportação de conteúdo validada e vínculos remapeados.
- Inventário com quantidades, equipar, transferir, índices, fontes de dano, armadura e penalidade de Destreza; seleção de equipamentos da própria ficha no confronto.
- Confrontos persistentes com participantes, apostas, resolução e encerramento; controle exclusivo do Narrador e mesma campanha.
- Agarrar, manter, causar dano, morder, escapar e soltar com vínculo persistente e limite por turno; backup conserva o limite.
- Etiquetas de circunstância nos confrontos integram os efeitos condicionais personalizados; alvo mortal identificado automaticamente nas trocas.
- Mordida direta com −1 sucesso, dois danos agravados fixos e restrição; Dentes de Bebê impede presas.
- Estaca com −2 sucessos, bônus zero, cinco danos antes da divisão e condição Estacado; Isca de Estaca causa Morte Final.
- Cobertura, defesa total, defesas sucessivas e penalidade de sucessos por alvos específicos, com modificadores separados.
- Blindagem, roupa contra cortes, SWAT penalizando Destreza, Rigidez ativa e Corpo Letal adquiridos; ordem do dano misto identificada como critério do Narrador.
- Opção Conflito de Uma Rolagem para grupo: oposição fixa, dano sem metade/mitigação, Surto/rerrolagem bloqueados e atualização atômica.
- Torpor por Vitalidade toda agravada; incapacidade mortal exige decidir coma ou morte; bloqueio de ações e defesa estática.
- Natureza Mortal explícita, distribuições e orçamento inicial, sem Fome/Disciplinas/ações de Sangue; recuperação superficial por Vigor no início da sessão.
- Coteries, membros sincronizados com fichas, Domínios, recursos, dívidas e objetivos.
- Sessões, diário, missões, lugares, facções, relações, favores, Máscara, alimentação e segredos.
- Início de sessão recupera Vontade superficial e um agravado por Ambição confirmada; encerra com Remorso e XP uma vez; sem repetir recuperação na mesma sessão.
- Calendário da crônica definido pelo Narrador; próxima noite acrescenta um dia e saltos de datas consomem os dias restantes dos efeitos.
- Laços com bebidas/noites de formação, Força 0–6, um reinante, imunidade, Escravo de Laço, modificadores de resistência e restrições de Tremere/Sangue-Ralo.
- Goles de vitae sem saciedade, desafios por cena/turno e afastamento por sessão, registro e rerrolagem de Vontade quando permitida.
- Decadência por mês ou três meses com confirmação do afastamento; Laço Curto usa mudanças de lua confirmadas, sem calendário lunar presumido.
- Limite de servos por Potência; vínculo mais antigo marcado para encerramento ao fim de uma semana.
- Regras de Laço configuráveis nos Clãs, Qualidades e Defeitos personalizados, integradas às fichas e JSON.
- Qualidades de custo fixo mínimo são adquiridas pelos pontos completos, com XP correspondente.
- Sangues-Ralos: oito Qualidades/oito Defeitos, pares sem custo separados do orçamento, incompatibilidades, Afinidade com Poder e Alquimia com método/fórmula concedidos na conclusão.
- Preparação e ativação separadas para Athanor, Calcinatio e Fixatio; custos, rolagens, concentração, receptáculos e frascos persistentes.
- Névoa com qualidade normal aplica penalidade de identificação/ataque à distância; grupo, encerramento e duração sincronizados. Qualidades não definidas aguardam resolução registrada do Narrador após pagar e consumir.
- Fórmulas personalizadas usam o mesmo ciclo e efeitos seguros; dados, atributos, dano/cura, condições e Fome, com resolução manual dos testes próprios/efeitos não representáveis.
- Afinidade progride como Disciplina de fora do Clã; Alquimia concede uma fórmula por ponto e exige pesquisa; fórmula adicional usa nível ×3. Um método inicial persistente por ficha.
- Maldição de Clã com seleção, Gravidade 1 e pré-requisitos; sem Compulsão herdada. Frenesi espontâneo bloqueado sem Temperamento Bestial; provocação sobrenatural é explícita.
- Carne Morta aplica −1 no contexto caraACaraMortal. Dependência de Vitae requer resolução do Narrador registrada antes de ativação/evolução; semana e passivos ainda não automatizados.
- Jogadores escolhem perfil e campanha durante o rascunho; campos de perfil e Poderes ficam protegidos após finalizar.
- Narrador ajusta características/registro das escolhas sem reaplicar concessões; fichas antigas podem registrar o método sem perder XP. Método já aprendido não é substituído.
- Fichas antigas recebem padrões compatíveis; catálogo do sistema usa revisões, preservando conteúdos personalizados e variantes.
- Longo Alcance: usos separados da destilação, deslocamento sem resistência, puxar/arremessar, revisão de ambas as paradas, Vontade individual, dano superficial por margem e sustentação renovada por turno. Manipulação delicada/precisão ficam registradas com dificuldade do Narrador; ataque de faca e queda ainda são separados.
- Envolver: alvo único visível, −3 em visão/ataque à distância, disputa de asfixia contra mortal, revisão de ambas as paradas, restrição de ações e inconsciência crítica persistente. Sem dano periódico ou recuperação de consciência presumidos.
- Impulso Suspenso no Ar: preparação pendente de três noites, confirmação do Narrador, prova conservada no consumo, voo pessoal/carga, disputas de transporte/aterramento, revisão e pouso. Velocidades qualitativas; altura, percurso e queda narrativos.
- Busca e consulta das 736 páginas locais; opção de conferir o PDF original autenticado.
- Backup/restauração JSON com fichas, campanhas, conteúdo, rolagens e histórico; restauração como cópias.
- Exclusão reversível com confirmação do nome, proteção de vínculos e lixeira.

## Testes e validação

Os testes usam referências declaradas para dados, criação, dano, Potência, Humanidade e XP. Os arquivos de teste não representam conteúdo de campanha pré-carregado.

- `tests/rules.test.ts`: casos determinísticos do núcleo; distribuições, Fome, críticos, Falhas Bestiais, Despertar, dano, recursos, Humanidade/Máculas, Disciplinas, efeitos, custos e restrições.
- `tests/blood-mechanics.test.ts`: 16 casos documentais de cura, Despertar, Brilho, alimentação vampírica e duração.
- `tests/combat.test.ts`: 26 casos documentais de técnica, defesa, mordida, estaca, armadura, mortal, dano misto, Rigidez, Corpo Letal e conflito de uma rolagem.
- `tests/thin-blood.test.ts`: 32 casos documentais de características, criação, Afinidade, Alquimia, Perdição, contexto e progressão.
- `tests/alchemy.test.ts`: 47 casos documentais de métodos, custos, concentração, frascos, qualidade, Névoa, alimentação de Calcinatio e efeitos próprios.
- `tests/alchemy-formulas.test.ts`: 35 casos de Longo Alcance, disputas, arremesso, revisão, sustentação e validação de registros.
- `tests/envelop.test.ts`: 22 casos de alvo único, visão, asfixia, revisão, inconsciência, duração e restrições.
- `tests/flight.test.ts`: 27 casos de preparação de nível 4, voo, transporte, disputas, Vontade, duração e validação.
- `tests/bonds.test.ts`: 17 casos de formação, tempo, decadência, disputa, exceções, reinício e conteúdo personalizado.
- `tests/integration.test.ts`: API real com SQLite; autorização, sigilo, persistência, conflitos de versão, editores, importação, backup, recursos, Poderes, inventário, progressão, sessões, Coteries e combate.
- `tests/browser/workflow.spec.ts`: interface servida de verdade; conta, Disciplina/Clã/Poder, campanha, ficha, efeito, rolagem, nova noite, Despertar, cura agravada, confirmação de Ambição, recuperação de Vontade, calendário, Laço, desafio, decadência, ficha mortal, equipamentos e confronto, recarregamento, exportação e tamanho móvel.
- `npm run build`: verificação TypeScript e compilação Vite.

Resultados finais e comandos de reprodução ficam em `docs/VALIDACAO.md`. Não há testes ignorados para esconder falhas de regras. Funcionalidades pendentes não são consideradas concluídas por testes de outros módulos.

## Problemas conhecidos e limites

1. Cobertura documental parcial: 106 registros de consulta ainda requerem revisão. Uso automático de uma entrada não revisada é bloqueado e exige resolução confirmada do Narrador.
2. Criação de carniçais pendente. O contrato inicial de Sangues-Ralos está testado; Ressonância temporária, estado diurno/Bebedor do Dia, Dependência semanal/passivos e fórmulas especiais, testes próprios das demais fórmulas e métodos adicionais de Alquimia ainda precisam de procedimentos próprios. Mortais têm validação/recursos próprios, mas o catálogo completo de suas Vantagens, Medicina, repouso e Compulsão de baixa Humanidade continuam parciais.
3. Medicina, Lesões Paralisantes, Torpor prolongado, recuperação/remoção de Estacado, múltiplos ataques, alimentação durante agarramento, diablerie, procedimentos especiais de Alquimia, Ressonância/Discrasias e várias Perdições/Compulsões ainda precisam de procedimentos dedicados. Agarramentos envolvendo terceiros ficam em resolução manual; não há posicionamento tático automático.
4. Laços com mortais/carniçais não automatizados; exceções de conhecimento e variantes sobrenaturais exigem consulta. Em Potência zero com Sangue Concatenado, o limite de servos é ambíguo e permanece em resolução manual.
5. Osíris, Rainha da Cena e conflitos de custos dos Predadores exigem revisão/registro adicional. Referências e limitações aparecem na ficha e na matriz.
6. Coteries exibem a dificuldade por Chasse; os modificadores contextuais de Lien/Portillon ainda são aplicados pelo Narrador.
7. Registros narrativos são organizacionais; não equivalem a um grafo visual completo de relações nem a todas as tabelas de NPCs dos livros.
8. Troca posterior de proprietário de ficha, recuperação de senha e administração avançada de contas não têm interface dedicada.
9. O teste de navegador depende de Chromium instalado. O caminho é configurável por `V5_BROWSER`.
10. Os PDFs e o texto integral não fazem parte do Git. Fora do ambiente/snapshot atual, é necessário importar fontes privadas próprias para restaurar a biblioteca.
11. A publicação do ambiente em nuvem e a restauração em uma tarefa nova ainda não foram verificadas. O envio do código ao GitHub é independente dessas etapas.

## Continuação — versão 0.2

Foram conferidas as páginas PDF 106, 187–189, 195–197, 212 e 216 do Básico para os contratos desta versão. O Laço foi consultado para explicitar o risco da alimentação entre vampiros; sua formação, resistência e decadência não foram automatizadas. Corrigidos descarte de efeitos condicionais na ativação, empilhamento incompleto e bônus permanentes antecipados. Validados 106 testes unitários/integração e o fluxo de navegador ampliado. As novas operações são reais e persistentes; as limitações acima continuam pendentes.

## Continuação — versão 0.3

Conferidas as páginas PDF 82, 89–90, 101–102, 157, 159–160 e 212–213 do Básico, além do Companion 61–62. Laços entre vampiros implementados com datas da ficção e confirmação de afastamento. Corrigido o bloqueio genérico de cura/Brilho de Sangues-Ralos da versão 0.2: a regra geral permite recuperação vampírica e Brilho natural; Fragilidade Mortal impede a cura. Qualidades/Defeitos de Laço e duas características de Sangue-Ralo foram adicionados sem declarar criação especializada concluída. Corrigido o login que enviava nome vazio, com teste de regressão e fluxo de retorno pela interface. Catálogo: 200 entradas, 111 em revisão pendente. Validação desta versão: 133 testes de regras/integração e dois fluxos de navegador.

## Continuação — versão 0.4

Conferidas as páginas PDF 103–105, 189–190, 201, 242, 250 e 291–300 do Básico e 44–47 do Companion. Implementadas técnicas de agarramento/mordida/estaca, blindagem e fontes de dano por natureza, Rigidez e Corpo Letal, opção de conflito de uma rolagem e confrontos persistentes. Adicionada a natureza Mortal com criação e recursos específicos. Preservadas a ambiguidade dos contundentes pesados entre versões e a ordem não especificada do dano misto, com critério visível do Narrador. Catálogo: 203 entradas, 110 em revisão pendente. Testes do núcleo/API: 168 aprovados, incluindo 26 de combate e 61 de integração; três fluxos de navegador e build aprovados. Corrigida também a reabertura tardia de janela ao fechar uma ação de Poder enquanto a API ainda responde; o fluxo de navegador reproduz essa latência e confere a operação persistida. A cobertura integral continua pendente.

## Continuação — versão 0.5

Conferidas integralmente as seções de criação/características nas páginas PDF 89–91,125–131,159–160 do Básico, aquisição/métodos/primeiras fórmulas em 273–278 e resumo/errata do Companion 62/66. Implementados pares sem custo, escolhas específicas e concessões iniciais, progressão de Afinidade/Alquimia em um método, requisitos da Perdição e exceções de Frenesi. Criar conteúdo personalizado continua possível sem código, inclusive Afinidade e Perdição com definições próprias. O catálogo passou a 215 entradas, 110 em revisão pendente, na revisão 5. Corrigidas as escolhas de perfil/campanha do jogador em rascunho e protegidos os Poderes após concluir. Validação final: 209 testes de regras/API e quatro fluxos de navegador aprovados, além da compilação e verificação do serviço/banco principal. Os resultados e comandos ficam em `docs/VALIDACAO.md`.

## Continuação — versão 0.6

Conferidos os procedimentos nas páginas PDF 274–280 do Básico, tabela de alimentação em 188 e mínimo de parada em 95–97. Implementado o ciclo persistente de preparação, transporte, consumo, ativação, resolução e encerramento para os três métodos iniciais. Athanor usa Vigor, Calcinatio Manipulação e Fixatio Inteligência; cada parada soma Alquimia. Fixatio rola ao consumir, aplica equipamento de campo e limita frascos. Calcinatio conserva o receptáculo com emoção confirmada, usa nível −1 de alimentação e permite a variante nociva com dano/teste de sobrevivência. A fonte não define quanto sangue resta no humano nem elimina as consequências de vitae: repetição de drenagens, Laço com mortal e tratamento permanecem do Narrador.

Névoa foi revista, com custo e duração cadastrados, penalidade aplicada por alvo em rolagens/confrontos e ampliação a até cinco incluindo usuário. A tabela não foi extrapolada para faixas: somente 4 sucessos sem Crítico Confuso executam automaticamente o efeito normal; demais resultados são pagos, preservados e resolvidos pelo Narrador sem novo custo ou rolagem. Fórmulas especiais de extração, transformação e Torpor não recebem o procedimento genérico e continuam bloqueadas como pendentes. Métodos adicionais e simulação automática de Poderes continuam pendentes.

Catálogo: 215 entradas na revisão 6, 109 em revisão pendente. Novos registros de Alquimia são protegidos contra edição direta/cadastro gratuito e remapeados no backup, incluindo alvos e marcadores; fórmulas personalizadas usam efeitos sem código arbitrário. Valores calculados dos efeitos mantêm o padrão zero de fichas antigas e comportam multiplicação por nível/margem. A ferramenta de sessão aparece no início da aba Sangue. O bundle separa React e validação em arquivos próprios.

Validação final: 253 testes de regras/API e cinco fluxos reais de navegador aprovados, sem testes ignorados; compilação TypeScript/Vite e formatação aprovadas. Serviço principal reiniciado após backup consistente; integridade e biblioteca autenticada verificadas. Evidências em `docs/VALIDACAO.md`; as pendências acima não contam como concluídas.

## Continuação — versão 0.7

Conferidas as regras de rerrolagem, gastos e esgotamento de Vontade nas páginas PDF 100,104–105,135,183 e sua aplicação aos métodos em 274–276 do Básico. Implementada seleção de até três dados normais, preservando todos os Dados de Fome e a parada original. Um ponto de Vontade causa superficial sem divisão ou converte superficial em agravado na trilha cheia; Vontade toda agravada bloqueia o gasto. A operação é única por destilação e não repete custos, alimentação, frasco ou ativação.

Athanor/Calcinatio revisam a rolagem durante a preparação; ativar fecha essa etapa. Calcinatio retém a fórmula, mas sua reutilização não cria outro orçamento de rerrolagem. Fixatio na interface abre revisão após consumir e antes de quaisquer efeitos; aceitar aplica um resultado normal elegível ou conserva a pendência do Narrador. Aceitar, resolver, encerrar ou avançar tempo fecha a revisão da ativação. Este fechamento é o critério operacional para impedir alterações retroativas, não uma proibição nova atribuída ao livro. Clientes anteriores da API preservam o comportamento anterior; `reviewDistillation: true` abre o novo fluxo.

Dados atuais/originais, gasto e nível de Alquimia na ativação são persistentes e entram no backup/histórico. Evolução posterior não amplia um efeito já ativado. Importação rejeita alteração de Dados de Fome entre versões, tamanho de parada incompatível ou revisão aberta em resultado resolvido. Registros anteriores recebem revisão fechada, mantendo os efeitos já aplicados e sem presumir que ainda poderiam ser rerrolados. Novos testes verificam também requisições duplicadas e permissões de alvo na aceitação.

Catálogo permanece com 215 entradas na revisão 6, 109 em revisão pendente. Validação final: 276 testes de regras/API, seis fluxos de navegador, compilação e formatação aprovados. Fórmulas especiais, métodos adicionais, demais testes próprios e cobertura integral continuam pendentes. Evidências em `docs/VALIDACAO.md`.

## Continuação — versão 0.8

Conferidos Longo Alcance no Básico PDF 277, disputas/conflitos em 101–102 e dano em 104–105. O efeito normal revisado agora deixa o Poder pronto por um turno. Cada uso tem registro próprio, com dados do usuário/resistência, peso e confirmação de visibilidade/alcance aproximado, sem repetir destilação, ativação ou Despertar. A revisão antecede o deslocamento/dano; cada participante pode rerrolar até três normais com sua Vontade, uma vez, preservando Fome. O Narrador ou proprietário deve ter autorização sobre todos os envolvidos; um jogador não resolve unilateralmente ações contra ficha alheia.

Mover objeto sem resistência não exige rolagem e não provoca dano de choque. Puxar usa empate favorável ao agente e aproxima ao alcance de agarramento, sem aplicar agarramento. Arremessar exige margem positiva, desloca um metro por margem, aplica essa quantidade de dano superficial pelo motor de mitigação/divisão e marca Caído. O tratamento de empate é explícito como interpretação da remissão a disputas/conflitos. Posição no espaço, obstáculos, objetos frágeis, levantamento do alvo caído e quedas continuam narrativos.

Sustentar usa Determinação + Alquimia, dificuldade 3, em cada turno. Sucesso conserva o Poder na transição ao turno seguinte; nova manutenção deve ser aceita antes do próximo avanço. Omissão/falha/encerramento limpa os efeitos, inclusive em alvos externos de fichas avulsas, sem inventar dano de queda. Encerrar, substituir Athanor ou avançar tempo cancela testes abertos e fecha suas revisões. Um uso por ativação/turno e encerramento na troca de cena/noite são critérios operacionais conservadores; divisão de ações e sustentação entre cenas não estão implementadas.

Manipulação delicada usa Raciocínio + Alquimia. Precisão com faca/ferramenta usa Determinação + Alquimia −2; dificuldade/registro são do Narrador. A faca registra a instrução +1 de dano, mas seu ataque permanece separado porque a entrada não define uma defesa própria. O catálogo é parcial, não uma declaração de combate telecinético integral.

Dados atuais/originais, custos, testes, alvos e marcadores são persistentes e remapeados em backup, incluindo manutenção. Importação valida estados, dificuldade fixa de sustentação, IDs, Dados de Fome e referências pendentes, com rollback integral. Fichas anteriores recebem histórico vazio e nenhuma sustentação presumida.

Catálogo: 215 entradas, revisão 7, 108 em revisão pendente. Validação: 322 testes de regras/API, sete fluxos de navegador, build e formatação; resultados detalhados em `docs/VALIDACAO.md`. Métodos adicionais, fórmulas especiais, demais testes próprios e leitura analítica integral continuam pendentes.

## Continuação — versão 0.9

Conferidas integralmente as entradas de Envolver nas páginas PDF 277–278 do Básico, e a disputa geral da página 101. A obstrução visual não exige uma disputa inicial: após revisar a destilação normal, um único alvo confirmado à vista recebe −3 em detecção visual e ataques à distância, por uma cena ou até encerrar. A ativação paga um Despertar; o custo da preparação permanece separado. Um novo Envolver substitui o anterior do mesmo alquimista, inclusive em Fixatio, e limpa seus efeitos no alvo anterior. A gravidade já narrada da destilação fraca/aumentada continua com o Narrador.

Asfixia é um teste próprio adicional somente contra o mesmo alvo mortal: Raciocínio + Alquimia contra Vigor + Sobrevivência. Ambos os resultados são salvos antes de qualquer restrição; usuário/resistência podem rerrolar até três normais uma vez, pagando sua própria Vontade e preservando Fome. Aceitar avalia a disputa uma vez. Vitória restringe o mortal a tossir/sufocar; vitória crítica causa inconsciência, inclusive com consequências narrativas de Crítico Confuso. Falha não retira a obstrução visual nem consequências anteriores. Não foi introduzido dano periódico ou morte por asfixia.

O motor central aplica −3 uma vez, pelo contexto visual explícito, etiquetas `visao`/`deteccaoVisual`/`ataqueDistancia`, Armas de Fogo ou marcação de ataque à distância no confronto. Percepção visual sem alvo tem opção própria na interface/API; audição não recebe a penalidade. Névoa defensiva do adversário e obstrução visual própria são efeitos distintos, tratados cumulativamente; várias ocorrências da mesma obstrução usam a maior penalidade como critério documentado. A asfixia restringe ações voluntárias e exige defesa estática em confronto. Remover apenas uma condição por edição não contorna os efeitos; jogadores não alteram os efeitos/natureza nem antecipam a expiração para escapar, mesmo em rascunhos.

A névoa/asfixia terminam com cena/encerramento/substituição, incluindo alvos externos em fichas avulsas. A inconsciência fica como condição narrativa persistente porque a entrada não define seu despertar: o Narrador resolve a recuperação e remove **Inconsciente após Envolver** na área História/Condições. Um teste por ativação/turno, empate favorável ao agente, cancelamento de revisão ao avançar tempo e ausência de dano automático são limites explícitos desta implementação.

Backup remapeia testes/alvos/marcadores/originais, valida coerência de modo/fórmula e alvo único com rollback. Ativações antigas ainda pendentes sem alvo podem ser restauradas e encerradas; não recebem um alvo inventado nem automação vazia. Para utilizar o novo efeito, prepare/ative novamente com alvo confirmado. Custos anteriores permanecem no histórico.

Catálogo: 215 entradas, revisão 8, 107 em revisão pendente. Validação desta versão: 355 testes de regras/API e oito fluxos de navegador, build e formatação, detalhados em `docs/VALIDACAO.md`. Métodos adicionais, demais fórmulas/testes próprios, procedimentos especiais e cobertura documental integral continuam pendentes.

## Continuação — versão 0.10

Conferidos os requisitos de nível 4 e Impulso Suspenso no Ar no Básico PDF 279–280, além da disputa geral em 101. A preparação começa pagando seu Despertar e permanece pendente. **Concluir três noites** exige Narrador, registro, três noites de trabalho concluídas, pesquisa prévia de ao menos três meses e gota de vitae de origem compatível. A pesquisa é conhecimento já obtido para a fórmula, não três meses adicionais por frasco. Avançar o calendário não comprova trabalho. A fórmula própria não identifica uma Disciplina simulada para a compatibilidade da gota: o Narrador registra sua decisão; a gota não tira Vitalidade do doador nem forma Laço na regra citada.

Athanor/Calcinatio deixam a rolagem pendente até concluir o trabalho, sem outro custo. Athanor confirma a concentração exclusiva final; Calcinatio confirma receptáculo/emoção. Fixatio rola somente no consumo e continua proibido de usar equipamento de campo no nível 4. A confirmação é copiada à ativação para preservar a referência após o frasco desaparecer. Resultados de destilação que exigem interpretação continuam pendentes do Narrador antes de aplicar o efeito normal.

O efeito normal concede capacidade pessoal por uma cena; usar/aceitar o voo controla decolagem, flutuação e pouso. Voar sem carga tem velocidade aproximada de corrida; uma massa humana reduz à caminhada. Carga e pessoa sem resistência são registradas sem dados, com confirmação da massa e ausência de resistência. Levar quem resiste usa Força + Alquimia contra Força + Atletismo. Puxar o voador ao chão usa as mesmas paradas, mas o oponente inicia: empate favorece quem iniciou, conforme a disputa geral. As duas paradas têm revisão de normais, Fome preservada e gasto de Vontade próprio, antes de qualquer transporte.

Transporte e voo são persistentes, com condições no usuário/passageiro, limpeza ao pousar/encerrar/cena, proteção contra edição/expiração não autorizada inclusive em rascunho, e autorização de todos os participantes antes do sorteio. Puxar ao chão não encerra a capacidade da cena. Não foram inventados metros por turno, limite numérico de peso/altura, dano de queda ou um agarramento comum automático. Posição, contato, obstáculos, queda, carga e interações com agarramentos exigem decisão do Narrador. Uma carga humana por vez, um uso por ativação/turno e uma ativação de voo simultânea são limites operacionais explícitos desta ferramenta.

Backup preserva preparações ainda em trabalho, confirmação consumida, passageiro, efeitos, marcadores, dados atuais/originais e usos abertos, com IDs remapeados e rollback na falha. Registros anteriores recebem confirmação vazia, sem inventar trabalho passado. Voo legado pendente pode ser restaurado e encerrado; a nova automação exige uma preparação com os requisitos confirmados.

Catálogo: 215 entradas, revisão 9, 106 em revisão pendente. Validação desta versão: 395 testes de regras/API e nove fluxos de navegador, build e formatação; evidências em `docs/VALIDACAO.md`. Métodos adicionais, fórmulas especiais de extração/transformação/Torpor, simulação de outras Disciplinas e cobertura documental integral continuam pendentes.

## Próxima etapa de desenvolvimento

A prioridade é revisar os conteúdos e exceções listados em `COBERTURA_REGRAS.md`, completar cada definição com páginas e validar a automação com testes específicos. O motor, os editores e a persistência atuais permitem continuar sem substituir a arquitetura ou modificar definições oficiais pelo conteúdo personalizado.
