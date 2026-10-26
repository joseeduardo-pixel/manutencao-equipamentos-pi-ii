import { protect } from '../middlewares/auth.js';
import * as relatorioController from '../controllers/relatorioController.js';

export default async function relatorioRoutes(fastify) {
  fastify.addHook('preHandler', protect);

  fastify.get('/equipamentos', relatorioController.equipamentos);
  fastify.get('/manutencoes', relatorioController.manutencoes);
  fastify.get('/servicos', relatorioController.servicos);
  fastify.get('/fornecedores', relatorioController.fornecedores);
}
