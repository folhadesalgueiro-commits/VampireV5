"""Registra proveniência e índice de todas as páginas sem distribuir seu texto."""
from pathlib import Path
import json,csv,hashlib,re,os
root=Path(os.getenv('V5_REFERENCE_DIR','/workspace/reference-text'))
project=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'manifest.json').read_text())
rows=[];summaries=[]
for doc in manifest:
 text=Path(doc['texto']).read_text();pages=text.split('\f')[:doc['paginas']]
 offset={'westhaven-75':0,'westhaven-150':75,'westhaven-200':150,'westhaven-250':200}.get(doc['id'],0)
 summaries.append({'id':doc['id'],'arquivo':doc['arquivo'],'paginas':doc['paginas'],'sha256_texto':hashlib.sha256(text.encode()).hexdigest(),'paginas_sem_texto':doc['paginas_sem_texto'],'origem':'Compilação mista'if doc['id'].startswith('westhaven')else'Referência V5'})
 for number,page in enumerate(pages,1):
  # An index for locating passages, not a substitute for reviewing the original.
  titles=[line.strip() for line in page.splitlines() if line.strip().isupper() and 4<len(line.strip())<80 and not re.match(r'^\W+$',line.strip())]
  rows.append([doc['id'],number,number+offset,len(page.strip()),hashlib.sha256(page.encode()).hexdigest(),' | '.join(dict.fromkeys(titles[:8]))])
with (project/'docs/INDICE_DOCUMENTAL.csv').open('w')as f:
 writer=csv.writer(f);writer.writerow(['documento','pagina_pdf','pagina_westhaven','caracteres','sha256_pagina','titulos_extraidos']);writer.writerows(rows)
(project/'docs/fontes.json').write_text(json.dumps(summaries,ensure_ascii=False,indent=2))
md='# Fontes documentais\n\nTodos os sete PDFs foram extraídos e indexados por página. Isso não significa que todas as regras ou cada Poder tenham sido revisados e automatizados. A revisão das seções implementadas está registrada em `COBERTURA_REGRAS.md`; a leitura analítica integral dos 736 registros de página permanece pendente.\n\n| ID | Arquivo | Páginas do PDF | Classificação |\n| --- | --- | --- | --- |\n'
for s in summaries:md+=f"| `{s['id']}` | {s['arquivo']} | {s['paginas']} | {s['origem']} |\n"
md+='\n`fontes.json` contém SHA-256 da transcrição, nomes e contagem. `INDICE_DOCUMENTAL.csv` identifica todas as páginas, seu hash e títulos extraídos. Os textos e PDFs integrais ficam fora do repositório e no banco local de uso autenticado.\n\n## Paginação\n\nAs referências da aplicação usam a página do PDF. O básico fornecido tem 416 páginas de uma transcrição de fã; remissões como “pág. 205” em seu texto podem corresponder à edição original, não à posição 205 deste arquivo. A ficha e o Companion usam a terminologia portuguesa publicada. `Perseverança` no básico é mapeada para `Determinação` na ficha; `Esportes` para `Atletismo`, `Lábia` para `Subterfúgio`, `Acadêmicos` para `Erudição`. Westhaven está dividido em quatro partes: a página PDF 1 representa a página global 1, 76, 151 e 201, respectivamente.\n\n## Limites das fontes\n\nWesthaven declara na página PDF 2 que contém acréscimos de V20, adaptações e material homebrew. Nenhuma adaptação foi incorporada como regra oficial automaticamente. Glifos de sucesso, dano e custos podem desaparecer na extração; consulte o PDF original na biblioteca. A versão 4.2 foi fornecida somente até a página global 250; seções posteriores citadas no sumário não estão disponíveis.\n\nAs entradas de consulta do catálogo usam referências do básico. Nível derivado de cabeçalhos e nome extraído não equivalem a revisão completa dos pré-requisitos. O bloco de Animalismo após Sussurros Selvagens, por exemplo, não apresenta cabeçalho claro de nível 3 na transcrição fornecida. Esses Poderes permanecem com revisão pendente e exigem confirmação do Narrador ou uma variante corrigida, sem substituir o registro oficial.\n'
(project/'docs/FONTES.md').write_text(md)
print(len(rows),'registros de página inventariados')
