-- One-time migration: gm + sales_agent (no separate sales / Sales Head role).
-- If this errors on constraint name, run \d users in psql and adjust DROP CONSTRAINT.

UPDATE users SET role = 'gm' WHERE role = 'sales';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (
  'super_admin','gm','sales_agent',
  'branch_manager','sales_manager','sales_executive',
  'banquet_coordinator','front_desk','finance'
));
