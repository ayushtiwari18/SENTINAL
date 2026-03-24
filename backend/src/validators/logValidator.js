const Joi = require('joi');

const ingestSchema = Joi.object({
  projectId: Joi.string().trim().required(),
  method: Joi.string()
    .valid('GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD')
    .required(),
  url: Joi.string().trim().required(),
  ip: Joi.string().trim().required(),
  queryParams:      Joi.object().default({}),
  body:             Joi.object().default({}),
  headers:          Joi.object().default({}),
  responseCode:     Joi.number().integer().min(100).max(599).allow(null).default(null),
  processingTimeMs: Joi.number().min(0).default(0)
});

module.exports = { ingestSchema };
