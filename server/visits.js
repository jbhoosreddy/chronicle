/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

var Joi = require('joi');
var Boom = require('boom');
var uuid = require('uuid');
var db = require('./db/db');
var log = require('./logger')('server.visits');
var config = require('./config');

// TODO: add additional metadata fields to the visit datatype
// TODO: normalize URLs
// TODO: visits pagination

var routes = [{
  method: 'GET',
  path: '/v1/visits',
  config: {
    auth: 'session',
    validate: {
      query: {
        count: Joi.number().integer().min(1).max(100).default(25),
        visitId: Joi.string().guid()
      }
    },
    handler: function (request, reply) {
      var fxaId = request.auth.credentials;
      var visitId = request.query.visitId;

      function onResults(err, results) {
        if (err) {
          log.warn(err);
          return reply(Boom.create(500)); // TODO distinguish between 4xx and 5xx?
        }
        reply(results);
      }

      // if there's a visitId provided, then we want a specific page
      if (visitId) {
        db.getPaginatedVisits(fxaId, visitId, request.query.count, onResults);
      } else {
        db.getVisits(fxaId, request.query.count, onResults);
      }
    }
  }
}, {
  method: 'GET',
  path: '/v1/visits/{visitId}',
  config: {
    auth: 'session',
    validate: {
      params: {
        visitId: Joi.string().guid().required()
      }
    },
    handler: function (request, reply) {
      var fxaId = request.auth.credentials;
      db.getVisit(fxaId, request.params.visitId, function(err, result) {
        if (err) {
          log.warn(err);
          return reply(Boom.create(500));
        }
        if (!result) {
          return reply(Boom.create(404, 'Visit not found'));
        } else {
          reply(result);
        }
      });
    }
  }
}, {
  method: 'POST',
  path: '/v1/visits',
  config: {
    auth: 'session',
    validate: {
      payload: {
        url: Joi.string().required(),
        title: Joi.string().max(128).required(),
        visitedAt: Joi.date().iso().required(),
        // client can optionally provide uuid
        visitId: Joi.string().guid()
      }
    },
    handler: function(request, reply) {
      var p = request.payload;
      var fxaId = request.auth.credentials;
      var visitId = p.visitId || uuid.v4();
      db.createVisit(fxaId, visitId, p.visitedAt, p.url, p.title, function (err, visit) {
        if (err) {
          log.warn(err);
          return reply(Boom.create(500)); // whatever, generic error for now
        }
        // response should be the visit with the id inserted
        reply({id: visitId, visitedAt: p.visitedAt, url: p.url, title: p.title});
      });
    }
  }
}, {
  method: 'PUT',
  path: '/v1/visits/{visitId}',
  config: {
    auth: 'session',
    validate: {
      // all fields are required, keep life simple for the DB
      payload: {
        url: Joi.string().required(),
        title: Joi.string().max(128).required(),
        visitedAt: Joi.date().iso().required()
      },
      params: {
        visitId: Joi.string().guid().required()
      }
    },
    handler: function(request, reply) {
      var fxaId = request.auth.credentials;
      var visitId = request.params.visitId;
      var p = request.payload;
      db.updateVisit(fxaId, visitId, p.visitedAt, p.url, p.title, function(err, result) {
        if (err) {
          log.warn(err);
          return reply(Boom.create(500));
        }
        if (result.affectedRows !== 1) {
          // yikes, record not found?
          log.warn('db.updateVisit returned zero changed rows');
          return reply(Boom.create(404));
        }
        // return the visit so backbone can update the model
        db.getVisit(fxaId, visitId, function(err, result) {
          if (err) {
            log.warn(err);
            return reply(Boom.create(500));
          }
          // unlike GET visit above, we assume 500 would have hit before you 
          // discover there's actually no record with that ID
          reply(result);
        });
      });
    }
  }
}, {
  method: 'DELETE',
  path: '/v1/visits/{visitId}',
  config: {
    auth: 'session',
    validate: {
      params: {
        visitId: Joi.string().guid().required()
      }
    },
    handler: function (request, reply) {
      var fxaId = request.auth.credentials;
      db.deleteVisit(fxaId, request.params.visitId, function(err) {
        if (err) {
          log.warn(err);
          return reply(Boom.create(500));
        }
        reply();
      });
    }
  }
}];

module.exports = routes;
