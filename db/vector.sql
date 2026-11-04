-- Optional pgvector schema, applied only when ENABLE_VECTOR=true.
CREATE EXTENSION IF NOT EXISTS vector;
DROP TABLE IF EXISTS expense_vectors;
CREATE TABLE expense_vectors (
  expense_id uuid PRIMARY KEY REFERENCES expenses(id) ON DELETE CASCADE,
  embedding vector(384) NOT NULL,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expense_vectors_cosine_hnsw_idx ON expense_vectors USING hnsw (embedding vector_cosine_ops);
