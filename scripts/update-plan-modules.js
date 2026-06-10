/**
 * update-plan-modules.js
 * Updates all plan module entries with comprehensive detail and adds missing enterprise module entries.
 */
const fs = require('fs');
const path = require('path');

const BACKEND_PATH = path.resolve(process.cwd(), 'ai_knowledge_base_new.json');
const DOWNLOADS_PATH = 'C:/Users/PC/Downloads/ai_knowledge_base_updated_with_secure_plans.json';

const kb = JSON.parse(fs.readFileSync(BACKEND_PATH, 'utf8'));

function upsert(entry) {
  const idx = kb.findIndex(function(e) { return e.id === entry.id; });
  if (idx >= 0) {
    kb[idx] = entry;
    console.log('Updated:', entry.id);
  } else {
    kb.push(entry);
    console.log('Added:', entry.id);
  }
}

// ─── SHARED TOOL CONTENT ─────────────────────────────────────────────────────

const AVIATION_TOOLS_CONTENT = 'Aviation Conversion Tools Module: Provides fast and accurate real-time aviation unit conversions for pilots, dispatchers, and flight operators. Supports instant calculations across distance, speed, altitude, vertical speed, temperature, pressure, weight, and fuel conversions. Includes aviation-specific fuel calculations for Jet A1, Jet B, Avgas 100LL, and custom fuel types with automatic fuel density support and live conversion updates. Key features: Real-time unit conversion, dynamic aviation calculations, fuel density and fuel quantity conversions, aviation quick presets, printable operational summaries, aviation reference tables, quick reset functionality. Predefined aviation presets include: navigation legs (100 NM), cruise speeds (250 KT), flight levels (FL350), standard pressure (29.92 inHg), and fuel load examples (5000 lbs). Reference tables include ISA temperature references, pressure standards, fuel density values, and common distance and speed conversions. Conversion categories: Distance (NM, SM, KM, M), Speed (KT, MPH, KM/H, M/S), Altitude (feet to meters, Flight Level FL), Vertical Speed (FPM to M/S), Temperature (Celsius, Fahrenheit, Kelvin), Pressure (hPa, inHg, psi, mmHg), Weight (Pounds, Kilograms, Metric Tons, US Short Tons).';

const CORSIA_SAF_CONTENT = 'CORSIA SAF Fuel Calculator Module: Helps aviation operators estimate carbon emissions reductions achieved through Sustainable Aviation Fuel (SAF) in accordance with ICAO CORSIA compliance standards. Supports real-time SAF blend analysis, lifecycle emissions calculations (LCEF), fuel eligibility validation, and operational emissions reporting. Users configure total blended fuel, neat SAF quantity, blend percentage, fuel density, lifecycle emissions values. Supported fuel types: Jet-A, Jet-A1, TS-1, No. 3 Jet Fuel. Key features: SAF emissions reduction calculations, lifecycle emissions (LCEF) analysis, ICAO CORSIA compliance validation, fuel blend and eligibility analysis, emissions reduction reporting, SAF cost and sustainability analysis, real-time operational calculations, printable compliance summaries. Detailed operational outputs: emissions reduction percentages, eligible SAF fuel mass, lifecycle emission values (LCEF), combustion CO2 analysis, fuel conversion factors (FCF), estimated SAF volume, cost-per-reduced-tonne analysis, neat eligible fuel mass, reduction factor percentage, eligibility threshold validation, compliance analysis messages, LC baseline values. Compliant with: ICAO CORSIA Eligible Fuels guidance, ICAO Lifecycle Emissions Methodology, sustainability criteria, Annex 16 Volume IV standards, ICAO CO2 estimation and reporting frameworks.';

