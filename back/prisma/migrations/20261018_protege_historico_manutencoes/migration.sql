-- Protege os historicos de equipamentos e manutencoes.
-- Substitui ON DELETE CASCADE por ON DELETE RESTRICT.
-- Nao exclui registros existentes.

ALTER TABLE "itens_manutencao"
DROP CONSTRAINT "itens_manutencao_equipamento_id_fkey";

ALTER TABLE "locais"
DROP CONSTRAINT "locais_predio_id_fkey";

ALTER TABLE "manutencoes"
DROP CONSTRAINT "manutencoes_fornecedor_id_fkey";

ALTER TABLE "locais"
ADD CONSTRAINT "locais_predio_id_fkey"
FOREIGN KEY ("predio_id")
REFERENCES "predios"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "manutencoes"
ADD CONSTRAINT "manutencoes_fornecedor_id_fkey"
FOREIGN KEY ("fornecedor_id")
REFERENCES "fornecedores"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "itens_manutencao"
ADD CONSTRAINT "itens_manutencao_equipamento_id_fkey"
FOREIGN KEY ("equipamento_id")
REFERENCES "equipamentos"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
