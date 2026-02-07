-- ============================================
-- REVENUE RECOVERY SYSTEM — DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CLIENTS (Contractors)
-- ============================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) NOT NULL,
  twilio_number VARCHAR(20),
  google_business_url VARCHAR(500),
  timezone VARCHAR(50) DEFAULT 'America/Edmonton',
  notification_email BOOLEAN DEFAULT true,
  notification_sms BOOLEAN DEFAULT true,
  webhook_url VARCHAR(500),
  webhook_events JSONB DEFAULT '["lead.created", "lead.qualified", "appointment.booked"]',
  messages_sent_this_month INTEGER DEFAULT 0,
  monthly_message_limit INTEGER DEFAULT 500,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active', -- active, paused, cancelled
  is_test BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- LEADS (Homeowners)
-- ============================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  address VARCHAR(500),
  project_type VARCHAR(255),
  notes TEXT,
  source VARCHAR(50), -- missed_call, form, manual
  status VARCHAR(50) DEFAULT 'new', -- new, contacted, estimate_sent, won, lost, opted_out
  action_required BOOLEAN DEFAULT false,
  action_required_reason VARCHAR(255),
  opted_out BOOLEAN DEFAULT false,
  opted_out_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, phone)
);

-- ============================================
-- CONVERSATIONS
-- ============================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  direction VARCHAR(10), -- inbound, outbound
  message_type VARCHAR(20), -- sms, ai_response, contractor_response, system
  content TEXT NOT NULL,
  twilio_sid VARCHAR(50),
  ai_confidence DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SCHEDULED MESSAGES
-- ============================================
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  sequence_type VARCHAR(50), -- estimate_followup, payment_reminder, appointment_reminder, review_request, referral_request
  sequence_step INTEGER,
  content TEXT NOT NULL,
  send_at TIMESTAMP NOT NULL,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMP,
  cancelled BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMP,
  cancelled_reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- APPOINTMENTS
-- ============================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  address VARCHAR(500),
  status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, confirmed, completed, no_show, cancelled
  reminder_day_before_sent BOOLEAN DEFAULT false,
  reminder_2hr_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INVOICES
-- ============================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50),
  amount DECIMAL(10,2),
  due_date DATE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, reminded, paid, overdue
  payment_link VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- BLOCKED NUMBERS (STOP list)
-- ============================================
CREATE TABLE blocked_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  reason VARCHAR(50), -- opt_out, spam, manual
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, phone)
);

-- ============================================
-- ERROR LOG
-- ============================================
CREATE TABLE error_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id),
  error_type VARCHAR(100),
  error_message TEXT,
  error_details JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- WEBHOOK LOG
-- ============================================
CREATE TABLE webhook_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  event_type VARCHAR(50),
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- MESSAGE TEMPLATES
-- ============================================
CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  template_type VARCHAR(50), -- missed_call, form_response, appointment_day_before, etc.
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, template_type)
);

-- ============================================
-- DAILY STATS
-- ============================================
CREATE TABLE daily_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  missed_calls_captured INTEGER DEFAULT 0,
  forms_responded INTEGER DEFAULT 0,
  conversations_started INTEGER DEFAULT 0,
  appointments_reminded INTEGER DEFAULT 0,
  estimates_followed_up INTEGER DEFAULT 0,
  reviews_requested INTEGER DEFAULT 0,
  referrals_requested INTEGER DEFAULT 0,
  payments_reminded INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, date)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_leads_client_id ON leads(client_id);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_action_required ON leads(action_required) WHERE action_required = true;
CREATE INDEX idx_conversations_lead_id ON conversations(lead_id);
CREATE INDEX idx_conversations_client_id ON conversations(client_id);
CREATE INDEX idx_scheduled_messages_send_at ON scheduled_messages(send_at) WHERE sent = false AND cancelled = false;
CREATE INDEX idx_scheduled_messages_client_id ON scheduled_messages(client_id);
CREATE INDEX idx_scheduled_messages_lead_id ON scheduled_messages(lead_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_client_id ON appointments(client_id);
CREATE INDEX idx_blocked_numbers_phone ON blocked_numbers(client_id, phone);
CREATE INDEX idx_daily_stats_client_date ON daily_stats(client_id, date);

-- ============================================
-- INSERT TEST CLIENT (for your own testing)
-- Replace with your actual info
-- ============================================
INSERT INTO clients (
  business_name,
  owner_name,
  email,
  phone,
  twilio_number,
  google_business_url,
  timezone,
  is_test
) VALUES (
  'Test Remodeling Co',
  'Mashrur',
  'your-email@example.com',        -- Replace with your email
  '+14035551234',                   -- Replace with your phone
  '+14035550000',                   -- Replace with your Twilio test number
  'https://g.page/your-business',  -- Replace or leave as placeholder
  'America/Edmonton',
  true
);

-- Verify the test client was created
SELECT id, business_name, owner_name, email, twilio_number FROM clients;