const FUEL_TANKERING_PART1_CONTENT = 'Fuel Tankering App Module - Inputs and Configuration: Professional aviation fuel planning and cost optimization system performing what-if analysis on whether to purchase fuel at destination, tanker from departure, or use partial tankering. Section 1 - Prices and Settings: Input baseline operational variables including Departure and Destination fuel prices (cost per gallon at both airports), Fuel Density (default 6.75 lbs/gal for Jet-A, converts weight used in flight planning to volume used for billing), Ramp Fee and Waiver Threshold (airports charge landing/ramp fee waived if minimum gallons purchased), Cost-to-Carry percentage per hour (efficiency penalty for carrying extra weight, typically 3% extra fuel burned per hour), and Flight Time (duration of outbound leg). Section 2 - Leg 1 Outbound: Calculates baseline fuel needed for the trip. Tallies planned Flight Fuel and expected Fuel at Landing to give baseline outbound cost before optional tankering. Section 3 - Leg 2 Next Segment: Defines fuel needs after landing at destination. Calculates: Additional Need = (Fuel Required + Reserves) minus Starting Fuel. If positive, fuel must be acquired by tanking from origin or buying at destination. SAF Tracking and Record SAF Uplift: Toggle allows operators to log SAF usage for corporate sustainability metrics or CORSIA compliance tracking.';

const FUEL_TANKERING_PART2_CONTENT = 'Fuel Tankering App Module - Results, Options and Fuel Conversion: The system compares three financial strategies to identify the most cost-effective option. Option A - Buy at Destination: Carry exactly what is needed for Leg 1. Upon arrival buy 100% of Additional Need at destination price. Calculation: Cost = (Gallons Needed x Destination Price) + Ramp Fee if not waived. Option B - Tanker from Departure: Buy all fuel needed for Leg 2 at departure airport (cheaper price), fly Leg 1 heavier. Calculation: Cost = (Gallons Carried x Departure Price) + Cost-to-Carry Penalty + Destination Ramp Fee. Cost-to-Carry adds a fee equal to the set rate (e.g., 3%) per hour of flight time on the value of the extra weight. Option C - Partial Tanker plus Minimum at Destination: Hybrid strategy. Tanker some fuel from departure but buy just enough at destination to hit the Waiver Threshold to avoid the ramp fee. Calculation optimizes whether buying the minimum waiver gallons at higher destination price is cheaper than paying a flat ramp fee. Best Option Winner: App compares whole-trip totals of Options A, B, and C and highlights the lowest cost. Savings vs next best shows exact dollar savings by choosing the winning strategy. Fuel Conversion Tool: Aviation fuel is measured in different units - pilots calculate weight (pounds/kilograms) for aircraft performance while fuel trucks pump by volume (gallons/liters). Uses the Fuel Density setting to instantly convert values across pounds, US gallons, liters, and kilograms for operational planning.';

// ─── STARTER PLAN MODULE UPDATES ─────────────────────────────────────────────

upsert({
  id: 'starter-module-001',
  content: 'Starter Plan - Dashboard and Platform Overview. The Starter Plan provides access to essential operational tools for fuel planning, aviation calculations, SAF emissions analysis, aircraft operational support, and secure account management. Dashboard displays: User active plan name, Plan start date and end date, Billing cycle information, Subscription validity dates, Selected aircraft information (example: Beechcraft Aircraft Company - King Air B200), Operational module access, Subscription management tools. Modules available in Starter Plan: Dashboard, Profile, Change Password, Aviation Conversion Tools, CORSIA SAF Fuel Calculator, Fuel Tankering App, PlaneCare Module. Starter Plan Restrictions: Single-user access only, No fleet dashboard, No integrations or API access, 1 saved aircraft profile.',
  metadata: {
    plan_name: 'Starter Plan',
    plan_slug: 'starter',
    plan_visibility: 'jwt_authenticated_only',
    content_type: 'plan_module',
    keywords: ['starter plan', 'dashboard', 'active plan', 'plan start date', 'plan end date', 'subscription dates', 'modules', 'billing cycle'],
    summary: 'Starter Plan dashboard shows user active plan, plan start and end dates, billing cycle, selected aircraft. Available modules: Dashboard, Profile, Change Password, Aviation Tools, CORSIA SAF, Fuel Tankering App.'
  }
});

