-- Evde Sağlık Eşleştirme — veritabanı şeması v0.1
-- Kural: Her tıbbi/mevzuat satırı bir kaynağa (sources.id) bağlıdır.
-- "tasarim" kaynaklı satırlar ekibin tasarım varsayımıdır; klinisyen doğrulaması bekler.

PRAGMA foreign_keys = ON;

CREATE TABLE sources (
    id          TEXT PRIMARY KEY,          -- S01, S02 ...
    title       TEXT NOT NULL,
    publisher   TEXT,
    url         TEXT,
    kind        TEXT NOT NULL,             -- mevzuat | resmi_rehber | haber | makale | veri_seti | tasarim
    accessed    TEXT NOT NULL              -- YYYY-MM-DD
);

-- Meslekler ve yasal çalışma koşulları
CREATE TABLE professions (
    code                      TEXT PRIMARY KEY,
    name_tr                   TEXT NOT NULL,
    can_diagnose              INTEGER NOT NULL CHECK (can_diagnose IN (0,1)),
    requires_physician_order  INTEGER NOT NULL CHECK (requires_physician_order IN (0,1)),
    note                      TEXT,
    source_id                 TEXT REFERENCES sources(id)
);

-- Evde verilebilen hizmet kataloğu
CREATE TABLE services (
    code                   TEXT PRIMARY KEY,
    name_tr                TEXT NOT NULL,
    category               TEXT NOT NULL,      -- muayene | hemsirelik | rehabilitasyon | isitme | beslenme | psikoloji | ayak | tele
    duration_min           INTEGER NOT NULL,   -- tipik süre (tasarım varsayımı)
    needs_physician_order  INTEGER NOT NULL CHECK (needs_physician_order IN (0,1)),
    needs_prescription     INTEGER NOT NULL CHECK (needs_prescription IN (0,1)),
    remote_possible        INTEGER NOT NULL CHECK (remote_possible IN (0,1)),
    base_fee_tl            INTEGER NOT NULL,   -- demo fiyatı (varsayım, piyasa verisi değil)
    note                   TEXT,
    source_id              TEXT REFERENCES sources(id)
);

-- Hangi meslek hangi hizmeti verebilir
CREATE TABLE profession_services (
    profession_code  TEXT NOT NULL REFERENCES professions(code),
    service_code     TEXT NOT NULL REFERENCES services(code),
    source_id        TEXT REFERENCES sources(id),
    PRIMARY KEY (profession_code, service_code)
);

-- Kırmızı bayraklar: eşleşirse uygulama randevu önermez, acil hattına yönlendirir
CREATE TABLE red_flags (
    code        TEXT PRIMARY KEY,
    name_tr     TEXT NOT NULL,
    keywords    TEXT NOT NULL,     -- '|' ile ayrılmış; her öğe ';' ile ayrılmış kelimelerin HEPSİNİ içermeli
    action      TEXT NOT NULL,     -- 112 | 114
    message_tr  TEXT NOT NULL,
    source_id   TEXT NOT NULL REFERENCES sources(id)
);

-- Acil olmayan şikayetlerin hizmet seviyesine yönlendirilmesi
CREATE TABLE complaint_routes (
    code              TEXT PRIMARY KEY,
    name_tr           TEXT NOT NULL,
    keywords          TEXT NOT NULL,   -- red_flags ile aynı biçim
    level_no_plan     TEXT NOT NULL,   -- hekim planı yoksa önerilen seviye
    level_with_plan   TEXT NOT NULL,   -- hekim planı/reçete varsa önerilen seviye
    services          TEXT NOT NULL,   -- '|' ile ayrılmış service.code (plan varsa verilecek hizmetler)
    priority          INTEGER NOT NULL,-- yüksek = daha öncelikli eşleşme
    note              TEXT,
    source_id         TEXT NOT NULL REFERENCES sources(id)
);

-- Kullanıcının belirli bir meslek isteği ("hemşire istiyorum", "fizik tedavici gelsin")
CREATE TABLE profession_intents (
    code              TEXT PRIMARY KEY,
    profession_code   TEXT NOT NULL REFERENCES professions(code),
    keywords          TEXT NOT NULL,   -- red_flags ile aynı biçim
    default_service   TEXT NOT NULL REFERENCES services(code), -- şikâyet kalıbı yoksa önerilecek hizmet
    priority          INTEGER NOT NULL,-- yüksek = önce (özel meslek > genel 'doktor')
    note              TEXT,
    source_id         TEXT NOT NULL REFERENCES sources(id)
);

-- Bölgeler (sentetik demo için yaklaşık ilçe merkezleri)
CREATE TABLE districts (
    name  TEXT PRIMARY KEY,
    lat   REAL NOT NULL,
    lon   REAL NOT NULL
);

-- ===== Sentetik demo verisi (gerçek kişi değildir) =====
CREATE TABLE providers (
    id                 TEXT PRIMARY KEY,
    display_name       TEXT NOT NULL,
    profession_code    TEXT NOT NULL REFERENCES professions(code),
    years_experience   INTEGER NOT NULL,
    rating             REAL NOT NULL,
    fee_multiplier     REAL NOT NULL,    -- 0.8 ekonomik ... 1.4 kıdemli
    home_district      TEXT NOT NULL REFERENCES districts(name),
    home_lat           REAL NOT NULL,
    home_lon           REAL NOT NULL,
    licence_verified   INTEGER NOT NULL CHECK (licence_verified IN (0,1))
);

CREATE TABLE provider_services (
    provider_id    TEXT NOT NULL REFERENCES providers(id),
    service_code   TEXT NOT NULL REFERENCES services(code),
    visits_done    INTEGER NOT NULL,     -- bu hizmette tamamlanmış ziyaret (yetkinlik sinyali)
    PRIMARY KEY (provider_id, service_code)
);

CREATE TABLE availability (
    provider_id  TEXT NOT NULL REFERENCES providers(id),
    date         TEXT NOT NULL,          -- YYYY-MM-DD
    start_min    INTEGER NOT NULL,       -- gün içindeki dakika (540 = 09:00)
    end_min      INTEGER NOT NULL,
    PRIMARY KEY (provider_id, date)
);

CREATE TABLE scheduled_visits (
    id            TEXT PRIMARY KEY,
    provider_id   TEXT NOT NULL REFERENCES providers(id),
    date          TEXT NOT NULL,
    start_min     INTEGER NOT NULL,
    duration_min  INTEGER NOT NULL,
    lat           REAL NOT NULL,
    lon           REAL NOT NULL,
    service_code  TEXT NOT NULL REFERENCES services(code)
);

CREATE TABLE patients (
    id                  TEXT PRIMARY KEY,
    district            TEXT NOT NULL REFERENCES districts(name),
    lat                 REAL NOT NULL,
    lon                 REAL NOT NULL,
    bedridden           INTEGER NOT NULL CHECK (bedridden IN (0,1)),
    has_physician_plan  INTEGER NOT NULL CHECK (has_physician_plan IN (0,1))
);
