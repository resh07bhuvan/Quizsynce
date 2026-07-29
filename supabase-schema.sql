-- QuizSynce Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- ============================================================
-- TABLES
-- ============================================================

-- Quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'waiting'
              CHECK (status IN ('waiting', 'live', 'ended')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  question_count INT NOT NULL DEFAULT 0,
  source_type TEXT CHECK (source_type IN ('excel', 'topic', 'manual')),
  source_label TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id     UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  options     JSONB NOT NULL,
  correct     INT NOT NULL,
  explanation TEXT DEFAULT '',
  order_index INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Player sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id       UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  player_name   TEXT NOT NULL,
  score         INT NOT NULL DEFAULT 0,
  answers       JSONB NOT NULL DEFAULT '{}',
  answers_count INT NOT NULL DEFAULT 0,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quiz_id, player_name)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_quizzes_code ON quizzes(code);
CREATE INDEX IF NOT EXISTS idx_quizzes_active ON quizzes(is_active);
CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_sessions_quiz ON sessions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_sessions_score ON sessions(quiz_id, score DESC);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quizzes_updated_at
  BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active quizzes"
  ON quizzes FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Public can read questions"
  ON questions FOR SELECT
  USING (TRUE);

CREATE POLICY "Public can read sessions"
  ON sessions FOR SELECT
  USING (TRUE);

CREATE POLICY "Public can create sessions"
  ON sessions FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Public can update their own session"
  ON sessions FOR UPDATE
  USING (TRUE);

CREATE POLICY "Allow all writes (admin app)"
  ON quizzes FOR ALL
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Allow all question writes"
  ON questions FOR ALL
  USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE quizzes;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