upsert({
  id: 'starter-module-002',
  content: 'Starter Plan - Profile Management and Change Password Modules. Profile Management: Users can update and manage their profile information including Full Name, Email Address, Company / Organization, and Phone Number. Change Password: Users can update their existing password by entering a new secure password and confirming the change. Security features include existing password verification, secure password encryption, and instant password updates. Manage Devices Module: Starter Plan users are allowed 1 Desktop Device and 1 Mobile Device. Features include Active Device Monitoring (view active devices, browser information, last active timestamp), Rename Device (example: Office Laptop, Flight iPad), and Revoke Access (remotely remove device access if unknown device detected, public computer used, or device is lost). When revoked, device is logged out immediately. Security features: Active session monitoring, device authorization management, remote logout functionality, unauthorized access protection.',
  metadata: {
    plan_name: 'Starter Plan',
    plan_slug: 'starter',
    plan_visibility: 'jwt_authenticated_only',
    content_type: 'plan_module',
    keywords: ['starter plan', 'profile', 'change password', 'full name', 'email address', 'company', 'phone number', 'manage devices', 'update profile'],
    summary: 'Starter Plan Profile: update Full Name, Email Address, Company/Organization, Phone Number. Change Password module available. Manage Devices: 1 desktop + 1 mobile allowed.'
  }
});

upsert({
  id: 'starter-module-003',
  content: 'Starter Plan - ' + AVIATION_TOOLS_CONTENT,
  metadata: {
    plan_name: 'Starter Plan',
    plan_slug: 'starter',
    plan_visibility: 'jwt_authenticated_only',
    content_type: 'plan_module',
    keywords: ['starter plan', 'aviation tools', 'conversion', 'distance', 'speed', 'altitude', 'temperature', 'pressure', 'fuel density', 'unit conversion', 'aviation calculator'],
    summary: 'Starter Plan Aviation Conversion Tools: real-time unit conversion for distance, speed, altitude, temperature, pressure, weight, fuel. Supports Jet A1, Jet B, Avgas. Includes presets, reference tables, printable summaries.'
  }
});

upsert({
  id: 'starter-module-004',
  content: 'Starter Plan - ' + CORSIA_SAF_CONTENT,
  metadata: {
    plan_name: 'Starter Plan',
    plan_slug: 'starter',
    plan_visibility: 'jwt_authenticated_only',
    content_type: 'plan_module',
    keywords: ['starter plan', 'corsia', 'saf', 'sustainable aviation fuel', 'emissions', 'lcef', 'icao', 'carbon', 'co2', 'compliance', 'fuel blend'],
    summary: 'Starter Plan CORSIA SAF Calculator: estimates SAF carbon emissions reductions per ICAO CORSIA standards. Supports Jet-A, Jet-A1, TS-1, No. 3 Jet Fuel. Outputs LCEF, CO2 reduction, SAF cost analysis.'
  }
});

upsert({
  id: 'starter-module-005',
  content: 'Starter Plan - ' + FUEL_TANKERING_PART1_CONTENT,
  metadata: {
    plan_name: 'Starter Plan',
    plan_slug: 'starter',
    plan_visibility: 'jwt_authenticated_only',
    content_type: 'plan_module',
    keywords: ['starter plan', 'fuel tankering', 'fuel planning', 'cost-to-carry', 'departure price', 'destination price', 'ramp fee', 'leg 1', 'leg 2', 'saf tracking'],
    summary: 'Starter Plan Fuel Tankering App inputs: departure/destination prices, fuel density, ramp fee, cost-to-carry %, flight time, Leg 1 outbound, Leg 2 next segment, SAF tracking.'
  }
});

