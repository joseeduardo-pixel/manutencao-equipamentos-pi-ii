import * as dashboardService from '../services/dashboardService.js';
import { resfc } from '../utils/resfc.js';

export const getDashboardSummary = async (request, reply) => {
  const {
    ano,
    formaAquisicao,
    dataInicio,
    dataFim,
    categoria,
    predio,
    tipoManutencao,
  } = request.query ?? {};

  const summaryData = await dashboardService.getDashboardSummary({
    ano,
    formaAquisicao,
    dataInicio,
    dataFim,
    categoria,
    predio,
    tipoManutencao,
  });

  return resfc({
    reply,
    code: 200,
    data: summaryData,
    message: 'Resumo do dashboard recuperado com sucesso.',
  });
};