const fs = require('fs');
const path = require('path');

const filePath = path.resolve(process.cwd(), 'ai_knowledge_base_new.json');
const kb = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const CANCELLATION_REFUND_POLICY = 'Cancellation Policy: You may cancel your subscription at any time from your account dashboard under Account Settings > Subscription / Billing > Cancel Subscription. Your access remains active until the end of the current billing period. No additional charges occur after cancellation. Refund Policy: Annual Subscription - If an annual subscription is canceled during the active subscription term, the subscriber will receive a prorated refund for the unused remainder of the subscription period. Example: If a user purchases an annual subscription in January 2026 and cancels in May 2026, January through May (5 months) will be considered as used, and a prorated refund will be issued for the remaining 7 months (June through December). Refund amounts will be calculated based on the unused portion of the subscription term. Monthly Subscription - Monthly subscriptions may be canceled at any time. However, the subscription will remain active until the last day of the current billing month. No partial or prorated refunds will be provided for monthly subscriptions once payment has been processed.';

const SHARED_KEYWORDS = [
  'cancel', 'cancellation', 'refund', 'refund policy', 'annual refund',
  'monthly refund', 'prorated refund', 'billing', 'subscription cancel',
  'non-refundable', 'cancel subscription', 'downgrade', 'billing period'
];

const SHARED_SUBSCRIPTION_RULES = {
  monthly_refund_policy: 'No partial or prorated refunds after payment processing. Subscription remains active until last day of current billing month.',
  annual_refund_policy: 'Prorated refund issued for unused remainder of subscription period if canceled during active term.'
};

const starter = kb.find(function(e) { return e.id === 'starter-plan-secure-001'; });
if (starter) {
  starter.content = 'Starter Plan - Subscription, Cancellation & Refund Policy. Designed for independent pilots, contract crews, and small-scale operators. Pricing: $14.99/month or $179.88/year. Includes aviation tools, CORSIA SAF calculator, basic fuel tankering calculations, PDF exports, manual fuel price input, cost reporting exports, and standard cost-to-carry logic. ' + CANCELLATION_REFUND_POLICY;
  starter.metadata.keywords = ['starter plan'].concat(SHARED_KEYWORDS).concat(['$14.99', '$179.88']);
  starter.metadata.summary = 'Starter Plan ($14.99/month or $179.88/year): Cancel anytime from Account Settings. Monthly plan - no refund after payment. Annual plan - prorated refund for unused months if canceled during active term.';
  starter.metadata.subscription_rules = SHARED_SUBSCRIPTION_RULES;
  console.log('starter-plan-secure-001 updated');
}

const professional = kb.find(function(e) { return e.id === 'professional-plan-secure-001'; });
if (professional) {
  professional.content = 'Professional Plan - Subscription, Cancellation & Refund Policy. Designed for compact flight departments, aviation operators, and premium charter companies. Pricing: $189.00/month or $2,279.00/year. Includes advanced tankering optimization engine, alternate and reserve scenario modeling, unlimited calculations, up to 10 aircraft profiles, fleet configuration tools, and multi-user support (up to 25 users). ' + CANCELLATION_REFUND_POLICY;
  professional.metadata.keywords = ['professional plan'].concat(SHARED_KEYWORDS).concat(['$189.00', '$2279.00', '$2,279']);
  professional.metadata.summary = 'Professional Plan ($189.00/month or $2,279.00/year): Cancel anytime from Account Settings. Monthly plan - no refund after payment. Annual plan - prorated refund for unused months if canceled during active term.';
  professional.metadata.subscription_rules = SHARED_SUBSCRIPTION_RULES;
  console.log('professional-plan-secure-001 updated');
}

const enterprise = kb.find(function(e) { return e.id === 'enterprise-plan-secure-001'; });
if (enterprise) {
  enterprise.content = 'Enterprise Plan - Subscription, Cancellation & Refund Policy. Designed for enterprise flight departments, Part 91K programs, and Part 135 operators. Pricing: Pricing is provided on a custom quote basis and is determined by the administrator based on the selected services, operational requirements, and subscription scope. Includes enterprise fleet tools, live fuel price feeds, advanced aircraft management, enterprise licensing, unlimited users, unlimited aircraft models, and scalable multi-user operational support. Cancellation & Refund Policy: All cancellation requests are reviewed and managed manually by the administrator. Any approved refund or cancellation amount will be determined and processed by the admin based on the applicable subscription terms and usage period.';
  enterprise.metadata.keywords = [
    'enterprise plan', 'cancel', 'cancellation', 'refund', 'refund policy',
    'admin', 'administrator', 'custom quote', 'billing', 'subscription cancel',
    'manual review', 'cancel subscription', 'enterprise pricing'
  ];
  enterprise.metadata.summary = 'Enterprise Plan (Custom Quote pricing set by admin): All cancellation and refund requests are reviewed and managed manually by the administrator based on subscription terms and usage period.';
  enterprise.metadata.subscription_rules = {
    pricing_model: 'Custom quote determined by administrator based on selected services and operational requirements.',
    cancellation_policy: 'All cancellation requests are reviewed and managed manually by the administrator.',
    refund_policy: 'Any approved refund or cancellation amount will be determined and processed by the admin based on the applicable subscription terms and usage period.'
  };
  console.log('enterprise-plan-secure-001 updated');
}

fs.writeFileSync(filePath, JSON.stringify(kb, null, 2), 'utf8');

// Also update the Downloads file
const downloadsPath = 'C:/Users/PC/Downloads/ai_knowledge_base_updated_with_secure_plans.json';
fs.writeFileSync(downloadsPath, JSON.stringify(kb, null, 2), 'utf8');
console.log('Both files updated.');
