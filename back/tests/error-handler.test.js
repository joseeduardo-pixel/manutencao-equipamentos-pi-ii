
import test from 'node:test';
import assert from 'node:assert/strict';

import { errorHandler } from '../src/middlewares/errorHandler.js';

const NODE_ENV_ORIGINAL = process.env.NODE_ENV;

test.before(() => {
  process.env.NODE_ENV = 'production';
});

test.after(() => {
  if (NODE_ENV_ORIGINAL === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = NODE_ENV_ORIGINAL;
  }
});



const criarResposta = () => ({
  statusCode: null,
  body: null,

  status(codigo) {
    this.statusCode = codigo;
    return this;
  },

  send(conteudo) {
    this.body = conteudo;
    return this;
  },
});

const criarRequisicao = () => ({
  url: '/api/v1/equipamentos/1',
  method: 'DELETE',
  log: {
    warn() {},
    error() {},
  },
});

const executarTratamento = (erro) => {
  const request = criarRequisicao();
  const reply = criarResposta();

  errorHandler(erro, request, reply);

  return reply;
};

test('PostgreSQL 23001 retorna HTTP 400', () => {
  const erro = new Error(
    'PostgresError { code: "23001", message: "update or delete violates foreign key constraint" }',
  );

  erro.name = 'PrismaClientUnknownRequestError';

  const resposta = executarTratamento(erro);

  assert.equal(resposta.statusCode, 400);
  assert.equal(resposta.body.status, 'fail');
  assert.match(resposta.body.message, /dados vinculados/i);
});

test('PostgreSQL 23503 retorna HTTP 400', () => {
  const erro = new Error(
    'PostgresError { code: "23503", message: "foreign key constraint" }',
  );

  erro.name = 'PrismaClientUnknownRequestError';

  const resposta = executarTratamento(erro);

  assert.equal(resposta.statusCode, 400);
  assert.match(resposta.body.message, /dados vinculados/i);
});

test('Erro interno desconhecido continua retornando HTTP 500', () => {
  const erro = new Error('Falha interna inesperada');

  const resposta = executarTratamento(erro);

  assert.equal(resposta.statusCode, 500);
  assert.equal(resposta.body.status, 'error');
  assert.equal(
    resposta.body.message,
    'Ocorreu um erro interno no servidor.',
  );
});

test('Erro com codigo PostgreSQL sem restricao nao vira HTTP 400', () => {
  const erro = new Error(
    'PostgresError { code: "42P01", message: "relation does not exist" }',
  );

  erro.name = 'PrismaClientUnknownRequestError';

  const resposta = executarTratamento(erro);

  assert.equal(resposta.statusCode, 500);
});
