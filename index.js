(function() {
    "use strict";
    /* jshint indent: 4 */

    var	request = require('request'),
        async = module.parent.require('async'),
        winston = module.parent.require('winston'),
        S = module.parent.require('string'),
        meta = module.parent.require('./meta'),

        discogsRegex = /dc#\w+/gm,
        Embed = {},
        cache, appModule;

    var getDiscog = function(discogsKey, callback) {
        var discogNum = discogsKey.split('#')[1];
        winston.info('[discogs] Retrieving info: ' + discogNum);

        request.get({
            url: 'http://api.discogs.com/database/search?catno=' + discogNum + '&type=release&per_page=1',
            headers: {
                'User-Agent': '35hzMusicDiscogs/1.0 +http://35hz.co.uk'
            },
            dataType: 'json'
        }, function (err, response, body) {
            if (!err && response.statusCode === 200) {
                var albumData = JSON.parse(body).results[0];

                console.log(albumData);
                callback(null, {
                    uri: albumData.uri,
                    thumbnail: albumData.thumb,
                    catno: albumData.catno,
                    title: albumData.title,
                    style: Array.isArray(albumData.style) ? albumData.style[0] : albumData.style,
                    label: Array.isArray(albumData.label) ? albumData.label[0] : albumData.label,
                    year: albumData.year
                });
            } else {
                console.log(err, response);
            }
        });
    };

    Embed.init = function(app, middleware, controllers, callback) {
        function render(req, res, next) {
            res.render('partials/discog-block', {});
        }

        appModule = app;

        callback();
    };

    Embed.parse = function(raw, callback) {
        var discogsKeys = [],
            matches, cleanedText;

        cleanedText = S(raw).stripTags().s;
        matches = cleanedText.match(discogsRegex);

        if (matches && matches.length) {
            matches.forEach(function(match) {
                if (discogsKeys.indexOf(match) === -1) {
                    discogsKeys.push(match);
                }
            });
        }

        async.map(discogsKeys, function(discogsKey, next) {
            if (cache.has(discogsKey)) {
                next(null, cache.get(discogsKey));
            } else {
                getDiscog(discogsKey, function(err, discogsObj) {
                    if (err) {
                        return next(err);
                    }

                    cache.set(discogsKey, discogsObj);
                    next(err, discogsObj);
                });
            }
        }, function(err, discoginfo) {
            if (!err) {
                // Filter
                discoginfo = discoginfo.filter(function(issue) {
                    return issue;
                });

                appModule.render('partials/discog-block', {
                    discoginfo: discoginfo
                }, function(err, html) {
                    callback(null, raw += html);
                });
            } else {
                winston.warn('Encountered an error parsing discog embed code, not continuing');
                callback(null, raw);
            }
        });
    };

    // Initial setup
    cache = require('lru-cache')({
        maxAge: 1000*60*60*24,
        max: 100
    });

    module.exports = Embed;
})();