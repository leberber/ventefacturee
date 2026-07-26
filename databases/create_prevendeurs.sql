-- Remove previously inserted accounts (had code_fdv as phone)
DELETE FROM users WHERE phone IN (
  '1501-VD201','1501-VD202','1501-VD203','1501-VD204','1501-VD205',
  '1501-VD206','1501-VD207','1501-VD208','1501-VD209','1501-VD210',
  '1501-VD211','1501-VH201','1501-VH202','1501-VH203','1501-VH204',
  '1501-VH205','1501-VH206','1501-VH207','1501-H0203'
);

-- Create prévendeur accounts with sequential phone numbers
-- Default password: sodichn2026

INSERT INTO users (phone, full_name, hashed_password, role, is_active, created_at)
VALUES
  ('0560067701', 'BRAHITI MOHAND',       '$2b$12$58AFwIIkewj4uqhqoVulDeMZ1IjOxrh.zIcqS6ribqriY2HIigoYa', 'PREVENDER', true, NOW()),
  ('0560067702', 'BECHOUCHE SALIM',      '$2b$12$58AFwIIkewj4uqhqoVulDeMZ1IjOxrh.zIcqS6ribqriY2HIigoYa', 'PREVENDER', true, NOW()),
  ('0560067703', 'AMEZIANE KAMEL',       '$2b$12$58AFwIIkewj4uqhqoVulDeMZ1IjOxrh.zIcqS6ribqriY2HIigoYa', 'PREVENDER', true, NOW()),
  ('0560067704', 'AIFOUNE YACINE',       '$2b$12$58AFwIIkewj4uqhqoVulDeMZ1IjOxrh.zIcqS6ribqriY2HIigoYa', 'PREVENDER', true, NOW()),
  ('0560067705', 'OUALI SAID',           '$2b$12$58AFwIIkewj4uqhqoVulDeMZ1IjOxrh.zIcqS6ribqriY2HIigoYa', 'PREVENDER', true, NOW()),
  ('0560067706', 'LAMINE RAMDANI',       '$2b$12$58AFwIIkewj4uqhqoVulDeMZ1IjOxrh.zIcqS6ribqriY2HIigoYa', 'PREVENDER', true, NOW()),
  ('0560067707', 'YOUCEFI YOUVA',        '$2b$12$58AFwIIkewj4uqhqoVulDeMZ1IjOxrh.zIcqS6ribqriY2HIigoYa', 'PREVENDER', true, NOW()),
  ('0560067708', 'BOUTORA MUSTAPHA',     '$2b$12$58AFwIIkewj4uqhqoVulDeMZ1IjOxrh.zIcqS6ribqriY2HIigoYa', 'PREVENDER', true, NOW()),
  ('0560067709', 'YOUCEFI TOUFIK',       '$2b$12$58AFwIIkewj4uqhqoVulDeMZ1IjOxrh.zIcqS6ribqriY2HIigoYa', 'PREVENDER', true, NOW()),
  ('0560067710', 'CHETOUANE BELKACEM',   '$2b$12$58AFwIIkewj4uqhqoVulDeMZ1IjOxrh.zIcqS6ribqriY2HIigoYa', 'PREVENDER', true, NOW()),
  ('0560067711', 'AMRRARE YACINE',       '$2b$12$58AFwIIkewj4uqhqoVulDeMZ1IjOxrh.zIcqS6ribqriY2HIigoYa', 'PREVENDER', true, NOW()),
  ('0560067712', 'KECILI MAKHLOUF',      '$2b$12$58AFwIIkewj4uqhqoVulDeMZ1IjOxrh.zIcqS6ribqriY2HIigoYa', 'PREVENDER', true, NOW()),
  ('0560067713', 'MESSAOUDI MOHAMED',    '$2b$12$58AFwIIkewj4uqhqoVulDeMZ1IjOxrh.zIcqS6ribqriY2HIigoYa', 'PREVENDER', true, NOW()),
  ('0560067714', 'SALMI MERZOUK',        '$2b$12$58AFwIIkewj4uqhqoVulDeMZ1IjOxrh.zIcqS6ribqriY2HIigoYa', 'PREVENDER', true, NOW()),
  ('0560067715', 'IBESSAIENE LYES',      '$2b$12$58AFwIIkewj4uqhqoVulDeMZ1IjOxrh.zIcqS6ribqriY2HIigoYa', 'PREVENDER', true, NOW()),
  ('0560067716', 'AIT SAILI AMINE',      '$2b$12$58AFwIIkewj4uqhqoVulDeMZ1IjOxrh.zIcqS6ribqriY2HIigoYa', 'PREVENDER', true, NOW()),
  ('0560067717', 'BIR ABDENOUR',         '$2b$12$58AFwIIkewj4uqhqoVulDeMZ1IjOxrh.zIcqS6ribqriY2HIigoYa', 'PREVENDER', true, NOW()),
  ('0560067718', 'MOHAND AKLI IKHOU',    '$2b$12$58AFwIIkewj4uqhqoVulDeMZ1IjOxrh.zIcqS6ribqriY2HIigoYa', 'PREVENDER', true, NOW()),
  ('0560067719', 'TABTI BRAHIM',         '$2b$12$58AFwIIkewj4uqhqoVulDeMZ1IjOxrh.zIcqS6ribqriY2HIigoYa', 'PREVENDER', true, NOW())
ON CONFLICT (phone) DO NOTHING;

-- Default password for all accounts: sodichn2026
