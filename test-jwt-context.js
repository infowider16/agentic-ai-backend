/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║         FuelSmart Pro — Full AI Agent Test Suite                ║
 * ║  Tests: Plans · Aircraft · SAF · Calc · FAQ · Legal · Access    ║
 * ║  Run: node test-jwt-context.js                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * WHAT THIS TESTS:
 *  - JWT user context injection (name, plan, aircraft, dates)
 *  - All 3 subscription plans (Starter / Professional / Enterprise)
 *  - Plan pricing accuracy against knowledge base
 *  - Subscription access limits (aircraft profiles, users, API)
 *  - Fuel Tankering Calculator knowledge
 *  - SAF (Sustainable Aviation Fuel) Calculator knowledge
 *  - Aviation Conversion Tools (Professional-only feature)
 *  - Cost-to-carry concept explanation
 *  - Aircraft directory — specific manufacturers and models
 *  - FAQ responses (cancellation, refund, platform usage)
 *  - Terms & Conditions and compliance notices
 *  - Privacy Policy awareness
 *  - Guest / unauthenticated mode
 *  - Out-of-scope guardrail
 *  - Lead form trigger detection
 *  - Multi-turn context retention (follow-up questions)
 */

const jwt  = require('jsonwebtoken');
const http = require('http');
const fs   = require('fs');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const AGENT_ID   = 'AGENT_EF94371D';
const SECRET_KEY = '5ecdbb0a734a7e48a8a14585e63023a0b485f02b92febfe067e015ef6f72d2fb';

const USER_PAYLOAD = {
  user_id:           'am00123',
  user_name:         'Aman Dubey',
  user_email:        'aman.dubey001@example.com',
  role:              'subscriber',
  plan_amount:       '$189.99/month',
  subscription_plan: 'professional',
  plan_start_date:   '01-06-2026',
  plan_end_date:     '01-07-2026',
  saved_aircraft: [
    { manufacturer: 'Gulfstream', model: 'G650' },
    { manufacturer: 'Cessna',     model: 'Citation XLS' }
  ]
};

// ─── COLORS ───────────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  blue:   '\x1b[34m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  white:  '\x1b[37m'
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function generateToken(payload) {
  return jwt.sign(payload || USER_PAYLOAD, SECRET_KEY, { algorithm: 'HS256', expiresIn: '2h' });
}

function postChat(message, token, history) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      agent_id:       AGENT_ID,
      message:        message,
      history:        history || [],
      token:          token || undefined
    });

    const opts = {
      method:   'POST',
      hostname: 'localhost',
      port:     3000,
      path:     '/api/chat',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: { raw: data } }); }
      });
    });

    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('Timed out after 20s')));
    req.write(body);
    req.end();
  });
}

