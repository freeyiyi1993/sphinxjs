'use strict';
var gulp = require('gulp');
var filter = require('gulp-filter');
var browserSync = require('browser-sync').create();
var plugin = require('./src/plugin.js');
var buildGlob = require('./src/glob.js');
var config = require('./src/config.js');
var util = require('./src/util.js');
// 任务锁，避免多次release
var lock = false;
var queue = [];

function execute(env) {
    var dest,
        cwd;

    function watch(root) {
        var safePathReg = /[\\\/][_\-.\s\w]+$/i,
            timer;

        function listener(type) {
            return function (path) {
                function cb() {
                    lock = true;
                    clearTimeout(timer);
                    timer = setTimeout(function () {
                        var extname = util.extname(path);

                        if (!util.isCss(extname)) {
                            gulp.series('release', browserSync.reload)();
                        } else {
                            gulp.series('release')();
                        }
                    }, 500);
                }
                if (safePathReg.test(path)) {
                    if (lock) {
                        if (queue.length >= 3) {
                            queue.shift();
                        }
                        queue.push(cb);
                    } else {
                        cb();
                    }
                }
            };
        }
        require('chokidar')
            .watch(root, {
                ignored: [
                    /[\/\\](\.)/,
                    require('path').join(root, dest)
                ],
                ignoreInitial: true
            })
            .on('change', listener('change'))
            .on('unlink', listener('unlink'))
            .on('add', listener('add'));
    }

    gulp.task('release', gulp.series([
        function (cb) {
            config.load(env.configPath);
            cwd = config.get('cwd');
            dest = config.get('dest');
            buildGlob(cwd, dest);
            cb();
        },
        function (cb) {
            var glob = config.get('glob'),
                Solution;

            Solution = plugin.loadSolution();
            return new Solution(glob, {
                cwd: cwd,
                dest: dest,
                optimize: config.get('optimize')
            })
            .stream
            .pipe(filter('**/*.css'))
            .pipe(browserSync.reload({stream: true}))
            .on('finish', function () {
                lock = false;
                if (queue.length > 0) {
                    queue.shift()();
                }
            });
        }
    ]));

    gulp.task('server', gulp.series([
        'release',
        function (cb) {
            browserSync.init({
                open: 'external',
                server: dest
            }, function () {
                var ewm = require('./src/ewm.js');

                // 生成二维码
                ewm(browserSync);
                watch(cwd);
                cb();
            });
        }
    ]));

    gulp.task('mount', gulp.series([function (cb) {

    }]));
}
module.exports = execute;
