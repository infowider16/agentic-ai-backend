CREATE TABLE lead_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id VARCHAR(32) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  work_email VARCHAR(190) NOT NULL,
  phone_number VARCHAR(30),
  question TEXT NOT NULL,
  trigger_reason VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lead_submissions_agent_id FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  INDEX idx_lead_submissions_agent_id (agent_id),
  INDEX idx_lead_submissions_work_email (work_email)
);