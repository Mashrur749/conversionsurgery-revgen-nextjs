-- Custom migration: pgvector extension + embedding column + HNSW index
-- Drizzle cannot generate vector type columns, so this is manual.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS embedding vector(1024);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding
  ON knowledge_base USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
