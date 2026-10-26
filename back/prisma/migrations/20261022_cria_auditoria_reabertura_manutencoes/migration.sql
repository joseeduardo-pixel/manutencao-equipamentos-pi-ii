-- CreateTable
CREATE TABLE "auditoria_reabertura_manutencao" (
    "id" SERIAL NOT NULL,
    "manutencao_id" INTEGER NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "justificativa" TEXT NOT NULL,
    "data_reabertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_reabertura_manutencao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auditoria_reabertura_manutencao_manutencao_id_idx"
ON "auditoria_reabertura_manutencao"("manutencao_id");

-- CreateIndex
CREATE INDEX "auditoria_reabertura_manutencao_usuario_id_idx"
ON "auditoria_reabertura_manutencao"("usuario_id");

-- AddForeignKey
ALTER TABLE "auditoria_reabertura_manutencao"
ADD CONSTRAINT "auditoria_reabertura_manutencao_manutencao_id_fkey"
FOREIGN KEY ("manutencao_id")
REFERENCES "manutencoes"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_reabertura_manutencao"
ADD CONSTRAINT "auditoria_reabertura_manutencao_usuario_id_fkey"
FOREIGN KEY ("usuario_id")
REFERENCES "users"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