upsert({
  id: 'starter-module-006',
  content: 'Starter Plan - ' + FUEL_TANKERING_PART2_CONTENT,
  metadata: {
    plan_name: 'Starter Plan',
    plan_slug: 'starter',
    plan_visibility: 'jwt_authenticated_only',
    content_type: 'plan_module',
    keywords: ['starter plan', 'fuel tankering', 'option a', 'option b', 'option c', 'buy at destination', 'tanker from departure', 'partial tankering', 'best option', 'fuel conversion', 'savings'],
    summary: 'Starter Plan Fuel Tankering results: compares Option A (buy at destination), Option B (tanker from departure), Option C (partial tankering). Highlights best option with dollar savings. Fuel conversion between lbs, gallons, liters, kg.'
  }
});

// ─── PROFESSIONAL PLAN MODULE UPDATES ────────────────────────────────────────

upsert({
  id: 'professional-module-001',
  content: 'Professional Plan - Dashboard and Platform Overview. Designed for compact flight departments, aviation operators, and premium charter companies. Dashboard displays: User active plan name, Plan start date and end date, Billing cycle information, Subscription validity dates, Selected aircraft information, Operational module access, Subscription management tools, Advanced operational visibility, Fleet configuration visibility. Modules available in Professional Plan: Dashboard, Profile, Change Password, Aviation Conversion Tools, CORSIA SAF Fuel Calculator, Fuel Tankering App, PlaneCare Module. Professional Plan Support: Save up to 10 aircraft profiles, support for up to 10 aircraft models, multi-aircraft operational support, advanced fuel planning access, fleet configuration tools, unlimited calculations, up to 25 users per company. Professional Plan Limitations: Maximum 25 users per company, No API access, No dispatch dashboard, Service activation may take up to 24 hours.',
  metadata: {
    plan_name: 'Professional Plan',
    plan_slug: 'professional',
    plan_visibility: 'jwt_authenticated_only',
    content_type: 'plan_module',
    keywords: ['professional plan', 'dashboard', 'active plan', 'plan start date', 'plan end date', 'subscription dates', 'modules', 'billing cycle', 'fleet', '10 aircraft'],
    summary: 'Professional Plan dashboard shows user active plan, plan start and end dates, billing cycle, fleet visibility. Up to 10 aircraft profiles, 25 users. Available modules: Dashboard, Profile, Change Password, Aviation Tools, CORSIA SAF, Fuel Tankering App.'
  }
});

upsert({
  id: 'professional-module-002',
  content: 'Professional Plan - Profile Management and Change Password Modules. Profile Management: Users can update and manage their profile information including Full Name, Email Address, Company / Organization, and Phone Number. Change Password: Users can update their existing password securely. Security features include existing password verification, secure password encryption, and instant password updates. Manage Devices Module: Professional Plan users are allowed 1 Desktop Device per user and 1 Mobile Device per user. Features include Active Device Monitoring (active desktop and mobile devices, browser information, last active timestamp), Rename Device (example: Office Laptop, Flight iPad, Personal Desktop), and Revoke Access (remotely remove device access if unknown device is detected, public computer was used, or device is lost or inactive). Once revoked, device is logged out immediately. Security features: Active session monitoring, device authorization management, remote logout functionality, unauthorized access protection.',
  metadata: {
    plan_name: 'Professional Plan',
    plan_slug: 'professional',
    plan_visibility: 'jwt_authenticated_only',
    content_type: 'plan_module',
    keywords: ['professional plan', 'profile', 'change password', 'full name', 'email address', 'company', 'phone number', 'manage devices', 'update profile'],
    summary: 'Professional Plan Profile: update Full Name, Email Address, Company/Organization, Phone Number. Change Password available. Manage Devices: 1 desktop + 1 mobile per user.'
  }
});

