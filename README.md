# zhsub

Extensão temporária para Firefox que muda a cor das legendas da Netflix para azul e
consulta palavras chinesas em uma API local.

## Testar no Firefox

1. Abra `about:debugging#/runtime/this-firefox`.
2. Clique em **Carregar extensão temporária**.
3. Selecione o arquivo `manifest.json` desta pasta.
4. Abra ou recarregue uma página da Netflix e inicie um conteúdo com legendas.

A extensão permanece instalada até o Firefox ser fechado. Para distribuir ou manter a
extensão instalada, ela precisa ser empacotada e assinada pela Mozilla.

## Ajustar a cor

Altere o valor `#008cff` em `netflix-subtitles.css`.

## Backend de dicionário local

O backend usa FastAPI e SQLite. Baixe o arquivo de dados do
[CC-CEDICT](https://cc-cedict.org/editor/editor.php?handler=Download), mantendo a
atribuição e as condições da licença CC BY-SA 4.0, e importe-o:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python import_cedict.py C:\caminho\para\cedict.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```

Com o servidor em execução, clique em uma legenda na Netflix. O `zhsub` envia apenas
o texto da legenda a `127.0.0.1:8000`, recebe a segmentação e mostra botões para as
palavras encontradas. Clique em uma palavra no painel para ver pinyin e definições.

O dicionário oferece definições em inglês. A tradução para português pode ser adicionada
mais tarde com uma fonte de dados própria ou um serviço de tradução.
