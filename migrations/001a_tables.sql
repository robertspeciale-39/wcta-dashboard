CREATE TABLE IF NOT EXISTS sites (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  is_home INTEGER NOT NULL DEFAULT 0,
  color   TEXT,
  sort    INTEGER NOT NULL DEFAULT 100
);
CREATE TABLE IF NOT EXISTS teams (
  season TEXT NOT NULL,
  number TEXT NOT NULL,
  name   TEXT,
  site   TEXT NOT NULL DEFAULT 'unknown',
  PRIMARY KEY (season, number)
);
CREATE INDEX IF NOT EXISTS idx_teams_site ON teams(site);
INSERT OR IGNORE INTO sites (id, name, is_home, color, sort) VALUES
  ('west-cta',     'West CTA',     1, '#00FF41', 0),
  ('shadow',       'Shadow',       0, '#00BFFF', 10),
  ('faith',        'Faith',        0, '#DDA0DD', 20),
  ('swcta',        'SWCTA',        0, '#FF6347', 30),
  ('sierra-vista', 'Sierra Vista', 0, '#20B2AA', 40),
  ('eldorado',     'Eldorado',     0, '#F0E68C', 50),
  ('clark',        'Clark',        0, '#FF69B4', 60),
  ('unknown',      'Unknown',      0, '#6b7a7a', 999);
INSERT OR IGNORE INTO teams (season, number, name, site)
  SELECT season, number, MAX(name), 'west-cta' FROM scores
  WHERE number IS NOT NULL AND number <> ''
  GROUP BY season, number;
