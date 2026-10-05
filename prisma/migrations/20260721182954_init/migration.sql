-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "adapterType" TEXT NOT NULL,
    "baseUrl" TEXT,
    "encryptedKey" TEXT,
    "extraHeaders" TEXT,
    "timeoutMs" INTEGER NOT NULL DEFAULT 60000,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Model" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "technicalId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "maxContext" INTEGER,
    "inputPricePer1M" TEXT,
    "outputPricePer1M" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isLocal" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "supportsStreaming" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Model_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "systemPrompt" TEXT,
    "content" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PromptVariable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultValue" TEXT,
    CONSTRAINT "PromptVariable_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promptId" TEXT,
    "systemPrompt" TEXT,
    "finalPrompt" TEXT NOT NULL,
    "variablesUsed" TEXT,
    "parameters" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "demoMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Run_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "providerId" TEXT,
    "modelTechnicalId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "latencyMs" INTEGER,
    "timeToFirstTokenMs" INTEGER,
    "estimatedCost" TEXT,
    "finishReason" TEXT,
    "usedStreaming" BOOLEAN NOT NULL DEFAULT false,
    "parameters" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "errorProvider" TEXT,
    "errorRetryable" BOOLEAN NOT NULL DEFAULT false,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "rawMetadata" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "RunResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RunResult_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runResultId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "criteria" TEXT,
    "comment" TEXT,
    "blindMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Evaluation_runResultId_fkey" FOREIGN KEY ("runResultId") REFERENCES "RunResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Provider_adapterType_idx" ON "Provider"("adapterType");

-- CreateIndex
CREATE INDEX "Model_providerId_idx" ON "Model"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Model_providerId_technicalId_key" ON "Model"("providerId", "technicalId");

-- CreateIndex
CREATE INDEX "Prompt_title_idx" ON "Prompt"("title");

-- CreateIndex
CREATE INDEX "PromptVariable_promptId_idx" ON "PromptVariable"("promptId");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVariable_promptId_name_key" ON "PromptVariable"("promptId", "name");

-- CreateIndex
CREATE INDEX "Run_createdAt_idx" ON "Run"("createdAt");

-- CreateIndex
CREATE INDEX "Run_promptId_idx" ON "Run"("promptId");

-- CreateIndex
CREATE INDEX "RunResult_runId_idx" ON "RunResult"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_runResultId_key" ON "Evaluation"("runResultId");
