import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

const INDICADORES_LABELS = [
  { key: 'equipamentos', label: 'Equipamentos', icon: '❄️' },
  { key: 'manutencoes', label: 'Manutenções', icon: '🔧' },
  { key: 'fornecedores', label: 'Fornecedores', icon: '🏢' },
  { key: 'predios', label: 'Prédios', icon: '🏛️' },
];

const CORES_SITUACAO = {
  Ativo: 'var(--accent-green, #2f7d54)',
  ativo: 'var(--accent-green, #2f7d54)',
  Baixado: 'var(--accent-red, #af3a28)',
  baixado: 'var(--accent-red, #af3a28)',
  'Para Baixa': 'var(--accent-amber, #b96a1f)',
  'para baixa': 'var(--accent-amber, #b96a1f)',
  'Em manutenção': 'var(--accent-amber, #b96a1f)',
  'em manutenção': 'var(--accent-amber, #b96a1f)',
};

const PALETA = [
  '#2f6f8f',
  '#b96a1f',
  '#2f7d54',
  '#af3a28',
  '#6a5acd',
  '#c2a14d',
  '#4a7c96',
  '#8b5e34',
];

function corPara(nome, indice) {
  return CORES_SITUACAO[nome] || PALETA[indice % PALETA.length];
}

function formatarMoeda(valor) {
  return (Number(valor) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  });
}

// Monta a query string dos filtros
function montarParametros(filtros) {
  const params = new URLSearchParams();

  if (filtros.ano) {
    params.append('ano', filtros.ano);
  }

  if (filtros.formaAquisicao) {
    params.append('formaAquisicao', filtros.formaAquisicao);
  }

  if (filtros.dataInicio) {
    params.append('dataInicio', filtros.dataInicio);
  }

  if (filtros.dataFim) {
    params.append('dataFim', filtros.dataFim);
  }

  if (filtros.categoria) {
    params.append('categoria', filtros.categoria);
  }

  if (filtros.predio) {
    params.append('predio', filtros.predio);
  }

  if (filtros.tipoManutencao) {
    params.append('tipoManutencao', filtros.tipoManutencao);
  }

  return params.toString();
}

// Busca os dados do dashboard com os filtros
async function fetchDashboardSummary(filtros) {
  const queryString = montarParametros(filtros);

  const url = queryString
    ? `/dashboard/summary?${queryString}`
    : '/dashboard/summary';

  const res = await api.get(url);

  return res?.data !== undefined ? res.data : res;
}

