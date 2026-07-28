// Stub de `server-only` para o Vitest.
//
// O pacote `server-only` é resolvido pelo bundler do Next (é um guard de build:
// importá-lo de um Client Component quebra o build). Ele não existe em
// node_modules, então o Vite não consegue resolver o especificador e qualquer
// teste que importe um módulo server-only falha na transformação. O alias em
// `vitest.config.ts` aponta para este arquivo vazio.
export {};
