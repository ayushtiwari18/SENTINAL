const Joi = require('joi');

const ATTACK_TYPES = [
  'sqli','xss','traversal','command_injection',
  'ssrf','lfi_rfi','brute_force','hpp','xxe','webshell','unknown'
];

const reportSchema = Joi.object({
  requestId:   Joi.string().hex().length(24).required(),
  ip:          Joi.string().trim().required(),
  attackType:  Joi.string().valid(...ATTACK_TYPES).required(),
  severity:    Joi.string().valid('low','medium','high','critical').required(),
  status:      Joi.string().valid('attempt','successful','blocked').required(),
  detectedBy:  Joi.string().valid('rule','ml','both').required(),
  confidence:  Joi.number().min(0).max(1).default(1.0),
  payload:              Joi.string().allow('').default(''),
  explanation:          Joi.string().allow('').default(''),
  mitigationSuggestion: Joi.string().allow('').default(''),
  responseCode: Joi.number().integer().allow(null).default(null)
});

module.exports = { reportSchema };
