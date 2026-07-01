#!/usr/bin/env python3
"""
Transcreve cada faixa de áudio por palestrante (gerada pelo bot Craig no Discord)
usando OpenAI Whisper e funde tudo em um único transcript com timestamp e nome do palestrante.

Uso:
    python3 merge_transcript.py /caminho/para/pasta/com/faixas --language pt --model medium

A pasta deve conter um arquivo de áudio por palestrante (ex: joao.flac, maria.flac),
como o Craig exporta. O nome do arquivo (sem extensão) é usado como nome do palestrante.
"""

import argparse
import sys
from pathlib import Path

import whisper

AUDIO_EXTENSIONS = {".flac", ".wav", ".mp3", ".m4a", ".ogg", ".opus"}


def format_timestamp(seconds: float) -> str:
    minutes, secs = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path, help="Pasta com as faixas de áudio por palestrante")
    parser.add_argument("--language", default="pt", help="Código do idioma (padrão: pt)")
    parser.add_argument(
        "--model",
        default="medium",
        choices=["tiny", "base", "small", "medium", "large"],
        help="Modelo Whisper a usar (padrão: medium)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Arquivo de saída (padrão: transcript_merged.txt dentro da pasta de entrada)",
    )
    args = parser.parse_args()

    audio_files = sorted(
        p for p in args.folder.iterdir() if p.suffix.lower() in AUDIO_EXTENSIONS
    )
    if not audio_files:
        sys.exit(f"Nenhum arquivo de áudio encontrado em {args.folder}")

    output_path = args.output or args.folder / "transcript_merged.txt"

    print(f"Carregando modelo Whisper '{args.model}'...")
    model = whisper.load_model(args.model)

    all_segments = []
    for audio_path in audio_files:
        speaker = audio_path.stem
        print(f"Transcrevendo {audio_path.name} (palestrante: {speaker})...")
        result = model.transcribe(str(audio_path), language=args.language)
        for seg in result["segments"]:
            text = seg["text"].strip()
            if text:
                all_segments.append((seg["start"], speaker, text))

    all_segments.sort(key=lambda item: item[0])

    with output_path.open("w", encoding="utf-8") as out:
        for start, speaker, text in all_segments:
            out.write(f"[{format_timestamp(start)}] {speaker}: {text}\n")

    print(f"\nTranscript salvo em: {output_path}")


if __name__ == "__main__":
    main()
