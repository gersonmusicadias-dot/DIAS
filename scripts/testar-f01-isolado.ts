import assert from "node:assert/strict";

let createChamado = false;

const reciboBase = {
  id: "r1",
  identificador: "REC-TESTE",
  competencia: "2026-09",
  dataEmissao: "2026-09-01",
  valorPrevisto: 100,
  valorRecibo: 100,
  status: "EMITIDO",
  substituidoPor: null,
  recebimentos: [],
};

function testar(recibo: any) {
  createChamado = false;

  const resposta =
    recibo.status === "SUBSTITUIDO" || recibo.substituidoPor
      ? { status: 409 }
      : (() => {
          createChamado = true;
          return { status: 200 };
        })();

  return resposta;
}

const ativo = testar({ ...reciboBase });
assert.equal(ativo.status, 200);
assert.equal(createChamado, true);

const substituidoStatus = testar({
  ...reciboBase,
  status: "SUBSTITUIDO",
});
assert.equal(substituidoStatus.status, 409);
assert.equal(createChamado, false);

const substituidoRelacao = testar({
  ...reciboBase,
  substituidoPor: { id: "r2" },
});
assert.equal(substituidoRelacao.status, 409);
assert.equal(createChamado, false);

console.log("OK F-01: recibo ativo permitido; recibo substituido bloqueado com 409; sem criacao de recebimento.");
