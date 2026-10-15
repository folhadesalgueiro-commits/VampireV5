# Crônica — Vampiro: A Máscara V5

Aplicação local em português brasileiro para fichas, campanhas, Coteries, rolagens e conteúdo personalizado. Interface React/TypeScript e API Node com SQLite persistente. Esta versão implementa os módulos descritos em `PROGRESSO.md`; não representa cobertura integral de todos os subsistemas dos livros.

## Instalação

Requisitos: **Node.js 24**, npm e Python 3. SQLite já vem com o Node utilizado. Para extrair PDFs próprios, instale Poppler (`pdftotext`, `pdfinfo`).

No diretório do projeto:

```bash
npm ci
npm run import:documents
npm run build
npm test
npm start
```

`npm start` serve a interface compilada e a API na porta **3001**, vinculada à máquina local. Abra essa porta em seu navegador local. No primeiro acesso, cadastre o Narrador; depois crie campanhas e contas de jogadores. Não há senha padrão nem dados de campanha fictícios pré-carregados.

Para desenvolver com atualização automática:

```bash
npm run dev
```

A interface de desenvolvimento usa a porta **5173**, com proxy da API na **3001**. Use o checkout existente; cada tarefa na nuvem já é isolada e não precisa de um worktree adicional.

## Dados e configuração

| Variável           | Uso                                                  | Padrão                      |
| ------------------ | ---------------------------------------------------- | --------------------------- |
| `V5_DB_PATH`       | Caminho do SQLite                                    | `.data/cronica.sqlite`      |
| `V5_REFERENCE_DIR` | Pasta contendo `manifest.json` e textos extraídos    | `/workspace/reference-text` |
| `PORT`             | Porta da aplicação compilada                         | `3001`                      |
| `V5_HOST`          | Interface de escuta da API                           | `127.0.0.1`                 |
| `V5_SECURE_COOKIE` | Use `1` quando a aplicação estiver servida via HTTPS | desativado para uso local   |
| `V5_BROWSER`       | Executável Chromium para testes de navegador         | `/usr/bin/chromium`         |

As dependências só precisam de rede para instalação. A aplicação não exige serviços externos ou chaves de API. Não inclua senhas nos arquivos de configuração. Para usar em uma rede, configure HTTPS no seu servidor e mantenha os controles de acesso; o fluxo padrão é local.

## Importar seus PDFs

Nesta máquina os sete PDFs já estão extraídos e indexados. Em outra instalação, prepare uma pasta privada fora do repositório. Para cada PDF execute `pdftotext -layout arquivo.pdf texto.txt` e crie um `manifest.json` nessa pasta:

```json
[
  {
    "id": "basico",
    "arquivo": "Meu livro básico.pdf",
    "pdf": "/caminho/privado/livro.pdf",
    "texto": "/caminho/privado/basico.txt",
    "paginas": 416
  }
]
```

Use IDs `basico`, `companion`, `ficha`, `westhaven-75`, `westhaven-150`, `westhaven-200`, `westhaven-250` para conservar as referências existentes. Confira o número real de páginas com `pdfinfo`. Execute `npm run import:documents` com `V5_REFERENCE_DIR` e, se necessário, `V5_DB_PATH` definidos. A importação calcula SHA-256, evita repetir arquivos idênticos e substitui somente o índice do documento alterado. Não distribua os PDFs ou o banco com o conteúdo dos livros publicamente.

## Verificações

```bash
npm test
npm run build
npm run test:e2e
```

O teste de navegador usa Chromium instalado e um banco temporário próprio. O teste abre a aplicação real, cadastra conta, cria Disciplina/Clã/Poder, usa a ficha, rola, recarrega e exporta backup. Também exercita avanço de noite, Despertar, cura agravada, Laços, ficha mortal, equipamentos, confrontos persistentes e criação de Sangue-Ralo por jogador sem exceção. O quinto fluxo também prepara, armazena, transporta, consome e resolve Alquimia, aplica Névoa em uma rolagem e encerra o efeito na cena seguinte. O sexto fluxo seleciona dados normais de destilação, gasta Vontade, recarrega a revisão aberta e aceita o resultado sem repetir Fome/consumo. O sétimo usa Longo Alcance, revisa as paradas do usuário e da resistência, resolve dano conforme os dados reais e verifica persistência, término por turno e tela móvel. O oitavo ativa Envolver em alvo único, confere a penalidade visual, revisa a disputa de asfixia, aplica seu resultado e encerra a névoa sem presumir recuperação de consciência. O nono inicia e conclui a preparação de Impulso, revisa a disputa de transporte, usa voo pessoal/pouso e verifica a limpeza dos efeitos. Não modifica seu banco principal.

## Documentação

- [Manual de utilização](docs/MANUAL_USO.md)
- [Cobertura de regras](COBERTURA_REGRAS.md)
- [Progresso e pendências](PROGRESSO.md)
- [Arquitetura](docs/ARQUITETURA.md)
- [Fontes e paginação](docs/FONTES.md)

## Cópias de segurança

Em Configurações, exporte um backup JSON e restaure como cópias quando necessário. Para uma cópia integral com documentos e contas, pare o servidor e copie o diretório `.data` inteiro, além dos PDFs privados. Não copie apenas o arquivo principal do SQLite enquanto o servidor estiver escrevendo: os arquivos WAL e SHM podem conter alterações ainda não consolidadas.