upsert({
  id: 'professional-module-003',
  content: 'Professional Plan - ' + AVIATION_TOOLS_CONTENT,
  metadata: {
    plan_name: 'Professional Plan',
    plan_slug: 'professional',
    plan_visibility: 'jwt_authenticated_only',
    content_type: 'plan_module',
    keywords: ['professional plan', 'aviation tools', 'conversion', 'distance', 'speed', 'altitude', 'temperature', 'pressure', 'fuel density', 'unit conversion', 'aviation calculator'],
    summary: 'Professional Plan Aviation Conversion Tools: real-time unit conversion for distance, speed, altitude, temperature, pressure, weight, fuel. Supports Jet A1, Jet B, Avgas. Includes presets, reference tables, printable summaries.'
  }
});

upsert({
  id: 'professional-module-004',
  content: 'Professional Plan - ' + CORSIA_SAF_CONTENT + ' The calculations and fuel planning data are dynamically generated based on the aircraft profile currently selected by the user. All available flight plans, fuel configurations, and operational calculations belong to the selected aircraft and the user saved planning records.',
  metadata: {
    plan_name: 'Professional Plan',
    plan_slug: 'professional',
    plan_visibility: 'jwt_authenticated_only',
    content_type: 'plan_module',
    keywords: ['professional plan', 'corsia', 'saf', 'sustainable aviation fuel', 'emissions', 'lcef', 'icao', 'carbon', 'co2', 'compliance', 'fuel blend', 'dynamic'],
    summary: 'Professional Plan CORSIA SAF Calculator: estimates SAF carbon emissions reductions per ICAO CORSIA standards. Data dynamically loaded per selected aircraft profile.'
  }
});

upsert({
  id: 'professional-module-005',
  content: 'Professional Plan - ' + FUEL_TANKERING_PART1_CONTENT + ' Note: The calculations and fuel planning data displayed are dynamically generated based on the aircraft profile currently selected by the user. All available flight plans, fuel configurations, and operational calculations shown belong to the selected aircraft and the user saved planning records. Professional Plan additional features: Tankering optimization engine, Alternate and reserve scenario modeling, Advanced operational visibility, Advanced cost reporting exports, Fleet configuration tools, Unlimited calculations, Save up to 10 aircraft profiles.',
  metadata: {
    plan_name: 'Professional Plan',
    plan_slug: 'professional',
    plan_visibility: 'jwt_authenticated_only',
    content_type: 'plan_module',
    keywords: ['professional plan', 'fuel tankering', 'fuel planning', 'cost-to-carry', 'departure price', 'destination price', 'ramp fee', 'leg 1', 'leg 2', 'saf tracking', 'optimization', 'dynamic'],
    summary: 'Professional Plan Fuel Tankering App: same inputs as Starter plus tankering optimization engine, alternate/reserve scenario modeling. Data dynamically loaded per aircraft profile.'
  }
});

upsert({
  id: 'professional-module-006',
  content: 'Professional Plan - ' + FUEL_TANKERING_PART2_CONTENT + ' Professional Plan advanced exports: Export advanced fuel planning reports, advanced cost reporting summaries, print operational summaries, generate accounting reports, store flight documentation. PlaneCare Module supports aircraft operational and maintenance workflows including maintenance workflow assistance, inspection tools, and engineering operational support.',
  metadata: {
    plan_name: 'Professional Plan',
    plan_slug: 'professional',
    plan_visibility: 'jwt_authenticated_only',
    content_type: 'plan_module',
    keywords: ['professional plan', 'fuel tankering', 'option a', 'option b', 'option c', 'buy at destination', 'tanker from departure', 'partial tankering', 'best option', 'fuel conversion', 'savings'],
    summary: 'Professional Plan Fuel Tankering results: Options A/B/C comparison, best option with savings. Advanced cost reporting exports. Fuel conversion tool.'
  }
});

// ─── ENTERPRISE PLAN MODULE ENTRIES (ALL NEW) ─────────────────────────────────

