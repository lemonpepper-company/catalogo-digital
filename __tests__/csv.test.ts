import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("separa linhas e colunas simples por vírgula", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("respeita campos entre aspas contendo vírgula", () => {
    expect(parseCsv('nome,desc\n"Vestido, midi",bonito')).toEqual([
      ["nome", "desc"],
      ["Vestido, midi", "bonito"],
    ]);
  });

  it("resolve aspas duplas escapadas dentro de um campo entre aspas", () => {
    expect(parseCsv('a\n"ela disse ""oi"""')).toEqual([["a"], ['ela disse "oi"']]);
  });

  it("lida com quebras de linha CRLF e remove um BOM inicial", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("ignora linhas totalmente vazias no fim do arquivo", () => {
    expect(parseCsv("a,b\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("preserva uma linha totalmente vazia no meio do arquivo (não é a última)", () => {
    expect(parseCsv("a,b\n1,2\n\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      [""],
      ["3", "4"],
    ]);
  });
});
