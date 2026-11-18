/* Consent-gated measurement for Front Desk pages (issue #90).
 * Default is no tracking: nothing is recorded until a visitor grants consent.
 * This module makes no network requests of its own. Events only go to window.dataLayer,
 * and only after consent. No provider script is installed, so nothing leaves the browser.
 * Events carry an upgrade id from assets/upgrade-catalogue.json and nothing else. */
(function (root) {
  'use strict';

  var KEY = 'tz-analytics-consent';
  var EVENTS = { frontdesk_view: true, upgrade_compare: true, upgrade_enquiry: true };
  var UPGRADE_IDS = ['assistant', 'agent-team', 'supercharged', 'scheduled', 'sorted', 'skilled'];

  function readConsent(storage) {
    try {
      var value = storage.getItem(KEY);
      return value === 'granted' || value === 'denied' ? value : 'unset';
    } catch (e) {
      return 'unset';
    }
  }

  // Keeps only the upgrade id. Anything else (selections lists, free text, emails) is dropped.
  function sanitise(props) {
    var out = {};
    if (props && UPGRADE_IDS.indexOf(props.upgrade) !== -1) out.upgrade = props.upgrade;
    return out;
  }

  function createAnalytics(env) {
    var storage = env.storage;
    var consent = readConsent(storage);

    return {
      consent: function () {
        return consent;
      },
      setConsent: function (value) {
        if (value !== 'granted' && value !== 'denied') return false;
        consent = value;
        try {
          storage.setItem(KEY, value);
        } catch (e) {
          // Storage may be blocked. Consent then lasts for this page only.
        }
        return true;
      },
      track: function (name, props) {
        if (consent !== 'granted') return false;
        if (!EVENTS[name]) return false;
        var layer = env.dataLayer || (env.dataLayer = []);
        var payload = sanitise(props);
        payload.event = name;
        layer.push(payload);
        return true;
      }
    };
  }

  var api = { createAnalytics: createAnalytics, sanitise: sanitise, EVENTS: EVENTS, KEY: KEY };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else if (root && root.localStorage) {
    root.dataLayer = root.dataLayer || [];
    root.TZAnalytics = createAnalytics({ storage: root.localStorage, dataLayer: root.dataLayer });
  }
})(typeof window !== 'undefined' ? window : undefined);
