ALTER TABLE servers ADD COLUMN theme_color TEXT
  CHECK (
    theme_color IS NULL OR (
      length(theme_color) = 7
      AND substr(theme_color, 1, 1) = '#'
      AND substr(theme_color, 2) NOT GLOB '*[^0-9A-Fa-f]*'
    )
  );

ALTER TABLE servers ADD COLUMN accent_color TEXT
  CHECK (
    accent_color IS NULL OR (
      length(accent_color) = 7
      AND substr(accent_color, 1, 1) = '#'
      AND substr(accent_color, 2) NOT GLOB '*[^0-9A-Fa-f]*'
    )
  );
