'use strict';

/**
 * Reusable Joi validation middleware factory.
 * Validates req.body, req.query, or req.params against the provided Joi schema.
 *
 * @param {import('joi').ObjectSchema} schema - Joi validation schema
 * @param {'body'|'query'|'params'} [property='body'] - Request property to validate
 */
function validate(schema, property = 'body') {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/['"]/g, ''),
      }));

      const err = new Error(`Validation failed: ${details.map((d) => d.message).join('; ')}`);
      err.status = 400;
      err.details = details;
      return next(err);
    }

    // Express 5 makes req.query a getter; assign validated values carefully
    if (property === 'query') {
      req.validatedQuery = value;
    } else if (property === 'params') {
      req.validatedParams = value;
    } else {
      req[property] = value;
    }

    return next();
  };
}

module.exports = validate;
