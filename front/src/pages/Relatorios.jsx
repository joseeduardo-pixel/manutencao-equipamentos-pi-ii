import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import Layout from '../components/Layout';

const FILTROS_INICIAIS = {
  fornecedor_id: '',
  categoria_id: '',
  marca_id: '',
  predio_id: '',
  data_inicio: '',
  data_fim: '',
  forma_aquisicao: '',
  tipo_manutencao: '',
  finalizado: '',
  situacao: '',
};

const TIPOS_RELATORIO = [
  {
    value: 'equipamentos',
    label: 'Relação de equipamentos por categoria',
  },
  {
    value: 'manutencoes',
    label: 'Manutenções detalhadas',
  },
  {
    value: 'servicos',
    label: 'Serviços realizados',
  },
  {
    value: 'fornecedores',
    label: 'Resumo financeiro por fornecedor',
  },
];

async function buscarAuxiliar(endpoint) {
  const resposta = await api.get(`${endpoint}?limit=500`);
  const dados = resposta?.data ?? resposta;

  return dados?.items ?? (Array.isArray(dados) ? dados : []);
}

async function gerarRelatorio(tipo, filtros) {
  const params = new URLSearchParams();

  const filtrosPermitidos =
    tipo === 'equipamentos'
      ? [
          'categoria_id',
          'marca_id',
          'predio_id',
          'situacao',
        ]
      : [
          'fornecedor_id',
          'categoria_id',
          'predio_id',
          'data_inicio',
          'data_fim',
          'forma_aquisicao',
          'tipo_manutencao',
          'finalizado',
        ];

  filtrosPermitidos.forEach((chave) => {
    const valor = filtros[chave];

    if (
      valor !== '' &&
      valor !== null &&
      valor !== undefined
    ) {
      params.set(chave, valor);
    }
  });

  const query = params.toString();

  const resposta = await api.get(
    `/relatorios/${tipo}${query ? `?${query}` : ''}`,
  );

  return resposta?.data ?? resposta;
}