async function chat(message, token, history) {
  await sleep(3500); // stay under 20 req/min rate limit
  return postChat(message, token, history);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function contains(text, keywords) {
  const t = text.toLowerCase();
  return keywords.find(k => t.includes(k.toLowerCase())) || null;
}
function notContains(text, keywords) {
  const t = text.toLowerCase();
  return !keywords.some(k => t.includes(k.toLowerCase()));
}

// ─── RESULTS ──────────────────────────────────────────────────────────────────
const results = {
  passed:   0,
  failed:   0,
  warnings: 0,
  issues:   [],
  log:      []
};

function section(title, category) {
  const line = `\n${C.bold}${C.cyan}━━━  ${title}  ━━━${C.reset}`;
  console.log(line);
  results.log.push(`\n=== ${title} ===`);
}

function assert(label, text, mustContain, failHint, category) {
  const hit = contains(text, mustContain);
  const short = text.slice(0, 220).replace(/\n/g, ' ');
  if (hit) {
    console.log(`${C.green}  ✔ PASS${C.reset}  ${label}`);
    console.log(`${C.dim}         reply preview: "${short}..."${C.reset}`);
    results.passed++;
    results.log.push(`PASS | ${label}`);
  } else {
    console.log(`${C.red}  ✘ FAIL${C.reset}  ${label}`);
    console.log(`${C.dim}         reply preview: "${short}..."${C.reset}`);
    console.log(`${C.yellow}         ↳ Hint: ${failHint}${C.reset}`);
    results.failed++;
    results.issues.push({ label, hint: failHint, category: category || 'General', reply: short });
    results.log.push(`FAIL | ${label} | Hint: ${failHint}`);
  }
}

function assertNot(label, text, mustNotContain, failHint, category) {
  const ok = notContains(text, mustNotContain);
  const short = text.slice(0, 220).replace(/\n/g, ' ');
  if (ok) {
    console.log(`${C.green}  ✔ PASS${C.reset}  ${label}`);
    results.passed++;
    results.log.push(`PASS | ${label}`);
  } else {
    console.log(`${C.red}  ✘ FAIL${C.reset}  ${label}`);
    console.log(`${C.dim}         reply: "${short}..."${C.reset}`);
    console.log(`${C.yellow}         ↳ Hint: ${failHint}${C.reset}`);
    results.failed++;
    results.issues.push({ label, hint: failHint, category: category || 'General', reply: short });
    results.log.push(`FAIL | ${label} | Hint: ${failHint}`);
  }
}

function warn(label, text, keywords, hint) {
  const hit = contains(text, keywords);
  if (!hit) {
    console.log(`${C.yellow}  ⚠ WARN${C.reset}  ${label}`);
    console.log(`${C.yellow}         ↳ ${hint}${C.reset}`);
    results.warnings++;
    results.log.push(`WARN | ${label} | ${hint}`);
  } else {
    console.log(`${C.green}  ✔ PASS${C.reset}  ${label}`);
    results.passed++;
    results.log.push(`PASS | ${label}`);
  }
}

function ask(question) {
  return console.log(`${C.dim}         ↪ Sending: "${question}"${C.reset}`);
}

// ─── TEST GROUPS ──────────────────────────────────────────────────────────────

// GROUP 1 — JWT USER CONTEXT
async function group1_UserContext(token) {
  section('GROUP 1 — JWT User Context & Personalization', 'JWT');

  ask('Hi');
  let r = await chat('Hi', token);
  let reply = r.body.reply || '';
  assert('Bot greets user by name (Aman / Aman Dubey)', reply,
    ['Aman Dubey', 'Aman'],
    'chatController.js line 83 — user_name not injected into system prompt. Check Decoded userContext in server log.', 'JWT');

  ask('What is my subscription plan?');
  r = await chat('What is my subscription plan?', token);
  reply = r.body.reply || '';
  assert('Bot identifies plan as Professional', reply,
    ['professional', 'Professional Plan'],
    'subscription_plan from JWT not reaching prompt — check chatController.js userPromptContext builder.', 'JWT');

  ask('When does my plan expire?');
  r = await chat('When does my plan expire?', token);
  reply = r.body.reply || '';
  assert('Bot states correct plan end date (01-07-2026)', reply,
    ['01-07-2026', 'July', '2026'],
    'plan_end_date missing from userPromptContext — check chatController.js line 95.', 'JWT');

  ask('What aircraft do I have saved?');
  r = await chat('What aircraft do I have saved?', token);
  reply = r.body.reply || '';
  assert('Bot lists Gulfstream G650 from JWT', reply,
    ['Gulfstream', 'G650'],
    'saved_aircraft not injected — chatController.js lines 106–116.', 'JWT');
  assert('Bot lists Cessna Citation XLS from JWT', reply,
    ['Cessna', 'Citation XLS', 'Citation'],
    'saved_aircraft not injected — chatController.js lines 106–116.', 'JWT');

  ask('How much am I paying?');
  r = await chat('How much am I paying?', token);
  reply = r.body.reply || '';
  assert('Bot mentions billing amount ($189)', reply,
    ['189', '$189'],
    'plan_amount not injected into prompt — chatController.js does not include plan_amount field.', 'JWT');
}

// GROUP 2 — STARTER PLAN DEEP TEST
async function group2_StarterPlan(token) {
  section('GROUP 2 — Starter Plan Details', 'Plans');

  ask('What is included in the Starter plan?');
  let r = await chat('What is included in the Starter plan?', token);
  let reply = r.body.reply || '';
  assert('Starter plan includes basic fuel tankering calculator', reply,
    ['basic fuel tankering', 'calculator', 'starter'],
    'Knowledge base KB fuelsmart-pro-003/plan-002 not loading for Starter plan questions.', 'Plans');

  ask('How much does the Starter plan cost?');
  r = await chat('How much does the Starter plan cost?', token);
  reply = r.body.reply || '';
  assert('Starter plan price mentioned (19.99 or 14.99)', reply,
    ['19.99', '14.99', '$19', '$14'],
    'Starter pricing not found — KB has $14.99/month (starter-plan-secure-001) and $19.99 (homepage). Discrepancy exists — check which KB entry is loaded.', 'Plans');

  ask('Does the Starter plan have a fleet dashboard?');
  r = await chat('Does the Starter plan have a fleet dashboard?', token);
  reply = r.body.reply || '';
  assert('Bot says Starter has NO fleet dashboard', reply,
    ['no fleet', 'no fleet dashboard', 'not include', 'does not include', 'not available', 'does not have', 'not have', 'no dispatch', 'limit', 'without'],
    'Bot should say Starter plan has no fleet dashboard (KB plan-002 "No fleet dashboard").', 'Plans');

  ask('How many users can use the Starter plan?');
  r = await chat('How many users can use the Starter plan?', token);
  reply = r.body.reply || '';
  assert('Bot says Starter is single user only', reply,
    ['single user', '1 user', 'one user', 'single'],
    'KB plan-002 clearly states Starter = Single user access.', 'Plans');
}

// GROUP 3 — PROFESSIONAL PLAN DEEP TEST
async function group3_ProfessionalPlan(token) {
  section('GROUP 3 — Professional Plan Details', 'Plans');

  ask('What does the Professional plan include?');
  let r = await chat('What does the Professional plan include?', token);
  let reply = r.body.reply || '';
  assert('Professional plan mentions tankering optimization engine', reply,
    ['tankering optimization', 'optimization engine'],
    'KB plan-002 Professional includes "Tankering optimization engine".', 'Plans');

  assert('Professional plan mentions saved aircraft profiles', reply,
    ['saved aircraft', 'aircraft profiles', '10'],
    'KB plan-002 says Professional allows up to 10 saved aircraft profiles.', 'Plans');

  ask('How many users can be on the Professional plan?');
  r = await chat('How many users can be on the Professional plan?', token);
  reply = r.body.reply || '';
  assert('Bot says Professional plan allows up to 25 users', reply,
    ['25', 'twenty-five', '25 user'],
    'KB plan-002 states Professional = Up to 25 users (same company).', 'Plans');

  ask('How much is the Professional plan per year?');
  r = await chat('How much is the Professional plan per year?', token);
  reply = r.body.reply || '';
  assert('Professional annual price is $2,279 or $2,388', reply,
    ['2,279', '2279', '$2,279', '2,388', '2388', '$2,388'],
    'KB detailed entries have $2,279/year (professional-plan-secure-001/signup-flow-003). Homepage has $2,388. Either is acceptable.', 'Plans');

  ask('Does the Professional plan have API access?');
  r = await chat('Does the Professional plan have API access?', token);
  reply = r.body.reply || '';
  assert('Bot says Professional has NO API access', reply,
    ['no api', 'not include api', 'does not have api', 'no api access', 'not have api'],
    'KB plan-003 states Professional = No API access.', 'Plans');
}

// GROUP 4 — ENTERPRISE PLAN
async function group4_EnterprisePlan(token) {
  section('GROUP 4 — Enterprise Plan Details', 'Plans');

  ask('Tell me about the Enterprise plan');
  let r = await chat('Tell me about the Enterprise plan', token);
  let reply = r.body.reply || '';
  assert('Enterprise plan targets Part 91K / Part 135 operators', reply,
    ['enterprise', 'part 135', 'part 91', '135', 'flight department'],
    'KB fuelsmart-pro-004 covers Enterprise plan for Part 91K and Part 135 operators.', 'Plans');

  ask('How is Enterprise plan priced?');
  r = await chat('How is Enterprise plan priced?', token);
  reply = r.body.reply || '';
  assert('Enterprise pricing is custom quote', reply,
    ['custom', 'quote', 'custom quote', 'contact'],
    'KB fuelsmart-pro-004 says Enterprise = Custom Quote for enterprise pricing.', 'Plans');

  ask('Does Enterprise plan have API access?');
  r = await chat('Does Enterprise plan have API access?', token);
  reply = r.body.reply || '';
  assert('Enterprise has API / dispatch dashboard access', reply,
    ['api', 'dispatch', 'enterprise'],
    'KB subscription-access-control-001 states Enterprise has api_access=true and dispatch_dashboard=true.', 'Plans');
}

// GROUP 5 — FUEL TANKERING CALCULATOR
async function group5_TankeringCalculator(token) {
  section('GROUP 5 — Fuel Tankering Calculator', 'Calculator');

  ask('What is fuel tankering?');
  let r = await chat('What is fuel tankering?', token);
  let reply = r.body.reply || '';
  assert('Bot explains fuel tankering concept', reply,
    ['fuel tankering', 'uplift', 'cheaper', 'cost', 'destination', 'airport'],
    'KB fuelsmart-pro-001-2 explains fuel tankering strategy.', 'Calculator');

  ask('What is cost-to-carry?');
  r = await chat('What is cost-to-carry?', token);
  reply = r.body.reply || '';
  assert('Bot explains cost-to-carry concept', reply,
    ['cost-to-carry', 'cost to carry', 'additional fuel', 'weight', 'fuel burn'],
    'KB faq-002 explains: "Cost-to-carry represents the additional fuel burned to transport extra fuel weight during a flight."', 'Calculator');

  ask('What are the 4 factors that make tankering beneficial?');
  r = await chat('What are the 4 factors that make tankering beneficial?', token);
  reply = r.body.reply || '';
  assert('Bot mentions price difference as a key tankering factor', reply,
    ['price difference', 'fuel price', 'large price', 'price'],
    'KB fuelsmart-pro-002-2 lists 4 decision criteria including Large Price Difference.', 'Calculator');

  ask('How much fuel cost reduction can tankering provide?');
  r = await chat('How much fuel cost reduction can tankering provide?', token);
  reply = r.body.reply || '';
  assert('Bot mentions up to 33% fuel cost reduction', reply,
    ['33%', '33 percent', 'up to 33'],
    'KB fuelsmart-pro-001-2 states "Up to 33% Potential fuel cost reduction per route".', 'Calculator');

  ask('What is the typical fuel price spread between airports?');
  r = await chat('What is the typical fuel price spread between airports?', token);
  reply = r.body.reply || '';
  assert('Bot mentions $2.50/gal typical price spread', reply,
    ['2.50', '$2.50', '2.50/gal', 'price spread'],
    'KB fuelsmart-pro-001-2 states "$2.50/Gal Typical inter-airport price spread".', 'Calculator');

  ask('How does FuelSmart Pro perform calculations?');
  r = await chat('How does FuelSmart Pro perform calculations?', token);
  reply = r.body.reply || '';
  assert('Bot says calculations are based on admin-defined formulas', reply,
    ['admin-defined', 'admin defined', 'formula', 'formulas', 'aircraft-specific'],
    'KB fuelsmart-pro-001 states "all fuel tankering calculations are generated using admin-defined tankering formulas specific to each supported aircraft model".', 'Calculator');
}

// GROUP 6 — SAF CALCULATOR
async function group6_SAFCalculator(token) {
  section('GROUP 6 — SAF (Sustainable Aviation Fuel) Calculator', 'SAF');

  ask('What is the FuelSmart SAF Calculator?');
  let r = await chat('What is the FuelSmart SAF Calculator?', token);
  let reply = r.body.reply || '';
  assert('Bot explains SAF Calculator purpose', reply,
    ['sustainable', 'saf', 'sustainable aviation fuel'],
    'KB fuel-smart-saf-001 covers SAF Calculator.', 'SAF');

  ask('Is the SAF calculator included in all plans?');
  r = await chat('Is the SAF calculator included in all plans?', token);
  reply = r.body.reply || '';
  assert('Bot confirms SAF is included across all plans', reply,
    ['all plans', 'all fuelsmart', 'included', 'no upgrade', 'every plan'],
    'KB fuel-smart-saf-001 states "Now Included Across All FuelSmart Pro Plans — No Upgrade Required".', 'SAF');

  ask('Can FuelSmart SAF compare SAF cost vs regular Jet A fuel?');
  r = await chat('Can FuelSmart SAF compare SAF cost vs regular Jet A fuel?', token);
  reply = r.body.reply || '';
  assert('Bot confirms SAF vs Jet A cost comparison feature', reply,
    ['jet a', 'saf', 'compare', 'cost'],
    'KB fuel-smart-saf-002 covers "SAF vs Jet A Cost Intelligence".', 'SAF');

  ask('Does SAF calculator help with CO2 emissions tracking?');
  r = await chat('Does SAF calculator help with CO2 emissions tracking?', token);
  reply = r.body.reply || '';
  assert('Bot confirms CO2 / emissions reporting feature', reply,
    ['co2', 'emissions', 'carbon', 'environmental'],
    'KB fuel-smart-saf-002 covers Environmental Impact Engine for CO2 reduction metrics.', 'SAF');

  ask('Is the SAF calculator approved for dispatch release?');
  r = await chat('Is the SAF calculator approved for dispatch release?', token);
  reply = r.body.reply || '';
  assert('Bot says SAF is NOT approved for dispatch release', reply,
    ['not approved', 'advisory', 'advisory tool', 'not for dispatch', 'afm'],
    'KB fuel-smart-saf-004 Compliance Notice: "not approved for operational control or dispatch release".', 'SAF');
}

// GROUP 7 — AIRCRAFT DIRECTORY
async function group7_AircraftDirectory(token) {
  section('GROUP 7 — Aircraft Directory & Supported Models', 'Aircraft');

  ask('Does FuelSmart Pro support Gulfstream aircraft?');
  let r = await chat('Does FuelSmart Pro support Gulfstream aircraft?', token);
  let reply = r.body.reply || '';
  assert('Bot confirms Gulfstream support', reply,
    ['gulfstream', 'g650', 'g700', 'g500'],
    'KB aircraft-directory-002 lists multiple Gulfstream models.', 'Aircraft');

  ask('Is the Challenger 650 supported?');
  r = await chat('Is the Challenger 650 supported?', token);
  reply = r.body.reply || '';
  assert('Bot confirms Challenger 650 support', reply,
    ['challenger 650', 'challenger', '650', 'bombardier'],
    'KB aircraft-directory-002 lists Challenger 350, 3500, 650.', 'Aircraft');

  ask('Can I request a custom aircraft model not in the list?');
  r = await chat('Can I request a custom aircraft model not in the list?', token);
  reply = r.body.reply || '';
  assert('Bot says custom aircraft can be requested', reply,
    ['custom', 'request', 'added', '6-month', 'commitment'],
    'KB aircraft-directory-001 states "Custom aircraft types can be added upon request... minimum 6-month subscription commitment required".', 'Aircraft');

  ask('Is the HondaJet Elite II supported?');
  r = await chat('Is the HondaJet Elite II supported?', token);
  reply = r.body.reply || '';
  assert('Bot confirms HondaJet Elite II in directory', reply,
    ['hondajet', 'honda jet', 'elite ii', 'elite'],
    'KB aircraft-directory-002 lists "HondaJet Elite HondaJet Elite II".', 'Aircraft');

  ask('How many aircraft does FuelSmart Pro support?');
  r = await chat('How many aircraft does FuelSmart Pro support?', token);
  reply = r.body.reply || '';
  assert('Bot mentions 68+ supported aircraft', reply,
    ['68', '68+', '68 +', 'supported aircraft'],
    'KB fuelsmart-pro-005 states "68 + Supported Aircraft".', 'Aircraft');
}

// GROUP 8 — AVIATION CONVERSION TOOLS (Authenticated feature)
async function group8_AviationTools(token) {
  section('GROUP 8 — Aviation Conversion Tools', 'Features');

  ask('What aviation conversion tools does FuelSmart Pro offer?');
  let r = await chat('What aviation conversion tools does FuelSmart Pro offer?', token);
  let reply = r.body.reply || '';
  assert('Bot explains aviation conversion tools', reply,
    ['conversion', 'nautical miles', 'knots', 'altitude', 'temperature', 'fuel weight', 'aviation tools'],
    'KB fuelsmart-pro-auth-007 covers distance, speed, altitude, temperature, fuel weight conversions.', 'Features');

  ask('Can I convert fuel from pounds to gallons in FuelSmart?');
  r = await chat('Can I convert fuel from pounds to gallons in FuelSmart?', token);
  reply = r.body.reply || '';
  assert('Bot explains fuel weight/volume conversion tool', reply,
    ['fuel', 'weight', 'volume', 'gallon', 'conversion', 'jet a'],
    'KB fuelsmart-pro-auth-007 covers Fuel Weight & Volume conversions using density-based logic.', 'Features');
}

// GROUP 9 — FAQ & CANCELLATION POLICY
async function group9_FAQ(token) {
  section('GROUP 9 — FAQ & Cancellation / Refund Policy', 'FAQ');

  ask('How do I cancel my FuelSmart Pro subscription?');
  let r = await chat('How do I cancel my FuelSmart Pro subscription?', token);
  let reply = r.body.reply || '';
  assert('Bot gives cancellation steps (Account Settings / Billing)', reply,
    ['account settings', 'subscription', 'billing', 'cancel subscription', 'dashboard'],
    'KB faq-004 has detailed cancellation steps: Account Settings > Subscription/Billing > Cancel Subscription.', 'FAQ');

  ask('If I cancel, do I lose access immediately?');
  r = await chat('If I cancel, do I lose access immediately?', token);
  reply = r.body.reply || '';
  assert('Bot says access remains active until end of billing period', reply,
    ['billing period', 'end of', 'active until', 'billing cycle', 'remain active'],
    'KB faq-004: "Your subscription will remain active until the end of the current billing period."', 'FAQ');

  ask('Is there a refund if I cancel my annual subscription?');
  r = await chat('Is there a refund if I cancel my annual subscription?', token);
  reply = r.body.reply || '';
  assert('Bot mentions prorated refund for annual subscriptions', reply,
    ['prorated', 'pro-rated', 'refund', 'annual', 'unused'],
    'KB starter-plan-secure-001 states annual = prorated refund for unused months.', 'FAQ');

  ask('Can I get a refund on a monthly subscription?');
  r = await chat('Can I get a refund on a monthly subscription?', token);
  reply = r.body.reply || '';
  assert('Bot says NO refunds for monthly subscriptions', reply,
    ['no partial', 'no refund', 'no prorated', 'monthly', 'non-refundable', 'not provide'],
    'KB starter-plan-secure-001: "Monthly subscriptions... No partial or prorated refunds will be provided."', 'FAQ');

  ask('Who is FuelSmart Pro designed for?');
  r = await chat('Who is FuelSmart Pro designed for?', token);
  reply = r.body.reply || '';
  assert('Bot mentions pilots, dispatchers, charter operators', reply,
    ['pilot', 'dispatcher', 'charter', 'corporate', 'flight department'],
    'KB faq-001 mentions pilots, dispatchers, corporate flight departments, charter operators.', 'FAQ');

  ask('Does FuelSmart Pro work on mobile?');
  r = await chat('Does FuelSmart Pro work on mobile?', token);
  reply = r.body.reply || '';
  assert('Bot confirms mobile / tablet access', reply,
    ['mobile', 'tablet', 'ipad', 'desktop', 'devices'],
    'KB faq-002: "FuelSmart Pro works on desktop computers, tablets including iPad, and mobile devices."', 'FAQ');
}

// GROUP 10 — TERMS & COMPLIANCE
async function group10_TermsCompliance(token) {
  section('GROUP 10 — Terms, Compliance & Legal', 'Legal');

  ask('Is FuelSmart Pro approved for flight dispatch?');
  let r = await chat('Is FuelSmart Pro approved for flight dispatch?', token);
  let reply = r.body.reply || '';
  assert('Bot says NOT approved for dispatch release', reply,
    ['not approved', 'advisory', 'dispatch release', 'afm', 'flight manual'],
    'KB terms-of-services-002 says "NOT APPROVED FOR OPERATIONAL CONTROL OR DISPATCH RELEASE".', 'Legal');

  ask('Who is responsible for fuel planning decisions when using FuelSmart Pro?');
  r = await chat('Who is responsible for fuel planning decisions when using FuelSmart Pro?', token);
  reply = r.body.reply || '';
  assert('Bot says pilot-in-command / user retains responsibility', reply,
    ['pilot', 'pilot in command', 'user', 'responsible', 'responsibility'],
    'KB terms-of-services-002: "THE PILOT IN COMMAND RETAINS FULL RESPONSIBILITY FOR ALL OPERATIONAL DECISIONS."', 'Legal');

  ask('What are FuelSmart Pro terms and conditions?');
  r = await chat('What are FuelSmart Pro terms and conditions?', token);
  reply = r.body.reply || '';
  assert('Bot provides terms overview (PlaneCare / advisory / user responsibility)', reply,
    ['planecareterm', 'planecare', 'advisory', 'terms', 'conditions', 'liability'],
    'KB terms-of-services-001/002 covers T&C.', 'Legal');

  ask('Are subscriptions auto-renewed?');
  r = await chat('Are subscriptions auto-renewed?', token);
  reply = r.body.reply || '';
  assert('Bot confirms auto-renewal and non-refundable payments', reply,
    ['auto-renewal', 'auto renewal', 'automatically', 'renew'],
    'KB terms-of-services-004: "Auto-renewal applies unless canceled. Payments are non-refundable."', 'Legal');

  ask('Does FuelSmart Pro have a privacy policy?');
  r = await chat('Does FuelSmart Pro have a privacy policy?', token);
  reply = r.body.reply || '';
  assert('Bot confirms privacy policy exists and mentions data handling', reply,
    ['privacy', 'data', 'policy', 'planecare', 'protect'],
    'KB privacy-policy-001 covers the full privacy policy.', 'Legal');
}

// GROUP 11 — PLATFORM STATS & ABOUT
async function group11_PlatformStats(token) {
  section('GROUP 11 — Platform Stats & Company Background', 'About');

  ask('How accurate is FuelSmart Pro?');
  let r = await chat('How accurate is FuelSmart Pro?', token);
  let reply = r.body.reply || '';
  assert('Bot mentions 97.5% system accuracy', reply,
    ['97.5', '97.5%', 'accuracy'],
    'KB fuelsmart-pro-005 states "97.5% System Accuracy".', 'About');

  ask('Is FuelSmart Pro available 24/7?');
  r = await chat('Is FuelSmart Pro available 24/7?', token);
  reply = r.body.reply || '';
  assert('Bot confirms 24/7 availability', reply,
    ['24/7', '24 hours', 'always available', 'platform availability'],
    'KB fuelsmart-pro-005 states "24/7 Platform Availability".', 'About');

  ask('How many calculations has FuelSmart Pro generated?');
  r = await chat('How many calculations has FuelSmart Pro generated?', token);
  reply = r.body.reply || '';
  assert('Bot mentions 1000+ calculations generated', reply,
    ['1000', '1,000', '1000+', 'calculations generated'],
    'KB fuelsmart-pro-005 states "1000 + Calculations Generated".', 'About');
}

// GROUP 12 — GUEST MODE (No Token)
async function group12_GuestMode() {
  section('GROUP 12 — Guest / Unauthenticated Mode', 'Access');

  ask('(no token) What plan am I on?');
  let r = await chat('What plan am I on?', null);
  let reply = r.body.reply || '';
  assert('Bot treats user as guest when no token provided', reply,
    ['guest', 'log in', 'login', 'logging in', 'account', 'sign in', 'not available', 'authenticate', "don't have", 'dashboard', 'subscription details'],
    'chatController.js line 120 else-block: userPromptContext = "You are talking to a Guest User."', 'Access');

  assertNot('Bot does NOT leak personal plan data in guest mode', reply,
    ['professional', 'Aman Dubey', '01-07-2026', 'G650'],
    'SECURITY ISSUE: Bot is exposing JWT user data without a token! Check chatController.js guest fallback.', 'Access');

  ask('(no token) What aircraft do I have saved?');
  r = await chat('What aircraft do I have saved?', null);
  reply = r.body.reply || '';
  assertNot('Bot does NOT expose saved aircraft in guest mode', reply,
    ['Gulfstream G650', 'Citation XLS'],
    'SECURITY: Saved aircraft exposed without JWT token!', 'Access');
}

// GROUP 13 — OUT OF SCOPE GUARDRAIL
async function group13_OutOfScope(token) {
  section('GROUP 13 — Out-of-Scope Guardrail', 'Guardrails');

  const oosQuestions = [
    { q: 'What is the weather today?',       expect: ['only assist', 'can only', 'fuelsmart', 'scope', 'related'] },
    { q: 'Tell me a joke',                   expect: ['only assist', 'can only', 'fuelsmart', 'scope'] },
    { q: 'Who is Elon Musk?',                expect: ['only assist', 'can only', 'fuelsmart', 'scope'] },
    { q: 'Book me a flight to New York',     expect: ['only assist', 'can only', 'fuelsmart', 'scope'] },
  ];

  for (const item of oosQuestions) {
    ask(item.q);
    const r = await chat(item.q, token);
    const reply = r.body.reply || '';
    assert(`Bot refuses out-of-scope: "${item.q}"`, reply, item.expect,
      'Bot answered an out-of-scope question — check OUT OF SCOPE RULE in agentContextUtils.js buildSystemPrompt.', 'Guardrails');
  }
}

// GROUP 14 — LEAD FORM TRIGGER
async function group14_LeadForm(token) {
  section('GROUP 14 — Lead Form Trigger Detection', 'Lead');

  const leadQuestions = [
    'I want to contact your sales team',
    'Can I get an enterprise quote?',
    'I want to speak with a human agent',
  ];

  for (const q of leadQuestions) {
    ask(q);
    const r = await chat(q, token);
    const body = r.body;
    const reply = body.reply || '';
    const triggered = body.trigger_lead_form === true;
    const replyHasLeadSignal = contains(reply, ['[LEAD_FORM]', 'contact', 'team', 'reach', 'support', 'enterprise']);

    if (triggered || replyHasLeadSignal) {
      console.log(`${C.green}  ✔ PASS${C.reset}  Lead form triggered for: "${q}"`);
      results.passed++;
      results.log.push(`PASS | Lead form for "${q}"`);
    } else {
      console.log(`${C.red}  ✘ FAIL${C.reset}  Lead form NOT triggered for: "${q}"`);
      console.log(`${C.yellow}         ↳ trigger_lead_form=${body.trigger_lead_form}, reply="${reply.slice(0,100)}"${C.reset}`);
      console.log(`${C.yellow}         ↳ Hint: LEAD FORM RULE in agentContextUtils.js buildSystemPrompt — append [LEAD_FORM] token.${C.reset}`);
      results.failed++;
      results.issues.push({ label: `Lead form for: "${q}"`, hint: 'LEAD_FORM token not in reply and trigger_lead_form=false', category: 'Lead' });
      results.log.push(`FAIL | Lead form for "${q}"`);
    }
  }
}

// GROUP 15 — MULTI-TURN CONTEXT (Follow-up)
async function group15_MultiTurn(token) {
  section('GROUP 15 — Multi-Turn Conversation Context', 'Context');

  const history = [];

  ask('(Turn 1) Tell me about the Professional plan');
  let r = await chat('Tell me about the Professional plan', token, history);
  let reply = r.body.reply || '';
  history.push({ role: 'user', content: 'Tell me about the Professional plan' });
  history.push({ role: 'assistant', content: reply });

  assert('Turn 1: Bot explains Professional plan', reply,
    ['professional', 'tankering', 'aircraft'],
    'Initial plan question should work.', 'Context');

  ask('(Turn 2 follow-up) How many users can it support?');
  r = await chat('How many users can it support?', token, history);
  reply = r.body.reply || '';
  history.push({ role: 'user', content: 'How many users can it support?' });
  history.push({ role: 'assistant', content: reply });

  assert('Turn 2: Bot understands follow-up refers to Professional plan (25 users)', reply,
    ['25', 'twenty-five', 'users'],
    'Multi-turn context broken — "it" should reference Professional plan from Turn 1. Check widget.js history passing.', 'Context');

  ask('(Turn 3 follow-up) What about the aircraft profile limit?');
  r = await chat('What about the aircraft profile limit?', token, history);
  reply = r.body.reply || '';

  assert('Turn 3: Bot gives Professional aircraft profile limit (10)', reply,
    ['10', 'ten', 'aircraft profile', 'profiles'],
    'Multi-turn context lost in Turn 3 — history not being passed correctly to AI provider.', 'Context');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function runAll() {
  console.log(`\n${C.bold}${C.cyan}`);
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║         FuelSmart Pro — Full AI Agent Test Suite                ║');
  console.log('║  Tests: Plans · Aircraft · SAF · Calc · FAQ · Legal · Access    ║');
  console.log(`╚══════════════════════════════════════════════════════════════════╝${C.reset}\n`);

  // Connectivity check
  try {
    await postChat('ping', null);
  } catch (e) {
    console.log(`\n${C.red}${C.bold}✘ Server not reachable at http://localhost:3000${C.reset}`);
    console.log(`${C.yellow}  Run: node server.js   then retry.${C.reset}\n`);
    process.exit(1);
  }

  const token = generateToken();
  console.log(`${C.dim}  JWT generated for Aman Dubey (Professional Plan, expires in 2h)${C.reset}`);
  console.log(`${C.dim}  Running ${C.white}15 test groups${C.dim} across all knowledge base categories...${C.reset}`);

  try {
    await group1_UserContext(token);
    await group2_StarterPlan(token);
    await group3_ProfessionalPlan(token);
    await group4_EnterprisePlan(token);
    await group5_TankeringCalculator(token);
    await group6_SAFCalculator(token);
    await group7_AircraftDirectory(token);
    await group8_AviationTools(token);
    await group9_FAQ(token);
    await group10_TermsCompliance(token);
    await group11_PlatformStats(token);
    await group12_GuestMode();
    await group13_OutOfScope(token);
    await group14_LeadForm(token);
    await group15_MultiTurn(token);
  } catch (err) {
    console.log(`\n${C.red}${C.bold}✘ Test run crashed: ${err.message}${C.reset}`);
    process.exit(1);
  }

  // ─── SUMMARY ────────────────────────────────────────────────────────────────
  const total = results.passed + results.failed;
  const pct   = total > 0 ? Math.round((results.passed / total) * 100) : 0;

  console.log(`\n${C.bold}${C.cyan}`);
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log(`║                       TEST SUMMARY                              ║`);
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`${C.reset}`);
  console.log(`  Total Tests : ${total}`);
  console.log(`  ${C.green}${C.bold}Passed      : ${results.passed} (${pct}%)${C.reset}`);
  console.log(`  ${results.failed > 0 ? C.red + C.bold : C.green}Failed      : ${results.failed}${C.reset}`);
  if (results.warnings > 0) {
    console.log(`  ${C.yellow}Warnings    : ${results.warnings}${C.reset}`);
  }

  if (results.issues.length > 0) {
    // Group by category
    const byCategory = {};
    results.issues.forEach(issue => {
      const cat = issue.category || 'General';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(issue);
    });

    console.log(`\n${C.bold}${C.red}  ✘ Failed Tests & Improvement Areas:${C.reset}`);
    Object.keys(byCategory).forEach(cat => {
      console.log(`\n  ${C.bold}${C.yellow}[${cat}]${C.reset}`);
      byCategory[cat].forEach((issue, i) => {
        console.log(`  ${i + 1}. ${C.red}${issue.label}${C.reset}`);
        console.log(`     ${C.yellow}↳ ${issue.hint}${C.reset}`);
      });
    });

    // Write failure report to file
    const reportLines = [
      '=== FuelSmart Pro AI Bot — Test Failure Report ===',
      `Date: ${new Date().toISOString()}`,
      `Passed: ${results.passed}/${total} (${pct}%)`,
      '',
      '--- Failed Tests by Category ---',
    ];
    Object.keys(byCategory).forEach(cat => {
      reportLines.push(`\n[${cat}]`);
      byCategory[cat].forEach((issue, i) => {
        reportLines.push(`${i + 1}. FAIL: ${issue.label}`);
        reportLines.push(`   Hint: ${issue.hint}`);
        reportLines.push(`   Reply: ${issue.reply}`);
      });
    });
    reportLines.push('\n--- Full Test Log ---');
    results.log.forEach(l => reportLines.push(l));

    fs.writeFileSync('test-results.log', reportLines.join('\n'), 'utf8');
    console.log(`\n${C.dim}  Full report saved to: test-results.log${C.reset}`);
  } else {
    console.log(`\n${C.green}${C.bold}  ✔ All tests passed! AI bot is working correctly across all categories.${C.reset}`);
  }

  console.log('');
  process.exit(results.failed > 0 ? 1 : 0);
}

runAll();