export default function Dashboard() {
  const { user } = useAuth();

  // Campos que o usuário está preenchendo
  const [formFiltros, setFormFiltros] = useState({
    ano: '',
    formaAquisicao: '',
    dataInicio: '',
    dataFim: '',
    categoria: '',
    predio: '',
    tipoManutencao: '',
  });

  // Filtros efetivamente aplicados
  const [filtros, setFiltros] = useState({
    ano: '',
    formaAquisicao: '',
    dataInicio: '',
    dataFim: '',
    categoria: '',
    predio: '',
    tipoManutencao: '',
  });

  const {
    data: analytics,
    isLoading: loadingAnalytics,
    isFetching,
    error: queryError,
  } = useQuery({
    queryKey: ['dashboard-summary', filtros],
    queryFn: () => fetchDashboardSummary(filtros),
    staleTime: 1000 * 60 * 5,
  });

  const erroAnalytics =
    queryError?.payload?.message ||
    queryError?.response?.data?.message ||
    queryError?.message ||
    '';

  function alterarFiltro(event) {
    const { name, value } = event.target;

    setFormFiltros((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  }

  function aplicarFiltros(event) {
    event.preventDefault();

    if (
      formFiltros.dataInicio &&
      formFiltros.dataFim &&
      formFiltros.dataInicio > formFiltros.dataFim
    ) {
      alert('A data inicial não pode ser maior que a data final.');
      return;
    }

    setFiltros({ ...formFiltros });
  }

  function limparFiltros() {
    const filtrosVazios = {
      ano: '',
    formaAquisicao: '',
    dataInicio: '',
      dataFim: '',
      categoria: '',
      predio: '',
      tipoManutencao: '',
    };

    setFormFiltros(filtrosVazios);
    setFiltros(filtrosVazios);
  }

  // As listas abaixo dependem de o backend enviá-las.
  // Enquanto isso, o campo continua funcionando com a opção "Todas".
  const anos = analytics?.filtros?.anos ?? [];
  const formasAquisicao =
    analytics?.filtros?.formasAquisicao ?? [];

  const categorias = analytics?.filtros?.categorias ?? [];
  const predios = analytics?.filtros?.predios ?? [];
  const tiposManutencao = analytics?.filtros?.tiposManutencao ?? [];

  return (
    <Layout title='Visão geral'>

      {/* Cabeçalho */}
      <div
        className='panel'
        style={{
          padding: '20px 22px',
          marginBottom: 18,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              marginBottom: 4,
            }}
          >
            Sistema de Gestão de Manutenção
          </div>

          <div style={{ fontSize: 18 }}>
            Bem-vindo(a), <strong>{user?.name}</strong>.
          </div>
        </div>

        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          Visão consolidada dos equipamentos e manutenções
        </div>
      </div>


      {/* FILTROS DO DASHBOARD */}
      <section className="card border-0 shadow-sm mb-3">
        <div className="card-body p-3">

          <div className="mb-3">
            <h2 className="fs-6 fw-semibold mb-1">
              <i className="bi bi-funnel me-2"></i>
              Filtros de manutenção
            </h2>

            <div className="text-muted small">
              Selecione os critérios para consultar os indicadores.
            </div>
          </div>

          <form onSubmit={aplicarFiltros}>
            <div className="row g-2 align-items-end">

              <div className="col-12 col-md-3 col-xl-2">
                <label htmlFor="ano" className="form-label mb-1">
                  Ano
                </label>
                <select
                  id="ano"
                  name="ano"
                  className="form-select form-select-sm"
                  value={formFiltros.ano}
                  onChange={alterarFiltro}
                >
                  <option value="">Todos os anos</option>
                  {anos.map((ano) => {
                    const valor = ano.valor ?? ano.ano ?? ano;
                    return (
                      <option key={valor} value={valor}>
                        {valor}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="col-12 col-md-4 col-xl-3">
                <label
                  htmlFor="formaAquisicao"
                  className="form-label mb-1"
                >
                  Forma de aquisição
                </label>
                <select
                  id="formaAquisicao"
                  name="formaAquisicao"
                  className="form-select form-select-sm"
                  value={formFiltros.formaAquisicao}
                  onChange={alterarFiltro}
                >
                  <option value="">Todas as formas</option>
                  {formasAquisicao.map((forma) => {
                    const valor =
                      forma.valor ?? forma.nome ?? forma;

                    return (
                      <option key={valor} value={valor}>
                        {valor}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="col-12 col-md-3 col-xl-2">
                <label
                  htmlFor="categoria"
                  className="form-label mb-1"
                >
                  Categoria
                </label>
                <select
                  id="categoria"
                  name="categoria"
                  className="form-select form-select-sm"
                  value={formFiltros.categoria}
                  onChange={alterarFiltro}
                >
                  <option value="">Todas</option>
                  {categorias.map((categoria) => (
                    <option
                      key={categoria.id}
                      value={categoria.id}
                    >
                      {categoria.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-3 col-xl-2">
                <label
                  htmlFor="predio"
                  className="form-label mb-1"
                >
                  Prédio
                </label>
                <select
                  id="predio"
                  name="predio"
                  className="form-select form-select-sm"
                  value={formFiltros.predio}
                  onChange={alterarFiltro}
                >
                  <option value="">Todos</option>
                  {predios.map((predio) => (
                    <option key={predio.id} value={predio.id}>
                      {predio.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-3 col-xl-3">
                <label
                  htmlFor="tipoManutencao"
                  className="form-label mb-1"
                >
                  Tipo de manutenção
                </label>
                <select
                  id="tipoManutencao"
                  name="tipoManutencao"
                  className="form-select form-select-sm"
                  value={formFiltros.tipoManutencao}
                  onChange={alterarFiltro}
                >
                  <option value="">Todos</option>
                  {tiposManutencao.map((tipo) => {
                    const valor =
                      tipo.valor ?? tipo.nome ?? tipo;

                    return (
                      <option key={valor} value={valor}>
                        {tipo.nome ?? valor}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="col-12 col-md-3 col-xl-2">
                <label
                  htmlFor="dataInicio"
                  className="form-label mb-1"
                >
                  Data inicial
                </label>
                <input
                  id="dataInicio"
                  name="dataInicio"
                  type="date"
                  className="form-control form-control-sm"
                  value={formFiltros.dataInicio}
                  onChange={alterarFiltro}
                />
              </div>

              <div className="col-12 col-md-3 col-xl-2">
                <label
                  htmlFor="dataFim"
                  className="form-label mb-1"
                >
                  Data final
                </label>
                <input
                  id="dataFim"
                  name="dataFim"
                  type="date"
                  className="form-control form-control-sm"
                  value={formFiltros.dataFim}
                  onChange={alterarFiltro}
                />
              </div>

              <div className="col-12 col-md-6 col-xl-4">
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm flex-fill"
                    onClick={limparFiltros}
                    disabled={isFetching}
                  >
                    <i className="bi bi-x-circle me-1"></i>
                    Limpar
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary btn-sm flex-fill"
                    disabled={isFetching}
                  >
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    {isFetching ? 'Consultando...' : 'Atualizar'}
                  </button>
                </div>
              </div>

            </div>
          </form>
        </div>
      </section>



      {/* INDICADORES */}
      <div className='stat-grid' style={{ marginBottom: 20 }}>
        {INDICADORES_LABELS.map((ind) => (
          <div className='stat-card' key={ind.key}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <div className='stat-card-label'>{ind.label}</div>

              <span
                aria-hidden='true'
                style={{ fontSize: 20 }}
              >
                {ind.icon}
              </span>
            </div>

            <div className='stat-card-value'>
              {loadingAnalytics
                ? '…'
                : (analytics?.contadores?.[ind.key] ?? '—')}
            </div>
          </div>
        ))}

        {/* Manutenções em aberto */}
        <div className='stat-card'>
          <div className='stat-card-label'>Em aberto</div>

          <div
            className='stat-card-value'
            style={{
              color:
                analytics?.totalEmAberto > 0
                  ? 'var(--accent-amber, #b96a1f)'
                  : undefined,
            }}
          >
            {loadingAnalytics
              ? '…'
              : (analytics?.totalEmAberto ?? '—')}
          </div>
        </div>

        {/* Gasto */}
        <div className='stat-card'>
          <div className='stat-card-label'>
            Gasto em manutenções
          </div>

          <div
            className='stat-card-value'
            style={{ fontSize: 22 }}
          >
            {loadingAnalytics
              ? '…'
              : analytics
                ? formatarMoeda(analytics.gastoTotal)
                : '—'}
          </div>
        </div>
      </div>

      {/* Aviso de atualização */}
      {isFetching && !loadingAnalytics && (
        <div
          className='panel'
          style={{
            padding: '10px 18px',
            marginBottom: 20,
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          Atualizando indicadores conforme os filtros selecionados...
        </div>
      )}

      {/* Loading inicial */}
      {loadingAnalytics && (
        <div
          className='panel'
          style={{
            padding: '16px 18px',
            marginBottom: 20,
            color: 'var(--text-muted)',
          }}
        >
          Calculando indicadores...
        </div>
      )}

      {/* Erro */}
      {erroAnalytics && (
        <div
          className='panel form-error'
          style={{
            padding: '16px 18px',
            marginBottom: 20,
          }}
        >
          {erroAnalytics}
        </div>
      )}

      {analytics && (
        <>
          {/* GRÁFICOS - LINHA 1 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
              gap: 16,
              marginBottom: 20,
            }}
          >
            {/* Gastos por prédio */}
            <div className='panel'>
              <div className='panel-header'>
                <div>
                  <h2>Gastos por prédio</h2>

                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                    }}
                  >
                    Dez prédios com maior custo de manutenção
                  </div>
                </div>
              </div>

              <div
                className='panel-body'
                style={{ height: 330 }}
              >
                {!analytics.gastosPorPredio?.length ? (
                  <div className='empty-state'>
                    Sem dados de custos por prédio.
                  </div>
                ) : (
                  <ResponsiveContainer width='100%' height='100%'>
                    <BarChart
                      data={analytics.gastosPorPredio}
                      layout='vertical'
                      margin={{
                        top: 10,
                        right: 30,
                        left: 10,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray='3 3'
                        stroke='var(--border)'
                        horizontal={false}
                      />

                      <XAxis
                        type='number'
                        tickFormatter={(v) =>
                          `R$ ${(v / 1000).toFixed(0)}k`
                        }
                        fontSize={11}
                      />

                      <YAxis
                        type='category'
                        dataKey='nome'
                        width={180}
                        fontSize={11}
                        tickFormatter={(v) =>
                          v && v.length > 25
                            ? `${v.slice(0, 25)}…`
                            : v || '—'
                        }
                      />

                      <Tooltip
                        formatter={(v) => [
                          formatarMoeda(v),
                          'Gasto',
                        ]}
                      />

                      <Bar
                        dataKey='valor'
                        fill='var(--primary, #2f6f8f)'
                        radius={[0, 5, 5, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Gastos por categoria */}
            <div className='panel'>
              <div className='panel-header'>
                <div>
                  <h2>Gastos por categoria</h2>

                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                    }}
                  >
                    Distribuição dos custos
                  </div>
                </div>
              </div>

              <div
                className='panel-body'
                style={{ height: 330 }}
              >
                {!analytics.gastosPorCategoria?.length ? (
                  <div className='empty-state'>
                    Sem dados de categorias.
                  </div>
                ) : (
                  <ResponsiveContainer width='100%' height='100%'>
                    <PieChart>
                      <Pie
                        data={analytics.gastosPorCategoria}
                        dataKey='valor'
                        nameKey='nome'
                        cx='50%'
                        cy='45%'
                        outerRadius={90}
                        innerRadius={48}
                        paddingAngle={2}
                      >
                        {analytics.gastosPorCategoria.map(
                          (entrada, i) => (
                            <Cell
                              key={entrada.nome || i}
                              fill={corPara(entrada.nome, i)}
                            />
                          )
                        )}
                      </Pie>

                      <Tooltip
                        formatter={(v) => [
                          formatarMoeda(v),
                          'Total',
                        ]}
                      />

                      <Legend
                        layout='horizontal'
                        verticalAlign='bottom'
                        align='center'
                        wrapperStyle={{
                          fontSize: '11px',
                          paddingTop: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* GRÁFICOS - LINHA 2 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: 16,
              marginBottom: 20,
            }}
          >
            {/* Equipamentos por situação */}
            <div className='panel'>
              <div className='panel-header'>
                <h2>Equipamentos por situação</h2>
              </div>

              <div
                className='panel-body'
                style={{ height: 300 }}
              >
                {!analytics.equipamentosPorSituacao?.length ? (
                  <div className='empty-state'>
                    Nenhum equipamento cadastrado.
                  </div>
                ) : (
                  <ResponsiveContainer width='100%' height='100%'>
                    <PieChart>
                      <Pie
                        data={analytics.equipamentosPorSituacao}
                        dataKey='valor'
                        nameKey='nome'
                        cx='50%'
                        cy='43%'
                        outerRadius={82}
                        label={({ name, percent }) =>
                          `${name} (${(percent * 100).toFixed(0)}%)`
                        }
                        labelLine
                        fontSize={11}
                      >
                        {analytics.equipamentosPorSituacao.map(
                          (entrada, i) => (
                            <Cell
                              key={entrada.nome || i}
                              fill={corPara(entrada.nome, i)}
                            />
                          )
                        )}
                      </Pie>

                      <Tooltip
                        formatter={(v) => [
                          v,
                          'Quantidade',
                        ]}
                      />

                      <Legend
                        verticalAlign='bottom'
                        align='center'
                        wrapperStyle={{ fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Manutenções por tipo */}
            <div className='panel'>
              <div className='panel-header'>
                <h2>Manutenções por tipo</h2>
              </div>

              <div
                className='panel-body'
                style={{ height: 300 }}
              >
                {!analytics.manutencoesPorTipo?.length ? (
                  <div className='empty-state'>
                    Nenhuma manutenção realizada.
                  </div>
                ) : (
                  <ResponsiveContainer width='100%' height='100%'>
                    <BarChart
                      data={analytics.manutencoesPorTipo}
                      margin={{
                        top: 20,
                        right: 20,
                        left: 0,
                        bottom: 20,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray='3 3'
                        stroke='var(--border)'
                      />

                      <XAxis
                        dataKey='nome'
                        fontSize={11}
                        interval={0}
                        tickFormatter={(v) =>
                          v.length > 15
                            ? `${v.slice(0, 15)}…`
                            : v
                        }
                      />

                      <YAxis
                        fontSize={11}
                        allowDecimals={false}
                      />

                      <Tooltip
                        formatter={(v) => [
                          v,
                          'Ocorrências',
                        ]}
                      />

                      <Bar
                        dataKey='valor'
                        fill='var(--accent-amber, #b96a1f)'
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>


          {/* GRÁFICOS - LINHA 3: FORMAS DE AQUISIÇÃO */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
              gap: 16,
              marginBottom: 20,
            }}
          >
            {/* Gráfico A - Gastos por forma de aquisição */}
            <div className='panel'>
              <div className='panel-header'>
                <div>
                  <h2>Gastos por forma de aquisição</h2>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                    }}
                  >
                    Comparação dos valores por modalidade
                  </div>
                </div>
              </div>

              <div
                className='panel-body'
                style={{ height: 330 }}
              >
                {!analytics.gastosPorFormaAquisicao?.length ? (
                  <div className='empty-state'>
                    Sem dados de gastos por forma de aquisição.
                  </div>
                ) : (
                  <ResponsiveContainer width='100%' height='100%'>
                    <BarChart
                      data={analytics.gastosPorFormaAquisicao}
                      layout='vertical'
                      margin={{
                        top: 10,
                        right: 25,
                        left: 15,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray='3 3'
                        stroke='var(--border)'
                        horizontal={false}
                      />

                      <XAxis
                        type='number'
                        fontSize={11}
                        tickFormatter={(valor) =>
                          `R$ ${(valor / 1000).toFixed(0)} mil`
                        }
                      />

                      <YAxis
                        type='category'
                        dataKey='nome'
                        width={110}
                        fontSize={11}
                      />

                      <Tooltip
                        formatter={(valor) => [
                          formatarMoeda(valor),
                          'Gasto',
                        ]}
                      />

                      <Bar
                        dataKey='valor'
                        fill='#2f6f8f'
                        radius={[0, 5, 5, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Gráfico B - Participação percentual */}
            <div className='panel'>
              <div className='panel-header'>
                <div>
                  <h2>Participação nos gastos</h2>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                    }}
                  >
                    Distribuição percentual por forma de aquisição
                  </div>
                </div>
              </div>

              <div
                className='panel-body'
                style={{ height: 330 }}
              >
                {!analytics.gastosPorFormaAquisicao?.length ? (
                  <div className='empty-state'>
                    Sem dados para apresentar.
                  </div>
                ) : (
                  <ResponsiveContainer width='100%' height='100%'>
                    <PieChart>
                      <Pie
                        data={analytics.gastosPorFormaAquisicao}
                        dataKey='valor'
                        nameKey='nome'
                        cx='50%'
                        cy='43%'
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={2}
                      >
                        {analytics.gastosPorFormaAquisicao.map(
                          (entrada, indice) => (
                            <Cell
                              key={entrada.nome}
                              fill={corPara(entrada.nome, indice)}
                            />
                          )
                        )}
                      </Pie>

                      <Tooltip
                        formatter={(valor) => [
                          formatarMoeda(valor),
                          'Gasto',
                        ]}
                      />

                      <Legend
                        verticalAlign='bottom'
                        align='center'
                        wrapperStyle={{
                          fontSize: '11px',
                          paddingTop: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* EQUIPAMENTOS RECORRENTES */}
          <div
            className='panel'
            style={{ marginBottom: 20 }}
          >
            <div className='panel-header'>
              <div>
                <h2>
                  Equipamentos com mais manutenções
                </h2>

                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                  }}
                >
                  Equipamentos que merecem atenção para manutenção preventiva
                </div>
              </div>
            </div>

            {!analytics.topRecorrentes?.length ? (
              <div className='empty-state'>
                Nenhum equipamento com histórico de manutenção ainda.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Patrimônio</th>
                      <th>Categoria</th>
                      <th>Prédio</th>
                      <th>Situação</th>
                      <th>Nº de intervenções</th>
                      <th>Custo acumulado</th>
                    </tr>
                  </thead>

                  <tbody>
                    {analytics.topRecorrentes.map((eq) => (
                      <tr key={eq.equipamentoId}>
                        <td className='mono'>
                          {eq.patrimonio}
                        </td>

                        <td>{eq.categoria}</td>

                        <td>{eq.predio}</td>

                        <td>
                          <span
                            className={`badge ${
                              eq.situacao?.toLowerCase() ===
                              'baixado'
                                ? 'badge-red'
                                : eq.situacao?.toLowerCase() ===
                                    'ativo'
                                  ? 'badge-green'
                                  : 'badge-amber'
                            }`}
                          >
                            {eq.situacao}
                          </span>
                        </td>

                        <td className='mono'>
                          <strong>{eq.ocorrencias}</strong>
                        </td>

                        <td className='mono'>
                          {eq.custoAcumulado !== undefined
                            ? formatarMoeda(eq.custoAcumulado)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* MANUTENÇÕES EM ABERTO */}
          <div className='panel'>
            <div className='panel-header'>
              <div>
                <h2>
                  Manutenções em aberto
                  {' '}
                  ({analytics.totalEmAberto ?? 0})
                </h2>

                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                  }}
                >
                  Serviços pendentes de conclusão
                </div>
              </div>
            </div>

            {!analytics.manutencoesEmAberto?.length ? (
              <div className='empty-state'>
                Nenhuma manutenção pendente — tudo finalizado.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Nota fiscal</th>
                      <th>Solicitação</th>
                      <th>Tipo</th>
                    </tr>
                  </thead>

                  <tbody>
                    {analytics.manutencoesEmAberto.map((m) => (
                      <tr key={m.id}>
                        <td className='mono'>
                          {m.data
                            ? new Date(m.data).toLocaleDateString(
                                'pt-BR'
                              )
                            : '—'}
                        </td>

                        <td className='mono'>
                          {m.nota_fiscal || '—'}
                        </td>

                        <td className='mono'>
                          #{m.solicitacao || '—'}
                        </td>

                        <td>
                          {m.tipo_manutencao || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {analytics.totalEmAberto >
              (analytics.manutencoesEmAberto?.length ?? 0) && (
              <div
                style={{
                  padding: '10px 18px',
                  fontSize: 12.5,
                  color: 'var(--text-muted)',
                }}
              >
                Mostrando as{' '}
                {analytics.manutencoesEmAberto.length} mais antigas
                de {analytics.totalEmAberto} pendentes. Veja a lista
                completa na aba Manutenções.
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