upsert({
  id: 'enterprise-module-001',
  content: 'Enterprise Plan - Dashboard and Platform Overview. Designed for enterprise flight departments, Part 91K programs, and Part 135 operators. Dashboard displays: User active plan name, Plan start date and end date, Billing cycle information, Subscription validity dates, Selected aircraft information, Operational module access, Subscription management tools, Advanced operational visibility, Enterprise fleet configuration visibility. Modules available in Enterprise Plan: Dashboard, Profile, Change Password, Aviation Conversion Tools, CORSIA SAF Fuel Calculator, Fuel Tankering App, PlaneCare Module. Enterprise Plan includes: Everything in Professional Plan plus Live fuel price feeds (API or CSV upload), Enterprise-scale fleet configuration, Advanced tankering optimization, Unlimited aircraft models, Unlimited users (same company), Enterprise-grade licensing, Scalable deployment environments, Dedicated enterprise support, Alternate and reserve scenario modeling. Enterprise Plan features: Saved aircraft profiles up to 50, Access on 2 devices per user (mobile + desktop), Unlimited users same company. Service activation may take up to 24 hours.',
  metadata: {
    plan_name: 'Enterprise Plan',
    plan_slug: 'enterprise',
    plan_visibility: 'jwt_authenticated_only',
    content_type: 'plan_module',
    keywords: ['enterprise plan', 'dashboard', 'active plan', 'plan start date', 'plan end date', 'subscription dates', 'modules', 'billing cycle', 'unlimited users', 'unlimited aircraft', 'fleet'],
    summary: 'Enterprise Plan dashboard shows user active plan, plan start and end dates, billing cycle, enterprise fleet visibility. Unlimited users and aircraft. Available modules: Dashboard, Profile, Change Password, Aviation Tools, CORSIA SAF, Fuel Tankering App.'
  }
});

upsert({
  id: 'enterprise-module-002',
  content: 'Enterprise Plan - Profile Management and Change Password Modules. Profile Management: Users can update and manage their profile information including Full Name, Email Address, Company / Organization, and Phone Number. Change Password: Users can update their existing password securely. Security features include existing password verification, secure password encryption, and instant password updates. Manage Devices Module: Enterprise Plan users are allowed 1 Desktop Device per user and 1 Mobile Device per user. Features include Active Device Monitoring (active desktop and mobile devices, browser information, last active timestamp), Rename Device, and Revoke Access (remotely remove device access if unknown device is detected, public computer was used, or device is lost or inactive). Once revoked, device is logged out immediately. Security features: Active session monitoring, device authorization management, remote logout functionality, unauthorized access protection.',
  metadata: {
    plan_name: 'Enterprise Plan',
    plan_slug: 'enterprise',
    plan_visibility: 'jwt_authenticated_only',
    content_type: 'plan_module',
    keywords: ['enterprise plan', 'profile', 'change password', 'full name', 'email address', 'company', 'phone number', 'manage devices', 'update profile'],
    summary: 'Enterprise Plan Profile: update Full Name, Email Address, Company/Organization, Phone Number. Change Password available. Manage Devices: 1 desktop + 1 mobile per user.'
  }
});

upsert({
  id: 'enterprise-module-003',
  content: 'Enterprise Plan - ' + AVIATION_TOOLS_CONTENT,
  metadata: {
    plan_name: 'Enterprise Plan',
    plan_slug: 'enterprise',
    plan_visibility: 'jwt_authenticated_only',
    content_type: 'plan_module',
    keywords: ['enterprise plan', 'aviation tools', 'conversion', 'distance', 'speed', 'altitude', 'temperature', 'pressure', 'fuel density', 'unit conversion', 'aviation calculator'],
    summary: 'Enterprise Plan Aviation Conversion Tools: real-time unit conversion for distance, speed, altitude, temperature, pressure, weight, fuel. Supports Jet A1, Jet B, Avgas. Includes presets, reference tables, printable summaries.'
  }
});

