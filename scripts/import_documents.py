"""Importa PDFs privados por página. Não copia livros para o código-fonte."""
import os,sqlite3,json,subprocess,re,hashlib
from pathlib import Path
root=Path(os.getenv('V5_REFERENCE_DIR','/workspace/reference-text'))
dbpath=Path(os.getenv('V5_DB_PATH',str(Path(__file__).resolve().parents[1]/'.data/cronica.sqlite')))
dbpath.parent.mkdir(parents=True,exist_ok=True)
con=sqlite3.connect(dbpath)
con.executescript('''CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,name TEXT,path TEXT,pages INTEGER,hash TEXT,classification TEXT); CREATE VIRTUAL TABLE IF NOT EXISTS pages USING fts5(document UNINDEXED,page UNINDEXED,text,tokenize='unicode61 remove_diacritics 2');''')
manifest=root/'manifest.json'
if not manifest.exists():
 print('Nenhum documento local disponível. Defina V5_REFERENCE_DIR para a pasta do manifest.json.');raise SystemExit(0)
for doc in json.loads(manifest.read_text()):
 p=Path(doc['texto']);text=p.read_text();digest=hashlib.sha256(text.encode()).hexdigest()
 old=con.execute('SELECT hash FROM documents WHERE id=?',(doc['id'],)).fetchone()
 if old and old[0]==digest: continue
 classification='compilacao-mista' if doc['id'].startswith('westhaven') else 'referencia-v5'
 con.execute('INSERT OR REPLACE INTO documents VALUES(?,?,?,?,?,?)',(doc['id'],doc['arquivo'],doc['pdf'],doc['paginas'],digest,classification))
 con.execute('DELETE FROM pages WHERE document=?',(doc['id'],))
 pages=text.split('\f')[:doc['paginas']]
 con.executemany('INSERT INTO pages(document,page,text) VALUES(?,?,?)',[(doc['id'],n+1,t)for n,t in enumerate(pages)])
 print(f"{doc['id']}: {len(pages)} páginas indexadas")
con.commit()
