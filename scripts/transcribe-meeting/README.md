# Transcrição de reuniões (Craig + Whisper)

Transforma as faixas de áudio por palestrante exportadas pelo bot **Craig** (Discord)
em um único transcript com timestamp e nome do palestrante, usando **OpenAI Whisper**.

## Setup (uma vez)

```bash
brew install ffmpeg          # já instalado neste ambiente
python3 -m venv .venv
source .venv/bin/activate
pip install openai-whisper
```

## Uso

1. Grave a reunião com o Craig no Discord e baixe as faixas separadas por palestrante
   (ex: `joao.flac`, `maria.flac`) em uma pasta.
2. Rode:

```bash
python3 scripts/transcribe-meeting/merge_transcript.py /caminho/para/pasta --language pt --model medium
```

3. O arquivo `transcript_merged.txt` será gerado dentro da mesma pasta, pronto para
   compartilhar com o Claude.

## Opções

- `--model`: `tiny`, `base`, `small`, `medium` (padrão), `large` — modelos maiores são
  mais precisos e mais lentos.
- `--language`: código do idioma (padrão `pt`).
- `--output`: caminho customizado para o arquivo final.