function formatarMoeda(valor) {
  return Number(valor ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatarData(valor) {
  if (!valor) return '—';

  const data = String(valor).slice(0, 10);
  const partes = data.split('-');

  if (partes.length !== 3) return data;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function CampoFiltro({ label, children }) {
  return (
    <div className="col-12 col-md-6 col-lg-3">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

function Seletor({ value, onChange, children }) {
  return (
    <select
      className="form-select form-select-sm"
      value={value}
      onChange={onChange}
    >
      {children}
    </select>
  );
}

function TabelaVazia({ mensagem }) {
  return (
    <div className="alert alert-light border mt-3">
      {mensagem}
    </div>
  );
}

export default function Relatorios() {
  const [tipo, setTipo] = useState('manutencoes');
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [consulta, setConsulta] = useState(null);

  const auxiliares = useQuery({
    queryKey: ['relatorios-auxiliares'],
    queryFn: async () => {
      const [fornecedores, categorias, marcas, predios] =
        await Promise.all([
          buscarAuxiliar('/auxiliares/fornecedores'),
          buscarAuxiliar('/auxiliares/categorias'),
          buscarAuxiliar('/auxiliares/marcas'),
          buscarAuxiliar('/auxiliares/predios'),
        ]);

      return { fornecedores, categorias, marcas, predios };
    },
    staleTime: 1000 * 60 * 15,
  });

  const relatorio = useQuery({
    queryKey: ['relatorio-gerado', consulta?.tipo, consulta?.filtros],
    queryFn: () =>
      gerarRelatorio(consulta.tipo, consulta.filtros),
    enabled: consulta !== null,
    retry: 1,
  });

  const dados = relatorio.data;
  const opcoes = auxiliares.data ?? {
    fornecedores: [],
    categorias: [],
    marcas: [],
    predios: [],
  };

  function atualizarFiltro(campo, valor) {
    setFiltros((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

  function aplicarFiltros(evento) {
    evento.preventDefault();

    setConsulta({
      tipo,
      filtros: { ...filtros },
    });
  }

  function limparFiltros() {
    setFiltros(FILTROS_INICIAIS);
    setConsulta(null);
  }

  function imprimir() {
    window.print();
  }

  const mostrarFiltrosManutencao = tipo !== 'equipamentos';

  return (
    <Layout
      title="Relatórios"
      actions={
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={imprimir}
          disabled={!dados || relatorio.isFetching}
        >
          <i className="bi bi-printer me-1" aria-hidden="true" />
          Imprimir / PDF
        </button>
      }
    >
      <style>{`
        .relatorios-container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .relatorio-tabela th,
        .relatorio-tabela td {
          vertical-align: middle;
          font-size: 0.84rem;
        }

        .relatorio-titulo {
          font-size: 1.2rem;
          font-weight: 600;
        }

        @media print {
          @page {
            size: landscape;
            margin: 12mm;
          }

          html,
          body,
          #root {
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #fff !important;
          }

          .sidebar,
          .topbar,
          .no-print,
          [vw],
          [vw-access-button],
          .vw-plugin-wrapper,
          .vw-access-button {
            display: none !important;
          }

          .main,
          .content,
          .app-shell {
            display: block !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          .sidebar,
          .topbar,
          .no-print {
            display: none !important;
          }

          .main,
          .content,
          .app-shell {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          .relatorios-container {
            max-width: none !important;
          }

          .relatorio-tabela {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          .relatorio-tabela th,
          .relatorio-tabela td {
            border: 1px solid #999 !important;
            padding: 4px !important;
            color: #000 !important;
          }

          .relatorio-grupo {
            break-inside: avoid;
          }

          .table-responsive {
            overflow: visible !important;
          }
        }
      `}</style>

      <div className="relatorios-container">
        <div className="card shadow-sm mb-3 no-print">
          <div className="card-body">
            <h2 className="h5 mb-3">
              <i className="bi bi-file-earmark-bar-graph me-2" />
              Geração de relatórios
            </h2>

            <form onSubmit={aplicarFiltros}>
              <div className="row g-3">
                <CampoFiltro label="Tipo de relatório">
                  <Seletor
                    value={tipo}
                    onChange={(e) => {
                      setTipo(e.target.value);
                      setFiltros({ ...FILTROS_INICIAIS });
                      setConsulta(null);
                    }}
                  >
                    {TIPOS_RELATORIO.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Seletor>
                </CampoFiltro>

                {tipo !== 'equipamentos' && (
                  <CampoFiltro label="Fornecedor / contrato">
                    <Seletor
                      value={filtros.fornecedor_id}
                      onChange={(e) =>
                        atualizarFiltro('fornecedor_id', e.target.value)
                      }
                    >
                      <option value="">Todos os fornecedores</option>
                      {opcoes.fornecedores.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.razao_social}
                        </option>
                      ))}
                    </Seletor>
                  </CampoFiltro>
                )}

                <CampoFiltro label="Categoria / lote">
                  <Seletor
                    value={filtros.categoria_id}
                    onChange={(e) =>
                      atualizarFiltro('categoria_id', e.target.value)
                    }
                  >
                    <option value="">Todas as categorias</option>
                    {opcoes.categorias.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome_categoria}
                      </option>
                    ))}
                  </Seletor>
                </CampoFiltro>

                <CampoFiltro label="Prédio">
                  <Seletor
                    value={filtros.predio_id}
                    onChange={(e) =>
                      atualizarFiltro('predio_id', e.target.value)
                    }
                  >
                    <option value="">Todos os prédios</option>
                    {opcoes.predios.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome_predio}
                      </option>
                    ))}
                  </Seletor>
                </CampoFiltro>

                {tipo === 'equipamentos' && (
                  <>
                    <CampoFiltro label="Marca">
                      <Seletor
                        value={filtros.marca_id}
                        onChange={(e) =>
                          atualizarFiltro('marca_id', e.target.value)
                        }
                      >
                        <option value="">Todas as marcas</option>
                        {opcoes.marcas.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.marca}
                          </option>
                        ))}
                      </Seletor>
                    </CampoFiltro>

                    <CampoFiltro label="Situação do equipamento">
                      <Seletor
                        value={filtros.situacao}
                        onChange={(e) =>
                          atualizarFiltro('situacao', e.target.value)
                        }
                      >
                        <option value="">Todas as situações</option>
                        <option value="Ativo">Ativo</option>
                        <option value="Baixado">Baixado</option>
                        <option value="Para Baixa">Para Baixa</option>
                      </Seletor>
                    </CampoFiltro>
                  </>
                )}

                {mostrarFiltrosManutencao && (
                  <>
                    <CampoFiltro label="Data inicial">
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={filtros.data_inicio}
                        onChange={(e) =>
                          atualizarFiltro('data_inicio', e.target.value)
                        }
                      />
                    </CampoFiltro>

                    <CampoFiltro label="Data final">
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={filtros.data_fim}
                        onChange={(e) =>
                          atualizarFiltro('data_fim', e.target.value)
                        }
                      />
                    </CampoFiltro>

                    <CampoFiltro label="Forma de aquisição">
                      <Seletor
                        value={filtros.forma_aquisicao}
                        onChange={(e) =>
                          atualizarFiltro(
                            'forma_aquisicao',
                            e.target.value,
                          )
                        }
                      >
                        <option value="">Todas as formas</option>
                        <option value="Contrato Direto">
                          Contrato Direto
                        </option>
                        <option value="Processo">Processo</option>
                        <option value="Adiantamento">Adiantamento</option>
                        <option value="CONTRATO">Contrato</option>
                        <option value="Terceiros">Terceiros</option>
                      </Seletor>
                    </CampoFiltro>

                    <CampoFiltro label="Tipo de manutenção">
                      <Seletor
                        value={filtros.tipo_manutencao}
                        onChange={(e) =>
                          atualizarFiltro(
                            'tipo_manutencao',
                            e.target.value,
                          )
                        }
                      >
                        <option value="">Todos os tipos</option>
                        <option value="Corretiva">Corretiva</option>
                        <option value="Manutenção Corretiva (Sem valor)">
                          Manutenção Corretiva (Sem valor)
                        </option>
                        <option value="Manutenção Preventiva">
                          Manutenção Preventiva
                        </option>
                        <option value="Material">Material</option>
                        <option value="Serviço">Serviço</option>
                      </Seletor>
                    </CampoFiltro>

                    <CampoFiltro label="Situação da manutenção">
                      <Seletor
                        value={filtros.finalizado}
                        onChange={(e) =>
                          atualizarFiltro('finalizado', e.target.value)
                        }
                      >
                        <option value="">Todas as situações</option>
                        <option value="true">Finalizadas</option>
                        <option value="false">Em aberto</option>
                      </Seletor>
                    </CampoFiltro>
                  </>
                )}
              </div>

              {auxiliares.isError && (
                <div className="alert alert-warning mt-3 mb-0">
                  Não foi possível carregar todos os filtros auxiliares.
                  Tente atualizar a página.
                </div>
              )}

              <div className="d-flex flex-wrap gap-2 mt-4 no-print">
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={relatorio.isFetching}
                >
                  <i className="bi bi-search me-1" />
                  {relatorio.isFetching
                    ? 'Gerando...'
                    : 'Gerar relatório'}
                </button>

                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={limparFiltros}
                >
                  Limpar filtros
                </button>
              </div>
            </form>
          </div>
        </div>

        {relatorio.isFetching && (
          <div className="alert alert-info">
            Consultando os dados do relatório...
          </div>
        )}

        {relatorio.isError && (
          <div className="alert alert-danger">
            Não foi possível gerar o relatório: {relatorio.error.message}
          </div>
        )}

        {dados && !relatorio.isFetching && (
          <section className="card shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                <div>
                  <div className="relatorio-titulo">
                    {TIPOS_RELATORIO.find(
                      (item) => item.value === consulta.tipo,
                    )?.label}
                  </div>
                  <div className="text-muted small">
                    Gerado em {new Date().toLocaleString('pt-BR')}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm no-print"
                  onClick={imprimir}
                >
                  <i className="bi bi-printer me-1" />
                  Imprimir
                </button>
              </div>

              {consulta.tipo === 'equipamentos' && (
                <>
                  <div className="d-flex flex-wrap gap-3 mb-3">
                    <span>
                      <strong>Total de equipamentos:</strong>{' '}
                      {dados.totalEquipamentos ?? 0}
                    </span>
                    <span>
                      <strong>Total de categorias/lotes:</strong>{' '}
                      {dados.totalCategorias ?? 0}
                    </span>
                  </div>

                  {(dados.grupos ?? []).length === 0 ? (
                    <TabelaVazia mensagem="Nenhum equipamento encontrado com os filtros selecionados." />
                  ) : (
                    dados.grupos.map((grupo) => (
                      <div
                        className="relatorio-grupo mb-4"
                        key={grupo.categoria_id}
                      >
                        <h3 className="h6 fw-bold">
                          Categoria / lote: {grupo.categoria}
                          <span className="text-muted ms-2">
                            ({grupo.quantidade} equipamentos)
                          </span>
                        </h3>

                        <div className="table-responsive">
                          <table className="table table-sm table-bordered relatorio-tabela">
                            <thead className="table-light">
                              <tr>
                                <th>Patrimônio</th>
                                <th>Tipo</th>
                                <th>Modelo</th>
                                <th>Marca</th>
                                <th>Capacidade</th>
                                <th>Prédio</th>
                                <th>Local</th>
                                <th>Situação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {grupo.equipamentos.map((item, indice) => (
                                <tr
                                  key={`${item.patrimonio}-${indice}`}
                                >
                                  <td>{item.patrimonio}</td>
                                  <td>{item.tipo || '—'}</td>
                                  <td>{item.modelo || '—'}</td>
                                  <td>{item.marca || '—'}</td>
                                  <td>
                                    {item.capacidade} {item.unidade_medida}
                                  </td>
                                  <td>{item.predio || '—'}</td>
                                  <td>{item.local || '—'}</td>
                                  <td>{item.situacao || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {consulta.tipo === 'fornecedores' && (
                <>
                  <div className="d-flex flex-wrap gap-4 mb-3">
                    <span>
                      <strong>Fornecedores:</strong>{' '}
                      {dados.quantidadeFornecedores ?? 0}
                    </span>
                    <span>
                      <strong>Manutenções:</strong>{' '}
                      {dados.quantidadeManutencoes ?? 0}
                    </span>
                    <span>
                      <strong>Total geral:</strong>{' '}
                      {formatarMoeda(dados.totalGeral)}
                    </span>
                  </div>

                  {(dados.fornecedores ?? []).length === 0 ? (
                    <TabelaVazia mensagem="Nenhum registro encontrado para os filtros selecionados." />
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm table-striped table-bordered relatorio-tabela">
                        <thead className="table-light">
                          <tr>
                            <th>Fornecedor / contrato</th>
                            <th>CNPJ</th>
                            <th>Quantidade de manutenções</th>
                            <th>Valor total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dados.fornecedores.map((item) => (
                            <tr key={item.fornecedor_id}>
                              <td>{item.fornecedor}</td>
                              <td>{item.cnpj}</td>
                              <td>{item.quantidadeManutencoes}</td>
                              <td>{formatarMoeda(item.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="fw-bold">
                            <td colSpan="3">Total geral</td>
                            <td>{formatarMoeda(dados.totalGeral)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </>
              )}

              {consulta.tipo === 'servicos' && (
                <>
                  <div className="d-flex flex-wrap gap-4 mb-3">
                    <span>
                      <strong>Serviços encontrados:</strong>{' '}
                      {dados.quantidadeServicos ?? 0}
                    </span>
                    <span>
                      <strong>Manutenções:</strong>{' '}
                      {dados.quantidadeManutencoes ?? 0}
                    </span>
                    <span>
                      <strong>Valor total:</strong>{' '}
                      {formatarMoeda(dados.totalGeral)}
                    </span>
                  </div>

                  {(dados.servicos ?? []).length === 0 ? (
                    <TabelaVazia
                      mensagem="Nenhum serviço encontrado com os filtros selecionados."
                    />
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm table-striped table-bordered relatorio-tabela">
                        <thead className="table-light">
                          <tr>
                            <th>Data</th>
                            <th>Solicitação</th>
                            <th>Fornecedor / contrato</th>
                            <th>Tipo</th>
                            <th>Patrimônio</th>
                            <th>Equipamento</th>
                            <th>Prédio / local</th>
                            <th>Descrição do serviço</th>
                            <th>Quantidade</th>
                            <th>Valor total</th>
                            <th>Situação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dados.servicos.map((item, indice) => (
                            <tr
                              key={`${item.manutencao_id}-${indice}`}
                            >
                              <td>{formatarData(item.data)}</td>
                              <td>{item.solicitacao}</td>
                              <td>{item.fornecedor}</td>
                              <td>{item.tipo_manutencao}</td>
                              <td>{item.patrimonio}</td>
                              <td>{item.equipamento}</td>
                              <td>
                                {[item.predio, item.local]
                                  .filter((valor) => valor && valor !== '—')
                                  .join(' / ') || '—'}
                              </td>
                              <td>{item.descricao}</td>
                              <td>{item.quantidade}</td>
                              <td>{formatarMoeda(item.valor_total)}</td>
                              <td>
                                {item.finalizado
                                  ? 'Finalizada'
                                  : 'Em aberto'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {consulta.tipo === 'manutencoes' && (
                <>
                  <div className="d-flex flex-wrap gap-4 mb-3">
                    <span>
                      <strong>Manutenções:</strong>{' '}
                      {dados.quantidadeManutencoes ?? 0}
                    </span>
                    <span>
                      <strong>Total geral:</strong>{' '}
                      {formatarMoeda(dados.totalGeral)}
                    </span>
                  </div>

                  {(dados.manutencoes ?? []).length === 0 ? (
                    <TabelaVazia mensagem="Nenhuma manutenção encontrada com os filtros selecionados." />
                  ) : (
                    dados.manutencoes.map((manutencao) => (
                      <div
                        className="relatorio-grupo border rounded p-3 mb-3"
                        key={manutencao.id}
                      >
                        <div className="d-flex justify-content-between flex-wrap gap-2 mb-2">
                          <div>
                            <strong>
                              Fornecedor / contrato:{' '}
                              {manutencao.fornecedor?.razao_social}
                            </strong>
                            <div className="small text-muted">
                              CNPJ: {manutencao.fornecedor?.cnpj || '—'}
                            </div>
                          </div>

                          <div className="text-md-end">
                            <strong>
                              Total: {formatarMoeda(manutencao.valorTotal)}
                            </strong>
                          </div>
                        </div>

                        <div className="small mb-2">
                          <strong>Data:</strong>{' '}
                          {formatarData(manutencao.data)}
                          {' · '}
                          <strong>Solicitação:</strong>{' '}
                          {manutencao.solicitacao}
                          {' · '}
                          <strong>Nota fiscal:</strong>{' '}
                          {manutencao.nota_fiscal || '—'}
                          {' · '}
                          <strong>Aquisição:</strong>{' '}
                          {manutencao.forma_aquisicao || '—'}
                          {' · '}
                          <strong>Tipo:</strong>{' '}
                          {manutencao.tipo_manutencao || '—'}
                          {' · '}
                          <strong>Situação:</strong>{' '}
                          {manutencao.finalizado
                            ? 'Finalizada'
                            : 'Em aberto'}
                        </div>

                        <div className="table-responsive">
                          <table className="table table-sm table-bordered relatorio-tabela mb-1">
                            <thead className="table-light">
                              <tr>
                                <th>Patrimônio</th>
                                <th>Categoria</th>
                                <th>Tipo</th>
                                <th>Modelo</th>
                                <th>Marca</th>
                                <th>Descrição do serviço</th>
                                <th>Quantidade</th>
                                <th>Valor unitário</th>
                                <th>Valor total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {manutencao.itens.map((item, indice) => (
                                <tr key={`${manutencao.id}-${indice}`}>
                                  <td>{item.equipamento?.patrimonio || '—'}</td>
                                  <td>{item.equipamento?.categoria || '—'}</td>
                                  <td>{item.equipamento?.tipo || '—'}</td>
                                  <td>{item.equipamento?.modelo || '—'}</td>
                                  <td>{item.equipamento?.marca || '—'}</td>
                                  <td>{item.descricao || '—'}</td>
                                  <td>{item.quantidade}</td>
                                  <td>{formatarMoeda(item.valor_unitario)}</td>
                                  <td>{formatarMoeda(item.valor_total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
