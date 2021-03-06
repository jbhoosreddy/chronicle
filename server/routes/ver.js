/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

var verJsonController = require('../controllers/ver');

module.exports = [{
  method: 'GET',
  path: '/ver.json',
  config: {
    handler: verJsonController.get,
    description: 'Displays the Git SHAs for the deployed server.',
    tags: ['ops']
  }
}];