upsert({
  id: 'enterprise-module-004',
  content: 'Enterprise Plan - ' + CORSIA_SAF_CONTENT + ' The calculations and fuel planning data are dynamically generated based on the aircraft profile currently selected by the user. All available flight plans, fuel configurations, and operational calculations belong to the selected aircraft and the user saved planning records.',
  metadata: {
    plan_name: 'Enterprise Plan',
    plan_slug: 'enterprise',
    plan_visibility: 'jwt_authenticated_only',
    content_type: 'plan_module',
    keywords: ['enterprise plan', 'corsia', 'saf', 'sustainable aviation fuel', 'emissions', 'lcef', 'icao', 'carbon', 'co2', 'compliance', 'fuel blend', 'dynamic'],
    summary: 'Enterprise Plan CORSIA SAF Calculator: estimates SAF carbon emissions reductions per ICAO CORSIA standards. Data dynamically loaded per selected aircraft profile.'
  }
});

upsert({
  id: 'enterprise-module-005',
  content: 'Enterprise Plan - ' + FUEL_TANKERING_PART1_CONTENT + ' Note: The calculations and fuel planning data displayed are dynamically generated based on the aircraft profile currently selected by the user. All available flight plans, fuel configurations, and operational calculations shown belong to the selected aircraft and the user saved planning records. Enterprise Plan additional features: Live fuel price feeds via API or CSV upload, Enterprise-scale fleet configuration, Advanced tankering optimization, Unlimited calculations, Save up to 50 aircraft profiles, Unlimited aircraft models, Alternate and reserve scenario modeling.',
  metadata: {
    plan_name: 'Enterprise Plan',
    plan_slug: 'enterprise',
    plan_visibility: 'jwt_authenticated_only',
    content_type: 'plan_module',
    keywords: ['enterprise plan', 'fuel tankering', 'fuel planning', 'cost-to-carry', 'departure price', 'destination price', 'ramp fee', 'leg 1', 'leg 2', 'saf tracking', 'live fuel price', 'optimization', 'dynamic'],
    summary: 'Enterprise Plan Fuel Tankering App: full inputs and configuration with live fuel price feeds, unlimited aircraft, 50 aircraft profiles. Data dynamically loaded per aircraft profile.'
  }
});

upsert({
  id: 'enterprise-module-006',
  content: 'Enterprise Plan - ' + FUEL_TANKERING_PART2_CONTENT + ' Enterprise Plan advanced exports: Export advanced fuel planning reports, advanced cost reporting summaries, print operational summaries, generate accounting reports, store flight documentation, enterprise-scale operational analytics. PlaneCare Module supports aircraft operational and maintenance workflows including maintenance workflow assistance, inspection tools, and engineering operational support. Enterprise Plan Access Summary: Aviation conversion tools, fuel tankering calculations, SAF emissions analysis, aircraft operational support, aviation planning utilities, secure device management, enterprise fleet configuration, live fuel price feeds, multi-aircraft operational support, advanced tankering optimization, unlimited users and aircraft models.',
  metadata: {
    plan_name: 'Enterprise Plan',
    plan_slug: 'enterprise',
    plan_visibility: 'jwt_authenticated_only',
    content_type: 'plan_module',
    keywords: ['enterprise plan', 'fuel tankering', 'option a', 'option b', 'option c', 'buy at destination', 'tanker from departure', 'partial tankering', 'best option', 'fuel conversion', 'savings', 'enterprise analytics'],
    summary: 'Enterprise Plan Fuel Tankering results: Options A/B/C comparison, best option with savings. Enterprise-scale reporting and analytics. Unlimited users and aircraft models.'
  }
});

// ─── SAVE FILES ───────────────────────────────────────────────────────────────

fs.writeFileSync(BACKEND_PATH, JSON.stringify(kb, null, 2), 'utf8');
fs.writeFileSync(DOWNLOADS_PATH, JSON.stringify(kb, null, 2), 'utf8');
console.log('\nTotal entries:', kb.length);
console.log('Both files saved.');
